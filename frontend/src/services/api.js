/**
 * API Service for Customer Chat, Manager Chat, and Real-time WebSocket Notifications.
 */

const API_BASE = '/api';

export async function sendCustomerMessage(sessionId, message) {
  const res = await fetch(`${API_BASE}/customer/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to send message to Customer agent');
  }
  return res.json(); // { response: string, order_id: number | null }
}

export async function clearCustomerSession(sessionId) {
  const res = await fetch(`${API_BASE}/customer/clear-session?session_id=${encodeURIComponent(sessionId)}`, {
    method: 'POST',
  });
  return res.json();
}

export async function getMenu() {
  const res = await fetch(`${API_BASE}/customer/menu`);
  if (!res.ok) throw new Error('Failed to fetch menu');
  return res.json(); // { products: [], categories: [] }
}

export async function sendManagerMessage(sessionId, message) {
  const res = await fetch(`${API_BASE}/manager/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to send message to Manager agent');
  }
  return res.json(); // { response: string }
}

export async function clearManagerSession(sessionId) {
  const res = await fetch(`${API_BASE}/manager/clear-session?session_id=${encodeURIComponent(sessionId)}`, {
    method: 'POST',
  });
  return res.json();
}

export async function getManagerOrders(limit = 30) {
  const res = await fetch(`${API_BASE}/manager/orders?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json(); // { orders: [] }
}

export async function getManagerTables() {
  const res = await fetch(`${API_BASE}/manager/tables`);
  if (!res.ok) throw new Error('Failed to fetch tables');
  return res.json(); // { tables: [], floors: [] }
}

export async function getHealthStatus() {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return { status: 'error' };
    return res.json();
  } catch {
    return { status: 'offline' };
  }
}

/**
 * WebSocket Connection Helper for Manager Real-time Order Notifications
 */
export function createNotificationSocket({ onMessage, onStatusChange }, sessionId = null) {
  let ws = null;
  let pingInterval = null;
  let isClosedIntentionally = false;
  let retryCount = 0;

  function connect() {
    if (isClosedIntentionally) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    let wsUrl = `${protocol}//${host}/ws/manager/notifications`;
    if (sessionId) {
      wsUrl += `?session_id=${encodeURIComponent(sessionId)}`;
    }

    onStatusChange?.('connecting');
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      onStatusChange?.('connected');
      retryCount = 0;

      // Heartbeat ping every 25 seconds
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') return;
        onMessage?.(data);
      } catch {
        // Raw string message fallback
        onMessage?.({ type: 'text', content: event.data });
      }
    };

    ws.onerror = (err) => {
      console.warn('WebSocket notification error:', err);
    };

    ws.onclose = () => {
      clearInterval(pingInterval);
      if (!isClosedIntentionally) {
        onStatusChange?.('reconnecting');
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        retryCount++;
        setTimeout(connect, delay);
      } else {
        onStatusChange?.('disconnected');
      }
    };
  }

  connect();

  return {
    close: () => {
      isClosedIntentionally = true;
      clearInterval(pingInterval);
      if (ws) ws.close();
    },
  };
}
