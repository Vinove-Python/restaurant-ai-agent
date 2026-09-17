import json
import logging
from datetime import datetime, timezone
from app.odoo_client import OdooClient
from app.config import ODOO_BASE_URL, ODOO_API_KEY, ODOO_ROOT_URL
from google.genai import types

logger = logging.getLogger(__name__)

# In-memory order status tracking
# Key: order_id (int), Value: {"status": str, "updated_at": str, "order_details": dict}
order_status_store: dict[int, dict] = {}

# ─── Tool execution functions ───

async def _browse_menu(odoo: OdooClient, args: dict, **kwargs) -> dict:
    categories = await odoo.list_categories()
    products = await odoo.list_products()
    
    result = []
    for cat in categories:
        cat_id = cat.get("id")
        cat_name = cat.get("name")
        items = []
        for p in products:
            if cat_id in p.get("pos_categ_ids", []):
                items.append({
                    "id": p.get("id"),
                    "name": p.get("name"),
                    "price": p.get("list_price")
                })
        if items:
            result.append({"name": cat_name, "items": items})
    return {"categories": result}

async def _search_menu_item(odoo: OdooClient, args: dict, **kwargs) -> dict:
    query = args.get("query", "").lower()
    products = await odoo.list_products()
    matches = [
        {
            "id": p.get("id"),
            "name": p.get("name"),
            "price": p.get("list_price")
        }
        for p in products if query in p.get("name", "").lower()
    ]
    return {"matches": matches}

async def _get_available_tables(odoo: OdooClient, args: dict, **kwargs) -> dict:
    floor_name = args.get("floor_name", "").lower()
    floors = await odoo.list_floors()
    tables = await odoo.list_tables()
    
    result = []
    for f in floors:
        if floor_name and floor_name not in f.get("name", "").lower():
            continue
        floor_tables = [t for t in tables if t.get("floor_id") and isinstance(t["floor_id"], (list, tuple)) and t["floor_id"][0] == f.get("id")]
        result.append({
            "floor": f.get("name"),
            "tables": [{"id": t.get("id"), "name": t.get("display_name"), "seats": t.get("seats")} for t in floor_tables if t.get("active")]
        })
    return {"floors": result}

async def _create_order(odoo: OdooClient, args: dict, **kwargs) -> dict:
    items = args.get("items", [])
    table_id = args.get("table_id")
    customer_name = args.get("customer_name")
    customer_phone = args.get("customer_phone", "")
    customer_email = args.get("customer_email", "")
    special_requests = args.get("special_requests", "")
    
    if not items:
        return {"success": False, "message": "No items provided"}
        
    products = await odoo.list_products()
    prod_map = {p["id"]: p for p in products}
    
    partner_id = None
    if customer_name:
        partner_id = await odoo.create_customer(name=customer_name, phone=customer_phone, email=customer_email)
        
    sessions = await odoo.list_open_sessions()
    if not sessions:
        return {"success": False, "message": "No open POS session available"}
    session_id = sessions[0]["id"]
    
    lines = []
    for item in items:
        pid = item.get("product_id")
        qty = item.get("quantity", 1)
        if pid not in prod_map:
            continue
        price_unit = prod_map[pid].get("list_price", 0)
        lines.append({
            "product_id": pid,
            "qty": qty,
            "price_unit": price_unit
        })
    
    if not lines:
        return {"success": False, "message": "No valid products found"}
        
    order_id = await odoo.create_order(
        session_id=session_id, 
        lines=lines, 
        table_id=table_id, 
        partner_id=partner_id, 
        note=special_requests
    )
    
    order_details = {
        "items": items,
        "table_id": table_id,
        "customer_name": customer_name,
        "special_requests": special_requests
    }
    
    order_status_store[order_id] = {
        "status": "received",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "order_details": order_details
    }
    
    notification_callback = kwargs.get("notification_callback")
    if notification_callback:
        await notification_callback({
            "order_id": order_id,
            "status": "received",
            "details": order_details
        })
        
    return {"success": True, "order_id": order_id, "message": f"Order {order_id} created successfully"}

