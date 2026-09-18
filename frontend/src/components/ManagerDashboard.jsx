import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendManagerMessage, clearManagerSession } from '../services/api';
import {
  Bot,
  User,
  Send,
  Sparkles,
  RotateCcw,
  LayoutDashboard,
  Wifi,
  WifiOff,
  ShoppingBag,
  CheckCircle2,
  Clock,
} from 'lucide-react';

function OrderNotificationCard({ orderData, onQuickAction }) {
  const { order_id, customer_name, table_id, items, total_amount, special_requests, note, timestamp } = orderData;
  const notes = special_requests || note;

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderLeft: '5px solid #000000',
        borderRadius: '8px',
        padding: '0.875rem 1rem',
        maxWidth: '100%',
        width: '100%',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.65rem',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '0.4rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              background: '#000000',
              color: '#ffffff',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontWeight: 800,
              fontSize: '0.775rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ShoppingBag size={13} /> ORDER #{order_id}
          </span>
          <span
            style={{
              background: '#fef3c7',
              color: '#92400e',
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              fontWeight: 700,
              fontSize: '0.725rem',
              textTransform: 'uppercase',
            }}
          >
            Received
          </span>
        </div>
        <span style={{ fontSize: '0.725rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Clock size={12} />
          {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
        </span>
      </div>

      {/* Customer & Location */}
      <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.65rem', fontSize: '0.825rem' }}>
        <div>
          <strong style={{ color: '#475569' }}>Customer:</strong>{' '}
          <span style={{ fontWeight: 600, color: '#0f172a' }}>{customer_name || 'Guest'}</span>
        </div>
        <div>
          <strong style={{ color: '#475569' }}>Table:</strong>{' '}
          <span style={{ fontWeight: 600, color: '#0f172a' }}>{table_id ? `Table #${table_id}` : 'Takeout / Direct'}</span>
        </div>
      </div>

      {/* Items Summary Table */}
      {items && items.length > 0 && (
        <div
          style={{
            marginBottom: '0.65rem',
            background: '#f8fafc',
            borderRadius: '6px',
            padding: '0.6rem 0.75rem',
            border: '1px solid #f1f5f9',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: '0.775rem',
              color: '#334155',
              marginBottom: '0.35rem',
              borderBottom: '1px dashed #cbd5e1',
              paddingBottom: '0.2rem',
            }}
          >
            Items Ordered ({items.length})
          </div>
          {items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                padding: '0.15rem 0',
              }}
            >
              <span>
                <span style={{ fontWeight: 700, color: '#000000' }}>{item.quantity}x</span>{' '}
                {item.name || `Product #${item.product_id}`}
              </span>
              <span style={{ fontWeight: 600, color: '#334155' }}>
                ${(item.subtotal || (item.price_unit * item.quantity) || 0).toFixed(2)}
              </span>
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.875rem',
              fontWeight: 800,
              color: '#000000',
              borderTop: '1px solid #cbd5e1',
              marginTop: '0.35rem',
              paddingTop: '0.35rem',
            }}
          >
            <span>Total Amount</span>
            <span>${(total_amount || 0).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Special Requests */}
      {notes && (
        <div
          style={{
            fontSize: '0.775rem',
            color: '#475569',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            padding: '0.45rem 0.65rem',
            borderRadius: '6px',
            marginBottom: '0.65rem',
          }}
        >
          <strong>Special Instructions:</strong> <em>"{notes}"</em>
        </div>
      )}

      {/* Quick Action Buttons */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
        <button
          onClick={() => onQuickAction(`Accept order #${order_id}`)}
          style={{
            padding: '0.3rem 0.6rem',
            fontSize: '0.725rem',
            fontWeight: 700,
            background: '#000000',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ✅ Accept Order
        </button>
        <button
          onClick={() => onQuickAction(`Mark order #${order_id} as preparing`)}
          style={{
            padding: '0.3rem 0.6rem',
            fontSize: '0.725rem',
            fontWeight: 700,
            background: '#d97706',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🍳 Start Preparing
        </button>
        <button
          onClick={() => onQuickAction(`Mark order #${order_id} as ready`)}
          style={{
            padding: '0.3rem 0.6rem',
            fontSize: '0.725rem',
            fontWeight: 700,
            background: '#059669',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🔔 Mark Ready
        </button>
        <button
          onClick={() => onQuickAction(`Mark order #${order_id} as delivered`)}
          style={{
            padding: '0.3rem 0.6rem',
            fontSize: '0.725rem',
            fontWeight: 700,
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🚚 Mark Delivered
        </button>
      </div>
    </div>
  );
}

export default function ManagerDashboard({ wsStatus, latestOrderEvent }) {
  const [sessionId] = useState(() => 'mgr_' + Math.random().toString(36).substring(2, 9));
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Welcome Chief! 👨‍🍳 How can I assist you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef(null);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Insert incoming order notification directly into manager chat history
  useEffect(() => {
    if (!latestOrderEvent || latestOrderEvent.type !== 'new_order') return;

    const orderId = latestOrderEvent.order_id;
    setMessages((prev) => {
      const alreadyAdded = prev.some(
        (m) => m.isOrderNotification && m.orderData?.order_id === orderId
      );
      if (alreadyAdded) return prev;

      return [
        ...prev,
        {
          role: 'assistant',
          isOrderNotification: true,
          orderData: latestOrderEvent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ];
    });
  }, [latestOrderEvent]);

  const handleSendMessage = async (textToSend = inputMessage) => {
    const text = textToSend.trim();
    if (!text || loading) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'user', text, timestamp: userTime }]);
    setInputMessage('');
    setLoading(true);

    try {
      const data = await sendManagerMessage(sessionId, text);
      const agentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.response,
          timestamp: agentTime,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `⚠️ Manager Assistant Error: ${err.message || 'Unable to fetch response.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 70px)', overflow: 'hidden', padding: '1rem', justifyContent: 'center' }}>
      {/* Centered Single-Column Manager AI Assistant */}
      <div style={{ flex: 1, maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

        {/* Manager Chat Body */}
        <div
          className="glass-panel"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';

            if (msg.isOrderNotification && msg.orderData) {
              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', width: '100%', maxWidth: '90%' }}>
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        background: '#000000',
                        border: '1px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        alignSelf: 'flex-start',
                        marginTop: '4px',
                      }}
                    >
                      <Bot size={16} color="#ffffff" />
                    </div>
                    <OrderNotificationCard
                      orderData={msg.orderData}
                      onQuickAction={(cmd) => handleSendMessage(cmd)}
                    />
                  </div>
                </div>
              );
            }

            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    maxWidth: '85%',
                  }}
                >
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      background: isUser ? '#000000' : '#f1f3f5',
                      border: '1px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      alignSelf: 'center',
                    }}
                  >
                    {isUser ? <User size={16} color="#ffffff" /> : <Bot size={16} color="#000000" />}
                  </div>

                  <div
                    style={{
                      background: isUser ? 'var(--user-bubble)' : 'var(--agent-bubble)',
                      color: isUser ? '#ffffff' : '#000000',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: '#f1f3f5',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={16} color="#000000" />
              </div>
              <div
                className="glass-card"
                style={{ padding: '0.5rem 0.875rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkles size={14} color="#000000" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Querying Odoo backend...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          {/* Manager Quick Prompts */}
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
            {[
              { label: '📊 Today\'s Orders & Sales', prompt: 'List all recent orders.' },
            ].map((pill, pIdx) => (
              <button
                key={pIdx}
                onClick={() => handleSendMessage(pill.prompt)}
                className="btn-secondary"
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.775rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {wsStatus === 'connected' ? (
                  <span className="badge badge-success" style={{ gap: '4px' }}>
                    <Wifi size={11} /> Notifications Active
                  </span>
                ) : (
                  <span className="badge badge-warning" style={{ gap: '4px' }}>
                    <WifiOff size={11} /> {wsStatus}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Manager Chat Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="glass-panel"
          style={{
            padding: '0.5rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask about sales metrics, table counts, specific orders, or POS settings..."
            disabled={loading}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#000000',
              fontSize: '0.9rem',
              padding: '0.4rem',
            }}
          />
          <button type="submit" className="btn-primary" disabled={!inputMessage.trim() || loading}>
            <span>Ask AI</span>
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
