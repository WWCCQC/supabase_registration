'use client';

import { Fragment, useEffect, useState } from 'react';
import { AlertCircle, Building2, CalendarDays, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ClipboardX, Download, MapPin, RefreshCw, Search, Users, X, XCircle } from 'lucide-react';
import { buildExecutiveInsights, calculateWithoutWorkCoverage, calculateWorkingDays, weeklyJobBackground, providerSummaryExportRows, formatRegionBarLabel, type CompareRow, type CompareRowsData, type CompareSummaryData, type DepotTechnician, type WorkStatus, type WorkStatusFilter } from '@/lib/allconnectCompare';
import styles from './AllconnectCompareDashboard.module.css';
import AllconnectUpload from './AllconnectUpload';
import MonthlyNoWorkChart from './MonthlyNoWorkChart';
import CompanyTypeHeatmap from './CompanyTypeHeatmap';
import TechniciansUpload from './TechniciansUpload';
import sourceStyles from './AllconnectSources.module.css';

const number = (value: number) => value.toLocaleString('th-TH');
const percent = (value: number | null) => value === null ? '-' : `${value.toFixed(1)}%`;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (value: string) => MONTH_NAMES[Number(value.slice(5, 7)) - 1] ?? value;
const WORK_LABELS: Record<WorkStatus, string> = {
  with_work: 'ปิดงาน', without_work: 'ไม่มีการปิดงาน', pending: 'รอเปรียบเทียบ',
};
const DETAIL_HEADINGS = ['RBM', 'Depot', 'Depot Name', 'รหัสช่าง', 'ชื่อช่าง', 'จำนวนวันที่เข้าทำงาน', 'สถานะการปิดงาน'];
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

