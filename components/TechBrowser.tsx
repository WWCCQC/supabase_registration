"use client";
import React from "react";

/* ---------- Types ---------- */
type Row = { [key: string]: any };

type KpiResp = {
  total: number;
  by_work_type: { key: string; count: number; percent: number }[];
  by_provider: { key: string; count: number; percent: number }[];
};

/* ---------- Utils ---------- */
function useDebounced<T>(value: T, delay = 400) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

function proxyImg(u: string, thumb = false) {
  return `/api/img?${thumb ? "thumb=1&" : ""}u=${encodeURIComponent(u)}`;
}

/** คอลัมน์ที่ “ตาราง” ต้องแสดง (ซ่อน ctm โดยเอาออก) */
const COLS = [
  "national_id",
  "tech_id",
  "full_name",
  "doc_tech_card_url",
  "workgroup_status",
  "work_type",
  "provider",
  "area",
  "rsm",
  "depot_code",
  "depot_name",
  "province",
] as const;

/** ความกว้างต่อคอลัมน์ (px) */
const WIDTHS: Partial<Record<(typeof COLS)[number], number>> = {
  national_id: 140,
  tech_id: 120,
  full_name: 220,
  doc_tech_card_url: 90,
  workgroup_status: 160,
  work_type: 130,
  provider: 140,
  area: 140,
  rsm: 120,
  depot_code: 120,
  depot_name: 200,
  province: 160,
};

