'use client';

import { Fragment, useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertCircle, Building2, CalendarDays, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ClipboardX, Download, MapPin, RefreshCw, Search, Users, X, XCircle } from 'lucide-react';
import { buildExecutiveInsights, calculateWithoutWorkCoverage, weeklyJobBackground, providerSummaryExportRows, formatRegionBarLabel, type CompareDashboard, type CompareRow, type WorkStatus, type WorkStatusFilter } from '@/lib/allconnectCompare';
import styles from './AllconnectCompareDashboard.module.css';
import AllconnectUpload from './AllconnectUpload';
import TechniciansUpload from './TechniciansUpload';
import sourceStyles from './AllconnectSources.module.css';

const number = (value: number) => value.toLocaleString('th-TH');
const percent = (value: number | null) => value === null ? '-' : `${value.toFixed(1)}%`;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (value: string) => MONTH_NAMES[Number(value.slice(5, 7)) - 1] ?? value;
const WORK_LABELS: Record<WorkStatus, string> = {
  with_work: 'ปิดงาน', without_work: 'ไม่มีการปิดงาน', pending: 'รอเปรียบเทียบ',
};
const DETAIL_HEADINGS = ['รหัสช่าง', 'ชื่อช่าง', 'RBM', 'Depot', 'Depot Name', 'สถานะการปิดงาน'];
const COLORS = { withWork: '#159574', withoutWork: '#dc5966', pending: '#a1a8b3' };
const DETAIL_FILTERS = [
  { value: 'all', label: 'ข้อมูลช่างทั้งหมด', Icon: Users },
  { value: 'with_work', label: 'จำนวนช่างที่ปิดงาน', Icon: CheckCircle },
  { value: 'without_work', label: 'จำนวนช่างที่ไม่มีการปิดงาน', Icon: XCircle },
] as const;

