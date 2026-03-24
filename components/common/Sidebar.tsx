"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const pathname = usePathname();
  const { user, isAdmin, isManager } = useAuth();

  const navItemStyle = (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? '0px' : '10px',
    padding: collapsed ? '10px' : '10px 16px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: isActive ? '600' : '500',
    transition: 'all 0.2s ease',
    color: isActive ? '#ffffff' : '#c7d2fe',
    backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
    border: isActive ? '1px solid rgba(255,255,255,0.25)' : '1px solid transparent',
    cursor: 'pointer',
    justifyContent: collapsed ? 'center' : 'flex-start',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
  });

  const iconStyle = {
    width: '20px',
    height: '20px',
    fill: 'currentColor',
    flexShrink: 0,
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Header */}
      <div style={{
        padding: collapsed ? '16px 8px' : '16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        minHeight: '60px',
      }}>
        {!collapsed && (
          <div style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#ffffff',
            lineHeight: '1.3',
          }}>
            Technician<br />Management
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
          title={collapsed ? 'ขยาย' : 'ย่อ'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            {collapsed ? (
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            ) : (
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav style={{
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        flex: 1,
        overflowY: 'auto',
      }}>
        <Link href="/" style={navItemStyle(pathname === '/')}>
          <svg style={iconStyle} viewBox="0 0 24 24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
          {!collapsed && <span>หน้าหลัก</span>}
        </Link>

        <Link href="/ww-provider" style={navItemStyle(pathname === '/ww-provider')}>
          <svg style={iconStyle} viewBox="0 0 24 24">
            <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
          </svg>
          {!collapsed && <span>บริษัทรับงาน W&W</span>}
        </Link>

        {/* Admin/Manager section */}
        {(isAdmin() || isManager()) && (
          <>
            <Link href="/blacklist" style={navItemStyle(pathname === '/blacklist')}>
              <svg style={iconStyle} viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
              </svg>
              {!collapsed && <span>Blacklist</span>}
            </Link>

            <Link href="/tech-transaction" style={navItemStyle(pathname === '/tech-transaction')}>
              <svg style={iconStyle} viewBox="0 0 24 24">
                <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
              </svg>
              {!collapsed && <span>Tech-Transaction</span>}
            </Link>

            <a 
              href="https://trainingtech.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              style={navItemStyle(false)}
            >
              <svg style={iconStyle} viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
              {!collapsed && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ลงทะเบียนอบรมช่าง
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5 }}>
                    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                  </svg>
                </span>
              )}
            </a>

            <a 
              href="https://sla-training-dashboard.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              style={navItemStyle(false)}
            >
              <svg style={iconStyle} viewBox="0 0 24 24">
                <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
              </svg>
              {!collapsed && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  อบรมช่างใหม่
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5 }}>
                    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                  </svg>
                </span>
              )}
            </a>
          </>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;
