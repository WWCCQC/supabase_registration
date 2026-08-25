"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
import * as XLSX from "xlsx";

/**
 * เกจครึ่งวงกลม 3 มิติ + ตารางรายพื้นที่ (RBM) + modal รายชื่อช่าง
 * ใช้ร่วมกันระหว่าง Power Authority / Course G / Course EC
 * โดยส่ง label, โทนสี และปลายทาง API เข้ามาทาง props
 */

// ── โทนสีของแต่ละสถานะ (ผ่าน / ไม่ผ่าน) ───────────────────────────
export type Tone = {
  arc: string; // สีอาร์กบนเกจ
  tileTop: string; // พื้นการ์ดย่อย (บน)
  tileBottom: string; // พื้นการ์ดย่อย (ล่าง)
  tileBorder: string;
  glowRgb: string; // "22,163,74" — ใช้กับเงา
  numFrom: string; // ไล่เฉดตัวเลขบนการ์ด
  numTo: string;
  labelText: string;
  chipLight: string; // พื้นชิปตัวเลขในตาราง / modal
  chipText: string;
  barFrom: string; // แท่ง % ในตาราง (ใช้เฉพาะโทน "ผ่าน")
  barMid: string;
  barTo: string;
  barInnerRgb: string;
  barText: string;
  modalFrom: string;
  modalTo: string;
  modalSolid: string;
};

/** โทนเขียว — ผ่าน/มีบัตร (Power Authority) */
export const GREEN_TONE: Tone = {
  arc: "#16a34a",
  tileTop: "#f0fdf4",
  tileBottom: "#dcfce7",
  tileBorder: "#bbf7d0",
  glowRgb: "22,163,74",
  numFrom: "#22c55e",
  numTo: "#15803d",
  labelText: "#166534",
  chipLight: "#dcfce7",
  chipText: "#166534",
  barFrom: "#4ade80",
  barMid: "#16a34a",
  barTo: "#12813c",
  barInnerRgb: "6,78,36",
  barText: "#15803d",
  modalFrom: "#4ade80",
  modalTo: "#15803d",
  modalSolid: "#16a34a",
};

/** โทนแดง — ไม่ผ่าน/ไม่มีบัตร */
export const RED_TONE: Tone = {
  arc: "#ef4444",
  tileTop: "#fef2f2",
  tileBottom: "#fee2e2",
  tileBorder: "#fecaca",
  glowRgb: "220,38,38",
  numFrom: "#f87171",
  numTo: "#b91c1c",
  labelText: "#991b1b",
  chipLight: "#fee2e2",
  chipText: "#991b1b",
  barFrom: "#fca5a5",
  barMid: "#ef4444",
  barTo: "#b91c1c",
  barInnerRgb: "76,5,5",
  barText: "#b91c1c",
  modalFrom: "#f87171",
  modalTo: "#b91c1c",
  modalSolid: "#ef4444",
};

/** โทนเขียวมิ้นต์ — ผ่านอบรม (Course G / EC) ให้เข้าชุดกับสีในกราฟด้านล่าง */
export const TEAL_TONE: Tone = {
  arc: "#0d9488",
  tileTop: "#f0fdfa",
  tileBottom: "#ccfbf1",
  tileBorder: "#99f6e4",
  glowRgb: "13,148,136",
  numFrom: "#2dd4bf",
  numTo: "#0f766e",
  labelText: "#115e59",
  chipLight: "#ccfbf1",
  chipText: "#0f766e",
  barFrom: "#5eead4",
  barMid: "#14b8a6",
  barTo: "#0d9488",
  barInnerRgb: "4,71,66",
  barText: "#0f766e",
  modalFrom: "#5eead4",
  modalTo: "#0f766e",
  modalSolid: "#14b8a6",
};

/** โทนเหลืองอำพัน — ผ่านอบรม (Course EC) ให้เข้าชุดกับสีในกราฟด้านล่าง */
export const AMBER_TONE: Tone = {
  arc: "#f59e0b",
  tileTop: "#fffbeb",
  tileBottom: "#fef3c7",
  tileBorder: "#fde68a",
  glowRgb: "217,119,6",
  numFrom: "#fbbf24",
  numTo: "#b45309",
  labelText: "#92400e",
  chipLight: "#fef3c7",
  chipText: "#92400e",
  barFrom: "#fcd34d",
  barMid: "#f59e0b",
  barTo: "#b45309",
  barInnerRgb: "69,39,3",
  barText: "#b45309",
  modalFrom: "#fcd34d",
  modalTo: "#b45309",
  modalSolid: "#f59e0b",
};

export type StatusRow = { rbm: string; pass: number; fail: number };

