import React, { useState, useEffect } from 'react';
import CustomerPortal from './components/CustomerPortal';
import ManagerDashboard from './components/ManagerDashboard';
import { ToastContainer, NotificationHistoryDrawer, playNotificationChime } from './components/NotificationToast';
import { createNotificationSocket, getHealthStatus } from './services/api';
import { Utensils, LayoutDashboard, Bell, Server } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('customer'); // 'customer' | 'manager'

  // WebSocket & Notification states
  const [wsStatus, setWsStatus] = useState('connecting');
  const [toasts, setToasts] = useState([]);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  // Backend Health state
  const [backendHealth, setBackendHealth] = useState(null);

  const [latestOrderEvent, setLatestOrderEvent] = useState(null);
  const [latestStatusEvent, setLatestStatusEvent] = useState(null);

  useEffect(() => {
    getHealthStatus().then(setBackendHealth);
  }, []);

  useEffect(() => {
    const socket = createNotificationSocket({
      onStatusChange: (status) => setWsStatus(status),
      onMessage: (event) => {
        if (event.type === 'new_order') {
          playNotificationChime();
          setLatestOrderEvent(event);

          const toastObj = {
            id: Date.now() + Math.random(),
            order_id: event.order_id,
            table_id: event.table_id,
            note: event.note || event.special_requests,
            timestamp: event.timestamp || new Date().toISOString(),
          };

          setToasts((prev) => [toastObj, ...prev.slice(0, 4)]);
          setNotificationHistory((prev) => [toastObj, ...prev]);

          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== toastObj.id));
          }, 7000);
        } else if (event.type === 'order_status_update') {
          setLatestStatusEvent(event);
        }
      },
    });

    return () => socket.close();
  }, []);

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)' }}>
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Notification Log Drawer */}
      <NotificationHistoryDrawer
        isOpen={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        notifications={notificationHistory}
        onClear={() => setNotificationHistory([])}
      />

      {/* Top Application Bar */}
      <header
        className="glass-panel"
        style={{
          height: '70px',
          borderRadius: 0,
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          padding: '0 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
        }}
      >
        {/* Left Brand Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '6px',
              background: '#000000',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Utensils size={22} color="#ffffff" />
          </div>
        </div>

        {/* Center Mode Switcher Tabs */}
        <div
          className="glass-panel"
          style={{
            padding: '0.2rem',
            display: 'flex',
            gap: '0.2rem',
            borderRadius: '6px',
            background: '#f1f3f5',
          }}
        >
          <button
            onClick={() => setActiveTab('customer')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '4px',
              border: 'none',
              background: activeTab === 'customer' ? '#000000' : 'transparent',
              color: activeTab === 'customer' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Utensils size={15} />
            Customer Portal
          </button>

          <button
            onClick={() => setActiveTab('manager')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '4px',
              border: 'none',
              background: activeTab === 'manager' ? '#000000' : 'transparent',
              color: activeTab === 'manager' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <LayoutDashboard size={15} />
            Manager Portal
          </button>
        </div>

        {/* Right Controls & Notifications */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setHistoryDrawerOpen(true)}
            className="btn-secondary"
            style={{ position: 'relative', padding: '0.4rem 0.65rem' }}
            title="Open Order Notifications Log"
          >
            <Bell size={16} color="#000000" />
            {notificationHistory.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#000000',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.675rem',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {notificationHistory.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* View Content */}
      <main style={{ flex: 1, position: 'relative' }}>
        <div style={{ display: activeTab === 'customer' ? 'block' : 'none', height: '100%' }}>
          <CustomerPortal latestStatusEvent={latestStatusEvent} />
        </div>
        <div style={{ display: activeTab === 'manager' ? 'block' : 'none', height: '100%' }}>
          <ManagerDashboard wsStatus={wsStatus} latestOrderEvent={latestOrderEvent} />
        </div>
      </main>
    </div>
  );
}