function TrendSparkline({ values, labels }: { values: number[]; labels: string[] }) {
  if (values.length < 2) return <span className={styles.trendEmpty}>-</span>;
  const width = 120, height = 34, pad = 4;
  const max = Math.max(1, ...values);
  const x = (index: number) => pad + (index * (width - pad * 2)) / (values.length - 1);
  const y = (value: number) => height - pad - (value / max) * (height - pad * 2);
  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const allZero = values.every(value => value === 0);
  const details = values.map((value, index) => `${labels[index]}: ${number(value)} งาน`).join('\n');
  return (
    <svg className={styles.sparkline} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${allZero ? 'ไม่มีงานทุกสัปดาห์ ' : ''}จำนวนงานรายสัปดาห์ ${details.replace(/\n/g, ', ')}`}>
      <title>{allZero ? `ไม่มีงานทุกสัปดาห์\n${details}` : details}</title>
      <polyline points={points} fill="none" stroke={allZero ? '#dc5966' : '#167eac'} strokeWidth={1.75} strokeDasharray={allZero ? '4 3' : undefined} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok',
  }).format(new Date(value)) : '-';
}

async function getDashboard(params: URLSearchParams, signal?: AbortSignal): Promise<CompareDashboard> {
  const response = await fetch(`/api/allconnect-compare?${params}`, { cache: 'no-store', signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'โหลดข้อมูลไม่สำเร็จ');
  return body;
}

export default function AllconnectCompareDashboard() {
  const [data, setData] = useState<CompareDashboard | null>(null);
  const [rbm, setRbm] = useState('');
  const [month, setMonth] = useState('');
  const [status, setStatus] = useState<WorkStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [providerExporting, setProviderExporting] = useState(false);
  const [providerExportError, setProviderExportError] = useState('');
  const [expandedDepots, setExpandedDepots] = useState<Set<string>>(new Set());

  function toggleDepot(key: string) {
    setExpandedDepots(previous => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ rbm, month, status, q: query, page: String(page), pageSize: String(pageSize) });
    getDashboard(params, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [rbm, month, status, query, page, pageSize, revision]);

  function selectRegion(value: string, workStatus?: WorkStatusFilter) {
    setRbm(value);
    if (workStatus) setStatus(workStatus);
    setPage(1);
  }

  async function exportExcel() {
    setExporting(true);
    setExportError('');
    try {
      const params = new URLSearchParams({ rbm, month, status, q: query, page: '1', pageSize: '500' });
      const first = await getDashboard(params);
      const rows: CompareRow[] = [...first.rows];
      for (let next = 2; next <= first.pagination.totalPages; next++) {
        params.set('page', String(next));
        const result = await getDashboard(params);
        if (result.pagination.total !== first.pagination.total || result.dataset.updatedAt !== first.dataset.updatedAt ||
            result.dataset.techniciansUpdatedAt !== first.dataset.techniciansUpdatedAt) {
          throw new Error('ข้อมูลมีการเปลี่ยนแปลงระหว่างส่งออก กรุณาลองอีกครั้ง');
        }
        rows.push(...result.rows);
      }
      const XLSX = await import('xlsx');
      const headings = [...DETAIL_HEADINGS, ...first.dataset.workPeriods.map(period => `${period.month} Week ${period.weekNumber}`)];
      const worksheet = XLSX.utils.aoa_to_sheet([headings, ...rows.map(row => [
        row.techId ?? '', row.fullName, row.rbm,
        row.depotCode, row.depotName, WORK_LABELS[row.workStatus], ...first.dataset.workPeriods.map(period => row.weeklyJobs.find(week => week.month === period.month && week.weekStart === period.weekStart)?.jobCount ?? 0),
      ])]);
      worksheet['!cols'] = headings.map((_, index) => ({ wch: [1, 4].includes(index) ? 32 : 20 }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Technicians');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ['พื้นที่', rbm || 'ทุกพื้นที่'], ['สถานะการปิดงาน', status === 'all' ? 'ทั้งหมด' : WORK_LABELS[status]],
        ['เดือน', month || 'ทุกเดือน'], ['ทะเบียนช่าง', 'allconnect_technicians'], ['สถานะช่าง', 'หัวหน้า'],
        ['คำค้นหา', query], ['ข้อมูลนำเข้าล่าสุด (เวลาไทย)', dateTime(first.dataset.importedAt)],
        ['รายการ Allconnect ทั้งหมด', first.dataset.totalRows], ['แถวที่ส่งออก', rows.length],
      ]), 'Filters');
      XLSX.writeFile(workbook, `allconnect-compare-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : 'ส่งออกไม่สำเร็จ');
    } finally { setExporting(false); }
  }

  async function exportProviderExcel() {
    if (!data) return;
    setProviderExporting(true);
    setProviderExportError('');
    const depots = data.depots.filter(depot => !rbm || depot.rbm === rbm);
    try {
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.aoa_to_sheet(providerSummaryExportRows(depots));
      worksheet['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 45 }, ...Array.from({ length: 7 }, () => ({ wch: 24 }))];
      depots.forEach((_, index) => {
        const cell = worksheet[XLSX.utils.encode_cell({ r: index + 1, c: 6 })];
        if (cell?.t === 'n') cell.z = '0.0%';
      });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Provider Summary');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ['พื้นที่ RBM', rbm || 'ทุกพื้นที่'], ['เดือน', month || 'ทุกเดือน'],
        ['ข้อมูล All connect อัปเดตล่าสุด (เวลาไทย)', dateTime(data.dataset.updatedAt)],
        ['ข้อมูลช่างอัปเดตล่าสุด (เวลาไทย)', dateTime(data.dataset.techniciansUpdatedAt)],
        ['จำนวนแถวที่ส่งออก', depots.length],
      ]), 'Filters');
      XLSX.writeFile(workbook, `allconnect-provider-summary-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (cause) {
      setProviderExportError(cause instanceof Error ? cause.message : 'ส่งออกไม่สำเร็จ');
    } finally { setProviderExporting(false); }
  }

  const summary = data?.summary;
  const pieData = summary ? [
    { name: 'พบปิดงาน', value: summary.withWork, color: COLORS.withWork },
    { name: 'ไม่พบการปิดงาน', value: summary.withoutWork, color: COLORS.withoutWork },
    { name: 'รอเปรียบเทียบ', value: summary.pending, color: COLORS.pending },
  ].filter(item => item.value > 0) : [];
  const chartRegions = data?.regions.map(region => ({
    ...region,
    withWorkLabel: region.withWork > 0 ? formatRegionBarLabel(region.withWork, region.total) : '',
    withoutWorkLabel: region.withoutWork > 0 ? formatRegionBarLabel(region.withoutWork, region.total) : '',
    totalLabel: region.total > 0 ? number(region.total) : '',
  })) ?? [];
  const chartMonths = data?.monthly?.map(item => ({
    ...item,
    withoutWorkLabel: item.withoutWork > 0 ? formatRegionBarLabel(item.withoutWork, item.total) : '',
  })) ?? [];
  const monthlyTypes = data?.monthlyByCompanyType ?? [];
  const companyTypeTotals = new Map<string, number>();
  const companyTypeCounts = new Map<string, number>();
  for (const item of monthlyTypes) {
    companyTypeTotals.set(item.companyType, (companyTypeTotals.get(item.companyType) ?? 0) + item.withoutWork);
    companyTypeCounts.set(`${item.companyType}\u0000${item.month}`, item.withoutWork);
  }
  const companyTypes = [...companyTypeTotals.keys()].sort((a, b) =>
    (companyTypeTotals.get(b) ?? 0) - (companyTypeTotals.get(a) ?? 0) || a.localeCompare(b, 'th'));
  const maxCompanyTypeCount = Math.max(0, ...monthlyTypes.map(item => item.withoutWork));
  const insights = data ? buildExecutiveInsights(data, rbm) : null;
  const latestInsightMonth = insights?.months.at(-1);
  const visibleDepots = data?.depots.filter(depot => !rbm || depot.rbm === rbm) ?? [];
  const selectedTitle = rbm || 'ทุกพื้นที่ RBM';
  const staleSearch = query !== search.trim();
  const busy = loading || staleSearch;
  const workPeriods = data?.dataset.workPeriods ?? [];
  const workMonths = [...new Set(workPeriods.map(period => period.month))];

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <h1>All connect compare tech</h1>
        </div>
        <div className={styles.headerActions}>
          <div className={sourceStyles.uploads}>
            <AllconnectUpload updatedAt={dateTime(data?.dataset.updatedAt ?? null)} onComplete={() => setRevision(value => value + 1)} />
            <TechniciansUpload updatedAt={dateTime(data?.dataset.techniciansUpdatedAt ?? null)} onComplete={() => setRevision(value => value + 1)} />
          </div>
          <button className={styles.iconButton} type="button" onClick={() => setRevision(value => value + 1)} disabled={loading} title="รีเฟรชข้อมูล" aria-label="รีเฟรชข้อมูล">
            <RefreshCw size={18} className={loading ? styles.spinning : undefined} />
          </button>
        </div>
      </header>
      <div className={styles.scopeBar}>
        <label>เดือนปิดงาน
          <select value={month} onChange={event => { setMonth(event.target.value); setPage(1); }}>
            <option value="">ทุกเดือน</option>
            {data?.dataset.months.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>พื้นที่ RBM
          <select value={rbm} onChange={event => selectRegion(event.target.value)}>
            <option value="">ทุกพื้นที่</option>
            {data?.regions.map(region => <option key={region.rbm} value={region.rbm}>{region.rbm}</option>)}
          </select>
        </label>
        <label className={styles.globalSearchLabel}><span>ค้นหาข้อมูลช่าง</span><div className={styles.searchInput}><Search size={17} aria-hidden="true" /><input value={search} maxLength={200} onChange={event => setSearch(event.target.value)} placeholder="ชื่อ รหัสช่าง RBM ศูนย์ หรือจังหวัด" aria-label="ค้นหาข้อมูลช่าง" />{search && <button type="button" title="ล้างคำค้นหา" aria-label="ล้างคำค้นหา" onClick={() => setSearch('')}><X size={16} /></button>}</div></label>
        {rbm && <button type="button" className={styles.textButton} onClick={() => selectRegion('')}><X size={16} /> ล้างพื้นที่</button>}
        <div className={styles.loadStatus} role="status" aria-live="polite">
          {busy ? 'กำลังโหลดข้อมูล...' : error ? 'โหลดไม่สำเร็จ' : (
            <ul className={styles.scopeNotes}>
              <li>ข้อมูลช่าง = allconnect_technicians</li>
              <li>สถานะช่าง = หัวหน้า</li>
              <li>ช่วงข้อมูล: {month || data?.dataset.months.join(', ') || '-'}</li>
              <li>งานติดตั้ง / งานซ่อม</li>
            </ul>
          )}
        </div>
      </div>

      {error && <div className={styles.error} role="alert"><AlertCircle size={20} /><span>{error}</span><button type="button" onClick={() => setRevision(value => value + 1)}>ลองอีกครั้ง</button></div>}
      {data?.dataset.totalRows === 0 && !error && <div className={styles.notice} role="status">ยังไม่มีข้อมูล Allconnect สำหรับเปรียบเทียบ ช่างจะแสดงสถานะ “รอเปรียบเทียบ” จนกว่าจะนำเข้าข้อมูล</div>}

      {(!data || error) ? (
        !error && <div className={styles.initialLoading}>กำลังคำนวณข้อมูลช่างและงานติดตั้ง...</div>
      ) : (
        <div className={busy ? styles.updating : undefined} aria-busy={busy}>
          <section className={styles.metrics} aria-label={`สรุป ${selectedTitle}`}>
            <article className={styles.metric}><span>จำนวนช่าง(กองงาน)</span><strong>{number(data.summary.total)}</strong></article>
            <article className={`${styles.metric} ${styles.green}`}><span>จำนวนช่างที่ปิดงาน(กองงาน)</span><strong>{number(data.summary.withWork)}</strong></article>
            <article className={`${styles.metric} ${styles.teal}`}><span>สัดส่วนที่ปิดงาน</span><strong>{percent(data.summary.coverage)}</strong></article>
            <article className={`${styles.metric} ${styles.red}`}><span>จำนวนช่างที่ไม่มีการปิดงาน<span className={styles.labelSuffix}>(กองงาน)</span></span><strong>{number(data.summary.withoutWork)}</strong></article>
            <article className={`${styles.metric} ${styles.red}`}><span>สัดส่วนที่ไม่ปิดงาน</span><strong>{percent(calculateWithoutWorkCoverage(data.summary.withWork, data.summary.withoutWork))}</strong></article>
          </section>
          {data.summary.pending > 0 && <p className={styles.notice}>รอเปรียบเทียบ {number(data.summary.pending)} ราย {data.dataset.totalRows > 0 ? '(ไม่มีรหัสช่าง)' : '(ยังไม่มีข้อมูล Allconnect)'}</p>}

          <div className={styles.trendGrid}>
            <div className={styles.trendCharts}>
            <section className={styles.monthlyChart} aria-label="จำนวนช่างที่ไม่พบการปิดงานรายเดือน (กองงาน)">
              <div className={styles.sectionHeading}><h2>จำนวนช่างที่ไม่พบการปิดงานรายเดือน (กองงาน)</h2></div>
              {chartMonths.length ? <div className={styles.barCanvas}>
                <div className={styles.monthlyChartInner} style={{ minWidth: Math.max(320, chartMonths.length * 110) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartMonths} margin={{ top: 32, right: 16, bottom: 4, left: 0 }} maxBarSize={72}
                      onClick={state => {
                        const value = state?.activeLabel;
                        if (typeof value !== 'string') return;
                        setMonth(previous => previous === value ? '' : value);
                        setPage(1);
                      }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8ebef" />
                      <XAxis dataKey="month" tickFormatter={monthName} tick={{ fontSize: 12, fill: '#374151' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={false} axisLine={false} tickLine={false} width={0} />
                      <Tooltip cursor={{ fill: 'rgba(220, 89, 102, 0.08)' }} formatter={value => `${number(Number(value))} ราย`} labelFormatter={label => `เดือน ${label}`} contentStyle={{ borderRadius: 6, fontSize: 13 }} />
                      <Bar dataKey="withoutWork" name="ไม่พบการปิดงาน" fill={COLORS.withoutWork} isAnimationActive={false} cursor="pointer">
                        {chartMonths.map(item => <Cell key={item.month} fillOpacity={month && month !== item.month ? 0.35 : 1} />)}
                        <LabelList dataKey="withoutWorkLabel" position="top" fill="#374151" fontSize={11} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div> : <div className={styles.empty}>{data.monthly ? 'ยังไม่มีข้อมูลรายเดือน' : 'ยังไม่ได้อัปเดตฟังก์ชันฐานข้อมูลสำหรับข้อมูลรายเดือน'}</div>}
            </section>
            <section className={styles.companyTypeChart} aria-label="จำนวนช่างที่ไม่พบการปิดงานรายเดือน แยกตามประเภทช่าง">
              <div className={styles.sectionHeading}><h2>จำนวนช่างที่ไม่พบการปิดงานรายเดือน แยกตามประเภทช่าง</h2></div>
              {chartMonths.length && companyTypes.length ? <div className={styles.heatmapScroll}>
                <table className={styles.heatmap}>
                  <thead><tr><th scope="col">ประเภทช่าง</th>{chartMonths.map(item => <th scope="col" key={item.month}>
                    <button type="button" className={styles.heatmapMonth} aria-pressed={month === item.month} onClick={() => { setMonth(previous => previous === item.month ? '' : item.month); setPage(1); }}>
                      {monthName(item.month)} {item.month.slice(0, 4)}
                    </button>
                  </th>)}</tr></thead>
                  <tbody>{companyTypes.map(companyType => <tr key={companyType}>
                    <th scope="row">{companyType}</th>
                    {chartMonths.map(item => {
                      const count = companyTypeCounts.get(`${companyType}\u0000${item.month}`) ?? 0;
                      const intensity = maxCompanyTypeCount > 0 ? count / maxCompanyTypeCount : 0;
                      return <td key={item.month} title={`${companyType} · ${monthName(item.month)} ${item.month.slice(0, 4)}: ${number(count)} กองงาน`}>
                        <span className={styles.heatmapCell} style={count ? { backgroundColor: `rgba(220, 89, 102, ${(0.12 + intensity * 0.4).toFixed(2)})` } : undefined}>{number(count)}</span>
                      </td>;
                    })}
                  </tr>)}</tbody>
                  <tfoot><tr><th scope="row">รวมทุกประเภท</th>{chartMonths.map(item => <td key={item.month}>{number(item.withoutWork)}</td>)}</tr></tfoot>
                </table>
              </div> : <div className={styles.empty}>{data.monthlyByCompanyType ? 'ยังไม่มีข้อมูลประเภทช่างที่ไม่พบการปิดงาน' : 'ยังไม่ได้อัปเดตฟังก์ชันฐานข้อมูลสำหรับข้อมูลประเภทช่างรายเดือน'}</div>}
            </section>
            </div>
            <section className={styles.insightPlaceholder} aria-label="Summary insight">
              <div className={styles.sectionHeading}><h2>Summary insight</h2><span>{selectedTitle}</span></div>
              <div className={styles.insightSections}>
                <div className={styles.insightPrimary}>
                  {latestInsightMonth && <div className={styles.insightLead}>
                    <div className={styles.insightLeadTop}>
                      <span className={styles.insightLeadIcon}><ClipboardX size={19} strokeWidth={1.9} aria-hidden="true" /></span>
                      <span>ช่างที่ยังไม่พบการปิดงานถึงสิ้น {monthName(latestInsightMonth.month)} {latestInsightMonth.month.slice(0, 4)}</span>
                    </div>
                    <strong>{number(latestInsightMonth.withoutWork)} <small>กองงาน</small></strong>
                    {latestInsightMonth.change !== null && <span>
                      {latestInsightMonth.change < 0 ? `ลดลง ${number(-latestInsightMonth.change)}` : latestInsightMonth.change > 0 ? `เพิ่มขึ้น ${number(latestInsightMonth.change)}` : 'เท่าเดิม'} จากเดือนก่อน
                    </span>}
                  </div>}
                  <div className={styles.insightPanel}>
                    <h3><span className={styles.insightIcon}><CalendarDays size={16} strokeWidth={2} aria-hidden="true" /></span>รายเดือน <small>ยอดสะสมถึงสิ้นเดือน</small></h3>
                    {insights?.months.length ? <ul className={styles.insightList}>
                      {insights.months.map(item => <li key={item.month} className={styles.insightRow}>
                        <span>{monthName(item.month)} {item.month.slice(0, 4)}</span>
                        <strong>{number(item.withoutWork)} กองงาน</strong>
                      </li>)}
                    </ul> : <p className={styles.insightEmpty}>ยังไม่มีข้อมูลรายเดือน</p>}
                  </div>
                </div>
                <div className={styles.insightPanel}>
                  <h3><span className={styles.insightIcon}><MapPin size={16} strokeWidth={2} aria-hidden="true" /></span>ไม่มีการปิดงานรายพื้นที่ <small>{month || 'ทุกเดือน'}</small></h3>
                  {insights?.regions.length ? <ul className={styles.insightRegionGrid}>
                    {insights.regions.map(region => <li key={region.rbm} className={styles.insightRow}>
                      <span>{region.rbm}</span><strong>{number(region.withoutWork)} กองงาน</strong>
                    </li>)}
                  </ul> : <p className={styles.insightEmpty}>ยังไม่มีข้อมูลพื้นที่</p>}
                </div>
                <div className={styles.insightPanel}>
                  <h3><span className={styles.insightIcon}><Building2 size={16} strokeWidth={2} aria-hidden="true" /></span>5 บริษัทที่มีช่างไม่มีการปิดงานมากที่สุด <small>{month || 'ทุกเดือน'}</small></h3>
                  {insights?.companies.length ? <ul className={styles.insightCompanies}>
                    {insights.companies.map(company => <li key={company.name}>
                      <span>{company.name}</span><strong>{number(company.withoutWork)} กองงาน</strong>
                    </li>)}
                  </ul> : <p className={styles.insightEmpty}>ยังไม่มีบริษัทที่พบช่างไม่มีการปิดงาน</p>}
                  <p className={styles.insightFootnote}>อ้างอิงชื่อบริษัทจาก Depot Name{insights?.unknownCompanyCount ? ` · ไม่ระบุชื่อ ${number(insights.unknownCompanyCount)} กองงาน` : ''}</p>
                </div>
              </div>
            </section>
          </div>

          <div className={styles.charts}>
            <section className={styles.regionChart}>
              <div className={styles.sectionHeading}><h2>ช่างที่พบปิดงาน / ไม่พบการปิดงานงาน รายพื้นที่</h2></div>
              <div className={styles.legend}><span><i style={{ background: COLORS.withWork }} />พบปิดงาน</span><span><i style={{ background: COLORS.withoutWork }} />ไม่พบการปิดงาน</span>{data.regions.some(region => region.pending > 0) && <span><i style={{ background: COLORS.pending }} />รอเปรียบเทียบ</span>}</div>
              {chartRegions.length ? <div className={styles.barCanvas}>
                <div className={styles.barChartInner} style={{ height: Math.max(310, chartRegions.length * 38) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartRegions} layout="vertical" margin={{ top: 8, right: 48, bottom: 8, left: 0 }} barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8ebef" />
                    <XAxis type="number" allowDecimals={false} tick={false} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="rbm" width={115} tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={value => `${number(Number(value))} ราย`} contentStyle={{ borderRadius: 6, fontSize: 13 }} />
                    <Bar dataKey="withWork" name="พบปิดงาน" stackId="technicians" fill={COLORS.withWork} isAnimationActive={false}>
                      <LabelList dataKey="withWorkLabel" position="center" fill="#fff" fontSize={10} fontWeight={600} />
                    </Bar>
                    <Bar dataKey="withoutWork" name="ไม่พบการปิดงาน" stackId="technicians" fill={COLORS.withoutWork} isAnimationActive={false}>
                      <LabelList dataKey="withoutWorkLabel" position="center" fill="#fff" fontSize={10} fontWeight={600} />
                    </Bar>
                    <Bar dataKey="pending" name="รอเปรียบเทียบ" stackId="technicians" fill={COLORS.pending} isAnimationActive={false}>
                      <LabelList dataKey="totalLabel" position="right" fill="#374151" fontSize={11} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </div> : <div className={styles.empty}>ไม่พบข้อมูลช่าง</div>}
            </section>
            <section className={styles.coverageChart}>
              <div className={styles.sectionHeading}><h2>สัดส่วนช่างที่พบปิดงาน / ไม่พบการปิดงาน</h2></div>
              <div className={styles.donutCanvas}>
                {pieData.length > 0 && <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="88%" startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                      {pieData.map(item => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip formatter={value => `${number(Number(value))} ราย`} />
                  </PieChart>
                </ResponsiveContainer>}
                <div className={styles.donutLabel}><strong>{percent(data.summary.coverage)}</strong><span>ช่างที่พบปิดงาน</span></div>
              </div>
              <dl className={styles.breakdown}>
                <div><dt><i style={{ background: COLORS.withWork }} />พบปิดงาน</dt><dd>{number(data.summary.withWork)} ราย</dd></div>
                <div><dt><i style={{ background: COLORS.withoutWork }} />ไม่พบการปิดงาน</dt><dd>{number(data.summary.withoutWork)} ราย</dd></div>
                {data.summary.pending > 0 && <div><dt><i style={{ background: COLORS.pending }} />รอเปรียบเทียบ</dt><dd>{number(data.summary.pending)} ราย</dd></div>}
              </dl>
            </section>
          </div>

          <section className={styles.section}>
            <div className={styles.sectionHeading}><h2>ตารางสรุปการปิดงานรายพื้นที่ RBM</h2><span>{number(data.regions.length)} พื้นที่</span></div>
            <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="ตารางสรุปการปิดงานรายพื้นที่ RBM">
              <table className={`${styles.table} ${styles.regionalTable}`}>
                <thead><tr><th scope="col">RBM</th><th scope="col">จำนวนกองงานทั้งหมด</th><th scope="col">จำนวนที่ปิดงาน</th><th scope="col">จำนวนที่ไม่มีการปิดงาน</th><th scope="col">สัดส่วนที่พบปิดงาน</th><th scope="col">งานติดตั้ง</th><th scope="col">งานซ่อม</th><th scope="col">จำนวนรวมที่ปิดงาน</th></tr></thead>
                <tbody>{data.regions.map(region => <tr key={region.rbm} className={rbm === region.rbm ? styles.selectedRow : undefined}>
                  <th scope="row"><button className={styles.regionLink} type="button" onClick={() => selectRegion(region.rbm)} aria-pressed={rbm === region.rbm}>{region.rbm}</button></th>
                  <td>{number(region.total)}</td>
                  <td><button className={styles.greenLink} type="button" onClick={() => selectRegion(region.rbm, 'with_work')} aria-label={`จำนวนที่ปิดงาน ${region.rbm}`}>{number(region.withWork)}</button></td>
                  <td><button className={styles.redLink} type="button" onClick={() => selectRegion(region.rbm, 'without_work')} aria-label={`จำนวนที่ไม่มีการปิดงาน ${region.rbm}`}>{number(region.withoutWork)}</button></td>
                  <td><div className={styles.coverageCell}><meter min={0} max={100} value={region.coverage ?? 0} aria-label={`สัดส่วนที่พบปิดงาน ${region.rbm}`} /><span>{percent(region.coverage)}</span></div></td>
                  <td>{number(region.installCount)}</td><td>{number(region.repairCount)}</td><td>{number(region.jobCount)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}><h2>ตารางสรุปการปิดงานรายพื้นที่ตาม Provider</h2><button className={styles.exportButton} type="button" onClick={exportProviderExcel} disabled={providerExporting || busy || visibleDepots.length === 0} aria-label="Export Excel ตาราง Provider"><Download size={17} />{providerExporting ? 'กำลังส่งออก...' : 'Export Excel'}</button></div>
            {providerExportError && <p className={styles.error} role="alert">{providerExportError}</p>}
            <div className={`${styles.tableScroll} ${styles.depotTableScroll}`} tabIndex={0} role="region" aria-label="ตารางสรุปการปิดงานรายพื้นที่ตาม Provider">
              <table className={`${styles.table} ${styles.depotTable}`}>
                <thead><tr><th scope="col">RBM</th><th scope="col">Depot</th><th scope="col">Depot Name</th><th scope="col">จำนวนกองงานทั้งหมด</th><th scope="col">จำนวนที่ปิดงาน</th><th scope="col">จำนวนที่ไม่มีการปิดงาน</th><th scope="col">สัดส่วนที่พบปิดงาน</th><th scope="col">งานติดตั้ง</th><th scope="col">งานซ่อม</th><th scope="col">จำนวนรวมที่ปิดงาน</th></tr></thead>
                <tbody>{visibleDepots.map(depot => {
                  const key = JSON.stringify([depot.rbm, depot.depotCode, depot.depotName]);
                  const expanded = expandedDepots.has(key);
                  const detailId = `depot-${encodeURIComponent(key)}`;
                  return <Fragment key={key}><tr className={styles.depotRow} onClick={() => toggleDepot(key)}>
                  <td>{depot.rbm}</td>
                  <td className={styles.idCell}><button type="button" className={styles.depotToggle} aria-expanded={expanded} aria-controls={detailId} aria-label={`ช่างที่ไม่พบงาน ${depot.depotCode} ${depot.rbm}`} onClick={event => { event.stopPropagation(); toggleDepot(key); }}>
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}{depot.depotCode}
                  </button></td>
                  <td>{depot.depotName}</td>
                  <td>{number(depot.total)}</td>
                  <td className={styles.greenValue}>{number(depot.withWork)}</td>
                  <td className={styles.redValue}>{number(depot.withoutWork)}</td>
                  <td><div className={styles.coverageCell}><meter min={0} max={100} value={depot.coverage ?? 0} aria-label={`สัดส่วนที่พบปิดงาน ${depot.depotCode}`} /><span>{percent(depot.coverage)}</span></div></td>
                  <td>{number(depot.installCount)}</td><td>{number(depot.repairCount)}</td><td>{number(depot.jobCount)}</td>
                </tr>
                {expanded && <tr className={styles.depotDetails} id={detailId}><td colSpan={10}>
                  {depot.withoutWorkTechnicians.length > 0 ? <table className={styles.depotTechnicians} aria-label={`ช่างที่ไม่พบงาน ${depot.depotCode}`}>
                     <thead><tr><th scope="col">รหัสพนักงาน</th><th scope="col">ชื่อ</th><th scope="col">ประเภทงาน</th><th scope="col">ประเภทการรับงาน</th></tr></thead>
                     <tbody>{depot.withoutWorkTechnicians.map(technician => <tr key={technician.techId}>
                       <td>{technician.techId}</td><td>{technician.fullName}</td><td>{technician.typeOfWork || '-'}</td><td>{technician.jobAcceptType || '-'}</td>
                     </tr>)}</tbody>
                  </table> : <div className={styles.depotEmpty}>ไม่มีช่างที่ไม่พบงานใน Depot นี้</div>}
                </td></tr>}
                </Fragment>;
                })}</tbody>
              </table>
              {visibleDepots.length === 0 && <div className={styles.empty}>ไม่พบข้อมูล Depot ในพื้นที่ที่เลือก</div>}
            </div>
          </section>

          <section className={styles.section} aria-label="ตารางรายละเอียดการปิดงาน-ไม่ปิดงานของช่าง">
            <div className={styles.sectionHeading}><h2>ตารางรายละเอียดการปิดงาน-ไม่ปิดงานของช่าง</h2><span>{selectedTitle}</span></div>
             <div className={styles.tableControls}>
               <div className={styles.statusFilters} role="group" aria-label="เลือกข้อมูลการปิดงานของช่าง">
                 {DETAIL_FILTERS.map(({ value, label, Icon }) => <button key={value} type="button" className={`${styles.statusFilter} ${styles[`filter_${value}`]}`} aria-pressed={status === value} disabled={loading} onClick={() => { setStatus(value); setPage(1); }}>
                   <Icon size={19} aria-hidden="true" /><span>{label}</span>
                 </button>)}
               </div>
              <button className={styles.exportButton} type="button" onClick={exportExcel} disabled={exporting || busy || data.pagination.total === 0}><Download size={17} />{exporting ? 'กำลังส่งออก...' : 'Export Excel'}</button>
            </div>
            {exportError && <p className={styles.error} role="alert">{exportError}</p>}
            <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="ตารางรายละเอียดการปิดงาน-ไม่ปิดงานของช่าง">
              <table className={`${styles.table} ${styles.detailTable}`}>
                <thead>
                  <tr>{DETAIL_HEADINGS.map(label => <th key={label} scope="col" rowSpan={workPeriods.length ? 3 : 1}>{label}</th>)}
                    <th className={styles.trendHeader} scope="col" rowSpan={workPeriods.length ? 3 : 1}>Trend</th>
                    {workPeriods.length > 0 && <th className={styles.weekHeader} scope="colgroup" colSpan={workPeriods.length}>จำนวน ปิดงาน/ไม่ปิดงาน</th>}
                  </tr>
                  {workPeriods.length > 0 && <>
                    <tr>{workMonths.map(periodMonth => <th className={styles.weekHeader} scope="colgroup" key={periodMonth} colSpan={workPeriods.filter(period => period.month === periodMonth).length}>{periodMonth}</th>)}</tr>
                    <tr>{workPeriods.map(period => <th className={styles.weekHeader} scope="col" key={`${period.month}-${period.weekStart}`} title={`${period.weekStart} - ${period.weekEnd}`}>Week {period.weekNumber}</th>)}</tr>
                  </>}
                </thead>
                <tbody>{data.rows.map((row, index) => {
                  const weeklyCounts = workPeriods.map(period => row.weeklyJobs?.find(week => week.month === period.month && week.weekStart === period.weekStart)?.jobCount ?? 0);
                  return <tr key={`${row.techId ?? 'missing'}-${index}`}>
                    <td className={styles.idCell}>{row.techId ?? '-'}</td><td>{row.fullName}</td><td>{row.rbm}</td><td>{row.depotCode || '-'}</td><td>{row.depotName || '-'}</td><td><span className={`${styles.badge} ${styles[row.workStatus]}`}>{WORK_LABELS[row.workStatus]}</span></td>
                    <td className={styles.trendCell}><TrendSparkline values={weeklyCounts} labels={workPeriods.map(period => `${period.month} Week ${period.weekNumber}`)} /></td>
                    {workPeriods.map((period, periodIndex) => {
                      const count = weeklyCounts[periodIndex];
                      return <td key={`${period.month}-${period.weekStart}`} className={styles.weekCell} style={{ backgroundColor: weeklyJobBackground(count), color: count > 0 ? '#18583c' : '#a52839' }} title={`${period.month} · Week ${period.weekNumber} · ${period.weekStart} - ${period.weekEnd}`} aria-label={`${period.month} Week ${period.weekNumber}: ${number(count)} งาน`}>{number(count)}</td>;
                    })}
                  </tr>;
                })}</tbody>
              </table>
              {data.rows.length === 0 && <div className={styles.empty}>{data.dataset.totalRows === 0 && status === 'without_work' ? 'ยังไม่มีข้อมูล Allconnect สำหรับระบุช่างที่ไม่พบงาน' : 'ไม่พบช่างตามเงื่อนไขที่เลือก'}</div>}
            </div>
            <div className={styles.pagination}>
              <span>{data.pagination.total > 0 ? `${number((data.pagination.page - 1) * data.pagination.pageSize + 1)}–${number(Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total))}` : '0'} จาก {number(data.pagination.total)} ราย</span>
              <label>แถวต่อหน้า<select aria-label="แถวต่อหน้า" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
              <div className={styles.pageButtons}>
                <button className={styles.iconButton} type="button" title="หน้าก่อนหน้า" aria-label="หน้าก่อนหน้า" disabled={busy || data.pagination.page <= 1} onClick={() => setPage(data.pagination.page - 1)}><ChevronLeft size={18} /></button>
                <span>หน้า {number(data.pagination.page)} / {number(data.pagination.totalPages)}</span>
                <button className={styles.iconButton} type="button" title="หน้าถัดไป" aria-label="หน้าถัดไป" disabled={busy || data.pagination.page >= data.pagination.totalPages} onClick={() => setPage(data.pagination.page + 1)}><ChevronRight size={18} /></button>
              </div>
            </div>
          </section>

          <footer className={styles.dataNotes}>
            <span>รหัสผู้รับงานที่ไม่พบในทะเบียนช่าง <strong>{number(data.dataset.unknownHandlers)}</strong> รหัส</span>
            <span>รายการงานที่ไม่มีรหัสผู้รับงาน <strong>{number(data.dataset.missingHandlerRows)}</strong> รายการ</span>
            {data.dataset.missingTechIds > 0 && <span>ทะเบียนช่างที่ไม่มีรหัส <strong>{number(data.dataset.missingTechIds)}</strong> ราย</span>}
            {data.dataset.duplicateTechIds > 0 && <span>ทะเบียนรหัสซ้ำ ใช้ข้อมูลแก้ไขล่าสุด <strong>{number(data.dataset.duplicateTechIds)}</strong> แถว</span>}
            {data.dataset.invalidJobRows > 0 && <span>ข้อมูลจำนวนงานที่ไม่ถูกต้อง <strong>{number(data.dataset.invalidJobRows)}</strong> แถว</span>}
          </footer>
        </div>
      )}
    </div>
  );
}
