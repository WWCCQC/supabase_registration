"use client";

import { useState } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SidebarLayout from '@/components/common/SidebarLayout';
import styles from './page.module.css';
import ContractDashboard from '@/components/ContractDashboard';

const CONTRACT_TABS = ['Track C', 'Solar', 'Corporate'] as const;
type ContractTab = typeof CONTRACT_TABS[number];

export default function ContractPage() {
  const [activeTab, setActiveTab] = useState<ContractTab>('Track C');

  const navigation = (
    <div className="navtabs" role="tablist" aria-label="Contract sections">
      {CONTRACT_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          id={`contract-tab-${tab.toLowerCase().replaceAll(' ', '-')}`}
          aria-selected={activeTab === tab}
          aria-controls="contract-tab-panel"
          className={`navtab-item ${activeTab === tab ? 'navtab-active' : ''}`}
          onClick={() => setActiveTab(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  return (
    <ProtectedRoute requiredRole="admin">
      <SidebarLayout navigation={navigation}>
        <section
          id="contract-tab-panel"
          role="tabpanel"
          aria-labelledby={`contract-tab-${activeTab.toLowerCase().replaceAll(' ', '-')}`}
          className={styles.page}
        >
          {activeTab === 'Track C' && <ContractDashboard />}
        </section>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
