'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Layers, Search } from 'lucide-react';
import { maskRegistration, type ContractRow } from '@/lib/contractDashboard';
import { buildContractPortfolio, contractOverview, contractSources, portfolioCounts, sourceLabels, type ContractSource } from '@/lib/contractSummary';
import styles from './ContractSummary.module.css';

type Datasets = Record<ContractSource, ContractRow[]>;
const number = (value: number) => value.toLocaleString('th-TH');
const groupStatuses = ['Complete', 'On Process', 'Cancel'] as const;

export default function ContractSummary({ onSelectSource }: { onSelectSource: (source: ContractSource) => void }) {
  const [datasets, setDatasets] = useState<Datasets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
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
  }, []);

  const companies = useMemo(() => datasets ? buildContractPortfolio(datasets) : [], [datasets]);
  const counts = useMemo(() => portfolioCounts(companies), [companies]);
  const overview = useMemo(() => contractOverview(companies), [companies]);
  const combinations = useMemo(() => {
    const map = new Map<string, {
      label: string;
      sources: ContractSource[];
      count: number;
    }>();
    for (const company of companies.filter(item => item.matchable)) {
      const key = company.sources.map(item => sourceLabels[item]).join(' + ');
      const existing = map.get(key) ?? {
        label: key,
        sources: company.sources,
        count: 0,
      };
      existing.count += 1;
      map.set(key, existing);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [companies]);
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('th');
    return companies.filter(company =>
      (!source || company.sources.includes(source as ContractSource)) &&
      (!status || company.contracts.some(contract => contract.row.group_status?.trim().toLowerCase() === status.toLowerCase())) &&
      (!search || [company.name, company.registration, ...company.contracts.flatMap(contract => Object.values(contract.row))]
        .some(value => String(value ?? '').toLocaleLowerCase('th').includes(search))));
  }, [companies, query, source, status]);
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
        maskRegistration(company.registration), company.name, sourceLabels[contractSource], row.contract_no ?? '', row.contract_status ?? '',
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
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {loading ? <p role="status">กำลังโหลดข้อมูลสัญญา...</p> : !error && datasets && <>
      <section className={`${styles.band} ${styles.overview}`} aria-labelledby="contract-overview-title">
        <h2 id="contract-overview-title">ภาพรวมตัวแทนและสัญญา</h2>
        <section className={`${styles.overviewSection} ${styles.agentStatusSection}`} aria-labelledby="agent-status-title">
          <h3 id="agent-status-title" className={styles.agentSectionHeader}>
            <span className={styles.agentHeaderBadge} aria-hidden="true">
              <img src="/images/contracts/agent-header.png" alt="" />
            </span>
            <span>สถานะตัวแทน</span>
            <span className={styles.agentSubtitlePill}>นับบริษัทไม่ซ้ำ</span>
          </h3>
          <div className={styles.agentCards}>
            {[
              {
                key: 'total',
                titleMain: 'ตัวแทน',
                titleSub: 'ทั้งหมด',
                value: overview.agents.total,
                pctLabel: overview.agents.total > 0 ? '100%' : '0%',
                pctValue: overview.agents.total > 0 ? 100 : 0,
                detail: 'รวม Active และ Inactive',
                image: '/images/contracts/agent-total.png',
                tone: 'blue',
              },
              {
                key: 'active',
                titleMain: 'ตัวแทน',
                titleSub: 'Active',
                value: overview.agents.active,
                pctLabel: `${overview.agents.total > 0 ? ((overview.agents.active / overview.agents.total) * 100).toFixed(1) : '0.0'}%`,
                pctValue: overview.agents.total > 0 ? (overview.agents.active / overview.agents.total) * 100 : 0,
                detail: 'มีสัญญา Active อย่างน้อย 1 ฉบับ',
                image: '/images/contracts/agent-active.png',
                tone: 'green',
              },
              {
                key: 'inactive',
                titleMain: 'ตัวแทน',
                titleSub: 'Inactive',
                value: overview.agents.inactive,
                pctLabel: `${overview.agents.total > 0 ? ((overview.agents.inactive / overview.agents.total) * 100).toFixed(1) : '0.0'}%`,
                pctValue: overview.agents.total > 0 ? (overview.agents.inactive / overview.agents.total) * 100 : 0,
                detail: 'ไม่มีสัญญา Active',
                image: '/images/contracts/agent-inactive.png',
                tone: 'slate',
              },
            ].map(({ key, titleMain, titleSub, value, pctLabel, pctValue, detail, image, tone }) => (
              <article className={styles.agentBentoCard} data-tone={tone} key={key}>
                <div className={styles.agentCardSurface}>
                  <header className={styles.agentCardHeader}>
                    <span className={styles.agentPhotoBadge} aria-hidden="true">
                      <img src={image} alt="" />
                    </span>
                    <h4 className={styles.agentCardTitle}>
                      <span>{titleMain}</span>
                      <span className={styles.agentTitleAccent}>{titleSub}</span>
                    </h4>
                  </header>
                  <div className={styles.agentValueRow}>
                    <strong>{number(value)} <small>ราย</small></strong>
                    <span className={styles.agentPctPill}>{pctLabel}</span>
                  </div>
                  <p className={styles.agentDetailText}>{detail}</p>
                  <div className={styles.agentProgressTrack} aria-hidden="true">
                    <div
                      className={styles.agentProgressFill}
                      style={{ width: `${Math.max(pctValue > 0 ? 8 : 0, Math.min(100, pctValue))}%` }}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className={styles.agentInfoBanner}>
            <span className={styles.agentInfoIcon} aria-hidden="true">i</span>
            <span>Active: มีสัญญาเสร็จสมบูรณ์หรืออยู่ระหว่างดำเนินการอย่างน้อย 1 ฉบับ</span>
          </div>
          {overview.agents.missingRegistration > 0 && <p className={styles.note}>สัญญาที่ไม่มีเลขทะเบียนบริษัท {number(overview.agents.missingRegistration)} รายการ ไม่รวมในยอดตัวแทนไม่ซ้ำ</p>}
        </section>
        <section className={`${styles.overviewSection} ${styles.contractOverviewSection}`} aria-labelledby="contract-status-title">
          <h3 id="contract-status-title" className={styles.contractSectionHeader}>
            <span className={styles.contractHeaderBadge} aria-hidden="true">
              <img src="/images/contracts/overview-header.png" alt="" />
            </span>
            <span>ภาพรวมสัญญา</span>
            <span className={styles.contractSubtitlePill}>หน่วย: ฉบับ</span>
          </h3>
          <div className={styles.contractOverviewGrid}>
            {[
              {
                key: 'total',
                label: 'สัญญาทั้งหมด',
                value: overview.totals.total,
                pctValue: overview.totals.total > 0 ? 100 : 0,
                detail: 'รวมทั้ง 3 ประเภทงาน',
                image: '/images/contracts/overview-total.png',
                tone: 'sapphire',
              },
              {
                key: 'active',
                label: 'สัญญา Active',
                value: overview.totals.active,
                pctValue: overview.totals.total > 0 ? (overview.totals.active / overview.totals.total) * 100 : 0,
                detail: 'เสร็จสมบูรณ์ + อยู่ระหว่างดำเนินการ',
                image: '/images/contracts/overview-active.png',
                tone: 'cyan',
              },
              {
                key: 'complete',
                label: 'เสร็จสมบูรณ์',
                value: overview.totals.complete,
                pctValue: overview.totals.total > 0 ? (overview.totals.complete / overview.totals.total) * 100 : 0,
                detail: 'Complete',
                image: '/images/contracts/overview-complete.png',
                tone: 'green',
              },
              {
                key: 'onProcess',
                label: 'อยู่ระหว่างดำเนินการ',
                value: overview.totals.onProcess,
                pctValue: overview.totals.total > 0 ? (overview.totals.onProcess / overview.totals.total) * 100 : 0,
                detail: 'On Process',
                image: '/images/contracts/overview-process.png',
                tone: 'amber',
              },
            ].map(({ key, label, value, pctValue, detail, image, tone }) => (
              <article className={styles.contractBentoCard} data-tone={tone} key={key}>
                <div className={styles.contractCardSurface}>
                  <div className={styles.contractBadgeWrap}>
                    <span
                      className={`${styles.contractPhotoBadge} ${key === 'onProcess' ? styles.contractProcessCircle : ''}`}
                      aria-hidden="true"
                    >
                      {key === 'onProcess' ? (
                        <span className={styles.contractProcessCircleInner}>
                          <svg className={styles.contractProcessGearsSvg} viewBox="0 0 120 120" fill="none">
                            <g opacity="0.22" stroke="#1e3a8a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="46" cy="68" r="16" />
                              <circle cx="46" cy="68" r="7" />
                              <path d="M46 44v6M46 86v6M22 68h6M64 68h6M29 51l4 4M59 81l4 4M63 51l-4 4M33 81l-4 4" />
                              <circle cx="78" cy="44" r="12" />
                              <circle cx="78" cy="44" r="5" />
                              <path d="M78 26v4M78 58v4M60 44h4M92 44h4M65 31l3 3M88 54l3 3M91 31l-3 3M68 54l-3 3" />
                            </g>
                          </svg>
                          <span className={styles.contractProcessRedText}>On Process</span>
                        </span>
                      ) : (
                        <img src={image} alt="" />
                      )}
                    </span>
                  </div>
                  <div className={styles.contractTitleRow}>
                    <h4 className={styles.contractCardTitle}>{label}</h4>
                    <div className={styles.contractValueRow}>
                      <strong>{number(value)}</strong>
                    </div>
                  </div>
                  <p className={styles.contractDetailText}>{detail}</p>
                  <div className={styles.contractProgressTrack} aria-hidden="true">
                    <div
                      className={styles.contractProgressFill}
                      style={{ width: `${Math.max(pctValue > 0 ? 14 : 0, Math.min(100, pctValue))}%` }}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className={styles.contractCancelledBanner}>
            <span className={styles.contractCancelledBadge} aria-hidden="true">
              <img src="/images/contracts/overview-cancelled.png" alt="" />
            </span>
            <span>สัญญายกเลิก <b>{number(overview.totals.cancelled)}</b> ฉบับ</span>
            {overview.totals.other > 0 && <span className={styles.contractOtherSpan}>สถานะอื่น / ไม่ระบุ {number(overview.totals.other)} ฉบับ</span>}
          </div>
        </section>
        <section className={`${styles.overviewSection} ${styles.sourceStatusSection}`} aria-labelledby="source-status-title">
          <h3 id="source-status-title" className={styles.sourceSectionHeader}>
            <span className={styles.sourceHeaderBadge} aria-hidden="true">
              <img src="/images/contracts/header-layers.png" alt="" />
            </span>
            <span>สถานะสัญญาตามประเภทงาน</span>
          </h3>
          <div className={styles.sourceGrid}>{contractSources.map(contractSource => {
            const summary = overview.bySource[contractSource];
            const sourceMeta: Record<ContractSource, { subtitle: string; image: string }> = {
              'track-c': { subtitle: 'งานติดตั้งอินเทอร์เน็ต', image: '/images/contracts/track-c.png' },
              solar: { subtitle: 'งานติดตั้งโซล่าร์', image: '/images/contracts/solar.png' },
              corporate: { subtitle: 'งานก่อสร้างโครงสร้าง', image: '/images/contracts/corporate.png' },
            };
            const meta = sourceMeta[contractSource];
            return <article className={styles.sourceCard} key={contractSource}>
              <div className={styles.sourceCardSurface}>
                <header className={styles.sourceCardHeader}>
                  <span className={styles.sourcePhotoBadge} aria-hidden="true">
                    <img src={meta.image} alt="" />
                  </span>
                  <div className={styles.sourceTitleGroup}>
                    <div className={styles.sourceTitleRow}>
                      <h4>{sourceLabels[contractSource]}</h4>
                      <strong className={styles.sourceInlineTotal}>{number(summary.total)}</strong>
                    </div>
                    <p className={styles.sourceSubtitle}>{meta.subtitle}</p>
                  </div>
                </header>
                <dl className={styles.statusList}>
                  <div data-tone="green"><dt>เสร็จสมบูรณ์</dt><span className={styles.statusLeader} aria-hidden="true" /><dd>{number(summary.complete)}</dd></div>
                  <div data-tone="amber"><dt>อยู่ระหว่างดำเนินการ</dt><span className={styles.statusLeader} aria-hidden="true" /><dd>{number(summary.onProcess)}</dd></div>
                  <div data-tone="gray"><dt>ยกเลิก</dt><span className={styles.statusLeader} aria-hidden="true" /><dd>{number(summary.cancelled)}</dd></div>
                  {summary.other > 0 && <div data-tone="gray"><dt>สถานะอื่น / ไม่ระบุ</dt><span className={styles.statusLeader} aria-hidden="true" /><dd>{number(summary.other)}</dd></div>}
                </dl>
                <button type="button" className={styles.sourceLink} onClick={() => onSelectSource(contractSource)} aria-label={`ดูรายละเอียด ${sourceLabels[contractSource]}`}>ดูรายละเอียด <ArrowRight size={16} aria-hidden="true" /></button>
              </div>
            </article>;
          })}</div>
        </section>
        <section className={`${styles.overviewSection} ${styles.workPatternBentoCard}`} aria-labelledby="work-pattern-title">
          <div className={styles.workPatternHeader}>
            <span className={styles.workPatternLogoBadge} aria-hidden="true">
              <Layers size={22} strokeWidth={2.2} />
            </span>
            <h3 id="work-pattern-title" className={styles.workPatternTitle}>Scope of work by provider</h3>
          </div>
          {(() => {
            const totalMatchableCompanies = combinations.reduce((acc, item) => acc + item.count, 0) || counts.companies || 1;
            const renderCheckBadge = (hasSource: boolean, tone: 'blue' | 'teal' | 'purple', label: string) => {
              if (!hasSource) {
                return <span className={styles.patternDash} aria-label={`ไม่รับงาน ${label}`}>—</span>;
              }
              return (
                <span className={styles.patternCheckCircle} data-tone={tone} aria-label={`รับงาน ${label}`}>
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3.8 8.3L6.7 11.2L12.3 5.2" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              );
            };
            return (
              <div className={styles.patternTableWrap} role="region" aria-labelledby="work-pattern-title">
                <div className={styles.patternTable}>
                  <div className={styles.patternTableHead}>
                    <div className={styles.patternColWork}>รูปแบบงาน</div>
                    <div className={styles.patternColSource}>Track C</div>
                    <div className={styles.patternColSource}>Solar</div>
                    <div className={styles.patternColSource}>Corporate</div>
                    <div className={styles.patternColCount}>จำนวนตัวแทน</div>
                    <div className={styles.patternColShare}>สัดส่วน</div>
                  </div>
                  <div className={styles.patternTableBody}>
                    {combinations.map((item, index) => {
                      const pctNum = (item.count / totalMatchableCompanies) * 100;
                      const pctLabel = pctNum.toFixed(1);
                      const hasTrackC = item.sources.includes('track-c');
                      const hasSolar = item.sources.includes('solar');
                      const hasCorporate = item.sources.includes('corporate');
                      return (
                        <div
                          key={item.label}
                          className={`${styles.patternTableRow} ${index % 2 === 1 ? styles.patternTableRowAlt : ''}`}
                        >
                          <div className={styles.patternColWork}>{item.label}</div>
                          <div className={styles.patternColSource}>
                            {renderCheckBadge(hasTrackC, 'blue', 'Track C')}
                          </div>
                          <div className={styles.patternColSource}>
                            {renderCheckBadge(hasSolar, 'teal', 'Solar')}
                          </div>
                          <div className={styles.patternColSource}>
                            {renderCheckBadge(hasCorporate, 'purple', 'Corporate')}
                          </div>
                          <div className={styles.patternColCount}>
                            <strong>{number(item.count)}</strong> <span>ราย</span>
                          </div>
                          <div className={styles.patternColShare}>
                            <span className={styles.patternSharePct}>{pctLabel}%</span>
                            <div className={styles.patternShareBarTrack} aria-hidden="true">
                              <div
                                className={styles.patternShareBarFill}
                                style={{ width: `${Math.max(pctNum, 1.4)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={styles.patternTableFoot}>
                    <div className={styles.patternColWork}>รวม</div>
                    <div className={styles.patternColSource} />
                    <div className={styles.patternColSource} />
                    <div className={styles.patternColSource} />
                    <div className={styles.patternColCount}>
                      <strong>{number(totalMatchableCompanies)}</strong> <span>ราย</span>
                    </div>
                    <div className={styles.patternColShare}>
                      <span className={styles.patternSharePct}>100.0%</span>
                      <div className={styles.patternShareBarTrack} aria-hidden="true">
                        <div className={styles.patternShareBarFill} style={{ width: '100%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </section>
      </section>
      <section className={`${styles.band} ${styles.tableSection}`} aria-label="รายชื่อคู่สัญญาทั้งหมด">
        <div className={styles.sectionHeader}>
          <div className={styles.tableTitleGroup}>
            <h2>คู่สัญญารายบริษัท</h2>
            <span className={styles.rowCountBadge}>{number(filtered.length)} บริษัท</span>
          </div>
          <button className={styles.export} type="button" onClick={exportExcel} disabled={exporting || !filtered.length}>
            <Download size={16} aria-hidden="true" />
            {exporting ? 'กำลังส่งออก...' : 'Export Excel'}
          </button>
        </div>
        <div className={styles.filters}>
          <label className={styles.search}>
            <span className={styles.filterTitle}>
              <i className={styles.searchDot} aria-hidden="true" />
              ค้นหาคู่สัญญา
            </span>
            <div className={styles.searchBox}>
              <span className={styles.searchBadge} aria-hidden="true">
                <Search size={15} />
              </span>
              <input
                aria-label="ค้นหาคู่สัญญา"
                placeholder="ชื่อบริษัท เลขทะเบียน เลขที่สัญญา…"
                value={query}
                onChange={event => updateFilter(setQuery, event.target.value)}
              />
            </div>
          </label>
          <label className={styles.filterItem}>
            <span className={styles.filterTitle}>ประเภทสัญญา</span>
            <div className={styles.selectBox} data-active={Boolean(source) || undefined}>
              <i className={styles.filterDot} data-tone="0" aria-hidden="true" />
              <select value={source} onChange={event => updateFilter(setSource, event.target.value)}>
                <option value="">ทั้งหมด</option>
                {contractSources.map(item => <option value={item} key={item}>{sourceLabels[item]}</option>)}
              </select>
            </div>
          </label>
          <label className={styles.filterItem}>
            <span className={styles.filterTitle}>กลุ่มสถานะ</span>
            <div className={styles.selectBox} data-active={Boolean(status) || undefined}>
              <i className={styles.filterDot} data-tone="1" aria-hidden="true" />
              <select value={status} onChange={event => updateFilter(setStatus, event.target.value)}>
                <option value="">ทั้งหมด</option>
                {groupStatuses.map(item => <option value={item} key={item}>{item}</option>)}
              </select>
            </div>
          </label>
        </div>
        {counts.missingRegistration > 0 && <p className={styles.note}>ไม่พบเลขทะเบียนบริษัท {number(counts.missingRegistration)} รายการ แสดงแยกไว้ในตาราง</p>}
        {exportError && <p role="alert" className={styles.error}>{exportError}</p>}
        <div className={styles.tableWrap} role="region" tabIndex={0} aria-label="สรุปสัญญารายบริษัท"><table>
          <thead><tr><th scope="col">ชื่อคู่สัญญา</th><th scope="col">เลขทะเบียนบริษัท</th><th scope="col">ประเภทงานที่รับ</th><th scope="col">จำนวนสัญญา</th><th scope="col">กลุ่มสถานะ</th><th scope="col">รายละเอียด</th></tr></thead>
          <tbody>{visible.map(company => {
            const maskedReg = company.registration ? maskRegistration(company.registration) : '';
            return <Fragment key={company.key}><tr className={styles.companyRow} data-expanded={expanded === company.key || undefined}>
              <td className={styles.name}>{company.name}</td>
              <td className={styles.numeric}>
                {maskedReg && maskedReg.startsWith('x') && maskedReg.length > 5 ? (
                  <span className={styles.regNo}>
                    <span className={styles.regMask}>{maskedReg.slice(0, -5)}</span>
                    <strong>{maskedReg.slice(-5)}</strong>
                  </span>
                ) : (maskedReg || 'ไม่ระบุ')}
              </td>
              <td><div className={styles.tags}>{company.sources.map(item => <span key={item} className={styles.tag} data-source={item}>{sourceLabels[item]}</span>)}</div></td>
              <td className={styles.numeric}><span className={styles.countBadge}>{company.contracts.length}</span></td>
              <td><div className={styles.tags}>{[...new Set(company.contracts.map(({ row }) => row.group_status?.trim() || 'ไม่ระบุ'))].map(group => {
                const lower = group.toLowerCase();
                const tone = lower === 'complete' ? 'complete' : lower.includes('process') ? 'process' : lower.includes('cancel') ? 'cancel' : 'default';
                return (
                  <span className={styles.status} data-group={tone} key={group}>
                    {tone === 'complete' ? '✓ ' : tone === 'process' ? '⏳ ' : ''}
                    {group}
                  </span>
                );
              })}</div></td>
              <td><button type="button" className={styles.expand} aria-label={`รายละเอียดสัญญา ${company.name}`} aria-expanded={expanded === company.key} onClick={() => setExpanded(previous => previous === company.key ? null : company.key)}>{expanded === company.key ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button></td>
            </tr>{expanded === company.key && <tr className={styles.detailTr}><td colSpan={6} className={styles.details}><div className={styles.detailGrid}>
              <div className={styles.detailHead}><span>ประเภทสัญญา</span><span>เลขที่สัญญา</span><span>สถานะสัญญา</span><span>กลุ่มสถานะ</span><span>วันเริ่ม</span><span>วันสิ้นสุด</span><span>เหตุผล</span></div>
              {company.contracts.map(({ source: contractSource, row }, index) => {
                const grp = row.group_status?.trim() || '-';
                const grpLower = grp.toLowerCase();
                const grpTone = grpLower === 'complete' ? 'complete' : grpLower.includes('process') ? 'process' : grpLower.includes('cancel') ? 'cancel' : 'default';
                return (
                  <div className={styles.detailRow} key={`${contractSource}-${row.uuid ?? index}`}>
                    <span><b className={styles.tag} data-source={contractSource}>{sourceLabels[contractSource]}</b></span>
                    <span className={styles.contractNo}>{row.contract_no || '-'}</span>
                    <span>{row.contract_status || '-'}</span>
                    <span><b className={styles.status} data-group={grpTone}>{grpTone === 'complete' ? '✓ ' : grpTone === 'process' ? '⏳ ' : ''}{grp}</b></span>
                    <span>{row.start_contract || '-'}</span>
                    <span>{row.end_contract || '-'}</span>
                    <span>{row.installation_status || '-'}</span>
                  </div>
                );
              })}
            </div></td></tr>}</Fragment>;
          })}
          {!visible.length && <tr className={styles.emptyRow}><td colSpan={6} className={styles.empty}>ไม่พบคู่สัญญาตามเงื่อนไข</td></tr>}</tbody>
        </table></div>
        <div className={styles.pagination}><span>หน้า {current} / {pages}</span><button type="button" aria-label="หน้าก่อนหน้า" disabled={current === 1} onClick={() => { setPage(current - 1); setExpanded(null); }}><ChevronLeft size={18} /></button><button type="button" aria-label="หน้าถัดไป" disabled={current === pages} onClick={() => { setPage(current + 1); setExpanded(null); }}><ChevronRight size={18} /></button></div>
      </section>
    </>}
  </div>;
}
