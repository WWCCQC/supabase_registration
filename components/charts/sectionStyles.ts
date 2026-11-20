import type React from "react";

/** พื้นหลัง section สีฟ้าอ่อนมาก (ใช้ร่วมกันระหว่างกราฟ Gauge / Card Expiry Trend) */
export const lightBlueSection: React.CSSProperties = {
  position: "relative",
  padding: 20,
  borderRadius: 20,
  background: "linear-gradient(135deg, color-mix(in srgb, #f0f9ff var(--tint), var(--surface)) 0%, color-mix(in srgb, #e0f2fe var(--tint), var(--surface)) 100%)",
  border: "1px solid color-mix(in srgb, #dbeafe var(--tint), var(--border))",
  boxShadow: "0 8px 24px -16px rgba(30,58,95,0.25)",
};
