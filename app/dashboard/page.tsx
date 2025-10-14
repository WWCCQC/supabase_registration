"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';

function DashboardContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();

      if (data.authenticated) {
        setUser(data.user);
      } else {
        router.push('/login');
      }
    } catch (error) {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Navbar />
      <div style={{ padding: '20px' }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1>Dashboard</h1>
          <p>ยินดีต้อนรับ {user?.full_name} ({user?.employee_id})</p>
        </div>
        <button onClick={handleLogout} style={{
          background: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 20px',
          cursor: 'pointer'
        }}>
          ออกจากระบบ
        </button>
      </div>

      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '30px',
        marginBottom: '20px'
      }}>
        <h2>ข้อมูลผู้ใช้งาน</h2>
        <p>รหัสพนักงาน: {user?.employee_id}</p>
        <p>ชื่อ: {user?.full_name}</p>
        <p>ตำแหน่ง: {user?.role}</p>
      </div>

      <Link href="/" style={{ textDecoration: 'none' }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '30px',
          textAlign: 'center',
          cursor: 'pointer'
        }}>
          <h3>กลับหน้าแรก</h3>
        </div>
      </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <DashboardContent />
    </ProtectedRoute>
  );
}
