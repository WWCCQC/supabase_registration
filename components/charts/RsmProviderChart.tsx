"use client";

import React from "react";
import { BarChart3, Building2, UserRound, UsersRound } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import styles from "./RsmProviderChart.module.css";

type Provider = "WW-Provider" | "True Tech" | "เถ้าแก่เทค";
type ChartRow = { RBM: string; "WW-Provider": number; "True Tech": number; "เถ้าแก่เทค": number; total: number };
type Summary = {
  totalRBM: number;
  totalTechnicians: number;
  providers: Record<Provider, number>;
  providerBreakdown?: Array<{ provider: string; count: number; percentage: number }>;
};
const providers: Array<{ name: Provider; color: string }> = [
  { name: "WW-Provider", color: "blue" },
  { name: "True Tech", color: "green" },
  { name: "เถ้าแก่เทค", color: "orange" },
];
const number = (value: number) => value.toLocaleString("en-US");

function ProviderTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = Number(payload[0]?.payload?.total) || 0;
  return (
    <div className={styles.tooltip}>
      <strong>{label}</strong>
      {payload.map((entry: any) => (
        <div className={styles.tooltipRow} key={entry.dataKey}>
          <span><i style={{ background: entry.color }} />{entry.name}</span>
          <b>{number(Number(entry.value) || 0)}</b>
        </div>
      ))}
      <div className={styles.tooltipTotal}><span>รวมทั้งหมด</span><b>{number(total)} คน</b></div>
    </div>
  );
}

export default function RsmProviderChart() {
  const [chartData, setChartData] = React.useState<ChartRow[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchChartData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/chart/rsm-provider", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to fetch provider chart data");
      setChartData(data.chartData || []);
      setSummary(data.summary || null);
    } catch (cause) {
      console.error("Provider Chart fetch error:", cause);
      setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void fetchChartData(); }, [fetchChartData]);

  if (loading) return <div className={styles.status}>กำลังโหลดข้อมูลกราฟ...</div>;
  if (error) return <div className={styles.status} role="alert"><span>{error}</span><button type="button" onClick={() => void fetchChartData()}>ลองใหม่</button></div>;

  const totalTechnicians = summary?.totalTechnicians ?? 0;

  return (
    <section className={styles.chart} aria-label="RBM Provider Distribution">
      <div className={styles.heading}>
        <span className={styles.headingIcon}><Building2 size={27} strokeWidth={2} /></span>
        <h3>RBM Provider Distribution</h3>
      </div>

      <div className={styles.providerSummary} aria-label="สัดส่วนช่างแต่ละประเภท">
        {providers.map(({ name, color }) => {
          const count = summary?.providers?.[name] ?? summary?.providerBreakdown?.find((item) => item.provider === name)?.count ?? 0;
          const percentage = totalTechnicians > 0 ? ((count / totalTechnicians) * 100).toFixed(1) : "0.0";
          return (
            <div className={styles.providerPill + " " + styles[color]} key={name}>
              <span className={styles.providerIcon}><UserRound size={22} strokeWidth={2.2} /></span>
              <span className={styles.providerName}>{name}</span>
              <strong>{number(count)} ({percentage}%)</strong>
            </div>
          );
        })}
      </div>

      <div className={styles.chartScroll}>
        <div className={styles.chartCanvas}>
          <ResponsiveContainer width="100%" height={430}>
            <BarChart data={chartData} margin={{ top: 32, right: 12, left: 0, bottom: 18 }} barSize={58}>
              <defs>
                <linearGradient id="rbmProviderWW" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3999ff" /><stop offset="100%" stopColor="#0752d8" /></linearGradient>
                <linearGradient id="rbmProviderTrue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2ccc80" /><stop offset="100%" stopColor="#088b55" /></linearGradient>
                <linearGradient id="rbmProviderTaoKae" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffd13f" /><stop offset="100%" stopColor="#f39800" /></linearGradient>
              </defs>
              <CartesianGrid stroke="#e5edf7" vertical={false} />
              <XAxis dataKey="RBM" angle={-38} textAnchor="end" height={76} interval={0} tick={{ fontSize: 11, fill: "#1c396b", fontWeight: 600 }} tickLine={false} axisLine={{ stroke: "#aabbd3" }} />
              <YAxis allowDecimals={false} width={12} tick={false} tickLine={false} axisLine={{ stroke: "#aabbd3" }} />
              <Tooltip content={<ProviderTooltip />} cursor={{ fill: "rgba(27,112,233,0.04)" }} />
              <Bar dataKey="WW-Provider" stackId="providers" fill="url(#rbmProviderWW)">
                <LabelList dataKey="WW-Provider" position="center" fill="#fff" fontSize={12} fontWeight={700} formatter={(value: any) => value > 0 ? number(Number(value)) : ""} />
              </Bar>
              <Bar dataKey="True Tech" stackId="providers" fill="url(#rbmProviderTrue)">
                <LabelList dataKey="True Tech" position="center" fill="#fff" fontSize={12} fontWeight={700} formatter={(value: any) => value > 0 ? number(Number(value)) : ""} />
              </Bar>
              <Bar dataKey="เถ้าแก่เทค" stackId="providers" fill="url(#rbmProviderTaoKae)" radius={[7, 7, 0, 0]}>
                <LabelList dataKey="เถ้าแก่เทค" position="center" fill="#71390b" fontSize={10} fontWeight={700} formatter={(value: any) => value > 0 ? number(Number(value)) : ""} />
                <LabelList dataKey="total" position="top" fill="#092152" fontSize={13} fontWeight={700} offset={7} formatter={(value: any) => number(Number(value) || 0)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerPill + " " + styles.footerRBM}><BarChart3 size={22} /><span>RBM ทั้งหมด <strong>{number(summary?.totalRBM ?? 0)} เขต</strong></span></div>
        <div className={styles.footerPill + " " + styles.footerTechnicians}><UsersRound size={22} /><span>ช่างรวม <strong>{number(totalTechnicians)} คน</strong></span></div>
      </div>
    </section>
  );
}
