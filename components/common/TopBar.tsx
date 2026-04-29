"use client";

import React from 'react';
import { useAuth } from '@/lib/useAuth';
import LiveClock from './LiveClock';

interface TopBarProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar, sidebarCollapsed }) => {
  const { user } = useAuth();

  return (
    <div className="topbar">
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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: '#ffffff',
        fontSize: '13px',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          lineHeight: '1.3',
        }}>
          <span style={{ fontWeight: '600', fontSize: '13px' }}>{user?.full_name}</span>
          <span style={{ fontSize: '11px', color: '#c7d2fe' }}>
            ({user?.role === 'admin' ? 'ผู้ดูแลระบบ' : user?.role === 'manager' ? 'ผู้จัดการ' : 'ผู้ใช้'})
          </span>
        </div>
        <button 
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login';
          }}
          style={{
            padding: '5px 12px',
            backgroundColor: 'rgba(220, 38, 38, 0.85)',
            color: 'white',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: '500',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
};

export default TopBar;
