'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, RefreshCw, Search, X } from 'lucide-react';
import { ContractRow, contractColumns, contractValue, filterContracts, groupContracts } from '@/lib/contractDashboard';
import styles from './ContractDashboard.module.css';

const filterFields = [['rbm', 'RBM'], ['active_status', 'สถานะ Active'], ['contract_status', 'สถานะสัญญา'], ['installation_status', 'เหตุผล'], ['bg_status', 'สถานะ BG']] as const;
const rbmOrder = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'];
const rbmRank = (value: string) => { const index = rbmOrder.indexOf(value.trim().split('_', 1)[0]); return index === -1 ? rbmOrder.length : index; };
const contractStatusOrder = ['สัญญา Active', 'ต่อสัญญา', 'ยกเลิกสัญญา', 'อยู่ระหว่างยกเลิกสัญญา', 'หมดอายุ'];
const number = (value: number) => value.toLocaleString('th-TH');

function AnimatedCardNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const finish = () => {
      if (motion.matches) {
        cancelAnimationFrame(frame);
        setDisplayed(value);
      }
    };
    if (motion.matches || value === 0) {
      setDisplayed(value);
      return;
    }
    setDisplayed(0);
    const started = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - started) / 2600);
      const eased = 1 - Math.pow(1 - progress, 2);
      setDisplayed(progress === 1 ? value : Math.floor(value * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    motion.addEventListener('change', finish);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener('change', finish);
    };
  }, [value]);

  return <strong aria-label={number(value)}>{number(displayed)}</strong>;
}

