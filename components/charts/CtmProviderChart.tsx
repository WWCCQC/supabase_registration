"use client";
import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";

type CtmProviderChartProps = {
  selectedCtm?: string | null;
  onCtmClick?: (CBM: string | null) => void;
};

// Provider color palette — same as RBM for consistency
const PROVIDER_COLORS = {
  "WW-Provider": {
    gradient: ["#60a5fa", "#1d4ed8"],
    solid: "#3b82f6",
    selected: "#2563eb",
    light: "#dbeafe",
    text: "#1d4ed8",
  },
  "True Tech": {
    gradient: ["#34d399", "#047857"],
    solid: "#10b981",
    selected: "#059669",
    light: "#d1fae5",
    text: "#047857",
  },
  "เถ้าแก่เทค": {
    gradient: ["#fbbf24", "#b45309"],
    solid: "#f59e0b",
    selected: "#d97706",
    light: "#fef3c7",
    text: "#b45309",
  },
} as const;

const PROVIDER_ORDER = ["WW-Provider", "True Tech", "เถ้าแก่เทค"] as const;

export default function CtmProviderChart({ selectedCtm, onCtmClick }: CtmProviderChartProps) {
  const [chartData, setChartData] = React.useState<any[]>([]);
  const [summary, setSummary] = React.useState<any>(null);
  const [providers, setProviders] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [startIndex, setStartIndex] = React.useState(0);
  const itemsPerPage = 15;

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/chart/ctm-provider", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch CTM chart data");
      setChartData(json.chartData || []);
      setSummary(json.summary || null);
      const fetched: string[] = json.providers || [];
      const sorted: string[] = [
        ...PROVIDER_ORDER.filter((p) => fetched.includes(p)),
        ...fetched.filter((p) => !(PROVIDER_ORDER as readonly string[]).includes(p)),
      ];
      setProviders(sorted);
    } catch (e: any) {
      console.error("CTM Provider Chart fetch error:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleChartClick(data: any) {
    if (data?.activePayload?.[0]) {
      const clickedCtm = data.activePayload[0].payload.CBM;
      onCtmClick?.(selectedCtm === clickedCtm ? null : clickedCtm);
    }
  }

  React.useEffect(() => {
    fetchData();
  }, []);

  // ─── Loading State ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: 420,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: "3px solid #e5e7eb",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <span style={{ fontSize: 14, color: "#6b7280" }}>กำลังโหลดข้อมูล...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div
        style={{
          minHeight: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 15, color: "#9ca3af" }}>ไม่มีข้อมูล CBM</span>
      </div>
    );
  }

  const totalPages = Math.ceil(chartData.length / itemsPerPage);
  const currentPage = Math.floor(startIndex / itemsPerPage) + 1;
  const displayedData = chartData.slice(startIndex, startIndex + itemsPerPage);
  const maxStartIndex = Math.max(0, chartData.length - itemsPerPage);
  const totalTechnicians = summary?.totalTechnicians ?? 0;

  // ─── JSX ────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "Inter, 'Noto Sans Thai', sans-serif" }}>

      {/* ── Legend Badges ─────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {PROVIDER_ORDER.map((p) => {
          const c = PROVIDER_COLORS[p];
          const info = summary?.providerBreakdown?.find((x: any) => x.provider === p);
          const count = info?.count ?? 0;
          const pct = totalTechnicians > 0 ? ((count / totalTechnicians) * 100).toFixed(1) : "0.0";
          return (
            <div
              key={p}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: c.light,
                border: `1.5px solid ${c.solid}`,
                borderRadius: 30,
                padding: "5px 14px 5px 8px",
                boxShadow: `0 2px 8px ${c.solid}30`,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${c.gradient[0]}, ${c.gradient[1]})`,
                  boxShadow: `0 0 6px ${c.solid}80`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: c.text }}>{p}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: c.text,
                  background: "rgba(255,255,255,0.6)",
                  borderRadius: 10,
                  padding: "1px 7px",
                }}
              >
                {count.toLocaleString()} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Pagination Slider ──────────────────────────────────── */}
      {maxStartIndex > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            marginBottom: 16,
            padding: "10px 20px",
            background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
            📍 แสดง CBM&nbsp;
            <span style={{ color: "#3b82f6" }}>{startIndex + 1}–{Math.min(startIndex + itemsPerPage, chartData.length)}</span>
            &nbsp;จากทั้งหมด&nbsp;
            <span style={{ color: "#3b82f6" }}>{chartData.length}</span>
            &nbsp;CBM &nbsp;(หน้า {currentPage}/{totalPages})
          </div>
          <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>เริ่มต้น</span>
            <input
              type="range"
              min="0"
              max={maxStartIndex}
              step="1"
              value={startIndex}
              onChange={(e) => setStartIndex(parseInt(e.target.value))}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                outline: "none",
                cursor: "pointer",
                accentColor: "#3b82f6",
              }}
            />
            <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>สิ้นสุด</span>
          </div>
        </div>
      )}

      {/* ── Selected CBM Badge ─────────────────────────────────── */}
      {selectedCtm && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
              color: "white",
              borderRadius: 20,
              padding: "4px 14px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            🔍 กำลังกรอง CBM: {selectedCtm}
          </span>
          <button
            onClick={() => onCtmClick?.(null)}
            style={{
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "3px 10px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✕ ยกเลิก
          </button>
        </div>
      )}

      {/* ── Bar Chart ──────────────────────────────────────────── */}
      <ResponsiveContainer width="100%" height={480} key="ctm-provider-chart">
        <BarChart
          data={displayedData}
          margin={{ top: 24, right: 16, left: 10, bottom: 120 }}
          onClick={handleChartClick}
          style={{ cursor: "pointer" }}
          barCategoryGap="10%"
          barSize={32}
        >
          <defs>
            <linearGradient id="ctmGradWW" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <linearGradient id="ctmGradTT" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <linearGradient id="ctmGradTG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

          <XAxis
            dataKey="CBM"
            angle={-45}
            textAnchor="end"
            height={120}
            interval={0}
            tick={{ fontSize: 10, fill: "#64748b", fontWeight: 500 }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />

          <YAxis
            tick={false}
            axisLine={false}
            tickLine={false}
            width={10}
          />

          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.08)" }}
            content={({ active, payload, label }: any) => {
              if (!active || !payload?.length) return null;
              const total = payload[0]?.payload?.total ?? 0;
              return (
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 14,
                    padding: "14px 18px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
                    minWidth: 200,
                    fontFamily: "Inter, 'Noto Sans Thai', sans-serif",
                  }}
                >
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: "#f1f5f9",
                      marginBottom: 10,
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      paddingBottom: 6,
                    }}
                  >
                    📍 {label}
                  </p>
                  {payload
                    .filter((e: any) => e.value > 0)
                    .map((entry: any, i: number) => {
                      const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0";
                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            marginBottom: 5,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                backgroundColor: entry.color,
                                flexShrink: 0,
                                boxShadow: `0 0 6px ${entry.color}`,
                              }}
                            />
                            <span style={{ fontSize: 12, color: "#cbd5e1" }}>{entry.dataKey}</span>
                          </div>
                          <span style={{ fontSize: 12, color: "#f8fafc", fontWeight: 600 }}>
                            {entry.value.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: "1px solid rgba(255,255,255,0.1)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>รวมทั้งหมด</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8" }}>
                      {total.toLocaleString()} คน
                    </span>
                  </div>
                </div>
              );
            }}
          />

          {/* WW-Provider */}
          <Bar dataKey="WW-Provider" stackId="a" fill="url(#ctmGradWW)" name="WW-Provider">
            {displayedData.map((entry, i) => (
              <Cell
                key={`ctm-ww-${i}`}
                fill={selectedCtm === entry.CBM ? PROVIDER_COLORS["WW-Provider"].selected : "url(#ctmGradWW)"}
                opacity={selectedCtm && selectedCtm !== entry.CBM ? 0.35 : 1}
              />
            ))}
            <LabelList
              dataKey="WW-Provider"
              position="center"
              fill="white"
              fontSize={9}
              fontWeight="bold"
              formatter={(v: any) => (Number(v) > 0 ? String(v) : "")}
            />
          </Bar>

          {/* True Tech */}
          <Bar dataKey="True Tech" stackId="a" fill="url(#ctmGradTT)" name="True Tech">
            {displayedData.map((entry, i) => (
              <Cell
                key={`ctm-tt-${i}`}
                fill={selectedCtm === entry.CBM ? PROVIDER_COLORS["True Tech"].selected : "url(#ctmGradTT)"}
                opacity={selectedCtm && selectedCtm !== entry.CBM ? 0.35 : 1}
              />
            ))}
            <LabelList
              dataKey="True Tech"
              position="center"
              fill="white"
              fontSize={9}
              fontWeight="bold"
              formatter={(v: any) => (Number(v) > 0 ? String(v) : "")}
            />
          </Bar>

          {/* เถ้าแก่เทค */}
          <Bar
            dataKey="เถ้าแก่เทค"
            stackId="a"
            fill="url(#ctmGradTG)"
            name="เถ้าแก่เทค"
            radius={[6, 6, 0, 0]}
          >
            {displayedData.map((entry, i) => (
              <Cell
                key={`ctm-tg-${i}`}
                fill={selectedCtm === entry.CBM ? PROVIDER_COLORS["เถ้าแก่เทค"].selected : "url(#ctmGradTG)"}
                opacity={selectedCtm && selectedCtm !== entry.CBM ? 0.35 : 1}
              />
            ))}
            <LabelList
              dataKey="เถ้าแก่เทค"
              position="center"
              fill="white"
              fontSize={9}
              fontWeight="bold"
              formatter={(v: any) => (Number(v) > 0 ? String(v) : "")}
            />
            {/* Total label on top */}
            <LabelList
              dataKey="total"
              position="top"
              fill="#1e293b"
              fontSize={11}
              fontWeight="bold"
              offset={6}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* ── Summary Footer ─────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #f0f9ff, #e0f2fe)",
            border: "1px solid #bae6fd",
            borderRadius: 10,
            padding: "6px 16px",
            fontSize: 12,
            fontWeight: 600,
            color: "#0369a1",
          }}
        >
          📊 CBM ทั้งหมด {summary?.totalCBM ?? chartData.length} เขต
        </div>
        <div
          style={{
            background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
            border: "1px solid #bbf7d0",
            borderRadius: 10,
            padding: "6px 16px",
            fontSize: 12,
            fontWeight: 600,
            color: "#166534",
          }}
        >
          👷 ช่างรวม {totalTechnicians.toLocaleString()} คน
        </div>
      </div>
    </div>
  );
}