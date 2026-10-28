'use client';

import React from 'react';
import { AdminCore3D, DepotCluster3D } from './TolAdminKpi3D';
import styles from './page.module.css';

type Props = {
  adminCount: number;
  companyCount: number;
  sortByCompany: boolean;
  onResetAll: () => void;
  onToggleSortByCompany: () => void;
};

export default function SalesAdminKpi3D({
  adminCount,
  companyCount,
  sortByCompany,
  onResetAll,
  onToggleSortByCompany,
}: Props) {
  return (
    <div className={styles.salesKpiGrid}>
      {/* Card 1: Total Sales Admins with 3D Person in Rotating Circle */}
      <article
        className={`${styles.kpiCard} ${styles.kpiBlue} ${styles.kpiCardInteractive} ${
          !sortByCompany ? styles.kpiCardSelectedBlue : ''
        }`}
        onClick={onResetAll}
        role="button"
        tabIndex={0}
        aria-pressed={!sortByCompany}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onResetAll();
          }
        }}
      >
        <div className={styles.kpiCardSplit}>
          <div className={styles.kpiCardContent}>
            <span className={styles.kpiLabel}>จำนวนแอดมินงานขาย</span>
            <strong className={styles.kpiValue}>
              {adminCount.toLocaleString()}
            </strong>
          </div>
          <AdminCore3D active={!sortByCompany} onTrigger={onResetAll} />
        </div>
      </article>

      {/* Card 2: Total Companies with 3D Hex Cluster Icon */}
      <article
        className={`${styles.kpiCard} ${styles.kpiTeal} ${styles.kpiCardInteractive} ${
          sortByCompany ? styles.kpiCardSelectedTeal : ''
        }`}
        onClick={onToggleSortByCompany}
        role="button"
        tabIndex={0}
        aria-pressed={sortByCompany}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleSortByCompany();
          }
        }}
      >
        <div className={styles.kpiCardSplit}>
          <div className={styles.kpiCardContent}>
            <span className={styles.kpiLabel}>จำนวนบริษัท</span>
            <strong className={styles.kpiValue}>
              {companyCount.toLocaleString()}
            </strong>
          </div>
          <DepotCluster3D active={sortByCompany} onTrigger={onToggleSortByCompany} />
        </div>
      </article>
    </div>
  );
}
