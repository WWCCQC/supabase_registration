'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SidebarLayout from '@/components/common/SidebarLayout';
import styles from './page.module.css';

type AdminTab = 'tol' | 'sales';

type TolAdmin = {
  uuid: string;
  staff_code: string | null;
  new_image: string | null;
  region: string | null;
  province: string | null;
  depot_code: string | null;
  sub_name: string | null;
  staff_name: string | null;
  function_admin: string | null;
  training_date: string | null;
};

const PAGE_SIZE = 25;

function getDriveFileId(url: string): string | null {
  const match = url.match(/[?&]id=([\w-]+)/) || url.match(/\/d\/([\w-]+)/);
  return match ? match[1] : null;
}

function toImageSrc(url: string, size: number): string {
  const id = getDriveFileId(url);
  return id && /drive\.google\.com|googleusercontent\.com/.test(url)
    ? `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`
    : url;
}

const columns: { key: Exclude<keyof TolAdmin, 'uuid' | 'staff_code'>; label: string }[] = [
  { key: 'new_image', label: 'new_image' },
  { key: 'region', label: 'region' },
  { key: 'province', label: 'province' },
  { key: 'depot_code', label: 'depot_code' },
  { key: 'sub_name', label: 'sub_name' },
  { key: 'staff_name', label: 'staff_name' },
  { key: 'function_admin', label: 'function_admin' },
  { key: 'training_date', label: 'training_date' },
];

const tabs: { id: AdminTab; label: string }[] = [
  { id: 'tol', label: 'แอดมินงานติดตั้งและงานซ่อม(TOL)' },
  { id: 'sales', label: 'แอดมินงานขาย' },
];

