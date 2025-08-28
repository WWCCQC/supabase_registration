// บังคับให้เพจนี้ไม่ถูกแคช
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import NextDynamic from "next/dynamic";

// โหลด component แบบ client-only (เปลี่ยนชื่อ import เป็น NextDynamic)
const TechBrowser = NextDynamic(() => import("@/components/TechBrowser"), { ssr: false });

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
        <div style={{ 
          fontSize: 16, 
          color: 'white',
          fontWeight: 500,
          padding: '8px 16px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          {new Date().toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
          })} {new Date().toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
          })}
        </div>
      </div>
      
      <TechBrowser />
    </div>
  );
}
