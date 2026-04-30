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
    HRBM?: string;
    Yes: number;
    No: number;
    total: number;
    CourseG?: number;
    CourseGNo?: number;
    CourseEC?: number;
    CourseECNo?: number;
    totalRbm?: number;
};

type ChartSummary = {
    totalYes?: number;
    totalNo?: number;
    totalCourseG?: number;
    totalCourseEC?: number;
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
const YES_COLOR = { from: "#ffb74d", to: "#e65100", selected: "#bf360c", solid: "#f57c00", light: "#fff3e0", text: "#e65100" };
const NO_COLOR = { from: "#e2e8f0", to: "#94a3b8", selected: "#334155", solid: "#cbd5e1", light: "#f1f5f9", text: "#475569" };
const CG_COLOR  = { from: "#34d399", to: "#0d9488", solid: "#14b8a6", light: "#ccfbf1", text: "#0f766e", selected: "#065f46" };
const CG_NO_COLOR  = { from: "#e2e8f0", to: "#94a3b8", solid: "#cbd5e1", text: "#475569" };
const CEC_COLOR = { from: "#fff176", to: "#f9a825", selected: "#f57f17", solid: "#ffee58", light: "#fffde7", text: "#f57f17" };
const CEC_NO_COLOR = { from: "#e2e8f0", to: "#94a3b8", solid: "#cbd5e1", text: "#475569" };

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
    const totalCourseG = chartSummary?.totalCourseG ?? chartData.reduce((s, d) => s + (d.CourseG || 0), 0);
    const totalCourseEC = chartSummary?.totalCourseEC ?? chartData.reduce((s, d) => s + (d.CourseEC || 0), 0);
    const totalCourseGNo = chartData.reduce((s, d) => s + (d.CourseGNo || 0), 0);
    const totalCourseECNo = chartData.reduce((s, d) => s + (d.CourseECNo || 0), 0);
    const totalCGAll = totalCourseG + totalCourseGNo;
    const totalCECAll = totalCourseEC + totalCourseECNo;

    // Legend modal state — supports PA (Yes/No) + Course G/EC (pass/notpass)
    type ModalType = "Yes" | "No" | "CG_pass" | "CG_notpass" | "CEC_pass" | "CEC_notpass";
    const [legendModal, setLegendModal] = useState<ModalType | null>(null);
    const [modalRows, setModalRows] = useState<any[]>([]);
    const [modalLoading, setModalLoading] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const [modalSearch, setModalSearch] = useState("");

    // Fetch technician detail when modal opens
    const fetchModalData = useCallback(async (type: ModalType) => {
        setModalLoading(true);
        setModalError(null);
        setModalRows([]);
        setModalSearch("");
        try {
            let url = "";
            if (type === "Yes" || type === "No") {
                url = `/api/chart/power-authority-detail?power_authority=${type}`;
            } else {
                const course = type.startsWith("CG") ? "g" : "ec";
                const status = type.endsWith("pass") && !type.endsWith("notpass") ? "pass" : "notpass";
                url = `/api/chart/course-detail?course=${course}&status=${status}`;
            }
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to fetch data");
            const json = await res.json();
            setModalRows(json.rows ?? []);
        } catch (e: any) {
            setModalError(e?.message ?? "เกิดข้อผิดพลาด");
        } finally {
            setModalLoading(false);
        }
    }, []);

    const openLegendModal = useCallback((type: ModalType) => {
        setLegendModal(type);
        fetchModalData(type);
    }, [fetchModalData]);

    const closeLegendModal = useCallback(() => {
        setLegendModal(null);
        setModalRows([]);
        setModalError(null);
        setModalSearch("");
    }, []);

    // ── Active groups for chart toggle (PA / CG / CEC) ──────────
    type GroupKey = "PA" | "CG" | "CEC";
    const [activeGroups, setActiveGroups] = React.useState<Set<GroupKey>>(new Set(["PA", "CG", "CEC"]));

    const toggleGroup = (g: GroupKey) => {
        setActiveGroups((prev) => {
            const next = new Set(prev);
            if (next.has(g)) {
                // ต้องเหลืออย่างน้อย 1 กลุ่ม
                if (next.size > 1) next.delete(g);
            } else {
                next.add(g);
            }
            return next;
        });
    };

    // Filtered rows for search
    const filteredModalRows = modalSearch
        ? modalRows.filter((r) => {
            const q = modalSearch.toLowerCase();
            return Object.values(r).some((v) => String(v).toLowerCase().includes(q));
        })
        : modalRows;

    // Modal meta helpers
    const modalIsCourse = legendModal && legendModal !== "Yes" && legendModal !== "No";
    const modalLabel = legendModal === "Yes" ? "✅ มีบัตรการไฟฟ้า"
        : legendModal === "No" ? "❌ ไม่มีบัตรการไฟฟ้า"
        : legendModal === "CG_pass" ? "📗 Course G อบรมแล้ว"
        : legendModal === "CG_notpass" ? "⬜ Course G ยังไม่อบรม"
        : legendModal === "CEC_pass" ? "📙 Course EC อบรมแล้ว"
        : legendModal === "CEC_notpass" ? "⬜ Course EC ยังไม่อบรม" : "";
    const modalColor = legendModal === "Yes" ? YES_COLOR
        : legendModal === "No" ? NO_COLOR
        : legendModal?.startsWith("CG") ? CG_COLOR
        : CEC_COLOR;
    const modalIsG = legendModal?.startsWith("CG");
    const modalIsEC = legendModal?.startsWith("CEC");
    const modalHeaderCols = modalIsG
        ? ["#", "HRBM", "RBM", "CBM", "Provider", "Depot Code", "Depot Name", "Tech ID", "Full Name", "Course G"]
        : modalIsEC
        ? ["#", "HRBM", "RBM", "CBM", "Provider", "Depot Code", "Depot Name", "Tech ID", "Full Name", "Course EC"]
        : ["#", "HRBM", "RBM", "CBM", "Provider", "Depot Code", "Depot Name", "Tech ID", "Full Name", "Power Authority"];

    // Excel download
    const handleDownloadExcel = useCallback(() => {
        if (!filteredModalRows.length) return;
        const headers = modalIsG
            ? ["HRBM", "RBM", "CBM", "provider", "depot_code", "depot_name", "tech_id", "full_name", "course_g"]
            : modalIsEC
            ? ["HRBM", "RBM", "CBM", "provider", "depot_code", "depot_name", "tech_id", "full_name", "course_ec"]
            : ["HRBM", "RBM", "CBM", "provider", "depot_code", "depot_name", "tech_id", "full_name", "power_authority"];
        const wsData = [headers, ...filteredModalRows.map((r) => headers.map((h) => r[h] ?? "-"))];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length, 14) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, modalLabel.replace(/[^a-zA-Z0-9ก-๙ ]/g, "").trim().slice(0, 31));
        XLSX.writeFile(wb, `course_detail_${legendModal?.toLowerCase() ?? "all"}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }, [filteredModalRows, legendModal, modalIsCourse, modalIsG, modalIsEC, modalLabel]);

    // ─── Glassmorphism Tooltip ─────────────────────────────────────
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const rowData = payload[0]?.payload;
        const paTotal = rowData?.total ?? 0;
        const cgTotal = (rowData?.CourseG ?? 0) + (rowData?.CourseGNo ?? 0);
        const cecTotal = (rowData?.CourseEC ?? 0) + (rowData?.CourseECNo ?? 0);
        const hrbm = rowData?.HRBM;
        const fmt = (v: number, t: number) => t > 0 ? `${v} (${((v / t) * 100).toFixed(1)}%)` : `${v}`;
        return (
            <div style={{
                background: "linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.96) 100%)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 14, padding: "14px 18px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
                minWidth: 240, fontFamily: "Inter, 'Noto Sans Thai', sans-serif",
            }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9", marginBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 6 }}>
                    📍 {label}
                </p>
                {hrbm && <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>🗺️ พื้นที่: {hrbm}</p>}

                {/* Power Authority */}
                <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, fontWeight: 600 }}>⚡ Power Authority</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: "#f57c00" }}>✅ มีบัตร</span>
                    <span style={{ fontSize: 11, color: "#f8fafc", fontWeight: 600 }}>{fmt(rowData?.Yes ?? 0, paTotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>❌ ไม่มีบัตร</span>
                    <span style={{ fontSize: 11, color: "#f8fafc", fontWeight: 600 }}>{fmt(rowData?.No ?? 0, paTotal)}</span>
                </div>

                {/* Course G */}
                <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, fontWeight: 600 }}>📗 Course G</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: "#34d399" }}>✅ อบรมแล้ว</span>
                    <span style={{ fontSize: 11, color: "#f8fafc", fontWeight: 600 }}>{fmt(rowData?.CourseG ?? 0, cgTotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>⬜ ยังไม่อบรม</span>
                    <span style={{ fontSize: 11, color: "#f8fafc", fontWeight: 600 }}>{fmt(rowData?.CourseGNo ?? 0, cgTotal)}</span>
                </div>

                {/* Course EC */}
                <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, fontWeight: 600 }}>📙 Course EC</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: "#f9a825" }}>✅ อบรมแล้ว</span>
                    <span style={{ fontSize: 11, color: "#f8fafc", fontWeight: 600 }}>{fmt(rowData?.CourseEC ?? 0, cecTotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>⬜ ยังไม่อบรม</span>
                    <span style={{ fontSize: 11, color: "#f8fafc", fontWeight: 600 }}>{fmt(rowData?.CourseECNo ?? 0, cecTotal)}</span>
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

    // Legend items config
    const legendItems: { key: GroupKey; label: string; color: string; border: string; dotFrom: string; dotTo: string }[] = [
        { key: "PA", label: "บัตรไฟฟ้า", color: YES_COLOR.text, border: YES_COLOR.solid, dotFrom: YES_COLOR.from, dotTo: YES_COLOR.to },
        { key: "CG", label: "Course G",  color: CG_COLOR.text,  border: CG_COLOR.solid,  dotFrom: CG_COLOR.from,  dotTo: CG_COLOR.to  },
        { key: "CEC", label: "Course EC", color: CEC_COLOR.text, border: CEC_COLOR.solid, dotFrom: CEC_COLOR.from, dotTo: CEC_COLOR.to  },
    ];

    return (
        <div style={{ fontFamily: "Inter, 'Noto Sans Thai', sans-serif" }}>

            {/* ── Bar Chart ──────────────────────────────────────────── */}
            {/* 1 RBM = 3 กลุ่มแท่ง: Power Authority (Yes/No stacked) | Course G (อบรม/ยังไม่อบรม stacked) | Course EC (อบรม/ยังไม่อบรม stacked) */}
            <div style={{ position: "relative" }}>

            {/* ── Chart Legend overlay (top-right) ── */}
            <div style={{
                position: "absolute", top: 6, right: 8, zIndex: 10,
                display: "flex", flexDirection: "column", gap: 5,
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(6px)",
                borderRadius: 10,
                padding: "8px 12px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
                border: "1px solid rgba(226,232,240,0.8)",
                minWidth: 120,
            }}>
                <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.5px", marginBottom: 2 }}>SHOW / HIDE</span>
                {legendItems.map(({ key, label, color, border, dotFrom, dotTo }) => {
                    const isActive = activeGroups.has(key);
                    return (
                        <button
                            key={key}
                            onClick={() => toggleGroup(key)}
                            style={{
                                display: "flex", alignItems: "center", gap: 7,
                                background: isActive ? `${border}18` : "#f1f5f9",
                                border: `1.5px solid ${isActive ? border : "#cbd5e1"}`,
                                borderRadius: 20, padding: "4px 10px 4px 8px",
                                cursor: "pointer", outline: "none",
                                transition: "all 0.15s",
                                opacity: isActive ? 1 : 0.45,
                            }}
                            title={isActive ? `ซ่อน ${label}` : `แสดง ${label}`}
                        >
                            <span style={{
                                width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                                background: isActive ? `linear-gradient(135deg, ${dotFrom}, ${dotTo})` : "#94a3b8",
                                boxShadow: isActive ? `0 0 5px ${border}80` : "none",
                            }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? color : "#94a3b8", whiteSpace: "nowrap" }}>
                                {label}
                            </span>
                            {isActive && (
                                <span style={{ fontSize: 9, color: "white", background: border, borderRadius: 6, padding: "1px 5px", marginLeft: 2, fontWeight: 700 }}>ON</span>
                            )}
                        </button>
                    );
                })}
            </div>

            <ResponsiveContainer width="100%" height={500}>
                <BarChart
                    data={chartData}
                    margin={{ top: 36, right: 24, left: 10, bottom: 40 }}
                    barCategoryGap="18%"
                    barGap={5}
                >
                    <defs>
                        <linearGradient id="paGradYes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ffb74d" /><stop offset="100%" stopColor="#e65100" />
                        </linearGradient>
                        <linearGradient id="paGradNo" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#e2e8f0" /><stop offset="100%" stopColor="#94a3b8" />
                        </linearGradient>
                        <linearGradient id="paGradCG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#0d9488" />
                        </linearGradient>
                        <linearGradient id="paGradCGNo" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#e2e8f0" /><stop offset="100%" stopColor="#94a3b8" />
                        </linearGradient>
                        <linearGradient id="paGradCEC" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fff176" /><stop offset="100%" stopColor="#f9a825" />
                        </linearGradient>
                        <linearGradient id="paGradCECNo" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#e2e8f0" /><stop offset="100%" stopColor="#94a3b8" />
                        </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

                    <XAxis dataKey="RBM" angle={-45} textAnchor="end" height={110} interval={0}
                        tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
                        axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />

                    <YAxis tick={false} axisLine={false} tickLine={false} width={0} />

                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.06)" }} />

                    {/* ── กลุ่มที่ 1: Power Authority ── */}
                    <Bar dataKey="Yes" stackId="pa" name="มีบัตรการไฟฟ้า" hide={!activeGroups.has("PA")}
                        style={{ cursor: "pointer" }}
                        onClick={(data: any) => { if (data?.RBM) onPowerAuthorityClick?.(data.RBM, "Yes"); }}>
                        {chartData.map((entry, idx) => {
                            const sel = selectedRsm === entry.RBM && selectedPowerAuthority === "Yes";
                            const dim = (selectedRsm && selectedRsm !== entry.RBM) || (selectedPowerAuthority && selectedPowerAuthority !== "Yes");
                            return <Cell key={`cy-${idx}`} fill={sel ? YES_COLOR.selected : "url(#paGradYes)"} opacity={dim ? 0.3 : 1} style={{ cursor: "pointer" }} onMouseDown={(e: any) => { e.stopPropagation(); onPowerAuthorityClick?.(entry.RBM, "Yes"); }} />;
                        })}
                        <LabelList dataKey="Yes" content={(props: any) => {
                            const { x, y, width, height, value, index } = props;
                            if (!value || value === 0 || height < 18) return null;
                            const tot = (chartData[index]?.Yes || 0) + (chartData[index]?.No || 0);
                            const pct = tot > 0 ? `${((value / tot) * 100).toFixed(0)}%` : "";
                            const cx = x + width / 2;
                            const cy = y + height / 2;
                            return height < 28
                                ? <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">{value}</text>
                                : <text textAnchor="middle" fill="white" fontWeight="bold">
                                    <tspan x={cx} y={cy - 2} fontSize={9}>{value}</tspan>
                                    <tspan x={cx} dy={11} fontSize={8}>{pct}</tspan>
                                  </text>;
                        }} />
                    </Bar>
                    <Bar dataKey="No" stackId="pa" name="ไม่มีบัตรการไฟฟ้า" radius={[5, 5, 0, 0]} hide={!activeGroups.has("PA")}
                        style={{ cursor: "pointer" }}
                        onClick={(data: any) => { if (data?.RBM) onPowerAuthorityClick?.(data.RBM, "No"); }}>
                        {chartData.map((entry, idx) => {
                            const sel = selectedRsm === entry.RBM && selectedPowerAuthority === "No";
                            const dim = (selectedRsm && selectedRsm !== entry.RBM) || (selectedPowerAuthority && selectedPowerAuthority !== "No");
                            return <Cell key={`cn-${idx}`} fill={sel ? NO_COLOR.selected : "url(#paGradNo)"} opacity={dim ? 0.3 : 1} style={{ cursor: "pointer" }} onMouseDown={(e: any) => { e.stopPropagation(); onPowerAuthorityClick?.(entry.RBM, "No"); }} />;
                        })}
                        <LabelList dataKey="No" content={(props: any) => {
                            const { x, y, width, height, value, index } = props;
                            if (!value || value === 0 || height < 18) return null;
                            const tot = (chartData[index]?.Yes || 0) + (chartData[index]?.No || 0);
                            const pct = tot > 0 ? `${((value / tot) * 100).toFixed(0)}%` : "";
                            const cx = x + width / 2;
                            const cy = y + height / 2;
                            return height < 28
                                ? <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">{value}</text>
                                : <text textAnchor="middle" fill="white" fontWeight="bold">
                                    <tspan x={cx} y={cy - 2} fontSize={9}>{value}</tspan>
                                    <tspan x={cx} dy={11} fontSize={8}>{pct}</tspan>
                                  </text>;
                        }} />
                        <LabelList dataKey="total" content={(props: any) => {
                            const { x, y, width, value } = props;
                            if (!value) return null;
                            return <text x={x + width / 2} y={y - 7} textAnchor="middle" fill={YES_COLOR.solid} fontSize={11} fontWeight="bold">{value}</text>;
                        }} />
                    </Bar>

                    {/* ── กลุ่มที่ 2: Course G ── */}
                    <Bar dataKey="CourseG" stackId="cg" name="Course G อบรมแล้ว" hide={!activeGroups.has("CG")}>
                        {chartData.map((_, idx) => <Cell key={`cg-${idx}`} fill="url(#paGradCG)" />)}
                        <LabelList dataKey="CourseG" content={(props: any) => {
                            const { x, y, width, height, value, index } = props;
                            if (!value || value === 0 || height < 18) return null;
                            const tot = (chartData[index]?.CourseG || 0) + (chartData[index]?.CourseGNo || 0);
                            const pct = tot > 0 ? `${((value / tot) * 100).toFixed(0)}%` : "";
                            const cx = x + width / 2;
                            const cy = y + height / 2;
                            return height < 28
                                ? <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">{value}</text>
                                : <text textAnchor="middle" fill="white" fontWeight="bold">
                                    <tspan x={cx} y={cy - 2} fontSize={9}>{value}</tspan>
                                    <tspan x={cx} dy={11} fontSize={8}>{pct}</tspan>
                                  </text>;
                        }} />
                    </Bar>
                    <Bar dataKey="CourseGNo" stackId="cg" name="Course G ยังไม่อบรม" radius={[5, 5, 0, 0]} hide={!activeGroups.has("CG")}>
                        {chartData.map((_, idx) => <Cell key={`cgno-${idx}`} fill="url(#paGradCGNo)" />)}
                        <LabelList dataKey="CourseGNo" content={(props: any) => {
                            const { x, y, width, height, value, index } = props;
                            if (!value || value === 0 || height < 18) return null;
                            const tot = (chartData[index]?.CourseG || 0) + (chartData[index]?.CourseGNo || 0);
                            const pct = tot > 0 ? `${((value / tot) * 100).toFixed(0)}%` : "";
                            const cx = x + width / 2;
                            const cy = y + height / 2;
                            return height < 28
                                ? <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">{value}</text>
                                : <text textAnchor="middle" fill="white" fontWeight="bold">
                                    <tspan x={cx} y={cy - 2} fontSize={9}>{value}</tspan>
                                    <tspan x={cx} dy={11} fontSize={8}>{pct}</tspan>
                                  </text>;
                        }} />
                        {/* Total Course G บนสุด */}
                        <LabelList content={(props: any) => {
                            const { x, y, width, index } = props;
                            const tot = (chartData[index]?.CourseG || 0) + (chartData[index]?.CourseGNo || 0);
                            if (!tot) return null;
                            return <text x={x + width / 2} y={y - 7} textAnchor="middle" fill={CG_COLOR.text} fontSize={11} fontWeight="bold">{tot}</text>;
                        }} />
                    </Bar>

                    {/* ── กลุ่มที่ 3: Course EC ── */}
                    <Bar dataKey="CourseEC" stackId="cec" name="Course EC อบรมแล้ว" hide={!activeGroups.has("CEC")}>
                        {chartData.map((_, idx) => <Cell key={`cec-${idx}`} fill="url(#paGradCEC)" />)}
                        <LabelList dataKey="CourseEC" content={(props: any) => {
                            const { x, y, width, height, value, index } = props;
                            if (!value || value === 0 || height < 18) return null;
                            const tot = (chartData[index]?.CourseEC || 0) + (chartData[index]?.CourseECNo || 0);
                            const pct = tot > 0 ? `${((value / tot) * 100).toFixed(0)}%` : "";
                            const cx = x + width / 2;
                            const cy = y + height / 2;
                            return height < 28
                                ? <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">{value}</text>
                                : <text textAnchor="middle" fill="white" fontWeight="bold">
                                    <tspan x={cx} y={cy - 2} fontSize={9}>{value}</tspan>
                                    <tspan x={cx} dy={11} fontSize={8}>{pct}</tspan>
                                  </text>;
                        }} />
                    </Bar>
                    <Bar dataKey="CourseECNo" stackId="cec" name="Course EC ยังไม่อบรม" radius={[5, 5, 0, 0]} hide={!activeGroups.has("CEC")}>
                        {chartData.map((_, idx) => <Cell key={`cecno-${idx}`} fill="url(#paGradCECNo)" />)}
                        <LabelList dataKey="CourseECNo" content={(props: any) => {
                            const { x, y, width, height, value, index } = props;
                            if (!value || value === 0 || height < 18) return null;
                            const tot = (chartData[index]?.CourseEC || 0) + (chartData[index]?.CourseECNo || 0);
                            const pct = tot > 0 ? `${((value / tot) * 100).toFixed(0)}%` : "";
                            const cx = x + width / 2;
                            const cy = y + height / 2;
                            return height < 28
                                ? <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">{value}</text>
                                : <text textAnchor="middle" fill="white" fontWeight="bold">
                                    <tspan x={cx} y={cy - 2} fontSize={9}>{value}</tspan>
                                    <tspan x={cx} dy={11} fontSize={8}>{pct}</tspan>
                                  </text>;
                        }} />
                        {/* Total Course EC บนสุด */}
                        <LabelList content={(props: any) => {
                            const { x, y, width, index } = props;
                            const tot = (chartData[index]?.CourseEC || 0) + (chartData[index]?.CourseECNo || 0);
                            if (!tot) return null;
                            return <text x={x + width / 2} y={y - 7} textAnchor="middle" fill={CEC_COLOR.text} fontSize={11} fontWeight="bold">{tot}</text>;
                        }} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            </div>{/* end position:relative wrapper */}

            {/* ── Legend Badges (below chart, paired by group) ───────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4, maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
                {/* Row 1 — บัตรการไฟฟ้า */}
                <div
                    onClick={() => openLegendModal("Yes")}
                    style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                        background: YES_COLOR.light, border: `1.5px solid ${YES_COLOR.solid}`,
                        borderRadius: 30, padding: "5px 14px 5px 8px", boxShadow: `0 2px 8px ${YES_COLOR.solid}30`,
                        cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = `0 4px 16px ${YES_COLOR.solid}50`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 2px 8px ${YES_COLOR.solid}30`; }}
                >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: `linear-gradient(135deg, ${YES_COLOR.from}, ${YES_COLOR.to})`, boxShadow: `0 0 6px ${YES_COLOR.solid}80`, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: YES_COLOR.text }}>✅ มีบัตรการไฟฟ้า</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: YES_COLOR.text, background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "1px 7px", whiteSpace: "nowrap" }}>
                        {totalYes.toLocaleString()} ({grandTotal > 0 ? ((totalYes / grandTotal) * 100).toFixed(1) : 0}%)
                    </span>
                </div>
                <div
                    onClick={() => openLegendModal("No")}
                    style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                        background: NO_COLOR.light, border: `1.5px solid ${NO_COLOR.solid}`,
                        borderRadius: 30, padding: "5px 14px 5px 8px", boxShadow: `0 2px 8px ${NO_COLOR.solid}30`,
                        cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = `0 4px 16px ${NO_COLOR.solid}50`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 2px 8px ${NO_COLOR.solid}30`; }}
                >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: `linear-gradient(135deg, ${NO_COLOR.from}, ${NO_COLOR.to})`, boxShadow: `0 0 6px ${NO_COLOR.solid}80`, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: NO_COLOR.text }}>❌ ไม่มีบัตรการไฟฟ้า</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: NO_COLOR.text, background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "1px 7px", whiteSpace: "nowrap" }}>
                        {totalNo.toLocaleString()} ({grandTotal > 0 ? ((totalNo / grandTotal) * 100).toFixed(1) : 0}%)
                    </span>
                </div>
                {/* Row 2 — Course G */}
                <div
                    onClick={() => openLegendModal("CG_pass")}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: CG_COLOR.light, border: `1.5px solid ${CG_COLOR.solid}`, borderRadius: 30, padding: "5px 14px 5px 8px", boxShadow: `0 2px 8px ${CG_COLOR.solid}30`, cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = `0 4px 16px ${CG_COLOR.solid}50`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 2px 8px ${CG_COLOR.solid}30`; }}
                >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: `linear-gradient(135deg, ${CG_COLOR.from}, ${CG_COLOR.to})`, boxShadow: `0 0 6px ${CG_COLOR.solid}80`, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: CG_COLOR.text }}>📗 Course G อบรมแล้ว</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: CG_COLOR.text, background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "1px 7px", whiteSpace: "nowrap" }}>
                        {totalCourseG.toLocaleString()} ({totalCGAll > 0 ? ((totalCourseG / totalCGAll) * 100).toFixed(1) : 0}%)
                    </span>
                </div>
                <div
                    onClick={() => openLegendModal("CG_notpass")}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#f1f5f9", border: `1.5px solid ${CG_NO_COLOR.solid}`, borderRadius: 30, padding: "5px 14px 5px 8px", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = `0 4px 16px ${CG_NO_COLOR.solid}50`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: `linear-gradient(135deg, ${CG_NO_COLOR.from}, ${CG_NO_COLOR.to})`, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: CG_NO_COLOR.text }}>⬜ Course G ยังไม่อบรม</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: CG_NO_COLOR.text, background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "1px 7px", whiteSpace: "nowrap" }}>
                        {totalCourseGNo.toLocaleString()} ({totalCGAll > 0 ? ((totalCourseGNo / totalCGAll) * 100).toFixed(1) : 0}%)
                    </span>
                </div>
                {/* Row 3 — Course EC */}
                <div
                    onClick={() => openLegendModal("CEC_pass")}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: CEC_COLOR.light, border: `1.5px solid ${CEC_COLOR.solid}`, borderRadius: 30, padding: "5px 14px 5px 8px", boxShadow: `0 2px 8px ${CEC_COLOR.solid}30`, cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = `0 4px 16px ${CEC_COLOR.solid}50`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 2px 8px ${CEC_COLOR.solid}30`; }}
                >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: `linear-gradient(135deg, ${CEC_COLOR.from}, ${CEC_COLOR.to})`, boxShadow: `0 0 6px ${CEC_COLOR.solid}80`, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: CEC_COLOR.text }}>📙 Course EC อบรมแล้ว</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: CEC_COLOR.text, background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "1px 7px", whiteSpace: "nowrap" }}>
                        {totalCourseEC.toLocaleString()} ({totalCECAll > 0 ? ((totalCourseEC / totalCECAll) * 100).toFixed(1) : 0}%)
                    </span>
                </div>
                <div
                    onClick={() => openLegendModal("CEC_notpass")}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#f1f5f9", border: `1.5px solid ${CEC_NO_COLOR.solid}`, borderRadius: 30, padding: "5px 14px 5px 8px", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = `0 4px 16px ${CEC_NO_COLOR.solid}50`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: `linear-gradient(135deg, ${CEC_NO_COLOR.from}, ${CEC_NO_COLOR.to})`, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: CEC_NO_COLOR.text }}>⬜ Course EC ยังไม่อบรม</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: CEC_NO_COLOR.text, background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "1px 7px", whiteSpace: "nowrap" }}>
                        {totalCourseECNo.toLocaleString()} ({totalCECAll > 0 ? ((totalCourseECNo / totalCECAll) * 100).toFixed(1) : 0}%)
                    </span>
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
                                    background: `linear-gradient(135deg, ${modalColor.from}, ${modalColor.to})`,
                                    flexShrink: 0,
                                }} />
                                <span style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                                    {modalLabel}
                                </span>
                                <span style={{
                                    fontSize: 13, fontWeight: 700,
                                    color: modalColor.text,
                                    background: (modalColor as any).light ?? "#f1f5f9",
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
                                    borderTopColor: modalColor.solid,
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
                                            background: `linear-gradient(135deg, ${(modalColor as any).light ?? "#f1f5f9"}, ${(modalColor as any).light ?? "#e2e8f0"})`,
                                            position: "sticky", top: 0, zIndex: 1,
                                        }}>
                                            {modalHeaderCols.map((h) => (
                                                <th key={h} style={{
                                                    textAlign: "left", padding: "8px 8px", fontWeight: 600, fontSize: 11,
                                                    color: modalColor.text,
                                                    borderBottom: `2px solid ${modalColor.solid}`,
                                                    whiteSpace: "nowrap",
                                                }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredModalRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={modalHeaderCols.length} style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
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
                                                {modalIsG ? (
                                                    <td style={{ padding: "6px 8px" }}>
                                                        <span style={{
                                                            fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "2px 8px",
                                                            background: String(row.course_g).toLowerCase() === "pass" ? CG_COLOR.light : "#f1f5f9",
                                                            color: String(row.course_g).toLowerCase() === "pass" ? CG_COLOR.text : CG_NO_COLOR.text,
                                                        }}>
                                                            {row.course_g ?? "-"}
                                                        </span>
                                                    </td>
                                                ) : modalIsEC ? (
                                                    <td style={{ padding: "6px 8px" }}>
                                                        <span style={{
                                                            fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "2px 8px",
                                                            background: String(row.course_ec).toLowerCase() === "pass" ? CEC_COLOR.light : "#f1f5f9",
                                                            color: String(row.course_ec).toLowerCase() === "pass" ? CEC_COLOR.text : CEC_NO_COLOR.text,
                                                        }}>
                                                            {row.course_ec ?? "-"}
                                                        </span>
                                                    </td>
                                                ) : (
                                                    <td style={{ padding: "6px 8px" }}>
                                                        <span style={{
                                                            fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "2px 8px",
                                                            background: row.power_authority === "Yes" ? YES_COLOR.light : NO_COLOR.light,
                                                            color: row.power_authority === "Yes" ? YES_COLOR.text : NO_COLOR.text,
                                                        }}>
                                                            {row.power_authority === "Yes" ? "มี" : "ไม่มี"}
                                                        </span>
                                                    </td>
                                                )}
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
                                    background: `linear-gradient(135deg, ${modalColor.from}, ${modalColor.to})`,
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