/* ---------- Component ---------- */
export default function TechBrowser() {
  /* table state */
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);

  /* filters */
  const [national_id, setNationalId] = React.useState("");
  const [tech_id, setTechId] = React.useState("");
  const [rsm, setRsm] = React.useState("");
  const [depot_code, setDepotCode] = React.useState("");
  const [q, setQ] = React.useState("");

  const d_national_id = useDebounced(national_id);
  const d_tech_id = useDebounced(tech_id);
  const d_rsm = useDebounced(rsm);
  const d_depot_code = useDebounced(depot_code);
  const d_q = useDebounced(q);

  /* rsm options for select */
  const [rsmOptions, setRsmOptions] = React.useState<string[]>([]);
  const [rsmLoading, setRsmLoading] = React.useState(false);

  /* sort */
  const [sort, setSort] =
    React.useState<(typeof COLS)[number]>("national_id");
  const [dir, setDir] = React.useState<"asc" | "desc">("asc");

  /* preview image */
  const [preview, setPreview] = React.useState<string | null>(null);

  /* detail popup (full-width modal) */
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailRow, setDetailRow] = React.useState<Row | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  /* KPI */
  const [kpi, setKpi] = React.useState<KpiResp | null>(null);
  const [kpiLoading, setKpiLoading] = React.useState(false);

  /* ----- helpers ----- */
  function buildParams(p = page, size = 50) {
    const params = new URLSearchParams({
      page: String(p),
      pageSize: String(size),
      sort,
      dir,
    });
    if (d_national_id) params.set("national_id", d_national_id);
    if (d_tech_id) params.set("tech_id", d_tech_id);
    if (d_rsm) params.set("rsm", d_rsm);
    if (d_depot_code) params.set("depot_code", d_depot_code);
    if (d_q) params.set("q", d_q);
    return params;
  }

  function buildFilterParamsOnly() {
    const p = new URLSearchParams();
    if (d_national_id) p.set("f_national_id", d_national_id);
    if (d_tech_id) p.set("f_tech_id", d_tech_id);
    if (d_rsm) p.set("f_rsm", d_rsm);
    if (d_depot_code) p.set("f_depot_code", d_depot_code);
    if (d_q) p.set("q", d_q);
    return p;
  }

  async function fetchData(p = page) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/technicians?${buildParams(p).toString()}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch");
      setRows(json.rows || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
      setPage(json.page || p);
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchKpis() {
    setKpiLoading(true);
    try {
      const res = await fetch(
        `/api/kpis?${buildFilterParamsOnly().toString()}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "KPI fetch error");
      setKpi(json);
    } catch (e) {
      console.error(e);
    } finally {
      setKpiLoading(false);
    }
  }

  /** ดึงรายการ RSM สำหรับ select (มี fallback จากข้อมูลช่างหน้าแรก) */
  async function fetchRsmOptions() {
    setRsmLoading(true);
    try {
      // 1) พยายามดึงจาก API โดยตรง
      const res = await fetch(`/api/rsm`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        const list: string[] = Array.isArray(json?.rsmList)
          ? json.rsmList
          : Array.isArray(json) ? json : [];
        const uniq = Array.from(new Set(list.filter(Boolean))).sort(
          (a, b) => a.localeCompare(b, "th")
        );
        setRsmOptions(uniq);
        return;
      }
      // 2) ถ้า API ไม่พร้อม → fallback ไปอ่านจาก technicians หน้าแรก
      const params = new URLSearchParams({ page: "1", pageSize: "200" });
      const res2 = await fetch(`/api/technicians?${params.toString()}`, {
        cache: "no-store",
      });
      const json2 = await res2.json();
      const uniq2 = Array.from(
        new Set<string>((json2?.rows || []).map((x: Row) => String(x?.rsm || "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "th"));
      setRsmOptions(uniq2);
    } catch (e) {
      console.error(e);
      setRsmOptions((prev) => prev); // คงค่าเดิมไว้ถ้าพัง
    } finally {
      setRsmLoading(false);
    }
  }

  function clearFilters() {
    setNationalId("");
    setTechId("");
    setRsm("");
    setDepotCode("");
    setQ("");
  }

  function toggleSort(c: (typeof COLS)[number]) {
    if (sort === c) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(c);
      setDir("asc");
    }
  }

  async function exportExcel() {
    try {
      setLoading(true);
      const XLSX = await import("xlsx");
      const pageSize = 200;
      let p = 1;
      const all: Row[] = [];
      while (true) {
        const params = buildParams(p, pageSize);
        const res = await fetch(`/api/technicians?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Export fetch failed");
        all.push(...(json.rows || []));
        if (p >= (json.totalPages || 1)) break;
        p++;
      }
      const ws = XLSX.utils.json_to_sheet(all);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "technicians");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `technicians_${date}.xlsx`);
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  /** เปิด popup แล้วโหลด “ข้อมูลเต็มแถว” จาก /api/technicians/[tech_id] */
  async function openDetail(fullRowCandidate: Row) {
    const id =
      (fullRowCandidate?.tech_id || "").toString().trim() ||
      (fullRowCandidate?.national_id || "").toString().trim();

    if (!id) {
      alert("ไม่พบ tech_id / national_id สำหรับดึงรายละเอียด");
      return;
    }

    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailRow(null);

    try {
      const res = await fetch(`/api/technicians/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "โหลดรายละเอียดไม่สำเร็จ");
      setDetailRow(json.row || json.data || null);
    } catch (e) {
      console.error(e);
      setDetailError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }

  React.useEffect(() => {
    fetchData(1);
  }, [d_national_id, d_tech_id, d_rsm, d_depot_code, d_q, sort, dir]);

  React.useEffect(() => {
    fetchData(page);
  }, [page]);

  React.useEffect(() => {
    fetchKpis();
  }, [d_national_id, d_tech_id, d_rsm, d_depot_code, d_q]);

  /* ดึงรายการ RSM ตอน mount */
  React.useEffect(() => {
    fetchRsmOptions();
  }, []);

  const start = (page - 1) * 50 + 1;
  const end = Math.min(total, page * 50);

  /* ---------- Render ---------- */
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        Technicians
      </h2>

      {/* ===== KPI row ===== */}
      <div style={{ overflowX: "auto", paddingBottom: 8 }}>
        <div
          style={{
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "minmax(220px, 1fr)",
            gap: 12,
            alignItems: "stretch",
            minHeight: 130,
          }}
        >
          {/* Total */}
          <div
            style={{
              ...cardStyle,
              cursor: "pointer",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
            }}
            onClick={() => {
              clearFilters();
              setQ("");
            }}
            title="คลิกเพื่อล้างตัวกรองทั้งหมด"
          >
            <div style={{ ...cardTitle, color: "rgba(255,255,255,0.8)" }}>
              Technicians ทั้งหมด
            </div>
            <div style={{ ...cardNumber, color: "white" }}>
              {kpiLoading ? "..." : kpi?.total ?? 0}
            </div>
          </div>

          {/* Work Type: Installation, Repair */}
          {["Installation", "Repair"].map((name, index) => {
            const f = (kpi?.by_work_type || []).find(
              (x) =>
                (x.key || "").trim().toLowerCase() === name.toLowerCase()
            );
            const count = f?.count ?? 0;
            const pct = f?.percent ?? 0;

            const colors = [
              { bg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", text: "white" },
              { bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", text: "white" },
            ];

            return (
              <div
                key={name}
                style={{
                  ...cardStyle,
                  cursor: "pointer",
                  background: colors[index].bg,
                  color: colors[index].text,
                  border: "none",
                }}
                onClick={() => {
                  clearFilters();
                  setQ(name);
                }}
                title={`คลิกเพื่อกรองตาม ${name}`}
              >
                <div style={{ ...cardTitle, color: "rgba(255,255,255,0.8)" }}>
                  {name}
                </div>
                <div style={{ ...cardNumber, color: "white" }}>
                  {kpiLoading ? "" : count}
                </div>
                <div style={{ ...cardSub, color: "rgba(255,255,255,0.8)" }}>
                  {kpiLoading ? "" : `${pct}%`}
                </div>
              </div>
            );
          })}

          {/* Provider */}
          {["WW-Provider", "True Tech", "เถ้าแก่เทค"].map((name, index) => {
            const f = (kpi?.by_provider || []).find(
              (x) =>
                (x.key || "").trim().toLowerCase() === name.toLowerCase()
            );
            const count = f?.count ?? 0;
            const pct = f?.percent ?? 0;

            const colors = [
              { bg: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", text: "white" },
              { bg: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", text: "white" },
              { bg: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)", text: "#333" },
            ];

            return (
              <div
                key={name}
                style={{
                  ...cardStyle,
                  cursor: "pointer",
                  background: colors[index].bg,
                  color: colors[index].text,
                  border: "none",
                }}
                onClick={() => {
                  clearFilters();
                  setQ(name);
                }}
                title={`คลิกเพื่อกรองตาม ${name}`}
              >
                <div
                  style={{
                    ...cardTitle,
                    color:
                      name === "เถ้าแก่เทค"
                        ? "rgba(0,0,0,0.7)"
                        : "rgba(255,255,255,0.8)",
                  }}
                >
                  {name}
                </div>
                <div
                  style={{
                    ...cardNumber,
                    color: name === "เถ้าแก่เทค" ? "#333" : "white",
                  }}
                >
                  {kpiLoading ? "" : count}
                </div>
                <div
                  style={{
                    ...cardSub,
                    color:
                      name === "เถ้าแก่เทค"
                        ? "rgba(0,0,0,0.7)"
                        : "rgba(255,255,255,0.8)",
                  }}
                >
                  {kpiLoading ? "" : `${pct}%`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* ===== /KPI row ===== */}

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <input
          placeholder="national_id"
          value={national_id}
          onChange={(e) => setNationalId(e.target.value)}
        />
        <input
          placeholder="tech_id"
          value={tech_id}
          onChange={(e) => setTechId(e.target.value)}
        />

        {/* RSM → select */}
        <select
          value={rsm}
          onChange={(e) => setRsm(e.target.value)}
          disabled={rsmLoading}
          title="เลือก RSM"
          style={{ height: 28 }}
        >
          <option value="">{rsmLoading ? "กำลังโหลด..." : "— RSM ทั้งหมด —"}</option>
          {rsmOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <input
          placeholder="depot_code"
          value={depot_code}
          onChange={(e) => setDepotCode(e.target.value)}
        />
        <input
          placeholder="ค้นหา (พิมพ์อะไรก็ได้)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <button onClick={() => fetchData(1)} disabled={loading}>
          ค้นหา
        </button>
        <button onClick={clearFilters} disabled={loading}>
          ล้างตัวกรอง
        </button>
        <button onClick={exportExcel} disabled={loading}>
          Export Excel
        </button>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#555" }}>
          {loading ? "กำลังโหลด..." : `${start}-${end} จาก ${total} รายการ`}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 1200, fontSize: 14 }}>
          <thead>
            <tr>
              {COLS.map((h) => (
                <th
                  key={h}
                  onClick={() => toggleSort(h)}
                  title="คลิกเพื่อเรียงลำดับ"
                  style={{
                    border: "1px solid #ddd",
                    padding: "6px 8px",
                    textAlign: "left",
                    background: "#f7f7f7",
                    cursor: "pointer",
                    userSelect: "none",
                    width: WIDTHS[h],
                    minWidth: WIDTHS[h],
                  }}
                >
                  {h}
                  {sort === h ? (dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.national_id ?? r.tech_id ?? i}-${i}`}>
                {COLS.map((c) => (
                  <td
                    key={c}
                    style={{
                      border: "1px solid #eee",
                      padding: "6px 8px",
                      whiteSpace: "nowrap",
                      width: WIDTHS[c],
                      minWidth: WIDTHS[c],
                    }}
                  >
                    {c === "doc_tech_card_url" ? (
                      (() => {
                        const original = r.doc_tech_card_url || r.tech_card_url || "";
                        if (!original) return "";
                        const imgThumb = proxyImg(original, true);
                        const imgFull = proxyImg(original, false);
                        return (
                          <img
                            src={imgThumb}
                            alt="tech card"
                            loading="lazy"
                            style={{
                              width: 56,
                              height: 56,
                              objectFit: "cover",
                              borderRadius: 6,
                              cursor: "zoom-in",
                              boxShadow: "0 0 0 1px #ddd inset",
                            }}
                            onClick={() => setPreview(imgFull)}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                            }}
                          />
                        );
                      })()
                    ) : c === "national_id" || c === "tech_id" ? (
                      <span
                        style={{
                          color: "#2563eb",
                          cursor: "pointer",
                          textDecoration: "underline",
                          fontWeight: 500,
                        }}
                        onClick={() => openDetail(r)}
                        title="คลิกเพื่อดูข้อมูลทั้งหมด"
                      >
                        {r[c] ?? ""}
                      </span>
                    ) : (
                      r[c] ?? ""
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length} style={{ padding: 12, textAlign: "center", color: "#777" }}>
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
          หน้าก่อน
        </button>
        <span style={{ fontSize: 13 }}>
          หน้า {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || loading}
        >
          หน้าถัดไป
        </button>
      </div>

      {/* Lightbox */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <img
            src={preview}
            alt="preview"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPreview(null)}
            style={{
              position: "fixed",
              top: 16,
              right: 16,
              fontSize: 24,
              color: "#fff",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}

      {/* Detail Popup — PORTFOLIO (FULL WIDTH) */}
      {detailOpen && (
        <div
          onClick={() => setDetailOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: 12,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              width: "96vw",
              maxWidth: "1600px",
              height: "90vh",
              overflow: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,.3)",
              minWidth: 520,
            }}
          >
            {/* Header sticky */}
            <div style={{ position: "sticky", top: 0, background: "#fff", paddingBottom: 12, marginBottom: 12, zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#1f2937" }}>
                    ข้อมูลช่าง: {detailRow?.full_name || detailRow?.tech_id || detailRow?.national_id || "-"}
                  </h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#6b7280" }}>
                    {detailLoading
                      ? "กำลังโหลดรายละเอียด..."
                      : detailError
                      ? "เกิดข้อผิดพลาด"
                      : `แสดงข้อมูลทั้งหมด ${Object.keys(detailRow || {}).length} ฟิลด์จาก Supabase`}
                  </p>
                </div>
                <button
                  onClick={() => setDetailOpen(false)}
                  style={{ background: "transparent", border: "none", fontSize: 24, cursor: "pointer", color: "#6b7280" }}
                >
                  ×
                </button>
              </div>
              {detailError && (
                <div style={{ color: "#b91c1c", marginTop: 8 }}>Error: {detailError}</div>
              )}
            </div>

            {/* ====== Portfolio layout ====== */}
            {detailRow && (
              <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
                {/* LEFT — photo sticky */}
                <div style={{ position: "sticky", top: 64, alignSelf: "start" }}>
                  <PhotoCard row={detailRow!} />
                </div>

                {/* RIGHT — summary + sections */}
                <div>
                  {/* Identity row beside photo (UPDATED order/fields) */}
                  <SummaryRow row={detailRow!} />

                  {/* Sections */}
                  <Section title="Section 1: ข้อมูลพื้นฐาน (Basic Information)">
                    <Field row={detailRow!} label="เพศ" keys={["gender"]} />
                    <Field row={detailRow!} label="อายุ" keys={["age"]} />
                    <Field row={detailRow!} label="ระดับการศึกษา" keys={["degree"]} />
                    <Field row={detailRow!} label="สถานะกลุ่มงาน" keys={["workgroup_status","status"]} />
                    <Field row={detailRow!} label="ประเภทงาน/ทีม" keys={["work_type","team_type"]} />
                    <Field row={detailRow!} label="บริษัท" keys={["provider"]} />
                  </Section>

                  <Section title="Section 2: พื้นที่รับงาน (Area Service)">
                    <Field row={detailRow!} label="พื้นที่" keys={["area"]} />
                    <Field row={detailRow!} label="จังหวัด" keys={["province","ctm_province"]} />
                    <Field row={detailRow!} label="RSM" keys={["rsm"]} />
                    <Field row={detailRow!} label="CTM" keys={["ctm"]} />
                    <Field row={detailRow!} label="รหัสคลัง" keys={["depot_code"]} />
                    <Field row={detailRow!} label="ชื่อคลัง" keys={["depot_name"]} />
                  </Section>

                  <Section title="Section 3: ข้อมูลบริการ (Services)">
                    {[
                      ["SVC Install", ["svc_install","service_install"]],
                      ["SVC Repair", ["svc_repair","service_repair"]],
                      ["SVC OJT", ["svc_ojt"]],
                      ["SVC Safety", ["svc_safety"]],
                      ["SVC Softskill", ["svc_softskill"]],
                      ["SVC 5P", ["svc_5p"]],
                      ["SVC Nonstandard", ["svc_nonstandard"]],
                      ["SVC Corporate", ["svc_corporate"]],
                      ["SVC Solar", ["svc_solar"]],
                      ["SVC FTTR", ["svc_fttr"]],
                      ["SVC 2G", ["svc_2g"]],
                      ["SVC CCTV", ["svc_cctv"]],
                      ["SVC CYOD", ["svc_cyod"]],
                      ["SVC Dongle", ["svc_dongle"]],
                      ["SVC IOT", ["svc_iot"]],
                      ["SVC Gigatex", ["svc_gigatex"]],
                      ["SVC Wifi", ["svc_wifi"]],
                      ["SVC Smarthome", ["svc_smarthome"]],
                      ["SVC CATV Settop Box", ["svc_catv_settop"]],
                      ["SVC True ID", ["svc_true_id"]],
                      ["SVC True Inno", ["svc_true_inno"]],
                      ["SVC L3", ["svc_l3"]],
                    ].map(([label, keys]) => (
                      <Field key={String(label)} row={detailRow!} label={String(label)} keys={keys as string[]} />
                    ))}
                  </Section>

                  <Section title="Section 4: ข้อมูลอำนาจและความปลอดภัย (Authority & Safety)">
                    <Field row={detailRow!} label="Power Authority" keys={["power_authority"]} />
                    <Field row={detailRow!} label="Power Card Start Date" keys={["power_card_start_date"]} isDate />
                    <Field row={detailRow!} label="Power Card Expire Date" keys={["power_card_expire_date","card_expire_date"]} isDate />
                    <Field row={detailRow!} label="SSO Number" keys={["sso_number"]} />
                    <Field row={detailRow!} label="Safety Officer Executive" keys={["safety_officer_executive"]} />
                    <Field row={detailRow!} label="Safety Officer Supervisor" keys={["safety_officer_supervisor"]} />
                    <Field row={detailRow!} label="Safety Officer Technical" keys={["safety_officer_technical"]} />
                  </Section>

                  <Section title="Section 5: ข้อมูลรถยนต์ (Vehicle Information)">
                    <Field row={detailRow!} label="Car Brand Code" keys={["car_brand_code"]} />
                    <Field row={detailRow!} label="Car Model" keys={["car_model"]} />
                    <Field row={detailRow!} label="Car Color" keys={["car_color"]} />
                    <Field row={detailRow!} label="Car License Plate" keys={["car_license_plate"]} />
                    <Field row={detailRow!} label="Car Reg Province" keys={["car_reg_province"]} />
                    <Field row={detailRow!} label="Car Type" keys={["car_type"]} />
                    <Field row={detailRow!} label="Equip Carryboy" keys={["equip_carryboy"]} />
                  </Section>

                  <Section title="Section 6: ข้อมูลเอกสาร (Documents)">
                    <DocField row={detailRow!} label="Doc Tech Card URL" keys={["doc_tech_card_url","tech_card_url"]} />
                    <DocField row={detailRow!} label="Doc ID Card URL" keys={["doc_id_card_url"]} />
                    <DocField row={detailRow!} label="Doc Driver License URL" keys={["doc_driver_license_url"]} />
                    <DocField row={detailRow!} label="Doc Education Certificate URL" keys={["doc_education_certificate_url"]} />
                    <DocField row={detailRow!} label="Doc Criminal Record URL" keys={["doc_criminal_record_url"]} />
                    <DocField row={detailRow!} label="Doc Medical Certificate URL" keys={["doc_medical_certificate_url"]} />
                    <DocField row={detailRow!} label="Doc Power Authority Card URL" keys={["doc_power_authority_card_url"]} />
                    <DocField row={detailRow!} label="Doc Safety Officer Executive URL" keys={["doc_safety_officer_executive_url"]} />
                    <DocField row={detailRow!} label="Doc Safety Officer Supervisor URL" keys={["doc_safety_officer_supervisor_url"]} />
                    <DocField row={detailRow!} label="Doc Safety Officer Technical URL" keys={["doc_safety_officer_technical_url"]} />
                  </Section>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Reusable UI for the modal ---------- */
function SummaryRow({ row }: { row: Row }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 12,
      marginBottom: 16,
    }}>
      <SummaryChip label="TECH ID">{pick(row, ["tech_id"]) || "—"}</SummaryChip>
      <SummaryChip label="FULL NAME">{pick(row, ["full_name","tech_first_name","tech_last_name"]) || "—"}</SummaryChip>
      <SummaryChip label="CARD EXPIRE DATE">{pick(row, ["card_expire_date"]) || "—"}</SummaryChip>
      <SummaryChip label="PHONE">{pick(row, ["phone","tel"]) || "—"}</SummaryChip>
      <SummaryChip label="EMAIL">{pick(row, ["email"]) || "—"}</SummaryChip>
    </div>
  );
}

function SummaryChip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: "12px 14px",
      background: "#f9fafb",
      border: "1px solid #e5e7eb",
      borderRadius: 10
    }}>
      <div style={{ fontSize: 11, color: "#6b7280", letterSpacing: .4, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{children}</div>
    </div>
  );
}

function PhotoCard({ row }: { row: Row }) {
  const url = pick(row, ["doc_tech_card_url", "tech_card_url"]);
  return (
    <div style={{
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: 12,
      background: "#fff",
      boxShadow: "0 1px 2px rgba(0,0,0,.04)",
      width: 300
    }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>รูปบัตรช่าง</div>
      {url ? (
        <img
          src={proxyImg(String(url), false)}
          alt="tech card"
          style={{ width: "100%", height: "auto", borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
      ) : (
        <div style={{
          height: 200,
          borderRadius: 8,
          border: "1px dashed #e5e7eb",
          color: "#9ca3af",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>ไม่มีรูป</div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontWeight: 700,
        fontSize: 14,
        marginBottom: 10,
        background: "#eef2ff",
        color: "#1e40af",
        padding: "6px 10px",
        borderRadius: 8,
        display: "inline-block"
      }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function Field({
  row,
  label,
  keys,
  isDate = false,
}: {
  row: Row;
  label: string;
  keys: string[];
  isDate?: boolean;
}) {
  let v = pick(row, keys);
  if (isDate && v) {
    try { v = new Date(String(v)).toLocaleString("th-TH"); } catch {}
  }
  const hasValue = v !== undefined && v !== null && String(v).trim() !== "";
  return (
    <div style={{
      padding: 12,
      background: hasValue ? "#f9fafb" : "#f3f4f6",
      borderRadius: 8,
      border: "1px solid #e5e7eb",
      opacity: hasValue ? 1 : 0.7
    }}>
      <div style={{ fontSize: 12, color: hasValue ? "#6b7280" : "#9ca3af", marginBottom: 4, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: hasValue ? "#111827" : "#6b7280" }}>
        {hasValue ? String(v) : "—"}
      </div>
    </div>
  );
}

function DocField({ row, label, keys }: { row: Row; label: string; keys: string[] }) {
  const v = pick(row, keys);
  const has = v !== undefined && v !== null && String(v).trim() !== "";
  return (
    <div style={{
      padding: 12,
      background: has ? "#f9fafb" : "#f3f4f6",
      borderRadius: 8,
      border: "1px solid #e5e7eb",
      opacity: has ? 1 : 0.7
    }}>
      <div style={{ fontSize: 12, color: has ? "#6b7280" : "#9ca3af", marginBottom: 4, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 14 }}>
        {has ? (
          <a href={proxyImg(String(v), false)} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>
            เปิดไฟล์
          </a>
        ) : "—"}
      </div>
    </div>
  );
}

/* pick first non-empty value by candidate keys */
function pick(row: Row, keys: string[]) {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

/* ---------- Label helper (used in old generic view if needed) ---------- */
function friendlyLabel(key: string) {
  switch (key) {
    case "national_id": return "เลขบัตรประชาชน";
    case "tech_id": return "รหัสช่าง";
    case "full_name": return "ชื่อ-นามสกุล";
    case "tech_first_name": return "ชื่อ";
    case "tech_last_name": return "นามสกุล";
    case "gender": return "เพศ";
    case "age": return "อายุ";
    case "degree": return "ระดับการศึกษา";
    case "phone":
    case "tel": return "เบอร์โทรศัพท์";
    case "email": return "อีเมล";
    case "workgroup_status":
    case "status": return "สถานะกลุ่มงาน";
    case "work_type":
    case "team_type": return "ประเภทงาน/ทีม";
    case "provider": return "บริษัท";
    case "area": return "พื้นที่";
    case "rsm": return "RSM";
    case "ctm": return "CTM";
    case "depot_code": return "รหัสคลัง";
    case "depot_name": return "ชื่อคลัง";
    case "province": return "จังหวัด";
    case "ctm_province": return "จังหวัด (CTM)";
    case "doc_tech_card_url":
    case "tech_card_url": return "รูปบัตรช่าง";
    case "created_at": return "วันที่สร้าง";
    case "updated_at": return "วันที่อัปเดต";
    case "__imported_at": return "วันที่นำเข้า";
    case "id": return "ID";
    case "uuid": return "UUID";
    default:
      return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }
}

/* ---------- styles ---------- */
const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "12px 14px",
  background: "#fff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  minHeight: 110,
  transition: "all 0.2s ease-in-out",
};
const cardTitle: React.CSSProperties = { fontSize: 12, color: "#6b7280", marginBottom: 4 };
const cardNumber: React.CSSProperties = { fontSize: 24, fontWeight: 700 };
const cardSub: React.CSSProperties = { fontSize: 12, color: "#6b7280" };
