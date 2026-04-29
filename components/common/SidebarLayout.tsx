"use client";

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import NavTabs, { type NavTab } from './NavTabs';

interface SidebarLayoutProps {
  children: React.ReactNode;
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
}

const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children, activeTab = 'TOL', onTabChange }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="sidebar-layout">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <main className={`sidebar-main ${collapsed ? 'sidebar-main-collapsed' : ''}`}>
        <TopBar onToggleSidebar={() => setCollapsed(v => !v)} sidebarCollapsed={collapsed} />
        <NavTabs activeTab={activeTab} onTabChange={onTabChange ?? (() => {})} />
        <div className="sidebar-content">
          {children}
        </div>
      </main>

      {/* Mobile overlay */}
      <div
        className="sidebar-overlay"
        onClick={() => setCollapsed(true)}
      />
    </div>
  );
};

export default SidebarLayout;