function AdminDirectoryContent() {
  const [activeTab, setActiveTab] = useState<AdminTab>('tol');
  const [admins, setAdmins] = useState<TolAdmin[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin-tol', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('ไม่สามารถโหลดข้อมูลแอดมินได้');
        return response.json();
      })
      .then((result: { data: TolAdmin[] }) => setAdmins(result.data))
      .catch((cause) => {
        if (cause.name !== 'AbortError') setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const filteredAdmins = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return admins;
    return admins.filter((admin) => [
      admin.staff_name, admin.sub_name, admin.depot_code, admin.province,
      admin.region, admin.function_admin, admin.training_date,
    ].some((value) => value?.toLocaleLowerCase().includes(term)));
  }, [admins, query]);

  const totalPages = Math.max(1, Math.ceil(filteredAdmins.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedAdmins = filteredAdmins.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const uniqueAdminCount = useMemo(() => new Set(
    filteredAdmins.map((admin) => admin.staff_code?.trim() || `row:${admin.uuid}`),
  ).size, [filteredAdmins]);

  const regionSummary = useMemo(() => {
    const clean = (value: string | null) => value?.trim() || '';
    type DepotGroup = { staff: Set<string>; subNames: Map<string, number> };
    const groups = new Map<string, { depots: Map<string, DepotGroup>; staff: Set<string> }>();
    const allDepots = new Set<string>();
    const allStaff = new Set<string>();
    for (const admin of admins) {
      const region = clean(admin.region) || 'ไม่ระบุ';
      const group = groups.get(region) ?? { depots: new Map<string, DepotGroup>(), staff: new Set<string>() };
      groups.set(region, group);
      const depot = clean(admin.depot_code);
      const staff = clean(admin.staff_code);
      if (staff) { group.staff.add(staff); allStaff.add(staff); }
      if (!depot) continue;
      allDepots.add(depot);
      const depotGroup = group.depots.get(depot) ?? { staff: new Set<string>(), subNames: new Map<string, number>() };
      group.depots.set(depot, depotGroup);
      if (staff) depotGroup.staff.add(staff);
      const subName = clean(admin.sub_name);
      if (subName) depotGroup.subNames.set(subName, (depotGroup.subNames.get(subName) ?? 0) + 1);
    }
    const byText = (a: string, b: string) => a.localeCompare(b, 'th', { numeric: true });
    const rows = Array.from(groups, ([region, { depots, staff }]) => ({
      region,
      depotCount: depots.size,
      adminCount: staff.size,
      depots: Array.from(depots, ([depotCode, { staff: depotStaff, subNames }]) => ({
        depotCode,
        // A depot can have spelling variants of the same company; show the most common one.
        subName: Array.from(subNames).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
        adminCount: depotStaff.size,
      })).sort((a, b) => byText(a.depotCode, b.depotCode)),
    })).sort((a, b) => byText(a.region, b.region));
    return { rows, totalDepots: allDepots.size, totalAdmins: allStaff.size };
  }, [admins]);

  useEffect(() => { setPage(1); }, [query]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const handleExport = () => {
    const rows = filteredAdmins.map((admin) =>
      Object.fromEntries(columns.map(({ key, label }) => [label, admin[key] ?? ''])));
    const sheet = XLSX.utils.json_to_sheet(rows, { header: columns.map((c) => c.label) });
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Admin TOL');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(book, `admin_tol_${stamp}.xlsx`);
  };

  const navigation = (
    <div className="navtabs" role="tablist" aria-label="ประเภทรายชื่อแอดมิน">
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`admin-directory-tab-${id}`}
          aria-selected={activeTab === id}
          aria-controls={`admin-directory-panel-${id}`}
          className={`navtab-item ${activeTab === id ? 'navtab-active' : ''}`}
          onClick={() => setActiveTab(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <SidebarLayout navigation={navigation}>
      <section
        id={`admin-directory-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`admin-directory-tab-${activeTab}`}
        className={styles.page}
      >
        <header className={styles.heading}>
          <div>
            <h1>รายชื่อแอดมิน</h1>
            <p>{activeTab === 'tol' ? 'แอดมินงานติดตั้งและงานซ่อม(TOL)' : 'แอดมินงานขาย'}</p>
          </div>
          {activeTab === 'tol' && !loading && !error && (
            <span className={styles.count}>{uniqueAdminCount.toLocaleString()} รายชื่อ</span>
          )}
        </header>

        {activeTab === 'tol' && !loading && !error && regionSummary.rows.length > 0 && (
          <div className={`${styles.card} ${styles.summaryCard}`}>
            <h2 className={styles.sectionTitle}>รายชื่อแอดมินตามพื้นที่</h2>
            <div className={`${styles.tableWrap} ${styles.summaryWrap}`}>
              <table className={`${styles.table} ${styles.summaryTable}`}>
                <thead>
                  <tr>
                    <th>region</th>
                    <th className={styles.num}>depot_code</th>
                    <th className={styles.num}>จำนวนแอดมิน</th>
                    <th className={styles.groupStart}>depot_code</th>
                    <th>sub_name</th>
                    <th className={styles.num}>จำนวนแอดมิน</th>
                  </tr>
                </thead>
                {regionSummary.rows.map((row) => {
                  const span = Math.max(1, row.depots.length);
                  const regionCells = (
                    <>
                      <td rowSpan={span} className={`${styles.name} ${styles.regionCell}`}>{row.region}</td>
                      <td rowSpan={span} className={`${styles.num} ${styles.regionCell}`}>{row.depotCount.toLocaleString()}</td>
                      <td rowSpan={span} className={`${styles.num} ${styles.regionCell}`}>{row.adminCount.toLocaleString()}</td>
                    </>
                  );
                  return (
                    <tbody key={row.region} className={styles.regionGroup}>
                      {row.depots.length === 0 ? (
                        <tr>{regionCells}<td className={styles.groupStart}>—</td><td>—</td><td className={styles.num}>—</td></tr>
                      ) : row.depots.map((depot, index) => (
                        <tr key={depot.depotCode}>
                          {index === 0 && regionCells}
                          <td className={styles.groupStart}>{depot.depotCode}</td>
                          <td>{depot.subName || '—'}</td>
                          <td className={styles.num}>{depot.adminCount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  );
                })}
                <tfoot>
                  <tr>
                    <td>รวม</td>
                    <td className={styles.num}>{regionSummary.totalDepots.toLocaleString()}</td>
                    <td className={styles.num}>{regionSummary.totalAdmins.toLocaleString()}</td>
                    <td className={styles.groupStart} colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'tol' ? (
          <div className={styles.card}>
            <div className={styles.toolbar}>
              <div className={styles.searchGroup}>
                <label className={styles.searchLabel} htmlFor="admin-directory-search">ค้นหารายชื่อ</label>
                <input
                  id="admin-directory-search"
                  className={styles.search}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ชื่อ, บริษัท, Depot, จังหวัด, Region หรือ Function"
                  type="search"
                />
              </div>
              <button
                id="admin-directory-export"
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
              filteredAdmins.length === 0 ? <p className={styles.message}>ไม่พบรายชื่อแอดมิน</p> : (
                <>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        {columns.map(({ key, label }) => <th key={key}>{label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedAdmins.map((admin) => (
                        <tr key={admin.uuid}>
                          <td>
                            {admin.new_image ? (
                              <button
                                type="button"
                                className={styles.thumbButton}
                                onClick={() => setPreview({ src: toImageSrc(admin.new_image!, 1600), name: admin.staff_name || '' })}
                                aria-label={`ขยายรูป ${admin.staff_name || ''}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={toImageSrc(admin.new_image, 160)} alt={admin.staff_name || 'admin'} className={styles.thumb} loading="lazy" referrerPolicy="no-referrer" />
                              </button>
                            ) : <span className={styles.noImage}>—</span>}
                          </td>
                          <td>{admin.region || '—'}</td>
                          <td>{admin.province || '—'}</td>
                          <td>{admin.depot_code || '—'}</td>
                          <td>{admin.sub_name || '—'}</td>
                          <td className={styles.name}>{admin.staff_name || '—'}</td>
                          <td>{admin.function_admin || '—'}</td>
                          <td>{admin.training_date || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <nav className={styles.pagination} aria-label="แบ่งหน้า">
                  <span className={styles.pageInfo}>
                    แสดง {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredAdmins.length)} จาก {filteredAdmins.length} รายการ
                  </span>
                  <div className={styles.pageButtons}>
                    <button id="admin-directory-first" type="button" onClick={() => setPage(1)} disabled={currentPage === 1}>«</button>
                    <button id="admin-directory-prev" type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>‹</button>
                    <span className={styles.pageCurrent}>หน้า {currentPage} / {totalPages}</span>
                    <button id="admin-directory-next" type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}>›</button>
                    <button id="admin-directory-last" type="button" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}>»</button>
                  </div>
                </nav>
                </>
              )}
          </div>
        ) : (
          <div className={styles.emptyState}>ยังไม่มีข้อมูลแอดมินงานขาย</div>
        )}

        {preview && (
          <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label="รูปแอดมิน" onClick={() => setPreview(null)}>
            <figure className={styles.lightboxInner} onClick={(event) => event.stopPropagation()}>
              <button type="button" className={styles.lightboxClose} onClick={() => setPreview(null)} aria-label="ปิด">×</button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.src} alt={preview.name || 'admin'} referrerPolicy="no-referrer" />
              {preview.name && <figcaption>{preview.name}</figcaption>}
            </figure>
          </div>
        )}
      </section>
    </SidebarLayout>
  );
}

export default function AdminDirectoryPage() {
  return (
    <ProtectedRoute>
      <AdminDirectoryContent />
    </ProtectedRoute>
  );
}
