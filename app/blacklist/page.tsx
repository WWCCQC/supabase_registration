"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';

function BlacklistContent() {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '60px 40px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb'
      }}>
        {/* Icon */}
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>
          🚧
        </div>
        
        {/* Title */}
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '16px',
          margin: 0
        }}>
          หน้า Blacklist
        </h1>
        
        {/* Description */}
        <p style={{
          fontSize: '16px',
          color: '#6b7280',
          marginBottom: '32px',
          lineHeight: '1.6'
        }}>
          หน้านี้อยู่ในระหว่างการพัฒนา<br />
          เตรียมไว้สำหรับแสดงรายชื่อช่างที่ถูกบล็อก
        </p>
        
        {/* Status Badge */}
        <div style={{
          display: 'inline-block',
          padding: '8px 16px',
          backgroundColor: '#fef3c7',
          color: '#92400e',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '500',
          border: '1px solid #fbbf24'
        }}>
          🔧 กำลังพัฒนา
        </div>
        
        {/* Coming Soon */}
        <div style={{
          marginTop: '40px',
          padding: '20px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px'
          }}>
            ฟีเจอร์ที่จะเพิ่มในอนาคต:
          </h3>
          <ul style={{
            textAlign: 'left',
            color: '#6b7280',
            fontSize: '14px',
            lineHeight: '1.6',
            paddingLeft: '20px'
          }}>
            <li>รายชื่อช่างที่ถูกบล็อก</li>
            <li>เหตุผลในการบล็อก</li>
            <li>วันที่บล็อกและผู้บล็อก</li>
            <li>การจัดการ (เพิ่ม/ลบ/แก้ไข)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function BlacklistPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <div>
        <Navbar />
        <BlacklistContent />
      </div>
    </ProtectedRoute>
  );
}