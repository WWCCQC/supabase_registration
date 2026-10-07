"use client";
import { useEffect, useRef, useState } from 'react';

// Particle "explode → assemble" intro for the AI robot.
// Samples the robot PNG into glowing particles that start scattered,
// then converge to form the robot, after which the crisp image fades in and floats.
export default function RobotAssemble({
  src = '/ww-logo.png',
  alt = 'Wire & Wireless',
}: {
  src?: string;
  alt?: string;
} = {}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const timers: number[] = [];
    let raf = 0;

    const finishReveal = () => {
      setRevealed(true);
    };

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      finishReveal();
      return () => timers.forEach((t) => clearTimeout(t));
    }

    const rect = stage.getBoundingClientRect();
    const stageSize = Math.max(rect.width, rect.height) || 300;
    const box = Math.round(stageSize * 1.5); // canvas extends beyond the robot so particles scatter widely
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.style.width = `${box}px`;
    canvas.style.height = `${box}px`;
    canvas.width = Math.round(box * dpr);
    canvas.height = Math.round(box * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const W = box;
    const H = box;
    const FIT = 0.82; // robot occupies ~82% of the stage (must match .nc-robot CSS size)
    const DUR = 2300; // assembly duration (ms)
    const GAP = 5; // particle sampling density

    let start = 0;
    const particles: Array<{
      tx: number; ty: number; x0: number; y0: number;
      r: number; g: number; b: number; size: number; delay: number;
    }> = [];

    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      let done = true;
      for (const p of particles) {
        let lt = (t - p.delay) / DUR;
        if (lt < 0) lt = 0;
        if (lt < 1) done = false;
        if (lt > 1) lt = 1;
        const e = 1 - Math.pow(1 - lt, 3); // easeOutCubic
        const x = p.x0 + (p.tx - p.x0) * e;
        const y = p.y0 + (p.ty - p.y0) * e;
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${0.15 + 0.75 * e})`;
        ctx.fillRect(x, y, p.size, p.size);
      }
      if (!done) {
        raf = requestAnimationFrame(tick);
      } else {
        timers.push(window.setTimeout(finishReveal, 140));
      }
    };

    const img = new Image();
    img.onload = () => {
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const octx = off.getContext('2d');
      if (!octx) return;

      const inner = stageSize; // robot target region
      const scale = (inner * FIT) / Math.max(img.width, img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = (W - dw) / 2;
      const dy = (H - dh) / 2;
      octx.drawImage(img, dx, dy, dw, dh);

      const data = octx.getImageData(0, 0, W, H).data;
      for (let y = 0; y < H; y += GAP) {
        for (let x = 0; x < W; x += GAP) {
          const i = (y * W + x) * 4;
          const a = data[i + 3];
          if (a < 70) continue;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if ((r + g + b) / 3 < 22) continue; // drop near-black background
          particles.push({
            tx: x, ty: y,
            x0: Math.random() * W,
            y0: Math.random() * H,
            r, g, b,
            size: GAP * 0.95,
            delay: Math.random() * 450,
          });
        }
      }
      start = performance.now();
      raf = requestAnimationFrame(tick);
    };
    img.src = src;

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => clearTimeout(t));
    };
  }, [src]);

  return (
    <div className="nc-robot-stage" ref={stageRef}>
      <canvas
        ref={canvasRef}
        className="nc-robot-canvas"
        style={{ opacity: revealed ? 0 : 1 }}
        aria-hidden="true"
      />
      <img
        src={src}
        alt={alt}
        className="nc-robot"
        style={{ opacity: revealed ? 1 : 0 }}
      />
    </div>
  );
}
