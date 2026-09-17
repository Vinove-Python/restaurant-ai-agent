import logging
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.notifications import notification_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/manager", tags=["Manager"])

class ChatRequest(BaseModel):
    session_id: str = Field(..., description="Unique session identifier for the manager conversation")
    message: str = Field(..., description="Manager's message")

class ChatResponse(BaseModel):
    response: str = Field(..., description="Agent's response")

# The manager_agent instance will be set by main.py at startup
manager_agent = None

@router.post("/chat", response_model=ChatResponse)
async def manager_chat(request: ChatRequest):
    """Send a message to the manager-facing AI agent."""
    if manager_agent is None:
        raise HTTPException(status_code=503, detail="Manager agent not initialized")
    try:
        result = await manager_agent.chat(request.session_id, request.message)
        return ChatResponse(**result)
    except Exception as e:
        logger.exception("Manager chat error")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clear-session")
async def clear_manager_session(session_id: str):
    """Clear a manager conversation session."""
    if manager_agent:
        manager_agent.clear_session(session_id)
    return {"status": "cleared"}

@router.get("/orders")
async def get_orders(limit: int = 30):
    """Fetch recent orders for manager dashboard."""
    if manager_agent is None or manager_agent.odoo is None:
        raise HTTPException(status_code=503, detail="Manager agent not initialized")
    try:
        orders = await manager_agent.odoo.list_orders(limit=limit)
        return {"orders": orders}
    except Exception as e:
        logger.exception("Error fetching orders")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tables")
async def get_tables():
    """Fetch restaurant tables and floor info for manager dashboard."""
    if manager_agent is None or manager_agent.odoo is None:
        raise HTTPException(status_code=503, detail="Manager agent not initialized")
    try:
        tables = await manager_agent.odoo.list_tables()
        floors = await manager_agent.odoo.list_floors()
        return {"tables": tables, "floors": floors}
    except Exception as e:
        logger.exception("Error fetching tables")
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket router (no prefix — will be mounted at /ws/manager/notifications by main.py)
ws_router = APIRouter(tags=["Manager WebSocket"])

@ws_router.websocket("/ws/manager/notifications")
async def manager_notifications(websocket: WebSocket):
    """WebSocket endpoint for real-time order notifications to managers."""
    await notification_manager.subscribe(websocket)
    try:
        while True:
            # Keep connection alive, handle any incoming messages from manager
            data = await websocket.receive_text()
            # Manager can send ping/ack messages
            if data == "ping":
                await websocket.send_text('{"type": "pong"}')
    except WebSocketDisconnect:
        await notification_manager.unsubscribe(websocket)
        logger.info("Manager WebSocket disconnected")
    except Exception as e:
        await notification_manager.unsubscribe(websocket)
        logger.exception("WebSocket error")
