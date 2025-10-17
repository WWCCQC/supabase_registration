"use client";
import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from "recharts";

type ChartData = {
  rsm: string;
  Yes: number;
  No: number;
  total: number;
};

type Summary = {
  totalRsm: number;
  totalTechnicians: number;
  totalYes: number;
  totalNo: number;
  totalTechniciansWithRsm: number;
  recordsWithoutRsm: number;
  recordsWithoutAuthority: number;
};

export default function RsmWorkgroupChart() {
  const [chartData, setChartData] = React.useState<ChartData[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchChartData();
  }, []);

  async function fetchChartData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chart/rsm-workgroup", { cache: "no-store" });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json?.error || "Failed to fetch chart data");
      
      setChartData(json.chartData || []);
      setSummary(json.summary || null);
    } catch (e: any) {
      console.error("Chart fetch error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload[0].payload.total;
      return (
        <div style={{
          backgroundColor: "white",
          padding: "10px",
          border: "1px solid #ccc",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <p style={{ fontWeight: "bold", marginBottom: "5px" }}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color, margin: "3px 0" }}>
              {entry.name}: {entry.value} คน
            </p>
          ))}
          <p style={{ fontWeight: "bold", marginTop: "5px", borderTop: "1px solid #eee", paddingTop: "5px" }}>
            รวม: {total} คน
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 18, color: "#666" }}>กำลังโหลดข้อมูล Chart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{
          padding: "12px 16px",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "8px",
          color: "#dc2626"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>❌ เกิดข้อผิดพลาด: {error}</span>
            <button 
              onClick={fetchChartData}
              style={{
                background: "#dc2626",
                color: "white",
                border: "none",
                padding: "4px 8px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px"
              }}
            >
              ลองใหม่
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
          📊 Stacked Column Chart: RSM by Power Authority
        </h2>
        
        {/* Summary Cards */}
        {summary && (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 20
          }}>
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>RSM ทั้งหมด</div>
              <div style={summaryValueStyle}>{summary.totalRsm}</div>
            </div>
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>ช่างทั้งหมด</div>
              <div style={summaryValueStyle}>{summary.totalTechnicians.toLocaleString()}</div>
            </div>
            <div style={{...summaryCardStyle, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)"}}>
              <div style={{...summaryLabelStyle, color: "rgba(255,255,255,0.9)"}}>Power Authority: Yes</div>
              <div style={{...summaryValueStyle, color: "white"}}>{summary.totalYes.toLocaleString()}</div>
            </div>
            <div style={{...summaryCardStyle, background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"}}>
              <div style={{...summaryLabelStyle, color: "rgba(255,255,255,0.9)"}}>Power Authority: No</div>
              <div style={{...summaryValueStyle, color: "white"}}>{summary.totalNo.toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* Additional Info */}
        {summary && (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 20,
            padding: "16px",
            background: "#f8fafc",
            borderRadius: "8px",
            border: "1px solid #e2e8f0"
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>ช่างที่มี RSM</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1e293b" }}>{summary.totalTechniciansWithRsm.toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>ช่างที่ไม่มี RSM</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#ef4444" }}>{summary.recordsWithoutRsm.toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>ช่างที่ไม่มี Power Authority</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#f59e0b" }}>{summary.recordsWithoutAuthority.toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* Chart Container */}
        <div style={{
          background: "white",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          border: "1px solid #e5e7eb"
        }}>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="rsm" 
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fontSize: 11 }}
              />
              <YAxis 
                label={{ 
                  value: 'จำนวนช่าง (คน)', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fontSize: 12 }
                }}
                tick={{ fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: "20px" }}
                iconType="rect"
              />
              <Bar 
                dataKey="Yes" 
                stackId="a" 
                fill="#10b981"
                name="Yes"
              />
              <Bar 
                dataKey="No" 
                stackId="a" 
                fill="#f59e0b"
                name="No"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Refresh Button */}
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button 
            onClick={fetchChartData}
            disabled={loading}
            style={{
              padding: "8px 16px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
              opacity: loading ? 0.5 : 1
            }}
          >
            🔄 รีเฟรช Chart
          </button>
        </div>
      </div>
    </div>
  );
}

// Styles
const summaryCardStyle: React.CSSProperties = {
  padding: "16px",
  background: "#f9fafb",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  textAlign: "center"
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  marginBottom: "4px",
  fontWeight: 500
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#111827"
};
