import os
from dotenv import load_dotenv

load_dotenv()

# Odoo
ODOO_ROOT_URL = "https://vinove.odoo.com"
ODOO_BASE_URL = f"{ODOO_ROOT_URL}/json/2"
ODOO_API_KEY = os.environ.get("ODOO_API_KEY", "")

# Gemini
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
