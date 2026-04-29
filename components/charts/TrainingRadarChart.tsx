"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import * as XLSX from "xlsx";

type RadarItem = {
  subject: string;
  count: number;
  fullMark: number;
};

// Map subject label → API course param & column for display
const SUBJECT_MAP: Record<string, { course: string; columnLabel: string }> = {
  "อบรมการไฟฟ้า": { course: "power_authority", columnLabel: "Power Authority" },
  "Course G": { course: "course_g", columnLabel: "Course G" },
  "Course EC": { course: "course_ec", columnLabel: "Course EC" },
  "Course H": { course: "course_h", columnLabel: "Course H" },
};

const COLOR_MAP: Record<string, string> = {
  "อบรมการไฟฟ้า": "#2563eb",
  "Course G": "#0d9488",
  "Course EC": "#d97706",
  "Course H": "#9333ea",
};

export default function TrainingRadarChart() {
  const [data, setData] = useState<RadarItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalSubject, setModalSubject] = useState<string | null>(null);
  const [modalRows, setModalRows] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState("");

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

  // Fetch detail rows for modal
  const fetchModalData = useCallback(async (subject: string) => {
    const mapping = SUBJECT_MAP[subject];
    if (!mapping) return;
    setModalLoading(true);
    setModalError(null);
    setModalRows([]);
    setModalSearch("");
    try {
      const res = await fetch(`/api/chart/training-detail?course=${mapping.course}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch data");
      const json = await res.json();
      setModalRows(json.rows ?? []);
    } catch (e: any) {
      setModalError(e?.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setModalLoading(false);
    }
  }, []);

  const openModal = useCallback((subject: string) => {
    setModalSubject(subject);
    fetchModalData(subject);
  }, [fetchModalData]);

  const closeModal = useCallback(() => {
    setModalSubject(null);
    setModalRows([]);
    setModalError(null);
    setModalSearch("");
  }, []);

  // Filtered rows
  const filteredModalRows = modalSearch
    ? modalRows.filter((r) => {
        const q = modalSearch.toLowerCase();
        return Object.values(r).some((v) => String(v).toLowerCase().includes(q));
      })
    : modalRows;

  // Excel download
  const handleDownloadExcel = useCallback(() => {
    if (!filteredModalRows.length || !modalSubject) return;
    const mapping = SUBJECT_MAP[modalSubject];
    const courseCol = mapping?.course ?? "";
    const headers = ["HRBM", "RBM", "CBM", "provider", "depot_code", "depot_name", "tech_id", "full_name", courseCol];
    const wsData = [headers, ...filteredModalRows.map((r) => headers.map((h) => r[h] ?? "-"))];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, modalSubject);
    XLSX.writeFile(wb, `training_${courseCol}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [filteredModalRows, modalSubject]);

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

  // Table headers for modal
  const getTableHeaders = () => {
    if (!modalSubject) return [];
    const mapping = SUBJECT_MAP[modalSubject];
    return [
      { key: "HRBM", label: "HRBM" },
      { key: "RBM", label: "RBM" },
      { key: "CBM", label: "CBM" },
      { key: "provider", label: "Provider" },
      { key: "depot_code", label: "Depot Code" },
      { key: "depot_name", label: "Depot Name" },
      { key: "tech_id", label: "Tech ID" },
      { key: "full_name", label: "Full Name" },
      { key: mapping?.course ?? "", label: mapping?.columnLabel ?? "" },
    ];
  };

  const accentColor = modalSubject ? (COLOR_MAP[modalSubject] || "#4f46e5") : "#4f46e5";

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
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.1}
            strokeWidth={2}
            dot={{ r: 3, fill: "#ef4444", stroke: "#ef4444" }}
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

      <div style={{ textAlign: "center", marginTop: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>
          💡 คลิกที่ตัวเลขด้านล่างเพื่อดูรายละเอียดช่าง
        </span>
      </div>

      {/* Summary Cards */}
      {(() => {
        const visibleItems = data.filter((item) => item.count > 0);
        const cols = 1 + visibleItems.length;
        return (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 10,
              marginTop: 8,
            }}
          >
            {/* Total card */}
            <div
              style={{
                textAlign: "center",
                padding: "14px 8px",
                background: "#ffffff",
                borderRadius: 12,
                border: "2px solid #ffffff",
              }}
            >
              <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>
                จำนวนทั้งหมด
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#1f2937" }}>
                {total.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>ช่าง</div>
            </div>

            {/* Item cards - clickable */}
            {visibleItems.map((item) => (
              <div
                key={item.subject}
                onClick={() => openModal(item.subject)}
                style={{
                  textAlign: "center",
                  padding: "14px 8px",
                  background: "#fff",
                  borderRadius: 12,
                  cursor: "pointer",
                  transition: "transform 0.15s, box-shadow 0.15s",
                  border: `2px solid transparent`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.04)";
                  e.currentTarget.style.boxShadow = `0 4px 16px ${COLOR_MAP[item.subject] || "#4f46e5"}30`;
                  e.currentTarget.style.borderColor = COLOR_MAP[item.subject] || "#4f46e5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {item.subject}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: COLOR_MAP[item.subject] || "#4f46e5",
                  }}
                >
                  {item.count.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                  {total > 0 ? ((item.count / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Detail Modal ────────────────────────────────── */}
      {modalSubject && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "trFadeIn 0.2s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 16, padding: "24px 28px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              maxWidth: 1100, width: "96%", maxHeight: "88vh",
              display: "flex", flexDirection: "column",
              animation: "trSlideUp 0.25s ease-out",
              fontFamily: "Inter, 'Noto Sans Thai', sans-serif",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: accentColor, flexShrink: 0,
                }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  📋 {modalSubject}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: accentColor,
                  background: `${accentColor}15`, borderRadius: 10, padding: "2px 10px",
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
                  placeholder="🔍 ค้นหา..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  style={{
                    width: "100%", padding: "7px 12px 7px 32px", fontSize: 13,
                    border: "1.5px solid #e2e8f0", borderRadius: 8, outline: "none",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = accentColor; }}
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
                  borderTopColor: accentColor,
                  borderRadius: "50%", animation: "spin 0.8s linear infinite",
                }} />
                <span style={{ fontSize: 13, color: "#6b7280" }}>กำลังโหลดข้อมูล...</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : modalError ? (
              <div style={{ padding: 30, textAlign: "center", color: "#ef4444", fontSize: 14 }}>
                ❌ {modalError}
              </div>
            ) : (
              <div style={{ overflowY: "auto", overflowX: "auto", flex: 1, position: "relative" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12, minWidth: 900 }}>
                  <thead>
                    <tr style={{
                      position: "sticky", top: 0, zIndex: 2,
                    }}>
                      {["#", ...getTableHeaders().map(h => h.label)].map((h) => (
                        <th key={h} style={{
                          textAlign: "left", padding: "8px 8px", fontWeight: 600, fontSize: 11,
                          background: "#f8fafc", boxShadow: `inset 0 -2px 0 ${accentColor}30`,
                          color: "#475569", borderBottom: `2px solid ${accentColor}30`,
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
                        <td colSpan={10} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
                          ไม่พบข้อมูล
                        </td>
                      </tr>
                    ) : (
                      filteredModalRows.map((row, idx) => (
                        <tr key={idx} style={{
                          borderBottom: "1px solid #f1f5f9",
                          transition: "background 0.1s",
                        }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <td style={{ padding: "6px 8px", color: "#9ca3af", fontSize: 11 }}>{idx + 1}</td>
                          {getTableHeaders().map((h) => (
                            <td key={h.key} style={{ padding: "6px 8px", color: "#334155", whiteSpace: "nowrap" }}>
                              {row[h.key] ?? "-"}
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
            @keyframes trFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes trSlideUp { from { opacity: 0; transform: translateY(30px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}
    </div>
  );
}
