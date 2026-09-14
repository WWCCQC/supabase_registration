"use client";

import React from 'react';
import { useAuth } from '@/lib/useAuth';
import SidebarLayout from '@/components/common/SidebarLayout';

const MANUAL_PDF_URL = 'https://sggunyytungtyhezchft.supabase.co/storage/v1/object/public/manual/Technician_Profile.pdf';

export default function ManualPage() {
  const { authenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f5f5f5' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>กำลังโหลด...</div>
      </div>
    );
  }

  if (!authenticated) {
    window.location.href = '/login';
    return null;
  }

  return (
    <SidebarLayout>
      <div style={{ padding: '24px', height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1f2937', margin: 0 }}>
            📖 คู่มือการใช้งาน
          </h1>
          <a
            href={MANUAL_PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#12239E',
              textDecoration: 'none',
              padding: '8px 14px',
              border: '1px solid #12239E',
              borderRadius: '8px',
            }}
          >
            เปิดในแท็บใหม่
          </a>
        </div>
        <div style={{
          flex: 1,
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          backgroundColor: '#fff',
        }}>
          <iframe
            src={MANUAL_PDF_URL}
            title="คู่มือการใช้งาน"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      </div>
    </SidebarLayout>
  );
}
