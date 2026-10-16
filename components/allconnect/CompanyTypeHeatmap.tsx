'use client';

import type { CompareMonth, CompareMonthCompanyType } from '@/lib/allconnectCompare';
import styles from './CompanyTypeHeatmap.module.css';

const number = (value: number) => value.toLocaleString('th-TH');
const label = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function Trend({ first, last, available }: { first?: number; last?: number; available: boolean }) {
  if (!available || first === undefined || last === undefined) return <div className={`${styles.trend} ${styles.neutral}`}><strong>—</strong><small>ยังเปรียบเทียบไม่ได้</small></div>;
  const difference = last - first;
  return <div className={`${styles.trend} ${difference < 0 ? styles.down : difference > 0 ? styles.up : styles.neutral}`}>
    <strong>{difference === 0 ? `${number(last)} ราย` : `${difference < 0 ? '▼' : '▲'} ${first > 0 ? `${(Math.abs(difference) / first * 100).toFixed(1)}%` : `${number(difference)} ราย`}`}</strong>
    <small>{difference < 0 ? 'ลดลงจากเดือนแรก' : difference > 0 ? 'เพิ่มจากเดือนแรก' : 'จำนวนคงเดิม'}</small>
  </div>;
}

export default function CompanyTypeHeatmap({ months, items, selectedMonth, onSelectMonth }: {
  months: CompareMonth[]; items: CompareMonthCompanyType[]; selectedMonth: string; onSelectMonth: (month: string) => void;
}) {
  const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
  const totals = new Map<string, number>();
  const values = new Map<string, number>();
  items.forEach(item => {
    totals.set(item.companyType, (totals.get(item.companyType) ?? 0) + item.withoutWork);
    values.set(`${item.companyType}\0${item.month}`, item.withoutWork);
  });
  const types = [...totals.keys()].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0) || a.localeCompare(b, 'th'));
  const maximum = Math.max(1, ...items.map(item => item.withoutWork));
  const first = sorted[0];
  const last = sorted.at(-1);
  const comparable = sorted.length > 1;
  return <div className={styles.card}>
    <header className={styles.header}>
      <div className={styles.heading}><h2>จำนวนช่างที่ไม่พบการปิดงานรายเดือน แยกตามประเภทช่าง</h2></div>
      <div className={styles.overview}><span>แนวโน้มภาพรวม ({sorted.length} เดือน)</span><Trend first={first?.withoutWork} last={last?.withoutWork} available={comparable}/></div>
    </header>
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead><tr><th scope="col">ประเภทช่าง</th>{sorted.map(item => <th scope="col" key={item.month}><button className={styles.month} type="button" aria-pressed={selectedMonth === item.month} onClick={() => onSelectMonth(item.month)}>{label(item.month)}</button></th>)}<th scope="col">แนวโน้ม</th></tr></thead>
        <tbody>{types.map((type, index) => <tr key={type}>
          <th scope="row"><div className={styles.type}><span className={styles.icon} data-tone={index % 3}>{type === 'WW-Provider' ? 'WW' : type === 'True Tech' ? 'TT' : type === 'เถ้าแก่เทค' ? 'TK' : type.slice(0, 2)}</span><strong>{type || 'ไม่ระบุประเภท'}</strong></div></th>
          {sorted.map(item => {
            const value = values.get(`${type}\0${item.month}`);
            const share = value !== undefined && item.withoutWork > 0 ? value / item.withoutWork * 100 : 0;
            const tone = value === undefined ? 'missing' : value === 0 ? 'zero' : value / maximum > .65 ? 'high' : value / maximum > .2 ? 'medium' : 'low';
            return <td key={item.month}><div className={styles.cell} data-tone={tone} title={`${type} · ${label(item.month)}: ${value === undefined ? 'ไม่มีข้อมูล' : `${number(value)} กองงาน`}`}>
              <div className={styles.cellHeading}><strong>{value === undefined ? '—' : number(value)}</strong><span>{value === undefined ? 'ไม่มีข้อมูล' : value === 0 ? 'ไม่พบรายการ' : `${share.toFixed(1)}% ของเดือน`}</span></div>
              <div className={styles.track}><span style={{ width: `${Math.min(100, share)}%` }}/></div>
            </div></td>;
          })}
          <td><Trend first={values.get(`${type}\0${first?.month}`)} last={values.get(`${type}\0${last?.month}`)} available={comparable}/></td>
        </tr>)}</tbody>
        <tfoot><tr><th scope="row"><div className={styles.totalLabel}>Total</div></th>{sorted.map(item => <td key={item.month}><div className={styles.total}><strong>{number(item.withoutWork)}</strong><span>{item.total > 0 ? `${(item.withoutWork / item.total * 100).toFixed(1)}% ของกองงาน` : '—'}</span></div></td>)}<td><Trend first={first?.withoutWork} last={last?.withoutWork} available={comparable}/></td></tr></tfoot>
      </table>
    </div>
  </div>;
}
