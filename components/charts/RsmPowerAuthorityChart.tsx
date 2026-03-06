"use client";
import React, { useState, useEffect, useCallback } from "react";
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
import * as XLSX from "xlsx";

type PowerEntry = {
    RBM: string;
    Yes: number;
    No: number;
    total: number;
};

type ChartSummary = {
    totalYes?: number;
    totalNo?: number;
};

type Props = {
    chartData: PowerEntry[];
    chartSummary?: ChartSummary | null;
    chartLoading?: boolean;
    selectedRsm?: string | null;
    selectedPowerAuthority?: string | null;
    onPowerAuthorityClick?: (rbm: string, status: "Yes" | "No") => void;
};

// Color tokens
const YES_COLOR = { from: "#4ade80", to: "#15803d", selected: "#166534", solid: "#22c55e", light: "#dcfce7", text: "#166534" };
const NO_COLOR = { from: "#f87171", to: "#b91c1c", selected: "#7f1d1d", solid: "#ef4444", light: "#fee2e2", text: "#b91c1c" };

export default function RsmPowerAuthorityChart({
    chartData,
    chartSummary,
    chartLoading,
    selectedRsm,
    selectedPowerAuthority,
    onPowerAuthorityClick,
}: Props) {

    // Totals for legend
    const totalYes = chartSummary?.totalYes ?? chartData.reduce((s, d) => s + (d.Yes || 0), 0);
    const totalNo = chartSummary?.totalNo ?? chartData.reduce((s, d) => s + (d.No || 0), 0);
    const grandTotal = totalYes + totalNo;

    // Legend modal state
    const [legendModal, setLegendModal] = useState<"Yes" | "No" | null>(null);
    const [modalRows, setModalRows] = useState<any[]>([]);
    const [modalLoading, setModalLoading] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const [modalSearch, setModalSearch] = useState("");

    // Fetch technician detail when modal opens
    const fetchModalData = useCallback(async (status: "Yes" | "No") => {
        setModalLoading(true);
        setModalError(null);
        setModalRows([]);
        setModalSearch("");
        try {
            const res = await fetch(`/api/chart/power-authority-detail?power_authority=${status}`, {
                cache: "no-store",
            });
            if (!res.ok) throw new Error("Failed to fetch data");
            const json = await res.json();
            setModalRows(json.rows ?? []);
        } catch (e: any) {
            setModalError(e?.message ?? "เกิดข้อผิดพลาด");
        } finally {
            setModalLoading(false);
        }
    }, []);

    const openLegendModal = useCallback((status: "Yes" | "No") => {
        setLegendModal(status);
        fetchModalData(status);
    }, [fetchModalData]);

    const closeLegendModal = useCallback(() => {
        setLegendModal(null);
        setModalRows([]);
        setModalError(null);
        setModalSearch("");
    }, []);

    // Filtered rows for search
    const filteredModalRows = modalSearch
        ? modalRows.filter((r) => {
            const q = modalSearch.toLowerCase();
            return Object.values(r).some((v) => String(v).toLowerCase().includes(q));
        })
        : modalRows;

    // Excel download
    const handleDownloadExcel = useCallback(() => {
        if (!filteredModalRows.length) return;
        const headers = ["HRBM", "RBM", "CBM", "provider", "depot_code", "depot_name", "tech_id", "full_name", "power_authority"];
        const wsData = [headers, ...filteredModalRows.map((r) => headers.map((h) => r[h] ?? "-"))];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        // Auto-width columns
        ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length, 14) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, legendModal === "Yes" ? "มีบัตรการไฟฟ้า" : "ไม่มีบัตรการไฟฟ้า");
        XLSX.writeFile(wb, `power_authority_${legendModal?.toLowerCase() ?? "all"}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }, [filteredModalRows, legendModal]);

    // ─── Glassmorphism Tooltip ─────────────────────────────────────
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const total = payload[0]?.payload?.total ?? 0;
        return (
            <div style={{
                background: "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 14,
                padding: "14px 18px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
                minWidth: 190,
                fontFamily: "Inter, 'Noto Sans Thai', sans-serif",
            }}>
                <p style={{
                    fontWeight: 700, fontSize: 13, color: "#f1f5f9", marginBottom: 10,
                    borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 6
                }}>
                    📍 {label}
                </p>
                {payload.map((entry: any, i: number) => {
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0";
                    return (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 5 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{
                                    width: 10, height: 10, borderRadius: "50%", backgroundColor: entry.color,
                                    flexShrink: 0, boxShadow: `0 0 6px ${entry.color}`
                                }} />
                                <span style={{ fontSize: 12, color: "#cbd5e1" }}>{entry.name}</span>
                            </div>
                            <span style={{ fontSize: 12, color: "#f8fafc", fontWeight: 600 }}>
                                {entry.value.toLocaleString()} ({pct}%)
                            </span>
                        </div>
                    );
                })}
                <div style={{
                    marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.1)",
                    display: "flex", justifyContent: "space-between"
                }}>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>รวมทั้งหมด</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8" }}>{total.toLocaleString()} คน</span>
                </div>
            </div>
        );
    };

    // ─── Loading ───────────────────────────────────────────────────
    if (chartLoading) {
        return (
            <div style={{
                minHeight: 420, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 12
            }}>
                <div style={{
                    width: 40, height: 40, border: "3px solid #e5e7eb",
                    borderTopColor: "#22c55e", borderRadius: "50%", animation: "spin 0.8s linear infinite"
                }} />
                <span style={{ fontSize: 14, color: "#6b7280" }}>กำลังโหลดข้อมูล...</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!chartData.length) {
        return (
            <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 15, color: "#9ca3af" }}>ไม่มีข้อมูล Chart</span>
            </div>
        );
    }

    return (
        <div style={{ fontFamily: "Inter, 'Noto Sans Thai', sans-serif" }}>

            {/* ── Legend Badges ─────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                {/* Yes */}
                <div
                    onClick={() => openLegendModal("Yes")}
                    style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: YES_COLOR.light, border: `1.5px solid ${YES_COLOR.solid}`,
                    borderRadius: 30, padding: "5px 14px 5px 8px", boxShadow: `0 2px 8px ${YES_COLOR.solid}30`,
                    cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s",
                }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = `0 4px 16px ${YES_COLOR.solid}50`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 2px 8px ${YES_COLOR.solid}30`; }}
                >
                    <span style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: `linear-gradient(135deg, ${YES_COLOR.from}, ${YES_COLOR.to})`,
                        boxShadow: `0 0 6px ${YES_COLOR.solid}80`, flexShrink: 0
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: YES_COLOR.text }}>✅ มีบัตรการไฟฟ้า</span>
                    <span style={{
                        fontSize: 11, fontWeight: 700, color: YES_COLOR.text,
                        background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "1px 7px"
                    }}>
                        {totalYes.toLocaleString()} ({grandTotal > 0 ? ((totalYes / grandTotal) * 100).toFixed(1) : 0}%)
                    </span>
                </div>
                {/* No */}
                <div
                    onClick={() => openLegendModal("No")}
                    style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: NO_COLOR.light, border: `1.5px solid ${NO_COLOR.solid}`,
                    borderRadius: 30, padding: "5px 14px 5px 8px", boxShadow: `0 2px 8px ${NO_COLOR.solid}30`,
                    cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s",
                }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = `0 4px 16px ${NO_COLOR.solid}50`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 2px 8px ${NO_COLOR.solid}30`; }}
                >
                    <span style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: `linear-gradient(135deg, ${NO_COLOR.from}, ${NO_COLOR.to})`,
                        boxShadow: `0 0 6px ${NO_COLOR.solid}80`, flexShrink: 0
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: NO_COLOR.text }}>❌ ไม่มีบัตรการไฟฟ้า</span>
                    <span style={{
                        fontSize: 11, fontWeight: 700, color: NO_COLOR.text,
                        background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "1px 7px"
                    }}>
                        {totalNo.toLocaleString()} ({grandTotal > 0 ? ((totalNo / grandTotal) * 100).toFixed(1) : 0}%)
                    </span>
                </div>
            </div>

            {/* ── Bar Chart ──────────────────────────────────────────── */}
            <ResponsiveContainer width="100%" height={420}>
                <BarChart data={chartData} margin={{ top: 24, right: 16, left: 10, bottom: 100 }} barSize={36}>
                    <defs>
                        <linearGradient id="paGradYes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4ade80" />
                            <stop offset="100%" stopColor="#15803d" />
                        </linearGradient>
                        <linearGradient id="paGradNo" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f87171" />
                            <stop offset="100%" stopColor="#b91c1c" />
                        </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

                    <XAxis dataKey="RBM" angle={-45} textAnchor="end" height={100} interval={0}
                        tick={{ fontSize: 10, fill: "#64748b", fontWeight: 500 }}
                        axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />

                    <YAxis tick={false} axisLine={false} tickLine={false} width={10} />

                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />

                    {/* Yes Bar */}
                    <Bar dataKey="Yes" stackId="a" fill="url(#paGradYes)" name="มีบัตรการไฟฟ้า"
                        style={{ cursor: "pointer" }}
                        onClick={(data: any) => { if (data?.RBM) onPowerAuthorityClick?.(data.RBM, "Yes"); }}>
                        {chartData.map((entry, idx) => {
                            const rsmSel = selectedRsm === entry.RBM;
                            const paSel = selectedPowerAuthority === "Yes";
                            return (
                                <Cell key={`cell-yes-${idx}`}
                                    fill={(rsmSel && paSel) ? YES_COLOR.selected : "url(#paGradYes)"}
                                    opacity={(selectedRsm && !rsmSel) || (selectedPowerAuthority && !paSel) ? 0.35 : 1}
                                    style={{ cursor: "pointer" }}
                                    onMouseDown={(e: any) => { e.stopPropagation(); onPowerAuthorityClick?.(entry.RBM, "Yes"); }}
                                />
                            );
                        })}
                        <LabelList dataKey="Yes" position="center" fill="white" fontSize={8} fontWeight="bold"
                            content={(props: any) => {
                                const { x, y, width, height, value, index } = props;
                                if (!value || value === 0) return null;
                                const e = chartData[index];
                                const tot = (e.Yes || 0) + (e.No || 0);
                                const pct = tot > 0 ? ((value / tot) * 100).toFixed(1) : "0.0";
                                const cx = x + width / 2;
                                const cy = y + height / 2;
                                if (height < 24) {
                                    return (
                                        <text x={cx} y={cy + 2} textAnchor="middle" fill="white" fontWeight="bold" fontSize="7">
                                            {value.toLocaleString()}
                                        </text>
                                    );
                                }
                                return (
                                    <text textAnchor="middle" fill="white" fontWeight="bold">
                                        <tspan x={cx} y={cy - 3} fontSize="8">{value.toLocaleString()}</tspan>
                                        <tspan x={cx} dy="11" fontSize="7.5">({pct}%)</tspan>
                                    </text>
                                );
                            }} />
                    </Bar>

                    {/* No Bar */}
                    <Bar dataKey="No" stackId="a" fill="url(#paGradNo)" name="ไม่มีบัตรการไฟฟ้า"
                        radius={[6, 6, 0, 0]} style={{ cursor: "pointer" }}
                        onClick={(data: any) => { if (data?.RBM) onPowerAuthorityClick?.(data.RBM, "No"); }}>
                        {chartData.map((entry, idx) => {
                            const rsmSel = selectedRsm === entry.RBM;
                            const paSel = selectedPowerAuthority === "No";
                            return (
                                <Cell key={`cell-no-${idx}`}
                                    fill={(rsmSel && paSel) ? NO_COLOR.selected : "url(#paGradNo)"}
                                    opacity={(selectedRsm && !rsmSel) || (selectedPowerAuthority && !paSel) ? 0.35 : 1}
                                    style={{ cursor: "pointer" }}
                                    onMouseDown={(e: any) => { e.stopPropagation(); onPowerAuthorityClick?.(entry.RBM, "No"); }}
                                />
                            );
                        })}
                        <LabelList dataKey="No" position="center" fill="white" fontSize={8} fontWeight="bold"
                            content={(props: any) => {
                                const { x, y, width, height, value, index } = props;
                                if (!value || value === 0) return null;
                                const e = chartData[index];
                                const tot = (e.Yes || 0) + (e.No || 0);
                                const pct = tot > 0 ? ((value / tot) * 100).toFixed(1) : "0.0";
                                const cx = x + width / 2;
                                const cy = y + height / 2;
                                if (height < 24) {
                                    return (
                                        <text x={cx} y={cy + 2} textAnchor="middle" fill="white" fontWeight="bold" fontSize="7">
                                            {value.toLocaleString()}
                                        </text>
                                    );
                                }
                                return (
                                    <text textAnchor="middle" fill="white" fontWeight="bold">
                                        <tspan x={cx} y={cy - 3} fontSize="8">{value.toLocaleString()}</tspan>
                                        <tspan x={cx} dy="11" fontSize="7.5">({pct}%)</tspan>
                                    </text>
                                );
                            }} />
                        {/* Total on top */}
                        <LabelList dataKey="total" position="top" fill="#1e293b" fontSize={11} fontWeight="bold" offset={6} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            {/* ── Summary Footer ─────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <div style={{
                    background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1px solid #bbf7d0",
                    borderRadius: 10, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#166534"
                }}>
                    ✅ มีบัตร {totalYes.toLocaleString()} คน
                </div>
                <div style={{
                    background: "linear-gradient(135deg, #fef2f2, #fee2e2)", border: "1px solid #fca5a5",
                    borderRadius: 10, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#b91c1c"
                }}>
                    ❌ ไม่มีบัตร {totalNo.toLocaleString()} คน
                </div>
                <div style={{
                    background: "linear-gradient(135deg, #f0f9ff, #e0f2fe)", border: "1px solid #bae6fd",
                    borderRadius: 10, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#0369a1"
                }}>
                    👷 รวม {grandTotal.toLocaleString()} คน
                </div>
            </div>

            {/* ── Legend Detail Modal ────────────────────────────────── */}
            {legendModal && (
                <div
                    onClick={closeLegendModal}
                    style={{
                        position: "fixed", inset: 0, zIndex: 9999,
                        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        animation: "paFadeIn 0.2s ease-out",
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: "white", borderRadius: 16, padding: "24px 28px",
                            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                            maxWidth: 1100, width: "96%", maxHeight: "88vh",
                            display: "flex", flexDirection: "column",
                            animation: "paSlideUp 0.25s ease-out",
                            fontFamily: "Inter, 'Noto Sans Thai', sans-serif",
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <span style={{
                                    width: 12, height: 12, borderRadius: "50%",
                                    background: legendModal === "Yes"
                                        ? `linear-gradient(135deg, ${YES_COLOR.from}, ${YES_COLOR.to})`
                                        : `linear-gradient(135deg, ${NO_COLOR.from}, ${NO_COLOR.to})`,
                                    flexShrink: 0,
                                }} />
                                <span style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                                    {legendModal === "Yes" ? "✅ มีบัตรการไฟฟ้า" : "❌ ไม่มีบัตรการไฟฟ้า"}
                                </span>
                                <span style={{
                                    fontSize: 13, fontWeight: 700,
                                    color: legendModal === "Yes" ? YES_COLOR.text : NO_COLOR.text,
                                    background: legendModal === "Yes" ? YES_COLOR.light : NO_COLOR.light,
                                    borderRadius: 10, padding: "2px 10px",
                                }}>
                                    {modalLoading ? "..." : `${filteredModalRows.length.toLocaleString()} คน`}
                                </span>
                            </div>
                            <button
                                onClick={closeLegendModal}
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
                                    onFocus={(e) => { e.currentTarget.style.borderColor = "#94a3b8"; }}
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
                                    borderTopColor: legendModal === "Yes" ? "#22c55e" : "#ef4444",
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
                            <div style={{ overflowY: "auto", overflowX: "auto", flex: 1 }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
                                    <thead>
                                        <tr style={{
                                            background: legendModal === "Yes"
                                                ? "linear-gradient(135deg, #f0fdf4, #dcfce7)"
                                                : "linear-gradient(135deg, #fef2f2, #fee2e2)",
                                            position: "sticky", top: 0, zIndex: 1,
                                        }}>
                                            {["#", "HRBM", "RBM", "CBM", "Provider", "Depot Code", "Depot Name", "Tech ID", "Full Name", "Power Authority"].map((h) => (
                                                <th key={h} style={{
                                                    textAlign: "left", padding: "8px 8px", fontWeight: 600, fontSize: 11,
                                                    color: legendModal === "Yes" ? YES_COLOR.text : NO_COLOR.text,
                                                    borderBottom: `2px solid ${legendModal === "Yes" ? "#bbf7d0" : "#fca5a5"}`,
                                                    whiteSpace: "nowrap",
                                                }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredModalRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                                                    ไม่พบข้อมูล
                                                </td>
                                            </tr>
                                        ) : filteredModalRows.map((row, i) => (
                                            <tr key={`${row.tech_id}-${i}`}
                                                style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.1s" }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                            >
                                                <td style={{ padding: "6px 8px", color: "#94a3b8", fontWeight: 500 }}>{i + 1}</td>
                                                <td style={{ padding: "6px 8px", color: "#1e293b" }}>{row.HRBM}</td>
                                                <td style={{ padding: "6px 8px", color: "#1e293b", fontWeight: 600 }}>{row.RBM}</td>
                                                <td style={{ padding: "6px 8px", color: "#1e293b" }}>{row.CBM}</td>
                                                <td style={{ padding: "6px 8px", color: "#1e293b" }}>{row.provider}</td>
                                                <td style={{ padding: "6px 8px", color: "#64748b" }}>{row.depot_code}</td>
                                                <td style={{ padding: "6px 8px", color: "#1e293b" }}>{row.depot_name}</td>
                                                <td style={{ padding: "6px 8px", color: "#0369a1", fontWeight: 600 }}>{row.tech_id}</td>
                                                <td style={{ padding: "6px 8px", color: "#1e293b" }}>{row.full_name}</td>
                                                <td style={{ padding: "6px 8px" }}>
                                                    <span style={{
                                                        fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "2px 8px",
                                                        background: row.power_authority === "Yes" ? YES_COLOR.light : NO_COLOR.light,
                                                        color: row.power_authority === "Yes" ? YES_COLOR.text : NO_COLOR.text,
                                                    }}>
                                                        {row.power_authority === "Yes" ? "มี" : "ไม่มี"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Footer */}
                        <div style={{
                            marginTop: 12, paddingTop: 10, borderTop: "1px solid #e2e8f0",
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}>
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>
                                {modalLoading ? "กำลังโหลด..." : `แสดง ${filteredModalRows.length.toLocaleString()} จาก ${modalRows.length.toLocaleString()} รายการ`}
                            </span>
                            <button
                                onClick={closeLegendModal}
                                style={{
                                    background: legendModal === "Yes"
                                        ? `linear-gradient(135deg, ${YES_COLOR.from}, ${YES_COLOR.to})`
                                        : `linear-gradient(135deg, ${NO_COLOR.from}, ${NO_COLOR.to})`,
                                    color: "white", border: "none", borderRadius: 8,
                                    padding: "6px 18px", fontSize: 12, fontWeight: 600,
                                    cursor: "pointer", transition: "opacity 0.15s",
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                            >
                                ปิด
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal animations */}
            <style>{`
                @keyframes paFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes paSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
