"use client";

import React from "react";
import * as THREE from "three";

/**
 * เกจครึ่งวงกลมแบบ 3D (three.js)
 * - สีผ่านกวาดตามเข็ม → เข็มเลยนิดแล้วเด้งกลับ
 * - สีไม่ผ่านเติมต่อจากจุดที่เข็มหยุด แล้วยกลอยออกมาเล็กน้อย
 * - เกจลอยตัวเบา ๆ และเอียงตามเมาส์
 * ถ้าเครื่องไม่รองรับ WebGL จะแสดง `fallback` แทน
 */

type Props = {
  pass: number;
  fail: number;
  total: number;
  animate: boolean;
  passColor: string;
  failColor: string;
  fallback: React.ReactNode;
};

const W = 300;
const H = 190;

const RI = 1.55; // รัศมีด้านใน
const RO = 2.25; // รัศมีด้านนอก
const DEPTH = 0.3; // ความหนาของวง
const GAP = 0.012; // ช่องว่างระหว่างสีผ่าน/ไม่ผ่าน (rad)

const TRACK_COLOR = 0xe2e8f0;
const TICK_COLOR = 0x94a3b8;
const LABEL_COLOR = "#64748b";

// จังหวะแอนิเมชัน (วินาที)
const NEEDLE_DUR = 1.6;
const RED_DELAY = 1.2;
const RED_DUR = 0.8;
const LIFT_DELAY = 2.0;
const LIFT_DUR = 0.5;
const LIFT = 0.13;

const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
/** ease-out ที่เลยเป้านิดหนึ่งแล้วเด้งกลับ (เหมือนเข็มไมล์) */
const easeOutBack = (t: number) => {
  const p = clamp01(t);
  const k = 1.7;
  return 1 + (k + 1) * Math.pow(p - 1, 3) + k * Math.pow(p - 1, 2);
};

/** วงแหวนครึ่งวงกลมจากมุม a0 → a1 (rad, 0 = ขวา, π = ซ้าย) ยกนูนด้วย extrude */
function arcGeometry(a0: number, a1: number, depth = DEPTH, inset = 0) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, RO - inset, a0, a1, false);
  shape.absarc(0, 0, RI + inset, a1, a0, true);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 3,
    curveSegments: Math.max(8, Math.ceil((120 * (a1 - a0)) / Math.PI)),
  });
}

