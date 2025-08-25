"use client";
import dynamic from "next/dynamic";

// Dynamic import เพื่อป้องกัน SSR issues กับ Recharts
const RsmWorkgroupChart = dynamic(() => import("@/components/RsmWorkgroupChart"), { 
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 18, color: "#666" }}>กำลังโหลด Chart Component...</div>
    </div>
  )
});

export default function ChartPage() {
  return <RsmWorkgroupChart />;
}
