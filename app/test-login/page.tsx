"use client";
import { useState } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';

function LoginTestContent() {
  const [employeeId, setEmployeeId] = useState('ADMIN001');
  const [password, setPassword] = useState('admin123');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: employeeId,
          password: password
        }),
      });

      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testMe = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testLogout = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h1>🔐 ทดสอบระบบ Login</h1>
      
      <div style={{ marginBottom: 20 }}>
        <h2>ข้อมูลทดสอบ:</h2>
        <div style={{ marginBottom: 10 }}>
          <label>Employee ID: </label>
          <input
            type="text"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            style={{ marginLeft: 10, padding: '5px 10px', width: 150 }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label>Password: </label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginLeft: 10, padding: '5px 10px', width: 150 }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button 
          onClick={testLogin} 
          disabled={loading}
          style={{ 
            marginRight: 10, 
            padding: '10px 20px', 
            background: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: 5,
            cursor: 'pointer'
          }}
        >
          {loading ? 'กำลังทดสอب...' : 'ทดสอบ Login'}
        </button>

        <button 
          onClick={testMe} 
          disabled={loading}
          style={{ 
            marginRight: 10, 
            padding: '10px 20px', 
            background: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: 5,
            cursor: 'pointer'
          }}
        >
          ตรวจสอบสถานะ Login
        </button>

        <button 
          onClick={testLogout} 
          disabled={loading}
          style={{ 
            padding: '10px 20px', 
            background: '#dc3545', 
            color: 'white', 
            border: 'none', 
            borderRadius: 5,
            cursor: 'pointer'
          }}
        >
          ทดสอบ Logout
        </button>
      </div>

      <div>
        <h3>ผลลัพธ์:</h3>
        <pre style={{ 
          background: '#f8f9fa', 
          padding: 15, 
          border: '1px solid #dee2e6', 
          borderRadius: 5, 
          overflow: 'auto',
          minHeight: 200
        }}>
          {result || 'กดปุ่มทดสอบเพื่อดูผลลัพธ์'}
        </pre>
      </div>

      <div style={{ marginTop: 30, padding: 15, background: '#e7f3ff', borderRadius: 5 }}>
        <h3>📝 ข้อมูลทดสอบ:</h3>
        <ul>
          <li><strong>Admin:</strong> ADMIN001 / admin123</li>
          <li><strong>User:</strong> EMP001 / user123</li>
          <li><strong>Manager:</strong> MGR001 / manager123</li>
        </ul>
      </div>
    </div>
  );
}

export default function LoginTest() {
  return (
    <ProtectedRoute requiredRole="admin">
      <LoginTestContent />
    </ProtectedRoute>
  );
}