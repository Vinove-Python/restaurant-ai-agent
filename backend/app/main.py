import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import ODOO_BASE_URL, ODOO_API_KEY, GEMINI_API_KEY
from app.odoo_client import OdooClient
from app.agents.customer_agent import CustomerAgent
from app.agents.manager_agent import ManagerAgent
from app.routes import customer as customer_routes
from app.routes import manager as manager_routes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup resources."""
    # Startup
    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set! Set it via environment variable.")
    
    odoo = OdooClient(base_url=ODOO_BASE_URL, api_key=ODOO_API_KEY)
    logger.info(f"Odoo client initialized: {ODOO_BASE_URL}")
    
    # Initialize agents
    customer_agent = CustomerAgent(odoo)
    manager_agent = ManagerAgent(odoo)
    
    # Inject agents into route modules
    customer_routes.customer_agent = customer_agent
    manager_routes.manager_agent = manager_agent
    
    from app.notifications import notification_manager
    notification_manager.set_manager_agent(manager_agent)
    notification_manager.set_customer_agent(customer_agent)
    
    logger.info("AI agents initialized")
    
    yield
    
    # Shutdown
    await odoo.close()
    logger.info("Odoo client closed")


app = FastAPI(
    title="Restaurant AI Agent",
    description="AI-powered restaurant ordering system with Odoo POS integration",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(customer_routes.router)
app.include_router(manager_routes.router)
app.include_router(manager_routes.ws_router)


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "Restaurant AI Agent",
        "version": "1.0.0",
        "endpoints": {
            "customer_chat": "/api/customer/chat",
            "manager_chat": "/api/manager/chat",
            "manager_notifications": "ws://localhost:8000/ws/manager/notifications",
            "docs": "/docs",
        },
    }


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "gemini_configured": bool(GEMINI_API_KEY)}
