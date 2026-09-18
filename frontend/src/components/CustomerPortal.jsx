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
  ChevronLeft,
  Plus,
  ShoppingBag,
  Layers,
} from 'lucide-react';

function extractProductDetails(node) {
  let name = '';
  let price = '';
  let imgSrc = '';

  const walk = (n) => {
    if (!n) return;

    if (n.type === 'element' && n.tagName === 'img') {
      if (n.properties?.src) imgSrc = n.properties.src;
      if (!name && n.properties?.alt) name = n.properties.alt;
    }

    if (n.type === 'text' && n.value) {
      const priceMatch = n.value.match(/[\$₹€£]\s*([\d\.]+)/);
      if (priceMatch) {
        price = priceMatch[1];
      }
      if (!name && n.value.trim() && !n.value.includes('http') && !n.value.startsWith('-')) {
        const cleanName = n.value.replace(/—|-|\$[\d\.]+/g, '').trim();
        if (cleanName.length > 2 && cleanName.length < 40) {
          name = cleanName;
        }
      }
    }

    if (n.type === 'element' && (n.tagName === 'strong' || n.tagName === 'b')) {
      const textVal = n.children?.map((c) => c.value || '').join('').trim();
      if (textVal && !name) {
        name = textVal;
      }
    }

    if (n.children && Array.isArray(n.children)) {
      n.children.forEach(walk);
    }
  };

  walk(node);

  if (name) {
    name = name.replace(/^[—\-\s]+|[—\-\s]+$/g, '');
  }

  return { name, price, imgSrc };
}

