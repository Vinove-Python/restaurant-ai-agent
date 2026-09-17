import os

# Odoo
ODOO_ROOT_URL = "https://vinove.odoo.com"
ODOO_BASE_URL = f"{ODOO_ROOT_URL}/json/2"
ODOO_API_KEY = "5dc311cf8b37a9421e49fc1a73b8f1e422d06bc8"

# Gemini
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-3.6-flash"
