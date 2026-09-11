"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const ExternalIcon = () => (
  <svg className="snav-ext" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
  </svg>
);

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const pathname = usePathname();
  const { isAdmin, isManager } = useAuth();

  const itemClass = (isActive: boolean) =>
    `snav-item${isActive ? ' is-active' : ''}`;

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Header / brand */}
      <div className="sidebar-head">
        {!collapsed && (
          <div className="sidebar-brand">
            <span className="sidebar-logo">🛠️</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span className="sidebar-title">Technician</span>
              <span className="sidebar-subtitle">Management</span>
            </span>
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          title={collapsed ? 'ขยาย' : 'ย่อ'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            {collapsed ? (
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            ) : (
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {!collapsed && <div className="snav-label">เมนูหลัก</div>}

        <Link
          href="/"
          className={itemClass(pathname === '/')}
          title="หน้าหลัก"
        >
          <span className="snav-icon">
            <svg viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
          </span>
          {!collapsed && <span className="snav-text">หน้าหลัก</span>}
        </Link>

        {/* Admin/Manager section */}
        {(isAdmin() || isManager()) && (
          <>
            {collapsed ? (
              <div className="snav-divider" />
            ) : (
              <div className="snav-label">จัดการข้อมูล</div>
            )}

            <Link
              href="/blacklist"
              className={itemClass(pathname === '/blacklist')}
              title="Blacklist"
            >
              <span className="snav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z" />
                </svg>
              </span>
              {!collapsed && <span className="snav-text">Blacklist</span>}
            </Link>

            <Link
              href="/tech-transaction"
              className={itemClass(pathname === '/tech-transaction')}
              title="Tech-Transaction"
            >
              <span className="snav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" />
                </svg>
              </span>
              {!collapsed && <span className="snav-text">Tech-Transaction</span>}
            </Link>

            {collapsed ? (
              <div className="snav-divider" />
            ) : (
              <div className="snav-label">ลิงก์ภายนอก</div>
            )}

            <a
              href="https://trainingtech.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className={itemClass(false)}
              title="ลงทะเบียนอบรมช่าง"
            >
              <span className="snav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
              </span>
              {!collapsed && (
                <span className="snav-text">
                  ลงทะเบียนอบรมช่าง
                  <ExternalIcon />
                </span>
              )}
            </a>

            <a
              href="https://sla-training-dashboard.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className={itemClass(false)}
              title="อบรมช่างใหม่"
            >
              <span className="snav-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                </svg>
              </span>
              {!collapsed && (
                <span className="snav-text">
                  อบรมช่างใหม่
                  <ExternalIcon />
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
