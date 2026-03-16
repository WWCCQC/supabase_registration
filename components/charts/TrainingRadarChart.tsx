"use client";
import React, { useState, useEffect } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type RadarItem = {
  subject: string;
  count: number;
  fullMark: number;
};

export default function TrainingRadarChart() {
  const [data, setData] = useState<RadarItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/chart/training-radar", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to fetch");
        setData(json.data || []);
        setTotal(json.total || 0);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
        กำลังโหลดข้อมูลการอบรม...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#ef4444" }}>
        ❌ {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
        ไม่มีข้อมูล
      </div>
    );
  }

  // Convert to percentage data for radar
  const percentData = data.map((item) => ({
    subject: item.subject,
    percent: total > 0 ? parseFloat(((item.count / total) * 100).toFixed(1)) : 0,
    count: item.count,
    label: `${item.subject} ${total > 0 ? ((item.count / total) * 100).toFixed(1) : 0}%`,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={350}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={percentData}>
          <PolarGrid stroke="#c0c0c0" strokeDasharray="4 4" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fontSize: 13, fill: "#374151", fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tickCount={5}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Radar
            name="จำนวนที่อบรม"
            dataKey="percent"
            stroke="#3b5998"
            fill="#3b5998"
            fillOpacity={0.15}
            strokeWidth={2}
            dot={{ r: 5, fill: "#3b5998", stroke: "#3b5998" }}
          />
          <Tooltip
            formatter={(value: number, _name: string, props: any) => [
              `${props.payload.count.toLocaleString()} คน (${value}%)`,
              "จำนวนที่อบรม",
            ]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Summary Cards */}
      {(() => {
        const colorMap: Record<string, string> = {
          "อบรมการไฟฟ้า": "#2563eb",
          "Course G": "#0d9488",
          "Course EC": "#d97706",
          "Course H": "#9333ea",
        };
        const visibleItems = data.filter((item) => item.count > 0);
        const cols = 1 + visibleItems.length; // total card + visible items
        return (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 10,
              marginTop: 12,
            }}
          >
            {/* Total card */}
            <div
              style={{
                textAlign: "center",
                padding: "14px 8px",
                background: "#fdf6e3",
                borderRadius: 12,
                border: "1px solid #f0e6c8",
              }}
            >
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                จำนวนทั้งหมด
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#1f2937" }}>
                {total.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>ช่าง</div>
            </div>

            {/* Item cards - hide zero */}
            {visibleItems.map((item) => (
              <div
                key={item.subject}
                style={{
                  textAlign: "center",
                  padding: "14px 8px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                  {item.subject}
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: colorMap[item.subject] || "#4f46e5",
                  }}
                >
                  {item.count.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  {total > 0 ? ((item.count / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
