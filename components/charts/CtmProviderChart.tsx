"use client";

import React from "react";
import { BarChart3, Building2, UserRound, UsersRound } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import shared from "./RsmProviderChart.module.css";
import styles from "./CtmProviderChart.module.css";

type Provider = "WW-Provider" | "True Tech" | "เถ้าแก่เทค";
type ChartRow = { CBM: string; total: number } & Partial<Record<Provider, number>>;
type Summary = { totalCBMs: number; totalTechnicians: number; providerBreakdown: Array<{ provider: string; count: number }> };
type Props = { selectedCtm?: string | null; onCtmClick?: (CBM: string | null) => void };

const providers: Array<{ name: Provider; color: string }> = [
  { name: "WW-Provider", color: "blue" },
  { name: "True Tech", color: "green" },
  { name: "เถ้าแก่เทค", color: "orange" },
];
const ITEMS_PER_PAGE = 15;
const number = (value: number) => value.toLocaleString("en-US");
const shortLabel = (value: string) => value.length > 20 ? `${value.slice(0, 19)}…` : value;

function ProviderTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = Number(payload[0]?.payload?.total) || 0;
  return (
    <div className={shared.tooltip}>
      <strong>{label}</strong>
      {payload.map((entry: any) => (
        <div className={shared.tooltipRow} key={entry.dataKey}>
          <span><i style={{ background: entry.color }} />{entry.name}</span>
          <b>{number(Number(entry.value) || 0)}</b>
        </div>
      ))}
      <div className={shared.tooltipTotal}><span>รวมทั้งหมด</span><b>{number(total)} คน</b></div>
    </div>
  );
}

