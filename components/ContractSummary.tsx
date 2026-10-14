'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, RefreshCw, Search } from 'lucide-react';
import type { ContractRow } from '@/lib/contractDashboard';
import { buildContractPortfolio, contractSources, portfolioCounts, sourceLabels, type ContractSource } from '@/lib/contractSummary';
import styles from './ContractSummary.module.css';

type Datasets = Record<ContractSource, ContractRow[]>;
const number = (value: number) => value.toLocaleString('th-TH');
const groupStatuses = ['Complete', 'On Process', 'Cancel'] as const;

export default function ContractSummary() {
  const [datasets, setDatasets] = useState<Datasets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [typeCount, setTypeCount] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all(contractSources.map(async contractSource => {
      const response = await fetch(`/api/contract-c?source=${contractSource}`, { signal: controller.signal, cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `โหลดข้อมูล ${sourceLabels[contractSource]} ไม่สำเร็จ`);
      return [contractSource, body.rows as ContractRow[]] as const;
    })).then(entries => {
      if (!controller.signal.aborted) setDatasets(Object.fromEntries(entries) as Datasets);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลสัญญาไม่สำเร็จ');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  const companies = useMemo(() => datasets ? buildContractPortfolio(datasets) : [], [datasets]);
  const counts = useMemo(() => portfolioCounts(companies), [companies]);
  const combinations = useMemo(() => {
    const combinations = new Map<string, number>();
    for (const company of companies.filter(item => item.matchable)) {
      const key = company.sources.map(item => sourceLabels[item]).join(' + ');
      combinations.set(key, (combinations.get(key) ?? 0) + 1);
    }
    return [...combinations].sort((a, b) => b[1] - a[1]);
  }, [companies]);
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('th');
    return companies.filter(company =>
      (!typeCount || (company.matchable && company.sources.length === Number(typeCount))) &&
      (!source || company.sources.includes(source as ContractSource)) &&
      (!status || company.contracts.some(contract => contract.row.group_status?.trim().toLowerCase() === status.toLowerCase())) &&
      (!search || [company.name, company.registration, ...company.contracts.flatMap(contract => Object.values(contract.row))]
        .some(value => String(value ?? '').toLocaleLowerCase('th').includes(search))));
  }, [companies, query, typeCount, source, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * 25, current * 25);

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
    setExpanded(null);
  }

  async function exportExcel() {
    setExporting(true);
    setExportError('');
    try {
      const XLSX = await import('xlsx');
      const headings = ['เลขทะเบียนบริษัท', 'ชื่อคู่สัญญา', 'ประเภทสัญญา', 'เลขที่สัญญา', 'สถานะสัญญา', 'กลุ่มสถานะ', 'สถานะ Active', 'วันเริ่มสัญญา', 'วันสิ้นสุดสัญญา', 'เหตุผล'];
      const rows = filtered.flatMap(company => company.contracts.map(({ source: contractSource, row }) => [
        company.registration, company.name, sourceLabels[contractSource], row.contract_no ?? '', row.contract_status ?? '',
        row.group_status ?? '', row.active_status ?? '', row.start_contract ?? '', row.end_contract ?? '', row.installation_status ?? '',
      ]));
      const sheet = XLSX.utils.aoa_to_sheet([headings, ...rows]);
      sheet['!cols'] = [20, 42, 16, 28, 24, 18, 18, 18, 18, 38].map(wch => ({ wch }));
      sheet['!autofilter'] = { ref: sheet['!ref']! };
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Summary Contract');
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
      XLSX.writeFile(workbook, `contract-summary-${date}.xlsx`);
    } catch {
      setExportError('ส่งออก Excel ไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally { setExporting(false); }
  }

  return <div className={styles.summary} aria-busy={loading}>
    <header className={styles.header}>
      <h1>Summary Contract</h1>
      <button type="button" onClick={() => setRevision(value => value + 1)} disabled={loading} title="รีเฟรชข้อมูล" aria-label="รีเฟรชข้อมูล"><RefreshCw size={18} /></button>
    </header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {loading ? <p role="status">กำลังโหลดข้อมูลสัญญา...</p> : !error && datasets && <>
      <div className={styles.metrics}>
        <div className={styles.metric}><span>บริษัทที่มีเลขทะเบียน</span><strong>{number(counts.companies)}</strong><small>จับคู่จากเลขทะเบียนบริษัท</small></div>
        <div className={styles.metric}><span>รับงานครบ 3 ประเภท</span><strong>{number(counts.byTypeCount[2])}</strong><small>Track C + Solar + Corporate</small></div>
        <div className={styles.metric}><span>รับงาน 2 ประเภท</span><strong>{number(counts.byTypeCount[1])}</strong><small>บริษัท</small></div>
        <div className={styles.metric}><span>รับงาน 1 ประเภท</span><strong>{number(counts.byTypeCount[0])}</strong><small>บริษัท</small></div>
      </div>
      <section className={styles.band} aria-label="ภาพรวมรายประเภทสัญญา">
        <h2>ภาพรวมรายประเภทสัญญา</h2>
        <div className={styles.sourceGrid}>{contractSources.map(contractSource => {
          const rows = datasets[contractSource];
          return <div className={styles.sourceItem} key={contractSource}>
            <h3>{sourceLabels[contractSource]}</h3><strong>{number(rows.length)} <small>สัญญา</small></strong>
            <div className={styles.sourceStatuses}>{groupStatuses.map(group => <span key={group}>{group} <b>{number(rows.filter(row => row.group_status?.trim().toLowerCase() === group.toLowerCase()).length)}</b></span>)}</div>
          </div>;
        })}</div>
      </section>
      <section className={styles.band} aria-label="รูปแบบงานที่รับ">
        <h2>รูปแบบงานที่รับ</h2>
        <div className={styles.combinations}>{combinations.map(([label, count]) =>
          <div className={styles.combination} key={label}><span>{label}</span><div className={styles.bar}><div style={{ width: `${counts.companies ? count / counts.companies * 100 : 0}%` }} /></div><strong>{number(count)}</strong></div>)}</div>
      </section>
      <section className={styles.band} aria-label="รายชื่อคู่สัญญาทั้งหมด">
        <div className={styles.sectionHeader}><h2>คู่สัญญารายบริษัท</h2><span>{number(filtered.length)} รายการ</span></div>
        <div className={styles.filters}>
          <label className={styles.search}><Search size={17} aria-hidden="true" /><input aria-label="ค้นหาคู่สัญญา" placeholder="ชื่อบริษัท เลขทะเบียน เลขที่สัญญา…" value={query} onChange={event => updateFilter(setQuery, event.target.value)} /></label>
          <label>จำนวนประเภทงาน<select value={typeCount} onChange={event => updateFilter(setTypeCount, event.target.value)}><option value="">ทั้งหมด</option><option value="1">1 ประเภท</option><option value="2">2 ประเภท</option><option value="3">3 ประเภท</option></select></label>
          <label>ประเภทสัญญา<select value={source} onChange={event => updateFilter(setSource, event.target.value)}><option value="">ทั้งหมด</option>{contractSources.map(item => <option value={item} key={item}>{sourceLabels[item]}</option>)}</select></label>
          <label>กลุ่มสถานะ<select value={status} onChange={event => updateFilter(setStatus, event.target.value)}><option value="">ทั้งหมด</option>{groupStatuses.map(item => <option value={item} key={item}>{item}</option>)}</select></label>
          <button className={styles.export} type="button" onClick={exportExcel} disabled={exporting || !filtered.length}><Download size={17} aria-hidden="true" />{exporting ? 'กำลังส่งออก...' : 'Export Excel'}</button>
        </div>
        {counts.missingRegistration > 0 && <p className={styles.note}>ไม่พบเลขทะเบียนบริษัท {number(counts.missingRegistration)} รายการ แสดงแยกไว้ในตาราง</p>}
        {exportError && <p role="alert" className={styles.error}>{exportError}</p>}
        <div className={styles.tableWrap} role="region" tabIndex={0} aria-label="สรุปสัญญารายบริษัท"><table>
          <thead><tr><th scope="col">ชื่อคู่สัญญา</th><th scope="col">เลขทะเบียนบริษัท</th><th scope="col">ประเภทงานที่รับ</th><th scope="col">จำนวนประเภท</th><th scope="col">จำนวนสัญญา</th><th scope="col">กลุ่มสถานะ</th><th scope="col">รายละเอียด</th></tr></thead>
          <tbody>{visible.map(company => <Fragment key={company.key}><tr>
            <td className={styles.name}>{company.name}</td><td className={styles.numeric}>{company.registration || 'ไม่ระบุ'}</td>
            <td><div className={styles.tags}>{company.sources.map(item => <span key={item} className={styles.tag}>{sourceLabels[item]}</span>)}</div></td>
            <td className={styles.numeric}>{company.matchable ? company.sources.length : '-'}</td><td className={styles.numeric}>{company.contracts.length}</td>
            <td><div className={styles.tags}>{[...new Set(company.contracts.map(({ row }) => row.group_status?.trim() || 'ไม่ระบุ'))].map(group => <span className={styles.status} key={group}>{group}</span>)}</div></td>
            <td><button type="button" className={styles.expand} aria-label={`รายละเอียดสัญญา ${company.name}`} aria-expanded={expanded === company.key} onClick={() => setExpanded(previous => previous === company.key ? null : company.key)}>{expanded === company.key ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button></td>
          </tr>{expanded === company.key && <tr><td colSpan={7} className={styles.details}><div className={styles.detailGrid}>
            <div className={styles.detailHead}><span>ประเภทสัญญา</span><span>เลขที่สัญญา</span><span>สถานะสัญญา</span><span>กลุ่มสถานะ</span><span>วันเริ่ม</span><span>วันสิ้นสุด</span><span>เหตุผล</span></div>
            {company.contracts.map(({ source: contractSource, row }, index) => <div className={styles.detailRow} key={`${contractSource}-${row.uuid ?? index}`}><span>{sourceLabels[contractSource]}</span><span>{row.contract_no || '-'}</span><span>{row.contract_status || '-'}</span><span>{row.group_status || '-'}</span><span>{row.start_contract || '-'}</span><span>{row.end_contract || '-'}</span><span>{row.installation_status || '-'}</span></div>)}
          </div></td></tr>}</Fragment>)}
          {!visible.length && <tr><td colSpan={7} className={styles.empty}>ไม่พบคู่สัญญาตามเงื่อนไข</td></tr>}</tbody>
        </table></div>
        <div className={styles.pagination}><span>หน้า {current} / {pages}</span><button type="button" aria-label="หน้าก่อนหน้า" disabled={current === 1} onClick={() => { setPage(current - 1); setExpanded(null); }}><ChevronLeft size={18} /></button><button type="button" aria-label="หน้าถัดไป" disabled={current === pages} onClick={() => { setPage(current + 1); setExpanded(null); }}><ChevronRight size={18} /></button></div>
      </section>
    </>}
  </div>;
}
