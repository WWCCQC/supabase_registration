'use client';

import { FileCheck2, MapPin, TrendingUp, Trophy } from 'lucide-react';
import styles from './RbmContractChart.module.css';

type Breakdown = {
  statuses: string[];
  items: { rbm: string; total: number; counts: [string, number][] }[];
  max: number;
};

// โทนสีไล่ระดับ: Active = เขียวมรกต, สถานะอื่น ๆ ใช้โทนรองตามลำดับ
const palette = [
  { from: '#34d399', via: '#10b981', to: '#047857', solid: '#10b981' },
  { from: '#fb7185', via: '#e11d48', to: '#be123c', solid: '#e11d48' },
  { from: '#fcd34d', via: '#f59e0b', to: '#d97706', solid: '#f59e0b' },
  { from: '#67e8f9', via: '#06b6d4', to: '#0e7490', solid: '#06b6d4' },
  { from: '#c4b5fd', via: '#8b5cf6', to: '#6d28d9', solid: '#8b5cf6' },
];
const number = (value: number) => value.toLocaleString('th-TH');
const splitRbm = (rbm: string) => {
  const [code, ...rest] = rbm.split('_');
  return { code, name: rest.join('_') };
};

export default function RbmContractChart({ data }: { data: Breakdown }) {
  const grandTotal = data.items.reduce((sum, item) => sum + item.total, 0);
  const activeIndex = data.statuses.findIndex(status => status.toLowerCase() === 'active');
  const activeTotal = activeIndex === -1 ? 0 : data.items.reduce((sum, item) => sum + item.counts[activeIndex][1], 0);
  const activePercent = grandTotal ? (activeTotal / grandTotal * 100).toFixed(1) : '0.0';
  const topItems = data.max > 0 ? data.items.filter(item => item.total === data.max) : [];
  const average = data.items.length ? grandTotal / data.items.length : 0;
  const avgHeightPercent = data.max > 0 ? Math.min(100, Math.max(0, (average / data.max) * 100)) : 0;

  const kpis = [
    { icon: FileCheck2, label: 'สัญญาทั้งหมด', value: number(grandTotal), unit: 'ราย', tone: 0 },
    { icon: TrendingUp, label: 'อัตรา Active', value: `${activePercent}%`, unit: `${number(activeTotal)} ราย`, tone: 1 },
    { icon: MapPin, label: 'พื้นที่ (RBM)', value: number(data.items.length), unit: `เฉลี่ย ${average.toFixed(1)}/พื้นที่`, tone: 2 },
    {
      icon: Trophy,
      label: 'พื้นที่สูงสุด',
      value: topItems.length ? topItems.map(item => splitRbm(item.rbm).code).join(', ') : '-',
      unit: topItems.length ? `${number(data.max)} ราย (${grandTotal ? (data.max / grandTotal * 100).toFixed(1) : '0.0'}%)` : '',
      tone: 3,
    },
  ];

  return <section className={styles.panel}>
    <header className={styles.head}>
      <div>
        <span className={styles.eyebrow}><i aria-hidden="true" />Corporate Contract Overview</span>
        <h3>รายละเอียดสัญญาตามพื้นที่</h3>
      </div>
      <div className={styles.legend}>
        {data.statuses.length <= 1 ? (
          <span className={styles.activePill}>
            <i className={styles.pulseDot} aria-hidden="true" />
            Active {activePercent}% ({number(activeTotal)} ราย)
          </span>
        ) : data.statuses.map((status, index) => (
          <span key={status} className={styles.statusPill}>
            <i style={{ background: `linear-gradient(180deg, ${palette[index % palette.length].from}, ${palette[index % palette.length].to})` }} />
            {status}
          </span>
        ))}
      </div>
    </header>

    <div className={styles.kpis}>{kpis.map(({ icon: Icon, label, value, unit, tone }, index) => (
      <div key={label} className={styles.kpi} data-tone={tone} style={{ animationDelay: `${index * 80}ms` }}>
        <span className={styles.kpiAccent} aria-hidden="true" />
        <span className={styles.kpiIcon}><Icon size={18} aria-hidden="true" /></span>
        <div className={styles.kpiBody}>
          <small>{label}</small>
          <div className={styles.kpiValueRow}>
            <strong>{value}</strong>
            <em>{unit}</em>
          </div>
        </div>
      </div>
    ))}</div>

    {data.items.length ? <div className={styles.body}>
      <figure className={styles.visual}>
        <img
          src="https://sggunyytungtyhezchft.supabase.co/storage/v1/object/public/other/Generated_Image_rRVoPh2CS08bw8xx_1%20(1).png"
          alt="Wire & Wireless Corporate"
          loading="lazy"
        />
        <figcaption className={styles.visualCaption}>
          <span className={styles.captionBrand}>Wire &amp; Wireless</span>
          <span className={styles.captionSub}>Regional Partner Network</span>
        </figcaption>
      </figure>

      <div className={styles.chartCard}>
        <div className={styles.chartMeta}>
          <span>จำนวนคู่สัญญา (ราย) · สัดส่วน (%)</span>
          <span className={styles.avgLegend}>
            <i aria-hidden="true" />
            ค่าเฉลี่ย {average.toFixed(1)} ราย/พื้นที่
          </span>
        </div>

        <div className={styles.plotArea}>
          <div className={styles.plotColumns} style={{ gridTemplateColumns: `repeat(${data.items.length}, minmax(0, 1fr))` }}>
            {data.max > 0 && (
              <div
                className={styles.avgLine}
                style={{ bottom: `calc(${avgHeightPercent}% * 0.76 + 8px)` }}
                aria-hidden="true"
              />
            )}
            {data.items.map((item, colIndex) => {
              const isTop = data.max > 0 && item.total === data.max;
              const share = grandTotal ? (item.total / grandTotal * 100).toFixed(1) : '0.0';
              const heightPercent = data.max > 0 ? (item.total / data.max) * 100 : 0;
              const tooltipText = item.counts
                .filter(([, count]) => count > 0)
                .map(([status, count]) => `${status}: ${number(count)} ราย`)
                .join(' · ');

              return (
                <div key={item.rbm} className={styles.barCol} title={`${item.rbm} — ${tooltipText} (${share}%)`}>
                  <div className={styles.valueBadge} data-top={isTop || undefined}>
                    <strong>{number(item.total)}</strong>
                    <span>({share}%)</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFillWrap}
                      style={{ height: `${heightPercent}%`, animationDelay: `${colIndex * 80}ms` }}
                    >
                      {item.counts.map(([status, count], statusIndex) => {
                        if (!count || !item.total) return null;
                        const color = palette[statusIndex % palette.length];
                        return (
                          <div
                            key={status}
                            className={styles.barSegment}
                            style={{
                              height: `${(count / item.total) * 100}%`,
                              background: `linear-gradient(180deg, ${color.from} 0%, ${color.via} 42%, ${color.to} 100%)`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.xAxis} style={{ gridTemplateColumns: `repeat(${data.items.length}, minmax(0, 1fr))` }}>
            {data.items.map(item => {
              const { code, name } = splitRbm(item.rbm);
              const isTop = data.max > 0 && item.total === data.max;
              return (
                <div key={item.rbm} className={styles.xTick}>
                  <span className={styles.xCode} data-top={isTop || undefined}>{code}</span>
                  {name && <span className={styles.xName}>{name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div> : <p className={styles.empty}>ไม่พบข้อมูลตามเงื่อนไข</p>}
  </section>;
}