async def _get_order_status(odoo: OdooClient, args: dict, **kwargs) -> dict:
    order_id = args.get("order_id")
    if order_id in order_status_store:
        return order_status_store[order_id]
    
    order = await odoo.get_order(order_id)
    if not order:
        return {"error": "Order not found"}
    return {"status": order.get("state"), "order": order}

async def _create_customer(odoo: OdooClient, args: dict, **kwargs) -> dict:
    name = args.get("name")
    phone = args.get("phone", "")
    email = args.get("email", "")
    if not name:
        return {"error": "Name is required"}
    customer_id = await odoo.create_customer(name=name, phone=phone, email=email)
    return {"customer_id": customer_id}

async def _list_active_orders(odoo: OdooClient, args: dict, **kwargs) -> dict:
    orders = await odoo.list_orders(limit=20)
    result = []
    for o in orders:
        oid = o.get("id")
        status = order_status_store.get(oid, {}).get("status") or o.get("state")
        result.append({
            "id": oid,
            "name": o.get("name"),
            "amount_total": o.get("amount_total"),
            "status": status,
            "table_id": o.get("table_id")
        })
    return {"orders": result}

async def _get_order_details(odoo: OdooClient, args: dict, **kwargs) -> dict:
    order_id = args.get("order_id")
    order = await odoo.get_order(order_id)
    if not order:
        return {"error": "Order not found"}
    lines = await odoo.list_order_lines(order_id)
    return {"order": order, "lines": lines}

async def _update_order_status(odoo: OdooClient, args: dict, **kwargs) -> dict:
    order_id = args.get("order_id")
    status = args.get("status")
    valid_statuses = ["received", "accepted", "preparing", "ready", "delivered"]
    if status not in valid_statuses:
        return {"error": f"Invalid status, must be one of {valid_statuses}"}
        
    if order_id not in order_status_store:
        order = await odoo.get_order(order_id)
        if not order:
            return {"error": "Order not found"}
        order_status_store[order_id] = {
            "order_details": order,
        }
    
    order_status_store[order_id]["status"] = status
    order_status_store[order_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
    return {"success": True, "order_id": order_id, "status": status}

async def _list_sessions(odoo: OdooClient, args: dict, **kwargs) -> dict:
    sessions = await odoo.list_open_sessions()
    return {"sessions": sessions}

async def _get_table_overview(odoo: OdooClient, args: dict, **kwargs) -> dict:
    tables = await odoo.list_tables()
    orders = await odoo.list_orders(domain=[('state', 'not in', ['paid', 'done', 'invoiced'])])
    
    table_orders = {}
    for o in orders:
        tid = o.get("table_id")
        if tid:
            tid_val = tid[0] if isinstance(tid, (list, tuple)) else tid
            if tid_val not in table_orders:
                table_orders[tid_val] = []
            table_orders[tid_val].append(o.get("id"))
            
    result = []
    for t in tables:
        tid = t.get("id")
        result.append({
            "id": tid,
            "name": t.get("display_name"),
            "active_orders": table_orders.get(tid, [])
        })
    return {"tables": result}

async def execute_tool(tool_name: str, args: dict, odoo: OdooClient, **kwargs) -> str:
    """Dispatch a tool call to the appropriate handler. Returns a JSON string result."""
    handlers = {
        # Customer tools
        "browse_menu": _browse_menu,
        "search_menu_item": _search_menu_item,
        "get_available_tables": _get_available_tables,
        "create_order": _create_order,
        "get_order_status": _get_order_status,
        "create_customer": _create_customer,
        # Manager tools
        "list_active_orders": _list_active_orders,
        "get_order_details": _get_order_details,
        "update_order_status": _update_order_status,
        "list_sessions": _list_sessions,
        "get_table_overview": _get_table_overview,
    }
    handler = handlers.get(tool_name)
    if not handler:
        return json.dumps({"error": f"Unknown tool: {tool_name}"})
    try:
        result = await handler(odoo=odoo, args=args, **kwargs)
        return json.dumps(result, default=str)
    except Exception as e:
        logger.exception(f"Tool {tool_name} failed")
        return json.dumps({"error": str(e)})


CUSTOMER_TOOLS = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="browse_menu",
            description="Browse the full restaurant menu with all available items and prices, grouped by category. Call this when the customer wants to see the menu or asks what's available.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={},
            ),
        ),
        types.FunctionDeclaration(
            name="search_menu_item",
            description="Search for a specific dish or menu item by name or keyword. Use this when the customer asks about a specific dish.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "query": types.Schema(type=types.Type.STRING, description="Search query - dish name or keyword"),
                },
                required=["query"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_available_tables",
            description="Get available restaurant tables, optionally filtered by floor name. Use when customer wants to choose a table or check availability.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "floor_name": types.Schema(type=types.Type.STRING, description="Optional floor name to filter tables"),
                },
            ),
        ),
        types.FunctionDeclaration(
            name="create_order",
            description="Place a new restaurant order. Call this ONLY after confirming all items with the customer. Requires at least the list of items.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "items": types.Schema(
                        type=types.Type.ARRAY,
                        items=types.Schema(
                            type=types.Type.OBJECT,
                            properties={
                                "product_id": types.Schema(type=types.Type.INTEGER, description="Product ID from the menu"),
                                "quantity": types.Schema(type=types.Type.INTEGER, description="Quantity to order"),
                            },
                            required=["product_id", "quantity"],
                        ),
                        description="List of items to order",
                    ),
                    "table_id": types.Schema(type=types.Type.INTEGER, description="Table ID for dine-in orders"),
                    "customer_name": types.Schema(type=types.Type.STRING, description="Customer's name"),
                    "customer_phone": types.Schema(type=types.Type.STRING, description="Customer's phone number"),
                    "special_requests": types.Schema(type=types.Type.STRING, description="Any special requests or notes for the order"),
                },
                required=["items"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_order_status",
            description="Check the current status of an order by its order ID.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "order_id": types.Schema(type=types.Type.INTEGER, description="The order ID to check"),
                },
                required=["order_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="create_customer",
            description="Register a new customer. Use when the customer wants to provide their details for the order.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "name": types.Schema(type=types.Type.STRING, description="Customer's full name"),
                    "phone": types.Schema(type=types.Type.STRING, description="Phone number"),
                    "email": types.Schema(type=types.Type.STRING, description="Email address"),
                },
                required=["name"],
            ),
        ),
    ]
)

