'use client';

import ProtectedRoute from '@/components/common/ProtectedRoute';
import SidebarLayout from '@/components/common/SidebarLayout';
import AllconnectCompareDashboard from '@/components/allconnect/AllconnectCompareDashboard';
import styles from '@/components/allconnect/AllconnectCompareDashboard.module.css';

export default function AllconnectComparePage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'manager']}>
      <SidebarLayout className={styles.layout}>
        <AllconnectCompareDashboard />
      </SidebarLayout>
    </ProtectedRoute>
  );
}
