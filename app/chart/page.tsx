"use client";
import dynamic from "next/dynamic";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import SidebarLayout from "@/components/common/SidebarLayout";

// Dynamic import เพื่อป้องกัน SSR issues กับ Recharts
const RsmWorkgroupChart = dynamic(() => import("@/components/charts/RsmWorkgroupChart"), { 
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 18, color: "#666" }}>กำลังโหลด Chart Component...</div>
    </div>
  )
});

export default function ChartPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <SidebarLayout>
        <div style={{ padding: '20px' }}>
          <RsmWorkgroupChart />
        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