export default function CtmProviderChart({ selectedCtm, onCtmClick }: Props) {
  const [chartData, setChartData] = React.useState<ChartRow[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [startIndex, setStartIndex] = React.useState(0);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/chart/ctm-provider", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to fetch CBM chart data");
      setChartData(data.chartData || []);
      setSummary(data.summary || null);
    } catch (cause) {
      console.error("CBM Provider Chart fetch error:", cause);
      setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) return <div className={shared.status}>กำลังโหลดข้อมูลกราฟ...</div>;
  if (error) return <div className={shared.status} role="alert"><span>{error}</span><button type="button" onClick={() => void fetchData()}>ลองใหม่</button></div>;

  const maxStartIndex = Math.max(0, chartData.length - ITEMS_PER_PAGE);
  const visibleStart = Math.min(startIndex, maxStartIndex);
  const displayedData = chartData.slice(visibleStart, visibleStart + ITEMS_PER_PAGE);
  const currentPage = Math.floor(visibleStart / ITEMS_PER_PAGE) + 1;
  const totalPages = Math.ceil(chartData.length / ITEMS_PER_PAGE);
  const totalTechnicians = summary?.totalTechnicians ?? 0;

  return (
    <section className={shared.chart} aria-label="CBM Provider Distribution">
      <div className={shared.heading}>
        <span className={shared.headingIcon}><Building2 size={27} strokeWidth={2} /></span>
        <h3>CBM Provider Distribution</h3>
      </div>

      <div className={shared.providerSummary} aria-label="สัดส่วนช่างแต่ละประเภท">
        {providers.map(({ name, color }) => {
          const count = summary?.providerBreakdown?.find((item) => item.provider === name)?.count ?? 0;
          const percentage = totalTechnicians > 0 ? ((count / totalTechnicians) * 100).toFixed(1) : "0.0";
          return (
            <div className={shared.providerPill + " " + shared[color]} key={name}>
              <span className={shared.providerIcon}><UserRound size={22} strokeWidth={2.2} /></span>
              <span className={shared.providerName}>{name}</span>
              <strong>{number(count)} ({percentage}%)</strong>
            </div>
          );
        })}
      </div>

      {maxStartIndex > 0 && (
        <div className={styles.pagination}>
          <div className={styles.pageLabel}>แสดง CBM <strong>{visibleStart + 1}–{Math.min(visibleStart + ITEMS_PER_PAGE, chartData.length)}</strong> จาก {chartData.length} เขต <span>(หน้า {currentPage}/{totalPages})</span></div>
          <div className={styles.rangeRow}>
            <span>เริ่มต้น</span>
            <input type="range" min={0} max={maxStartIndex} step={1} value={visibleStart} aria-label="เลื่อนช่วง CBM ที่แสดง" onChange={(event) => setStartIndex(Number(event.target.value))} />
            <span>สิ้นสุด</span>
          </div>
        </div>
      )}

      {selectedCtm && (
        <div className={styles.selection}>
          <span>กำลังกรอง CBM: <strong>{selectedCtm}</strong></span>
          <button type="button" onClick={() => onCtmClick?.(null)}>ยกเลิก</button>
        </div>
      )}

      {chartData.length > 0 ? (
        <div className={shared.chartScroll}>
          <div className={styles.chartCanvas}>
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={displayedData} margin={{ top: 32, right: 16, left: 0, bottom: 18 }} barSize={58} onClick={(data: any) => {
                const clickedCtm = data?.activePayload?.[0]?.payload?.CBM;
                if (clickedCtm) onCtmClick?.(selectedCtm === clickedCtm ? null : clickedCtm);
              }} style={{ cursor: onCtmClick ? "pointer" : "default" }}>
                <defs>
                  <linearGradient id="cbmProviderWW" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3999ff" /><stop offset="100%" stopColor="#0752d8" /></linearGradient>
                  <linearGradient id="cbmProviderTrue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2ccc80" /><stop offset="100%" stopColor="#088b55" /></linearGradient>
                  <linearGradient id="cbmProviderTaoKae" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffd13f" /><stop offset="100%" stopColor="#f39800" /></linearGradient>
                </defs>
                <CartesianGrid stroke="#e5edf7" vertical={false} />
                <XAxis dataKey="CBM" angle={-38} textAnchor="end" height={105} interval={0} tickFormatter={shortLabel} tick={{ fontSize: 11, fill: "#1c396b", fontWeight: 600 }} tickLine={false} axisLine={{ stroke: "#aabbd3" }} />
                <YAxis allowDecimals={false} width={12} tick={false} tickLine={false} axisLine={{ stroke: "#aabbd3" }} />
                <Tooltip content={<ProviderTooltip />} cursor={{ fill: "rgba(27,112,233,0.04)" }} />
                <Bar dataKey="WW-Provider" stackId="providers" fill="url(#cbmProviderWW)">
                  {displayedData.map((row) => <Cell key={row.CBM} opacity={selectedCtm && selectedCtm !== row.CBM ? 0.35 : 1} />)}
                  <LabelList dataKey="WW-Provider" position="center" fill="#fff" fontSize={12} fontWeight={700} formatter={(value: any) => Number(value) > 0 ? number(Number(value)) : ""} />
                </Bar>
                <Bar dataKey="True Tech" stackId="providers" fill="url(#cbmProviderTrue)">
                  {displayedData.map((row) => <Cell key={row.CBM} opacity={selectedCtm && selectedCtm !== row.CBM ? 0.35 : 1} />)}
                  <LabelList dataKey="True Tech" position="center" fill="#fff" fontSize={12} fontWeight={700} formatter={(value: any) => Number(value) > 0 ? number(Number(value)) : ""} />
                </Bar>
                <Bar dataKey="เถ้าแก่เทค" stackId="providers" fill="url(#cbmProviderTaoKae)" radius={[7, 7, 0, 0]}>
                  {displayedData.map((row) => <Cell key={row.CBM} opacity={selectedCtm && selectedCtm !== row.CBM ? 0.35 : 1} />)}
                  <LabelList dataKey="เถ้าแก่เทค" position="center" fill="#71390b" fontSize={10} fontWeight={700} formatter={(value: any) => Number(value) > 0 ? number(Number(value)) : ""} />
                  <LabelList dataKey="total" position="top" fill="#092152" fontSize={13} fontWeight={700} offset={7} formatter={(value: any) => number(Number(value) || 0)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : <div className={shared.status}>ไม่มีข้อมูล CBM</div>}

      <div className={shared.footer}>
        <div className={shared.footerPill + " " + shared.footerRBM}><BarChart3 size={22} /><span>CBM ทั้งหมด <strong>{number(summary?.totalCBMs ?? chartData.length)} เขต</strong></span></div>
        <div className={shared.footerPill + " " + shared.footerTechnicians}><UsersRound size={22} /><span>ช่างรวม <strong>{number(totalTechnicians)} คน</strong></span></div>
      </div>
    </section>
  );
}
