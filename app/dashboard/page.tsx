"use client";
import React from "react";
import { getFieldLabel } from "../../lib/fieldLabels";

// เพิ่ม dynamic import เพื่อป้องกัน static generation
export const dynamic = 'force-dynamic';

type KpiResp = {
  total: number;
  by_work_type: { key: string; count: number; percent: number }[];
  by_provider: { key: string; count: number; percent: number }[];
};

// ฟังก์ชันสำหรับจัดรูปแบบตัวเลขให้ใส่เครื่องหมาย ","
function formatNumber(num: number): string {
  const result = num.toLocaleString('en-US');
  console.log(`formatNumber(${num}) = ${result}`);
  return result;
}

function useDebounced<T>(value: T, delay = 400) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function DashboardPage() {
  // ----- date filters
  const [dateMode, setDateMode] = React.useState<"" | "today" | "7d" | "month" | "custom">("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  // ----- main filters
  const [provider, setProvider] = React.useState("");
  const [area, setArea] = React.useState("");
  const [rsm, setRsm] = React.useState("");
  const [ctm, setCtm] = React.useState("");
  const [depotCode, setDepotCode] = React.useState("");
  const [workType, setWorkType] = React.useState("");
  const [workgroupStatus, setWorkgroupStatus] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [degree, setDegree] = React.useState("");

  // ----- quick search
  const [fNationalId, setFNationalId] = React.useState("");
  const [fTechId, setFTechId] = React.useState("");
  const [fRsm, setFRsm] = React.useState("");
  const [fDepotExact, setFDepotExact] = React.useState("");

  const [q, setQ] = React.useState("");

  // ----- debounced bundle (ลดการยิง API ถี่ๆ)
  const d = {
    dateMode,
    dateFrom,
    dateTo,
    provider: useDebounced(provider),
    area: useDebounced(area),
    rsm: useDebounced(rsm),
    ctm: useDebounced(ctm),
    depotCode: useDebounced(depotCode),
    workType: useDebounced(workType),
    workgroupStatus: useDebounced(workgroupStatus),
    gender: useDebounced(gender),
    degree: useDebounced(degree),
    fNationalId: useDebounced(fNationalId),
    fTechId: useDebounced(fTechId),
    fRsm: useDebounced(fRsm),
    fDepotExact: useDebounced(fDepotExact),
    q: useDebounced(q),
  };

  const [loading, setLoading] = React.useState(false);
  const [kpi, setKpi] = React.useState<KpiResp | null>(null);

  // สำหรับยกเลิก request เก่า ป้องกัน race condition
  const abortRef = React.useRef<AbortController | null>(null);

  function buildParams() {
    const p = new URLSearchParams();
    if (d.provider) p.set("provider", d.provider);
    if (d.area) p.set("area", d.area);
    if (d.rsm) p.set("rsm", d.rsm);
    if (d.ctm) p.set("ctm", d.ctm);
    if (d.depotCode) p.set("depot_code", d.depotCode);
    if (d.workType) p.set("work_type", d.workType);
    if (d.workgroupStatus) p.set("workgroup_status", d.workgroupStatus);
    if (d.gender) p.set("gender", d.gender);
    if (d.degree) p.set("degree", d.degree);

    if (d.fNationalId) p.set("f_national_id", d.fNationalId);
    if (d.fTechId) p.set("f_tech_id", d.fTechId);
    if (d.fRsm) p.set("f_rsm", d.fRsm);
    if (d.fDepotExact) p.set("f_depot_code", d.fDepotExact);

    if (d.q) p.set("q", d.q);

    if (dateMode) {
      p.set("date_mode", dateMode);
      if (dateMode === "custom" && dateFrom && dateTo) {
        p.set("date_from", dateFrom);
        p.set("date_to", dateTo);
      }
    }

    // ป้องกัน proxy cache (เสริมจาก cache: 'no-store')
    p.set("_ts", String(Date.now()));
    return p;
  }

  async function fetchKpis() {
    // ยกเลิก request เดิมถ้ายังค้าง
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const url = `/api/kpis?${buildParams().toString()}`;
      const res = await fetch(url, {
        cache: "no-store",                 // กัน cache ฝั่ง browser
        signal: controller.signal,         // รองรับยกเลิก
        headers: {
          "x-no-cache": String(Date.now()), // กัน intermediary cache
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Fetch error");
      setKpi(json as KpiResp);            // API ต้องคำนวณ count ฝั่ง server (ไม่ใช่ data.length)
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        alert(e?.message ?? "Fetch error");
      }
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchKpis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    d.provider, d.area, d.rsm, d.ctm, d.depotCode, d.workType, d.workgroupStatus,
    d.gender, d.degree, d.fNationalId, d.fTechId, d.fRsm, d.fDepotExact, d.q,
    dateMode, dateFrom, dateTo,
  ]);

  function resetFilters() {
    setProvider(""); setArea(""); setRsm(""); setCtm(""); setDepotCode("");
    setWorkType(""); setWorkgroupStatus(""); setGender(""); setDegree("");
    setFNationalId(""); setFTechId(""); setFRsm(""); setFDepotExact(""); setQ("");
    setDateMode(""); setDateFrom(""); setDateTo("");
  }

  const total = kpi?.total ?? 0;

  return (
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Technician Dashboard</h1>

      {/* Filters */}
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label>ช่วงเวลา:</label>
          <select value={dateMode} onChange={e => setDateMode(e.target.value as any)}>
            <option value="">ไม่ใช้ช่วงเวลา</option>
            <option value="today">วันนี้</option>
            <option value="7d">7 วันล่าสุด</option>
            <option value="month">เดือนนี้</option>
            <option value="custom">กำหนดเอง</option>
          </select>
          {dateMode === "custom" && (
            <>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <span>ถึง</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </>
          )}
          <button onClick={fetchKpis} disabled={loading}>รีเฟรช</button>
          <button onClick={resetFilters} disabled={loading}>ล้างตัวกรอง</button>
          <button 
            onClick={() => {
              // Force refresh with new timestamp
              setQ(prev => prev + ' ' + Date.now());
              setTimeout(() => setQ(prev => prev.replace(/ \d+$/, '')), 100);
            }} 
            disabled={loading}
            style={{ background: '#f59e0b', color: 'white' }}
          >
            Force Refresh
          </button>
          <span style={{ fontSize: 12, color: '#666' }}>
            Last update: {new Date().toLocaleTimeString()}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 8 }}>
          <input placeholder={getFieldLabel("provider")} value={provider} onChange={e => setProvider(e.target.value)} />
          <input placeholder={getFieldLabel("area")} value={area} onChange={e => setArea(e.target.value)} />
          <input placeholder={getFieldLabel("rsm")} value={rsm} onChange={e => setRsm(e.target.value)} />
          <input placeholder={getFieldLabel("ctm")} value={ctm} onChange={e => setCtm(e.target.value)} />
          <input placeholder={getFieldLabel("depot_code")} value={depotCode} onChange={e => setDepotCode(e.target.value)} />
          <input placeholder={getFieldLabel("work_type")} value={workType} onChange={e => setWorkType(e.target.value)} />
          <input placeholder={getFieldLabel("workgroup_status")} value={workgroupStatus} onChange={e => setWorkgroupStatus(e.target.value)} />
          <input placeholder={getFieldLabel("gender")} value={gender} onChange={e => setGender(e.target.value)} />
          <input placeholder={getFieldLabel("degree")} value={degree} onChange={e => setDegree(e.target.value)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 8 }}>
          <input placeholder={`${getFieldLabel("national_id")} (exact/partial)`} value={fNationalId} onChange={e => setFNationalId(e.target.value)} />
          <input placeholder={`${getFieldLabel("tech_id")} (exact/partial)`} value={fTechId} onChange={e => setFTechId(e.target.value)} />
          <input placeholder={`${getFieldLabel("rsm")} (exact/partial)`} value={fRsm} onChange={e => setFRsm(e.target.value)} />
          <input placeholder={`${getFieldLabel("depot_code")} (exact/partial)`} value={fDepotExact} onChange={e => setFDepotExact(e.target.value)} />
          <input placeholder="ค้นหาทุกคอลัมน์ (free text)" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px,1fr))", gap: 12 }}>
        <div style={cardStyle}>
          <div style={cardTitle}>ช่างทั้งหมด</div>
          <div style={cardNumber}>{loading ? "" : formatNumber(total)}</div>
        </div>
      </div>

      <section>
        <h3 style={{ margin: "8px 0" }}>Technicians แยกตาม work_type</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(180px,1fr))", gap: 12 }}>
          {(kpi?.by_work_type ?? []).map((x) => (
            <div key={x.key} style={cardStyle}>
              <div style={cardTitle}>{x.key || "(ไม่ระบุ)"}</div>
              <div style={cardNumber}>{formatNumber(x.count)}</div>
              <div style={cardSub}>{x.percent}%</div>
            </div>
          ))}
          {(!kpi || kpi.by_work_type.length === 0) && <div style={{ color: "#666" }}>ไม่มีข้อมูล</div>}
        </div>
      </section>

      <section>
        <h3 style={{ margin: "8px 0" }}>Technicians แยกตาม provider</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(180px,1fr))", gap: 12 }}>
          {(kpi?.by_provider ?? []).map((x) => (
            <div key={x.key} style={cardStyle}>
              <div style={cardTitle}>{x.key || "(ไม่ระบุ)"}</div>
              <div style={cardNumber}>{formatNumber(x.count)}</div>
              <div style={cardSub}>{x.percent}%</div>
            </div>
          ))}
          {(!kpi || kpi.by_provider.length === 0) && <div style={{ color: "#666" }}>ไม่มีข้อมูล</div>}
        </div>
      </section>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "12px 14px",
  background: "#fff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};
const cardTitle: React.CSSProperties = { fontSize: 12, color: "#6b7280", marginBottom: 4 };
const cardNumber: React.CSSProperties = { fontSize: 24, fontWeight: 700 };
const cardSub: React.CSSProperties = { fontSize: 12, color: "#6b7280" };