async function getCompare<T>(params: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/allconnect-compare?${params}`, { cache: 'no-store', signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'โหลดข้อมูลไม่สำเร็จ');
  return body;
}

type DepotTechniciansState = { loading: boolean; error?: string; items?: DepotTechnician[] };

export default function AllconnectCompareDashboard() {
  // Summary (cards/charts/region & depot tables) reloads only on month/RBM change;
  // the detail table reloads on its own when page, status or search changes.
  const [data, setData] = useState<CompareSummaryData | null>(null);
  const [rowsData, setRowsData] = useState<CompareRowsData | null>(null);
  const [rbm, setRbm] = useState('');
  const [month, setMonth] = useState('');
  const [status, setStatus] = useState<WorkStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [revision, setRevision] = useState(0);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [error, setError] = useState('');
  const [rowsError, setRowsError] = useState('');
  const [depotTechnicians, setDepotTechnicians] = useState<Record<string, DepotTechniciansState>>({});
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [providerExporting, setProviderExporting] = useState(false);
  const [providerExportError, setProviderExportError] = useState('');
  const [expandedDepots, setExpandedDepots] = useState<Set<string>>(new Set());

  function loadDepotTechnicians(key: string, depot: CompareSummaryData['depots'][number]) {
    if (depot.withoutWorkTechnicians) {
      // Legacy all-in-one response already contains the list.
      setDepotTechnicians(previous => ({ ...previous, [key]: { loading: false, items: depot.withoutWorkTechnicians } }));
      return;
    }
    setDepotTechnicians(previous => ({ ...previous, [key]: { loading: true } }));
    const params = new URLSearchParams({ view: 'depot', rbm: depot.rbm, depotCode: depot.depotCode, depotName: depot.depotName, month });
    getCompare<{ technicians: DepotTechnician[] }>(params)
      .then(result => setDepotTechnicians(previous => ({ ...previous, [key]: { loading: false, items: result.technicians } })))
      .catch(cause => setDepotTechnicians(previous => ({
        ...previous, [key]: { loading: false, error: cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ' },
      })));
  }

  function toggleDepot(key: string, depot: CompareSummaryData['depots'][number]) {
    const expanding = !expandedDepots.has(key);
    setExpandedDepots(previous => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    const cached = depotTechnicians[key];
    if (expanding && (!cached || cached.error)) loadDepotTechnicians(key, depot);
  }

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setSummaryLoading(true);
    setError('');
    // Depot technician lists depend on the month and on uploaded data.
    setExpandedDepots(new Set());
    setDepotTechnicians({});
    const params = new URLSearchParams({ view: 'summary', rbm, month });
    getCompare<CompareSummaryData>(params, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ');
      })
      .finally(() => { if (!controller.signal.aborted) setSummaryLoading(false); });
    return () => controller.abort();
  }, [rbm, month, revision]);

  useEffect(() => {
    const controller = new AbortController();
    setRowsLoading(true);
    setRowsError('');
    const params = new URLSearchParams({ view: 'rows', rbm, month, status, q: query, page: String(page), pageSize: String(pageSize) });
    getCompare<CompareRowsData>(params, controller.signal)
      .then(result => { if (!controller.signal.aborted) setRowsData(result); })
      .catch(cause => {
        if (!controller.signal.aborted) setRowsError(cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ');
      })
      .finally(() => { if (!controller.signal.aborted) setRowsLoading(false); });
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
      const params = new URLSearchParams({ view: 'rows', rbm, month, status, q: query, page: '1', pageSize: '500' });
      const first = await getCompare<CompareRowsData>(params);
      const rows: CompareRow[] = [...first.rows];
      for (let next = 2; next <= first.pagination.totalPages; next++) {
        params.set('page', String(next));
        const result = await getCompare<CompareRowsData>(params);
        if (result.pagination.total !== first.pagination.total || result.dataset.updatedAt !== first.dataset.updatedAt ||
            result.dataset.techniciansUpdatedAt !== first.dataset.techniciansUpdatedAt) {
          throw new Error('ข้อมูลมีการเปลี่ยนแปลงระหว่างส่งออก กรุณาลองอีกครั้ง');
        }
        rows.push(...result.rows);
      }
      const XLSX = await import('xlsx');
      const headings = [...DETAIL_HEADINGS, ...first.dataset.workPeriods.map(period => `${period.month} Week ${period.weekNumber}`)];
      const worksheet = XLSX.utils.aoa_to_sheet([headings, ...rows.map(row => [
        row.rbm, row.depotCode, row.depotName,
        row.techId ?? '', row.fullName, calculateWorkingDays(row.cardRegisterDate ?? '') ?? '', WORK_LABELS[row.workStatus], ...first.dataset.workPeriods.map(period => row.weeklyJobs.find(week => week.month === period.month && week.weekStart === period.weekStart)?.jobCount ?? 0),
      ])]);
      worksheet['!cols'] = headings.map((_, index) => ({ wch: [2, 4].includes(index) ? 32 : 20 }));
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

  const chartMonths = data?.monthly?.map(item => ({
    ...item,
    withoutWorkLabel: item.withoutWork > 0 ? formatRegionBarLabel(item.withoutWork, item.total) : '',
  })) ?? [];
  const monthlyTypes = data?.monthlyByCompanyType ?? [];
  const insights = data ? buildExecutiveInsights(data, rbm) : null;
  const latestInsightMonth = insights?.months.at(-1);
  const visibleDepots = data?.depots.filter(depot => !rbm || depot.rbm === rbm) ?? [];
  const selectedTitle = rbm || 'ทุกพื้นที่ RBM';
  const staleSearch = query !== search.trim();
  const loading = summaryLoading || rowsLoading;
  const rowsBusy = rowsLoading || staleSearch;
  const busy = loading || staleSearch;
  const workPeriods = rowsData?.dataset.workPeriods ?? [];
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
          {busy ? 'กำลังโหลดข้อมูล...' : error || rowsError ? 'โหลดไม่สำเร็จ' : null}
        </div>
      </div>

      {error && <div className={styles.error} role="alert"><AlertCircle size={20} /><span>{error}</span><button type="button" onClick={() => setRevision(value => value + 1)}>ลองอีกครั้ง</button></div>}
      {data?.dataset.totalRows === 0 && !error && <div className={styles.notice} role="status">ยังไม่มีข้อมูล Allconnect สำหรับเปรียบเทียบ ช่างจะแสดงสถานะ “รอเปรียบเทียบ” จนกว่าจะนำเข้าข้อมูล</div>}

      {(!data || error) ? (
        !error && <div className={styles.initialLoading}>กำลังคำนวณข้อมูลช่างและงานติดตั้ง...</div>
      ) : (
        <div className={summaryLoading ? styles.updating : undefined} aria-busy={summaryLoading}>
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
              {chartMonths.length ? <MonthlyNoWorkChart months={chartMonths} selectedMonth={month} onSelectMonth={value => {
                setMonth(previous => previous === value ? '' : value);
                setPage(1);
              }} /> : <><div className={styles.sectionHeading}><h2>จำนวนช่างที่ไม่พบการปิดงานรายเดือน (กองงาน)</h2></div><div className={styles.empty}>{data.monthly ? 'ยังไม่มีข้อมูลรายเดือน' : 'ยังไม่ได้อัปเดตฟังก์ชันฐานข้อมูลสำหรับข้อมูลรายเดือน'}</div></>}
            </section>
            <section className={styles.companyTypeChart} aria-label="จำนวนช่างที่ไม่พบการปิดงานรายเดือน แยกตามประเภทช่าง">
              {chartMonths.length && monthlyTypes.length ? <CompanyTypeHeatmap months={chartMonths} items={monthlyTypes} selectedMonth={month} onSelectMonth={value => {
                setMonth(previous => previous === value ? '' : value);
                setPage(1);
              }} /> : <><div className={styles.sectionHeading}><h2>จำนวนช่างที่ไม่พบการปิดงานรายเดือน แยกตามประเภทช่าง</h2></div><div className={styles.empty}>{data.monthlyByCompanyType ? 'ยังไม่มีข้อมูลประเภทช่างที่ไม่พบการปิดงาน' : 'ยังไม่ได้อัปเดตฟังก์ชันฐานข้อมูลสำหรับข้อมูลประเภทช่างรายเดือน'}</div></>}
            </section>
            </div>
            <section className={styles.insightPlaceholder} aria-label="Summary insight">
              <div className={styles.sectionHeading}><h2>Summary insight</h2>{rbm && <span>{rbm}</span>}</div>
              <div className={styles.insightTotal}>
                <div className={styles.insightTotalContent}>
                  <span className={styles.insightTotalIcon}><ClipboardX size={22} strokeWidth={1.8} aria-hidden="true" /></span>
                  <div>
                    <span className={styles.insightTotalScope}>{month ? `${monthName(month)} ${month.slice(0, 4)}` : 'ภาพรวมทุกเดือน'}</span>
                    <h3>{month ? 'ช่างที่ไม่มีการปิดงานในเดือนที่เลือก' : 'ช่างที่ไม่มีการปิดงานทุกเดือน'}</h3>
                    <p>{month ? 'ไม่พบการปิดงานในเดือนที่เลือก' : 'ไม่พบการปิดงานตลอดทุกเดือนที่มีข้อมูล'}</p>
                  </div>
                </div>
                <div className={styles.insightTotalValue}>
                  <strong>{number(data.summary.withoutWork)}</strong>
                  <span>กองงาน</span>
                </div>
              </div>
              <div className={styles.insightSections}>
                {latestInsightMonth && <div className={styles.insightLead}>
                  <div className={styles.insightLeadTop}>
                    <span className={styles.insightLeadIcon}><ClipboardX size={19} strokeWidth={1.9} aria-hidden="true" /></span>
                    <span>ช่างที่ไม่พบการปิดงานในเดือน {monthName(latestInsightMonth.month)} {latestInsightMonth.month.slice(0, 4)}</span>
                  </div>
                  <strong>{number(latestInsightMonth.withoutWork)} <small>กองงาน</small></strong>
                  {latestInsightMonth.change !== null && <span>
                    {latestInsightMonth.change < 0 ? `ลดลง ${number(-latestInsightMonth.change)}` : latestInsightMonth.change > 0 ? `เพิ่มขึ้น ${number(latestInsightMonth.change)}` : 'เท่าเดิม'} จากเดือนก่อน
                  </span>}
                </div>}
                <div className={styles.insightPanel}>
                  <h3><span className={styles.insightIcon}><CalendarDays size={16} strokeWidth={2} aria-hidden="true" /></span>รายเดือน <small>ไม่มีการปิดงานในเดือนนั้น</small></h3>
                  {insights?.months.length ? <ul className={styles.insightList}>
                    {insights.months.map(item => <li key={item.month} className={styles.insightRow}>
                      <span>{monthName(item.month)} {item.month.slice(0, 4)}</span>
                      <strong>{number(item.withoutWork)} กองงาน</strong>
                    </li>)}
                  </ul> : <p className={styles.insightEmpty}>ยังไม่มีข้อมูลรายเดือน</p>}
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

          {(() => {
            const sortedRegions = [...data.regions].sort((a, b) => (b.total || 0) - (a.total || 0));
            const totalTechs = data.summary.total || 0;
            const withWorkTotal = data.summary.withWork || 0;
            const withoutWorkTotal = data.summary.withoutWork || 0;
            const pendingTotal = data.summary.pending || 0;
            const maxRegionTotal = Math.max(...sortedRegions.map(r => r.total || 0), 1);

            const withWorkOverallPct = percent(data.summary.coverage);
            const withoutWorkOverallPct = percent(calculateWithoutWorkCoverage(withWorkTotal, withoutWorkTotal));
            const pendingOverallPct = totalTechs > 0 ? `${((pendingTotal / totalTechs) * 100).toFixed(1)}%` : '0.0%';

            const bmaRegions = sortedRegions.filter(r => r.rbm.toUpperCase().includes('BMA'));
            const upcRegions = sortedRegions.filter(r => !r.rbm.toUpperCase().includes('BMA'));
            const bmaTotal = bmaRegions.reduce((acc, r) => acc + (r.total || 0), 0);
            const upcTotal = upcRegions.reduce((acc, r) => acc + (r.total || 0), 0);
            const bmaPct = totalTechs > 0 ? ((bmaTotal / totalTechs) * 100).toFixed(1) : '0.0';
            const upcPct = totalTechs > 0 ? ((upcTotal / totalTechs) * 100).toFixed(1) : '0.0';

            const radius = 66;
            const circumference = 2 * Math.PI * radius;
            const activeTrackShare = 0.84;
            const withWorkRatio = totalTechs > 0 ? withWorkTotal / totalTechs : 0;
            const withoutWorkRatio = totalTechs > 0 ? withoutWorkTotal / totalTechs : 0;
            const pendingVisualRatio = pendingTotal > 0 ? Math.max(pendingTotal / totalTechs, 0.032) : 0;

            const withWorkArc = withWorkRatio * activeTrackShare * circumference;
            const withoutWorkArc = withoutWorkRatio * activeTrackShare * circumference;
            const pendingArc = pendingVisualRatio * circumference;

            const startGapRatio = 1 - activeTrackShare;
            const withWorkOffset = -startGapRatio * circumference;
            const withoutWorkOffset = -(startGapRatio * circumference + withWorkArc);

            return (
              <section className={styles.bentoShell} aria-label="ช่างที่พบปิดงาน / ไม่พบการปิดงานงาน รายพื้นที่">
                <header className={styles.bentoHeader}>
                  <div className={styles.bentoHeaderLeft}>
                    <div className={styles.rbmLogoBadge} aria-hidden="true">
                      RBM
                    </div>
                    <div className={styles.bentoTitleGroup}>
                      <div className={styles.bentoTitleRow}>
                        <h2 className={styles.bentoTitle}>ช่างที่พบปิดงาน / ไม่พบการปิดงานงาน รายพื้นที่</h2>
                      </div>
                    </div>
                  </div>
                </header>

                <div className={styles.bentoGrid}>
                  {/* Left Card: 1. Overall Share (สัดส่วนช่างที่พบปิดงาน / ไม่พบการปิดงาน) */}
                  <div className={styles.bentoCard}>
                    <div className={styles.bentoPanelHeader}>
                      <div>
                        <h3 className={styles.bentoPanelTitle}>1. สัดส่วนช่างที่พบปิดงาน / ไม่พบการปิดงาน</h3>
                      </div>
                    </div>

                    <div className={styles.bentoDonutWrapper}>
                      <svg className={styles.bentoDonutSvg} viewBox="0 0 176 176" role="img" aria-label="สัดส่วนช่างที่พบปิดงาน / ไม่พบการปิดงาน">
                        <circle
                          cx="88"
                          cy="88"
                          r={radius}
                          fill="none"
                          stroke="#f1f5f9"
                          strokeWidth="20"
                        />
                        {withWorkTotal > 0 && (
                          <circle
                            cx="88"
                            cy="88"
                            r={radius}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="20"
                            strokeDasharray={`${withWorkArc} ${circumference}`}
                            strokeDashoffset={withWorkOffset}
                            strokeLinecap="round"
                          />
                        )}
                        {withoutWorkTotal > 0 && (
                          <circle
                            cx="88"
                            cy="88"
                            r={radius}
                            fill="none"
                            stroke="#e11d48"
                            strokeWidth="20"
                            strokeDasharray={`${withoutWorkArc} ${circumference}`}
                            strokeDashoffset={withoutWorkOffset}
                            strokeLinecap="round"
                          />
                        )}
                        {pendingTotal > 0 && (
                          <circle
                            cx="88"
                            cy="88"
                            r={radius}
                            fill="none"
                            stroke="#64748b"
                            strokeWidth="20"
                            strokeDasharray={`${pendingArc} ${circumference}`}
                            strokeDashoffset={0}
                            strokeLinecap="round"
                          />
                        )}
                      </svg>
                      <div className={styles.bentoDonutCenter}>
                        <span className={styles.bentoDonutTotalValue}>{number(totalTechs)}</span>
                        <span className={styles.bentoDonutTotalLabel}>ช่างทั้งหมด (กองงาน)</span>
                      </div>
                    </div>

                    <div className={styles.bentoCardsStack} aria-label="สัดส่วนช่างตามสถานะการปิดงาน">
                      <div className={`${styles.bentoStatusCard} ${styles.bentoCardGreen}`}>
                        <div className={styles.bentoCardLeft}>
                          <div className={styles.bentoCardTitleRow}>
                            <span className={`${styles.bentoStatusDot} ${styles.bentoDotGreen}`} />
                            <span>พบปิดงาน</span>
                          </div>
                        </div>
                        <div className={styles.bentoCardRight}>
                          <div className={styles.bentoCardCount}>{number(withWorkTotal)} ราย</div>
                          <div className={styles.bentoCardPct}>{withWorkOverallPct}</div>
                        </div>
                      </div>

                      <div className={`${styles.bentoStatusCard} ${styles.bentoCardRed}`}>
                        <div className={styles.bentoCardLeft}>
                          <div className={styles.bentoCardTitleRow}>
                            <span className={`${styles.bentoStatusDot} ${styles.bentoDotRed}`} />
                            <span>ไม่พบการปิดงาน</span>
                          </div>
                        </div>
                        <div className={styles.bentoCardRight}>
                          <div className={styles.bentoCardCount}>{number(withoutWorkTotal)} ราย</div>
                          <div className={styles.bentoCardPct}>{withoutWorkOverallPct}</div>
                        </div>
                      </div>

                      {pendingTotal > 0 && (
                        <div className={`${styles.bentoStatusCard} ${styles.bentoCardSlate}`}>
                          <div className={styles.bentoCardLeft}>
                            <div className={styles.bentoCardTitleRow}>
                              <span className={`${styles.bentoStatusDot} ${styles.bentoDotSlate}`} />
                              <span>รอเปรียบเทียบ</span>
                            </div>
                          </div>
                          <div className={styles.bentoCardRight}>
                            <div className={styles.bentoCardCount}>{number(pendingTotal)} ราย</div>
                            <div className={styles.bentoCardPct}>{pendingOverallPct}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={styles.bentoInsightBox}>
                      <div className={styles.bentoInsightHeader}>★ KEY INSIGHT: BMA vs UPC</div>
                      <div className={styles.bentoInsightRow}>
                        <span>เขตปริมณฑล/กทม. ({bmaRegions.length} เขต BMA):</span>
                        <span className={styles.bentoInsightValueWhite}>
                          {number(bmaTotal)} ราย ({bmaPct}%)
                        </span>
                      </div>
                      <div className={styles.bentoInsightRow}>
                        <span>เขตต่างจังหวัด ({upcRegions.length} เขต UPC):</span>
                        <span className={styles.bentoInsightValueGreen}>
                          {number(upcTotal)} ราย ({upcPct}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Card: 2. Ranked Horizontal Progress (ช่างที่พบปิดงาน / ไม่พบการปิดงานงาน รายพื้นที่) */}
                  <div className={styles.bentoCard}>
                    <div className={styles.bentoPanelHeader}>
                      <div>
                        <h3 className={styles.bentoPanelTitle}>2. ช่างที่พบปิดงาน / ไม่พบการปิดงานงาน รายพื้นที่</h3>
                      </div>
                    </div>

                    {sortedRegions.length > 0 ? (
                      <div className={styles.bentoMatrixList}>
                        {sortedRegions.map((region, index) => {
                          const rank = index + 1;
                          const isBMA = region.rbm.toUpperCase().includes('BMA');
                          const isTopRank = rank <= 2 || isBMA;

                          const ww = region.withWork || 0;
                          const wo = region.withoutWork || 0;
                          const pd = region.pending || 0;
                          const rowTotal = region.total || ww + wo + pd || 1;

                          const wwRoundPct = Math.round((ww / rowTotal) * 100);
                          const woRoundPct = Math.round((wo / rowTotal) * 100);

                          const wwExactPct = ((ww / rowTotal) * 100).toFixed(1);
                          const woExactPct = ((wo / rowTotal) * 100).toFixed(1);
                          const pdExactPct = ((pd / rowTotal) * 100).toFixed(1);

                          const totalBarWidthPct = Math.max((rowTotal / maxRegionTotal) * 100, 12);
                          const shareOfAllPct = totalTechs > 0 ? ((rowTotal / totalTechs) * 100).toFixed(1) : '0.0';

                          const pdVisualSharePct = pd > 0 ? Math.max((pd / rowTotal) * 100, 4.2) : 0;
                          const remainingSharePct = 100 - pdVisualSharePct;
                          const nonPdTotal = ww + wo || 1;
                          const wwSegPct = (ww / nonPdTotal) * remainingSharePct;
                          const woSegPct = (wo / nonPdTotal) * remainingSharePct;

                          return (
                            <div
                              key={region.rbm}
                              className={`${styles.bentoMatrixRow} ${isTopRank ? styles.bentoMatrixRowTop : ''}`}
                            >
                              <div className={styles.bentoMatrixLeft}>
                                <span
                                  className={`${styles.bentoRankBadge} ${
                                    isTopRank ? styles.bentoRankBadgeTop : styles.bentoRankBadgeDefault
                                  }`}
                                >
                                  #{rank}
                                </span>
                                <div className={styles.bentoRbmInfo}>
                                  <div className={styles.bentoRbmNameRow}>
                                    <span className={styles.bentoRbmName}>{region.rbm}</span>
                                    <span
                                      className={`${styles.bentoZoneBadge} ${
                                        isBMA ? styles.bentoZoneBMA : styles.bentoZoneUPC
                                      }`}
                                    >
                                      {isBMA ? 'BMA' : 'UPC'}
                                    </span>
                                  </div>
                                  <div className={styles.bentoRbmQuickShare}>
                                    พบปิดงาน {wwRoundPct}% • ไม่พบปิดงาน {woRoundPct}%
                                  </div>
                                </div>
                              </div>

                              <div className={styles.bentoMatrixMiddle}>
                                <div className={styles.bentoProgressTrack}>
                                  <div
                                    className={styles.bentoProgressFillGroup}
                                    style={{ width: `${totalBarWidthPct}%` }}
                                  >
                                    {ww > 0 && (
                                      <div
                                        className={styles.bentoSegWithWork}
                                        style={{ width: `${wwSegPct}%` }}
                                        title={`พบปิดงาน: ${number(ww)} ราย (${wwExactPct}%)`}
                                      >
                                        {number(ww)}
                                      </div>
                                    )}
                                    {wo > 0 && (
                                      <div
                                        className={styles.bentoSegWithoutWork}
                                        style={{ width: `${woSegPct}%` }}
                                        title={`ไม่พบการปิดงาน: ${number(wo)} ราย (${woExactPct}%)`}
                                      >
                                        {number(wo)}
                                      </div>
                                    )}
                                    {pd > 0 && (
                                      <div
                                        className={styles.bentoSegPending}
                                        style={{ width: `${pdVisualSharePct}%` }}
                                        title={`รอเปรียบเทียบ: ${number(pd)} ราย (${pdExactPct}%)`}
                                      />
                                    )}
                                  </div>
                                </div>

                                <div className={styles.bentoMicroPillsRow}>
                                  <span className={styles.bentoMicroWithWork}>
                                    พบปิดงาน: {number(ww)} ({wwExactPct}%)
                                  </span>
                                  <span className={styles.bentoMicroWithoutWork}>
                                    ไม่พบการปิดงาน: {number(wo)} ({woExactPct}%)
                                  </span>
                                  {pd > 0 && (
                                    <span className={styles.bentoMicroPendingActive}>
                                      รอเปรียบเทียบ: {number(pd)} ({pdExactPct}%)
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className={styles.bentoMatrixRight}>
                                <div className={styles.bentoMatrixTotalNumber}>{number(region.total)}</div>
                                <div className={styles.bentoMatrixTotalShare}>{shareOfAllPct}% ของทั้งหมด</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={styles.empty}>ไม่พบข้อมูลช่าง</div>
                    )}
                  </div>
                </div>
              </section>
            );
          })()}

          <section className={styles.section}>
            <div className={styles.sectionHeading}><h2>ตารางสรุปการปิดงานรายพื้นที่ RBM</h2></div>
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
            <div className={styles.sectionHeading}><h2>ตารางสรุปการปิดงานรายพื้นที่ตาม Provider</h2><button className={styles.exportButton} type="button" onClick={exportProviderExcel} disabled={providerExporting || summaryLoading || visibleDepots.length === 0} aria-label="Export Excel ตาราง Provider"><Download size={17} />{providerExporting ? 'กำลังส่งออก...' : 'Export Excel'}</button></div>
            {providerExportError && <p className={styles.error} role="alert">{providerExportError}</p>}
            <div className={`${styles.tableScroll} ${styles.depotTableScroll}`} tabIndex={0} role="region" aria-label="ตารางสรุปการปิดงานรายพื้นที่ตาม Provider">
              <table className={`${styles.table} ${styles.depotTable}`}>
                <thead><tr><th scope="col">RBM</th><th scope="col">Depot</th><th scope="col">Depot Name</th><th scope="col">จำนวนกองงานทั้งหมด</th><th scope="col">จำนวนที่ปิดงาน</th><th scope="col">จำนวนที่ไม่มีการปิดงาน</th><th scope="col">สัดส่วนที่พบปิดงาน</th><th scope="col">งานติดตั้ง</th><th scope="col">งานซ่อม</th><th scope="col">จำนวนรวมที่ปิดงาน</th></tr></thead>
                <tbody>{visibleDepots.map(depot => {
                  const key = JSON.stringify([depot.rbm, depot.depotCode, depot.depotName]);
                  const expanded = expandedDepots.has(key);
                  const detailId = `depot-${encodeURIComponent(key)}`;
                  const technicians = depotTechnicians[key];
                  return <Fragment key={key}><tr className={styles.depotRow} onClick={() => toggleDepot(key, depot)}>
                  <td>{depot.rbm}</td>
                  <td className={styles.idCell}><button type="button" className={styles.depotToggle} aria-expanded={expanded} aria-controls={detailId} aria-label={`ช่างที่ไม่พบงาน ${depot.depotCode} ${depot.rbm}`} onClick={event => { event.stopPropagation(); toggleDepot(key, depot); }}>
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
                  {!technicians || technicians.loading ? <div className={styles.depotEmpty} role="status">กำลังโหลดรายชื่อช่าง...</div>
                  : technicians.error ? <div className={styles.depotEmpty} role="alert">{technicians.error} <button type="button" className={styles.textButton} onClick={() => loadDepotTechnicians(key, depot)}>ลองอีกครั้ง</button></div>
                  : technicians.items && technicians.items.length > 0 ? <table className={styles.depotTechnicians} aria-label={`ช่างที่ไม่พบงาน ${depot.depotCode}`}>
                     <thead><tr><th scope="col">รหัสพนักงาน</th><th scope="col">ชื่อ</th><th scope="col">ประเภทงาน</th><th scope="col">ประเภทการรับงาน</th></tr></thead>
                     <tbody>{technicians.items.map(technician => <tr key={technician.techId}>
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

          <section className={`${styles.section} ${rowsBusy && rowsData ? styles.updating : ''}`} aria-label="ตารางรายละเอียดการปิดงาน-ไม่ปิดงานของช่าง" aria-busy={rowsBusy}>
            <div className={styles.sectionHeading}><h2>ตารางรายละเอียดการปิดงาน-ไม่ปิดงานของช่าง</h2>{rbm && <span>{rbm}</span>}</div>
             <div className={styles.tableControls}>
               <div className={styles.statusFilters} role="group" aria-label="เลือกข้อมูลการปิดงานของช่าง">
                 {DETAIL_FILTERS.map(({ value, label, Icon }) => <button key={value} type="button" className={`${styles.statusFilter} ${styles[`filter_${value}`]}`} aria-pressed={status === value} disabled={rowsLoading} onClick={() => { setStatus(value); setPage(1); }}>
                   <Icon size={19} aria-hidden="true" /><span>{label}</span>
                 </button>)}
               </div>
              <button className={styles.exportButton} type="button" onClick={exportExcel} disabled={exporting || rowsBusy || !rowsData || rowsData.pagination.total === 0}><Download size={17} />{exporting ? 'กำลังส่งออก...' : 'Export Excel'}</button>
            </div>
            {exportError && <p className={styles.error} role="alert">{exportError}</p>}
            {rowsError && <div className={styles.error} role="alert"><AlertCircle size={20} /><span>{rowsError}</span><button type="button" onClick={() => setRevision(value => value + 1)}>ลองอีกครั้ง</button></div>}
            {!rowsData ? (!rowsError && <div className={styles.initialLoading}>กำลังโหลดตารางรายละเอียดช่าง...</div>) : <>
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
                <tbody>{rowsData.rows.map((row, index) => {
                  const workingDays = calculateWorkingDays(row.cardRegisterDate ?? '');
                  const weeklyCounts = workPeriods.map(period => row.weeklyJobs?.find(week => week.month === period.month && week.weekStart === period.weekStart)?.jobCount ?? 0);
                  return <tr key={`${row.techId ?? 'missing'}-${index}`}>
                    <td>{row.rbm}</td><td>{row.depotCode || '-'}</td><td>{row.depotName || '-'}</td><td className={styles.idCell}>{row.techId ?? '-'}</td><td>{row.fullName}</td><td className={styles.workingDaysCell} title={row.cardRegisterDate ? `วันที่ลงทะเบียน ${row.cardRegisterDate}` : undefined}>{workingDays === null ? '-' : number(workingDays)}</td><td><span className={`${styles.badge} ${styles[row.workStatus]}`}>{WORK_LABELS[row.workStatus]}</span></td>
                    <td className={styles.trendCell}><TrendSparkline values={weeklyCounts} labels={workPeriods.map(period => `${period.month} Week ${period.weekNumber}`)} /></td>
                    {workPeriods.map((period, periodIndex) => {
                      const count = weeklyCounts[periodIndex];
                      return <td key={`${period.month}-${period.weekStart}`} className={styles.weekCell} style={{ backgroundColor: weeklyJobBackground(count), color: count > 0 ? '#18583c' : '#a52839' }} title={`${period.month} · Week ${period.weekNumber} · ${period.weekStart} - ${period.weekEnd}`} aria-label={`${period.month} Week ${period.weekNumber}: ${number(count)} งาน`}>{number(count)}</td>;
                    })}
                  </tr>;
                })}</tbody>
              </table>
              {rowsData.rows.length === 0 && <div className={styles.empty}>{rowsData.dataset.totalRows === 0 && status === 'without_work' ? 'ยังไม่มีข้อมูล Allconnect สำหรับระบุช่างที่ไม่พบงาน' : 'ไม่พบช่างตามเงื่อนไขที่เลือก'}</div>}
            </div>
            <div className={styles.pagination}>
              <span>{rowsData.pagination.total > 0 ? `${number((rowsData.pagination.page - 1) * rowsData.pagination.pageSize + 1)}–${number(Math.min(rowsData.pagination.page * rowsData.pagination.pageSize, rowsData.pagination.total))}` : '0'} จาก {number(rowsData.pagination.total)} ราย</span>
              <label>แถวต่อหน้า<select aria-label="แถวต่อหน้า" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
              <div className={styles.pageButtons}>
                <button className={styles.iconButton} type="button" title="หน้าก่อนหน้า" aria-label="หน้าก่อนหน้า" disabled={rowsBusy || rowsData.pagination.page <= 1} onClick={() => setPage(rowsData.pagination.page - 1)}><ChevronLeft size={18} /></button>
                <span>หน้า {number(rowsData.pagination.page)} / {number(rowsData.pagination.totalPages)}</span>
                <button className={styles.iconButton} type="button" title="หน้าถัดไป" aria-label="หน้าถัดไป" disabled={rowsBusy || rowsData.pagination.page >= rowsData.pagination.totalPages} onClick={() => setPage(rowsData.pagination.page + 1)}><ChevronRight size={18} /></button>
              </div>
            </div>
            </>}
          </section>

          <footer className={styles.dataNotes}>
            {data.dataset.missingTechIds > 0 && <span>ทะเบียนช่างที่ไม่มีรหัส <strong>{number(data.dataset.missingTechIds)}</strong> ราย</span>}
            {data.dataset.duplicateTechIds > 0 && <span>ทะเบียนรหัสซ้ำ ใช้ข้อมูลแก้ไขล่าสุด <strong>{number(data.dataset.duplicateTechIds)}</strong> แถว</span>}
            {data.dataset.invalidJobRows > 0 && <span>ข้อมูลจำนวนงานที่ไม่ถูกต้อง <strong>{number(data.dataset.invalidJobRows)}</strong> แถว</span>}
          </footer>
        </div>
      )}
    </div>
  );
}
