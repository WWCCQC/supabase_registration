import { AREA_PROVIDERS, WORK_TYPES, WORK_TYPE_LABEL, type AreaCounts, type AreaPivot, type WorkType } from "@/lib/workTypes";

/** Thresholds for when an insight becomes a warning. */
export const INSIGHT_THRESHOLDS = {
  /** technicians per workgroup below this = too many one-person workgroups */
  minTechPerWorkgroup: 1.5,
  /** an RBM whose repair share differs from the overall share by this many points stands out */
  repairShareGapPts: 10,
  /** a provider doing this share of one work type or more is a specialist */
  specialistPct: 80,
} as const;

export type InsightLevel = "warn" | "info";
export type InsightGroup = "people" | "workType" | "provider";
/** Text pieces; `{ strong }` parts are emphasised (numbers, names). */
export type InsightPart = string | { strong: string };
export type Insight = { id: string; group: InsightGroup; level: InsightLevel; parts: InsightPart[] };

export type AreaSummary = {
  technicians: number;
  workgroups: number;
  rbmCount: number;
  installPct: number;
  repairPct: number;
  topProvider: { name: string; pct: number } | null;
  insights: Insight[];
};

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const p0 = (n: number) => `${Math.round(n)}%`;
const short = (rbm: string) => rbm.split("_")[0];
const b = (strong: string) => ({ strong });

const cell = (pivot: AreaPivot, rbm: string, provider: string, workType: string) => pivot[rbm]?.[`${provider}_${workType}`] || 0;
const sumWhere = (pivot: AreaPivot, keep: (rbm: string, provider: string, workType: WorkType) => boolean) => {
  let total = 0;
  for (const rbm of Object.keys(pivot)) for (const p of AREA_PROVIDERS) for (const w of WORK_TYPES) if (keep(rbm, p, w)) total += cell(pivot, rbm, p, w);
  return total;
};
const extremes = <T,>(rows: T[], value: (row: T) => number) => {
  const sorted = [...rows].sort((a, c) => value(a) - value(c));
  return { low: sorted[0], high: sorted[sorted.length - 1] };
};

/**
 * Turns the area counts (already scoped by the page filters) into headline numbers and ranked,
 * human-readable insights about people, work types and areas. Warnings come first.
 */
