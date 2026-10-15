'use client';

import ProtectedRoute from '@/components/common/ProtectedRoute';
import SidebarLayout from '@/components/common/SidebarLayout';
import AllconnectCompareDashboard from '@/components/allconnect/AllconnectCompareDashboard';
import styles from '@/components/allconnect/AllconnectCompareDashboard.module.css';

export default function AllconnectComparePage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'manager']}>
      {/* ไม่แสดงแถวแท็บ TOL ในหน้านี้: ส่ง false เพื่อข้าม NavTabs ค่าเริ่มต้นของ SidebarLayout */}
      <SidebarLayout className={styles.layout} navigation={false}>
        <AllconnectCompareDashboard />
      </SidebarLayout>
    </ProtectedRoute>
  );
}
