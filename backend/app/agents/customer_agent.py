from __future__ import annotations

import logging
from datetime import datetime, timezone
from google import genai
from google.genai import types

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.odoo_client import OdooClient
from app.notifications import notification_manager
from app.tools import CUSTOMER_TOOLS, execute_tool

logger = logging.getLogger(__name__)

CUSTOMER_SYSTEM_PROMPT = """You are a professional restaurant ordering assistant. Your job is to help customers browse the menu, choose items, and place orders.

Guidelines:
1. MENU BROWSING: When the customer wants to see the menu, use the browse_menu tool. Present the items grouped by category. For each dish, format it as a list item with its name, price, and image markdown using its product ID:
   - **[Dish Name]** — $[Price]
     ![[Dish Name]]([product_id])
   For example:
   - **Bacon Burger** — $15.50
     ![Bacon Burger](12)
   This markdown format enables the frontend to automatically render the product image carousel.

2. ORDER TAKING:
   - Listen carefully to what the customer wants to order
   - Use search_menu_item to find specific dishes if needed (include product image markdown `![Dish Name](product_id)` when presenting search results)
   - Keep track of all items the customer wants
   - Ask about quantities if not specified
   - Ask for their name for the order

3. ORDER CONFIRMATION: Before placing the order, ALWAYS present a complete summary:
   - List all items with quantities and individual prices
   - Show the total amount
   - Show any special requests
   - Ask the customer to confirm

4. ORDER PLACEMENT: Only call create_order AFTER the customer explicitly confirms. Never place an order without confirmation.

5. POST-ORDER: After successful placement, provide the order ID and let them know the restaurant has been notified.

6. Be conversational, concise, and helpful. If a customer asks about something not on the menu, let them know politely. Handle errors gracefully.

IMPORTANT: Always use the actual product IDs from the menu when creating orders. Never guess product IDs."""

class CustomerAgent:
    def __init__(self, odoo: OdooClient):
        self.odoo = odoo
        self._client: genai.Client | None = None
        self._sessions: dict[str, list[types.Content]] = {}  # session_id -> conversation history

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY environment variable is not set")
            self._client = genai.Client(api_key=GEMINI_API_KEY)
        return self._client

    def inject_status_update(self, event: dict):
        """Inject real-time order status updates into customer sessions."""
        order_id = event.get("order_id")
        status = event.get("status")
        
        status_text = (
            f"[SYSTEM NOTIFICATION - ORDER STATUS UPDATE]\n"
            f"The restaurant manager has updated the status of Order #{order_id} to: '{status}'.\n"
            f"If the customer asks about the status of order #{order_id}, inform them that it is currently '{status}'."
        )
        user_content = types.Content(role="user", parts=[types.Part.from_text(text=status_text)])
        model_content = types.Content(
            role="model",
            parts=[types.Part.from_text(text=f"Understood. Order #{order_id} status is now updated to '{status}'.")]
        )
        
        for sid in self._sessions:
            self._sessions[sid].append(user_content)
            self._sessions[sid].append(model_content)
            
        logger.info(f"Injected status update for order #{order_id} ('{status}') into {len(self._sessions)} customer sessions")
    
    async def chat(self, session_id: str, user_message: str) -> dict:
        """Process a customer message and return the agent's response."""
        # Get or create conversation history
        if session_id not in self._sessions:
            self._sessions[session_id] = []
        
        history = self._sessions[session_id]
        
        # Add user message to history
        history.append(types.Content(role="user", parts=[types.Part.from_text(text=user_message)]))
        
        # Call Gemini with tools
        response = self.client.models.generate_content(
            model=GEMINI_MODEL,
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=CUSTOMER_SYSTEM_PROMPT,
                tools=[CUSTOMER_TOOLS],
                temperature=0.7,
            ),
        )
        
        order_id = None
        
        # Handle tool calls in a loop
        while response.candidates[0].content.parts and any(
            part.function_call for part in response.candidates[0].content.parts
        ):
            # Add assistant's response (with tool calls) to history
            history.append(response.candidates[0].content)
            
            # Process each function call
            tool_response_parts = []
            for part in response.candidates[0].content.parts:
                if part.function_call:
                    fc = part.function_call
                    logger.info(f"Customer agent calling tool: {fc.name} with args: {fc.args}")
                    
                    # Define notification callback for order creation
                    async def on_order_created(order_details: dict):
                        await notification_manager.broadcast({
                            "type": "new_order",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            **order_details,
                        })
                    
                    result = await execute_tool(
                        fc.name, 
                        dict(fc.args) if fc.args else {},
                        self.odoo,
                        notification_callback=on_order_created,
                    )
                    
                    # Check if this was an order creation
                    import json
                    try:
                        result_data = json.loads(result)
                        if fc.name == "create_order" and result_data.get("success"):
                            order_id = result_data.get("order_id")
                    except:
                        pass
                    
                    tool_response_parts.append(
                        types.Part.from_function_response(
                            name=fc.name,
                            response={"result": result},
                        )
                    )
            
            # Add tool responses to history
            history.append(types.Content(role="user", parts=tool_response_parts))
            
            # Get next response from Gemini
            response = self.client.models.generate_content(
                model=GEMINI_MODEL,
                contents=history,
                config=types.GenerateContentConfig(
                    system_instruction=CUSTOMER_SYSTEM_PROMPT,
                    tools=[CUSTOMER_TOOLS],
                    temperature=0.7,
                ),
            )
        
        # Add final response to history
        history.append(response.candidates[0].content)
        
        # Extract text response
        text_response = response.text or "I apologize, I couldn't process that. Could you try again?"
        
        return {
            "response": text_response,
            "order_id": order_id,
        }
    
    def clear_session(self, session_id: str):
        """Clear conversation history for a session."""
        self._sessions.pop(session_id, None)