export default function ContractDashboard() {
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch('/api/contract-c', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'โหลดข้อมูลไม่สำเร็จ');
        setRows(body.rows); setPage(1);
      }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const filtered = useMemo(() => filterContracts(rows, query, filters), [rows, query, filters]);
  const statuses = useMemo(() => groupContracts(filtered, 'contract_status').sort(([a], [b]) => {
    const aIndex = contractStatusOrder.indexOf(a);
    const bIndex = contractStatusOrder.indexOf(b);
    return (aIndex === -1 ? contractStatusOrder.length : aIndex) - (bIndex === -1 ? contractStatusOrder.length : bIndex);
  }), [filtered]);
  const reasons = useMemo(() => groupContracts(filtered, 'installation_status'), [filtered]);
  // ค่าเริ่มต้นแสดงเฉพาะ Active; เมื่อมีการค้นหาหรือใช้ตัวกรอง จะแสดงทุกสถานะตามเงื่อนไข
  const isFiltering = query.trim() !== '' || Object.values(filters).some(Boolean);
  const tableRows = useMemo(() => isFiltering ? filtered : filtered.filter(row => contractValue(row.active_status).toLowerCase() === 'active'), [filtered, isFiltering]);
  const pages = Math.max(1, Math.ceil(tableRows.length / size));
  const current = Math.min(page, pages);
  const changeFilter = (key: string, value: string) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(1); };
  const exportExcel = async () => {
    setExporting(true);
    setExportError('');
    try {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.aoa_to_sheet([
        contractColumns.map(([, label]) => label),
        ...tableRows.map(row => contractColumns.map(([key]) => String(row[key] ?? ''))),
      ]);
      sheet['!cols'] = contractColumns.map(([key, label]) => ({
        wch: Math.min(60, Math.max(16, label.length + 2, ...tableRows.map(row => String(row[key] ?? '').length + 2))),
      }));
      sheet['!autofilter'] = { ref: sheet['!ref']! };
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Track C');
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
      XLSX.writeFile(workbook, `contract-c-${date}.xlsx`);
    } catch {
      setExportError('ส่งออก Excel ไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setExporting(false);
    }
  };
  return <div className={styles.dashboard} aria-busy={loading}>
    <header className={styles.header}><h2>Summary of contract</h2><button onClick={() => setRevision(value => value + 1)} disabled={loading} title="รีเฟรชข้อมูล" aria-label="รีเฟรชข้อมูล"><RefreshCw size={18} /></button></header>
    {error && <div role="alert" className={styles.error}>{error}</div>}
    {loading ? <p role="status">กำลังโหลดข้อมูลสัญญา...</p> : error ? null : <>
      <div className={styles.cards}>
        <button className={styles.card} onClick={() => { setFilters({}); setQuery(''); setPage(1); }}><span>คู่สัญญาทั้งหมด</span><AnimatedCardNumber value={filtered.length} /><small>ราย</small></button>
        {statuses.map(([status, count], index) => <button key={status} className={styles.card} data-tone={index % 5} aria-pressed={filters.contract_status === status} onClick={() => changeFilter('contract_status', filters.contract_status === status ? '' : status)}><span>{status}</span><AnimatedCardNumber value={count} /><small>{filtered.length ? (count / filtered.length * 100).toFixed(1) : '0.0'}% ของทั้งหมด</small></button>)}
      </div>
      <div className={styles.filters}>
        <label className={styles.search}>ค้นหาทุกคอลัมน์<div><Search size={17} /><input value={query} placeholder="ชื่อคู่สัญญา เลขที่สัญญา Depot…" onChange={event => { setQuery(event.target.value); setPage(1); }} /></div></label>
        {filterFields.map(([key, label]) => <label key={key}>{label}<select value={filters[key] || ''} onChange={event => changeFilter(key, event.target.value)}><option value="">ทั้งหมด</option>{groupContracts(rows, key).sort(([a], [b]) => key === 'rbm' ? rbmRank(a) - rbmRank(b) : 0).map(([value]) => <option key={value}>{value}</option>)}</select></label>)}
        <button title="ล้างตัวกรอง" aria-label="ล้างตัวกรอง" onClick={() => { setFilters({}); setQuery(''); setPage(1); }}><X size={18} /></button>
      </div>
       <section className={styles.reasons}><h3>รายละเอียดสถานะสัญญา · {number(filtered.length)} ราย</h3>{reasons.length ? <div className={styles.bars}>{reasons.map(([reason, count]) => <div key={reason} className={styles.barRow}><span>{reason}</span><div className={styles.track}><div style={{ width: `${count / filtered.length * 100}%` }} /></div><strong>{number(count)} <small>({(count / filtered.length * 100).toFixed(1)}%)</small></strong></div>)}</div> : <p>ไม่พบข้อมูลตามเงื่อนไข</p>}</section>
      <section><div className={styles.header}><h3>รายละเอียดสัญญา</h3><div className={styles.tableActions}><span>{number(tableRows.length)} รายการ</span><button type="button" onClick={exportExcel} disabled={loading || exporting || !tableRows.length}><Download size={17} aria-hidden="true" />{exporting ? 'กำลังส่งออก...' : 'Export Excel'}</button></div></div>
        {exportError && <p role="alert" className={styles.error}>{exportError}</p>}
        <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="ตารางรายละเอียดสัญญา"><table><thead><tr>{contractColumns.map(([key, label]) => <th key={key} title={key}>{label}</th>)}</tr></thead><tbody>{tableRows.slice((current - 1) * size, current * size).map(row => <tr key={row.company_registration_no}>{contractColumns.map(([key]) => <td key={key}>{contractValue(row[key])}</td>)}</tr>)}{!tableRows.length && <tr><td colSpan={contractColumns.length}>ไม่พบข้อมูลตามเงื่อนไข</td></tr>}</tbody></table></div>
        <div className={styles.footer}><label>แถวต่อหน้า <select value={size} onChange={event => { setSize(Number(event.target.value)); setPage(1); }}>{[25, 50, 100].map(value => <option key={value}>{value}</option>)}</select></label><span>หน้า {current} / {pages}</span><button title="หน้าก่อนหน้า" aria-label="หน้าก่อนหน้า" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft size={18} /></button><button title="หน้าถัดไป" aria-label="หน้าถัดไป" disabled={current === pages} onClick={() => setPage(current + 1)}><ChevronRight size={18} /></button></div>
      </section>
    </>}
  </div>;
}
