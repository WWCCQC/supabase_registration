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
      display: 'flex',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Left Side - Brand Section */}
      <div style={{
        flex: '1',
        background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 50%, #db2777 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 40px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative Background Circles */}
        <div style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          top: '-150px',
          left: '-150px',
          backdropFilter: 'blur(60px)'
        }} />
        <div style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
          bottom: '-100px',
          right: '-100px',
          backdropFilter: 'blur(60px)'
        }} />

        {/* Content */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '64px',
            marginBottom: '30px',
            animation: 'float 3s ease-in-out infinite'
          }}>
            🔐
          </div>
          
          <h1 style={{
            fontSize: '42px',
            fontWeight: '700',
            marginBottom: '20px',
            lineHeight: '1.2',
            textShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}>
            ยินดีต้อนรับ
          </h1>

          <div style={{
            fontSize: '20px',
            fontWeight: '500',
            lineHeight: '1.8',
            marginBottom: '10px',
            opacity: 0.95
          }}>
            Command Center & Quality Control
          </div>
          
          <div style={{
            fontSize: '18px',
            fontWeight: '400',
            lineHeight: '1.8',
            marginBottom: '10px',
            opacity: 0.9
          }}>
            Customer Connected Business
          </div>
          
          <div style={{
            fontSize: '18px',
            fontWeight: '400',
            lineHeight: '1.8',
            opacity: 0.9
          }}>
            Installation & Maintenance
          </div>

          <div style={{
            marginTop: '40px',
            height: '2px',
            width: '80px',
            background: 'rgba(255, 255, 255, 0.5)',
            margin: '40px auto 20px'
          }} />

          <p style={{
            fontSize: '14px',
            opacity: 0.8,
            fontWeight: '300'
          }}>
            ระบบจัดการข้อมูลช่างและบริหารทีมงาน
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div style={{
        flex: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        background: '#ffffff'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '450px',
          padding: '40px'
        }}>
          {/* Logo หรือชื่อระบบ */}
          <div style={{
            textAlign: 'center',
            marginBottom: '40px'
          }}>
            <h1 style={{
              margin: 0,
              fontSize: '32px',
              fontWeight: 700,
              color: '#1e293b',
              marginBottom: '8px'
            }}>
              เข้าสู่ระบบ
            </h1>
            <p style={{
              margin: 0,
              color: '#64748b',
              fontSize: '16px'
            }}>
              กรุณาใส่ข้อมูลเพื่อเข้าใช้งานระบบ
            </p>
          </div>

        <form onSubmit={handleSubmit}>
          {/* Employee ID Input */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              fontSize: '15px',
              fontWeight: 600,
              color: '#1e293b'
            }}>
              รหัสพนักงาน
            </label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="กรุณาใส่รหัสพนักงาน"
              style={{
                width: '100%',
                padding: '14px 18px',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '16px',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
                backgroundColor: '#f8fafc'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.backgroundColor = '#ffffff';
                e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.backgroundColor = '#f8fafc';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Password Input */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              fontSize: '15px',
              fontWeight: 600,
              color: '#1e293b'
            }}>
              รหัสผ่าน
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="กรุณาใส่รหัสผ่าน"
              style={{
                width: '100%',
                padding: '14px 18px',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '16px',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
                backgroundColor: '#f8fafc'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.backgroundColor = '#ffffff';
                e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.backgroundColor = '#f8fafc';
                e.target.style.boxShadow = 'none';
              }}
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
              padding: '16px 24px',
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '17px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: loading ? 'none' : '0 8px 20px rgba(59, 130, 246, 0.4)',
              letterSpacing: '0.5px'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 28px rgba(59, 130, 246, 0.5)';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.4)';
              }
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <span style={{
                  width: '18px',
                  height: '18px',
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

          {/* Footer Text */}
          <div style={{
            textAlign: 'center',
            marginTop: '30px',
            paddingTop: '24px',
            borderTop: '1px solid #e2e8f0'
          }}>
            <p style={{
              fontSize: '13px',
              color: '#94a3b8',
              margin: 0
            }}>
              © 2025 Technician Management System
            </p>
          </div>
        </form>

        </div>
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        @media (max-width: 968px) {
          .login-container {
            flex-direction: column;
          }
          .left-section {
            min-height: 300px;
            padding: 40px 20px;
          }
          .left-section h1 {
            font-size: 28px !important;
          }
          .left-section div {
            font-size: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}

