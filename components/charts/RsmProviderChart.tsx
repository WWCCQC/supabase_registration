"use client";

import React from "react";
import styles from "./RsmProviderChart.module.css";

type Provider = "WW-Provider" | "True Tech" | "เถ้าแก่เทค";
type ChartRow = {
  RBM: string;
  "WW-Provider": number;
  "True Tech": number;
  "เถ้าแก่เทค": number;
  total: number;
};
type Summary = {
  totalRBM: number;
  totalTechnicians: number;
  providers: Record<Provider, number>;
  providerBreakdown?: Array<{ provider: string; count: number; percentage: number }>;
};

const number = (value: number) => value.toLocaleString("en-US");

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

  React.useEffect(() => {
    void fetchChartData();
  }, [fetchChartData]);

  if (loading) return <div className={styles.status}>กำลังโหลดข้อมูลกราฟ...</div>;
  if (error) {
    return (
      <div className={styles.status} role="alert">
        <span>{error}</span>
        <button type="button" onClick={() => void fetchChartData()}>
          ลองใหม่
        </button>
      </div>
    );
  }

  const sortedRows = [...chartData].sort((a, b) => (b.total || 0) - (a.total || 0));
  const totalRBM = summary?.totalRBM || sortedRows.length;

  const wwTotal =
    summary?.providers?.["WW-Provider"] ??
    summary?.providerBreakdown?.find((item) => item.provider === "WW-Provider")?.count ??
    sortedRows.reduce((acc, r) => acc + (r["WW-Provider"] || 0), 0);
  const ttTotal =
    summary?.providers?.["True Tech"] ??
    summary?.providerBreakdown?.find((item) => item.provider === "True Tech")?.count ??
    sortedRows.reduce((acc, r) => acc + (r["True Tech"] || 0), 0);
  const tkTotal =
    summary?.providers?.["เถ้าแก่เทค"] ??
    summary?.providerBreakdown?.find((item) => item.provider === "เถ้าแก่เทค")?.count ??
    sortedRows.reduce((acc, r) => acc + (r["เถ้าแก่เทค"] || 0), 0);

  const totalTechnicians = summary?.totalTechnicians || wwTotal + ttTotal + tkTotal;
  const maxRowTotal = Math.max(...sortedRows.map((r) => r.total || 0), 1);

  const wwOverallPct = totalTechnicians > 0 ? ((wwTotal / totalTechnicians) * 100).toFixed(1) : "0.0";
  const ttOverallPct = totalTechnicians > 0 ? ((ttTotal / totalTechnicians) * 100).toFixed(1) : "0.0";
  const tkOverallPct = totalTechnicians > 0 ? ((tkTotal / totalTechnicians) * 100).toFixed(1) : "0.0";

  // Dynamic insights across zones
  const wwZoneShares = sortedRows
    .filter((r) => r.total > 0)
    .map((r) => Math.round(((r["WW-Provider"] || 0) / r.total) * 100));
  const minWWShare = wwZoneShares.length > 0 ? Math.min(...wwZoneShares) : 0;
  const maxWWShare = wwZoneShares.length > 0 ? Math.max(...wwZoneShares) : 0;

  const bmaRows = sortedRows.filter((r) => r.RBM.toUpperCase().includes("BMA"));
  const upcRows = sortedRows.filter((r) => !r.RBM.toUpperCase().includes("BMA"));

  const bmaTotal = bmaRows.reduce((acc, r) => acc + (r.total || 0), 0);
  const upcTotal = upcRows.reduce((acc, r) => acc + (r.total || 0), 0);
  const bmaPct = totalTechnicians > 0 ? ((bmaTotal / totalTechnicians) * 100).toFixed(1) : "0.0";
  const upcPct = totalTechnicians > 0 ? ((upcTotal / totalTechnicians) * 100).toFixed(1) : "0.0";

  const bmaTrueTech = bmaRows.reduce((acc, r) => acc + (r["True Tech"] || 0), 0);

  // Format เถ้าแก่เทค zone breakdown subtitle (e.g., "เฉพาะ BMA-East (8) & West (2)")
  const tkActiveRows = sortedRows.filter((r) => (r["เถ้าแก่เทค"] || 0) > 0);
  const tkSubtitle =
    tkActiveRows.length > 0
      ? "เฉพาะ " +
        tkActiveRows
          .map((r, idx) => {
            const clean = r.RBM.replace(/^R\d+_/i, "");
            const shortName = idx > 0 ? clean.replace(/^BMA-/i, "") : clean;
            return `${shortName} (${number(r["เถ้าแก่เทค"])})`;
          })
          .join(" & ")
      : "ไม่มีกำลังพลในสังกัดนี้";

  // Donut Ring geometry (r = 66, circumference = 414.69)
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  // Visual arc shares matching the executive donut ring style
  const wwRatio = totalTechnicians > 0 ? wwTotal / totalTechnicians : 0;
  const ttRatio = totalTechnicians > 0 ? ttTotal / totalTechnicians : 0;
  const tkVisualRatio = tkTotal > 0 ? Math.max(tkTotal / totalTechnicians, 0.032) : 0;

  // Leave a subtle modern top-right track gap like the reference design while keeping accurate proportions
  const activeTrackShare = 0.84;
  const wwArc = wwRatio * activeTrackShare * circumference;
  const ttArc = ttRatio * activeTrackShare * circumference;
  const tkArc = tkVisualRatio * circumference;

  // Position segments so Green + Orange cap finish right at 12 o'clock (top)
  // In SVG rotated -90deg, offset 0 is 12 o'clock.
  // We place Blue starting from ~1:50 clockwise, followed by Green up to 12:00, and Orange cap at 12:00.
  const startGapRatio = 1 - activeTrackShare;
  const wwOffset = -startGapRatio * circumference;
  const ttOffset = -(startGapRatio * circumference + wwArc);

  return (
    <section className={styles.bentoShell} aria-label="RBM Provider Distribution">
      {/* Header */}
      <header className={styles.bentoHeader}>
        <div className={styles.bentoHeaderLeft}>
          <div className={styles.rbmLogoBadge} aria-hidden="true">
            RBM
          </div>
          <div className={styles.bentoTitleGroup}>
            <div className={styles.bentoTitleRow}>
              <h3 className={styles.bentoTitle}>RBM Provider Distribution</h3>
            </div>
          </div>
        </div>
      </header>

      {/* Bento 2-Column Split Panel */}
      <div className={styles.bentoGrid}>
        {/* Left Card: 1. Overall Share + Donut + 3 Provider Cards + Key Insight */}
        <div className={styles.bentoCard}>
          <div className={styles.panelHeader}>
            <div>
              <h4 className={styles.panelTitle}>1. Overall Share</h4>
            </div>
          </div>

          {/* Donut Ring */}
          <div className={styles.donutWrapper}>
            <svg className={styles.donutSvg} viewBox="0 0 176 176" role="img" aria-label="กราฟวงแหวนสัดส่วนช่างแยกตามสังกัด">
              {/* Background Track */}
              <circle
                cx="88"
                cy="88"
                r={radius}
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="20"
              />
              {/* WW-Provider Segment (Blue) */}
              {wwTotal > 0 && (
                <circle
                  cx="88"
                  cy="88"
                  r={radius}
                  fill="none"
                  stroke="#1d63dc"
                  strokeWidth="20"
                  strokeDasharray={`${wwArc} ${circumference}`}
                  strokeDashoffset={wwOffset}
                  strokeLinecap="round"
                />
              )}
              {/* True Tech Segment (Green) */}
              {ttTotal > 0 && (
                <circle
                  cx="88"
                  cy="88"
                  r={radius}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="20"
                  strokeDasharray={`${ttArc} ${circumference}`}
                  strokeDashoffset={ttOffset}
                  strokeLinecap="round"
                />
              )}
              {/* เถ้าแก่เทค Segment (Orange Cap at 12 o'clock) */}
              {tkTotal > 0 && (
                <circle
                  cx="88"
                  cy="88"
                  r={radius}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="20"
                  strokeDasharray={`${tkArc} ${circumference}`}
                  strokeDashoffset={0}
                  strokeLinecap="round"
                />
              )}
            </svg>
            <div className={styles.donutCenter}>
              <span className={styles.donutTotalValue}>{number(totalTechnicians)}</span>
              <span className={styles.donutTotalLabel}>ช่างทั้งหมด (คน)</span>
            </div>
          </div>

          {/* 3 Provider Cards */}
          <div className={styles.providerCardsStack} aria-label="สัดส่วนช่างแต่ละประเภท">
            {/* WW-Provider */}
            <div className={`${styles.providerBentoCard} ${styles.providerCardBlue}`}>
              <div className={styles.providerCardLeft}>
                <div className={styles.providerCardTitleRow}>
                  <span className={`${styles.providerDot} ${styles.dotBlue}`} />
                  <span>WW-Provider</span>
                </div>
              </div>
              <div className={styles.providerCardRight}>
                <div className={styles.providerCardCount}>{number(wwTotal)} คน</div>
                <div className={styles.providerCardPct}>{wwOverallPct}%</div>
              </div>
            </div>

            {/* True Tech */}
            <div className={`${styles.providerBentoCard} ${styles.providerCardGreen}`}>
              <div className={styles.providerCardLeft}>
                <div className={styles.providerCardTitleRow}>
                  <span className={`${styles.providerDot} ${styles.dotGreen}`} />
                  <span>True Tech</span>
                </div>
              </div>
              <div className={styles.providerCardRight}>
                <div className={styles.providerCardCount}>{number(ttTotal)} คน</div>
                <div className={styles.providerCardPct}>{ttOverallPct}%</div>
              </div>
            </div>

            {/* เถ้าแก่เทค */}
            <div className={`${styles.providerBentoCard} ${styles.providerCardOrange}`}>
              <div className={styles.providerCardLeft}>
                <div className={styles.providerCardTitleRow}>
                  <span className={`${styles.providerDot} ${styles.dotOrange}`} />
                  <span>เถ้าแก่เทค</span>
                </div>
              </div>
              <div className={styles.providerCardRight}>
                <div className={styles.providerCardCount}>{number(tkTotal)} คน</div>
                <div className={styles.providerCardPct}>{tkOverallPct}%</div>
              </div>
            </div>
          </div>

          {/* Key Insight Footer Box */}
          <div className={styles.insightBox}>
            <div className={styles.insightHeader}>★ KEY INSIGHT: BMA vs UPC</div>
            <div className={styles.insightRow}>
              <span>เขตปริมณฑล/กทม. ({bmaRows.length} เขต BMA):</span>
              <span className={styles.insightValueWhite}>
                {number(bmaTotal)} คน ({bmaPct}%)
              </span>
            </div>
            <div className={styles.insightRow}>
              <span>เขตต่างจังหวัด ({upcRows.length} เขต UPC):</span>
              <span className={styles.insightValueGreen}>
                {number(upcTotal)} คน ({upcPct}%)
              </span>
            </div>
          </div>
        </div>

        {/* Right Card: 2. Ranked Horizontal Progress */}
        <div className={styles.bentoCard}>
          <div className={styles.panelHeader}>
            <div>
              <h4 className={styles.panelTitle}>2. Ranked Horizontal Progress</h4>
            </div>
          </div>

          <div className={styles.matrixList}>
            {sortedRows.map((row, index) => {
              const rank = index + 1;
              const isBMA = row.RBM.toUpperCase().includes("BMA");
              const isTopRank = rank <= 2 || isBMA;

              const ww = row["WW-Provider"] || 0;
              const tt = row["True Tech"] || 0;
              const tk = row["เถ้าแก่เทค"] || 0;
              const rowTotal = row.total || ww + tt + tk || 1;

              const wwRoundPct = Math.round((ww / rowTotal) * 100);
              const ttRoundPct = Math.round((tt / rowTotal) * 100);

              const wwExactPct = ((ww / rowTotal) * 100).toFixed(1);
              const ttExactPct = ((tt / rowTotal) * 100).toFixed(1);
              const tkExactPct = ((tk / rowTotal) * 100).toFixed(1);

              const totalBarWidthPct = Math.max((rowTotal / maxRowTotal) * 100, 12);
              const shareOfAllPct =
                totalTechnicians > 0 ? ((rowTotal / totalTechnicians) * 100).toFixed(1) : "0.0";

              // Segment widths inside the proportional bar
              const tkVisualSharePct = tk > 0 ? Math.max((tk / rowTotal) * 100, 4.2) : 0;
              const remainingSharePct = 100 - tkVisualSharePct;
              const nonTkTotal = ww + tt || 1;
              const wwSegPct = (ww / nonTkTotal) * remainingSharePct;
              const ttSegPct = (tt / nonTkTotal) * remainingSharePct;

              return (
                <div
                  key={row.RBM}
                  className={`${styles.matrixRow} ${isTopRank ? styles.matrixRowTop : ""}`}
                >
                  {/* Left: Rank + RBM Name + Zone Pill + Quick % */}
                  <div className={styles.matrixLeft}>
                    <span
                      className={`${styles.rankBadge} ${
                        isTopRank ? styles.rankBadgeTop : styles.rankBadgeDefault
                      }`}
                    >
                      #{rank}
                    </span>
                    <div className={styles.rbmInfo}>
                      <div className={styles.rbmNameRow}>
                        <span className={styles.rbmName}>{row.RBM}</span>
                        <span
                          className={`${styles.zoneBadge} ${
                            isBMA ? styles.zoneBMA : styles.zoneUPC
                          }`}
                        >
                          {isBMA ? "BMA" : "UPC"}
                        </span>
                      </div>
                      <div className={styles.rbmQuickShare}>
                        WW {wwRoundPct}% • True Tech {ttRoundPct}%
                      </div>
                    </div>
                  </div>

                  {/* Middle: 3D Segmented Progress Pill + Micro Data Pills */}
                  <div className={styles.matrixMiddle}>
                    <div className={styles.progressTrack}>
                      <div
                        className={styles.progressFillGroup}
                        style={{ width: `${totalBarWidthPct}%` }}
                      >
                        {ww > 0 && (
                          <div
                            className={styles.segWW}
                            style={{ width: `${wwSegPct}%` }}
                            title={`WW-Provider: ${number(ww)} คน (${wwExactPct}%)`}
                          >
                            {number(ww)}
                          </div>
                        )}
                        {tt > 0 && (
                          <div
                            className={styles.segTT}
                            style={{ width: `${ttSegPct}%` }}
                            title={`True Tech: ${number(tt)} คน (${ttExactPct}%)`}
                          >
                            {number(tt)}
                          </div>
                        )}
                        {tk > 0 && (
                          <div
                            className={styles.segTK}
                            style={{ width: `${tkVisualSharePct}%` }}
                            title={`เถ้าแก่เทค: ${number(tk)} คน (${tkExactPct}%)`}
                          />
                        )}
                      </div>
                    </div>

                    <div className={styles.microPillsRow}>
                      <span className={styles.microItemWW}>
                        WW: {number(ww)} ({wwExactPct}%)
                      </span>
                      <span className={styles.microItemTT}>
                        TT: {number(tt)} ({ttExactPct}%)
                      </span>
                      {tk > 0 ? (
                        <span className={styles.microItemTKActive}>
                          TK: {number(tk)} ({tkExactPct}%)
                        </span>
                      ) : (
                        <span className={styles.microItemTKZero}>TK: 0</span>
                      )}
                    </div>
                  </div>

                  {/* Right: Total Box */}
                  <div className={styles.matrixRight}>
                    <div className={styles.matrixTotalNumber}>{number(row.total)}</div>
                    <div className={styles.matrixTotalShare}>{shareOfAllPct}% ของทั้งหมด</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
