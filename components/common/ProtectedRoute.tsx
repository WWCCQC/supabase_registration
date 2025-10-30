"use client";

import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user';
  allowedRoles?: string[];
}

export default function ProtectedRoute({ 
  children, 
  requiredRole,
  allowedRoles = [] 
}: ProtectedRouteProps) {
  const { authenticated, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // ถ้าไม่ได้ login
      if (!authenticated) {
        router.push('/login');
        return;
      }

      // เช็ค role specific
      if (requiredRole) {
        if (user?.role !== requiredRole) {
          // ถ้าไม่ใช่ admin ให้กลับไปหน้าหลัก
          router.push('/');
          return;
        }
      }

      // เช็ค allowed roles
      if (allowedRoles.length > 0) {
        if (!user?.role || !allowedRoles.includes(user.role)) {
          router.push('/');
          return;
        }
      }
    }
  }, [authenticated, user, loading, requiredRole, allowedRoles, router]);

  // แสดง loading
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          padding: '20px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '18px', color: '#666' }}>กำลังตรวจสอบสิทธิ์...</div>
        </div>
      </div>
    );
  }

  // ถ้าไม่ได้ login
  if (!authenticated) {
    return null; // useEffect จะ redirect ไป login
  }

  // เช็ค role
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          padding: '30px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <div style={{ fontSize: '20px', color: '#dc2626', marginBottom: '8px' }}>
            ไม่มีสิทธิ์เข้าถึง
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
            หน้านี้สำหรับ {requiredRole === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้'} เท่านั้น
          </div>
          <button 
            onClick={() => router.push('/')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#12239E',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  // เช็ค allowed roles
  if (allowedRoles.length > 0 && (!user?.role || !allowedRoles.includes(user.role))) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          padding: '30px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <div style={{ fontSize: '20px', color: '#dc2626', marginBottom: '8px' }}>
            ไม่มีสิทธิ์เข้าถึง
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้
          </div>
          <button 
            onClick={() => router.push('/')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#12239E',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}