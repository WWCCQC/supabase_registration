"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Download, Search, UserRound, X } from "lucide-react";
import type { DepotPerson, DepotWorkgroup, DepotWorkgroupsResponse } from "@/lib/depotWorkgroups";
import { WORK_TYPE_LABEL } from "@/lib/workTypes";
import { useToast } from "../common/Toast";
import styles from "./TechnicianByDepot.module.css";

/** Rows per page — caps how many photo thumbnails one page can request. */
const PAGE_SIZE = 100;
const fmt = (n: number) => n.toLocaleString("en-US");
const proxyImg = (u: string, thumb: boolean) => `/api/img?${thumb ? "thumb=1&" : ""}u=${encodeURIComponent(u)}`;
const workTypeLabel = (w: string) => WORK_TYPE_LABEL[w as keyof typeof WORK_TYPE_LABEL] ?? w;

function Person({ person, role, onPreview }: { person: DepotPerson; role: "head" | "member"; onPreview: (p: DepotPerson) => void }) {
  return (
    <span className={role === "head" ? styles.personHead : styles.person}>
      {person.photo ? (
        <button type="button" className={styles.photoButton} onClick={() => onPreview(person)} aria-label={`ดูรูป ${person.name}`}>
          <img
            src={proxyImg(person.photo, true)}
            alt=""
            className={styles.photo}
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.25"; }}
          />
        </button>
      ) : (
        <span className={styles.photoEmpty} aria-hidden="true"><UserRound size={16} /></span>
      )}
      <span className={styles.personText}>
        <span className={styles.personName}>{person.name}</span>
        {person.techId && <span className={styles.personId}>{person.techId}</span>}
      </span>
    </span>
  );
}

type StatCardProps =
  | { variant: "hero"; label: string; value: number | null; footer: string }
  | { variant: "share"; label: string; value: number | null; total: number };

function StatCard(props: StatCardProps) {
  const { label, value } = props;
  const loading = value === null;
  const number = loading ? <span className="skeleton skeleton-kpi-number" /> : fmt(value);
  if (props.variant === "hero") {
    return (
      <div className={styles.statHero}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statNumber}>{number}</span>
        <span className={styles.statFooter}>{props.footer}</span>
      </div>
    );
  }
  const pct = !loading && props.total > 0 ? (value / props.total) * 100 : 0;
  return (
    <div className={styles.statShare}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statNumber}>{number}</span>
      <span className={styles.statPct}>{loading ? "" : `${pct.toFixed(1)}%`}</span>
      <span className={styles.statBar}><span style={{ width: `${loading ? 0 : Math.max(pct > 0 ? 4 : 0, Math.min(100, pct))}%` }} /></span>
    </div>
  );
}

