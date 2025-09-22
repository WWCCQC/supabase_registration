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
  LabelList
} from "recharts";

type ProviderChartData = {
  rsm: string;
  "WW-Provider": number;
  "True Tech": number;
  "เถ้าแก่เทค": number;
  "อื่นๆ": number;
  total: number;
};

type ProviderSummary = {
  totalRsm: number;
  totalTechnicians: number;
  providers: {
    "WW-Provider": number;
    "True Tech": number;
    "เถ้าแก่เทค": number;
    "อื่นๆ": number;
  };
};

export default function RsmProviderChart() {
  const [chartData, setChartData] = React.useState<ProviderChartData[]>([]);
  const [summary, setSummary] = React.useState<ProviderSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchChartData();
  }, []);

  const fetchChartData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch("/api/chart/rsm-provider");
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
      <div style={{ padding: 24, textAlign: "center", minHeight: "400px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 18, color: "#666" }}>กำลังโหลดข้อมูล Provider Chart...</div>
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
    <div>
      {/* Custom Legend */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        marginBottom: 16,
        flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 16,
            height: 16,
            backgroundColor: "#3b82f6",
            borderRadius: 2
          }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            WW-Provider ({summary?.providers["WW-Provider"]?.toLocaleString() || "0"})
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 16,
            height: 16,
            backgroundColor: "#10b981",
            borderRadius: 2
          }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            True Tech ({summary?.providers["True Tech"]?.toLocaleString() || "0"})
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 16,
            height: 16,
            backgroundColor: "#f59e0b",
            borderRadius: 2
          }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            เถ้าแก่เทค ({summary?.providers["เถ้าแก่เทค"]?.toLocaleString() || "0"})
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="rsm" 
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
            tick={{ fontSize: 10 }}
          />
          <YAxis 
            label={{ 
              value: 'จำนวนช่าง (คน)', 
              angle: -90, 
              position: 'insideLeft',
              style: { fontSize: 11 }
            }}
            tick={{ fontSize: 10 }}
            domain={[0, 800]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="WW-Provider" 
            stackId="a" 
            fill="#3b82f6"
          >
            <LabelList 
              dataKey="WW-Provider" 
              position="inside" 
              fill="white"
              fontSize={10}
              fontWeight="bold"
              formatter={(value: any) => value > 0 ? value : ""}
            />
          </Bar>
          <Bar 
            dataKey="True Tech" 
            stackId="a" 
            fill="#10b981"
          >
            <LabelList 
              dataKey="True Tech" 
              position="inside" 
              fill="white"
              fontSize={10}
              fontWeight="bold"
              formatter={(value: any) => value > 0 ? value : ""}
            />
          </Bar>
          <Bar 
            dataKey="เถ้าแก่เทค" 
            stackId="a" 
            fill="#f59e0b"
          >
            <LabelList 
              dataKey="เถ้าแก่เทค" 
              position="inside" 
              fill="white"
              fontSize={10}
              fontWeight="bold"
              formatter={(value: any) => value > 0 ? value : ""}
            />
            {/* แสดงจำนวนรวมเหนือยอดกราฟ */}
            <LabelList 
              dataKey="total" 
              position="top"
              fill="#111827"
              fontSize={12}
              fontWeight="bold"
              offset={5}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
