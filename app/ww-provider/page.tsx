"use client";

import React, { useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import SidebarLayout from '@/components/common/SidebarLayout';

export default function WWProviderPage() {
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
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🏗️</div>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937', marginBottom: '12px' }}>
          บริษัทรับงาน W&amp;W
        </h1>
        <div style={{
          display: 'inline-block',
          backgroundColor: '#fef3c7',
          border: '2px solid #fbbf24',
          borderRadius: '8px',
          padding: '16px 32px',
          marginTop: '16px',
        }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
            🚧 อยู่ระหว่างดำเนินการ
          </div>
          <div style={{ fontSize: '14px', color: '#78350f' }}>
            ระบบกำลังอยู่ในขั้นตอนการพัฒนา
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
