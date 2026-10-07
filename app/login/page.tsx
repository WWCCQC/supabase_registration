"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RobotAssemble from './RobotAssemble';

export default function LoginPage() {
  const TAGLINE = 'Strategic Assurance Office / Last-Mile Service Management';
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState('');
  const router = useRouter();

  // เช็คว่า login แล้วหรือยัง
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Typewriter effect for the tagline
  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setTyped(TAGLINE);
      return;
    }
    let i = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!deleting) {
        i += 1;
        setTyped(TAGLINE.slice(0, i));
        if (i >= TAGLINE.length) {
          deleting = true;
          timer = setTimeout(tick, 1800); // hold full text
          return;
        }
        timer = setTimeout(tick, 55);
      } else {
        i -= 1;
        setTyped(TAGLINE.slice(0, i));
        if (i <= 0) {
          deleting = false;
          timer = setTimeout(tick, 500); // brief pause before retype
          return;
        }
        timer = setTimeout(tick, 28); // delete faster than typing
      }
    };
    timer = setTimeout(tick, 1300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="nc-root">
      <div className="nc-container">
        {/* Left Side - W&W Brand Hero */}
        <div className="nc-hero">
          <div className="nc-logo-stage">
            <RobotAssemble src="/ww-logo.png" alt="Wire & Wireless Co., Ltd." />
          </div>

          <div className="nc-brand">
            <div className="nc-divider" />
            <p className="nc-tag" aria-label={TAGLINE}>
              <span className="nc-type">
                <span className="nc-type-ghost" aria-hidden="true">{TAGLINE}</span>
                <span className="nc-type-live" aria-hidden="true">
                  {typed}
                  <span className="nc-caret" />
                </span>
              </span>
            </p>
          </div>
        </div>

        {/* Right Side - Login Form (frameless) */}
        <div className="nc-panel">
          <form onSubmit={handleSubmit} className="nc-form">
              {/* Employee ID Input */}
              <div className="nc-field">
                <label className="nc-label">รหัสพนักงาน</label>
                <div className="nc-inputwrap">
                  <svg className="nc-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    type="text"
                    className="nc-input"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="กรุณาใส่รหัสพนักงาน"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="nc-field">
                <label className="nc-label">รหัสผ่าน</label>
                <div className="nc-inputwrap">
                  <svg className="nc-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="nc-input nc-input-pw"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="กรุณาใส่รหัสผ่าน"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="nc-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.67a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="nc-error">
                  <span className="nc-error-icon">!</span>
                  {error}
                </div>
              )}

              {/* Login Button */}
              <button type="submit" className="nc-btn" disabled={loading}>
                {loading ? (
                  <span className="nc-btn-inner">
                    <span className="nc-spinner" />
                    กำลังเข้าสู่ระบบ...
                  </span>
                ) : (
                  <span className="nc-btn-inner">
                    เข้าสู่ระบบ
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                )}
              </button>
            </form>
        </div>
      </div>

      <style jsx global>{`
        :root {
          --nc-cyan: #22e0ff;
          --nc-blue: #3b82f6;
          --nc-violet: #a855f7;
          --ww-navy: #0a2a5e;
          --ww-blue: #1e5bb8;
          --ww-red: #d81f14;
          --ww-orange: #f07818;
          --ww-light: #dbe8ff;
          --ww-bg: #173c75;
        }

        .nc-root {
          min-height: 100vh;
          width: 100%;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          background: var(--ww-bg);
          color: #e2e8f0;
          font-family: 'Noto Sans Thai', 'Sarabun', ui-sans-serif, system-ui, sans-serif;
          box-sizing: border-box;
        }
        .nc-root *, .nc-root *::before, .nc-root *::after { box-sizing: border-box; }

        /* Layout container */
        .nc-container {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 1080px;
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 48px;
          align-items: center;
        }

        /* Hero */
        .nc-hero { text-align: center; }
        .nc-logo-stage {
          position: relative;
          width: min(470px, 92%);
          aspect-ratio: 783 / 297;
          margin: 0 auto 6px;
        }
        .nc-logo-stage::before {
          content: '';
          position: absolute;
          inset: -22% -12%;
          background: radial-gradient(ellipse at center, rgba(120,170,240,0.30), transparent 70%);
          filter: blur(20px);
          z-index: 0;
          pointer-events: none;
        }
        .nc-robot-stage {
          position: absolute;
          inset: 0;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .nc-robot-canvas {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          transition: opacity 0.6s ease;
          pointer-events: none;
        }
        .nc-robot {
          position: relative;
          z-index: 3;
          width: 82%;
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 6px 22px rgba(120,170,240,0.35));
          animation: nc-float 4.5s ease-in-out infinite;
          transition: opacity 0.7s ease;
        }
        @keyframes nc-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-16px); }
        }

        .nc-brand { position: relative; margin-top: 6px; }
        .nc-divider {
          width: 64px; height: 3px;
          margin: 6px auto 16px;
          border-radius: 3px;
          background: linear-gradient(90deg, var(--ww-red), var(--ww-orange));
          box-shadow: 0 0 12px rgba(216,60,20,0.35);
        }
        .nc-tag {
          margin: 0 auto;
          max-width: 420px;
          font-size: 15px;
          line-height: 1.7;
          color: #c3d3ee;
          letter-spacing: 0.3px;
        }
        .nc-type {
          position: relative;
          display: inline-block;
          max-width: 100%;
          text-align: left;
        }
        .nc-type-ghost { visibility: hidden; }
        .nc-type-live {
          position: absolute;
          inset: 0;
          text-align: left;
        }
        .nc-caret {
          display: inline-block;
          width: 2px;
          height: 1em;
          margin-left: 2px;
          vertical-align: -0.15em;
          background: #c3d3ee;
          animation: nc-caret-blink 1s steps(1) infinite;
        }
        @keyframes nc-caret-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }

        /* Panel (frameless form) */
        .nc-panel {
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
        }

        .nc-form { width: 100%; }
        .nc-field { margin-bottom: 20px; }
        .nc-label {
          display: block;
          margin-bottom: 9px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #9fb0c9;
        }
        .nc-inputwrap { position: relative; }
        .nc-input-icon {
          position: absolute;
          left: 15px; top: 50%;
          transform: translateY(-50%);
          width: 19px; height: 19px;
          color: #4b5b73;
          pointer-events: none;
          transition: color 0.25s ease;
        }
        .nc-input {
          width: 100%;
          padding: 15px 46px 15px 44px;
          border: 1px solid rgba(148,163,184,0.22);
          border-radius: 13px;
          font-size: 16px;
          outline: none;
          background: rgba(2,6,17,0.65);
          color: #e2e8f0;
          transition: all 0.25s ease;
        }
        .nc-input::placeholder { color: #55647d; }
        .nc-input:hover { border-color: rgba(34,224,255,0.4); }
        .nc-input:focus {
          border-color: var(--nc-cyan);
          background: rgba(2,6,17,0.9);
          box-shadow: 0 0 0 4px rgba(34,224,255,0.14), 0 0 22px rgba(34,224,255,0.25);
        }
        .nc-inputwrap:focus-within .nc-input-icon { color: var(--nc-cyan); }

        .nc-eye {
          position: absolute;
          right: 10px; top: 50%;
          transform: translateY(-50%);
          width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: #64748b;
          cursor: pointer;
          transition: color 0.2s ease, background 0.2s ease;
        }
        .nc-eye:hover { color: var(--nc-cyan); background: rgba(34,224,255,0.08); }
        .nc-eye svg { width: 19px; height: 19px; }

        .nc-error {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.45);
          color: #fca5a5;
          padding: 12px 14px;
          border-radius: 11px;
          margin-bottom: 18px;
          font-size: 14px;
          animation: nc-shake 0.4s ease;
        }
        .nc-error-icon {
          flex: none;
          width: 20px; height: 20px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 50%;
          background: #ef4444;
          color: #fff;
          font-weight: 800;
          font-size: 13px;
        }
        @keyframes nc-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }

        .nc-btn {
          position: relative;
          width: 100%;
          padding: 16px 24px;
          margin-top: 6px;
          border: none;
          border-radius: 13px;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: #041018;
          cursor: pointer;
          overflow: hidden;
          background: linear-gradient(120deg, #22e0ff 0%, #3b82f6 50%, #a855f7 100%);
          background-size: 200% 100%;
          box-shadow: 0 12px 30px rgba(34,224,255,0.35);
          transition: transform 0.2s ease, box-shadow 0.25s ease, background-position 0.5s ease;
        }
        .nc-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          background-position: 100% 0;
          box-shadow: 0 16px 40px rgba(34,224,255,0.5);
        }
        .nc-btn:active:not(:disabled) { transform: translateY(0); }
        .nc-btn:disabled { cursor: not-allowed; filter: grayscale(0.4) brightness(0.7); }
        .nc-btn-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .nc-btn-inner svg { width: 19px; height: 19px; }

        .nc-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(4,16,24,0.35);
          border-top-color: #041018;
          border-radius: 50%;
          animation: nc-spin-2 0.8s linear infinite;
        }
        @keyframes nc-spin-2 { to { transform: rotate(360deg); } }

        /* Responsive */
        @media (max-width: 900px) {
          .nc-container { grid-template-columns: 1fr; gap: 26px; max-width: 440px; }
          .nc-logo-stage { width: min(360px, 88%); margin-bottom: 12px; }
          .nc-hero { order: -1; }
        }
        @media (max-width: 480px) {
          .nc-root { padding: 24px 16px; }
          .nc-logo-stage { width: min(300px, 90%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .nc-robot, .nc-caret { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