export type StatusGaugeSectionProps = {
  rows: StatusRow[];
  totalPass?: number;
  totalFail?: number;
  loading?: boolean;

  title: string;
  titleIcon: string;
  titleIconBg: string;
  titleIconShadow: string;
  tableTitle: string;
  tableIcon: string;
  tableIconBg: string;
  tableIconShadow: string;

  labels: {
    passTile: string;
    failTile: string;
    colPass: string;
    colFail: string;
    colPct: string;
    passHint: string;
    failHint: string;
    modalPass: string;
    modalFail: string;
  };

  tone: { pass: Tone; fail: Tone };

  detail: {
    url: (rbm: string | null, status: "pass" | "fail") => string;
    valueKey: string;
    valueHeader: string;
    isPass: (value: any) => boolean;
    passText: string;
    failText: string;
    filePrefix: string;
  };
};

// ── Color helpers (สำหรับไล่เฉดให้ดูมีมิติ) ────────────────────────
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** amt > 0 = สว่างขึ้น (mix ขาว), amt < 0 = เข้มขึ้น (mix ดำ) */
function shade(hex: string, amt: number, alpha = 1) {
  const { r, g, b } = hexToRgb(hex);
  const target = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const mix = (c: number) => Math.round((target - c) * p + c);
  return `rgba(${mix(r)}, ${mix(g)}, ${mix(b)}, ${alpha})`;
}

// ── Motion helpers ────────────────────────────────────────────────
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);

/** เริ่มทำงานเมื่อ element เลื่อนเข้ามาในจอ (ทำครั้งเดียว) */
function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/** ตัวเลขวิ่งขึ้นจาก 0 → target */
function useCountUp(
  target: number,
  active: boolean,
  duration = 1500,
  delay = 0
) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = now();
    const step = () => {
      const p = Math.max(0, Math.min(1, (now() - start - delay) / duration));
      setValue(target * easeOutCubic(p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration, delay]);

  return value;
}

