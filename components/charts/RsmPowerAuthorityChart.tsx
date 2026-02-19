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
} from "recharts";

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
                <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: YES_COLOR.light, border: `1.5px solid ${YES_COLOR.solid}`,
                    borderRadius: 30, padding: "5px 14px 5px 8px", boxShadow: `0 2px 8px ${YES_COLOR.solid}30`
                }}>
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
                <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: NO_COLOR.light, border: `1.5px solid ${NO_COLOR.solid}`,
                    borderRadius: 30, padding: "5px 14px 5px 8px", boxShadow: `0 2px 8px ${NO_COLOR.solid}30`
                }}>
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

                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                        label={{
                            value: "จำนวนช่าง (คน)", angle: -90, position: "insideLeft",
                            offset: 10, style: { fontSize: 10, fill: "#94a3b8" }
                        }} />

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
                                if (!value || value === 0 || height < 28) return null;
                                const e = chartData[index];
                                const tot = (e.Yes || 0) + (e.No || 0);
                                const pct = tot > 0 ? ((value / tot) * 100).toFixed(1) : "0.0";
                                const cx = x + width / 2;
                                const cy = y + height / 2;
                                return (
                                    <text textAnchor="middle" fill="white" fontWeight="bold">
                                        <tspan x={cx} dy={cy - 5} fontSize="8">{value.toLocaleString()}</tspan>
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
                                if (!value || value === 0 || height < 28) return null;
                                const e = chartData[index];
                                const tot = (e.Yes || 0) + (e.No || 0);
                                const pct = tot > 0 ? ((value / tot) * 100).toFixed(1) : "0.0";
                                const cx = x + width / 2;
                                const cy = y + height / 2;
                                return (
                                    <text textAnchor="middle" fill="white" fontWeight="bold">
                                        <tspan x={cx} dy={cy - 5} fontSize="8">{value.toLocaleString()}</tspan>
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
        </div>
    );
}
