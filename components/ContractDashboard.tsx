'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Search, X } from 'lucide-react';
import { ContractRow, contractColumns as trackColumns, solarContractColumns, corporateContractColumns, contractValue, contractCellValue, filterContracts, groupContracts, groupStatusCards, onProcessRows, isCorporateHiddenGroupStatus, activeContractStatus, countActiveContracts, rbmActiveStatusBreakdown } from '@/lib/contractDashboard';
import styles from './ContractDashboard.module.css';
import RbmContractChart from './charts/RbmContractChart';

const filterFields = [['rbm', 'RBM'], ['active_status', 'สถานะ Active'], ['contract_status', 'สถานะสัญญา'], ['group_status', 'กลุ่มสถานะ'], ['installation_status', 'เหตุผล'], ['bg_status', 'สถานะ BG']] as const;
const rbmOrder = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'];
const rbmRank = (value: string) => { const index = rbmOrder.indexOf(value.trim().split('_', 1)[0]); return index === -1 ? rbmOrder.length : index; };
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

type CardVariant = 'all' | 'active' | 'cancel' | 'process';
function getCardVariant(label: string): CardVariant {
  const key = label.trim().toLowerCase();
  if (key === 'คู่สัญญาทั้งหมด') return 'all';
  if (key.includes('cancel')) return 'cancel';
  if (key.includes('process')) return 'process';
  return 'active';
}

