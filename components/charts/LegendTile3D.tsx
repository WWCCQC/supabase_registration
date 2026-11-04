"use client";

import React from "react";
import type { Tone } from "./StatusGaugeSection";

/**
 * การ์ด legend ใต้เกจ แบบ 3D motion (CSS ล้วน)
 * - พลิกขึ้นจากแนวนอนแล้วเด้งเข้าที่ + ไอคอนเด้งออกมา
 * - ตัวเลข % หมุนทีละหลักแบบเลขไมล์
 * - แถบสัดส่วนเติมเต็ม + แสงวิ่งผ่าน
 * - ชี้เมาส์แล้วการ์ดเอียงตาม พร้อมแสงสะท้อน
 */

type Props = {
  tone: Tone;
  kind: "pass" | "fail";
  label: string;
  hint: string;
  percent: number; // 0..100
  count: number; // จำนวนคน (ค่าที่กำลังวิ่งขึ้น)
  active: boolean;
  delay?: number; // ms
};

const CSS = `
.lt3d-stage{perspective:900px}
.lt3d-tile{position:relative;transform-style:preserve-3d;transform:rotateX(-75deg) translateY(28px);opacity:0;transition:transform .9s cubic-bezier(.2,1.4,.4,1),opacity .5s ease}
.lt3d-tile.lt3d-in{transform:none;opacity:1}
.lt3d-badge{transform:translateZ(30px) scale(0);transition:transform .5s cubic-bezier(.3,1.8,.5,1) .45s}
.lt3d-in .lt3d-badge{transform:translateZ(30px) scale(1)}
.lt3d-col{display:flex;flex-direction:column;transform:translateY(0)}
.lt3d-col>span{display:block;height:1em;line-height:1em}
.lt3d-fill{position:relative;overflow:hidden;width:0;transition:width 1.4s cubic-bezier(.2,.9,.25,1) .35s}
.lt3d-fill::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);transform:translateX(-100%);animation:lt3d-shine 2.6s 2.2s infinite}
.lt3d-dot{animation:lt3d-pulse 1.8s infinite}
@keyframes lt3d-shine{to{transform:translateX(100%)}}
@keyframes lt3d-pulse{0%{box-shadow:0 0 0 0 var(--lt3d-pulse)}70%,100%{box-shadow:0 0 0 6px transparent}}
@media (prefers-reduced-motion: reduce){
  .lt3d-tile,.lt3d-badge,.lt3d-fill,.lt3d-col{transition:none!important}
  .lt3d-fill::after,.lt3d-dot{animation:none}
}
`;

/** ตัวเลขหมุนทีละหลัก — แต่ละหลักเป็นคอลัมน์ 0-9 แล้วเลื่อนขึ้นไปหาหลักเป้าหมาย */
function Odometer({ value, rolled, color }: { value: string; rolled: boolean; color: string }) {
  let digitIndex = 0;
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        height: "1em",
        overflow: "hidden",
        lineHeight: "1em",
        color,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {[...value].map((ch, i) => {
        if (ch < "0" || ch > "9") return <span key={i}>{ch}</span>;
        const k = digitIndex++;
        return (
          <span
            key={i}
            className="lt3d-col"
            style={{
              transform: rolled ? `translateY(-${Number(ch)}em)` : undefined,
              transition: rolled ? `transform ${1.1 + k * 0.15}s cubic-bezier(.2,.9,.25,1)` : "none",
            }}
          >
            {Array.from({ length: 10 }, (_, d) => (
              <span key={d}>{d}</span>
            ))}
          </span>
        );
      })}
    </span>
  );
}

