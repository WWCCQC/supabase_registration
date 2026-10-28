"use client";

import React from "react";
import * as THREE from "three";

export type ShareSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type Props = {
  slices: ShareSlice[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  onHoverChange?: (key: string | null) => void;
  className?: string;
};

const OUTER_R = 1.28;
const INNER_R = 0.8;
const DEPTH = 0.26;
const MIN_ARC = 0.04; // keep tiny slices visible and clickable (fraction of the full ring)
const GAP = 0.028; // radians between slices

type SliceMesh = THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial> & {
  userData: {
    kind: "slice";
    key: string;
    label: string;
    value: number;
    pct: string;
    color: string;
    mid: number;
    grow: number;
    lift: number;
    satOrb: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshStandardMaterial>;
  };
};

type InteractiveHitObject = THREE.Object3D & {
  userData:
    | SliceMesh["userData"]
    | {
        kind: "satellite";
        key: string;
        parentSlice: SliceMesh;
      }
    | {
        kind: "center";
      };
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

export default function ProviderShare3D({
  slices,
  selected,
  onSelect,
  onHoverChange,
  className,
}: Props) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const selectedRef = React.useRef(selected);
  const onSelectRef = React.useRef(onSelect);
  const onHoverChangeRef = React.useRef(onHoverChange);

  const [hoveredInfo, setHoveredInfo] = React.useState<{
    key: string;
    label: string;
    value: number;
    pct: string;
    color: string;
    isCenter?: boolean;
  } | null>(null);

  onSelectRef.current = onSelect;
  onHoverChangeRef.current = onHoverChange;

  React.useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const dataKey = slices.map((s) => `${s.key}:${s.value}`).join("|");
  const totalValue = slices.reduce((sum, s) => sum + s.value, 0);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 50);
    camera.position.set(0, -3.55, 4.55);
    camera.lookAt(0, 0, 0);

    // Studio multi-light setup
    scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.35);
    keyLight.position.set(2.4, -3.2, 5.2);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 1.1);
    rimLight.position.set(-3.2, 2.8, 2.5);
    scene.add(rimLight);

    const accentPoint = new THREE.PointLight(0x3b82f6, 1.6, 12);
    accentPoint.position.set(0, 0, 2.2);
    scene.add(accentPoint);

    const ring = new THREE.Group();
    scene.add(ring);

    // Outer decorative orbital energy halo
    const haloGeo = new THREE.TorusGeometry(OUTER_R + 0.2, 0.018, 12, 96);
    const haloMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.3,
      metalness: 0.4,
      emissive: new THREE.Color(0x3b82f6),
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.65,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.z = 0.08;
    ring.add(haloMesh);

    // Background track
    const track = new THREE.Mesh(
      new THREE.ExtrudeGeometry(arcShape(0, Math.PI * 2), {
        depth: DEPTH * 0.32,
        bevelEnabled: false,
        curveSegments: 96,
      }),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.88 })
    );
    track.position.z = -0.04;
    ring.add(track);

    // Clickable center crystal disk (resets selection when clicked)
    const centerDiskGeo = new THREE.CylinderGeometry(INNER_R * 0.72, INNER_R * 0.76, 0.12, 48);
    centerDiskGeo.rotateX(Math.PI / 2);
    const centerDiskMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.15,
      emissive: new THREE.Color(0x3b82f6),
      emissiveIntensity: 0.06,
      transparent: true,
      opacity: 0.9,
    });
    const centerDisk = new THREE.Mesh(centerDiskGeo, centerDiskMat);
    centerDisk.position.z = -0.02;
    centerDisk.userData = { kind: "center" };
    ring.add(centerDisk);

    // Slices clockwise from 12 o'clock + clickable 3D satellite nodes
    const fractions = arcFractions(slices.map((s) => s.value));
    const meshes: SliceMesh[] = [];
    const hitObjects: THREE.Object3D[] = [centerDisk];
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
        bevelThickness: 0.035,
        bevelSize: 0.028,
        bevelSegments: 3,
        curveSegments: Math.max(10, Math.round(sweep * 42)),
      });
      const material = new THREE.MeshStandardMaterial({
        color: slice.color,
        roughness: 0.28,
        metalness: 0.18,
        emissive: new THREE.Color(slice.color),
        emissiveIntensity: 0.06,
        transparent: true,
        opacity: 1,
      });

      const mid = (a0 + a1) / 2;
      const pct = totalValue > 0 ? ((slice.value / totalValue) * 100).toFixed(1) : "0.0";

      // Clickable 3D faceted satellite orb at the outer midpoint of each slice
      const satGeo = new THREE.OctahedronGeometry(0.11, 0);
      const satMat = new THREE.MeshStandardMaterial({
        color: slice.color,
        roughness: 0.2,
        metalness: 0.35,
        emissive: new THREE.Color(slice.color),
        emissiveIntensity: 0.3,
        flatShading: true,
      });
      const satOrb = new THREE.Mesh(satGeo, satMat);
      satOrb.position.set(
        Math.cos(mid) * (OUTER_R + 0.2),
        Math.sin(mid) * (OUTER_R + 0.2),
        DEPTH * 0.65
      );
      ring.add(satOrb);

      const mesh = new THREE.Mesh(geometry, material) as SliceMesh;
      mesh.userData = {
        kind: "slice",
        key: slice.key,
        label: slice.label,
        value: slice.value,
        pct,
        color: slice.color,
        mid,
        grow: reduceMotion ? 1 : 0.01,
        lift: 0,
        satOrb,
      };
      satOrb.userData = {
        kind: "satellite",
        key: slice.key,
        parentSlice: mesh,
      };

      mesh.scale.z = mesh.userData.grow;
      ring.add(mesh);
      meshes.push(mesh);
      hitObjects.push(mesh, satOrb);
    });

    // --- Interaction: hover + drag-to-rotate + click via raycasting ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoveredKey: string | null = null;
    let pointerX = 0;
    let pointerY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragMoved = false;
    let userYaw = 0;
    let userPitch = 0;

    const pickHit = (event: PointerEvent): InteractiveHitObject | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      pointerX = pointer.x;
      pointerY = pointer.y;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(hitObjects, false)[0];
      return hit ? (hit.object as InteractiveHitObject) : null;
    };

    const onPointerDown = (event: PointerEvent) => {
      isDragging = true;
      dragMoved = false;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (isDragging) {
        const dx = event.clientX - dragStartX;
        const dy = event.clientY - dragStartY;
        if (Math.hypot(dx, dy) > 5) {
          dragMoved = true;
          userYaw = Math.max(-0.55, Math.min(0.55, userYaw + dx * 0.005));
          userPitch = Math.max(-0.4, Math.min(0.4, userPitch + dy * 0.005));
          dragStartX = event.clientX;
          dragStartY = event.clientY;
        }
      }

      const hit = pickHit(event);
      if (!hit) {
        if (hoveredKey !== null) {
          hoveredKey = null;
          setHoveredInfo(null);
          onHoverChangeRef.current?.(null);
        }
        renderer.domElement.style.cursor = isDragging ? "grabbing" : "grab";
        return;
      }

      renderer.domElement.style.cursor = "pointer";
      const ud = hit.userData;
      if (ud.kind === "center") {
        if (hoveredKey !== "__CENTER__") {
          hoveredKey = "__CENTER__";
          onHoverChangeRef.current?.(null);
          setHoveredInfo({
            key: "__CENTER__",
            label: selectedRef.current ? "คลิกเพื่อแสดงช่างทั้งหมด" : "ภาพรวมช่างทั้งหมด",
            value: totalValue,
            pct: "100.0",
            color: "#3b82f6",
            isCenter: true,
          });
        }
      } else {
        const sliceData = ud.kind === "satellite" ? ud.parentSlice.userData : ud;
        if (hoveredKey !== sliceData.key) {
          hoveredKey = sliceData.key;
          onHoverChangeRef.current?.(sliceData.key);
          setHoveredInfo({
            key: sliceData.key,
            label: sliceData.label,
            value: sliceData.value,
            pct: sliceData.pct,
            color: sliceData.color,
          });
        }
      }
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onPointerLeave = () => {
      isDragging = false;
      hoveredKey = null;
      pointerX = 0;
      pointerY = 0;
      setHoveredInfo(null);
      onHoverChangeRef.current?.(null);
      renderer.domElement.style.cursor = "default";
    };

    const onClick = (event: PointerEvent) => {
      if (dragMoved) return;
      const hit = pickHit(event);
      if (!hit) return;
      const ud = hit.userData;
      if (ud.kind === "center") {
        onSelectRef.current(null);
        return;
      }
      const key = ud.kind === "satellite" ? ud.key : ud.key;
      onSelectRef.current(key && key === selectedRef.current ? null : key);
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    renderer.domElement.addEventListener("click", onClick as EventListener);

    let frame = 0;
    let introSpin = reduceMotion ? 0 : -0.65;
    const clock = new THREE.Clock();

    const step = () => {
      const t = clock.getElapsedTime();
      const ease = reduceMotion ? 1 : 0.14;

      introSpin += (0 - introSpin) * ease;

      if (!reduceMotion) {
        // Gentle continuous breathing + pointer parallax + user drag angle
        const targetRotY = pointerX * 0.28 + userYaw + Math.sin(t * 0.85) * 0.06;
        const targetRotX = -pointerY * 0.22 + userPitch + Math.cos(t * 0.65) * 0.05;
        ring.rotation.y += (targetRotY - ring.rotation.y) * 0.1;
        ring.rotation.x += (targetRotX - ring.rotation.x) * 0.1;
        ring.rotation.z = introSpin;
        ring.position.y = Math.sin(t * 1.6) * 0.035;
      }

      const active = selectedRef.current;
      meshes.forEach((mesh, i) => {
        const d = mesh.userData;
        const growTarget = reduceMotion || introSpin > -0.65 + i * 0.1 ? 1 : 0.01;
        d.grow += (growTarget - d.grow) * ease;

        const isSelected = d.key === active;
        const isHovered = d.key === hoveredKey;
        const focus = isSelected ? 1 : isHovered ? 0.62 : 0;
        d.lift += (focus - d.lift) * ease;

        mesh.scale.z = Math.max(d.grow, 0.001) * (1 + d.lift * 0.92);
        const radialOffset = d.lift * 0.15;
        mesh.position.set(
          Math.cos(d.mid) * radialOffset,
          Math.sin(d.mid) * radialOffset,
          d.lift * 0.08
        );

        const pulse = isSelected && !reduceMotion ? (Math.sin(t * 3.5) + 1) * 0.08 : 0;
        mesh.material.emissiveIntensity = 0.06 + d.lift * 0.3 + pulse;

        const targetOpacity = active && d.key !== active ? 0.32 : 1;
        mesh.material.opacity += (targetOpacity - mesh.material.opacity) * ease;

        // Animate satellite 3D orb
        const orbDist = OUTER_R + 0.2 + radialOffset * 1.1;
        d.satOrb.position.set(
          Math.cos(d.mid) * orbDist,
          Math.sin(d.mid) * orbDist,
          DEPTH * 0.65 + d.lift * 0.14 + (reduceMotion ? 0 : Math.sin(t * 2.5 + i) * 0.04)
        );
        if (!reduceMotion) {
          d.satOrb.rotation.z = t * 1.2 + i;
          d.satOrb.rotation.x = t * 0.9;
        }
        const orbScale = 1 + d.lift * 0.45;
        d.satOrb.scale.setScalar(orbScale);
      });

      const centerHover = hoveredKey === "__CENTER__" ? 1.08 : 1;
      centerDisk.scale.lerp(new THREE.Vector3(centerHover, centerHover, 1), 0.15);
      centerDiskMat.emissiveIntensity = hoveredKey === "__CENTER__" ? 0.22 : 0.06;

      renderer.render(scene, camera);
      frame = requestAnimationFrame(step);
    };

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = `${width}px`;
      renderer.domElement.style.height = `${height}px`;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("click", onClick as EventListener);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose());
          else object.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  return (
    <div ref={hostRef} className={className}>
      {hoveredInfo && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "-6px",
            transform: "translateX(-50%)",
            zIndex: 10,
            padding: "5px 11px",
            borderRadius: "999px",
            background: "rgba(15, 23, 42, 0.92)",
            color: "#f8fafc",
            fontSize: "11.5px",
            fontWeight: 700,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 8px 20px rgba(15, 23, 42, 0.25)",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: hoveredInfo.color,
              flexShrink: 0,
            }}
          />
          <span>{hoveredInfo.label}:</span>
          <strong style={{ color: "#38bdf8" }}>
            {hoveredInfo.value.toLocaleString("en-US")} คน ({hoveredInfo.pct}%)
          </strong>
        </div>
      )}
    </div>
  );
}
