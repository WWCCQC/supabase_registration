"use client";

import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Building2, UsersRound } from "lucide-react";
import shared from "./RsmProviderChart.module.css";
import styles from "./CtmProviderChart.module.css";

type Provider = "WW-Provider" | "True Tech" | "เถ้าแก่เทค";
type Row = { CBM: string; total: number } & Partial<Record<Provider, number>>;
type Summary = { totalCBMs: number; totalTechnicians: number; providerBreakdown: Array<{ provider: string; count: number }> };
type Props = { selectedCtm?: string | null; onCtmClick?: (CBM: string | null) => void };
type SortKey = "CBM" | Provider | "total";

const providers: Array<{ name: Provider; color: "blue" | "green" | "orange"; short: string }> = [
  { name: "WW-Provider", color: "blue", short: "WW" },
  { name: "True Tech", color: "green", short: "TT" },
  { name: "เถ้าแก่เทค", color: "orange", short: "TK" },
];
const number = (value: number) => value.toLocaleString("en-US");
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export default function CtmProviderChart({ selectedCtm, onCtmClick }: Props) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "total", dir: "desc" });

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/chart/ctm-provider", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to fetch CBM chart data");
      setRows(data.chartData || []);
      setSummary(data.summary || null);
    } catch (cause) {
      console.error("CBM Provider Chart fetch error:", cause);
      setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void fetchData(); }, [fetchData]);

  const sortedRows = React.useMemo(() => {
    const { key, dir } = sort;
    const sign = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const diff = key === "CBM" ? a.CBM.localeCompare(b.CBM, "th") : (Number(a[key]) || 0) - (Number(b[key]) || 0);
      return diff !== 0 ? sign * diff : b.total - a.total;
    });
  }, [rows, sort]);

  const columnTotals = React.useMemo(() => {
    const totals = { total: 0 } as Record<Provider | "total", number>;
    for (const { name } of providers) totals[name] = 0;
    for (const row of rows) {
      for (const { name } of providers) totals[name] += Number(row[name]) || 0;
      totals.total += row.total;
    }
    return totals;
  }, [rows]);

  if (loading) return <div className={shared.status}>กำลังโหลดข้อมูล CBM...</div>;
  if (error) return <div className={shared.status} role="alert"><span>{error}</span><button type="button" onClick={() => void fetchData()}>ลองใหม่</button></div>;

  const totalTechnicians = summary?.totalTechnicians ?? 0;
  const toggleSort = (key: SortKey) =>
    setSort((current) => current.key === key
      ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
      : { key, dir: key === "CBM" ? "asc" : "desc" });
  const selectRow = (cbm: string) => onCtmClick?.(selectedCtm === cbm ? null : cbm);

  // Plain render helper (not a component) so the header buttons keep focus across re-sorts.
  const sortHeader = (sortKey: SortKey, children: React.ReactNode, className?: string) => {
    const active = sort.key === sortKey;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th key={sortKey} scope="col" className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" className={styles.sortButton} onClick={() => toggleSort(sortKey)}>
          {children}
          <Icon size={13} aria-hidden="true" className={active ? styles.sortIconActive : styles.sortIcon} />
        </button>
      </th>
    );
  };

  return (
    <section className={shared.chart} aria-label="CBM Provider Distribution">
      <div className={shared.heading}>
        <span className={shared.headingIcon}><Building2 size={27} strokeWidth={2} /></span>
        <h3>CBM Provider Distribution</h3>
      </div>

      {selectedCtm && (
        <div className={styles.selection}>
          <span>กำลังกรอง CBM: <strong>{selectedCtm}</strong></span>
          <button type="button" onClick={() => onCtmClick?.(null)}>ยกเลิก</button>
        </div>
      )}

      {rows.length > 0 ? (
        <>
          <p className={styles.hint}>คลิกแถวเพื่อกรองข้อมูลช่างตาม CBM · คลิกหัวคอลัมน์เพื่อเรียงลำดับ</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.rank}>#</th>
                  {sortHeader("CBM", "CBM", styles.nameCol)}
                  {providers.map(({ name, color }) => sortHeader(
                    name,
                    <><i className={`${styles.dot} ${styles[color]}`} aria-hidden="true" />{name}</>,
                    styles.num,
                  ))}
                  {sortHeader("total", "รวม", styles.num)}
                  <th scope="col" className={styles.mixCol}>สัดส่วน Provider</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, index) => {
                  const selected = selectedCtm === row.CBM;
                  const dimmed = !!selectedCtm && !selected;
                  return (
                    <tr
                      key={row.CBM}
                      className={`${styles.row} ${selected ? styles.selected : ""} ${dimmed ? styles.dimmed : ""}`}
                      onClick={() => selectRow(row.CBM)}
                    >
                      <td className={styles.rank}>{index + 1}</td>
                      <th scope="row" className={styles.nameCol}>
                        <button type="button" className={styles.rowButton} aria-pressed={selected} onClick={(event) => { event.stopPropagation(); selectRow(row.CBM); }}>
                          {/* Names are joined with "_"; allow line breaks there so long names wrap instead of widening the table. */}
                          {row.CBM.split("_").map((part, i) => <React.Fragment key={i}>{i > 0 && <>_<wbr /></>}{part}</React.Fragment>)}
                        </button>
                      </th>
                      {providers.map(({ name }) => {
                        const value = Number(row[name]) || 0;
                        return (
                          <td key={name} className={styles.num}>
                            {value > 0 ? (
                              <>
                                {number(value)}
                                <span className={styles.share}>{pct(value, row.total).toFixed(0)}%</span>
                              </>
                            ) : <span className={styles.zero}>–</span>}
                          </td>
                        );
                      })}
                      <td className={`${styles.num} ${styles.total}`}>{number(row.total)}</td>
                      <td className={styles.mixCol}>
                        <div
                          className={styles.mixBar}
                          role="img"
                          aria-label={providers.map(({ name }) => `${name} ${pct(Number(row[name]) || 0, row.total).toFixed(1)}%`).join(", ")}
                        >
                          {providers.map(({ name, color }) => {
                            const share = pct(Number(row[name]) || 0, row.total);
                            return share > 0 ? <span key={name} className={styles[color]} style={{ width: `${share}%` }} /> : null;
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className={styles.rank} />
                  <th scope="row" className={styles.nameCol}>รวมทั้งหมด</th>
                  {providers.map(({ name }) => (
                    <td key={name} className={styles.num}>
                      {number(columnTotals[name])}
                      <span className={styles.share}>{pct(columnTotals[name], columnTotals.total).toFixed(1)}%</span>
                    </td>
                  ))}
                  <td className={`${styles.num} ${styles.total}`}>{number(columnTotals.total)}</td>
                  <td className={styles.mixCol} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : <div className={shared.status}>ไม่มีข้อมูล CBM</div>}

      <div className={shared.footer}>
        <div className={shared.footerPill + " " + shared.footerRBM}><BarChart3 size={22} /><span>CBM ทั้งหมด <strong>{number(summary?.totalCBMs ?? rows.length)} เขต</strong></span></div>
        <div className={shared.footerPill + " " + shared.footerTechnicians}><UsersRound size={22} /><span>ช่างรวม <strong>{number(totalTechnicians)} คน</strong></span></div>
      </div>
    </section>
  );
}
