'use client';

import { useEffect, useRef, useState } from 'react';
import type Papa from 'papaparse';
import { Upload } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { ALLCONNECT_BATCH_SIZE, normalizeAllconnectRow, validateAllconnectHeaders, validateUploadFile } from '@/lib/allconnectUpload';
import styles from './AllconnectUpload.module.css';

type ImportResult = { insertedCount: number; importedAt: string };
async function request(body: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch('/api/allconnect-upload', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่');
  return result;
}

export default function AllconnectUpload({ onComplete, updatedAt }: { onComplete: (result: ImportResult) => void; updatedAt: string }) {
  const { isAdmin } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(false);
  const worker = useRef<Worker>();
  const controller = useRef<AbortController>();
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState('');
  const [percent, setPercent] = useState(0);
  const [rows, setRows] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    const preventExit = (event: BeforeUnloadEvent) => {
      if (active.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', preventExit);
    return () => {
      window.removeEventListener('beforeunload', preventExit);
      controller.current?.abort();
      worker.current?.terminate();
    };
  }, []);

  async function upload(file: File) {
    if (active.current) return;
    active.current = true;
    setBusy(true); setFilename(file.name); setPercent(0); setRows(0); setError(false); setMessage('กำลังตรวจสอบไฟล์...');
    let batchId: string | undefined;
    let commitStarted = false;
    const abort = new AbortController();
    controller.current = abort;
    try {
      validateUploadFile(file);
      // Fatal decoding catches invalid UTF-8 before any replacement can be committed.
      const reader = file.stream().pipeThrough(new TextDecoderStream('utf-8', { fatal: true })).getReader();
      let characters = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          characters += part.value.length;
          abort.signal.throwIfAborted();
        }
      }
      finally { reader.releaseLock(); }
      const started = await request({ action: 'start' }, abort.signal);
      batchId = started.batchId;
      let accepted = 0;
      let checkedHeaders = false;
      const parserWorker = new Worker(new URL('./allconnectUpload.worker.ts', import.meta.url));
      worker.current = parserWorker;
      setMessage('กำลังอัปโหลดข้อมูล...');
      await new Promise<void>((resolve, reject) => {
        abort.signal.addEventListener('abort', () => reject(new Error('การอัปโหลดถูกยกเลิก')), { once: true });
        parserWorker.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่'));
        parserWorker.onmessage = async (event) => {
          if (event.data.type === 'error') { reject(new Error(event.data.message)); return; }
          if (event.data.type === 'complete') { resolve(); return; }
          try {
            const result = event.data.results as Papa.ParseResult<Record<string, string>>;
            if (!checkedHeaders) {
              const validation = validateAllconnectHeaders(result.meta.fields ?? []);
              if (!validation.ok) throw new Error(validation.message);
              checkedHeaders = true;
            }
            if (result.errors.length) throw new Error('รูปแบบข้อมูลในไฟล์ไม่ถูกต้อง กรุณาตรวจสอบจำนวนคอลัมน์และเครื่องหมายคำพูด');
            for (let offset = 0; offset < result.data.length; offset += ALLCONNECT_BATCH_SIZE) {
              const batch = result.data.slice(offset, offset + ALLCONNECT_BATCH_SIZE).map(normalizeAllconnectRow);
              const saved = await request({ action: 'chunk', batchId, startRow: accepted + 1, rows: batch }, abort.signal);
              if (saved.acceptedCount !== batch.length) throw new Error('จำนวนข้อมูลที่บันทึกไม่ครบ');
              accepted += batch.length;
              setRows(accepted);
            }
            // Papa reports decoded characters, including multibyte Thai text.
            setPercent(previous => Math.max(previous, Math.min(94, Math.round(result.meta.cursor * 94 / Math.max(1, characters)))));
            parserWorker.postMessage({ action: 'resume' });
          } catch (cause) { reject(cause); }
        };
        parserWorker.postMessage({ action: 'parse', file });
      });
      parserWorker.terminate();
      if (!checkedHeaders || accepted === 0) throw new Error('ไฟล์ไม่มีข้อมูลสำหรับนำเข้า');
      setPercent(95); setMessage('กำลังบันทึกข้อมูล...');
      commitStarted = true;
      const result: ImportResult = await request({ action: 'commit', batchId, expectedSnapshot: started.expectedSnapshot }, abort.signal);
      batchId = undefined;
      setPercent(100); setRows(result.insertedCount);
      setMessage(`อัปโหลดสำเร็จ ${result.insertedCount.toLocaleString('th-TH')} รายการ`);
      onComplete(result);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : 'อัปโหลดไม่สำเร็จ');
      if (commitStarted) onComplete({ insertedCount: 0, importedAt: '' });
    } finally {
      worker.current?.terminate();
      if (batchId) {
        try { await request({ action: 'abort', batchId }); } catch { /* Expired batches are cleaned on the next upload. */ }
      }
      active.current = false; setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  if (!isAdmin()) return null;
  return <section className={styles.panel} aria-label="Upload All connect" aria-busy={busy}>
    <div className={styles.row}>
      <input ref={input} type="file" accept=".txt,.csv,text/plain,text/csv" hidden disabled={busy}
        onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      <button type="button" className={styles.button} disabled={busy} onClick={() => input.current?.click()}>
        <Upload size={18} /> Upload All connect
      </button>
      <span className={styles.filename}>{filename}</span>
    </div>
    <div className={styles.updatedAt}>อัปเดตล่าสุด (เวลาไทย): {updatedAt}</div>
    {filename && <>
      <div className={styles.progress}><progress aria-label="ความคืบหน้าการอัปโหลด" max={100} value={percent} /><strong>{percent}%</strong></div>
      <div role={error ? 'alert' : 'status'} aria-live="polite" className={error ? styles.error : styles.status}>
        {message}{busy && rows > 0 ? ` (${rows.toLocaleString('th-TH')} แถว)` : ''}
      </div>
    </>}
  </section>;
}
