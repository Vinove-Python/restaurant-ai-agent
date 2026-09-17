import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendCustomerMessage, clearCustomerSession, getMenu } from '../services/api';
import {
  Send,
  Bot,
  User,
  UtensilsCrossed,
  RotateCcw,
  Sparkles,
  Search,
  CheckCircle2,
  ChevronRight,
  ShoppingBag,
  Layers,
} from 'lucide-react';

export default function CustomerPortal() {
  const [sessionId, setSessionId] = useState(() => 'cust_' + Math.random().toString(36).substring(2, 9));
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Welcome to Gourmet Dining! 👋\n\nI'm your AI host. Would you like to **check our menu** or **place an order** today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastOrderId, setLastOrderId] = useState(null);

  // Menu Drawer State
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [menuSearch, setMenuSearch] = useState('');
  const [loadingMenu, setLoadingMenu] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (menuDrawerOpen && products.length === 0) {
      setLoadingMenu(true);
      getMenu()
        .then((data) => {
          setProducts(data.products || []);
          setCategories(data.categories || []);
        })
        .catch((err) => console.error('Menu load error:', err))
        .finally(() => setLoadingMenu(false));
    }
  }, [menuDrawerOpen, products.length]);

  const handleSendMessage = async (textToSend = inputMessage) => {
    const text = textToSend.trim();
    if (!text || loading) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [...prev, { role: 'user', text, timestamp: userTime }]);
    setInputMessage('');
    setLoading(true);

    try {
      const data = await sendCustomerMessage(sessionId, text);
      const agentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.response,
          orderId: data.order_id,
          timestamp: agentTime,
        },
      ]);

      if (data.order_id) {
        setLastOrderId(data.order_id);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `⚠️ Error: ${err.message || 'Unable to communicate with the restaurant assistant.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSession = async () => {
    const newId = 'cust_' + Math.random().toString(36).substring(2, 9);
    await clearCustomerSession(sessionId).catch(() => {});
    setSessionId(newId);
    setLastOrderId(null);
    setMessages([
      {
        role: 'assistant',
        text: "👋 Session restarted! How may I assist you with your dining experience?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleItemClick = (productName) => {
    setInputMessage(`I'd like to order ${productName}`);
    setMenuDrawerOpen(false);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(menuSearch.toLowerCase());
    const matchesCateg =
      selectedCategory === 'all' || (p.pos_categ_ids && p.pos_categ_ids.includes(Number(selectedCategory)));
    return matchesSearch && matchesCateg;
  });

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 70px)', overflow: 'hidden', position: 'relative', justifyContent: 'center' }}>
      {/* Main Chat Interface */}
      <div style={{ flex: 1, maxWidth: '900px', display: 'flex', flexDirection: 'column', padding: '1rem', gap: '0.875rem' }}>
        {/* Order Confirmation Banner if order placed */}
        {lastOrderId && (
          <div
            className="glass-panel"
            style={{
              padding: '0.75rem 1rem',
              borderLeft: '4px solid #000000',
              background: '#f8f9fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle2 size={24} color="#000000" />
              <div>
                <strong style={{ color: '#000000', fontSize: '0.95rem' }}>Order #{lastOrderId} Confirmed & Sent to Kitchen!</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Our kitchen staff has been notified in real time. Thank you for dining with us!
                </p>
              </div>
            </div>
            <span className="badge badge-success">Order Sent</span>
          </div>
        )}

        {/* Messages Stream */}
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
                      alignSelf: 'center'
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

                    {msg.orderId && (
                      <div
                        style={{
                          marginTop: '0.625rem',
                          padding: '0.5rem',
                          borderRadius: '6px',
                          background: '#000000',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                        }}
                      >
                        <ShoppingBag size={16} color="#ffffff" />
                        Order Reference ID: #{msg.orderId}
                      </div>
                    )}
                  </div>
                </div>

                {/* <span
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.2rem',
                    marginRight: isUser ? '0.25rem' : 0,
                    marginLeft: isUser ? 0 : '0.25rem',
                  }}
                >
                  {msg.timestamp}
                </span> */}
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
                style={{
                  padding: '0.5rem 0.875rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Sparkles size={14} color="#000000" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Assistant is typing...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          {/* Quick Prompts Bar */}
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
            {[
              { label: '📖 Show Menu', prompt: 'Could you please show me the menu?' },
              { label: '🍔 Popular Dishes', prompt: 'What are your most popular dishes today?' },
              { label: '🍷 Drinks & Specials', prompt: 'What drinks or special items do you have?' },
              { label: '🛍️ Order Dine-in', prompt: 'I want to place an order for dine in.' },
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn-secondary"
              onClick={() => setMenuDrawerOpen(!menuDrawerOpen)}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.775rem' }}
            >
              <Layers size={14} />
              {menuDrawerOpen ? 'Close Menu' : 'View Menu'}
            </button>
            <button
              className="btn-secondary"
              onClick={handleResetSession}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.775rem' }}
            >
              <RotateCcw size={14} />
              New Session
            </button>
          </div>
        </div>

        {/* Chat Input Bar */}
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
            placeholder="Ask about dishes, prices, dietary options, or place an order..."
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
            <span>Send</span>
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* Visual Menu Side Drawer */}
      {menuDrawerOpen && (
        <div
          className="glass-panel"
          style={{
            width: '350px',
            margin: '1rem 1rem 1rem 0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', color: '#000000' }}>Restaurant Menu</h3>
            <button
              onClick={() => setMenuDrawerOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem' }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search menu..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid var(--border-light)',
                  borderRadius: '6px',
                  padding: '0.45rem 0.45rem 0.45rem 2rem',
                  color: '#000000',
                  fontSize: '0.825rem',
                  outline: 'none',
                }}
              />
            </div>

            {categories.length > 0 && (
              <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                <button
                  onClick={() => setSelectedCategory('all')}
                  className="badge"
                  style={{
                    cursor: 'pointer',
                    background: selectedCategory === 'all' ? '#000000' : '#f1f3f5',
                    color: selectedCategory === 'all' ? '#ffffff' : '#000000',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id.toString())}
                    className="badge"
                    style={{
                      cursor: 'pointer',
                      background: selectedCategory === c.id.toString() ? '#000000' : '#f1f3f5',
                      color: selectedCategory === c.id.toString() ? '#ffffff' : '#000000',
                      border: '1px solid #cbd5e1',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {loadingMenu ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>Loading menu...</div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>No products found</div>
            ) : (
              filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="glass-card"
                  onClick={() => handleItemClick(prod.name)}
                  style={{
                    padding: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.875rem', color: '#000000', display: 'block' }}>{prod.name}</strong>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>ID: #{prod.id}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.925rem', fontWeight: 700, color: '#000000' }}>
                      ${typeof prod.list_price === 'number' ? prod.list_price.toFixed(2) : prod.list_price}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      Select <ChevronRight size={10} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
