"use client";

import React from "react";
import NextDynamic from "next/dynamic";
import { useAuth } from "@/lib/useAuth";
import Navbar from "@/components/common/Navbar";
import Link from "next/link";

// โหลด component แบบ client-only (เปลี่ยนชื่อ import เป็น NextDynamic)
const TechBrowser = NextDynamic(() => import("@/components/TechBrowser"), { ssr: false });

export default function Page() {
  const { user, authenticated, loading, isAdmin } = useAuth();
  
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
    <div>
      {/* Navbar */}
      <Navbar />
      
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
    </div>
  );
}
