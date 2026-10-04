'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

type SalesAdmin = {
  uuid: string;
  timestamp: string | null;
  full_name: string | null;
  depot_code: string | null;
  store_code_100xxx: string | null;
  code_39xxx: string | null;
  dealer_name: string | null;
  phone_no: string | null;
  image: string | null;
  store_email: string | null;
  status: string | null;
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
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null);
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
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const filteredAdmins = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return admins;
    return admins.filter((admin) => [
      admin.full_name, admin.depot_code, admin.store_code_100xxx,
      admin.code_39xxx, admin.dealer_name, admin.phone_no, admin.store_email,
      admin.status,
    ].some((value) => value?.toLocaleLowerCase().includes(term)));
  }, [admins, query]);

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

  return (
    <>
      {!loading && !error && (
        <div className={styles.salesSummary}>
          <span className={styles.count}>{filteredAdmins.length.toLocaleString()} รายชื่อ</span>
          {updatedLabel && <span className={styles.count}>Data updated as {updatedLabel}</span>}
        </div>
      )}
      <div className={styles.card}>
        <label className={styles.searchLabel} htmlFor="admin-sale-search">ค้นหารายชื่อ</label>
        <input
          id="admin-sale-search"
          className={styles.search}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ชื่อ, Dealer, Depot, รหัสร้านค้า, โทรศัพท์ หรือสถานะ"
        />

        {loading ? <p className={styles.message}>กำลังโหลดข้อมูล...</p> :
          error ? <p className={styles.error} role="alert">{error}</p> :
          filteredAdmins.length === 0 ? <p className={styles.message}>ไม่พบรายชื่อแอดมินงานขาย</p> : (
            <>
              <div className={`${styles.tableWrap} ${styles.salesTableWrap}`}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Picture</th>
                      <th>Depot</th>
                      <th>Store code</th>
                      <th>Code 39xxx</th>
                      <th>Dealer</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Store email</th>
                      <th>Status</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAdmins.map((admin) => (
                      <tr key={admin.uuid}>
                        <td>
                          {admin.image ? (
                            <button
                              type="button"
                              className={styles.thumbButton}
                              onClick={() => setPreview({ src: toImageSrc(admin.image!, 1600), name: admin.full_name || '' })}
                              aria-label={`ขยายรูป ${admin.full_name || ''}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={toImageSrc(admin.image, 160)} alt={admin.full_name || 'admin'} className={styles.thumb} loading="lazy" referrerPolicy="no-referrer" />
                            </button>
                          ) : <span className={styles.noImage}>—</span>}
                        </td>
                        <td>{admin.depot_code || '—'}</td>
                        <td>{admin.store_code_100xxx || '—'}</td>
                        <td>{admin.code_39xxx || '—'}</td>
                        <td>{admin.dealer_name || '—'}</td>
                        <td className={styles.name}>{admin.full_name || '—'}</td>
                        <td>{admin.phone_no || '—'}</td>
                        <td>{admin.store_email || '—'}</td>
                        <td>{admin.status || '—'}</td>
                        <td>{admin.timestamp || '—'}</td>
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
      {preview && (
        <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label="รูปแอดมินงานขาย" onClick={() => setPreview(null)}>
          <figure className={styles.lightboxInner} onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.lightboxClose} onClick={() => setPreview(null)} aria-label="ปิด">×</button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.src} alt={preview.name || 'admin'} referrerPolicy="no-referrer" />
            {preview.name && <figcaption>{preview.name}</figcaption>}
          </figure>
        </div>
      )}
    </>
  );
}
