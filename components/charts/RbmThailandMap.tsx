"use client";

import React from "react";
import { MapPinned } from "lucide-react";
import { thailandProvinces, type ProvinceShape } from "@/lib/thailand-map";
import { WORK_TYPE_LABEL, type AreaCounts } from "@/lib/workTypes";
import styles from "./RbmThailandMap.module.css";

type MapData = AreaCounts["map"];
type Props = { data: MapData | null; selectedRbm?: string | null; onRbmClick?: (rbm: string) => void };
type Point = { x: number; y: number };

/**
 * The 8 RBMs, coloured by region of Thailand. `card` is where each detail card sits, in map
 * units, inside empty space (sea / neighbouring countries) next to its region.
 */
const RBMS = [
  { key: "R1_BMA-West", short: "R1", region: "กทม. ตะวันตก", color: "#9333ea", card: { x: 296, y: 324, w: 108 } },
  { key: "R2_BMA-East", short: "R2", region: "กทม. ตะวันออก", color: "#db2777", card: { x: 296, y: 388, w: 108 } },
  { key: "R3_UPC-East", short: "R3", region: "ภาคตะวันออก", color: "#0d9488", card: { x: 296, y: 260, w: 108 } },
  { key: "R4_UPC-NOR", short: "R4", region: "ภาคเหนือ", color: "#65a30d", card: { x: 182, y: 2, w: 108 } },
  { key: "R5_UPC-NOE1", short: "R5", region: "อีสานตอนบน", color: "#ca8a04", card: { x: 296, y: 2, w: 108 } },
  { key: "R6_UPC-NOE2", short: "R6", region: "อีสานตอนล่าง", color: "#c2410c", card: { x: 296, y: 196, w: 108 } },
  { key: "R7_UPC-CEW", short: "R7", region: "ภาคกลาง-ตะวันตก", color: "#4f46e5", card: { x: -48, y: 204, w: 124 } },
  { key: "R8_UPC-SOU", short: "R8", region: "ภาคใต้", color: "#0284c7", card: { x: -48, y: 392, w: 124 } },
] as const;
type Rbm = (typeof RBMS)[number];
const RBM_BY_KEY: Record<string, Rbm> = Object.fromEntries(RBMS.map((r) => [r.key, r]));

const VIEWBOX = { x: -50, y: 0, w: 456, h: 464 };
const CARD_H = 60;

