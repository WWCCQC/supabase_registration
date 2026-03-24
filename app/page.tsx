"use client";

import React, { useState } from "react";
import NextDynamic from "next/dynamic";
import { useAuth } from "@/lib/useAuth";
import SidebarLayout from "@/components/common/SidebarLayout";
import type { NavTab } from "@/components/common/NavTabs";

// โหลด component แบบ client-only
const TechBrowser = NextDynamic(() => import("@/components/TechBrowser"), { ssr: false });

export default function Page() {
  const { user, authenticated, loading, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('TOL');
  
  // วัดเวลาการโหลดหน้าหลัก
  React.useEffect(() => {
    const loginStartTime = localStorage.getItem('loginStartTime');
    if (loginStartTime) {
      const totalLoadTime = performance.now() - parseFloat(loginStartTime);
      console.log('🎉 Total time from login to main page loaded:', Math.round(totalLoadTime), 'ms');
      console.log('🎉 Total time in seconds:', (totalLoadTime / 1000).toFixed(2), 's');
      
      // เคลียร์ค่าหลังจากวัดแล้ว
      localStorage.removeItem('loginStartTime');
    }
  }, []);

  // ถ้ายังโหลดอยู่
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ fontSize: '18px', color: '#666' }}>กำลังโหลด...</div>
      </div>
    );
  }

  // ถ้าไม่ได้ login ให้ redirect ไป login page
  if (!authenticated) {
    window.location.href = '/login';
    return null;
  }

  return (
    <SidebarLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'TOL' && (
        <React.Suspense 
          fallback={
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}>
              <div style={{ 
                fontSize: '18px', 
                color: '#666', 
                marginBottom: '20px' 
              }}>
                กำลังโหลดข้อมูลระบบ...
              </div>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #3498db',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }}></div>
              <style jsx>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          }
        >
          <TechBrowser />
        </React.Suspense>
      )}

      {activeTab === 'SOLAR' && (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☀️</div>
          <h2 style={{ fontSize: '24px', color: '#1f2937', marginBottom: '8px' }}>SOLAR</h2>
          <p style={{ color: '#6b7280' }}>อยู่ระหว่างการพัฒนา</p>
        </div>
      )}

      {activeTab === 'ROLLOUT' && (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
          <h2 style={{ fontSize: '24px', color: '#1f2937', marginBottom: '8px' }}>ROLLOUT</h2>
          <p style={{ color: '#6b7280' }}>อยู่ระหว่างการพัฒนา</p>
        </div>
      )}

      {activeTab === 'CORPORATE' && (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏢</div>
          <h2 style={{ fontSize: '24px', color: '#1f2937', marginBottom: '8px' }}>CORPORATE</h2>
          <p style={{ color: '#6b7280' }}>อยู่ระหว่างการพัฒนา</p>
        </div>
      )}
    </SidebarLayout>
  );
}
