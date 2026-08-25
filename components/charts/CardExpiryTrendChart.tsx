"use client";
import React from "react";
import * as XLSX from "xlsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

type ChartItem = {
  month: number;
  monthLabel: string;
  shortLabel: string;
  count: number;
  renewCount: number;
  notRenewedCount: number;
};

type Summary = {
  year: number;
  totalExpiring: number;
  totalRenew: number;
  currentMonth: number;
};

type DetailRow = {
  national_id: string;
  tech_id: string;
  full_name: string;
  provider: string;
  rsm: string;
  ctm: string;
  depot_code: string;
  depot_name: string;
  province: string;
  card_expire_date: string;
  renew_status: string;
};

type CardExpiryTrendChartProps = {
  selectedMonth?: number | null;
  onMonthClick?: (month: number | null) => void;
};

// ── 3D helpers ─────────────────────────────────────────────────────
const BAR_DEPTH = 9;

const EXPIRE = { base: "#f97316", light: "#fdba74", dark: "#b8480a", text: "#c2410c" };
const RENEW = { base: "#22c55e", light: "#86efac", dark: "#15803d", text: "#15803d" };

/**
 * แท่งกราฟ 3 มิติ (isometric): หน้าหน้า + หน้าบน + ด้านข้าง
 * วาดหน้าบนเฉพาะแท่งบนสุดของ stack เท่านั้น
 */
function Bar3D(props: any) {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    payload,
    tone,
    showTop,
    selectedMonth,
  } = props;

  if (!width || !height || height <= 0) return null;

  const d = Math.min(BAR_DEPTH, width * 0.24);
  const dim = selectedMonth != null && selectedMonth !== payload?.month;
  const selected = selectedMonth != null && selectedMonth === payload?.month;
  const id = tone === "renew" ? "renew" : "expire";

  return (
    <g opacity={dim ? 0.38 : 1} style={{ transition: "opacity 0.2s" }}>
      {/* ด้านข้าง (ขวา) */}
      <polygon
        points={`${x + width},${y} ${x + width + d},${y - d} ${x + width + d},${
          y + height - d
        } ${x + width},${y + height}`}
        fill={`url(#ce-${id}-side)`}
      />
      {/* หน้าบน — เฉพาะแท่งบนสุด */}
      {showTop && (
        <polygon
          points={`${x},${y} ${x + d},${y - d} ${x + width + d},${y - d} ${
            x + width
          },${y}`}
          fill={`url(#ce-${id}-top)`}
        />
      )}
      {/* หน้าหน้า */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={`url(#ce-${id}-front)`}
        stroke={selected ? "#1f2937" : "rgba(255,255,255,0.35)"}
        strokeWidth={selected ? 1.6 : 0.6}
      />
      {/* ไฮไลต์แสงด้านซ้ายของหน้าหน้า */}
      <rect
        x={x}
        y={y}
        width={Math.min(3, width * 0.12)}
        height={height}
        fill="rgba(255,255,255,0.28)"
      />
    </g>
  );
}

const DETAIL_HEADERS: { key: keyof DetailRow; label: string }[] = [
  { key: "tech_id", label: "Tech ID" },
  { key: "full_name", label: "ชื่อ-นามสกุล" },
  { key: "rsm", label: "RSM" },
  { key: "provider", label: "Provider" },
  { key: "depot_code", label: "Depot Code" },
  { key: "depot_name", label: "Depot Name" },
  { key: "province", label: "จังหวัด" },
  { key: "card_expire_date", label: "บัตรหมดอายุ" },
  { key: "renew_status", label: "สถานะต่อบัตร" },
];

