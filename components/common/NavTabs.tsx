"use client";

import React from 'react';

const TABS = ['TOL', 'SOLAR', 'ROLLOUT', 'CORPORATE'] as const;
export type NavTab = typeof TABS[number];

// SOLAR, ROLLOUT, CORPORATE hidden from navbar per request
const VISIBLE_TABS: readonly NavTab[] = ['TOL'];

interface NavTabsProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const NavTabs: React.FC<NavTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="navtabs">
      {VISIBLE_TABS.map((tab) => (
        <button
          key={tab}
          className={`navtab-item ${activeTab === tab ? 'navtab-active' : ''}`}
          onClick={() => {
            if (tab === 'SOLAR') {
              window.open('https://solar-alpha-sand.vercel.app/', '_blank', 'noopener,noreferrer');
              return;
            }
            onTabChange(tab);
          }}
        >
          {tab}
          {tab === 'SOLAR' && (
            <svg className="navtab-ext" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
};

export default NavTabs;
export { TABS };
