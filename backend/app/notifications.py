import asyncio
import json
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class NotificationManager:
    """Manages WebSocket connections for real-time order notifications to managers."""
    
    def __init__(self):
        self._connections: list[WebSocket] = []
    
    async def subscribe(self, ws: WebSocket):
        await ws.accept()
        self._connections.append(ws)
        logger.info(f"Manager connected. Total connections: {len(self._connections)}")
    
    async def unsubscribe(self, ws: WebSocket):
        if ws in self._connections:
            self._connections.remove(ws)
        logger.info(f"Manager disconnected. Total connections: {len(self._connections)}")
    
    async def broadcast(self, event: dict):
        """Send event to all connected managers."""
        dead = []
        message = json.dumps(event)
        for ws in self._connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.remove(ws)
        logger.info(f"Broadcast event '{event.get('type')}' to {len(self._connections)} managers")

# Singleton instance
notification_manager = NotificationManager()
