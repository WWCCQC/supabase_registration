"use client";

import React from "react";
import { AlertTriangle, Building2, Info, MapPin, Sparkles, UsersRound, Wrench } from "lucide-react";
import { buildAreaSummary, type Insight, type InsightGroup } from "@/lib/areaInsights";
import { WORK_TYPE_LABEL, type AreaCounts } from "@/lib/workTypes";
import styles from "./SummaryInsight.module.css";

type Props = { data: AreaCounts | null; scope?: string | null };

const GROUPS: Record<InsightGroup, { label: string; Icon: typeof UsersRound }> = {
  people: { label: "คนและกองงาน", Icon: UsersRound },
  workType: { label: "ประเภทงาน", Icon: Wrench },
  provider: { label: "Provider", Icon: Building2 },
  area: { label: "พื้นที่", Icon: MapPin },
};
const fmt = (n: number) => n.toLocaleString("en-US");

function Line({ insight }: { insight: Insight }) {
  const { label, Icon } = GROUPS[insight.group];
  return (
    <li className={`${styles.item} ${insight.level === "warn" ? styles.warn : styles.info}`}>
      <span className={styles.level} aria-label={insight.level === "warn" ? "ควรติดตาม" : "ข้อมูล"}>
        {insight.level === "warn" ? <AlertTriangle size={13} aria-hidden="true" /> : <Info size={13} aria-hidden="true" />}
      </span>
      <span className={styles.text}>
        {insight.parts.map((part, i) => (typeof part === "string" ? <React.Fragment key={i}>{part}</React.Fragment> : <strong key={i}>{part.strong}</strong>))}
        {insight.list && (
          <span className={styles.groups}>
            {insight.list.map((g) => (
              <span key={g.label} className={styles.groupRow}>
                <span className={styles.groupLabel}>{g.label}<small>{g.items.length}</small></span>
                <span className={styles.chips}>{g.items.map((item) => <span key={item} className={styles.chip}>{item}</span>)}</span>
              </span>
            ))}
          </span>
        )}
      </span>
      <span className={styles.tag} title={label}><Icon size={11} aria-hidden="true" />{label}</span>
    </li>
  );
}

/** Executive summary of people, work types and areas, built from the same (filtered) area counts as the map and tables. */
export default function SummaryInsight({ data, scope }: Props) {
  const summary = React.useMemo(() => (data ? buildAreaSummary(data) : null), [data]);

  return (
    <section className={styles.card} aria-label="Summary insight">
      <header className={styles.header}>
        <span className={styles.headerIcon}><Sparkles size={15} aria-hidden="true" /></span>
        <h3>Summary insight</h3>
        <span className={styles.scope}>{scope ? `เฉพาะ ${scope}` : "ทุกพื้นที่"}</span>
      </header>

      {!summary ? (
        <div className={styles.loading}>
          {[0, 1, 2].map((i) => <span key={i} className="skeleton-light" style={{ height: 14 }} />)}
        </div>
      ) : summary.technicians === 0 ? (
        <p className={styles.empty}>ไม่มีข้อมูลช่างตามตัวกรองนี้</p>
      ) : (
        <>
          <div className={styles.headline}>
            <span><b>{fmt(summary.technicians)}</b> คน</span>
            <span><b>{fmt(summary.workgroups)}</b> กองงาน</span>
            <span>{WORK_TYPE_LABEL.Installation} <b>{Math.round(summary.installPct)}%</b> / {WORK_TYPE_LABEL.Repair} <b>{Math.round(summary.repairPct)}%</b></span>
            {summary.topProvider && <span>{summary.topProvider.name} <b>{Math.round(summary.topProvider.pct)}%</b></span>}
          </div>

          <ul className={styles.list}>
            {summary.insights.map((insight) => <Line key={insight.id} insight={insight} />)}
          </ul>
        </>
      )}
    </section>
  );
}
