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
} from 'lucide-react';

export default function ManagerDashboard({ wsStatus }) {
  const [sessionId, setSessionId] = useState(() => 'mgr_' + Math.random().toString(36).substring(2, 9));
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Welcome Cheif! 👨‍🍳 How can I assist you today?",
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
                  </div>
                </div>

                {/* <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
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
              { label: '📊 Today\'s Orders & Sales', prompt: 'List all recent POS orders and today\'s total sales summary.' },
              { label: '🪑 Table Status', prompt: 'Show me the status of all restaurant tables and seating.' },
              { label: '🏬 Open POS Sessions', prompt: 'Check open POS sessions and configurations.' },
              { label: '⚡ System Status', prompt: 'Perform an operational check on active tables and orders.' },
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
