import asyncio
import json
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class NotificationManager:
    """Manages WebSocket connections for real-time order notifications to managers."""
    
    def __init__(self):
        self._connections: list[WebSocket] = []
        self._manager_agent = None
        self._customer_agent = None
    
    def set_manager_agent(self, manager_agent):
        self._manager_agent = manager_agent

    def set_customer_agent(self, customer_agent):
        self._customer_agent = customer_agent
    
    async def subscribe(self, ws: WebSocket):
        await ws.accept()
        self._connections.append(ws)
        logger.info(f"Manager connected. Total connections: {len(self._connections)}")
    
    async def unsubscribe(self, ws: WebSocket):
        if ws in self._connections:
            self._connections.remove(ws)
        logger.info(f"Manager disconnected. Total connections: {len(self._connections)}")
    
    async def broadcast(self, event: dict):
        """Send event to all connected clients and inject notifications into AI agents."""
        if event.get("type") == "new_order" and self._manager_agent:
            try:
                self._manager_agent.inject_order_notification(event)
            except Exception:
                logger.exception("Error injecting order notification into ManagerAgent")

        if event.get("type") == "order_status_update" and self._customer_agent:
            try:
                self._customer_agent.inject_status_update(event)
            except Exception:
                logger.exception("Error injecting status update into CustomerAgent")

        dead = []
        message = json.dumps(event)
        for ws in self._connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            if ws in self._connections:
                self._connections.remove(ws)
        logger.info(f"Broadcast event '{event.get('type')}' to {len(self._connections)} clients")

# Singleton instance
notification_manager = NotificationManager()
