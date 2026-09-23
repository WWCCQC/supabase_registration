"use client";

import { useState, useRef, useEffect } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SidebarLayout from '@/components/common/SidebarLayout';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'ช่างทั้งหมดมีกี่คน?',
  'ช่างที่ผ่านการอบรม Solar มีกี่คน?',
  'แบ่งตาม provider แต่ละที่มีกี่คน?',
  'How many technicians are certified for CCTV?',
];

function AiChatContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const next: Message[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply ?? `เกิดข้อผิดพลาด: ${data.error ?? 'ไม่ทราบสาเหตุ'}` },
      ]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', padding: '20px 24px', gap: 16, maxWidth: 820, width: '100%' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>AI Data Assistant</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>ถามคำถามเกี่ยวกับข้อมูลช่างได้ทั้งภาษาไทยและอังกฤษ</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>ตัวอย่างคำถาม:</p>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                style={{
                  alignSelf: 'flex-start',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#334155',
                  textAlign: 'left',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '78%',
                padding: '10px 14px',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? '#6366f1' : '#f8fafc',
                color: m.role === 'user' ? '#fff' : '#1e293b',
                fontSize: 14,
                lineHeight: 1.65,
                border: m.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 14, color: '#94a3b8' }}>
              กำลังค้นหาข้อมูล...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={e => { e.preventDefault(); send(input); }} style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="ถามเกี่ยวกับข้อมูลช่าง..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            fontSize: 14,
            outline: 'none',
            color: '#1e293b',
            background: '#fff',
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            border: 'none',
            background: loading || !input.trim() ? '#e2e8f0' : '#6366f1',
            color: loading || !input.trim() ? '#94a3b8' : '#fff',
            cursor: loading || !input.trim() ? 'default' : 'pointer',
            fontSize: 14,
            fontWeight: 600,
            transition: 'background 0.15s',
          }}
        >
          ส่ง
        </button>
      </form>
    </div>
  );
}

export default function AiChatPage() {
  return (
    <ProtectedRoute>
      <SidebarLayout navigation={<div />}>
        <AiChatContent />
      </SidebarLayout>
    </ProtectedRoute>
  );
}
