# Restaurant AI Agent

AI-powered restaurant ordering system with Odoo POS integration and real-time manager notifications.

## Architecture Overview

The system provides a customer-facing AI agent for taking orders and a manager-facing AI agent for querying restaurant data. Real-time updates on new orders are delivered to the manager via WebSocket. 
- Fast API serves as the core application framework.
- Gemini is used as the LLM backing the agents.
- Odoo POS serves as the underlying restaurant management and POS backend.

## Prerequisites

- Python 3.11+
- Gemini API Key
- Odoo POS credentials (URL and API key)

## Setup

1. Clone the repo
2. Setup virtual environment:
```bash
python -m venv venv
source venv/bin/activate
```
3. Install dependencies:
```bash
pip install -r requirements.txt
```
4. Set environment variables:
```bash
export GEMINI_API_KEY="your-gemini-api-key"
export ODOO_BASE_URL="your-odoo-url"
export ODOO_API_KEY="your-odoo-api-key"
```

## Running the Server

Start the development server:
```bash
uvicorn app.main:app --reload
```

## API Reference

### Health Checks

- `GET /` — Root endpoint displaying available endpoints
- `GET /api/health` — Check the service health and Gemini configuration

### Customer Endpoints

#### POST `/api/customer/chat`
Send a message to the customer-facing AI agent.

Request:
```bash
curl -X POST http://localhost:8000/api/customer/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "cust-123", "message": "I would like to order a pizza"}'
```

Response:
```json
{
  "response": "Sure, what kind of pizza would you like?",
  "order_id": null
}
```

#### POST `/api/customer/clear-session`
Clear the chat session for a customer.

### Manager Endpoints

#### POST `/api/manager/chat`
Send a message to the manager-facing AI agent.

Request:
```bash
curl -X POST http://localhost:8000/api/manager/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "mgr-123", "message": "How many orders were placed today?"}'
```

Response:
```json
{
  "response": "There were 15 orders placed today."
}
```

#### POST `/api/manager/clear-session`
Clear the chat session for a manager.

#### WebSocket `/ws/manager/notifications`
Connect to the manager notifications WebSocket to receive real-time order alerts.
- Endpoint: `ws://localhost:8000/ws/manager/notifications`
- Send `ping` to keep the connection alive (will receive `{"type": "pong"}`).

Events received by client:
```json
{
  "event": "new_order",
  "data": {
    "order_id": 42,
    "customer": "cust-123",
    "details": "..."
  }
}
```

## Example Flows

1. **Customer Ordering**:
   Customer chats via POST `/api/customer/chat` to add items to their cart. Once finalized, the agent places the order with Odoo, returning an `order_id` in the API response.
2. **Manager Notified**:
   The `notification_manager` fires a `new_order` event to all subscribed WebSockets connected to `/ws/manager/notifications`.
3. **Manager Actions**:
   The manager can chat via `/api/manager/chat` to get summaries or check statuses.
