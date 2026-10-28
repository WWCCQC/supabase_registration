"use client";

import React from "react";
import * as THREE from "three";

export type ShareSlice = { key: string; label: string; value: number; color: string };

type Props = {
  slices: ShareSlice[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  className?: string;
};

const OUTER_R = 1.25;
const INNER_R = 0.82;
const DEPTH = 0.22;
const MIN_ARC = 0.035; // keep tiny slices visible and clickable (fraction of the full ring)
const GAP = 0.025; // radians between slices

type SliceMesh = THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial> & {
  userData: { key: string; mid: number; grow: number; lift: number };
};

function arcShape(a0: number, a1: number) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, OUTER_R, a0, a1, false);
  shape.absarc(0, 0, INNER_R, a1, a0, true);
  shape.closePath();
  return shape;
}

/** Visual arc fractions: real proportions, with a floor so a tiny slice stays clickable. */
function arcFractions(values: number[]) {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v > 0 ? Math.max(v / total, MIN_ARC) : 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((f) => f / sum);
}

export default function ProviderShare3D({ slices, selected, onSelect, className }: Props) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const selectedRef = React.useRef(selected);
  const onSelectRef = React.useRef(onSelect);
  const kickRef = React.useRef<() => void>(() => {});
  onSelectRef.current = onSelect;

  React.useEffect(() => {
    selectedRef.current = selected;
    kickRef.current();
  }, [selected]);

  const dataKey = slices.map((s) => `${s.key}:${s.value}`).join("|");

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, -3.6, 4.4);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2, -3, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfdbfe, 0.8);
    rim.position.set(-3, 3, 2);
    scene.add(rim);

    const ring = new THREE.Group();
    scene.add(ring);

    // Background track
    const track = new THREE.Mesh(
      new THREE.ExtrudeGeometry(arcShape(0, Math.PI * 2), { depth: DEPTH * 0.35, bevelEnabled: false, curveSegments: 96 }),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 })
    );
    track.position.z = -0.02;
    ring.add(track);

    // Slices clockwise from 12 o'clock
    const fractions = arcFractions(slices.map((s) => s.value));
    const meshes: SliceMesh[] = [];
    let cursor = Math.PI / 2;
    slices.forEach((slice, i) => {
      const sweep = fractions[i] * Math.PI * 2;
      if (sweep <= 0) return;
      const a1 = cursor - GAP / 2;
      const a0 = cursor - sweep + GAP / 2;
      cursor -= sweep;
      const geometry = new THREE.ExtrudeGeometry(arcShape(a0, a1), {
        depth: DEPTH,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.025,
        bevelSegments: 3,
        curveSegments: Math.max(8, Math.round(sweep * 40)),
      });
      const material = new THREE.MeshStandardMaterial({
        color: slice.color,
        roughness: 0.35,
        metalness: 0.1,
        emissive: new THREE.Color(slice.color),
        emissiveIntensity: 0,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geometry, material) as SliceMesh;
      mesh.userData = { key: slice.key, mid: (a0 + a1) / 2, grow: reduceMotion ? 1 : 0, lift: 0 };
      mesh.scale.z = mesh.userData.grow;
      ring.add(mesh);
      meshes.push(mesh);
    });

    // --- Interaction: hover + click via raycasting ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered: string | null = null;

    const pick = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return hit ? (hit.object as SliceMesh).userData.key : null;
    };
    const onMove = (event: PointerEvent) => {
      const next = pick(event);
      if (next !== hovered) {
        hovered = next;
        renderer.domElement.style.cursor = next ? "pointer" : "default";
        kick();
      }
    };
    const onLeave = () => {
      hovered = null;
      kick();
    };
    const onClick = (event: PointerEvent) => {
      const key = pick(event);
      onSelectRef.current(key && key === selectedRef.current ? null : key);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);
    renderer.domElement.addEventListener("click", onClick as EventListener);

    // --- Render on demand: animate until every value settles, then stop ---
    let frame = 0;
    let tiltX = reduceMotion ? 0 : -0.6;
    const step = () => {
      frame = 0;
      const ease = reduceMotion ? 1 : 0.14;
      let moving = false;
      const settle = (current: number, target: number) => {
        const next = current + (target - current) * ease;
        if (Math.abs(target - next) > 0.001) moving = true;
        return Math.abs(target - next) > 0.001 ? next : target;
      };

      tiltX = settle(tiltX, 0);
      ring.rotation.z = tiltX;

      const active = selectedRef.current;
      meshes.forEach((mesh, i) => {
        const d = mesh.userData;
        // Staggered grow-in on mount
        const growTarget = reduceMotion || tiltX > -0.6 + i * 0.12 ? 1 : 0;
        d.grow = settle(d.grow, growTarget);
        const focus = d.key === active ? 1 : d.key === hovered ? 0.55 : 0;
        d.lift = settle(d.lift, focus);
        mesh.scale.z = Math.max(d.grow, 0.001) * (1 + d.lift * 0.9);
        mesh.position.set(Math.cos(d.mid) * d.lift * 0.12, Math.sin(d.mid) * d.lift * 0.12, d.lift * 0.06);
        mesh.material.emissiveIntensity = d.lift * 0.25;
        mesh.material.opacity = settle(mesh.material.opacity, active && d.key !== active ? 0.35 : 1);
      });

      renderer.render(scene, camera);
      if (moving) frame = requestAnimationFrame(step);
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };
    kickRef.current = kick;

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = `${width}px`;
      renderer.domElement.style.height = `${height}px`;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      kick();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    return () => {
      cancelAnimationFrame(frame);
      kickRef.current = () => {};
      observer.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      renderer.domElement.removeEventListener("click", onClick as EventListener);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
    // Rebuild the scene only when the data changes; selection is read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
