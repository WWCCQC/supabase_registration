'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { TECHNICIAN_BATCH_SIZE, validateTechnicianFile } from '@/lib/allconnectTechniciansUpload';
import styles from './AllconnectUpload.module.css';

async function request(body: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch('/api/allconnect-technicians-upload', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'อัปโหลดข้อมูลช่างไม่สำเร็จ');
  return result;
}

export default function TechniciansUpload({ onComplete, updatedAt }: { onComplete: () => void; updatedAt: string }) {
  const { isAdmin } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(false);
  const worker = useRef<Worker>();
  const controller = useRef<AbortController>();
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState('');
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    const preventExit = (event: BeforeUnloadEvent) => {
      if (active.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', preventExit);
    return () => { window.removeEventListener('beforeunload', preventExit); controller.current?.abort(); worker.current?.terminate(); };
  }, []);

  async function upload(file: File) {
    if (active.current) return;
    active.current = true;
    setBusy(true); setFilename(file.name); setPercent(0); setError(false); setMessage('กำลังตรวจสอบไฟล์ Excel...');
    const abort = new AbortController();
    controller.current = abort;
    let batchId: string | undefined;
    try {
      validateTechnicianFile(file);
      const parser = new Worker(new URL('./techniciansUpload.worker.ts', import.meta.url));
      worker.current = parser;
      const rows = await new Promise<Record<string, string>[]>((resolve, reject) => {
        abort.signal.addEventListener('abort', () => reject(new Error('ยกเลิกการอัปโหลด')), { once: true });
        parser.onerror = () => reject(new Error('อ่านไฟล์ Excel ไม่สำเร็จ'));
        parser.onmessage = event => event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.rows);
        parser.postMessage(file);
      });
      parser.terminate();
      const started = await request({ action: 'start' }, abort.signal);
      batchId = started.batchId;
      for (let offset = 0; offset < rows.length; offset += TECHNICIAN_BATCH_SIZE) {
        const batch = rows.slice(offset, offset + TECHNICIAN_BATCH_SIZE);
        const saved = await request({ action: 'chunk', batchId, startRow: offset + 1, rows: batch }, abort.signal);
        if (saved.acceptedCount !== batch.length) throw new Error('จำนวนแถวที่บันทึกไม่ครบ');
        const accepted = offset + batch.length;
        setPercent(Math.round(accepted * 95 / rows.length));
        setMessage(`กำลังอัปโหลด ${accepted.toLocaleString('th-TH')} / ${rows.length.toLocaleString('th-TH')} แถว`);
      }
      setMessage('กำลังบันทึกข้อมูลช่าง...');
      const result = await request({ action: 'commit', batchId, expectedSnapshot: started.expectedSnapshot, expectedCount: rows.length }, abort.signal);
      batchId = undefined;
      setPercent(100); setMessage(`อัปโหลดสำเร็จ ${result.insertedCount.toLocaleString('th-TH')} รายการ`);
      onComplete();
    } catch (cause) {
      setError(true); setMessage(cause instanceof Error ? cause.message : 'อัปโหลดข้อมูลช่างไม่สำเร็จ');
      onComplete();
    } finally {
      worker.current?.terminate();
      if (batchId) {
        try { await request({ action: 'abort', batchId }, AbortSignal.timeout(10000)); } catch { /* The next start cleans expired staging rows. */ }
      }
      active.current = false; setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  if (!isAdmin()) return null;
  return <section className={styles.panel} aria-label="Upload Technicians" aria-busy={busy}>
    <div className={styles.row}>
      <input ref={input} type="file" accept=".xlsx" hidden disabled={busy}
        onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      <button type="button" className={styles.button} disabled={busy} onClick={() => input.current?.click()}><Upload size={18} /> Upload Technicians</button>
      <span className={styles.filename}>{filename}</span>
    </div>
    <div className={styles.updatedAt}>อัปเดตล่าสุด (เวลาไทย): {updatedAt}</div>
    {filename && <>
      <div className={styles.progress}><progress aria-label="ความคืบหน้าการอัปโหลดช่าง" max={100} value={percent} /><strong>{percent}%</strong></div>
      <div role={error ? 'alert' : 'status'} aria-live="polite" className={error ? styles.error : styles.status}>{message}</div>
    </>}
  </section>;
}
