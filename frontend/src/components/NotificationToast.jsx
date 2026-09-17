import React from 'react';
import { ShoppingBag, Bell, X, Clock } from 'lucide-react';

export function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

      gain.gain.setValueAtTime(0.15, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    playTone(523.25, 0, 0.15); // C5
    playTone(659.25, 0.12, 0.15); // E5
    playTone(783.99, 0.24, 0.35); // G5
  } catch (e) {
    console.log('Audio chime unavailable:', e);
  }
}

export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxWidth: '360px',
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="glass-panel"
          style={{
            pointerEvents: 'auto',
            padding: '0.875rem 1rem',
            borderLeft: '4px solid #000000',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            border: '1px solid #cbd5e1',
          }}
        >
          <div
            style={{
              padding: '0.4rem',
              borderRadius: '6px',
              background: '#000000',
              color: '#ffffff',
            }}
          >
            <ShoppingBag size={18} color="#ffffff" />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#000000' }}>
                🎉 New Order #{toast.order_id || 'Placed'}
              </span>
              <button
                onClick={() => onDismiss(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {toast.table_id && (
              <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '0.2rem' }}>
                📍 Table #{toast.table_id}
              </div>
            )}

            {toast.note && (
              <div style={{ fontSize: '0.775rem', color: '#64748b', fontStyle: 'italic', marginBottom: '0.2rem' }}>
                "{toast.note}"
              </div>
            )}

            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={11} />
              {new Date(toast.timestamp || Date.now()).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationHistoryDrawer({ isOpen, onClose, notifications, onClear }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '340px',
        maxWidth: '100vw',
        background: '#ffffff',
        borderLeft: '1px solid var(--border-light)',
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '1rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bell size={18} color="#000000" />
          <h3 style={{ fontSize: '1rem', color: '#000000' }}>Notification Log</h3>
          <span className="badge badge-primary">{notifications.length}</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '3rem', fontSize: '0.875rem' }}>
            No order notifications yet.
          </div>
        ) : (
          notifications.map((item, idx) => (
            <div key={idx} className="glass-card" style={{ padding: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <strong style={{ color: '#000000', fontSize: '0.875rem' }}>Order #{item.order_id || 'Alert'}</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {new Date(item.timestamp || Date.now()).toLocaleTimeString()}
                </span>
              </div>
              {item.table_id && <div style={{ fontSize: '0.775rem', color: '#475569' }}>Table #{item.table_id}</div>}
              {item.note && <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>Note: {item.note}</div>}
            </div>
          ))
        )}
      </div>

      {notifications.length > 0 && (
        <div style={{ padding: '0.875rem', borderTop: '1px solid var(--border-light)' }}>
          <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClear}>
            Clear Log
          </button>
        </div>
      )}
    </div>
  );
}