MANAGER_TOOLS = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="list_active_orders",
            description="List all recent and active orders with their current status. Use to get an overview of current orders.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={},
            ),
        ),
        types.FunctionDeclaration(
            name="get_order_details",
            description="Get full details of a specific order including all items, quantities, and prices.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "order_id": types.Schema(type=types.Type.INTEGER, description="The order ID"),
                },
                required=["order_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="update_order_status",
            description="Update the status of an order. Valid statuses: accepted, preparing, ready, delivered.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "order_id": types.Schema(type=types.Type.INTEGER, description="The order ID to update"),
                    "status": types.Schema(type=types.Type.STRING, description="New status: accepted, preparing, ready, or delivered"),
                },
                required=["order_id", "status"],
            ),
        ),
        types.FunctionDeclaration(
            name="list_sessions",
            description="List all currently open POS sessions.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={},
            ),
        ),
        types.FunctionDeclaration(
            name="get_table_overview",
            description="Get an overview of all restaurant tables and their current occupancy/order status.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={},
            ),
        ),
    ]
)

if "__main__" == __name__:
    import asyncio
    from app.odoo_client import OdooClient

    async def test_tools():
        odoo = OdooClient(
            base_url=ODOO_BASE_URL,
            api_key=ODOO_API_KEY
        )
        try:
            # Test browse_menu
            menu_result = await _browse_menu(odoo, {})
            print("Menu:")
            print(json.dumps(menu_result, indent=2))

            # Test search_menu_item
            search_result = await _search_menu_item(
                odoo,
                {"query": "Pizza"}
            )
            print("Search Result:")
            print(json.dumps(search_result, indent=2))

            # Test get_available_tables
            tables_result = await _get_available_tables(
                odoo,
                {"floor_name": "Main"}
            )
            print("Available Tables:")
            print(json.dumps(tables_result, indent=2))

        finally:
            await odoo.close()

    asyncio.run(test_tools())