function CardIllustration({ variant }: { variant: CardVariant }) {
  const isWarm = variant === 'cancel' || variant === 'process';
  return (
    <>
      <svg className={styles.cardArt} viewBox="0 0 92 92" aria-hidden="true">
        <defs>
          <linearGradient id={`artHalo-${variant}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={isWarm ? '#fde68a' : '#a7f3d0'} stopOpacity="0.65" />
            <stop offset="100%" stopColor={isWarm ? '#fed7aa' : '#ccfbf1'} stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id={`artDocBack-${variant}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={isWarm ? '#fb923c' : '#10b981'} />
            <stop offset="100%" stopColor={isWarm ? '#ea580c' : '#047857'} />
          </linearGradient>
          <linearGradient id="artDocFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </linearGradient>
          <linearGradient id="artBadgeGreen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
          <linearGradient id="artBadgeRed" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
          <linearGradient id="artBadgeAmber" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <filter id={`artShadow-${variant}`} x="-20%" y="-20%" width="145%" height="145%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.14" />
          </filter>
        </defs>

        {/* Soft circular backdrop */}
        <circle cx="44" cy="48" r="36" fill={`url(#artHalo-${variant})`} />

        {/* Back layered folder/sheet */}
        <g transform="rotate(-14 36 50)">
          <rect x="16" y="24" width="38" height="48" rx="7" fill={`url(#artDocBack-${variant})`} />
          <line x1="22" y1="36" x2="36" y2="36" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Front 3D white document */}
        <g transform="rotate(-5 46 46)" filter={`url(#artShadow-${variant})`}>
          <rect x="25" y="17" width="42" height="54" rx="8" fill="url(#artDocFront)" stroke="#e2e8f0" strokeWidth="1" />
          {variant === 'all' ? (
            <>
              <rect x="33" y="27" width="24" height="7" rx="3.5" fill="#10b981" />
              <rect x="33" y="40" width="26" height="4.5" rx="2.25" fill="#cbd5e1" />
              <rect x="33" y="49" width="20" height="4.5" rx="2.25" fill="#cbd5e1" />
            </>
          ) : (
            <>
              <rect x="33" y="27" width="20" height="4.5" rx="2.25" fill="#cbd5e1" />
              <rect x="33" y="36" width="26" height="4.5" rx="2.25" fill="#cbd5e1" />
              <rect x="33" y="45" width="16" height="4.5" rx="2.25" fill="#cbd5e1" />
            </>
          )}
        </g>

        {/* Status 3D Badge */}
        {variant === 'active' && (
          <g filter={`url(#artShadow-${variant})`}>
            <circle cx="63" cy="57" r="15" fill="url(#artBadgeGreen)" stroke="#ffffff" strokeWidth="2" />
            <path d="M56.5 57.5L61 62L70 52.5" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {variant === 'cancel' && (
          <g filter={`url(#artShadow-${variant})`}>
            <circle cx="63" cy="57" r="15" fill="url(#artBadgeRed)" stroke="#ffffff" strokeWidth="2" />
            <path d="M57.5 51.5L68.5 62.5M68.5 51.5L57.5 62.5" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" />
          </g>
        )}
        {variant === 'process' && (
          <g filter={`url(#artShadow-${variant})`}>
            <circle cx="63" cy="57" r="15" fill="url(#artBadgeAmber)" stroke="#ffffff" strokeWidth="2" />
            <path d="M63 50V57.5L68 60.5" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </svg>

      {/* Top-right decorative motive leaf */}
      <svg className={styles.cardLeaf} viewBox="0 0 40 36" aria-hidden="true">
        <path d="M20 32C20 17 30 6 39 5C39 18 31 29 20 32Z" fill={isWarm ? '#f59e0b' : '#10b981'} fillOpacity="0.38" />
        <path d="M18 31C11 22 9 12 13 5C20 11 21 21 18 31Z" fill={isWarm ? '#fbbf24' : '#34d399'} fillOpacity="0.52" />
      </svg>
    </>
  );
}

function renderTableCell(key: string, rawValue: string | null | undefined) {
  const value = contractValue(contractCellValue(key, rawValue));
  const lower = value.toLowerCase();

  if (key === 'corporate_registration_no' && value.startsWith('x') && value.length > 5) {
    return (
      <span className={styles.regNo}>
        <span className={styles.regMask}>{value.slice(0, -5)}</span>
        <strong>{value.slice(-5)}</strong>
      </span>
    );
  }
  if (key === 'partner_name') {
    return <strong className={styles.partnerName}>{value}</strong>;
  }
  if (key === 'active_status') {
    const isActive = lower === 'active';
    return (
      <span className={styles.statusPill} data-status={isActive ? 'active' : 'inactive'}>
        <i aria-hidden="true" />
        {value}
      </span>
    );
  }
  if (key === 'group_status') {
    const groupTone = lower === 'complete' ? 'complete' : lower.includes('process') ? 'process' : lower.includes('cancel') ? 'cancel' : 'default';
    return (
      <span className={styles.groupPill} data-group={groupTone}>
        {groupTone === 'complete' ? '✓ ' : groupTone === 'process' ? '⏳ ' : ''}
        {value}
      </span>
    );
  }
  if (key === 'contract_status') {
    const isActiveContract = lower.includes('active');
    return (
      <span className={styles.contractStatusBadge} data-active={isActiveContract || undefined}>
        {value}
      </span>
    );
  }
  if (key === 'contract_no' && value !== 'ไม่ระบุ') {
    return <span className={styles.contractNo}>{value}</span>;
  }
  if (key === 'rbm' && value !== 'ไม่ระบุ') {
    return <span className={styles.rbmBadge}>{value}</span>;
  }
  return value;
}

export default function ContractDashboard({ source = 'track-c' }: { source?: 'track-c' | 'solar' | 'corporate' }) {
  const isTrackC = source === 'track-c';
  const contractColumns = source === 'solar' ? solarContractColumns : source === 'corporate' ? corporateContractColumns : trackColumns;
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`/api/contract-c?source=${source}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'โหลดข้อมูลไม่สำเร็จ');
        setRows(body.rows);
      }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [source]);
  const filtered = useMemo(() => filterContracts(rows, query, filters), [rows, query, filters]);
  // การ์ดสรุปนับจากคอลัมน์ group_status โดยไม่นำตัวกรอง group_status มาคิด เพื่อให้การ์ดยังแสดงจำนวนรวมและทุกกลุ่มเสมอ
  const cardRows = useMemo(() => filterContracts(rows, query, { ...filters, group_status: '' }), [rows, query, filters]);
  const isCorporate = source === 'corporate';
  // หน้า Corporate: ซ่อนการ์ด Complete และ On Process
  const statuses = useMemo(() => groupStatusCards(cardRows).filter(([status]) => !isCorporate || !isCorporateHiddenGroupStatus(status)), [cardRows, isCorporate]);
  // หน้า Corporate: การ์ด "สัญญา Active" นับจากคอลัมน์ contract_status (ไม่นำตัวกรอง contract_status มาคิด)
  const activeCount = useMemo(() => isCorporate ? countActiveContracts(filterContracts(rows, query, { ...filters, contract_status: '' })) : 0, [rows, query, filters, isCorporate]);
  // กราฟรายละเอียดสถานะสัญญา: นับเฉพาะ On Process แยกตามคอลัมน์ installation_status
  const reasonRows = useMemo(() => onProcessRows(filtered), [filtered]);
  const reasons = useMemo(() => groupContracts(reasonRows, 'installation_status'), [reasonRows]);
  // หน้า Corporate: กราฟรายละเอียดสัญญาตามพื้นที่ (rbm) นับจำนวนตาม active_status
  const rbmBreakdown = useMemo(() => isCorporate ? rbmActiveStatusBreakdown(filtered, rbmRank) : null, [filtered, isCorporate]);
  // ค่าเริ่มต้นแสดงเฉพาะ Active; เมื่อมีการค้นหาหรือใช้ตัวกรอง จะแสดงทุกสถานะตามเงื่อนไข
  const isFiltering = query.trim() !== '' || Object.values(filters).some(Boolean);
  // เปิดหน้าปกติ: แสดงเฉพาะ Active และเรียง RBM จากน้อยไปมาก / ค้นหาหรือกรอง: แสดงทุกสถานะตามลำดับเดิม
  const tableRows = useMemo(() => isFiltering ? filtered : filtered
    .filter(row => contractValue(row.active_status).toLowerCase() === 'active')
    .sort((a, b) => {
      const aRbm = contractValue(a.rbm);
      const bRbm = contractValue(b.rbm);
      return rbmRank(aRbm) - rbmRank(bRbm) || aRbm.localeCompare(bRbm, 'th', { numeric: true });
    }), [filtered, isFiltering]);
  const changeFilter = (key: string, value: string) => { setFilters(previous => ({ ...previous, [key]: value })); };
  const exportExcel = async () => {
    setExporting(true);
    setExportError('');
    try {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.aoa_to_sheet([
        contractColumns.map(([, label]) => label),
        ...tableRows.map(row => contractColumns.map(([key]) => String(contractCellValue(key, row[key]) ?? ''))),
      ]);
      sheet['!cols'] = contractColumns.map(([key, label]) => ({
        wch: Math.min(60, Math.max(16, label.length + 2, ...tableRows.map(row => String(contractCellValue(key, row[key]) ?? '').length + 2))),
      }));
      sheet['!autofilter'] = { ref: sheet['!ref']! };
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, source === 'track-c' ? 'Track C' : source === 'solar' ? 'Solar' : 'Corporate');
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
      XLSX.writeFile(workbook, `contract-${source === 'track-c' ? 'c' : source}-${date}.xlsx`);
    } catch {
      setExportError('ส่งออก Excel ไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setExporting(false);
    }
  };
  return <div className={styles.dashboard} aria-busy={loading}>
    {error && <div role="alert" className={styles.error}>{error}</div>}
    {loading ? <p role="status">กำลังโหลดข้อมูลสัญญา...</p> : error ? null : <>
      <div className={styles.cards}>
        <button
          className={styles.card}
          data-variant="all"
          aria-pressed={!filters.group_status && (!isCorporate || filters.contract_status !== activeContractStatus)}
          onClick={() => isCorporate ? setFilters(previous => ({ ...previous, group_status: '', contract_status: '' })) : changeFilter('group_status', '')}
        >
          <CardIllustration variant="all" />
          <div className={styles.cardBody}>
            <span>คู่สัญญาทั้งหมด</span>
            <AnimatedCardNumber value={cardRows.length} />
            <small>ราย</small>
          </div>
        </button>
        {isCorporate && (
          <button
            className={styles.card}
            data-variant="active"
            aria-pressed={filters.contract_status === activeContractStatus}
            onClick={() => changeFilter('contract_status', filters.contract_status === activeContractStatus ? '' : activeContractStatus)}
          >
            <CardIllustration variant="active" />
            <div className={styles.cardBody}>
              <span>{activeContractStatus}</span>
              <AnimatedCardNumber value={activeCount} />
              <small>{cardRows.length ? (activeCount / cardRows.length * 100).toFixed(1) : '0.0'}% ของทั้งหมด</small>
            </div>
          </button>
        )}
        {statuses.map(([status, count]) => {
          const variant = getCardVariant(status);
          return (
            <button
              key={status}
              className={styles.card}
              data-variant={variant}
              aria-pressed={filters.group_status === status}
              onClick={() => changeFilter('group_status', filters.group_status === status ? '' : status)}
            >
              <CardIllustration variant={variant} />
              <div className={styles.cardBody}>
                <span>{status}</span>
                <AnimatedCardNumber value={count} />
                <small>{cardRows.length ? (count / cardRows.length * 100).toFixed(1) : '0.0'}% ของทั้งหมด</small>
              </div>
            </button>
          );
        })}
      </div>
      <div className={styles.filters}>
        <label className={styles.search}>
          <span className={styles.filterTitle}>
            <i className={styles.searchDot} aria-hidden="true" />
            ค้นหาทุกคอลัมน์
          </span>
          <div className={styles.searchBox}>
            <span className={styles.searchBadge} aria-hidden="true">
              <Search size={15} />
            </span>
            <input
              value={query}
              placeholder={isTrackC ? 'ชื่อคู่สัญญา เลขที่สัญญา Depot…' : 'ชื่อคู่สัญญา เลขที่สัญญา เลขทะเบียนบริษัท…'}
              onChange={event => { setQuery(event.target.value); }}
            />
          </div>
        </label>
        {filterFields.filter(([key]) => isTrackC || (key !== 'bg_status' && (source !== 'corporate' || key !== 'rbm'))).map(([key, label], index) => (
          <label key={key} className={styles.filterItem}>
            <span className={styles.filterTitle}>{label}</span>
            <div className={styles.selectBox} data-active={Boolean(filters[key]) || undefined}>
              <i className={styles.filterDot} data-tone={index % 6} aria-hidden="true" />
              <select value={filters[key] || ''} onChange={event => changeFilter(key, event.target.value)}>
                <option value="">ทั้งหมด</option>
                {groupContracts(rows, key).sort(([a], [b]) => key === 'rbm' ? rbmRank(a) - rbmRank(b) : 0).map(([value]) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </div>
          </label>
        ))}
        <button
          type="button"
          className={styles.clearBtn}
          title="ล้างตัวกรอง"
          aria-label="ล้างตัวกรอง"
          onClick={() => { setFilters({}); setQuery(''); }}
        >
          <X size={17} />
        </button>
      </div>
      {rbmBreakdown && <RbmContractChart data={rbmBreakdown} />}
      {!isCorporate && <section className={styles.reasons}><h3>รายละเอียดสถานะสัญญา · {number(reasonRows.length)} ราย</h3>{reasons.length ? <div className={styles.bars}>{reasons.map(([reason, count]) => <div key={reason} className={styles.barRow}><span>{reason}</span><div className={styles.track}><div style={{ width: `${count / reasonRows.length * 100}%` }} /></div><strong>{number(count)} <small>({(count / reasonRows.length * 100).toFixed(1)}%)</small></strong></div>)}</div> : <p>ไม่พบข้อมูลตามเงื่อนไข</p>}</section>}
      <section className={styles.tableSection}>
        <div className={styles.header}>
          <div className={styles.tableTitleGroup}>
            <h3>รายละเอียดสัญญา</h3>
            <span className={styles.rowCountBadge}>{number(tableRows.length)} รายการ</span>
          </div>
          <div className={styles.tableActions}>
            <button type="button" className={styles.exportBtn} onClick={exportExcel} disabled={loading || exporting || !tableRows.length}>
              <Download size={16} aria-hidden="true" />
              {exporting ? 'กำลังส่งออก...' : 'Export Excel'}
            </button>
          </div>
        </div>
        {exportError && <p role="alert" className={styles.error}>{exportError}</p>}
        <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="ตารางรายละเอียดสัญญา">
          <table>
            <thead>
              <tr>{contractColumns.map(([key, label]) => <th key={key} title={key}>{label}</th>)}</tr>
            </thead>
            <tbody>
              {tableRows.map(row => (
                <tr key={row.uuid || row.corporate_registration_no}>
                  {contractColumns.map(([key]) => <td key={key}>{renderTableCell(key, row[key])}</td>)}
                </tr>
              ))}
              {!tableRows.length && <tr className={styles.emptyRow}><td colSpan={contractColumns.length}>ไม่พบข้อมูลตามเงื่อนไข</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>}
  </div>;
}