/** Workgroups (head + paired members, with photos) by RBM, CBM, province and depot. */
export default function TechnicianByDepot() {
  const [data, setData] = React.useState<DepotWorkgroupsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [rbm, setRbm] = React.useState("");
  const [workType, setWorkType] = React.useState("");
  const [preview, setPreview] = React.useState<DepotPerson | null>(null);
  const [page, setPage] = React.useState(1);
  const [exporting, setExporting] = React.useState(false);
  const tableWrapRef = React.useRef<HTMLDivElement>(null);
  const showToast = useToast();

  React.useEffect(() => {
    const controller = new AbortController();
    fetch("/api/technician-by-depot", { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        setData(body);
      })
      .catch((e) => { if (e.name !== "AbortError") setError(e.message || "โหลดข้อมูลไม่สำเร็จ"); });
    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const rbmOptions = React.useMemo(() => [...new Set((data?.workgroups ?? []).map((w) => w.rbm).filter(Boolean))].sort(), [data]);
  const workTypeOptions = React.useMemo(() => [...new Set((data?.workgroups ?? []).map((w) => w.workType).filter(Boolean))].sort(), [data]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.workgroups ?? []).filter((w) => {
      if (rbm && w.rbm !== rbm) return false;
      if (workType && w.workType !== workType) return false;
      if (!q) return true;
      const people = [w.head, ...w.members].filter(Boolean) as DepotPerson[];
      return (
        [w.cbm, w.province, w.depot, w.depotCode, w.teamName].some((v) => v.toLowerCase().includes(q)) ||
        people.some((p) => p.name.toLowerCase().includes(q) || (p.techId ?? "").toLowerCase().includes(q))
      );
    });
  }, [data, query, rbm, workType]);

  const summary = React.useMemo(() => {
    const withHead = filtered.filter((w) => w.head);
    const members = filtered.reduce((n, w) => n + w.members.length, 0);
    return { workgroups: withHead.length, members, people: withHead.length + members, depots: new Set(filtered.map((w) => w.depot)).size };
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const goToPage = (next: number) => {
    setPage(next);
    tableWrapRef.current?.scrollTo({ top: 0 });
  };
  // Any filter change starts again from page 1.
  const filterChange = <T,>(set: (v: T) => void) => (v: T) => { set(v); goToPage(1); };

  /**
   * Every filtered row (all pages) in the on-screen layout: one line per workgroup, the head and each paired
   * member side by side (ลูกน้อง 1, 2, … columns). Text only — photos are left out to keep the file light.
   */
  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const maxMembers = Math.max(0, ...filtered.map((w) => w.members.length));
      const header = [
        "RBM", "CBM", "จังหวัด", "Depot", "Depot code", "ประเภทงาน", "Team name", "รหัสหัวหน้า", "หัวหน้า",
        ...Array.from({ length: maxMembers }, (_, i) => [`รหัสลูกน้อง ${i + 1}`, `ลูกน้อง ${i + 1}`]).flat(),
      ];
      const lines = filtered.map((w) => [
        w.rbm, w.cbm, w.province, w.depot, w.depotCode, workTypeLabel(w.workType), w.teamName,
        w.head?.techId ?? "", w.head?.name ?? "ไม่พบหัวหน้า",
        ...Array.from({ length: maxMembers }, (_, i) => [w.members[i]?.techId ?? "", w.members[i]?.name ?? ""]).flat(),
      ]);
      const sheet = XLSX.utils.aoa_to_sheet([header, ...lines]);
      sheet["!cols"] = [14, 40, 18, 30, 14, 14, 30, 12, 24, ...Array.from({ length: maxMembers }, () => [12, 24]).flat()].map((wch) => ({ wch }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Technician by depot");
      XLSX.writeFile(book, `technician_by_depot_${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
    } catch (e) {
      console.error("Technician by depot export failed:", e);
      showToast(`Export ไม่สำเร็จ: ${(e as Error).message}`, "error");
    } finally {
      setExporting(false);
    }
  }

  if (error) return <p className={styles.error} role="alert">{error}</p>;

  return (
    <section className={styles.wrap} aria-label="Technician by depot">
      {/* Same dark slate cards as the Summary tab KPIs; the split cards add a share bar. */}
      <div className={styles.stats}>
        <StatCard variant="hero" label="ช่างทั้งหมด (คน)" value={data ? summary.people : null} footer="100% (คน)" />
        <StatCard variant="share" label="กองงาน (หัวหน้า)" value={data ? summary.workgroups : null} total={summary.people} />
        <StatCard variant="share" label="ลูกน้อง" value={data ? summary.members : null} total={summary.people} />
        <StatCard variant="hero" label="Depot" value={data ? summary.depots : null} footer="แห่ง" />
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Search size={14} aria-hidden="true" />
            <input value={query} onChange={(e) => filterChange(setQuery)(e.target.value)} placeholder="ค้นหาชื่อช่าง, รหัสช่าง, Depot, Team name, จังหวัด" aria-label="ค้นหา" />
          </label>
          <select value={rbm} onChange={(e) => filterChange(setRbm)(e.target.value)} aria-label="กรอง RBM" className={styles.select}>
            <option value="">ทุก RBM</option>
            {rbmOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={workType} onChange={(e) => filterChange(setWorkType)(e.target.value)} aria-label="กรองประเภทงาน" className={styles.select}>
            <option value="">ทุกประเภทงาน</option>
            {workTypeOptions.map((w) => <option key={w} value={w}>{workTypeLabel(w)}</option>)}
          </select>
          <button type="button" className="filter-btn filter-btn-export" onClick={exportExcel} disabled={!data || filtered.length === 0 || exporting}>
            <Download size={16} aria-hidden="true" /> {exporting ? "กำลัง Export..." : "Export Excel"}
          </button>
        </div>

        <div className={styles.tableWrap} ref={tableWrapRef}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>RBM</th><th>CBM</th><th>จังหวัด</th><th>Depot</th><th>Depot code</th><th>ประเภทงาน</th><th>Team name</th>
                <th>หัวหน้า</th><th>ลูกน้อง</th>
              </tr>
            </thead>
            <tbody>
              {!data &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}><td colSpan={9}><span className="skeleton-light" style={{ display: "block", height: 36 }} /></td></tr>
                ))}
              {data && filtered.length === 0 && (
                <tr><td colSpan={9} className={styles.empty}>ไม่พบข้อมูลตามตัวกรอง</td></tr>
              )}
              {pageRows.map((w: DepotWorkgroup) => (
                <tr key={w.id} className={w.head ? undefined : styles.unpairedRow}>
                  <td className={styles.nowrap}><span className={styles.rbm}>{w.rbm || "—"}</span></td>
                  <td className={styles.cbm}>{w.cbm || "—"}</td>
                  <td className={styles.nowrap}>{w.province || "—"}</td>
                  <td className={styles.depot}>{w.depot || "—"}</td>
                  <td className={styles.code}>{w.depotCode || "—"}</td>
                  <td className={styles.nowrap}>
                    <span className={w.workType === "Repair" ? styles.typeRepair : styles.typeInstall}>{workTypeLabel(w.workType) || "—"}</span>
                  </td>
                  <td className={styles.team}>{w.teamName || "—"}</td>
                  <td>
                    {w.head ? <Person person={w.head} role="head" onPreview={setPreview} /> : <span className={styles.noHead}>ไม่พบหัวหน้า</span>}
                  </td>
                  <td>
                    {w.members.length ? (
                      <span className={styles.members}>{w.members.map((m, i) => <Person key={`${m.techId ?? m.name}-${i}`} person={m} role="member" onPreview={setPreview} />)}</span>
                    ) : (
                      <span className={styles.solo}>ไม่มีลูกน้อง</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && filtered.length > 0 && (
          <div className={styles.pager}>
            <span>
              แสดง {fmt((currentPage - 1) * PAGE_SIZE + 1)}–{fmt(Math.min(currentPage * PAGE_SIZE, filtered.length))} จาก {fmt(filtered.length)} แถว
            </span>
            <span className={styles.pagerButtons}>
              <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="หน้าก่อนหน้า"><ChevronLeft size={16} /></button>
              <span>หน้า {currentPage} / {pageCount}</span>
              <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pageCount} aria-label="หน้าถัดไป"><ChevronRight size={16} /></button>
            </span>
          </div>
        )}
      </div>

      {preview?.photo && (
        <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={preview.name} onClick={() => setPreview(null)}>
          <figure className={styles.lightboxFigure} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.lightboxClose} onClick={() => setPreview(null)} aria-label="ปิด" autoFocus><X size={18} /></button>
            <img src={proxyImg(preview.photo, false)} alt={preview.name} />
            <figcaption>{preview.name}{preview.techId ? ` · ${preview.techId}` : ""}</figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
