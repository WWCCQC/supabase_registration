'use client';

import { useId } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { CompareMonth } from '@/lib/allconnectCompare';
import styles from './MonthlyNoWorkChart.module.css';

const count = (value: number) => value.toLocaleString('th-TH');
const monthLabel = (value: string) => new Date(`${value}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });

export default function MonthlyNoWorkChart({ months, selectedMonth, onSelectMonth }: {
  months: CompareMonth[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}) {
  const id = useId().replace(/:/g, '');
  const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const change = first && last ? last.withoutWork - first.withoutWork : 0;
  const comparable = sorted.length > 1;
  const direction = change < 0 ? 'down' : change > 0 ? 'up' : 'flat';
  const TrendIcon = change < 0 ? ArrowDownRight : change > 0 ? ArrowUpRight : Minus;
  const maximum = Math.max(1, ...sorted.map(item => item.withoutWork));
  const scale = Math.max(10, Math.ceil(maximum * 1.15 / 10) * 10);

  return <div className={styles.card}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <h2>จำนวนช่างที่ไม่พบการปิดงานรายเดือน <span>(กองงาน)</span></h2>
        <p>เปรียบเทียบ {sorted.length} เดือน · คลิกแท่งเพื่อกรองข้อมูล</p>
      </div>
      <div className={`${styles.trend} ${styles[direction]}`}>
        <span><TrendIcon size={16} aria-hidden="true" />{!comparable ? 'รอเดือนเปรียบเทียบ' : change < 0 ? 'จำนวนลดลง' : change > 0 ? 'จำนวนเพิ่มขึ้น' : 'จำนวนคงเดิม'}</span>
        {comparable && <small>{first.withoutWork > 0 ? `${Math.abs(change / first.withoutWork * 100).toFixed(1)}%` : `${count(Math.abs(change))} ราย`} · {first.month} → {last.month}</small>}
      </div>
    </header>
    <div className={styles.scroll}>
      <div className={styles.plot} style={{ minWidth: Math.max(280, sorted.length * 140), gridTemplateColumns: `repeat(${sorted.length}, minmax(0, 1fr))` }}>
        {sorted.map(item => {
          const top = 280 - item.withoutWork / scale * 196;
          const ratio = item.total > 0 ? `${(item.withoutWork / item.total * 100).toFixed(1)}%` : '—';
          return <button key={item.month} type="button" className={styles.column}
            data-muted={Boolean(selectedMonth && selectedMonth !== item.month)}
            aria-pressed={selectedMonth === item.month}
            aria-label={`${monthLabel(item.month)} ${item.month.slice(0, 4)}: ไม่พบการปิดงาน ${count(item.withoutWork)} ราย (${ratio}) คลิกเพื่อกรองเดือน`}
            title={`ไม่พบการปิดงาน ${count(item.withoutWork)} จากทั้งหมด ${count(item.total)} ราย`}
            onClick={() => onSelectMonth(item.month)}>
            <svg viewBox="0 0 140 300" className={styles.prism} aria-hidden="true">
              <defs>
                <linearGradient id={`${id}-left-${item.month}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fb7185"/><stop offset="1" stopColor="#e11d48"/></linearGradient>
                <linearGradient id={`${id}-right-${item.month}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f43f5e"/><stop offset="1" stopColor="#9f1239"/></linearGradient>
                <linearGradient id={`${id}-top-${item.month}`}><stop stopColor="#fecdd3"/><stop offset="1" stopColor="#fb7185"/></linearGradient>
              </defs>
              <ellipse cx="70" cy="282" rx="39" ry="8" fill="#881337" opacity=".06"/>
              <g stroke="#fff" strokeWidth=".6">
                <path d="M38 70 L70 84 L70 280 L38 266 Z" fill="#e2e8f0" fillOpacity=".5"/>
                <path d="M70 84 L102 70 L102 266 L70 280 Z" fill="#cbd5e1" fillOpacity=".38"/>
                <path d="M38 70 L70 56 L102 70 L70 84 Z" fill="#f1f5f9" fillOpacity=".9"/>
              </g>
              {item.withoutWork > 0 && <g stroke="#fff" strokeOpacity=".22" strokeWidth=".6">
                <path d={`M38 ${top - 14} L70 ${top} L70 280 L38 266 Z`} fill={`url(#${id}-left-${item.month})`}/>
                <path d={`M70 ${top} L102 ${top - 14} L102 266 L70 280 Z`} fill={`url(#${id}-right-${item.month})`}/>
                <path d={`M38 ${top - 14} L70 ${top - 28} L102 ${top - 14} L70 ${top} Z`} fill={`url(#${id}-top-${item.month})`}/>
              </g>}
            </svg>
            <span className={styles.pill} style={{ top: top - 88 }}><strong><i/>{count(item.withoutWork)}</strong><small>{ratio} <span>ของทั้งหมด</span></small></span>
            <span className={styles.month}>{monthLabel(item.month)}</span>
            <span className={styles.year}>{item.month.slice(0, 4)}</span>
          </button>;
        })}
      </div>
    </div>
    <footer className={styles.legend}><span><i/>ไม่พบการปิดงาน</span></footer>
  </div>;
}
