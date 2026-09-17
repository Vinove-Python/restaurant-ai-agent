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

Guidelines:
- When notified of a new order, present the details clearly (items, quantities, table, customer, total).
- When updating statuses, confirm the change was made.
- Provide concise but complete information.
- If asked about revenue or statistics, use the available order data.
- Be professional and efficient — the manager is busy.
- When listing orders, highlight any that need attention (new/received orders)."""

class ManagerAgent:
    def __init__(self, odoo: OdooClient):
        self.odoo = odoo
        self._client: genai.Client | None = None
        self._sessions: dict[str, list[types.Content]] = {}

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY environment variable is not set")
            self._client = genai.Client(api_key=GEMINI_API_KEY)
        return self._client
    
    async def chat(self, session_id: str, user_message: str) -> dict:
        if session_id not in self._sessions:
            self._sessions[session_id] = []
        
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
