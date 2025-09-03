// บังคับให้เพจนี้ไม่ถูกแคช
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import NextDynamic from "next/dynamic";

// โหลด component แบบ client-only (เปลี่ยนชื่อ import เป็น NextDynamic)
const TechBrowser = NextDynamic(() => import("@/components/TechBrowser"), { ssr: false });
const LiveClock = NextDynamic(() => import("@/components/LiveClock"), { ssr: false });

export default function Page() {
  return (
    <div style={{ padding: 24 }}>
      {/* Header with date and time */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 20,
        padding: '16px 24px',
        background: '#1a237e',
        borderRadius: '8px',
        color: 'white'
      }}>
        <h1 style={{ 
          fontSize: 28, 
          fontWeight: 700, 
          color: 'white',
          margin: 0
        }}>
          Technicians's Profile
        </h1>
        <LiveClock />
      </div>
      
      <TechBrowser />
    </div>
  );
}
