"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // เช็คว่า login แล้วหรือยัง
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          // ถ้า login แล้วให้ไปหน้าที่ต้องการ หรือหน้าแรก
          console.log('Already authenticated, redirecting...');
          const urlParams = new URLSearchParams(window.location.search);
          const redirectTo = urlParams.get('redirect') || '/';
          console.log('Auth redirect to:', redirectTo);
          window.location.href = redirectTo;
          return;
        }
      }
    } catch (error) {
      console.log('Not authenticated');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!employeeId || !password) {
      setError('กรุณาใส่รหัสพนักงานและรหัสผ่าน');
      return;
    }

    setLoading(true);
    setError('');

    // เริ่มวัดเวลา login
    const loginStartTime = performance.now();
    console.log('🕐 Login process started at:', new Date().toISOString());

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // รับส่ง cookies
        body: JSON.stringify({
          employee_id: employeeId,
          password: password
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const loginEndTime = performance.now();
        const loginDuration = loginEndTime - loginStartTime;
        
        console.log('✅ Login API completed in:', Math.round(loginDuration), 'ms');
        console.log('Login successful, redirecting to home...');
        console.log('Response data:', data);
        
        // บันทึกเวลาเริ่ม login ลงใน localStorage เพื่อวัดเวลารวม
        localStorage.setItem('loginStartTime', loginStartTime.toString());
        
        // กลับไปหน้าแรก (หน้าที่มีข้อมูล local)
        setTimeout(() => {
          window.location.replace('/');
        }, 500); // รอ 500ms ให้ cookie ถูกตั้งเสร็จ
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      }
    } catch (error) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as any);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        position: 'relative'
      }}>
        {/* Logo หรือชื่อระบบ */}
        <div style={{
          textAlign: 'center',
          marginBottom: '30px'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '10px'
          }}>🔐</div>
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 600,
            color: '#333',
            marginBottom: '8px'
          }}>
            เข้าสู่ระบบ
          </h1>
          <p style={{
            margin: 0,
            color: '#666',
            fontSize: '14px'
          }}>
            ระบบจัดการข้อมูลช่าง
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Employee ID Input */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#333'
            }}>
              รหัสพนักงาน
            </label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="ใส่รหัสพนักงาน"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
          </div>

          {/* Password Input */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#333'
            }}>
              รหัสผ่าน
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="ใส่รหัสผ่าน"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              background: '#fee2e2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 20px',
              background: loading ? '#a0a0a0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
              }
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid transparent',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                กำลังเข้าสู่ระบบ...
              </span>
            ) : (
              'เข้าสู่ระบบ'
            )}
          </button>
        </form>

        {/* Demo Accounts Info */}
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: '#f8fafc',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#64748b'
        }}>
          <div style={{ fontWeight: 600, marginBottom: '8px' }}>💡 ข้อมูลทดสอบ:</div>
          <div style={{ marginBottom: '4px' }}>👑 <strong>Admin:</strong> ADMIN001 / admin123</div>
          <div style={{ marginBottom: '4px' }}>👨‍💼 <strong>Manager:</strong> MGR001 / manager123</div>
          <div>👤 <strong>User:</strong> EMP001 / user123</div>
        </div>
      </div>

      {/* CSS Animation */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