/** Bangkok-area provinces are tiny at country scale, so they also get a zoomed inset. */
const METRO = new Set(["กรุงเทพมหานคร", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ"]);
const INSET = { x: 200, y: 300, w: 88, h: 66 };

const fmt = (n: number) => n.toLocaleString("en-US");

function bbox(shapes: ProvinceShape[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes) {
    const nums = s.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    for (let i = 0; i < nums.length; i += 2) {
      x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]);
      y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]);
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const metroShapes = thailandProvinces.filter((p) => METRO.has(p.name));
const metroBox = (() => {
  const b = bbox(metroShapes);
  const pad = 2;
  return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
})();
// Where a metro-map point lands inside the inset (the nested <svg> uses the default "xMidYMid meet").
const insetScale = Math.min(INSET.w / metroBox.w, INSET.h / metroBox.h);
const toInset = (p: Point): Point => ({
  x: INSET.x + (INSET.w - metroBox.w * insetScale) / 2 + (p.x - metroBox.x) * insetScale,
  y: INSET.y + (INSET.h - metroBox.h * insetScale) / 2 + (p.y - metroBox.y) * insetScale,
});

const mean = (shapes: ProvinceShape[]): Point => ({
  x: shapes.reduce((s, p) => s + p.cx, 0) / shapes.length,
  y: shapes.reduce((s, p) => s + p.cy, 0) / shapes.length,
});

/** Closest point on a card's edge to `p`, so leader lines start at the side facing the region. */
const edgePoint = (card: Point & { w: number }, p: Point): Point => ({
  x: Math.min(Math.max(p.x, card.x), card.x + card.w),
  y: Math.min(Math.max(p.y, card.y), card.y + CARD_H),
});

type Tip = { x: number; y: number; name: string };

export default function RbmThailandMap({ data, selectedRbm, onRbmClick }: Props) {
  const [hoverRbm, setHoverRbm] = React.useState<string | null>(null);
  const [tip, setTip] = React.useState<Tip | null>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const uid = React.useId().replace(/:/g, "");

  // Each province is drawn in the RBM that holds most of its technicians; split provinces get stripes.
  const provinceRbms = React.useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const [name, p] of Object.entries(data?.provinces ?? {})) {
      out[name] = Object.entries(p.technicians).sort((a, b) => b[1] - a[1]).map(([rbm]) => rbm);
    }
    return out;
  }, [data]);

  // Anchor of each RBM on the map: its region's centre, or its provinces inside the Bangkok inset.
  const anchors = React.useMemo(() => {
    const out: Record<string, { point: Point; inInset: boolean }> = {};
    for (const r of RBMS) {
      const own = thailandProvinces.filter((p) => provinceRbms[p.name]?.[0] === r.key);
      const outside = own.filter((p) => !METRO.has(p.name));
      if (outside.length) out[r.key] = { point: mean(outside), inInset: false };
      else if (own.length) out[r.key] = { point: toInset(mean(own)), inInset: true };
    }
    return out;
  }, [provinceRbms]);

  const focus = hoverRbm ?? selectedRbm ?? null;
  // SVG ids stay ASCII: split provinces are referenced by index, not by their Thai name.
  const split = Object.entries(provinceRbms).filter(([, rbms]) => rbms.length > 1);
  const splitId = Object.fromEntries(split.map(([name], i) => [name, `${uid}-split-${i}`]));

  const fillFor = (name: string) => {
    const rbms = provinceRbms[name];
    if (!rbms?.length) return "var(--surface-3)";
    return rbms.length > 1 ? `url(#${splitId[name]})` : RBM_BY_KEY[rbms[0]]?.color ?? "var(--text-subtle)";
  };
  const dimmed = (name: string) => !!focus && !(provinceRbms[name] ?? []).includes(focus);

  const showTip = (event: React.MouseEvent, name: string) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (box) setTip({ x: event.clientX - box.left, y: event.clientY - box.top, name });
  };

  const province = (p: ProvinceShape, inset = false) => (
    <path
      key={p.name}
      d={p.d}
      className={`${styles.province} ${dimmed(p.name) ? styles.dim : ""}`}
      fill={fillFor(p.name)}
      strokeWidth={inset ? 0.25 : 0.5}
      onMouseMove={(e) => showTip(e, p.name)}
      onMouseLeave={() => setTip(null)}
      onClick={() => { const rbm = provinceRbms[p.name]?.[0]; if (rbm) onRbmClick?.(rbm); }}
    />
  );

  const tipData = tip ? data?.provinces[tip.name] : undefined;

  return (
    <section className={styles.card} aria-label="จำนวนกองงานช่างแยกตาม RBM">
      <header className={styles.header}>
        <span className={styles.headerIcon}><MapPinned size={16} aria-hidden="true" /></span>
        <div>
          <h3>จำนวนกองงานช่างแยกตาม RBM</h3>
          <p>นับเฉพาะหัวหน้ากองงาน · จังหวัดจากคอลัมน์ province · คลิกการ์ดหรือจังหวัดเพื่อกรอง</p>
        </div>
        <span className={styles.legend} aria-hidden="true">
          <span><i className={styles.keyInstall} />{WORK_TYPE_LABEL.Installation}</span>
          <span><i className={styles.keyRepair} />{WORK_TYPE_LABEL.Repair}</span>
        </span>
      </header>

      <div className={styles.mapBox} ref={boxRef}>
        <svg viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`} className={styles.map} role="img" aria-label="แผนที่ประเทศไทย ระบายสีตาม RBM พร้อมจำนวนกองงานและ Depot">
          <defs>
            <filter id={`${uid}-lift`} x="-10%" y="-10%" width="120%" height="125%">
              <feDropShadow dx="2.5" dy="5" stdDeviation="3.5" floodColor="#0f172a" floodOpacity="0.28" />
            </filter>
            {split.map(([name, rbms]) => (
              <pattern key={name} id={splitId[name]} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="3" height="3" fill={RBM_BY_KEY[rbms[0]]?.color} />
                <rect width="1.3" height="3" fill={RBM_BY_KEY[rbms[1]]?.color} />
              </pattern>
            ))}
          </defs>

          <g filter={`url(#${uid}-lift)`}>{thailandProvinces.map((p) => province(p))}</g>

          {/* Bangkok metro inset */}
          <rect x={metroBox.x} y={metroBox.y} width={metroBox.w} height={metroBox.h} className={styles.metroFrame} />
          <line x1={metroBox.x + metroBox.w} y1={metroBox.y + metroBox.h} x2={INSET.x} y2={INSET.y} className={styles.leader} />
          <rect x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} rx="5" className={styles.insetFrame} />
          <svg x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} viewBox={`${metroBox.x} ${metroBox.y} ${metroBox.w} ${metroBox.h}`}>
            {metroShapes.map((p) => province(p, true))}
          </svg>
          <text x={INSET.x + INSET.w / 2} y={INSET.y + INSET.h + 8} className={styles.insetCaption}>กรุงเทพฯ และปริมณฑล</text>

          {/* Leader lines from each region marker to its card (dashes flow towards the card) */}
          {RBMS.map((r) => {
            const anchor = anchors[r.key];
            if (!anchor) return null;
            const from = edgePoint(r.card, anchor.point);
            const off = focus && focus !== r.key;
            return (
              <g key={r.key} className={off ? styles.dimLabel : undefined} style={{ color: r.color, transition: "opacity 0.15s ease" }}>
                <line x1={anchor.point.x} y1={anchor.point.y} x2={from.x} y2={from.y} className={styles.track} />
                <line x1={anchor.point.x} y1={anchor.point.y} x2={from.x} y2={from.y} className={styles.pointer} />
              </g>
            );
          })}

          {/* Region markers: pulsing dot at each RBM's centre with its R1–R8 tag (R1/R2 inside the Bangkok inset) */}
          {RBMS.map((r, i) => {
            const anchor = anchors[r.key];
            if (!anchor) return null;
            const { x, y } = anchor.point;
            const off = focus && focus !== r.key;
            return (
              <g
                key={r.key}
                className={`${styles.marker} ${off ? styles.dimLabel : ""} ${focus === r.key ? styles.markerFocus : ""}`}
                style={{ color: r.color, "--delay": `${(i % 4) * -0.45}s` } as React.CSSProperties}
                transform={`translate(${x} ${y}) scale(${anchor.inInset ? 0.62 : 1})`}
              >
                <circle r="3" className={styles.pulse} />
                <circle r="3" className={`${styles.pulse} ${styles.pulseLate}`} />
                <circle r="2.6" className={styles.core} />
                <g transform="translate(0 -12)">
                  <rect x="-10.5" y="-6.5" width="21" height="13" rx="6.5" className={styles.tag} />
                  <text className={styles.tagText}>{r.short}</text>
                </g>
              </g>
            );
          })}

          {/* Detail cards */}
          {RBMS.map((r) => {
            const s = data?.rbms[r.key];
            const total = s ? s.installation + s.repair : 0;
            const active = selectedRbm === r.key;
            const off = !!focus && focus !== r.key;
            return (
              <foreignObject key={r.key} x={r.card.x} y={r.card.y} width={r.card.w} height={CARD_H} className={styles.cardSlot}>
                <button
                  type="button"
                  className={`${styles.callout} ${active ? styles.active : ""} ${off ? styles.calloutDim : ""}`}
                  style={{ "--rbm": r.color } as React.CSSProperties}
                  aria-pressed={active}
                  disabled={!s}
                  title={`${r.key} · ${r.region}`}
                  onMouseEnter={() => setHoverRbm(r.key)}
                  onMouseLeave={() => setHoverRbm(null)}
                  onFocus={() => setHoverRbm(r.key)}
                  onBlur={() => setHoverRbm(null)}
                  onClick={() => onRbmClick?.(r.key)}
                >
                  <span className={styles.cHead}>
                    <span className={styles.cSwatch}>{r.short}</span>
                    <b className={styles.cName}>{r.region}</b>
                    <span className={styles.cTotal}>{s ? fmt(total) : "–"}<small>กองงาน</small></span>
                  </span>
                  <span className={styles.cBar} aria-hidden="true">
                    <i style={{ width: `${total ? ((s?.installation ?? 0) / total) * 100 : 0}%` }} />
                  </span>
                  <span className={styles.cStats}>
                    <span><small><i className={styles.keyInstall} />ติดตั้ง</small><b>{s ? fmt(s.installation) : "–"}</b></span>
                    <span><small><i className={styles.keyRepair} />ซ่อม</small><b>{s ? fmt(s.repair) : "–"}</b></span>
                    <span><small>Depot</small><b>{s ? fmt(s.depots) : "–"}</b></span>
                  </span>
                </button>
              </foreignObject>
            );
          })}
        </svg>

        {tip && tipData && (
          <div className={styles.tip} style={{ left: tip.x, top: tip.y }}>
            <strong>{tip.name}</strong>
            <span className={styles.tipRbms}>
              {Object.entries(tipData.technicians).sort((a, b) => b[1] - a[1]).map(([rbm, n]) => (
                <span key={rbm}><i style={{ background: RBM_BY_KEY[rbm]?.color }} />{rbm} · ช่าง {fmt(n)}</span>
              ))}
            </span>
            <span>{WORK_TYPE_LABEL.Installation} {fmt(tipData.installation)} · {WORK_TYPE_LABEL.Repair} {fmt(tipData.repair)} กองงาน</span>
            <span>Depot {fmt(tipData.depots)}</span>
          </div>
        )}
      </div>
    </section>
  );
}
