"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

const Navbar = () => {
  const pathname = usePathname();
  const { user, isAdmin, isUser } = useAuth();

  // สไตล์สำหรับ nav items
  const navItemStyle = (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    color: isActive ? '#ffffff' : '#e5e7eb',
    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
    border: isActive ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
    cursor: 'pointer',
  });

  const iconStyle = {
    width: '18px',
    height: '18px',
    fill: 'currentColor'
  };

  return (
    <nav style={{
      backgroundColor: '#12239E',
      padding: '0 24px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      borderRadius: '0 0 12px 12px',
      marginBottom: '20px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        height: '56px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Brand/Title */}
        <div style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#ffffff',
          marginRight: '8px',
          whiteSpace: 'nowrap'
        }}>
          Technician Management
        </div>

        {/* Separator */}
        <div style={{
          width: '1px',
          height: '32px',
          backgroundColor: 'rgba(255,255,255,0.3)',
          margin: '0 8px'
        }} />

        {/* หน้าหลัก */}
        <Link href="/" style={navItemStyle(pathname === '/')}>
          <svg style={iconStyle} viewBox="0 0 24 24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
          หน้าหลัก
        </Link>

        {/* Charts - Manager และ Admin เท่านั้น */}
        {!isUser() && (
          <Link href="/chart" style={navItemStyle(pathname === '/chart')}>
            <svg style={iconStyle} viewBox="0 0 24 24">
              <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L3.5 16.49z"/>
            </svg>
            ข้อมูลสถิติ
          </Link>
        )}

        {/* Blacklist - Admin เท่านั้น */}
        {isAdmin() && (
          <Link href="/blacklist" style={navItemStyle(pathname === '/blacklist')}>
            <svg style={iconStyle} viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
            </svg>
            Blacklist
          </Link>
        )}

        {/* ลงทะเบียนอบรมช่าง - Admin และ Manager เท่านั้น */}
        {!isUser() && (
          <a 
            href="https://script.google.com/macros/s/AKfycbwstFfRSlgVSGa1PLJmZbpSSX91J0kkADXmExoaC-NTMyamhvqTg2flsNDAmmy0jfKIKg/exec"
            target="_blank"
            rel="noopener noreferrer"
            style={navItemStyle(false)}
          >
            <svg style={iconStyle} viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            ลงทะเบียนอบรมช่าง
          </a>
        )}

        {/* อบรมช่างใหม่ - Admin และ Manager เท่านั้น */}
        {!isUser() && (
          <a 
            href="https://wwccqc.github.io/SLATrainingDashboard/"
            target="_blank"
            rel="noopener noreferrer"
            style={navItemStyle(false)}
          >
            <svg style={iconStyle} viewBox="0 0 24 24">
              <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
            </svg>
            อบรมช่างใหม่
          </a>
        )}



        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#e5e7eb',
          fontSize: '12px'
        }}>
          <div>
            {user?.full_name} ({user?.role === 'admin' ? 'ผู้ดูแลระบบ' : user?.role === 'manager' ? 'ผู้จัดการ' : 'ผู้ใช้'})
          </div>
          
          <button 
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            style={{
              padding: '4px 8px',
              backgroundColor: 'rgba(220, 38, 38, 0.8)',
              color: 'white',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;