// ── Gauge Canvas (semicircle 3D) ───────────────────────────────────
function GaugeCanvas({
  pass,
  fail,
  total,
  animate,
  passColor,
  failColor,
}: {
  pass: number;
  fail: number;
  total: number;
  animate: boolean;
  passColor: string;
  failColor: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 300;
    const H = 190;

    // HiDPI — ให้คมบนจอ Retina
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const cx = W / 2;
    const cy = H - 34; // pivot bottom-center
    const outerR = 100;
    const innerR = 62;
    const trackR = (outerR + innerR) / 2;
    const arcWidth = outerR - innerR;
    const DEPTH = 9; // ความหนาของ "ขอบ 3 มิติ"

    const TRACK = "#e2e8f0";
    const targetPassFraction = total > 0 ? pass / total : 0;

    // วาดวงแหวนแบบยกนูน: ชั้นล่างเป็นเงา แล้วค่อยวาดหน้าบนทับ
    const strokeArc = (
      from: number,
      to: number,
      style: string | CanvasGradient,
      yOffset = 0,
      width = arcWidth,
      radius = trackR
    ) => {
      ctx.beginPath();
      ctx.arc(cx, cy + yOffset, radius, from, to, false);
      ctx.strokeStyle = style as string;
      ctx.lineWidth = width;
      ctx.lineCap = "butt";
      ctx.stroke();
    };

    const faceGradient = (base: string) => {
      const g = ctx.createLinearGradient(
        cx - outerR,
        cy - outerR,
        cx + outerR,
        cy
      );
      g.addColorStop(0, shade(base, 0.34));
      g.addColorStop(0.45, shade(base, 0.08));
      g.addColorStop(1, shade(base, -0.16));
      return g;
    };

    const drawExtruded = (
      from: number,
      to: number,
      base: string,
      deep: number
    ) => {
      if (to - from <= 0.0001) return;
      // ชั้นความหนา (ไล่จากล่างสุดขึ้นมา)
      for (let i = deep; i >= 1; i--) {
        const t = i / deep;
        strokeArc(from, to, shade(base, -0.28 - 0.22 * t), i);
      }
      // หน้าบน
      strokeArc(from, to, faceGradient(base), 0);
    };

    /**
     * needleFraction = ตำแหน่งเข็ม (0..1) — สีผ่านจะไล่ตามเข็มขึ้นไป
     * redProgress    = สัดส่วนการเติมสีไม่ผ่านจากจุดเข็มไปทางขวา (0..1)
     */
    const draw = (needleFraction: number, redProgress: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // 0. เงาใต้เกจ (ground shadow) ให้ลอยเหนือพื้น
      ctx.save();
      const groundGrad = ctx.createRadialGradient(
        cx,
        cy + DEPTH + 6,
        4,
        cx,
        cy + DEPTH + 6,
        outerR + 14
      );
      groundGrad.addColorStop(0, "rgba(15,23,42,0.20)");
      groundGrad.addColorStop(1, "rgba(15,23,42,0)");
      ctx.fillStyle = groundGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy + DEPTH + 8, outerR + 10, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const boundary = Math.PI + targetPassFraction * Math.PI; // จุดรอยต่อ ผ่าน/ไม่ผ่าน
      const greenEnd = Math.min(Math.PI + needleFraction * Math.PI, boundary);
      const redEnd = boundary + redProgress * (2 * Math.PI - boundary);
      const failFraction = total > 0 ? fail / total : 0;

      // 1. Track (เทา) — ยกนูน
      drawExtruded(Math.PI, 2 * Math.PI, TRACK, DEPTH);

      if (total > 0) {
        // 2. สีผ่าน — ไล่ขึ้นตามเข็มไมล์
        if (greenEnd > Math.PI)
          drawExtruded(Math.PI, greenEnd, passColor, DEPTH);
        // 3. สีไม่ผ่าน — เติมต่อจากจุดที่เข็มหยุด
        if (failFraction > 0 && redProgress > 0)
          drawExtruded(boundary, redEnd, failColor, DEPTH);
      }

      // 4. ขอบไฮไลต์ (bevel) — ขอบนอกสว่าง / ขอบในเข้ม
      strokeArc(
        Math.PI,
        2 * Math.PI,
        "rgba(255,255,255,0.55)",
        0,
        2,
        outerR - 1
      );
      strokeArc(Math.PI, 2 * Math.PI, "rgba(15,23,42,0.14)", 0, 2, innerR + 1);

      // 5. Gloss — แสงสะท้อนโค้งด้านบน
      ctx.save();
      const gloss = ctx.createLinearGradient(cx, cy - outerR, cx, cy - innerR);
      gloss.addColorStop(0, "rgba(255,255,255,0.42)");
      gloss.addColorStop(1, "rgba(255,255,255,0)");
      strokeArc(
        Math.PI + 0.06,
        2 * Math.PI - 0.06,
        gloss,
        -1,
        arcWidth * 0.45,
        trackR + arcWidth * 0.26
      );
      ctx.restore();

      // 6. Tick marks + labels
      const ticks = [
        { angle: Math.PI, label: "0%" },
        { angle: Math.PI + 0.25 * Math.PI, label: "25%" },
        { angle: Math.PI + 0.5 * Math.PI, label: "50%" },
        { angle: Math.PI + 0.75 * Math.PI, label: "75%" },
        { angle: 2 * Math.PI, label: "100%" },
      ];
      ticks.forEach(({ angle, label }) => {
        const tx1 = cx + Math.cos(angle) * (outerR + 5);
        const ty1 = cy + Math.sin(angle) * (outerR + 5);
        const tx2 = cx + Math.cos(angle) * (outerR - 1);
        const ty2 = cy + Math.sin(angle) * (outerR - 1);
        ctx.beginPath();
        ctx.moveTo(tx1, ty1);
        ctx.lineTo(tx2, ty2);
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.stroke();

        const lx = cx + Math.cos(angle) * (outerR + 16);
        const ly = cy + Math.sin(angle) * (outerR + 16);
        ctx.font = "600 10px Inter, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, lx, ly);
      });

      // 7. Needle — เข็มทรงเรียว มีเงาตกกระทบ
      const needleAngle = Math.PI + needleFraction * Math.PI;
      const needleLen = trackR + 10;
      const tipX = cx + Math.cos(needleAngle) * needleLen;
      const tipY = cy + Math.sin(needleAngle) * needleLen;
      const perp = needleAngle + Math.PI / 2;
      const baseW = 5.5;

      ctx.save();
      ctx.shadowColor = "rgba(15,23,42,0.35)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(cx + Math.cos(perp) * baseW, cy + Math.sin(perp) * baseW);
      ctx.lineTo(cx - Math.cos(perp) * baseW, cy - Math.sin(perp) * baseW);
      ctx.closePath();
      const needleGrad = ctx.createLinearGradient(cx, cy - needleLen, cx, cy);
      needleGrad.addColorStop(0, "#475569");
      needleGrad.addColorStop(0.5, "#1e293b");
      needleGrad.addColorStop(1, "#0f172a");
      ctx.fillStyle = needleGrad;
      ctx.fill();
      ctx.restore();

      // 8. Hub — ทรงกลมโลหะ
      ctx.save();
      ctx.shadowColor = "rgba(15,23,42,0.4)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      const hubGrad = ctx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, 10);
      hubGrad.addColorStop(0, "#94a3b8");
      hubGrad.addColorStop(0.45, "#334155");
      hubGrad.addColorStop(1, "#0f172a");
      ctx.fillStyle = hubGrad;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
      const capGrad = ctx.createRadialGradient(
        cx - 1,
        cy - 1.5,
        0.5,
        cx,
        cy,
        3.6
      );
      capGrad.addColorStop(0, "#ffffff");
      capGrad.addColorStop(1, "#e2e8f0");
      ctx.fillStyle = capGrad;
      ctx.fill();
    };

    // ยังไม่เลื่อนมาถึง → ตั้งเข็มไว้ที่ 0% รอ
    if (!animate) {
      draw(0, 0);
      return;
    }

    // ลดการเคลื่อนไหวตามการตั้งค่าระบบ → แสดงผลสุดท้ายทันที
    if (prefersReducedMotion()) {
      draw(targetPassFraction, 1);
      return;
    }

    // Animation 2 จังหวะ:
    //  1) เข็มไมล์กวาดจาก 0% → จุดรอยต่อ (สีผ่านไล่ตามเข็ม) พร้อมสะบัดนิดๆ ตอนหยุด
    //  2) สีไม่ผ่านเติมต่อจากจุดที่เข็มหยุดไปจนสุดขวา
    let raf = 0;
    const NEEDLE_DUR = 1500;
    const RED_DELAY = 950;
    const RED_DUR = 850;
    const start = now();

    const tick = () => {
      const elapsed = now() - start;

      const np = Math.min(1, elapsed / NEEDLE_DUR);
      // ease-out + การสะบัดแบบหน่วง (damped) ให้เหมือนเข็มไมล์จริง
      const wobble =
        np >= 1 ? 0 : 0.02 * Math.sin(np * Math.PI * 3) * Math.pow(1 - np, 2);
      const needleFraction = Math.max(
        0,
        Math.min(1, targetPassFraction * easeOutCubic(np) + wobble)
      );

      const rp = Math.max(0, Math.min(1, (elapsed - RED_DELAY) / RED_DUR));

      draw(needleFraction, easeOutCubic(rp));

      if (np < 1 || rp < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [pass, fail, total, animate, passColor, failColor]);

  return (
    <canvas ref={canvasRef} style={{ display: "block", margin: "0 auto" }} />
  );
}

type DetailStatus = "pass" | "fail";
type DetailTarget = { rbm: string | null; status: DetailStatus };

const BASE_HEADERS = [
  "HRBM",
  "RBM",
  "CBM",
  "provider",
  "depot_code",
  "depot_name",
  "tech_id",
  "full_name",
];
const BASE_HEADER_LABELS = [
  "#",
  "HRBM",
  "RBM",
  "CBM",
  "Provider",
  "Depot Code",
  "Depot Name",
  "Tech ID",
  "Full Name",
];

/** ตัวเลขที่คลิกได้ในคอลัมน์ ผ่าน / ไม่ผ่าน */
function CountLink({
  value,
  tone,
  hint,
  strong,
  onClick,
}: {
  value: number;
  tone: Tone;
  hint: string;
  strong?: boolean;
  onClick: () => void;
}) {
  // ไม่มีข้อมูลให้เปิดดู → แสดงเป็นตัวเลขธรรมดา
  if (!value) {
    return (
      <span
        style={{
          fontWeight: strong ? 800 : 600,
          color: "#94a3b8",
          padding: "3px 9px",
        }}
      >
        0
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={`คลิกเพื่อดูรายชื่อช่าง${hint}`}
      style={{
        appearance: "none",
        font: "inherit",
        fontWeight: strong ? 800 : 700,
        color: tone.chipText,
        background: `linear-gradient(180deg, #ffffff 0%, ${tone.chipLight} 100%)`,
        border: `1px solid ${tone.chipLight}`,
        borderRadius: 8,
        padding: "3px 9px",
        cursor: "pointer",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.9) inset, 0 1px 2px rgba(15,23,42,0.10)",
        transition: "transform 0.12s ease, box-shadow 0.12s ease",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = `0 1px 0 rgba(255,255,255,0.9) inset, 0 4px 10px -3px ${tone.modalSolid}80`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow =
          "0 1px 0 rgba(255,255,255,0.9) inset, 0 1px 2px rgba(15,23,42,0.10)";
      }}
    >
      {value.toLocaleString()}
    </button>
  );
}

// ── Shared 3D card style ──────────────────────────────────────────
const card3D: React.CSSProperties = {
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  borderRadius: 16,
  padding: "24px 20px",
  border: "1px solid rgba(226,232,240,0.9)",
  boxShadow:
    "0 1px 0 rgba(255,255,255,0.9) inset, 0 1px 2px rgba(15,23,42,0.06), 0 8px 20px -6px rgba(15,23,42,0.14), 0 18px 40px -18px rgba(15,23,42,0.20)",
};

// ── Main Component ────────────────────────────────────────────────
export default function StatusGaugeSection({
  rows,
  totalPass: totalPassProp,
  totalFail: totalFailProp,
  loading,
  title,
  titleIcon,
  titleIconBg,
  titleIconShadow,
  tableTitle,
  tableIcon,
  tableIconBg,
  tableIconShadow,
  labels,
  tone,
  detail: detailCfg,
}: StatusGaugeSectionProps) {
  const totalPass =
    totalPassProp ?? rows.reduce((s, d) => s + (d.pass || 0), 0);
  const totalFail =
    totalFailProp ?? rows.reduce((s, d) => s + (d.fail || 0), 0);
  const grandTotal = totalPass + totalFail;
  const passPercent =
    grandTotal > 0 ? ((totalPass / grandTotal) * 100).toFixed(1) : "0.0";
  const failPercent =
    grandTotal > 0 ? ((totalFail / grandTotal) * 100).toFixed(1) : "0.0";

  // Sort by RBM number
  const sortedData = [...rows].sort((a, b) => {
    const numA = parseInt(a.rbm.match(/^R(\d+)/i)?.[1] ?? "0", 10);
    const numB = parseInt(b.rbm.match(/^R(\d+)/i)?.[1] ?? "0", 10);
    return numA - numB;
  });

  // เริ่มอนิเมชันเมื่อเลื่อนมาถึงกราฟ
  const { ref: sectionRef, inView } = useInView<HTMLDivElement>(0.3);
  const play = inView && !loading;

  // ตัวเลขวิ่งบนการ์ด (จังหวะเดียวกับเข็มไมล์)
  const passCount = useCountUp(parseFloat(passPercent), play, 1500);
  const failCount = useCountUp(parseFloat(failPercent), play, 850, 950);

  // ── Detail modal (คลิกตัวเลขในคอลัมน์ ผ่าน / ไม่ผ่าน) ────────────
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [detailRows, setDetailRows] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailSearch, setDetailSearch] = useState("");

  const closeDetail = useCallback(() => {
    setDetail(null);
    setDetailRows([]);
    setDetailError(null);
    setDetailSearch("");
  }, []);

  const openDetail = useCallback(
    async (rbm: string | null, status: DetailStatus) => {
      setDetail({ rbm, status });
      setDetailRows([]);
      setDetailError(null);
      setDetailSearch("");
      setDetailLoading(true);
      try {
        const res = await fetch(detailCfg.url(rbm, status), {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to fetch data");
        const json = await res.json();
        setDetailRows(json.rows ?? []);
      } catch (e: any) {
        setDetailError(e?.message ?? "เกิดข้อผิดพลาด");
      } finally {
        setDetailLoading(false);
      }
    },
    [detailCfg]
  );

  // ปิดด้วยปุ่ม Esc
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, closeDetail]);

  const filteredDetailRows = detailSearch
    ? detailRows.filter((r) => {
        const q = detailSearch.toLowerCase();
        return Object.values(r).some((v) =>
          String(v).toLowerCase().includes(q)
        );
      })
    : detailRows;

  const detailTone = detail?.status === "fail" ? tone.fail : tone.pass;
  const detailLabel =
    detail?.status === "fail" ? labels.modalFail : labels.modalPass;
  const detailScope = detail?.rbm ?? "ทุกพื้นที่";

  const headerLabels = [...BASE_HEADER_LABELS, detailCfg.valueHeader];

  const handleDownloadExcel = useCallback(() => {
    if (!filteredDetailRows.length || !detail) return;
    const headers = [...BASE_HEADERS, detailCfg.valueKey];
    const wsData = [
      headers,
      ...filteredDetailRows.map((r) => headers.map((h) => r[h] ?? "-")),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length, 14) }));
    const wb = XLSX.utils.book_new();
    const sheetName = `${detail.rbm ?? "ALL"}_${detail.status}`
      .replace(/[^a-zA-Z0-9ก-๙_ -]/g, "")
      .trim()
      .slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName || "detail");
    const scope = (detail.rbm ?? "all").replace(/[^a-zA-Z0-9ก-๙_-]/g, "_");
    XLSX.writeFile(
      wb,
      `${detailCfg.filePrefix}_${scope}_${detail.status}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
  }, [filteredDetailRows, detail, detailCfg]);

  return (
    <div
      ref={sectionRef}
      style={{
        display: "flex",
        gap: 20,
        alignItems: "stretch",
        marginTop: 20,
      }}
    >
      {/* ── LEFT: Gauge Chart Card ── */}
      <div
        style={{
          ...card3D,
          flex: "0 0 340px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Header */}
        <div style={{ width: "100%", marginBottom: 12 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "#1f2937",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 15,
                width: 28,
                height: 28,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 9,
                background: titleIconBg,
                boxShadow: titleIconShadow,
              }}
            >
              {titleIcon}
            </span>
            {title}
          </h3>
        </div>

        {loading ? (
          <div
            style={{
              height: 190,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9ca3af",
              fontSize: 14,
            }}
          >
            กำลังโหลด...
          </div>
        ) : (
          <>
            {/* Gauge canvas */}
            <GaugeCanvas
              pass={totalPass}
              fail={totalFail}
              total={grandTotal}
              animate={play}
              passColor={tone.pass.arc}
              failColor={tone.fail.arc}
            />

            {/* Center value display — การ์ดย่อยแบบยกนูน */}
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                justifyContent: "center",
                gap: 10,
                marginTop: 2,
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {/* ผ่าน */}
              <div
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "10px 8px",
                  borderRadius: 14,
                  background: `linear-gradient(180deg, ${tone.pass.tileTop} 0%, ${tone.pass.tileBottom} 100%)`,
                  border: `1px solid ${tone.pass.tileBorder}`,
                  boxShadow: `0 1px 0 rgba(255,255,255,0.95) inset, 0 -2px 0 rgba(${tone.pass.glowRgb},0.16) inset, 0 6px 14px -6px rgba(${tone.pass.glowRgb},0.45)`,
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    lineHeight: 1,
                    background: `linear-gradient(180deg, ${tone.pass.numFrom} 0%, ${tone.pass.numTo} 100%)`,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    textShadow: "0 1px 0 rgba(255,255,255,0.6)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {passCount.toFixed(1)}%
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: tone.pass.labelText,
                    marginTop: 5,
                    whiteSpace: "nowrap",
                  }}
                >
                  {labels.passTile}
                </div>
              </div>

              {/* ไม่ผ่าน */}
              <div
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "10px 8px",
                  borderRadius: 14,
                  background: `linear-gradient(180deg, ${tone.fail.tileTop} 0%, ${tone.fail.tileBottom} 100%)`,
                  border: `1px solid ${tone.fail.tileBorder}`,
                  boxShadow: `0 1px 0 rgba(255,255,255,0.95) inset, 0 -2px 0 rgba(${tone.fail.glowRgb},0.16) inset, 0 6px 14px -6px rgba(${tone.fail.glowRgb},0.45)`,
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    lineHeight: 1,
                    background: `linear-gradient(180deg, ${tone.fail.numFrom} 0%, ${tone.fail.numTo} 100%)`,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    textShadow: "0 1px 0 rgba(255,255,255,0.6)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {failCount.toFixed(1)}%
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: tone.fail.labelText,
                    marginTop: 5,
                    whiteSpace: "nowrap",
                  }}
                >
                  {labels.failTile}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: RBM Status Table ── */}
      <div
        style={{
          ...card3D,
          flex: 1,
          overflowX: "auto",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "#1f2937",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 15,
                width: 28,
                height: 28,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 9,
                background: tableIconBg,
                boxShadow: tableIconShadow,
              }}
            >
              {tableIcon}
            </span>
            {tableTitle}
          </h3>
        </div>

        {loading ? (
          <div
            style={{
              height: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9ca3af",
              fontSize: 14,
            }}
          >
            กำลังโหลด...
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                {[
                  { label: "RBM", align: "left" as const },
                  { label: "รวม", align: "right" as const },
                  { label: labels.colPass, align: "right" as const },
                  { label: labels.colFail, align: "right" as const },
                  { label: labels.colPct, align: "center" as const },
                ].map((col, index, arr) => (
                  <th
                    key={col.label}
                    style={{
                      padding: "11px 10px",
                      textAlign: col.align,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#ffffff",
                      letterSpacing: "0.02em",
                      background:
                        "linear-gradient(180deg, #2c5786 0%, #1e3a5f 55%, #16304f 100%)",
                      boxShadow:
                        "0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 12px -6px rgba(15,23,42,0.55)",
                      borderTopLeftRadius: index === 0 ? 10 : 0,
                      borderTopRightRadius: index === arr.length - 1 ? 10 : 0,
                      textShadow: "0 1px 1px rgba(0,0,0,0.35)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Total row — แถบสรุปแบบยกนูน */}
              {sortedData.length > 0 && (
                <tr>
                  {[
                    {
                      key: "label",
                      content: "รวมทั้งหมด" as React.ReactNode,
                      align: "left" as const,
                      color: "#1e293b",
                    },
                    {
                      key: "total",
                      content: grandTotal.toLocaleString() as React.ReactNode,
                      align: "right" as const,
                      color: "#1e293b",
                    },
                    {
                      key: "pass",
                      content: (
                        <CountLink
                          value={totalPass}
                          tone={tone.pass}
                          hint={labels.passHint}
                          strong
                          onClick={() => openDetail(null, "pass")}
                        />
                      ) as React.ReactNode,
                      align: "right" as const,
                      color: "#0f172a",
                    },
                    {
                      key: "fail",
                      content: (
                        <CountLink
                          value={totalFail}
                          tone={tone.fail}
                          hint={labels.failHint}
                          strong
                          onClick={() => openDetail(null, "fail")}
                        />
                      ) as React.ReactNode,
                      align: "right" as const,
                      color: "#0f172a",
                    },
                    {
                      key: "pct",
                      content: `${passPercent}%` as React.ReactNode,
                      align: "right" as const,
                      color: tone.pass.arc,
                    },
                  ].map((cell) => (
                    <td
                      key={cell.key}
                      style={{
                        padding: "11px 10px",
                        textAlign: cell.align,
                        fontWeight: 800,
                        fontSize: 13,
                        color: cell.color,
                        background:
                          "linear-gradient(180deg, #ffffff 0%, #eef2f7 100%)",
                        borderBottom: "1px solid #dbe3ec",
                        boxShadow:
                          "0 1px 0 rgba(255,255,255,0.9) inset, 0 4px 8px -6px rgba(15,23,42,0.35)",
                        paddingRight: cell.key === "pct" ? 14 : 10,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cell.content}
                    </td>
                  ))}
                </tr>
              )}

              {/* Data rows */}
              {sortedData.map((row, idx) => {
                const rowTotal = row.pass + row.fail;
                const rowPassPct =
                  rowTotal > 0 ? ((row.pass / rowTotal) * 100).toFixed(1) : "0.0";
                const pctNum = parseFloat(rowPassPct);
                const baseBg =
                  idx % 2 === 0
                    ? "linear-gradient(180deg, #ffffff 0%, #fdfdfe 100%)"
                    : "linear-gradient(180deg, #f9fafb 0%, #f3f5f9 100%)";

                return (
                  <tr
                    key={row.rbm}
                    style={{
                      background: baseBg,
                      transition:
                        "background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLTableRowElement;
                      el.style.background =
                        "linear-gradient(180deg, #f5f9ff 0%, #e6f0ff 100%)";
                      el.style.boxShadow =
                        "0 6px 14px -8px rgba(30,58,95,0.45), 0 1px 0 rgba(255,255,255,0.9) inset";
                      el.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLTableRowElement;
                      el.style.background = baseBg;
                      el.style.boxShadow = "none";
                      el.style.transform = "translateY(0)";
                    }}
                  >
                    {/* RBM */}
                    <td
                      style={{
                        padding: "9px 10px",
                        fontWeight: 700,
                        color: "#1e3a5f",
                        borderBottom: "1px solid #eef1f5",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.rbm}
                    </td>
                    {/* Total */}
                    <td
                      style={{
                        padding: "9px 10px",
                        textAlign: "right",
                        fontWeight: 600,
                        color: "#374151",
                        borderBottom: "1px solid #eef1f5",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {rowTotal.toLocaleString()}
                    </td>
                    {/* ผ่าน (คลิกเพื่อดูรายชื่อ) */}
                    <td
                      style={{
                        padding: "6px 10px",
                        textAlign: "right",
                        borderBottom: "1px solid #eef1f5",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <CountLink
                        value={row.pass}
                        tone={tone.pass}
                        hint={labels.passHint}
                        onClick={() => openDetail(row.rbm, "pass")}
                      />
                    </td>
                    {/* ไม่ผ่าน (คลิกเพื่อดูรายชื่อ) */}
                    <td
                      style={{
                        padding: "6px 10px",
                        textAlign: "right",
                        borderBottom: "1px solid #eef1f5",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <CountLink
                        value={row.fail}
                        tone={tone.fail}
                        hint={labels.failHint}
                        onClick={() => openDetail(row.rbm, "fail")}
                      />
                    </td>
                    {/* % Bar — แท่งกราฟแบบ 3 มิติ */}
                    <td
                      style={{
                        padding: "9px 10px",
                        borderBottom: "1px solid #eef1f5",
                        minWidth: 100,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: 9,
                            borderRadius: 999,
                            background:
                              "linear-gradient(180deg, #dfe4ea 0%, #eef1f5 100%)",
                            boxShadow:
                              "0 1px 2px rgba(15,23,42,0.18) inset, 0 1px 0 rgba(255,255,255,0.85)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: play ? `${pctNum}%` : 0,
                              height: "100%",
                              borderRadius: 999,
                              background: `linear-gradient(180deg, ${tone.pass.barFrom} 0%, ${tone.pass.barMid} 55%, ${tone.pass.barTo} 100%)`,
                              boxShadow: `0 1px 0 rgba(255,255,255,0.55) inset, 0 -1px 2px rgba(${tone.pass.barInnerRgb},0.35) inset, 0 2px 5px -1px rgba(${tone.pass.glowRgb},0.5)`,
                              transition:
                                "width 0.9s cubic-bezier(.22,1,.36,1)",
                              transitionDelay: `${Math.min(idx * 60, 600)}ms`,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: tone.pass.barText,
                            minWidth: 38,
                            textAlign: "right",
                            textShadow: "0 1px 0 rgba(255,255,255,0.8)",
                          }}
                        >
                          {rowPassPct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Detail Modal — รายชื่อช่างตามพื้นที่ / สถานะ ─────────────── */}
      {detail && (
        <div
          onClick={closeDetail}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "pagFadeIn 0.2s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 16,
              padding: "24px 28px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              maxWidth: 1100,
              width: "96%",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              animation: "pagSlideUp 0.25s ease-out",
              fontFamily: "Inter, 'Noto Sans Thai', sans-serif",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${detailTone.modalFrom}, ${detailTone.modalTo})`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}
                >
                  {detailLabel}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#1e3a5f",
                    background: "#e2e8f0",
                    borderRadius: 10,
                    padding: "2px 10px",
                  }}
                >
                  📍 {detailScope}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: detailTone.chipText,
                    background: detailTone.chipLight,
                    borderRadius: 10,
                    padding: "2px 10px",
                  }}
                >
                  {detailLoading
                    ? "..."
                    : `${filteredDetailRows.length.toLocaleString()} คน`}
                </span>
              </div>
              <button
                onClick={closeDetail}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  transition: "background 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#e2e8f0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f1f5f9";
                }}
              >
                ✕
              </button>
            </div>

            {/* Search + Download bar */}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                <input
                  type="text"
                  placeholder="ค้นหา..."
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 12px 7px 32px",
                    fontSize: 13,
                    border: "1.5px solid #e2e8f0",
                    borderRadius: 8,
                    outline: "none",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#94a3b8";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 14,
                    pointerEvents: "none",
                  }}
                >
                  🔍
                </span>
              </div>
              <button
                onClick={handleDownloadExcel}
                disabled={detailLoading || !filteredDetailRows.length}
                style={{
                  background: filteredDetailRows.length
                    ? "linear-gradient(135deg, #10b981, #059669)"
                    : "#e2e8f0",
                  color: filteredDetailRows.length ? "white" : "#94a3b8",
                  border: "none",
                  borderRadius: 8,
                  padding: "7px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: filteredDetailRows.length ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "opacity 0.15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (filteredDetailRows.length)
                    e.currentTarget.style.opacity = "0.85";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                📥 Download Excel
              </button>
            </div>

            {/* Content */}
            {detailLoading ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 40,
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    border: "3px solid #e5e7eb",
                    borderTopColor: detailTone.modalSolid,
                    borderRadius: "50%",
                    animation: "pagSpin 0.8s linear infinite",
                  }}
                />
                <span style={{ fontSize: 13, color: "#6b7280" }}>
                  กำลังโหลดข้อมูล...
                </span>
              </div>
            ) : detailError ? (
              <div
                style={{
                  padding: 30,
                  textAlign: "center",
                  color: "#ef4444",
                  fontSize: 14,
                }}
              >
                ❌ {detailError}
              </div>
            ) : (
              <div style={{ overflowY: "auto", overflowX: "auto", flex: 1 }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                    minWidth: 900,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: detailTone.chipLight,
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                      }}
                    >
                      {headerLabels.map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "8px 8px",
                            fontWeight: 600,
                            fontSize: 11,
                            color: detailTone.chipText,
                            borderBottom: `2px solid ${detailTone.modalSolid}`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDetailRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={headerLabels.length}
                          style={{
                            padding: 24,
                            textAlign: "center",
                            color: "#94a3b8",
                            fontSize: 13,
                          }}
                        >
                          ไม่พบข้อมูล
                        </td>
                      </tr>
                    ) : (
                      filteredDetailRows.map((r, i) => {
                        const value = r[detailCfg.valueKey];
                        const isPass = detailCfg.isPass(value);
                        return (
                          <tr
                            key={`${r.tech_id}-${i}`}
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                              transition: "background 0.1s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#f8fafc";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <td
                              style={{
                                padding: "6px 8px",
                                color: "#94a3b8",
                                fontWeight: 500,
                              }}
                            >
                              {i + 1}
                            </td>
                            <td
                              style={{ padding: "6px 8px", color: "#1e293b" }}
                            >
                              {r.HRBM}
                            </td>
                            <td
                              style={{
                                padding: "6px 8px",
                                color: "#1e293b",
                                fontWeight: 600,
                              }}
                            >
                              {r.RBM}
                            </td>
                            <td
                              style={{ padding: "6px 8px", color: "#1e293b" }}
                            >
                              {r.CBM}
                            </td>
                            <td
                              style={{ padding: "6px 8px", color: "#1e293b" }}
                            >
                              {r.provider}
                            </td>
                            <td
                              style={{ padding: "6px 8px", color: "#64748b" }}
                            >
                              {r.depot_code}
                            </td>
                            <td
                              style={{ padding: "6px 8px", color: "#1e293b" }}
                            >
                              {r.depot_name}
                            </td>
                            <td
                              style={{
                                padding: "6px 8px",
                                color: "#0369a1",
                                fontWeight: 600,
                              }}
                            >
                              {r.tech_id}
                            </td>
                            <td
                              style={{ padding: "6px 8px", color: "#1e293b" }}
                            >
                              {r.full_name}
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  borderRadius: 6,
                                  padding: "2px 8px",
                                  background: isPass
                                    ? tone.pass.chipLight
                                    : tone.fail.chipLight,
                                  color: isPass
                                    ? tone.pass.chipText
                                    : tone.fail.chipText,
                                }}
                              >
                                {isPass
                                  ? detailCfg.passText
                                  : detailCfg.failText}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                {detailLoading
                  ? "กำลังโหลด..."
                  : `แสดง ${filteredDetailRows.length.toLocaleString()} จาก ${detailRows.length.toLocaleString()} รายการ`}
              </span>
              <button
                onClick={closeDetail}
                style={{
                  background: `linear-gradient(135deg, ${detailTone.modalFrom}, ${detailTone.modalTo})`,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 18px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.85";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pagFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pagSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pagSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
