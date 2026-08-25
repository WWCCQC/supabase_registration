"use client";

import React from 'react';
import { useAuth } from '@/lib/useAuth';
import LiveClock from './LiveClock';

interface TopBarProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

function formatEnDateTime(isoString: string): string {
  const d = new Date(isoString);
  const date = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
  return `${date} ${time}`;
}

const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar, sidebarCollapsed }) => {
  const { user } = useAuth();
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/meta/last-updated')
      .then((r) => r.json())
      .then((d) => { if (d.lastUpdated) setLastUpdated(d.lastUpdated); })
      .catch(() => {});
  }, []);

  return (
    <div className="topbar">
      {/* Data last updated — left side */}
      <div className="topbar-chip" style={{ marginRight: 'auto' }}>
        <span style={{ opacity: 0.8 }}>🕐</span>
        <span>
          Data updated as{' '}
          <strong>{lastUpdated ? formatEnDateTime(lastUpdated) : '—'}</strong>
        </span>
      </div>

      {/* Mobile hamburger */}
      <button
        className="topbar-mobile-toggle"
        onClick={onToggleSidebar}
        aria-label="Toggle menu"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          {sidebarCollapsed ? (
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          ) : (
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          )}
        </svg>
      </button>

      {/* Live Clock */}
      <LiveClock />

      {/* User info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div className="topbar-user">
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
          }}>
            <span className="topbar-user-name">{user?.full_name}</span>
            <span className="topbar-user-role">
              {user?.role === 'admin' ? 'ผู้ดูแลระบบ' : user?.role === 'manager' ? 'ผู้จัดการ' : 'ผู้ใช้'}
            </span>
          </div>
          <span className="topbar-avatar">
            {(user?.full_name ?? '?').trim().charAt(0).toUpperCase() || '?'}
          </span>
        </div>
        <button
          className="topbar-logout"
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login';
          }}
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
};

export default TopBar;