function ProductCarouselTrack({ children }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, []);

  const handleScroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="product-carousel-wrapper">
      {canScrollLeft && (
        <button
          type="button"
          className="carousel-nav-btn nav-btn-left"
          onClick={() => handleScroll('left')}
          aria-label="Scroll left"
        >
          <ChevronLeft size={16} />
        </button>
      )}

      <div className="product-carousel-track" ref={scrollRef}>
        {children}
      </div>

      {canScrollRight && (
        <button
          type="button"
          className="carousel-nav-btn nav-btn-right"
          onClick={() => handleScroll('right')}
          aria-label="Scroll right"
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

const ODOO_IMAGE_BASE = 'https://vinove.odoo.com';

function resolveProductImageUrl(src) {
  if (!src) return '';
  const trimmed = src.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const cleanId = trimmed.replace(/^[^\d]+/, '').replace(/[^\d]+$/, '');
  if (cleanId) {
    return `${ODOO_IMAGE_BASE}/web/image/product.product/${cleanId}/image_128`;
  }
  return trimmed;
}

function ProductCarouselCard({ name, price, imgSrc, onSelect }) {
  const [imgError, setImgError] = useState(false);
  const resolvedSrc = resolveProductImageUrl(imgSrc);

  return (
    <div
      className="product-carousel-card"
      onClick={() => onSelect && name && onSelect(name)}
      title={name ? `Click to order ${name}` : 'Click to order'}
    >
      <div className="product-card-img-box">
        {imgError || !resolvedSrc ? (
          <div className="product-card-fallback">
            <UtensilsCrossed size={28} color="#94a3b8" />
          </div>
        ) : (
          <img
            src={resolvedSrc}
            alt={name || 'Dish'}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        )}
      </div>

      <div className="product-card-content">
        <div className="product-card-title">{name || 'Menu Dish'}</div>
        <div className="product-card-bottom">
          {price ? (
            <span className="product-card-price">${price}</span>
          ) : (
            <span style={{ flex: 1 }} />
          )}
          <button
            type="button"
            className="product-card-order-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (onSelect && name) onSelect(name);
            }}
          >
            <Plus size={13} />
            <span>Order</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerStatusCard({ msg }) {
  const { orderId, statusInfo, timestamp } = msg;
  const { title, icon, color, bg, desc } = statusInfo;

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${color}40`,
        borderLeft: `5px solid ${color}`,
        borderRadius: '8px',
        padding: '0.875rem 1rem',
        maxWidth: '100%',
        width: '100%',
        margin: '0.25rem 0',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>{icon}</span>
          <strong style={{ color: '#000000', fontSize: '0.9rem' }}>{title}</strong>
        </div>
        <span style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>
          Order #{orderId}
        </span>
      </div>
      <p style={{ fontSize: '0.825rem', color: '#334155', margin: 0, lineHeight: 1.4 }}>
        {desc}
      </p>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.4rem', textAlign: 'right' }}>
        {timestamp}
      </div>
    </div>
  );
}

export default function CustomerPortal({ latestStatusEvent }) {
  const [sessionId, setSessionId] = useState(() => 'cust_' + Math.random().toString(36).substring(2, 9));
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Welcome! 👋 I'm your AI host.\n\nWould you like to **check our menu** or **place an order** today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastOrderId, setLastOrderId] = useState(null);

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Insert real-time order status updates into customer chat stream
  useEffect(() => {
    if (!latestStatusEvent || latestStatusEvent.type !== 'order_status_update') return;

    const { order_id, status } = latestStatusEvent;

    setMessages((prev) => {
      const alreadyAdded = prev.some(
        (m) => m.isStatusNotification && m.orderId === order_id && m.status === status
      );
      if (alreadyAdded) return prev;

      const statusMap = {
        accepted: { title: 'Order Accepted', icon: '✅', color: '#000000', bg: '#f8fafc', desc: `Your order #${order_id} has been accepted by the restaurant manager!` },
        preparing: { title: 'Preparing Your Food', icon: '🍳', color: '#d97706', bg: '#fffbeb', desc: `Our kitchen team is now preparing your food for order #${order_id}.` },
        ready: { title: 'Order Ready!', icon: '🔔', color: '#059669', bg: '#ecfdf5', desc: `Great news! Order #${order_id} is ready.` },
        delivered: { title: 'Order Delivered', icon: '🚚', color: '#2563eb', bg: '#eff6ff', desc: `Order #${order_id} has been delivered. Enjoy your meal!` },
      };

      const info = statusMap[status] || { title: `Status: ${status}`, icon: 'ℹ️', color: '#475569', bg: '#f8fafc', desc: `Order #${order_id} status updated to ${status}.` };

      return [
        ...prev,
        {
          role: 'assistant',
          isStatusNotification: true,
          orderId: order_id,
          status: status,
          statusInfo: info,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ];
    });
  }, [latestStatusEvent]);

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

  const handleItemClick = (productName) => {
    setInputMessage(`I'd like to order ${productName}`);
  };

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
                <strong style={{ color: '#00ad3a', fontSize: '0.95rem' }}>Order #{lastOrderId} Confirmed & Sent to Kitchen!</strong>
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

            if (msg.isStatusNotification) {
              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', width: '100%', maxWidth: '85%' }}>
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
                        flexShrink: 0,
                        alignSelf: 'flex-start',
                        marginTop: '4px',
                      }}
                    >
                      <Bot size={16} color="#000000" />
                    </div>
                    <CustomerStatusCard msg={msg} />
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
                      maxWidth: 'stretch',
                    }}
                  >
                    <div className="markdown-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          ul: ({ node, children, ...props }) => {
                            const hasImages = JSON.stringify(node).includes('"tagName":"img"');
                            if (hasImages) {
                              return <ProductCarouselTrack>{children}</ProductCarouselTrack>;
                            }
                            return <ul {...props}>{children}</ul>;
                          },
                          ol: ({ node, children, ...props }) => {
                            const hasImages = JSON.stringify(node).includes('"tagName":"img"');
                            if (hasImages) {
                              return <ProductCarouselTrack>{children}</ProductCarouselTrack>;
                            }
                            return <ol {...props}>{children}</ol>;
                          },
                          li: ({ node, children, ...props }) => {
                            const hasImage = JSON.stringify(node).includes('"tagName":"img"');
                            if (hasImage) {
                              const { name, price, imgSrc } = extractProductDetails(node);
                              return (
                                <ProductCarouselCard
                                  name={name}
                                  price={price}
                                  imgSrc={imgSrc}
                                  onSelect={handleItemClick}
                                />
                              );
                            }
                            return <li {...props}>{children}</li>;
                          },
                          p: ({ node, children, ...props }) => {
                            const hasImage = JSON.stringify(node).includes('"tagName":"img"');
                            if (hasImage) {
                              const { name, price, imgSrc } = extractProductDetails(node);
                              if (imgSrc) {
                                return (
                                  <ProductCarouselTrack>
                                    <ProductCarouselCard
                                      name={name}
                                      price={price}
                                      imgSrc={imgSrc}
                                      onSelect={handleItemClick}
                                    />
                                  </ProductCarouselTrack>
                                );
                              }
                            }
                            return <p {...props}>{children}</p>;
                          },
                          img: ({ src, alt }) => {
                            return (
                              <ProductCarouselCard
                                name={alt}
                                price=""
                                imgSrc={src}
                                onSelect={handleItemClick}
                              />
                            );
                          },
                        }}
                      >
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
              { label: '🍕 I want Pizza', prompt: 'What pizza options do you have?' },
              { label: '🍷 Drinks', prompt: 'What drinks items do you have?' },
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
    </div>
  );
}
