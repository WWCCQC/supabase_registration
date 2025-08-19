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

/** คอลัมน์ที่ “ตาราง” ต้องแสดง (ตามที่ระบุไว้) */
const COLS = [
  "national_id",
  "tech_id",
  "full_name",
  "gender",
  "age",
  "degree",
  "doc_tech_card_url",
  "phone",
  "email",
  "workgroup_status",
  "work_type",
  "provider",
  "area",
  "rsm",
  "ctm",
  "depot_code",
  "depot_name",
  "province",
] as const;

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

  /* sort */
  const [sort, setSort] =
    React.useState<(typeof COLS)[number]>("national_id");
  const [dir, setDir] = React.useState<"asc" | "desc">("asc");

  /* preview image */
  const [preview, setPreview] = React.useState<string | null>(null);

  /* detail popup */
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
              {
                bg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                text: "white",
              },
              {
                bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                text: "white",
              },
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
                  style={{ ...cardTitle, color: "rgba(255,255,255,0.8)" }}
                >
                  {name}
                </div>
                <div style={{ ...cardNumber, color: "white" }}>
                  {kpiLoading ? "" : count}
                </div>
                <div
                  style={{ ...cardSub, color: "rgba(255,255,255,0.8)" }}
                >
                  {kpiLoading ? "" : `${pct}%`}
                </div>
              </div>
            );
          })}

          {/* Provider: WW-Provider, True Tech, เถ้าแก่เทค */}
          {["WW-Provider", "True Tech", "เถ้าแก่เทค"].map((name, index) => {
            const f = (kpi?.by_provider || []).find(
              (x) =>
                (x.key || "").trim().toLowerCase() === name.toLowerCase()
            );
            const count = f?.count ?? 0;
            const pct = f?.percent ?? 0;

            const colors = [
              {
                bg: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
                text: "white",
              },
              {
                bg: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                text: "white",
              },
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
        <input
          placeholder="rsm"
          value={rsm}
          onChange={(e) => setRsm(e.target.value)}
        />
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

      {/* Detail Popup */}
      {detailOpen && (
        <div
          onClick={() => setDetailOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,.3)",
              minWidth: 520,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#1f2937" }}>
                  ข้อมูลช่าง:{" "}
                  {detailRow?.full_name || detailRow?.tech_id || detailRow?.national_id || "-"}
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
              <div style={{ color: "#b91c1c", marginBottom: 12 }}>Error: {detailError}</div>
            )}

            {/* รายการฟิลด์ทั้งหมด */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              {(detailRow ? Object.entries(detailRow) : []).map(([key, value]) => {
                const hasValue = value !== null && value !== undefined && value !== "";
                const label = friendlyLabel(key);

                return (
                  <div
                    key={key}
                    style={{
                      padding: 12,
                      background: hasValue ? "#f9fafb" : "#f3f4f6",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      opacity: hasValue ? 1 : 0.7,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: hasValue ? "#6b7280" : "#9ca3af",
                        marginBottom: 4,
                        fontWeight: 500,
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: hasValue ? "#1f2937" : "#6b7280",
                        wordBreak: "break-word",
                        fontStyle: hasValue ? "normal" : "italic",
                      }}
                    >
                      {key === "doc_tech_card_url" || key === "tech_card_url" ? (
                        value ? (
                          <img
                            src={proxyImg(String(value), false)}
                            alt="tech card"
                            style={{ maxWidth: "100%", height: "auto", borderRadius: 6, border: "1px solid #e5e7eb" }}
                          />
                        ) : (
                          "ไม่มีรูป"
                        )
                      ) : key === "created_at" ||
                        key === "updated_at" ||
                        key === "__imported_at" ? (
                        value ? new Date(String(value)).toLocaleString("th-TH") : "ไม่ระบุ"
                      ) : hasValue ? (
                        String(value)
                      ) : (
                        "ไม่มีข้อมูล"
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Label helper for popup ---------- */
function friendlyLabel(key: string) {
  switch (key) {
    case "national_id":
      return "เลขบัตรประชาชน";
    case "tech_id":
      return "รหัสช่าง";
    case "full_name":
      return "ชื่อ-นามสกุล";
    case "tech_first_name":
      return "ชื่อ";
    case "tech_last_name":
      return "นามสกุล";
    case "gender":
      return "เพศ";
    case "age":
      return "อายุ";
    case "degree":
      return "ระดับการศึกษา";
    case "phone":
    case "tel":
      return "เบอร์โทรศัพท์";
    case "email":
      return "อีเมล";
    case "workgroup_status":
    case "status":
      return "สถานะกลุ่มงาน";
    case "work_type":
    case "team_type":
      return "ประเภทงาน/ทีม";
    case "provider":
      return "บริษัท";
    case "area":
      return "พื้นที่";
    case "rsm":
      return "RSM";
    case "ctm":
      return "CTM";
    case "depot_code":
      return "รหัสคลัง";
    case "depot_name":
      return "ชื่อคลัง";
    case "province":
      return "จังหวัด";
    case "ctm_province":
      return "จังหวัด (CTM)";
    case "doc_tech_card_url":
    case "tech_card_url":
      return "รูปบัตรช่าง";
    case "created_at":
      return "วันที่สร้าง";
    case "updated_at":
      return "วันที่อัปเดต";
    case "__imported_at":
      return "วันที่นำเข้า";
    case "id":
      return "ID";
    case "uuid":
      return "UUID";
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
