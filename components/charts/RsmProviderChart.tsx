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
  defs,
} from "recharts";

type ProviderChartData = {
  RBM: string;
  "WW-Provider": number;
  "True Tech": number;
  "เถ้าแก่เทค": number;
  total: number;
};

type ProviderSummary = {
  totalRBM: number;
  totalTechnicians: number;
  providerBreakdown?: Array<{
    provider: string;
    count: number;
    percentage: number;
  }>;
  providers: {
    "WW-Provider": number;
    "True Tech": number;
    "เถ้าแก่เทค": number;
  };
};

// Provider color palette — rich gradients
const PROVIDER_COLORS = {
  "WW-Provider": {
    gradient: ["#3b82f6", "#1d4ed8"],
    solid: "#3b82f6",
    light: "#dbeafe",
    text: "#1d4ed8",
  },
  "True Tech": {
    gradient: ["#10b981", "#047857"],
    solid: "#10b981",
    light: "#d1fae5",
    text: "#047857",
  },
  "เถ้าแก่เทค": {
    gradient: ["#f59e0b", "#b45309"],
    solid: "#f59e0b",
    light: "#fef3c7",
    text: "#b45309",
  },
};

export default function RsmProviderChart() {
  const [chartData, setChartData] = React.useState<ProviderChartData[]>([]);
  const [summary, setSummary] = React.useState<ProviderSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchChartData();
  }, []);

  const fetchChartData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/chart/rsm-provider", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch provider chart data");
      setChartData(json.chartData || []);
      setSummary(json.summary || null);
    } catch (e: any) {
      console.error("Provider Chart fetch error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Custom Tooltip ───────────────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const total = payload[0]?.payload?.total ?? 0;
    return (
      <div
        style={{
          background: "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14,
          padding: "14px 18px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          minWidth: 180,
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
        {payload.map((entry: any, i: number) => {
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
                <span style={{ fontSize: 12, color: "#cbd5e1" }}>{entry.name}</span>
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
  };

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

  // ─── Error State ───────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #fef2f2, #fee2e2)",
            border: "1px solid #fca5a5",
            borderRadius: 12,
            padding: "16px 20px",
            color: "#dc2626",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>❌ {error}</span>
          <button
            onClick={fetchChartData}
            style={{
              background: "#dc2626",
              color: "white",
              border: "none",
              padding: "5px 12px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  const providers = ["WW-Provider", "True Tech", "เถ้าแก่เทค"] as const;
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
          marginBottom: 20,
        }}
      >
        {providers.map((p) => {
          const c = PROVIDER_COLORS[p];
          const info = summary?.providerBreakdown?.find((x) => x.provider === p);
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
                cursor: "default",
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
              <span style={{ fontSize: 12, fontWeight: 600, color: c.text }}>
                {p}
              </span>
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

      {/* ── Bar Chart ──────────────────────────────────────────── */}
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={chartData}
          margin={{ top: 24, right: 16, left: 10, bottom: 80 }}
          barSize={36}
        >
          <defs>
            {/* WW-Provider gradient */}
            <linearGradient id="gradWW" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            {/* True Tech gradient */}
            <linearGradient id="gradTT" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            {/* เถ้าแก่เทค gradient */}
            <linearGradient id="gradTG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f1f5f9"
            vertical={false}
          />

          <XAxis
            dataKey="RBM"
            angle={-40}
            textAnchor="end"
            height={80}
            interval={0}
            tick={{ fontSize: 10, fill: "#64748b", fontWeight: 500 }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />

          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "จำนวนช่าง (คน)",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              style: { fontSize: 10, fill: "#94a3b8" },
            }}
            domain={[0, "auto"]}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(148,163,184,0.08)" }}
          />

          {/* WW-Provider */}
          <Bar
            dataKey="WW-Provider"
            stackId="a"
            fill="url(#gradWW)"
            radius={[0, 0, 0, 0]}
            onMouseEnter={() => setHoveredBar("WW-Provider")}
            onMouseLeave={() => setHoveredBar(null)}
          >
            <LabelList
              dataKey="WW-Provider"
              position="inside"
              fill="white"
              fontSize={9}
              fontWeight="bold"
              formatter={(v: any) => (v > 0 ? v : "")}
            />
          </Bar>

          {/* True Tech */}
          <Bar
            dataKey="True Tech"
            stackId="a"
            fill="url(#gradTT)"
            onMouseEnter={() => setHoveredBar("True Tech")}
            onMouseLeave={() => setHoveredBar(null)}
          >
            <LabelList
              dataKey="True Tech"
              position="inside"
              fill="white"
              fontSize={9}
              fontWeight="bold"
              formatter={(v: any) => (v > 0 ? v : "")}
            />
          </Bar>

          {/* เถ้าแก่เทค */}
          <Bar
            dataKey="เถ้าแก่เทค"
            stackId="a"
            fill="url(#gradTG)"
            radius={[6, 6, 0, 0]}
            onMouseEnter={() => setHoveredBar("เถ้าแก่เทค")}
            onMouseLeave={() => setHoveredBar(null)}
          >
            <LabelList
              dataKey="เถ้าแก่เทค"
              position="inside"
              fill="white"
              fontSize={9}
              fontWeight="bold"
              formatter={(v: any) => (v > 0 ? v : "")}
            />
            {/* Total label on top of the last stacked bar */}
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
          📊 RBM ทั้งหมด {summary?.totalRBM ?? 0} เขต
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
