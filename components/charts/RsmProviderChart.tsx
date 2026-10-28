"use client";

import React from "react";
import NextDynamic from "next/dynamic";
import styles from "./RsmProviderChart.module.css";

// three.js loads in its own chunk, only on the client
const ProviderShare3D = NextDynamic(() => import("./ProviderShare3D"), { ssr: false });

const PROVIDER_COLORS: Record<Provider, string> = {
  "WW-Provider": "#1d63dc",
  "True Tech": "#10b981",
  "เถ้าแก่เทค": "#f59e0b",
};

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
  const [selectedProvider, setSelectedProvider] = React.useState<Provider | null>(null);

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

  const providerStats: Array<{ key: Provider; total: number; pct: string; cardClass: string; dotClass: string }> = [
    { key: "WW-Provider", total: wwTotal, pct: wwOverallPct, cardClass: styles.providerCardBlue, dotClass: styles.dotBlue },
    { key: "True Tech", total: ttTotal, pct: ttOverallPct, cardClass: styles.providerCardGreen, dotClass: styles.dotGreen },
    { key: "เถ้าแก่เทค", total: tkTotal, pct: tkOverallPct, cardClass: styles.providerCardOrange, dotClass: styles.dotOrange },
  ];
  const selectedStat = providerStats.find((p) => p.key === selectedProvider) ?? null;
  const toggleProvider = (key: Provider) => setSelectedProvider((current) => (current === key ? null : key));
  // Clicking a provider re-ranks the zone list by that provider's headcount
  const rankedRows = selectedProvider
    ? [...sortedRows].sort((a, b) => (b[selectedProvider] || 0) - (a[selectedProvider] || 0))
    : sortedRows;
  const dimSeg = (key: Provider) => (selectedProvider && selectedProvider !== key ? styles.segDimmed : "");

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
            <ProviderShare3D
              className={styles.donutCanvas}
              slices={providerStats.map((p) => ({ key: p.key, label: p.key, value: p.total, color: PROVIDER_COLORS[p.key] }))}
              selected={selectedProvider}
              onSelect={(key) => setSelectedProvider(key as Provider | null)}
            />
            <div className={styles.donutCenter}>
              <span className={styles.donutTotalValue}>{number(selectedStat ? selectedStat.total : totalTechnicians)}</span>
              <span className={styles.donutTotalLabel}>
                {selectedStat ? `${selectedStat.key} • ${selectedStat.pct}%` : "ช่างทั้งหมด (คน)"}
              </span>
            </div>
          </div>

          {/* 3 Provider Cards */}
          <div className={styles.providerCardsStack} aria-label="สัดส่วนช่างแต่ละประเภท">
            {providerStats.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={selectedProvider === p.key}
                onClick={() => toggleProvider(p.key)}
                className={`${styles.providerBentoCard} ${p.cardClass} ${
                  selectedProvider && selectedProvider !== p.key ? styles.providerCardDimmed : ""
                } ${selectedProvider === p.key ? styles.providerCardActive : ""}`}
              >
                <div className={styles.providerCardLeft}>
                  <div className={styles.providerCardTitleRow}>
                    <span className={`${styles.providerDot} ${p.dotClass}`} />
                    <span>{p.key}</span>
                  </div>
                </div>
                <div className={styles.providerCardRight}>
                  <div className={styles.providerCardCount}>{number(p.total)} คน</div>
                  <div className={styles.providerCardPct}>{p.pct}%</div>
                </div>
              </button>
            ))}
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
              <h4 className={styles.panelTitle}>
                2. Ranked Horizontal Progress
                {selectedProvider && <span className={styles.rankedBy}> • เรียงตาม {selectedProvider}</span>}
              </h4>
            </div>
          </div>

          <div className={styles.matrixList}>
            {rankedRows.map((row, index) => {
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
                            className={`${styles.segWW} ${dimSeg("WW-Provider")}`}
                            style={{ width: `${wwSegPct}%` }}
                            title={`WW-Provider: ${number(ww)} คน (${wwExactPct}%)`}
                          >
                            {number(ww)}
                          </div>
                        )}
                        {tt > 0 && (
                          <div
                            className={`${styles.segTT} ${dimSeg("True Tech")}`}
                            style={{ width: `${ttSegPct}%` }}
                            title={`True Tech: ${number(tt)} คน (${ttExactPct}%)`}
                          >
                            {number(tt)}
                          </div>
                        )}
                        {tk > 0 && (
                          <div
                            className={`${styles.segTK} ${dimSeg("เถ้าแก่เทค")}`}
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
