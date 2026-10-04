'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import styles from './page.module.css';

type SalesAdmin = {
  uuid: string;
  full_name: string | null;
  depot_code: string | null;
  store_code_100xxx: string | null;
  code_39xxx: string | null;
  dealer_name: string | null;
  phone_no: string | null;
  image: string | null;
  store_email: string | null;
};

const PAGE_SIZE = 25;

function toImageSrc(url: string, size: number): string {
  const match = url.match(/[?&]id=([\w-]+)/) || url.match(/\/d\/([\w-]+)/);
  return match && /drive\.google\.com|googleusercontent\.com/.test(url)
    ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w${size}`
    : url;
}

export default function SalesDirectory() {
  const [admins, setAdmins] = useState<SalesAdmin[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedAdmin, setSelectedAdmin] = useState<SalesAdmin | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLTableRowElement | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin-sale', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('ไม่สามารถโหลดข้อมูลแอดมินงานขายได้');
        return response.json();
      })
      .then((result: { data: SalesAdmin[]; updatedAt: string | null }) => {
        setAdmins(result.data);
        setUpdatedAt(result.updatedAt);
      })
      .catch((cause) => {
        if (cause.name !== 'AbortError') setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => { setPage(1); }, [query]);

  useEffect(() => {
    if (!selectedAdmin) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedAdmin(null);
      if (event.key === 'Tab') {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      openerRef.current?.focus();
    };
  }, [selectedAdmin]);

  const openAdmin = (admin: SalesAdmin, row: HTMLTableRowElement) => {
    openerRef.current = row;
    setSelectedAdmin(admin);
  };

  const sortedAdmins = useMemo(() => [...admins].sort((a, b) => {
    const codeA = a.store_code_100xxx?.trim() || '';
    const codeB = b.store_code_100xxx?.trim() || '';
    if (!codeA || !codeB) return codeA ? -1 : codeB ? 1 : 0;
    const digitsA = codeA.replace(/,/g, '');
    const digitsB = codeB.replace(/,/g, '');
    const numericA = /^\d+$/.test(digitsA);
    const numericB = /^\d+$/.test(digitsB);
    if (numericA && numericB) {
      const valueA = BigInt(digitsA);
      const valueB = BigInt(digitsB);
      if (valueA !== valueB) return valueA < valueB ? -1 : 1;
    } else if (numericA !== numericB) {
      return numericA ? -1 : 1;
    }
    return codeA.localeCompare(codeB, 'en', { numeric: true }) ||
      (a.full_name || '').localeCompare(b.full_name || '', 'th');
  }), [admins]);

  const filteredAdmins = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return sortedAdmins;
    return sortedAdmins.filter((admin) => [
      admin.full_name, admin.depot_code, admin.store_code_100xxx,
      admin.code_39xxx, admin.dealer_name, admin.phone_no, admin.store_email,
    ].some((value) => value?.toLocaleLowerCase().includes(term)));
  }, [sortedAdmins, query]);

  const companyCount = useMemo(() => new Set(
    admins.map((admin) => admin.depot_code?.trim().toLocaleLowerCase()).filter(Boolean),
  ).size, [admins]);

  const totalPages = Math.max(1, Math.ceil(filteredAdmins.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedAdmins = filteredAdmins.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const updatedLabel = useMemo(() => {
    if (!updatedAt) return null;
    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString('en-GB', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }, [updatedAt]);

  const handleExport = () => {
    const headers = ['Picture', 'Code100xxxxx', 'Code39xxxxxx', 'Depot', 'Company name', 'Name', 'Phone', 'Email'];
    const rows = filteredAdmins.map((admin) => [
      admin.image || '', admin.store_code_100xxx || '', admin.code_39xxx || '',
      admin.depot_code || '', admin.dealer_name || '', admin.full_name || '',
      admin.phone_no || '', admin.store_email || '',
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Admin Sale');
    XLSX.writeFile(book, `admin_sale_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <>
      {!loading && !error && updatedLabel && (
        <div className={styles.salesSummary}>
          <span className={styles.count}>Data updated as {updatedLabel}</span>
        </div>
      )}
      {!loading && !error && (
        <div className={styles.salesKpiGrid}>
          <article className={`${styles.kpiCard} ${styles.kpiBlue}`}>
            <span className={styles.kpiLabel}>จำนวนแอดมินงานขาย</span>
            <strong className={styles.kpiValue}>{admins.length.toLocaleString()}</strong>
          </article>
          <article className={`${styles.kpiCard} ${styles.kpiTeal}`}>
            <span className={styles.kpiLabel}>จำนวนบริษัท</span>
            <strong className={styles.kpiValue}>{companyCount.toLocaleString()}</strong>
          </article>
        </div>
      )}
      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchGroup}>
            <label className={styles.searchLabel} htmlFor="admin-sale-search">ค้นหารายชื่อ</label>
            <input
              id="admin-sale-search"
              className={styles.search}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ชื่อ, Company name, Depot, Code100xxxxx หรือโทรศัพท์"
            />
          </div>
          <button
            type="button"
            className={styles.exportButton}
            onClick={handleExport}
            disabled={loading || !!error || filteredAdmins.length === 0}
          >
            Export Excel
          </button>
        </div>

        {loading ? <p className={styles.message}>กำลังโหลดข้อมูล...</p> :
          error ? <p className={styles.error} role="alert">{error}</p> :
          filteredAdmins.length === 0 ? <p className={styles.message}>ไม่พบรายชื่อแอดมินงานขาย</p> : (
            <>
              <div className={`${styles.tableWrap} ${styles.salesTableWrap}`}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Picture</th>
                      <th>Code100xxxxx</th>
                      <th>Code39xxxxxx</th>
                      <th>Depot</th>
                      <th>Company name</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAdmins.map((admin) => (
                      <tr
                        key={admin.uuid}
                        className={styles.clickableRow}
                        role="button"
                        tabIndex={0}
                        aria-label={`ดูข้อมูลแอดมินงานขาย ${admin.full_name || admin.depot_code || ''}`}
                        onClick={(event) => openAdmin(admin, event.currentTarget)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openAdmin(admin, event.currentTarget);
                          }
                        }}
                      >
                        <td>
                          {admin.image ? (
                            <img src={toImageSrc(admin.image, 160)} alt={admin.full_name || 'admin'} className={styles.thumb} loading="lazy" referrerPolicy="no-referrer" />
                          ) : <span className={styles.noImage}>—</span>}
                        </td>
                        <td>{admin.store_code_100xxx || '—'}</td>
                        <td>{admin.code_39xxx || '—'}</td>
                        <td>{admin.depot_code || '—'}</td>
                        <td>{admin.dealer_name || '—'}</td>
                        <td className={styles.name}>{admin.full_name || '—'}</td>
                        <td>{admin.phone_no || '—'}</td>
                        <td>{admin.store_email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <nav className={styles.pagination} aria-label="แบ่งหน้ารายชื่อแอดมินงานขาย">
                <span className={styles.pageInfo}>
                  แสดง {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredAdmins.length)} จาก {filteredAdmins.length} รายการ
                </span>
                <div className={styles.pageButtons}>
                  <button type="button" onClick={() => setPage(1)} disabled={currentPage === 1}>«</button>
                  <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>‹</button>
                  <span className={styles.pageCurrent}>หน้า {currentPage} / {totalPages}</span>
                  <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}>›</button>
                  <button type="button" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}>»</button>
                </div>
              </nav>
            </>
          )}
      </div>
      {selectedAdmin && createPortal(
        <div className={styles.detailOverlay} onClick={() => setSelectedAdmin(null)}>
          <div
            className={styles.detailModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sales-admin-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.detailHeader}>
              <h2 id="sales-admin-detail-title">ข้อมูลแอดมินงานขาย: {selectedAdmin.full_name || selectedAdmin.depot_code || '—'}</h2>
              <button ref={closeButtonRef} type="button" onClick={() => setSelectedAdmin(null)} aria-label="ปิดข้อมูลแอดมินงานขาย">×</button>
            </header>
            <div className={styles.detailBody}>
              <div className={styles.detailPhotoCard}>
                <span>รูปแอดมิน</span>
                {selectedAdmin.image ? (
                  <img
                    src={toImageSrc(selectedAdmin.image, 1200)}
                    alt={`รูป ${selectedAdmin.full_name || 'แอดมินงานขาย'}`}
                    referrerPolicy="no-referrer"
                  />
                ) : <div className={styles.detailNoImage}>ไม่มีรูปภาพ</div>}
              </div>
              <div className={styles.detailFields}>
                {([
                  ['Code100xxxxx', selectedAdmin.store_code_100xxx],
                  ['Code39xxxxxx', selectedAdmin.code_39xxx],
                  ['Depot', selectedAdmin.depot_code],
                  ['Company name', selectedAdmin.dealer_name],
                  ['Name', selectedAdmin.full_name],
                  ['Phone', selectedAdmin.phone_no],
                  ['Email', selectedAdmin.store_email],
                ] as const).map(([label, value]) => (
                  <div className={styles.detailField} key={label}>
                    <span>{label}</span>
                    <strong>{value?.trim() || '—'}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
