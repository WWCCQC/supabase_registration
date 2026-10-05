'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { AllconnectSourcesStatus } from '@/lib/allconnectSources';
import AllconnectUpload from './AllconnectUpload';
import TechniciansUpload from './TechniciansUpload';
import styles from './AllconnectCompareDashboard.module.css';
import sourceStyles from './AllconnectSources.module.css';

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok',
  }).format(new Date(value)) : '-';
}

export default function AllconnectSourcesDashboard() {
  const [data, setData] = useState<AllconnectSourcesStatus | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch('/api/allconnect-compare', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'โหลดข้อมูลไม่สำเร็จ');
        if (result.comparisonEnabled !== false || typeof result.dataset?.totalRows !== 'number' ||
            typeof result.dataset?.techniciansTotalRows !== 'number') {
          throw new Error('รูปแบบสถานะข้อมูลเปลี่ยนแปลง กรุณารีเฟรชข้อมูลอีกครั้ง');
        }
        if (!controller.signal.aborted) setData(result);
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  const refresh = () => setRevision(value => value + 1);
  return <div className={styles.dashboard}>
    <header className={styles.header}>
      <h1>All connect compare tech</h1>
      <div className={styles.headerActions}>
        <div className={sourceStyles.uploads}>
          <AllconnectUpload updatedAt={dateTime(data?.dataset.updatedAt ?? null)} onComplete={refresh} />
          <TechniciansUpload updatedAt={dateTime(data?.dataset.techniciansUpdatedAt ?? null)} onComplete={refresh} />
        </div>
        <button type="button" className={styles.iconButton} onClick={refresh} disabled={loading}
          title="รีเฟรชข้อมูล" aria-label="รีเฟรชข้อมูล">
          <RefreshCw size={18} className={loading ? styles.spinning : undefined} />
        </button>
      </div>
    </header>
    <p className={sourceStyles.pending} role="status">พักการเปรียบเทียบชั่วคราว รอเงื่อนไขการคำนวณใหม่</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loading && <p className={styles.loading} role="status">กำลังโหลดสถานะข้อมูล...</p>}
    {!loading && !error && data && <section className={styles.section} aria-label="สถานะข้อมูล">
      <div className={styles.sectionHeading}><h2>สถานะข้อมูล</h2></div>
      <div className={styles.tableScroll}>
        <table className={sourceStyles.sources}>
          <thead><tr><th scope="col">ชุดข้อมูล</th><th scope="col">จำนวนแถว</th><th scope="col">อัปเดตล่าสุด (เวลาไทย)</th></tr></thead>
          <tbody>
            <tr><td>All connect</td><td>{data.dataset.totalRows.toLocaleString('th-TH')}</td><td>{dateTime(data.dataset.updatedAt)}</td></tr>
            <tr><td>Technicians</td><td>{data.dataset.techniciansTotalRows.toLocaleString('th-TH')}</td><td>{dateTime(data.dataset.techniciansUpdatedAt)}</td></tr>
          </tbody>
        </table>
      </div>
    </section>}
  </div>;
}