export default function LegendTile3D({
  tone,
  kind,
  label,
  hint,
  percent,
  count,
  active,
  delay = 0,
}: Props) {
  const tileRef = React.useRef<HTMLDivElement>(null);
  const glareRef = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);
  const [rolled, setRolled] = React.useState(false);

  React.useEffect(() => {
    if (!active) {
      setShown(false);
      setRolled(false);
      return;
    }
    const t1 = window.setTimeout(() => setShown(true), delay);
    const t2 = window.setTimeout(() => setRolled(true), delay + 350);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [active, delay]);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const tile = tileRef.current;
    const glare = glareRef.current;
    if (!tile || !glare || !shown) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const b = tile.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width;
    const y = (e.clientY - b.top) / b.height;
    tile.style.transition = "transform .12s ease-out";
    tile.style.transform = `rotateY(${(x - 0.5) * 18}deg) rotateX(${(0.5 - y) * 14}deg) translateZ(10px)`;
    glare.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,.85), transparent 55%)`;
  };
  const onLeave = () => {
    const tile = tileRef.current;
    const glare = glareRef.current;
    if (!tile || !glare) return;
    tile.style.transition = "transform .6s cubic-bezier(.2,1.4,.4,1)";
    tile.style.transform = "";
    glare.style.background = "";
  };

  const pctText = Math.min(Math.max(percent, 0), 100).toFixed(2);
  const cleanLabel = label.replace(/^(✅|❌)\s*/, "");

  return (
    <div className="lt3d-stage" style={{ flex: 1, minWidth: 0 }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div
        ref={tileRef}
        className={`lt3d-tile${shown ? " lt3d-in" : ""}`}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{
          textAlign: "center",
          padding: "16px 10px 12px",
          borderRadius: 16,
          background: `linear-gradient(160deg, ${tone.tileTop} 0%, ${tone.tileBottom} 100%)`,
          border: `1px solid ${tone.tileBorder}`,
          boxShadow: `0 1px 0 rgba(255,255,255,0.95) inset, 0 -3px 0 rgba(${tone.glowRgb},0.2) inset, 0 14px 24px -10px rgba(${tone.glowRgb},0.55)`,
        }}
      >
        {/* แสงสะท้อนตามเมาส์ */}
        <div
          ref={glareRef}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 16,
            pointerEvents: "none",
            mixBlendMode: "soft-light",
          }}
        />

        {/* ไอคอนลอยเหนือการ์ด */}
        <div
          className="lt3d-badge"
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -14,
            left: "50%",
            width: 28,
            height: 28,
            marginLeft: -14,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 15,
            fontWeight: 800,
            background: `linear-gradient(160deg, ${tone.modalFrom} 0%, ${tone.modalTo} 100%)`,
            boxShadow: `0 4px 10px rgba(${tone.glowRgb},0.45)`,
          }}
        >
          {kind === "pass" ? "✓" : "✕"}
        </div>

        <div style={{ transform: "translateZ(22px)" }}>
          <div
            aria-label={`${pctText}%`}
            style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, display: "inline-flex", alignItems: "baseline" }}
          >
            <Odometer value={pctText} rolled={rolled} color={tone.numTo} />
            <span style={{ fontSize: 17, color: tone.numTo, marginLeft: 1 }}>%</span>
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: tone.labelText,
              marginTop: 6,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              className="lt3d-dot"
              style={
                {
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  marginRight: 5,
                  background: tone.arc,
                  "--lt3d-pulse": `rgba(${tone.glowRgb},0.5)`,
                } as React.CSSProperties
              }
            />
            {cleanLabel}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: tone.barText,
              marginTop: 3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {Math.round(count).toLocaleString()} คน · {hint}
          </div>
        </div>

        {/* แถบสัดส่วน */}
        <div
          style={{
            height: 7,
            borderRadius: 99,
            marginTop: 10,
            overflow: "hidden",
            background: `rgba(${tone.glowRgb},0.15)`,
            transform: "translateZ(14px)",
          }}
        >
          <div
            className="lt3d-fill"
            style={{
              height: "100%",
              borderRadius: 99,
              width: shown ? `${pctText}%` : 0,
              background: `linear-gradient(90deg, ${tone.barFrom} 0%, ${tone.barTo} 100%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