function labelTexture(text: string) {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 64;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = "600 30px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 32);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function shadowTexture() {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(15,23,42,0.32)");
  g.addColorStop(1, "rgba(15,23,42,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

export default function Gauge3D({
  pass,
  fail,
  total,
  animate,
  passColor,
  failColor,
  fallback,
}: Props) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [failed, setFailed] = React.useState(false);
  const passFraction = total > 0 ? pass / total : 0;
  const failFraction = total > 0 ? fail / total : 0;

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || failed) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    renderer.domElement.style.width = `${W}px`;
    renderer.domElement.style.height = `${H}px`;
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
    camera.position.set(0, -1.0, 7.6);
    camera.lookAt(0, 1.0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 5, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(-4, 1, 4);
    scene.add(fill);

    const material = (color: THREE.ColorRepresentation, roughness = 0.35, metalness = 0.12) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });

    const gauge = new THREE.Group();
    scene.add(gauge);

    // เงาบนพื้น
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
    );
    shadow.scale.set(6, 0.9, 1);
    shadow.position.set(0, -0.3, -0.4);
    scene.add(shadow);

    // Track (เทา) — หดเข้าเล็กน้อยไม่ให้ผิวทับกับสีผ่าน/ไม่ผ่าน (z-fighting)
    const track = new THREE.Mesh(arcGeometry(0, Math.PI, DEPTH * 0.6, 0.03), material(TRACK_COLOR, 0.6, 0));
    track.position.z = -0.02;
    gauge.add(track);

    // ขีดสเกลทุก 5% + ป้าย 0/25/50/75/100%
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI - (i / 20) * Math.PI;
      const major = i % 5 === 0;
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(major ? 0.22 : 0.12, major ? 0.045 : 0.025, 0.04),
        material(TICK_COLOR, 0.5, 0)
      );
      const r = RO + 0.2;
      tick.position.set(Math.cos(a) * r, Math.sin(a) * r, DEPTH * 0.3);
      tick.rotation.z = a;
      gauge.add(tick);
      if (major) {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: labelTexture(`${i * 5}%`), transparent: true })
        );
        sprite.scale.set(0.8, 0.4, 1);
        const lr = RO + 0.66;
        sprite.position.set(Math.cos(a) * lr, Math.sin(a) * lr, DEPTH * 0.3);
        gauge.add(sprite);
      }
    }

    // เข็ม + ดุม
    const needle = new THREE.Group();
    const needleLen = RO + 0.05;
    const needleGeo = new THREE.CylinderGeometry(0.025, 0.075, needleLen, 16);
    needleGeo.rotateZ(-Math.PI / 2);
    needleGeo.translate(needleLen / 2, 0, 0);
    needle.add(new THREE.Mesh(needleGeo, material(0x1e293b, 0.3, 0.5)));
    needle.position.z = DEPTH + 0.12;
    gauge.add(needle);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.2, 40), material(0x334155, 0.25, 0.6));
    hub.rotation.x = Math.PI / 2;
    hub.position.z = DEPTH + 0.08;
    gauge.add(hub);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), material(0xf1f5f9, 0.3, 0.2));
    cap.position.z = DEPTH + 0.2;
    gauge.add(cap);

    // สีผ่าน / ไม่ผ่าน — สร้าง geometry ใหม่เมื่อความยาวเปลี่ยนเท่านั้น
    const passMat = material(passColor);
    const failMat = material(failColor);
    const passMesh = new THREE.Mesh(new THREE.BufferGeometry(), passMat);
    const failMesh = new THREE.Mesh(new THREE.BufferGeometry(), failMat);
    gauge.add(passMesh, failMesh);
    let lastPass = -1;
    let lastFail = -1;
    const boundary = Math.PI - passFraction * Math.PI; // มุมรอยต่อ ผ่าน/ไม่ผ่าน

    const setPass = (f: number) => {
      const q = Math.round(f * 500) / 500;
      if (q === lastPass) return;
      lastPass = q;
      passMesh.geometry.dispose();
      passMesh.geometry = q > 0 ? arcGeometry(Math.PI - q * Math.PI, Math.PI) : new THREE.BufferGeometry();
    };
    const setFail = (p: number) => {
      const q = Math.round(p * 500) / 500;
      if (q === lastFail) return;
      lastFail = q;
      failMesh.geometry.dispose();
      const end = boundary - (passFraction > 0 ? GAP : 0);
      const start = end - q * end;
      failMesh.geometry = q > 0 && end - start > 0.001 ? arcGeometry(start, end) : new THREE.BufferGeometry();
    };
    const failMid = boundary / 2;

    // เอียงตามเมาส์
    let tiltX = 0;
    let tiltY = 0;
    let curX = 0;
    let curY = 0;
    const onMove = (e: PointerEvent) => {
      const b = host.getBoundingClientRect();
      tiltX = ((e.clientX - b.left) / b.width - 0.5) * 0.5;
      tiltY = ((e.clientY - b.top) / b.height - 0.5) * 0.3;
    };
    const onLeave = () => {
      tiltX = 0;
      tiltY = 0;
    };
    if (!reduceMotion) {
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
    }

    // หยุดวาดเมื่อเลื่อนพ้นจอ
    let visible = true;
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            visible = entries.some((e) => e.isIntersecting);
          })
        : null;
    io?.observe(host);

    const BASE_TILT_X = -0.3;
    const pose = (needleF: number, redP: number, liftP: number) => {
      setPass(Math.min(needleF, passFraction));
      setFail(failFraction > 0 ? redP : 0);
      needle.rotation.z = Math.PI - clamp01(needleF) * Math.PI;
      const lift = liftP * LIFT;
      failMesh.position.set(Math.cos(failMid) * lift, Math.sin(failMid) * lift, lift * 0.8);
    };

    let frame = 0;
    const start = performance.now();

    if (!animate) {
      pose(0, 0, 0);
      gauge.rotation.x = BASE_TILT_X;
      renderer.render(scene, camera);
    } else if (reduceMotion) {
      pose(passFraction, 1, 1);
      gauge.rotation.x = BASE_TILT_X;
      renderer.render(scene, camera);
    } else {
      const step = (now: number) => {
        frame = requestAnimationFrame(step);
        if (!visible) return;
        const t = (now - start) / 1000;
        const settled = t > NEEDLE_DUR + 0.3;
        const jitter = settled ? Math.sin(now / 260) * 0.004 : 0;
        pose(
          passFraction * easeOutBack(t / NEEDLE_DUR) + jitter,
          easeOutCubic((t - RED_DELAY) / RED_DUR),
          easeOutCubic((t - LIFT_DELAY) / LIFT_DUR)
        );
        curX += (tiltX - curX) * 0.08;
        curY += (tiltY - curY) * 0.08;
        const bob = Math.sin(now / 1900);
        gauge.rotation.y = curX + Math.sin(now / 2800) * 0.05;
        gauge.rotation.x = BASE_TILT_X + curY;
        gauge.position.y = bob * 0.04;
        shadow.scale.x = 6 - bob * 0.15;
        renderer.render(scene, camera);
      };
      frame = requestAnimationFrame(step);
    }

    return () => {
      cancelAnimationFrame(frame);
      io?.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m: THREE.Material & { map?: THREE.Texture | null }) => {
            m.map?.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [passFraction, failFraction, animate, passColor, failColor, failed]);

  if (failed) return <>{fallback}</>;

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={`${(passFraction * 100).toFixed(1)}%`}
      style={{ width: W, height: H, margin: "0 auto" }}
    />
  );
}
