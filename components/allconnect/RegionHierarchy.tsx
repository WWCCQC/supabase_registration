'use client';
import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CompareRegion, CompareSummary, WorkStatusFilter } from '@/lib/allconnectCompare';
import styles from './AllconnectCompareDashboard.module.css';

type Area = CompareSummary & { cbm: string; province: string | null; level: 'cbm' | 'province' };
const number = (n: number) => n.toLocaleString('th-TH');
const percent = (n: number | null) => n === null ? '-' : `${n.toFixed(1)}%`;

export default function RegionHierarchy({ regions, selected, month, onSelect }: {
  regions: CompareRegion[]; selected: string; month: string;
  onSelect: (rbm: string, status?: WorkStatusFilter) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Record<string, Area[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function expand(rbm: string) {
    setOpen(prev => ({ ...prev, [rbm]: !prev[rbm] }));
    if (rows[rbm] || loading[rbm]) return;
    setLoading(prev => ({ ...prev, [rbm]: true }));
    setErrors(prev => ({ ...prev, [rbm]: '' }));
    try {
      const response = await fetch(`/api/allconnect-compare?${new URLSearchParams({ view: 'hierarchy', rbm, month })}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setRows(prev => ({ ...prev, [rbm]: result.rows }));
    } catch {
      setErrors(prev => ({ ...prev, [rbm]: 'โหลดข้อมูลไม่สำเร็จ กรุณาปิดแล้วขยายอีกครั้ง' }));
    } finally { setLoading(prev => ({ ...prev, [rbm]: false })); }
  }
  function cells(item: CompareSummary, rbm?: string) {
    return <><td>{number(item.total)}</td>
      <td>{rbm ? <button className={styles.greenLink} onClick={() => onSelect(rbm, 'with_work')}>{number(item.withWork)}</button> : number(item.withWork)}</td>
      <td>{rbm ? <button className={styles.redLink} onClick={() => onSelect(rbm, 'without_work')}>{number(item.withoutWork)}</button> : number(item.withoutWork)}</td>
      <td><div className={styles.coverageCell}><meter min={0} max={100} value={item.coverage ?? 0} aria-label="สัดส่วนที่พบปิดงาน"/><span>{percent(item.coverage)}</span></div></td>
      <td>{number(item.installCount)}</td><td>{number(item.repairCount)}</td><td>{number(item.jobCount)}</td></>;
  }
  function toggle(key: string, label: string, action: () => void) {
    return <button type="button" className={styles.regionLink} aria-expanded={Boolean(open[key])} aria-label={`${open[key] ? 'ยุบ' : 'ขยาย'} ${label}`} onClick={action} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{open[key] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>} {label}</button>;
  }
  return <tbody>{regions.map(region => <Fragment key={region.rbm}>
    <tr className={selected === region.rbm ? styles.selectedRow : undefined}><th scope="row">{toggle(region.rbm, region.rbm, () => void expand(region.rbm))} <button type="button" className={styles.regionLink} aria-pressed={selected === region.rbm} onClick={() => onSelect(region.rbm)} style={{ fontSize: 11 }}>กรอง</button></th>{cells(region, region.rbm)}</tr>
    {open[region.rbm] && <>
      {loading[region.rbm] && <tr><td colSpan={8} role="status">กำลังโหลด CBM และจังหวัด...</td></tr>}
      {errors[region.rbm] && <tr><td colSpan={8} role="alert">{errors[region.rbm]}</td></tr>}
      {rows[region.rbm]?.length === 0 && <tr><td colSpan={8}>ไม่มีข้อมูลพื้นที่ย่อย</td></tr>}
      {rows[region.rbm]?.filter(item => item.level === 'cbm').map(cbm => {
        const key = JSON.stringify([region.rbm, cbm.cbm]);
        return <Fragment key={key}><tr style={{ background: '#f1f5f9' }}><th scope="row" style={{ paddingLeft: 28 }}>{toggle(key, cbm.cbm, () => setOpen(prev => ({ ...prev, [key]: !prev[key] })))}</th>{cells(cbm)}</tr>
          {open[key] && rows[region.rbm].filter(item => item.level === 'province' && item.cbm === cbm.cbm).map(item => <tr key={item.province} style={{ background: '#fafcff' }}><th scope="row" style={{ paddingLeft: 54, fontWeight: 400 }}>{item.province}</th>{cells(item)}</tr>)}
        </Fragment>;
      })}
    </>}
  </Fragment>)}</tbody>;
}
