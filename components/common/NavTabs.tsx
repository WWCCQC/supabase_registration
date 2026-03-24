"use client";

import React from 'react';

const TABS = ['TOL', 'SOLAR', 'ROLLOUT', 'CORPORATE'] as const;
export type NavTab = typeof TABS[number];

interface NavTabsProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const NavTabs: React.FC<NavTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="navtabs">
      {TABS.map((tab) => (
        <button
          key={tab}
          className={`navtab-item ${activeTab === tab ? 'navtab-active' : ''}`}
          onClick={() => onTabChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

export default NavTabs;
export { TABS };
