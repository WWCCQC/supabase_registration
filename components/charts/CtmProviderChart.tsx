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
  LabelList,
  Cell,
} from "recharts";

type CtmProviderChartProps = {
  selectedCtm?: string | null;
  onCtmClick?: (CBM: string | null) => void;
};

export default function CtmProviderChart({ selectedCtm, onCtmClick }: CtmProviderChartProps) {
  const [chartData, setChartData] = React.useState<any[]>([]);
  const [summary, setSummary] = React.useState<any>(null);
  const [providers, setProviders] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [startIndex, setStartIndex] = React.useState(0);
  const itemsPerPage = 15; // จำนวน CTM ที่แสดงต่อหน้า

  // Colors for different providers (in desired order)
  const providerColors: { [key: string]: string } = {
    "WW-Provider": "#3b82f6",   // Blue (same as RSM)
    "True Tech": "#10b981",     // Green (same as RSM)  
    "เถ้าแก่เทค": "#f59e0b",   // Yellow (same as RSM)
  };

  // Define provider order for legend
  const providerOrder = ["WW-Provider", "True Tech", "เถ้าแก่เทค"];

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/chart/ctm-provider", { cache: "no-store" });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json?.error || "Failed to fetch CTM chart data");
      
      setChartData(json.chartData || []);
      setSummary(json.summary || null);
      
      // Sort providers according to desired order
      const fetchedProviders: string[] = json.providers || [];
      const sortedProviders = providerOrder.filter((p: string) => fetchedProviders.includes(p))
        .concat(fetchedProviders.filter((p: string) => !providerOrder.includes(p)));
      setProviders(sortedProviders);
    } catch (e: any) {
      console.error("CTM Provider Chart fetch error:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleChartClick(data: any) {
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedCtm = data.activePayload[0].payload.CBM;
      console.log('📊 CBM Chart clicked:', clickedCtm);
      
      // Toggle selection
      if (selectedCtm === clickedCtm) {
        console.log('📊 Deselecting CBM');
        onCtmClick?.(null);
      } else {
        console.log('📊 Selecting CBM:', clickedCtm);
        onCtmClick?.(clickedCtm);
      }
    }
  }

  React.useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 16, color: "#666" }}>กำลังโหลด CBM Chart...</div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 16, color: "#999" }}>ไม่มีข้อมูล CBM Chart</div>
      </div>
    );
  }

  // Calculate pagination
  const totalPages = Math.ceil(chartData.length / itemsPerPage);
  const currentPage = Math.floor(startIndex / itemsPerPage) + 1;
  const displayedData = chartData.slice(startIndex, startIndex + itemsPerPage);
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartIndex = parseInt(e.target.value);
    setStartIndex(newStartIndex);
  };
  
  const maxStartIndex = Math.max(0, chartData.length - itemsPerPage);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Custom Legend - เพิ่ม font family สำหรับภาษาไทย */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px',
        paddingBottom: '15px',
        fontSize: '13px',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ 
            width: '14px', 
            height: '14px', 
            backgroundColor: '#3b82f6',
            borderRadius: '2px'
          }}></div>
          <span style={{ fontWeight: '500' }}>WW-Provider ({summary?.providerBreakdown?.find((p: any) => p.provider === "WW-Provider")?.count?.toLocaleString() || "0"})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ 
            width: '14px', 
            height: '14px', 
            backgroundColor: '#10b981',
            borderRadius: '2px'
          }}></div>
          <span style={{ fontWeight: '500' }}>True Tech ({summary?.providerBreakdown?.find((p: any) => p.provider === "True Tech")?.count?.toLocaleString() || "0"})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ 
            width: '14px', 
            height: '14px', 
            backgroundColor: '#f59e0b',
            borderRadius: '2px'
          }}></div>
          <span style={{ fontWeight: '500' }}>เถ้าแก่เทค ({summary?.providerBreakdown?.find((p: any) => p.provider === "เถ้าแก่เทค")?.count?.toLocaleString() || "0"})</span>
        </div>
      </div>

      {/* Slider Control */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        paddingBottom: '15px',
        paddingLeft: '20px',
        paddingRight: '20px'
      }}>
        <div style={{
          fontSize: '13px',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '5px'
        }}>
          แสดง CBM {startIndex + 1} - {Math.min(startIndex + itemsPerPage, chartData.length)} จากทั้งหมด {chartData.length} CBM
        </div>
        
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '12px', color: '#6b7280', minWidth: '40px' }}>
            เริ่มต้น
          </span>
          
          <input
            type="range"
            min="0"
            max={maxStartIndex}
            step="1"
            value={startIndex}
            onChange={handleSliderChange}
            style={{
              flex: 1,
              height: '6px',
              borderRadius: '3px',
              outline: 'none',
              cursor: 'pointer',
              accentColor: '#3b82f6'
            }}
          />
          
          <span style={{ fontSize: '12px', color: '#6b7280', minWidth: '40px', textAlign: 'right' }}>
            สิ้นสุด
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={500} key="ctm-provider-chart-new-order">
      <BarChart
        data={displayedData}
        margin={{ top: 20, right: 30, left: 40, bottom: 120 }}
        onClick={handleChartClick}
        style={{ cursor: "pointer" }}
        maxBarSize={300}
        barCategoryGap="2%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="CBM" 
          angle={-45}
          textAnchor="end"
          height={120}
          interval={0}
          tick={{ fontSize: 10 }}
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
        <Tooltip 
          content={({ active, payload, label }: any) => {
            if (active && payload && payload.length) {
              const total = payload[0].payload.total;
              return (
                <div style={{
                  backgroundColor: "white",
                  padding: "12px",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  maxWidth: "300px",
                  fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif'
                }}>
                  <p style={{ fontWeight: "bold", marginBottom: "8px", fontSize: "14px" }}>
                    CBM: {label}
                  </p>
                  {payload
                    .filter((entry: any) => entry.value > 0)
                    .map((entry: any, index: number) => (
                    <p key={index} style={{ color: entry.color, margin: "4px 0", fontSize: "13px" }}>
                      {entry.dataKey}: {entry.value} คน
                    </p>
                  ))}
                  <p style={{ 
                    fontWeight: "bold", 
                    marginTop: "8px", 
                    borderTop: "1px solid #eee", 
                    paddingTop: "6px",
                    fontSize: "14px" 
                  }}>
                    รวม: {total} คน
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        
        {/* Render bars for each provider in desired order */}
        <Bar 
          key="WW-Provider"
          dataKey="WW-Provider" 
          stackId="a" 
          fill="#3b82f6"
          name="WW-Provider"
        >
          {displayedData.map((entry, entryIndex) => (
            <Cell 
              key={`cell-WW-Provider-${entryIndex}`} 
              fill={selectedCtm === entry.CBM ? "#2563eb" : "#3b82f6"}
              opacity={selectedCtm && selectedCtm !== entry.CBM ? 0.5 : 1}
            />
          ))}
          <LabelList 
            dataKey="WW-Provider" 
            position="center"
            fill="white"
            fontSize={10}
            fontWeight="bold"
            formatter={(value: any) => {
              const num = Number(value);
              return num > 0 ? String(num) : '';
            }}
          />
        </Bar>
        
        <Bar 
          key="True Tech"
          dataKey="True Tech" 
          stackId="a" 
          fill="#10b981"
          name="True Tech"
        >
          {displayedData.map((entry, entryIndex) => (
            <Cell 
              key={`cell-True Tech-${entryIndex}`} 
              fill={selectedCtm === entry.CBM ? "#059669" : "#10b981"}
              opacity={selectedCtm && selectedCtm !== entry.CBM ? 0.5 : 1}
            />
          ))}
          <LabelList 
            dataKey="True Tech" 
            position="center"
            fill="white"
            fontSize={10}
            fontWeight="bold"
            formatter={(value: any) => {
              const num = Number(value);
              return num > 0 ? String(num) : '';
            }}
          />
        </Bar>
        
        <Bar 
          key="เถ้าแก่เทค"
          dataKey="เถ้าแก่เทค" 
          stackId="a" 
          fill="#f59e0b"
          name="เถ้าแก่เทค"
        >
          {displayedData.map((entry, entryIndex) => (
            <Cell 
              key={`cell-เถ้าแก่เทค-${entryIndex}`} 
              fill={selectedCtm === entry.CBM ? "#d97706" : "#f59e0b"}
              opacity={selectedCtm && selectedCtm !== entry.CBM ? 0.5 : 1}
            />
          ))}
          <LabelList 
            dataKey="เถ้าแก่เทค" 
            position="center"
            fill="white"
            fontSize={10}
            fontWeight="bold"
            formatter={(value: any) => {
              const num = Number(value);
              return num > 0 ? String(num) : '';
            }}
          />
        </Bar>
        
        {/* Add total labels on top */}
        <Bar 
          dataKey="total" 
          fill="transparent"
          name=""
        >
          <LabelList 
            dataKey="total" 
            position="top"
            fill="#111827"
            fontSize={11}
            fontWeight="bold"
            offset={8}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}