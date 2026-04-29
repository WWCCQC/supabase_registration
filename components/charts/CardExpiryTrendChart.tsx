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
  Legend,
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

  function getBarColor(_month: number): string {
    return "#f97316";
  }

  function handleChartClick(data: any) {
    if (!data) return;
    const idx = data.activeTooltipIndex ?? data.activeIndex;
    if (idx == null) return;
    const entry = chartData[Number(idx)];
    if (!entry) return;
    const clickedMonth = entry.month;
    onMonthClick?.(selectedMonth === clickedMonth ? null : clickedMonth);
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 8, fontSize: 12 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: "#f97316" }} />
          บัตรหมดอายุ
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: "#22c55e" }} />
          ลงทะเบียนอบรมช่างต่อบัตร
        </span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }} onClick={handleChartClick} style={{ cursor: "pointer" }}>
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
                    บัตรช่างหมดอายุ: <strong style={{ color: isCurrent ? "#ef4444" : "#1f2937" }}>{data.count}</strong> คน
                  </div>
                  <div style={{ color: "#6b7280", marginTop: 2 }}>
                    ลงทะเบียนอบรมช่างต่อบัตร: <strong style={{ color: "#16a34a" }}>{data.renewCount}</strong> คน
                  </div>
                  <div style={{ color: "#6b7280", marginTop: 2 }}>
                    ยังไม่ลงทะเบียน: <strong style={{ color: "#f97316" }}>{data.notRenewedCount}</strong> คน
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="renewCount" stackId="a" fill="#22c55e" maxBarSize={50}>
            <LabelList
              dataKey="renewCount"
              position="center"
              style={{ fontSize: 10, fontWeight: 700, fill: "#fff" }}
              formatter={(value: unknown) => (Number(value) > 0 ? String(value) : "")}
            />
            {chartData.map((entry) => (
              <Cell
                key={`renew-${entry.month}`}
                fill="#22c55e"
                opacity={selectedMonth != null && selectedMonth !== entry.month ? 0.35 : 1}
              />
            ))}
          </Bar>
          <Bar dataKey="notRenewedCount" stackId="a" fill="#f97316" maxBarSize={50} radius={[4, 4, 0, 0]}>
            <LabelList
              position="top"
              style={{ fontSize: 11, fontWeight: 600, fill: "#374151" }}
              content={({ x, y, width, index }: any) => {
                const d = chartData[index];
                if (!d || d.count === 0) return null;
                return (
                  <text x={Number(x) + Number(width) / 2} y={Number(y) - 6} textAnchor="middle" style={{ fontSize: 11, fontWeight: 600, fill: "#374151" }}>
                    {d.count}
                  </text>
                );
              }}
            />
            {chartData.map((entry) => (
              <Cell
                key={`expire-${entry.month}`}
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
              รวมหมดอายุทั้งปี {summary.year}
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
              รวมลงทะเบียนอบรมช่างต่อบัตร
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#16a34a" }}>
              {summary.totalRenew.toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
