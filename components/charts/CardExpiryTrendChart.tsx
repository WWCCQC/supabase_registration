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
  ReferenceLine,
} from "recharts";

type ChartItem = {
  month: number;
  monthLabel: string;
  shortLabel: string;
  count: number;
};

type Summary = {
  year: number;
  totalExpiring: number;
  currentMonth: number;
};

type CardExpiryTrendChartProps = {
  selectedMonth?: number | null;
  onMonthClick?: (month: number | null) => void;
};

export default function CardExpiryTrendChart({ selectedMonth, onMonthClick }: CardExpiryTrendChartProps) {
  const [chartData, setChartData] = React.useState<ChartItem[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chart/card-expiry-trend", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch");
      setChartData(json.chartData || []);
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

  function getBarColor(month: number): string {
    if (month === currentMonth) return "#ef4444"; // current month — red
    return "#f97316"; // all other months — orange
  }

  function handleChartClick(data: any) {
    if (!data) return;
    // Recharts v3: use activeIndex to look up from chartData
    const idx = data.activeTooltipIndex ?? data.activeIndex;
    if (idx == null) return;
    const entry = chartData[Number(idx)];
    if (!entry) return;
    const clickedMonth = entry.month;
    onMonthClick?.(selectedMonth === clickedMonth ? null : clickedMonth);
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }} onClick={handleChartClick} style={{ cursor: "pointer" }}>
          <defs>
            <linearGradient id="barGradCurrent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
              <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="shortLabel"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis
            tick={false}
            axisLine={false}
            tickLine={false}
            width={0}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0].payload as ChartItem;
              const isCurrent = data.month === currentMonth;
              const isPast = data.month < currentMonth;
              return (
                <div
                  style={{
                    background: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "10px 14px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4, color: "#1f2937" }}>
                    {data.monthLabel}
                    {isCurrent && <span style={{ color: "#ef4444", marginLeft: 6 }}>← เดือนนี้</span>}
                    {isPast && <span style={{ color: "#9ca3af", marginLeft: 6 }}>(ผ่านไปแล้ว)</span>}
                  </div>
                  <div style={{ color: "#6b7280" }}>
                    บัตรช่างหมดอายุ: <strong style={{ color: isCurrent ? "#ef4444" : "#1f2937" }}>{data.count}</strong> ใบ
                  </div>
                </div>
              );
            }}
          />
          <ReferenceLine
            x={chartData.find((d) => d.month === currentMonth)?.shortLabel}
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
            <LabelList
              dataKey="count"
              position="top"
              style={{ fontSize: 11, fontWeight: 600, fill: "#374151" }}
              formatter={(value: unknown) => (Number(value) > 0 ? String(value) : "")}
            />
            {chartData.map((entry) => (
              <Cell
                key={entry.month}
                fill={getBarColor(entry.month)}
                opacity={selectedMonth != null && selectedMonth !== entry.month ? 0.35 : 1}
                stroke={selectedMonth === entry.month ? "#1f2937" : "none"}
                strokeWidth={selectedMonth === entry.month ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary footer */}
      {summary && (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>
              รวมทั้งปี {summary.year}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1f2937" }}>{summary.totalExpiring.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>
              หมดอายุเดือนนี้
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#ef4444" }}>
              {(chartData.find((d) => d.month === currentMonth)?.count || 0).toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>
              เดือนที่เหลือ
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#f97316" }}>
              {chartData
                .filter((d) => d.month > currentMonth)
                .reduce((sum, d) => sum + d.count, 0)
                .toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
