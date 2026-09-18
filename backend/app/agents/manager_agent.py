from __future__ import annotations

import logging
from google import genai
from google.genai import types

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.odoo_client import OdooClient
from app.tools import MANAGER_TOOLS, execute_tool

logger = logging.getLogger(__name__)

MANAGER_SYSTEM_PROMPT = """You are an intelligent restaurant management assistant. You help the restaurant manager monitor and manage incoming orders, track order statuses, and oversee restaurant operations.

Capabilities:
1. VIEW ORDERS: You can list all active/recent orders and get detailed information about any order.
2. UPDATE ORDER STATUS: You can update order statuses through the workflow:
   - received → accepted → preparing → ready → delivered
   Only move forward in the workflow (don't go backwards).

ORDER NOTIFICATIONS IN CONTEXT:
- You will automatically receive real-time order notifications in your chat history containing complete order details.
- When the manager instructs you regarding an order (e.g. "accept order", "mark order #104 as preparing", "what did John order?"), refer directly to these order notification messages in your conversation context.
- When updating statuses, execute the `update_order_status` tool with the corresponding `order_id` and new status, and confirm the change clearly.

Guidelines:
- Confirm all status updates concisely and professionally.
- Provide clear summaries when listing orders or responding to inquiries.
- Be professional and efficient — the manager is busy."""

def format_order_notification_text(order_info: dict) -> str:
    order_id = order_info.get("order_id")
    customer = order_info.get("customer_name") or "Guest"
    table = order_info.get("table_id") or "N/A"
    total = order_info.get("total_amount", 0.0)
    notes = order_info.get("special_requests") or "None"
    items = order_info.get("items", [])
    
    item_lines = []
    for item in items:
        name = item.get("name", f"Product #{item.get('product_id')}")
        qty = item.get("quantity", 1)
        price = item.get("price_unit", 0.0)
        subtotal = item.get("subtotal", price * qty)
        item_lines.append(f"  - {qty}x {name} (${price:.2f} each = ${subtotal:.2f})")
    
    items_formatted = "\n".join(item_lines) if item_lines else "  - No items listed"
    
    return (
        f"[SYSTEM ORDER NOTIFICATION]\n"
        f"A new customer order has been placed!\n"
        f"- Order ID: #{order_id}\n"
        f"- Customer Name: {customer}\n"
        f"- Table ID: {table}\n"
        f"- Status: received\n"
        f"- Items Ordered:\n{items_formatted}\n"
        f"- Total Amount: ${total:.2f}\n"
        f"- Special Requests / Notes: {notes}\n\n"
        f"Please retain this order context to process any manager instructions for order #{order_id}."
    )

class ManagerAgent:
    def __init__(self, odoo: OdooClient):
        self.odoo = odoo
        self._client: genai.Client | None = None
        self._sessions: dict[str, list[types.Content]] = {}
        self._recent_notifications: list[dict] = []

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY environment variable is not set")
            self._client = genai.Client(api_key=GEMINI_API_KEY)
        return self._client

    def inject_order_notification(self, order_info: dict, session_id: str | None = None):
        """Inject complete order notification into manager sessions so Gemini LLM has full context."""
        notification_text = format_order_notification_text(order_info)
        
        # Keep recent order notifications to seed new sessions
        self._recent_notifications.append(order_info)
        if len(self._recent_notifications) > 20:
            self._recent_notifications.pop(0)

        user_content = types.Content(
            role="user",
            parts=[types.Part.from_text(text=notification_text)]
        )
        model_content = types.Content(
            role="model",
            parts=[types.Part.from_text(
                text=f"Order notification received for Order #{order_info.get('order_id')} "
                     f"(Customer: {order_info.get('customer_name', 'Guest')}, Table: {order_info.get('table_id', 'N/A')}, Total: ${order_info.get('total_amount', 0.0):.2f}). "
                     f"Logged in context with status 'received'. Ready for commands."
            )]
        )

        target_sessions = [session_id] if session_id and session_id in self._sessions else list(self._sessions.keys())
        for sid in target_sessions:
            if sid not in self._sessions:
                self._sessions[sid] = []
            self._sessions[sid].append(user_content)
            self._sessions[sid].append(model_content)

        logger.info(f"Injected order #{order_info.get('order_id')} notification into {len(target_sessions)} manager sessions")
    
    async def chat(self, session_id: str, user_message: str) -> dict:
        if session_id not in self._sessions:
            self._sessions[session_id] = []
            # Seed new session with recent unhandled order notifications
            for order_info in self._recent_notifications:
                n_text = format_order_notification_text(order_info)
                self._sessions[session_id].append(
                    types.Content(role="user", parts=[types.Part.from_text(text=n_text)])
                )
                self._sessions[session_id].append(
                    types.Content(
                        role="model", 
                        parts=[types.Part.from_text(
                            text=f"Order notification logged: Order #{order_info.get('order_id')} "
                                 f"({order_info.get('customer_name', 'Guest')}, Table: {order_info.get('table_id', 'N/A')}, Total: ${order_info.get('total_amount', 0.0):.2f})."
                        )]
                    )
                )
        
        history = self._sessions[session_id]
        history.append(types.Content(role="user", parts=[types.Part.from_text(text=user_message)]))
        
        response = self.client.models.generate_content(
            model=GEMINI_MODEL,
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=MANAGER_SYSTEM_PROMPT,
                tools=[MANAGER_TOOLS],
                temperature=0.5,
            ),
        )
        
        while response.candidates[0].content.parts and any(
            part.function_call for part in response.candidates[0].content.parts
        ):
            history.append(response.candidates[0].content)
            
            tool_response_parts = []
            for part in response.candidates[0].content.parts:
                if part.function_call:
                    fc = part.function_call
                    logger.info(f"Manager agent calling tool: {fc.name} with args: {fc.args}")
                    
                    result = await execute_tool(
                        fc.name,
                        dict(fc.args) if fc.args else {},
                        self.odoo,
                    )
                    
                    tool_response_parts.append(
                        types.Part.from_function_response(
                            name=fc.name,
                            response={"result": result},
                        )
                    )
            
            history.append(types.Content(role="user", parts=tool_response_parts))
            
            response = self.client.models.generate_content(
                model=GEMINI_MODEL,
                contents=history,
                config=types.GenerateContentConfig(
                    system_instruction=MANAGER_SYSTEM_PROMPT,
                    tools=[MANAGER_TOOLS],
                    temperature=0.5,
                ),
            )
        
        history.append(response.candidates[0].content)
        text_response = response.text or "I couldn't process that. Please try again."
        
        return {"response": text_response}
    
    def clear_session(self, session_id: str):
        self._sessions.pop(session_id, None)
