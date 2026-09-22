'use client';

import { Fragment, useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Download, RefreshCw, Search, X } from 'lucide-react';
import { calculateWithoutWorkCoverage, calculateWorkingDays, formatRegionBarLabel, type CompareDashboard, type CompareRow, type WorkStatus, type WorkStatusFilter } from '@/lib/allconnectCompare';
import styles from './AllconnectCompareDashboard.module.css';
import AllconnectUpload from './AllconnectUpload';
import TechniciansUpload from './TechniciansUpload';
import sourceStyles from './AllconnectSources.module.css';

const number = (value: number) => value.toLocaleString('th-TH');
const percent = (value: number | null) => value === null ? '-' : `${value.toFixed(1)}%`;
const WORK_LABELS: Record<WorkStatus, string> = {
  with_work: 'พบงาน', without_work: 'ไม่พบงาน', pending: 'รอเปรียบเทียบ',
};
const COLORS = { withWork: '#159574', withoutWork: '#dc5966', pending: '#a1a8b3' };

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
  const [status, setStatus] = useState<WorkStatusFilter>('without_work');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
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
    const params = new URLSearchParams({ rbm, status, q: query, page: String(page), pageSize: String(pageSize) });
    getDashboard(params, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [rbm, status, query, page, pageSize, revision]);

  function selectRegion(value: string, workStatus?: WorkStatusFilter) {
    setRbm(value);
    if (workStatus) setStatus(workStatus);
    setPage(1);
  }

  async function exportExcel() {
    setExporting(true);
    setExportError('');
    try {
      const params = new URLSearchParams({ rbm, status, q: query, page: '1', pageSize: '500' });
      const first = await getDashboard(params);
      const rows: CompareRow[] = [...first.rows];
      for (let next = 2; next <= first.pagination.totalPages; next++) {
        params.set('page', String(next));
        const result = await getDashboard(params);
        if (result.pagination.total !== first.pagination.total || result.dataset.updatedAt !== first.dataset.updatedAt) {
          throw new Error('ข้อมูลมีการเปลี่ยนแปลงระหว่างส่งออก กรุณาลองอีกครั้ง');
        }
        rows.push(...result.rows);
      }
      const XLSX = await import('xlsx');
      const headings = ['รหัสช่าง', 'ชื่อช่าง', 'วันเข้าทำงาน', 'วันทำงาน', 'RBM', 'CBM', 'ผู้ให้บริการ', 'รหัสศูนย์', 'ชื่อศูนย์', 'จังหวัด', 'สถานะช่าง', 'ผลเปรียบเทียบ', 'รายการงาน'];
      const worksheet = XLSX.utils.aoa_to_sheet([headings, ...rows.map(row => [
        row.techId ?? '', row.fullName, row.cardRegisterDate, calculateWorkingDays(row.cardRegisterDate) ?? '', row.rbm, row.cbm, row.provider,
        row.depotCode, row.depotName, row.province, row.technicianStatus, WORK_LABELS[row.workStatus], row.jobCount,
      ])]);
      worksheet['!cols'] = headings.map((_, index) => ({ wch: [1, 5, 8].includes(index) ? 32 : 20 }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Technicians');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ['พื้นที่', rbm || 'ทุกพื้นที่'], ['ผลเปรียบเทียบ', status === 'all' ? 'ทั้งหมด' : WORK_LABELS[status]],
        ['คำค้นหา', query], ['ข้อมูลนำเข้าล่าสุด (เวลาไทย)', dateTime(first.dataset.importedAt)],
        ['รายการ Allconnect ทั้งหมด', first.dataset.totalRows], ['แถวที่ส่งออก', rows.length],
      ]), 'Filters');
      XLSX.writeFile(workbook, `allconnect-compare-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : 'ส่งออกไม่สำเร็จ');
    } finally { setExporting(false); }
  }

  const summary = data?.summary;
  const pieData = summary ? [
    { name: 'พบงาน', value: summary.withWork, color: COLORS.withWork },
    { name: 'ไม่พบงาน', value: summary.withoutWork, color: COLORS.withoutWork },
    { name: 'รอเปรียบเทียบ', value: summary.pending, color: COLORS.pending },
  ].filter(item => item.value > 0) : [];
  const chartRegions = data?.regions.map(region => ({
    ...region,
    withWorkLabel: region.withWork > 0 ? formatRegionBarLabel(region.withWork, region.total) : '',
    withoutWorkLabel: region.withoutWork > 0 ? formatRegionBarLabel(region.withoutWork, region.total) : '',
    totalLabel: region.total > 0 ? number(region.total) : '',
  })) ?? [];
  const visibleDepots = data?.depots.filter(depot => !rbm || depot.rbm === rbm) ?? [];
  const selectedTitle = rbm || 'ทุกพื้นที่ RBM';
  const staleSearch = query !== search.trim();
  const busy = loading || staleSearch;

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
              <li>All connect เป็นข้อมูลงานติดตั้งปัจจุบัน</li>
              <li>ข้อมูลช่าง = ตาราง allconnect_technicians</li>
              <li>type_of_work = Installation</li>
              <li>workgroup_status = หัวหน้า</li>
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
            <article className={styles.metric}><span>ช่างทั้งหมด</span><strong>{number(data.summary.total)}</strong><small>{selectedTitle}</small></article>
            <article className={`${styles.metric} ${styles.green}`}><span>ช่างที่พบงาน</span><strong>{number(data.summary.withWork)}</strong><small>พบรหัสใน Allconnect</small></article>
            <article className={`${styles.metric} ${styles.teal}`}><span>สัดส่วนช่างที่พบงาน</span><strong>{percent(data.summary.coverage)}</strong><small>{number(data.summary.jobCount)} รายการงานที่จับคู่ได้</small></article>
            <article className={`${styles.metric} ${styles.red}`}><span>ช่างที่ไม่พบงาน</span><strong>{number(data.summary.withoutWork)}</strong><small>ไม่พบรหัสในข้อมูลปัจจุบัน</small></article>
            <article className={`${styles.metric} ${styles.red}`}><span>สัดส่วนช่างที่ไม่พบงาน</span><strong>{percent(calculateWithoutWorkCoverage(data.summary.withWork, data.summary.withoutWork))}</strong><small>{number(data.summary.withoutWork)} รายจากช่างที่เปรียบเทียบได้</small></article>
          </section>
          {data.summary.pending > 0 && <p className={styles.notice}>รอเปรียบเทียบ {number(data.summary.pending)} ราย {data.dataset.totalRows > 0 ? '(ไม่มีรหัสช่าง)' : '(ยังไม่มีข้อมูล Allconnect)'}</p>}

          <div className={styles.charts}>
            <section className={styles.regionChart}>
              <div className={styles.sectionHeading}><h2>ช่างที่พบงาน / ไม่พบงาน รายพื้นที่</h2><span>ทุกพื้นที่ RBM · ราย</span></div>
              <div className={styles.legend}><span><i style={{ background: COLORS.withWork }} />พบงาน</span><span><i style={{ background: COLORS.withoutWork }} />ไม่พบงาน</span>{data.regions.some(region => region.pending > 0) && <span><i style={{ background: COLORS.pending }} />รอเปรียบเทียบ</span>}</div>
              {chartRegions.length ? <div className={styles.barCanvas}>
                <div className={styles.barChartInner} style={{ height: Math.max(310, chartRegions.length * 38) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartRegions} layout="vertical" margin={{ top: 8, right: 48, bottom: 8, left: 0 }} barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8ebef" />
                    <XAxis type="number" allowDecimals={false} tick={false} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="rbm" width={115} tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={value => `${number(Number(value))} ราย`} contentStyle={{ borderRadius: 6, fontSize: 13 }} />
                    <Bar dataKey="withWork" name="พบงาน" stackId="technicians" fill={COLORS.withWork} isAnimationActive={false}>
                      <LabelList dataKey="withWorkLabel" position="center" fill="#fff" fontSize={10} fontWeight={600} />
                    </Bar>
                    <Bar dataKey="withoutWork" name="ไม่พบงาน" stackId="technicians" fill={COLORS.withoutWork} isAnimationActive={false}>
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
              <div className={styles.sectionHeading}><h2>สัดส่วนการพบงาน</h2><span>{selectedTitle}</span></div>
              <div className={styles.donutCanvas}>
                {pieData.length > 0 && <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="88%" startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                      {pieData.map(item => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip formatter={value => `${number(Number(value))} ราย`} />
                  </PieChart>
                </ResponsiveContainer>}
                <div className={styles.donutLabel}><strong>{percent(data.summary.coverage)}</strong><span>ช่างที่พบงาน</span></div>
              </div>
              <dl className={styles.breakdown}>
                <div><dt><i style={{ background: COLORS.withWork }} />พบงาน</dt><dd>{number(data.summary.withWork)} ราย</dd></div>
                <div><dt><i style={{ background: COLORS.withoutWork }} />ไม่พบงาน</dt><dd>{number(data.summary.withoutWork)} ราย</dd></div>
                {data.summary.pending > 0 && <div><dt><i style={{ background: COLORS.pending }} />รอเปรียบเทียบ</dt><dd>{number(data.summary.pending)} ราย</dd></div>}
              </dl>
            </section>
          </div>

          <section className={styles.section}>
            <div className={styles.sectionHeading}><h2>สรุปพื้นที่ RBM</h2><span>{number(data.regions.length)} พื้นที่</span></div>
            <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="ตารางสรุปพื้นที่ RBM">
              <table className={`${styles.table} ${styles.regionalTable}`}>
                <thead><tr><th scope="col">พื้นที่ RBM</th><th scope="col">ช่างทั้งหมด</th><th scope="col">พบงาน</th><th scope="col">ไม่พบงาน</th><th scope="col">สัดส่วนที่พบงาน</th><th scope="col">จำนวนงาน</th></tr></thead>
                <tbody>{data.regions.map(region => <tr key={region.rbm} className={rbm === region.rbm ? styles.selectedRow : undefined}>
                  <th scope="row"><button className={styles.regionLink} type="button" onClick={() => selectRegion(region.rbm)} aria-pressed={rbm === region.rbm}>{region.rbm}</button></th>
                  <td>{number(region.total)}</td>
                  <td><button className={styles.greenLink} type="button" onClick={() => selectRegion(region.rbm, 'with_work')} aria-label={`ช่างที่พบงาน ${region.rbm}`}>{number(region.withWork)}</button></td>
                  <td><button className={styles.redLink} type="button" onClick={() => selectRegion(region.rbm, 'without_work')} aria-label={`ช่างที่ไม่พบงาน ${region.rbm}`}>{number(region.withoutWork)}</button></td>
                  <td><div className={styles.coverageCell}><meter min={0} max={100} value={region.coverage ?? 0} aria-label={`สัดส่วนที่พบงาน ${region.rbm}`} /><span>{percent(region.coverage)}</span></div></td>
                  <td>{number(region.jobCount)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}><h2>สรุปตาม Depot</h2><span>{number(visibleDepots.length)} Depot · {selectedTitle}</span></div>
            <div className={`${styles.tableScroll} ${styles.depotTableScroll}`} tabIndex={0} role="region" aria-label="ตารางสรุปตาม Depot">
              <table className={`${styles.table} ${styles.depotTable}`}>
                <thead><tr><th scope="col">พื้นที่ RBM</th><th scope="col">รหัส Depot</th><th scope="col">ชื่อ Depot</th><th scope="col">ช่างทั้งหมด</th><th scope="col">พบงาน</th><th scope="col">ไม่พบงาน</th><th scope="col">สัดส่วนที่พบงาน</th><th scope="col">จำนวนงาน</th></tr></thead>
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
                  <td><div className={styles.coverageCell}><meter min={0} max={100} value={depot.coverage ?? 0} aria-label={`สัดส่วนที่พบงาน ${depot.depotCode}`} /><span>{percent(depot.coverage)}</span></div></td>
                  <td>{number(depot.jobCount)}</td>
                </tr>
                {expanded && <tr className={styles.depotDetails} id={detailId}><td colSpan={8}>
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

          <section className={styles.section} aria-label="รายละเอียดช่าง">
            <div className={styles.sectionHeading}><h2>รายละเอียดช่าง <span className={styles.headingCount}>{number(data.pagination.total)} ราย</span></h2><span>{selectedTitle}</span></div>
             <div className={styles.tableControls}>
               <label>ผลเปรียบเทียบ<select value={status} onChange={event => { setStatus(event.target.value as WorkStatusFilter); setPage(1); }}><option value="without_work">ไม่พบงาน</option><option value="with_work">พบงาน</option><option value="pending">รอเปรียบเทียบ</option><option value="all">ทั้งหมด</option></select></label>
              <button className={styles.exportButton} type="button" onClick={exportExcel} disabled={exporting || busy || data.pagination.total === 0}><Download size={17} />{exporting ? 'กำลังส่งออก...' : 'Export Excel'}</button>
            </div>
            {exportError && <p className={styles.error} role="alert">{exportError}</p>}
            <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="ตารางรายละเอียดช่าง">
              <table className={`${styles.table} ${styles.detailTable}`}>
                <thead><tr><th scope="col">รหัสช่าง</th><th scope="col">ชื่อช่าง</th><th scope="col">วันเข้าทำงาน</th><th scope="col">วันทำงาน</th><th scope="col">RBM</th><th scope="col">CBM</th><th scope="col">ผู้ให้บริการ</th><th scope="col">รหัสศูนย์</th><th scope="col">ชื่อศูนย์</th><th scope="col">จังหวัด</th><th scope="col">สถานะช่าง</th><th scope="col">ผลเปรียบเทียบ</th><th scope="col">รายการงาน</th></tr></thead>
                <tbody>{data.rows.map((row, index) => {
                  const workingDays = calculateWorkingDays(row.cardRegisterDate);
                  return <tr key={`${row.techId ?? 'missing'}-${index}`}>
                    <td className={styles.idCell}>{row.techId ?? '-'}</td><td>{row.fullName}</td><td>{row.cardRegisterDate || '-'}</td><td>{workingDays === null ? '' : number(workingDays)}</td><td>{row.rbm}</td><td>{row.cbm || '-'}</td><td>{row.provider || '-'}</td><td>{row.depotCode || '-'}</td><td>{row.depotName || '-'}</td><td>{row.province || '-'}</td><td>{row.technicianStatus || '-'}</td><td><span className={`${styles.badge} ${styles[row.workStatus]}`}>{WORK_LABELS[row.workStatus]}</span></td><td>{number(row.jobCount)}</td>
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
          </footer>
        </div>
      )}
    </div>
  );
}