export default function CardExpiryTrendChart({ selectedMonth, onMonthClick }: CardExpiryTrendChartProps) {
  const [chartData, setChartData] = React.useState<ChartItem[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Modal state
  const [modalMonth, setModalMonth] = React.useState<number | null>(null);
  const [modalRows, setModalRows] = React.useState<DetailRow[]>([]);
  const [modalLoading, setModalLoading] = React.useState(false);
  const [modalError, setModalError] = React.useState<string | null>(null);
  const [modalSearch, setModalSearch] = React.useState("");

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chart/card-expiry-trend", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch");
      const mapped = (json.chartData || []).map((d: any) => ({
        ...d,
        notRenewedCount: Math.max(0, d.count - d.renewCount),
      }));
      setChartData(mapped);
      setSummary(json.summary || null);
    } catch (e: any) {
      console.error("CardExpiryTrendChart error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchData();
  }, []);

  async function fetchModalData(month: number) {
    setModalLoading(true);
    setModalError(null);
    setModalRows([]);
    setModalSearch("");
    try {
      const res = await fetch(`/api/chart/card-expiry-by-month?month=${month}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch");
      setModalRows(json.rows ?? []);
    } catch (e: any) {
      setModalError(e?.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setModalLoading(false);
    }
  }

  function openModal(month: number) {
    setModalMonth(month);
    fetchModalData(month);
  }

  function closeModal() {
    setModalMonth(null);
    setModalRows([]);
    setModalError(null);
    setModalSearch("");
    onMonthClick?.(null);
  }

  const filteredModalRows = modalSearch
    ? modalRows.filter((r) => {
        const q = modalSearch.toLowerCase();
        return Object.values(r).some((v) => String(v).toLowerCase().includes(q));
      })
    : modalRows;

  function handleDownloadExcel() {
    if (!filteredModalRows.length || modalMonth == null) return;
    const headers = DETAIL_HEADERS.map((h) => h.label);
    const wsData = [
      headers,
      ...filteredModalRows.map((r) => DETAIL_HEADERS.map((h) => r[h.key] ?? "-")),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `เดือน ${modalMonth}`);
    XLSX.writeFile(wb, `card_expiry_month_${modalMonth}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (loading) {
    return (
      <div style={{ minHeight: 350, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 16, color: "#666" }}>กำลังโหลดข้อมูล...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: 350, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 16, color: "#ef4444" }}>เกิดข้อผิดพลาด: {error}</div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div style={{ minHeight: 350, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 16, color: "#999" }}>ไม่มีข้อมูล</div>
      </div>
    );
  }

  const currentMonth = summary?.currentMonth || (new Date().getMonth() + 1);

  // แสดงเฉพาะเดือนที่มีบัตรหมดอายุ (ซ่อนเดือนที่ไม่มีข้อมูล)
  const visibleData = chartData.filter((d) => d.count > 0);

  function handleChartClick(data: any) {
    if (!data) return;
    const idx = data.activeTooltipIndex ?? data.activeIndex;
    if (idx == null) return;
    const entry = visibleData[Number(idx)];
    if (!entry) return;
    const clickedMonth = entry.month;
    if (entry.count === 0) return;
    onMonthClick?.(clickedMonth);
    openModal(clickedMonth);
  }

  // ── Executive insights ──────────────────────────────
  const totalExpiring = summary?.totalExpiring ?? 0;
  const totalRenew = summary?.totalRenew ?? 0;
  const notRenewed = Math.max(0, totalExpiring - totalRenew);
  const renewRate = totalExpiring > 0 ? (totalRenew / totalExpiring) * 100 : 0;
  const peakMonth = visibleData.length
    ? visibleData.reduce((a, b) => (b.count > a.count ? b : a))
    : null;
  const bestRenewMonth = visibleData.length
    ? visibleData.reduce((a, b) =>
        (b.renewCount / b.count) > (a.renewCount / a.count) ? b : a
      )
    : null;
  // เดือนเสี่ยง: ค้างต่อบัตรมากสุด (ตั้งแต่เดือนปัจจุบันเป็นต้นไป)
  const upcoming = visibleData.filter((d) => d.month >= currentMonth);
  const riskMonth = upcoming.length
    ? upcoming.reduce((a, b) => (b.notRenewedCount > a.notRenewedCount ? b : a))
    : null;

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
      {/* ── Left: chart ───────────────────────────────── */}
      <div style={{ flex: "1 1 520px", minWidth: 0 }}>
      {/* Legend — ชิป 3 มิติ */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 10, fontSize: 12 }}>
        {[
          { label: "บัตรหมดอายุ", c: EXPIRE },
          { label: "ลงทะเบียนอบรมช่างต่อบัตร", c: RENEW },
        ].map(({ label, c }) => (
          <span
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 12px",
              borderRadius: 999,
              fontWeight: 600,
              color: "#334155",
              background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
              border: "1px solid #e2e8f0",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 5px -2px rgba(15,23,42,0.22)",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: 4,
                background: `linear-gradient(160deg, ${c.light} 0%, ${c.base} 55%, ${c.dark} 100%)`,
                boxShadow: `0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 4px -1px ${c.base}b0`,
              }}
            />
            {label}
          </span>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={visibleData} margin={{ top: 30, right: 26, left: 0, bottom: 5 }} onClick={handleChartClick} style={{ cursor: "pointer" }}>
          {/* ไล่เฉดสำหรับหน้าแต่ละด้านของแท่ง 3 มิติ */}
          <defs>
            {[
              { id: "expire", c: EXPIRE },
              { id: "renew", c: RENEW },
            ].map(({ id, c }) => (
              <React.Fragment key={id}>
                <linearGradient id={`ce-${id}-front`} x1="0" y1="0" x2="0.35" y2="1">
                  <stop offset="0%" stopColor={c.light} />
                  <stop offset="45%" stopColor={c.base} />
                  <stop offset="100%" stopColor={c.dark} />
                </linearGradient>
                <linearGradient id={`ce-${id}-top`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="55%" stopColor={c.light} />
                  <stop offset="100%" stopColor={c.base} />
                </linearGradient>
                <linearGradient id={`ce-${id}-side`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={c.dark} />
                  <stop offset="100%" stopColor={c.base} stopOpacity={0.75} />
                </linearGradient>
              </React.Fragment>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="4 6" stroke="#e8ecf2" vertical={false} />
          <XAxis
            dataKey="shortLabel"
            axisLine={{ stroke: "#d8dee8" }}
            tickLine={false}
            interval={0}
            height={34}
            tick={(tickProps: any) => {
              const { x, y, payload } = tickProps;
              const item = visibleData[payload?.index ?? -1];
              const isCurrent = item?.month === currentMonth;
              return (
                <g transform={`translate(${x},${y})`}>
                  {isCurrent && (
                    <rect
                      x={-23}
                      y={5}
                      width={46}
                      height={19}
                      rx={9.5}
                      fill="#fee2e2"
                      stroke="#fecaca"
                      style={{ filter: "drop-shadow(0 2px 3px rgba(185,28,28,0.25))" }}
                    />
                  )}
                  <text
                    x={0}
                    y={19}
                    textAnchor="middle"
                    style={{
                      fontSize: 11,
                      fontWeight: isCurrent ? 800 : 600,
                      fill: isCurrent ? "#b91c1c" : "#64748b",
                    }}
                  >
                    {payload?.value}
                  </text>
                </g>
              );
            }}
          />
          <YAxis
            tick={false}
            axisLine={false}
            tickLine={false}
            width={0}
          />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.14)", radius: 6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0].payload as ChartItem;
              const isCurrent = data.month === currentMonth;
              const isPast = data.month < currentMonth;
              const pct = data.count > 0 ? (data.renewCount / data.count) * 100 : 0;
              const rowStyle: React.CSSProperties = {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                marginTop: 6,
                fontSize: 12,
                color: "#cbd5e1",
              };
              return (
                <div
                  style={{
                    background:
                      "linear-gradient(140deg, rgba(15,23,42,0.97) 0%, rgba(30,41,59,0.97) 100%)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 14,
                    padding: "12px 16px",
                    boxShadow:
                      "0 1px 0 rgba(255,255,255,0.12) inset, 0 18px 40px -14px rgba(0,0,0,0.75)",
                    minWidth: 230,
                    fontFamily: "Inter, 'Noto Sans Thai', sans-serif",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: "#f8fafc",
                      paddingBottom: 7,
                      borderBottom: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    🪪 {data.monthLabel}
                    {isCurrent && (
                      <span style={{ color: "#fca5a5", marginLeft: 6, fontSize: 11 }}>← เดือนนี้</span>
                    )}
                    {isPast && (
                      <span style={{ color: "#94a3b8", marginLeft: 6, fontSize: 11 }}>(ผ่านไปแล้ว)</span>
                    )}
                  </div>
                  <div style={rowStyle}>
                    <span>บัตรช่างหมดอายุ</span>
                    <strong style={{ color: "#ffffff", fontSize: 13 }}>{data.count} คน</strong>
                  </div>
                  <div style={rowStyle}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <i
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 3,
                          background: RENEW.base,
                          display: "inline-block",
                        }}
                      />
                      ต่อบัตรแล้ว
                    </span>
                    <strong style={{ color: "#86efac", fontSize: 13 }}>{data.renewCount} คน</strong>
                  </div>
                  <div style={rowStyle}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <i
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 3,
                          background: EXPIRE.base,
                          display: "inline-block",
                        }}
                      />
                      ยังไม่ลงทะเบียน
                    </span>
                    <strong style={{ color: "#fdba74", fontSize: 13 }}>
                      {data.notRenewedCount} คน
                    </strong>
                  </div>
                  <div
                    style={{
                      marginTop: 9,
                      height: 6,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.12)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: `linear-gradient(90deg, ${RENEW.light}, ${RENEW.base})`,
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 5, fontSize: 10.5, color: "#94a3b8" }}>
                    อัตราต่อบัตร {pct.toFixed(1)}% · คลิกเพื่อดูรายชื่อ
                  </div>
                </div>
              );
            }}
          />
          <Bar
            dataKey="renewCount"
            stackId="a"
            fill={RENEW.base}
            maxBarSize={46}
            shape={(p: any) => (
              <Bar3D
                {...p}
                tone="renew"
                showTop={(p?.payload?.notRenewedCount ?? 0) === 0}
                selectedMonth={selectedMonth}
              />
            )}
          >
            <LabelList
              dataKey="renewCount"
              position="center"
              style={{
                fontSize: 10,
                fontWeight: 800,
                fill: "#fff",
                paintOrder: "stroke",
                stroke: "rgba(6,78,36,0.55)",
                strokeWidth: 2.4,
              }}
              formatter={(value: unknown) => (Number(value) > 0 ? String(value) : "")}
            />
          </Bar>
          <Bar
            dataKey="notRenewedCount"
            stackId="a"
            fill={EXPIRE.base}
            maxBarSize={46}
            shape={(p: any) => (
              <Bar3D {...p} tone="expire" showTop selectedMonth={selectedMonth} />
            )}
          >
            <LabelList
              dataKey="notRenewedCount"
              position="center"
              style={{
                fontSize: 10,
                fontWeight: 800,
                fill: "#fff",
                paintOrder: "stroke",
                stroke: "rgba(120,53,15,0.5)",
                strokeWidth: 2.4,
              }}
              formatter={(value: unknown) => (Number(value) > 0 ? String(value) : "")}
            />
            <LabelList
              position="top"
              content={({ x, y, width, index }: any) => {
                const d = visibleData[index];
                if (!d || d.count === 0) return null;
                const cx = Number(x) + Number(width) / 2 + BAR_DEPTH / 2;
                const cy = Number(y) - BAR_DEPTH - 9;
                const dim = selectedMonth != null && selectedMonth !== d.month;
                const label = String(d.count);
                const w = label.length * 7 + 14;
                return (
                  <g opacity={dim ? 0.4 : 1}>
                    <rect
                      x={cx - w / 2}
                      y={cy - 12}
                      width={w}
                      height={18}
                      rx={9}
                      fill="#ffffff"
                      stroke="#e2e8f0"
                      style={{ filter: "drop-shadow(0 2px 4px rgba(15,23,42,0.18))" }}
                    />
                    <text
                      x={cx}
                      y={cy + 1}
                      textAnchor="middle"
                      style={{ fontSize: 11, fontWeight: 800, fill: "#334155" }}
                    >
                      {label}
                    </text>
                  </g>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>

      {/* ── Right: executive insight panel ──────────────── */}
      <div
        style={{
          flex: "1 1 300px",
          minWidth: 280,
          background: "linear-gradient(165deg, #fff7ed 0%, #ffffff 55%, #fffbf6 100%)",
          border: "1px solid #fed7aa",
          borderRadius: 16,
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 20px -8px rgba(154,52,18,0.28), 0 18px 40px -22px rgba(15,23,42,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              fontSize: 15,
              width: 28,
              height: 28,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 9,
              background: "linear-gradient(160deg, #ffedd5 0%, #fed7aa 100%)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 5px rgba(194,65,12,0.28)",
            }}
          >
            📊
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#9a3412" }}>
            สรุปเชิงวิเคราะห์
          </span>
        </div>

        {/* อัตราต่อบัตรรวม */}
        <div
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #fffaf5 100%)",
            border: "1px solid #fde4cc",
            borderRadius: 12,
            padding: "11px 13px",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.95) inset, 0 4px 10px -6px rgba(154,52,18,0.35)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>อัตราต่อบัตรรวมทั้งปี</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: renewRate >= 50 ? "#16a34a" : "#ea580c" }}>
              {renewRate.toFixed(1)}%
            </span>
          </div>
          <div
            style={{
              height: 9,
              background: "linear-gradient(180deg, #dfe4ea 0%, #eef1f5 100%)",
              boxShadow:
                "0 1px 2px rgba(15,23,42,0.18) inset, 0 1px 0 rgba(255,255,255,0.85)",
              borderRadius: 999,
              overflow: "hidden",
              marginTop: 7,
            }}
          >
            <div
              style={{
                width: `${Math.min(100, renewRate)}%`,
                height: "100%",
                background:
                  renewRate >= 50
                    ? `linear-gradient(180deg, ${RENEW.light} 0%, ${RENEW.base} 55%, ${RENEW.dark} 100%)`
                    : `linear-gradient(180deg, ${EXPIRE.light} 0%, ${EXPIRE.base} 55%, ${EXPIRE.dark} 100%)`,
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.55) inset, 0 -1px 2px rgba(0,0,0,0.25) inset",
                borderRadius: 999,
                transition: "width 0.9s cubic-bezier(.22,1,.36,1)",
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
            ต่อบัตรแล้ว <strong style={{ color: "#16a34a" }}>{totalRenew.toLocaleString()}</strong> คน ·
            คงค้าง <strong style={{ color: "#ea580c" }}>{notRenewed.toLocaleString()}</strong> คน
            จากทั้งหมด {totalExpiring.toLocaleString()} คน
          </div>
        </div>

        {/* Highlight cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {peakMonth && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#374151" }}>
              <span style={{ fontSize: 16 }}>📈</span>
              <span>
                หมดอายุสูงสุดเดือน <strong>{peakMonth.shortLabel}</strong>{" "}
                <strong style={{ color: "#ea580c" }}>{peakMonth.count}</strong> คน — ต้องเตรียมรองรับการต่อบัตร
              </span>
            </div>
          )}
          {bestRenewMonth && bestRenewMonth.renewCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#374151" }}>
              <span style={{ fontSize: 16 }}>✅</span>
              <span>
                ต่อบัตรดีสุดเดือน <strong>{bestRenewMonth.shortLabel}</strong>{" "}
                <strong style={{ color: "#16a34a" }}>
                  {((bestRenewMonth.renewCount / bestRenewMonth.count) * 100).toFixed(0)}%
                </strong>{" "}
                ({bestRenewMonth.renewCount}/{bestRenewMonth.count} คน)
              </span>
            </div>
          )}
          {riskMonth && riskMonth.notRenewedCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#374151" }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span>
                เดือนเสี่ยง <strong>{riskMonth.shortLabel}</strong> ยังค้างต่อบัตร{" "}
                <strong style={{ color: "#dc2626" }}>{riskMonth.notRenewedCount}</strong> คน — ควรเร่งติดตาม
              </span>
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: "#9a3412", background: "#ffedd5", borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 }}>
          💡 ภาพรวมมีบัตรหมดอายุ {totalExpiring.toLocaleString()} คนในปี {summary?.year}{" "}
          แต่ลงทะเบียนต่อบัตรเพียง {renewRate.toFixed(1)}%{" "}
          {renewRate < 50 ? "ซึ่งยังต่ำกว่าครึ่ง ควรเร่งรณรงค์ให้ช่างเข้าอบรมต่อบัตรก่อนถึงกำหนด" : "อยู่ในเกณฑ์ที่ดี ควรรักษาระดับนี้ต่อไป"}
        </div>
      </div>
      </div>

      {/* Summary footer */}
      {summary && (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {[
            {
              label: `รวมหมดอายุทั้งปี ${summary.year}`,
              value: summary.totalExpiring,
              color: "#1f2937",
              tint: "#f8fafc",
              border: "#e2e8f0",
              glow: "15,23,42",
            },
            {
              label: "หมดอายุเดือนนี้",
              value: chartData.find((d) => d.month === currentMonth)?.count || 0,
              color: "#dc2626",
              tint: "#fef2f2",
              border: "#fecaca",
              glow: "220,38,38",
            },
            {
              label: "รวมลงทะเบียนอบรมช่างต่อบัตร",
              value: summary.totalRenew,
              color: "#15803d",
              tint: "#f0fdf4",
              border: "#bbf7d0",
              glow: "22,163,74",
            },
          ].map((tile) => (
            <div
              key={tile.label}
              style={{
                textAlign: "center",
                minWidth: 150,
                padding: "10px 16px",
                borderRadius: 14,
                background: `linear-gradient(180deg, #ffffff 0%, ${tile.tint} 100%)`,
                border: `1px solid ${tile.border}`,
                boxShadow: `0 1px 0 rgba(255,255,255,0.95) inset, 0 -2px 0 rgba(${tile.glow},0.12) inset, 0 6px 14px -8px rgba(${tile.glow},0.45)`,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  fontWeight: 700,
                }}
              >
                {tile.label}
              </div>
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 800,
                  color: tile.color,
                  marginTop: 3,
                  fontVariantNumeric: "tabular-nums",
                  textShadow: "0 1px 0 rgba(255,255,255,0.8)",
                }}
              >
                {tile.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Detail Modal ────────────────────────────────── */}
      {modalMonth != null && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "ceFadeIn 0.2s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 16, padding: "24px 28px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              maxWidth: 1100, width: "96%", maxHeight: "88vh",
              display: "flex", flexDirection: "column",
              animation: "ceSlideUp 0.25s ease-out",
              fontFamily: "Inter, 'Noto Sans Thai', sans-serif",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#f97316", flexShrink: 0 }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  🪪 บัตรช่างหมดอายุ {chartData.find((d) => d.month === modalMonth)?.monthLabel ?? ""}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: "#f97316",
                  background: "#f9731615", borderRadius: 10, padding: "2px 10px",
                }}>
                  {modalLoading ? "..." : `${filteredModalRows.length.toLocaleString()} คน`}
                </span>
              </div>
              <button
                onClick={closeModal}
                style={{
                  background: "#f1f5f9", border: "none", borderRadius: "50%",
                  width: 32, height: 32, cursor: "pointer", fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#64748b", transition: "background 0.15s", flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
              >
                ✕
              </button>
            </div>

            {/* Search + Download bar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                <input
                  type="text"
                  placeholder="ค้นหา..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  style={{
                    width: "100%", padding: "7px 12px 7px 32px", fontSize: 13,
                    border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#f97316"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
                />
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
              </div>
              <button
                onClick={handleDownloadExcel}
                disabled={modalLoading || !filteredModalRows.length}
                style={{
                  background: filteredModalRows.length ? "linear-gradient(135deg, #10b981, #059669)" : "#e2e8f0",
                  color: filteredModalRows.length ? "white" : "#94a3b8",
                  border: "none", borderRadius: 8, padding: "7px 16px",
                  fontSize: 12, fontWeight: 600, cursor: filteredModalRows.length ? "pointer" : "default",
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "opacity 0.15s", whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => { if (filteredModalRows.length) e.currentTarget.style.opacity = "0.85"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              >
                📥 Download Excel
              </button>
            </div>

            {/* Content */}
            {modalLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 10 }}>
                <div style={{
                  width: 36, height: 36, border: "3px solid #e5e7eb",
                  borderTopColor: "#f97316",
                  borderRadius: "50%", animation: "ceSpin 0.8s linear infinite",
                }} />
                <span style={{ fontSize: 13, color: "#6b7280" }}>กำลังโหลดข้อมูล...</span>
              </div>
            ) : modalError ? (
              <div style={{ padding: 30, textAlign: "center", color: "#ef4444", fontSize: 14 }}>
                ❌ {modalError}
              </div>
            ) : (
              <div style={{ overflowY: "auto", overflowX: "auto", flex: 1, position: "relative" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12, minWidth: 900 }}>
                  <thead>
                    <tr style={{ position: "sticky", top: 0, zIndex: 2 }}>
                      {["#", ...DETAIL_HEADERS.map((h) => h.label)].map((h) => (
                        <th key={h} style={{
                          textAlign: "left", padding: "8px 8px", fontWeight: 600, fontSize: 11,
                          background: "#f8fafc", boxShadow: "inset 0 -2px 0 #f9731630",
                          color: "#475569", borderBottom: "2px solid #f9731630",
                          whiteSpace: "nowrap",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModalRows.length === 0 ? (
                      <tr>
                        <td colSpan={DETAIL_HEADERS.length + 1} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
                          ไม่พบข้อมูล
                        </td>
                      </tr>
                    ) : (
                      filteredModalRows.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.1s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <td style={{ padding: "6px 8px", color: "#9ca3af", fontSize: 11 }}>{idx + 1}</td>
                          {DETAIL_HEADERS.map((h) => (
                            <td key={h.key} style={{ padding: "6px 8px", color: "#334155", whiteSpace: "nowrap" }}>
                              {h.key === "renew_status" ? (
                                <span style={{
                                  fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "2px 8px",
                                  color: row.renew_status === "ลงทะเบียนแล้ว" ? "#16a34a" : "#f97316",
                                  background: row.renew_status === "ลงทะเบียนแล้ว" ? "#16a34a15" : "#f9731615",
                                }}>
                                  {row.renew_status}
                                </span>
                              ) : (
                                row[h.key] ?? "-"
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal animations */}
          <style>{`
            @keyframes ceFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes ceSlideUp { from { opacity: 0; transform: translateY(30px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes ceSpin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}
    </div>
  );
}
