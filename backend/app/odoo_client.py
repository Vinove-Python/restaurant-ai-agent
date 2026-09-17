import httpx
import logging

logger = logging.getLogger(__name__)

class OdooClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
        )
        
    async def close(self):
        await self.client.aclose()

    async def _call(self, model: str, method: str, payload: dict) -> dict | list:
        url = f"{self.base_url}/{model}/{method}"
        try:
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            # JSON-2 API wraps responses in {"result": ...}
            if isinstance(data, dict) and "result" in data:
                return data["result"]
            return data
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP {e.response.status_code} calling {url}: {e.response.text[:500]}")
            return {}
        except httpx.HTTPError as e:
            logger.error(f"HTTP error calling {url}: {e}")
            return {}
        except Exception as e:
            logger.error(f"Error calling {url}: {e}")
            return {}

    async def get_pos_configs(self) -> list[dict]:
        res = await self._call("pos.config", "search_read", {
            "domain": [],
            "fields": ["name", "module_pos_restaurant", "current_session_id", "floor_ids"]
        })
        return res if isinstance(res, list) else []

    async def get_pos_config(self, config_id: int) -> dict:
        res = await self._call("pos.config", "read", {
            "ids": [config_id],
            "fields": ["name", "current_session_id", "floor_ids", "payment_method_ids"]
        })
        if isinstance(res, list) and res:
            return res[0]
        return {}

    async def list_floors(self) -> list[dict]:
        res = await self._call("restaurant.floor", "search_read", {
            "domain": [],
            "fields": ["name", "pos_config_ids", "table_ids"]
        })
        return res if isinstance(res, list) else []

    async def list_tables(self) -> list[dict]:
        res = await self._call("restaurant.table", "search_read", {
            "domain": [["active", "=", True]],
            "fields": ["id", "display_name", "table_number", "floor_id", "seats", "active"]
        })
        return res if isinstance(res, list) else []

    async def list_tables_by_floor(self, floor_id: int) -> list[dict]:
        res = await self._call("restaurant.table", "search_read", {
            "domain": [["floor_id", "=", floor_id]],
            "fields": ["display_name", "seats"]
        })
        return res if isinstance(res, list) else []

    async def list_open_sessions(self) -> list[dict]:
        res = await self._call("pos.session", "search_read", {
            "domain": [["state", "=", "opened"]],
            "fields": ["name", "config_id", "state", "start_at", "user_id"]
        })
        return res if isinstance(res, list) else []

    async def get_session(self, session_id: int) -> dict:
        res = await self._call("pos.session", "read", {
            "ids": [session_id],
            "fields": ["name", "config_id", "state", "start_at", "stop_at", "order_ids"]
        })
        if isinstance(res, list) and res:
            return res[0]
        return {}

    async def list_orders(self, domain: list = None, limit: int = 50) -> list[dict]:
        payload = {
            "domain": domain or [],
            "limit": limit,
            "fields": ["name", "date_order", "amount_total", "state", "table_id", "partner_id", "session_id"]
        }
        res = await self._call("pos.order", "search_read", payload)
        return res if isinstance(res, list) else []

    async def get_order(self, order_id: int) -> dict:
        res = await self._call("pos.order", "read", {
            "ids": [order_id],
            "fields": ["name", "date_order", "amount_total", "amount_paid", "state", "table_id", "partner_id", "lines", "payment_ids"]
        })
        if isinstance(res, list) and res:
            return res[0]
        return {}

    async def list_order_lines(self, order_id: int) -> list[dict]:
        res = await self._call("pos.order.line", "search_read", {
            "domain": [["order_id", "=", order_id]],
            "fields": ["product_id", "qty", "price_unit", "price_subtotal", "price_subtotal_incl", "full_product_name"]
        })
        return res if isinstance(res, list) else []

    async def create_order(self, session_id: int, lines: list[dict], table_id: int = None, partner_id: int = None, note: str = "") -> int:
        command_lines = []
        amount_total = 0.0
        
        for line in lines:
            product_id = line.get("product_id")
            qty = line.get("qty", 1)
            price_unit = line.get("price_unit", 0.0)
            subtotal = qty * price_unit
            amount_total += subtotal
            
            line_vals = {
                "product_id": product_id,
                "qty": qty,
                "price_unit": price_unit,
                "price_subtotal": subtotal,
                "price_subtotal_incl": subtotal
            }
            command_lines.append([0, 0, line_vals])
            
        vals = {
            "session_id": session_id,
            "lines": command_lines,
            "amount_total": amount_total,
            "amount_tax": 0.0,
            "amount_paid": 0.0,
            "amount_return": 0.0,
        }
        if table_id:
            vals["table_id"] = table_id
        if partner_id:
            vals["partner_id"] = partner_id
        if note:
            vals["note"] = note
            
        res = await self._call("pos.order", "create", {"vals_list": [vals]})
        if isinstance(res, list) and res:
            return res[0]
        elif isinstance(res, int):
            return res
        logger.error(f"Unexpected create_order response: {res}")
        return 0

    async def list_payment_methods(self) -> list[dict]:
        res = await self._call("pos.payment.method", "search_read", {
            "domain": [],
            "fields": ["name", "is_cash_count", "journal_id"]
        })
        return res if isinstance(res, list) else []

    async def list_payments(self, order_id: int) -> list[dict]:
        res = await self._call("pos.payment", "search_read", {
            "domain": [["pos_order_id", "=", order_id]],
            "fields": ["amount", "payment_method_id", "payment_date"]
        })
        return res if isinstance(res, list) else []

    async def list_categories(self) -> list[dict]:
        res = await self._call("pos.category", "search_read", {
            "domain": [],
            "fields": ["name", "parent_id", "child_ids"]
        })
        return res if isinstance(res, list) else []

    async def list_products(self) -> list[dict]:
        res = await self._call(
            "product.product", 
            "search_read", 
            {
                "domain": [["available_in_pos", "=", True]],
                "fields": ["name", "list_price", "pos_categ_ids", "default_code", "barcode"]
            }
        )
        return res if isinstance(res, list) else []

    async def list_customers(self) -> list[dict]:
        res = await self._call("res.partner", "search_read", {
            "domain": [["customer_rank", ">", 0]],
            "fields": ["name", "phone", "email"]
        })
        return res if isinstance(res, list) else []

    async def create_customer(self, name: str, phone: str = "", email: str = "") -> int:
        vals = {"name": name}
        if phone:
            vals["phone"] = phone
        if email:
            vals["email"] = email
        res = await self._call("res.partner", "create", {"vals_list": [vals]})
        if isinstance(res, list) and res:
            return res[0]
        elif isinstance(res, int):
            return res
        return 0

    async def write_order(self, order_id: int, vals: dict) -> bool:
        res = await self._call("pos.order", "write", {"ids": [order_id], "vals": vals})
        return bool(res)
