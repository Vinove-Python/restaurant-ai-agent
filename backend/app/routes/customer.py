import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/customer", tags=["Customer"])

class ChatRequest(BaseModel):
    session_id: str = Field(..., description="Unique session identifier for the customer conversation")
    message: str = Field(..., description="Customer's message")

class ChatResponse(BaseModel):
    response: str = Field(..., description="Agent's response")
    order_id: int | None = Field(None, description="Order ID if an order was just placed")

# The customer_agent instance will be set by main.py at startup
customer_agent = None

@router.post("/chat", response_model=ChatResponse)
async def customer_chat(request: ChatRequest):
    """Send a message to the customer-facing AI agent."""
    if customer_agent is None:
        raise HTTPException(status_code=503, detail="Customer agent not initialized")
    try:
        result = await customer_agent.chat(request.session_id, request.message)
        return ChatResponse(**result)
    except Exception as e:
        logger.exception("Customer chat error")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clear-session")
async def clear_customer_session(session_id: str):
    """Clear a customer conversation session."""
    if customer_agent:
        customer_agent.clear_session(session_id)
    return {"status": "cleared"}

@router.get("/menu")
async def get_menu():
    """Fetch menu products and categories from Odoo."""
    if customer_agent is None or customer_agent.odoo is None:
        raise HTTPException(status_code=503, detail="Customer agent not initialized")
    try:
        products = await customer_agent.odoo.list_products()
        categories = await customer_agent.odoo.list_categories()
        return {
            "products": products,
            "categories": categories
        }
    except Exception as e:
        logger.exception("Error fetching menu")
        raise HTTPException(status_code=500, detail=str(e))