export function buildAreaSummary(counts: AreaCounts): AreaSummary {
  const { technicians: T, workgroups: W } = counts;
  const t = (rbm?: string, provider?: string, workType?: WorkType) =>
    sumWhere(T, (r, p, w) => (!rbm || r === rbm) && (!provider || p === provider) && (!workType || w === workType));
  const g = (rbm?: string, provider?: string, workType?: WorkType) =>
    sumWhere(W, (r, p, w) => (!rbm || r === rbm) && (!provider || p === provider) && (!workType || w === workType));

  const rbms = Object.keys(T).filter((r) => t(r) > 0).sort();
  const totalTech = t();
  const totalWg = g();
  const insights: Insight[] = [];
  const add = (i: Insight) => insights.push(i);

  const providerTotals = AREA_PROVIDERS.map((name) => ({ name, n: t(undefined, name) })).sort((a, c) => c.n - a.n);
  const top = providerTotals[0];

  if (totalTech > 0) {
    // ---- A. People and workgroup structure ----
    const perRbm = rbms.map((rbm) => ({ rbm, tech: t(rbm), wg: g(rbm), ratio: g(rbm) ? t(rbm) / g(rbm) : 0 })).filter((r) => r.wg > 0);

    // A1 technicians per workgroup
    if (perRbm.length > 1) {
      const { low, high } = extremes(perRbm, (r) => r.ratio);
      const below = perRbm.filter((r) => r.ratio < INSIGHT_THRESHOLDS.minTechPerWorkgroup);
      add({
        id: "A1", group: "people", level: below.length ? "warn" : "info",
        parts: [b(short(low.rbm)), " มีช่างเฉลี่ย ", b(low.ratio.toFixed(2)), " คน/กองงาน ต่ำสุด",
          below.length ? ` (ต่ำกว่าเกณฑ์ ${INSIGHT_THRESHOLDS.minTechPerWorkgroup} → กองงานคนเดียวเยอะ)` : "",
          " · สูงสุด ", b(short(high.rbm)), " ", b(high.ratio.toFixed(2))],
      });
    } else if (perRbm.length === 1) {
      const r = perRbm[0];
      add({ id: "A1", group: "people", level: r.ratio < INSIGHT_THRESHOLDS.minTechPerWorkgroup ? "warn" : "info",
        parts: [b(short(r.rbm)), " มีช่างเฉลี่ย ", b(r.ratio.toFixed(2)), " คน/กองงาน",
          r.ratio < INSIGHT_THRESHOLDS.minTechPerWorkgroup ? ` (ต่ำกว่าเกณฑ์ ${INSIGHT_THRESHOLDS.minTechPerWorkgroup} → กองงานคนเดียวเยอะ)` : ""] });
    }

    // A2 workgroups per depot
    const depotLoad = rbms.map((rbm) => ({ rbm, load: (counts.map.rbms[rbm]?.depots ?? 0) > 0 ? g(rbm) / counts.map.rbms[rbm].depots : 0 })).filter((r) => r.load > 0);
    if (depotLoad.length > 1) {
      const { low, high } = extremes(depotLoad, (r) => r.load);
      add({ id: "A2", group: "people", level: "info",
        parts: ["ภาระต่อ Depot: ", b(short(high.rbm)), " แน่นสุด ", b(high.load.toFixed(1)), " กองงาน/Depot · ", b(short(low.rbm)), " เบาสุด ", b(low.load.toFixed(1))] });
    }

    // A4 largest / smallest area
    if (perRbm.length > 1) {
      const { low, high } = extremes(perRbm, (r) => r.wg);
      add({ id: "A4", group: "people", level: "info",
        parts: ["พื้นที่ใหญ่สุด ", b(short(high.rbm)), " ", b(fmt(high.wg)), " กองงาน (", b(p0(pct(high.wg, totalWg))), ") · เล็กสุด ", b(short(low.rbm)), " ", b(fmt(low.wg))] });
    }

    // ---- B. Work types ----
    const wgRepair = g(undefined, undefined, "Repair");

    // B2 areas whose repair share stands out
    if (rbms.length > 1 && totalWg > 0) {
      const overall = pct(wgRepair, totalWg);
      const outliers = rbms
        .map((rbm) => ({ rbm, share: pct(g(rbm, undefined, "Repair"), g(rbm)) }))
        .filter((r) => g(r.rbm) > 0 && Math.abs(r.share - overall) >= INSIGHT_THRESHOLDS.repairShareGapPts)
        .sort((a, c) => Math.abs(c.share - overall) - Math.abs(a.share - overall));
      if (outliers.length) {
        const parts: InsightPart[] = [`กองงาน${WORK_TYPE_LABEL.Repair} เฉลี่ย `, b(p0(overall)), " · ต่างจากค่าเฉลี่ยมาก: "];
        outliers.slice(0, 3).forEach((o, i) => parts.push(i ? ", " : "", b(`${short(o.rbm)} ${p0(o.share)}`)));
        add({ id: "B2", group: "workType", level: "warn", parts });
      }
    }

    // ---- C. Provider dependency ----
    // C2 specialists
    for (const { name, n } of providerTotals) {
      if (n < 20) continue;
      for (const w of WORK_TYPES) {
        const share = pct(t(undefined, name, w), n);
        if (share >= INSIGHT_THRESHOLDS.specialistPct && share < 100) {
          add({ id: `C2-${name}`, group: "provider", level: "info",
            parts: [b(name), " เกือบทั้งหมดเป็นช่าง", WORK_TYPE_LABEL[w], " (", b(p0(share)), ")"] });
        }
      }
    }

    // C3 areas where one work type has a single provider
    if (rbms.length > 1) {
      for (const w of WORK_TYPES) {
        const single = rbms
          .map((rbm) => ({ rbm, providers: AREA_PROVIDERS.filter((p) => cell(T, rbm, p, w) > 0) }))
          .filter((r) => r.providers.length === 1);
        if (!single.length) continue;
        const byProvider = new Map<string, string[]>();
        for (const r of single) byProvider.set(r.providers[0], [...(byProvider.get(r.providers[0]) ?? []), short(r.rbm)]);
        for (const [provider, list] of byProvider) {
          add({ id: `C3-${w}-${provider}`, group: "provider", level: "info",
            parts: [WORK_TYPE_LABEL[w], "ใน ", b(list.join(", ")), " มีแค่ ", b(provider), " เจ้าเดียว"] });
        }
      }
    }
  }

  const rank = { warn: 0, info: 1 } as const;
  insights.sort((a, c) => rank[a.level] - rank[c.level]);

  return {
    technicians: totalTech,
    workgroups: totalWg,
    rbmCount: rbms.length,
    installPct: pct(t(undefined, undefined, "Installation"), totalTech),
    repairPct: pct(t(undefined, undefined, "Repair"), totalTech),
    topProvider: top && top.n > 0 ? { name: top.name, pct: pct(top.n, totalTech) } : null,
    insights,
  };
}
