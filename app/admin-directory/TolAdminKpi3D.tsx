'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import styles from './page.module.css';

export type FunctionItem = {
  key: string;
  label: string;
  tone: 'both' | 'install' | 'repair' | 'none';
  count: number;
};

type Props = {
  totalAdmins: number;
  filteredAdminsCount: number;
  totalDepots: number;
  filteredDepotsCount: number;
  functions: FunctionItem[];
  totalFunctionStaff: number;
  selectedFunction: string | null;
  onSelectFunction: (fnKey: string | null) => void;
  sortByDepot: boolean;
  onToggleSortByDepot: () => void;
};

const TONE_COLORS: Record<FunctionItem['tone'], string> = {
  both: '#6366f1',
  install: '#0ea5e9',
  repair: '#f59e0b',
  none: '#94a3b8',
};

const OUTER_R = 1.22;
const INNER_R = 0.74;
const DEPTH = 0.28;
const MIN_ARC = 0.045;
const GAP = 0.035;

function arcShape(a0: number, a1: number) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, OUTER_R, a0, a1, false);
  shape.absarc(0, 0, INNER_R, a1, a0, true);
  shape.closePath();
  return shape;
}

function arcFractions(values: number[]) {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v > 0 ? Math.max(v / total, MIN_ARC) : 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((f) => f / sum);
}

/**
 * Card 1 Three.js Scene: Interactive 3D Person Icon inside a Rotating Circle
 */
export function AdminCore3D({
  active,
  onTrigger,
}: {
  active: boolean;
  onTrigger: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const onTriggerRef = useRef(onTrigger);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    camera.position.set(0, 0, 3.7);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(2.2, 2.5, 4.5);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x60a5fa, 2.2, 10);
    rimLight.position.set(-2.2, -1.5, 3.0);
    scene.add(rimLight);

    const group = new THREE.Group();
    scene.add(group);

    // Circular medallion coin backing
    const coinGeo = new THREE.CylinderGeometry(0.84, 0.84, 0.12, 64);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.25,
      metalness: 0.3,
      emissive: new THREE.Color(0x1e40af),
      emissiveIntensity: 0.2,
    });
    const coinMesh = new THREE.Mesh(coinGeo, coinMat);
    group.add(coinMesh);

    // 3D Person silhouette material (crisp white/ice-blue)
    const personMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.15,
      emissive: new THREE.Color(0x93c5fd),
      emissiveIntensity: 0.25,
    });

    // Helper to build a 3D person icon on front & back of the rotating circle
    const createPersonSide = (zSign: number) => {
      const sideGroup = new THREE.Group();
      // Head
      const headGeo = new THREE.SphereGeometry(0.22, 32, 32);
      const headMesh = new THREE.Mesh(headGeo, personMat);
      headMesh.scale.set(1, 1, 0.65);
      headMesh.position.set(0, 0.24, zSign * 0.08);
      sideGroup.add(headMesh);

      // Shoulders / Torso dome
      const bodyGeo = new THREE.SphereGeometry(
        0.4,
        32,
        24,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.52
      );
      const bodyMesh = new THREE.Mesh(bodyGeo, personMat);
      bodyMesh.scale.set(1.05, 0.9, 0.55);
      bodyMesh.position.set(0, -0.42, zSign * 0.08);
      sideGroup.add(bodyMesh);

      return { sideGroup, headMesh, bodyMesh };
    };

    const frontPerson = createPersonSide(1);
    const backPerson = createPersonSide(-1);
    group.add(frontPerson.sideGroup);
    group.add(backPerson.sideGroup);

    // Outer rotating circle ring + orbiting nodes
    const ringGroup = new THREE.Group();
    group.add(ringGroup);

    const ringGeo = new THREE.TorusGeometry(1.02, 0.065, 20, 72);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.22,
      metalness: 0.45,
      emissive: new THREE.Color(0x2563eb),
      emissiveIntensity: 0.28,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringGroup.add(ringMesh);

    const nodeGeo = new THREE.SphereGeometry(0.11, 20, 20);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      roughness: 0.15,
      metalness: 0.3,
      emissive: new THREE.Color(0x3b82f6),
      emissiveIntensity: 0.45,
    });
    const nodes: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const node = new THREE.Mesh(nodeGeo, nodeMat);
      node.position.set(Math.cos(angle) * 1.02, Math.sin(angle) * 1.02, 0);
      ringGroup.add(node);
      nodes.push(node);
    }

    const hitTargets = [
      coinMesh,
      frontPerson.headMesh,
      frontPerson.bodyMesh,
      backPerson.headMesh,
      backPerson.bodyMesh,
      ringMesh,
      ...nodes,
    ];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let isHovered = false;
    let pointerX = 0;
    let pointerY = 0;

    const checkHit = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      pointerX = pointer.x;
      pointerY = pointer.y;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(hitTargets, false).length > 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      const hit = checkHit(event);
      if (hit !== isHovered) {
        isHovered = hit;
        setHovered(hit);
        renderer.domElement.style.cursor = hit ? 'pointer' : 'default';
      }
    };

    const onPointerLeave = () => {
      isHovered = false;
      pointerX = 0;
      pointerY = 0;
      setHovered(false);
      renderer.domElement.style.cursor = 'default';
    };

    const onClick = (event: PointerEvent) => {
      if (checkHit(event)) {
        event.stopPropagation();
        onTriggerRef.current();
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('click', onClick);

    let frameId = 0;
    const clock = new THREE.Clock();
    let currentScale = 1;

    const animate = () => {
      const t = clock.getElapsedTime();
      const speed = isHovered ? 1.8 : 1.0;

      if (!reduceMotion) {
        // Rotate the outer circle ring continuously + gentle 3D coin rotation
        ringGroup.rotation.z = -t * 0.95 * speed;
        group.rotation.y = Math.sin(t * 1.1) * 0.42 + pointerX * 0.35;
        group.rotation.x = Math.cos(t * 0.85) * 0.12 - pointerY * 0.25;
        group.position.y = Math.sin(t * 2.0) * 0.04;
      }

      const targetScale = isHovered ? 1.12 : activeRef.current ? 1.04 : 0.96;
      currentScale += (targetScale - currentScale) * 0.12;
      group.scale.setScalar(currentScale);

      coinMat.emissiveIntensity = isHovered ? 0.42 : activeRef.current ? 0.24 : 0.14;
      ringMat.emissiveIntensity = isHovered ? 0.55 : 0.28;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
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
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('click', onClick);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={`${styles.kpi3dMiniStage} ${hovered ? styles.kpi3dStageHovered : ''}`}
      title="คลิกเพื่อแสดงแอดมินทั้งหมด"
    />
  );
}

/**
 * Card 2 Three.js Scene: Interactive 3D Teal Hexagonal Depot Network Cluster
 */
export function DepotCluster3D({
  active,
  onTrigger,
}: {
  active: boolean;
  onTrigger: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const onTriggerRef = useRef(onTrigger);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    camera.position.set(0, -2.5, 3.2);
    camera.lookAt(0, 0.05, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
    keyLight.position.set(2.5, -3, 4.5);
    scene.add(keyLight);
    const tealLight = new THREE.PointLight(0x2dd4bf, 2.4, 10);
    tealLight.position.set(-2, 2, 3);
    scene.add(tealLight);

    const group = new THREE.Group();
    scene.add(group);

    // Base platform ring
    const baseGeo = new THREE.CylinderGeometry(1.05, 1.12, 0.12, 24);
    baseGeo.rotateX(Math.PI / 2);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xccfbf1,
      roughness: 0.4,
      metalness: 0.2,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.z = -0.38;
    group.add(baseMesh);

    // 7 hexagonal depot towers in a honeycomb cluster
    const hexPositions: Array<[number, number, number, number]> = [
      [0, 0, 0.95, 0x0d9488],
      [0.52, 0, 0.68, 0x14b8a6],
      [-0.52, 0, 0.74, 0x14b8a6],
      [0.26, 0.45, 0.62, 0x2dd4bf],
      [-0.26, 0.45, 0.58, 0x0f766e],
      [0.26, -0.45, 0.78, 0x0f766e],
      [-0.26, -0.45, 0.64, 0x2dd4bf],
    ];

    const pillars: Array<{
      mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
      baseH: number;
      phase: number;
    }> = [];

    hexPositions.forEach(([x, y, h, col], idx) => {
      const geo = new THREE.CylinderGeometry(0.21, 0.21, h, 6);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.25,
        metalness: 0.25,
        emissive: new THREE.Color(col),
        emissiveIntensity: 0.14,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, -0.32 + h / 2);
      group.add(mesh);
      pillars.push({ mesh, baseH: h, phase: idx * 0.85 });
    });

    const hitTargets = [baseMesh, ...pillars.map((p) => p.mesh)];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let isHovered = false;
    let pointerX = 0;
    let pointerY = 0;

    const checkHit = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      pointerX = pointer.x;
      pointerY = pointer.y;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(hitTargets, false).length > 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      const hit = checkHit(event);
      if (hit !== isHovered) {
        isHovered = hit;
        setHovered(hit);
        renderer.domElement.style.cursor = hit ? 'pointer' : 'default';
      }
    };

    const onPointerLeave = () => {
      isHovered = false;
      pointerX = 0;
      pointerY = 0;
      setHovered(false);
      renderer.domElement.style.cursor = 'default';
    };

    const onClick = (event: PointerEvent) => {
      if (checkHit(event)) {
        event.stopPropagation();
        onTriggerRef.current();
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('click', onClick);

    let frameId = 0;
    const clock = new THREE.Clock();
    let currentScale = 1;

    const animate = () => {
      const t = clock.getElapsedTime();

      if (!reduceMotion) {
        group.rotation.z = t * (isHovered || activeRef.current ? 0.55 : 0.28);
        group.rotation.x += (-pointerY * 0.25 - group.rotation.x) * 0.08;
        group.rotation.y += (pointerX * 0.25 - group.rotation.y) * 0.08;

        pillars.forEach((p) => {
          const wave = 1 + Math.sin(t * 2.4 + p.phase) * (isHovered ? 0.22 : 0.1);
          p.mesh.scale.z = wave;
          p.mesh.position.z = -0.32 + (p.baseH * wave) / 2;
          p.mesh.material.emissiveIntensity = isHovered
            ? 0.42
            : activeRef.current
              ? 0.3
              : 0.14;
        });
      }

      const targetScale = isHovered ? 1.12 : activeRef.current ? 1.06 : 0.98;
      currentScale += (targetScale - currentScale) * 0.12;
      group.scale.setScalar(currentScale);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
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
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('click', onClick);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={`${styles.kpi3dMiniStage} ${hovered ? styles.kpi3dStageHovered : ''}`}
      title="คลิกวัตถุ 3D เพื่อเรียงตารางตามจำนวน Depot"
    />
  );
}

type SliceMesh = THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial> & {
  userData: {
    key: string;
    label: string;
    count: number;
    pct: number;
    mid: number;
    grow: number;
    lift: number;
  };
};

/**
 * Card 3 Three.js Scene: Interactive 3D Function Breakdown Ring + Center Core
 */
function FunctionRing3D({
  functions,
  total,
  selectedFunction,
  onSelectFunction,
}: {
  functions: FunctionItem[];
  total: number;
  selectedFunction: string | null;
  onSelectFunction: (fnKey: string | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selectedFunction);
  const onSelectRef = useRef(onSelectFunction);
  const [hoveredSlice, setHoveredSlice] = useState<{
    label: string;
    count: number;
    pct: number;
  } | null>(null);

  useEffect(() => {
    selectedRef.current = selectedFunction;
  }, [selectedFunction]);

  useEffect(() => {
    onSelectRef.current = onSelectFunction;
  }, [onSelectFunction]);

  const dataKey = functions.map((f) => `${f.key}:${f.count}`).join('|');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, -3.1, 4.1);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
    keyLight.position.set(2.2, -3, 5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xc4b5fd, 1.1);
    rimLight.position.set(-3, 2.5, 2.5);
    scene.add(rimLight);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Subtle base track ring
    const trackMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(arcShape(0, Math.PI * 2), {
        depth: DEPTH * 0.3,
        bevelEnabled: false,
        curveSegments: 72,
      }),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.85 })
    );
    trackMesh.position.z = -0.04;
    rootGroup.add(trackMesh);

    // Clickable center crystal hub (resets filter when clicked)
    const centerHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 0.16, 32).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.3,
        metalness: 0.15,
        emissive: new THREE.Color(0x6366f1),
        emissiveIntensity: 0.08,
      })
    );
    centerHub.userData = { isCenterHub: true };
    rootGroup.add(centerHub);

    const activeFunctions = functions.filter((f) => f.count > 0);
    const fractions = arcFractions(activeFunctions.map((f) => f.count));
    const meshes: SliceMesh[] = [];
    let cursor = Math.PI / 2;

    activeFunctions.forEach((fn, idx) => {
      const sweep = fractions[idx] * Math.PI * 2;
      if (sweep <= 0) return;
      const a1 = cursor - GAP / 2;
      const a0 = cursor - sweep + GAP / 2;
      cursor -= sweep;

      const geo = new THREE.ExtrudeGeometry(arcShape(a0, a1), {
        depth: DEPTH,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.028,
        bevelSegments: 3,
        curveSegments: Math.max(10, Math.round(sweep * 42)),
      });

      const colorHex = TONE_COLORS[fn.tone];
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.28,
        metalness: 0.18,
        emissive: new THREE.Color(colorHex),
        emissiveIntensity: 0.08,
        transparent: true,
        opacity: 1,
      });

      const mesh = new THREE.Mesh(geo, mat) as SliceMesh;
      const pct = total > 0 ? Math.round((fn.count / total) * 100) : 0;
      mesh.userData = {
        key: fn.key,
        label: fn.label,
        count: fn.count,
        pct,
        mid: (a0 + a1) / 2,
        grow: reduceMotion ? 1 : 0.01,
        lift: 0,
      };
      mesh.scale.z = mesh.userData.grow;
      rootGroup.add(mesh);
      meshes.push(mesh);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoveredKey: string | null = null;
    let pointerX = 0;
    let pointerY = 0;

    const pickObject = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      pointerX = pointer.x;
      pointerY = pointer.y;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...meshes, centerHub], false);
      if (hits.length === 0) return null;
      const obj = hits[0].object;
      if (obj === centerHub) return { type: 'center' as const };
      const slice = obj as SliceMesh;
      return { type: 'slice' as const, data: slice.userData };
    };

    const onPointerMove = (event: PointerEvent) => {
      const picked = pickObject(event);
      if (!picked) {
        if (hoveredKey !== null) {
          hoveredKey = null;
          setHoveredSlice(null);
        }
        renderer.domElement.style.cursor = 'default';
        return;
      }
      renderer.domElement.style.cursor = 'pointer';
      if (picked.type === 'center') {
        hoveredKey = '__CENTER__';
        setHoveredSlice({
          label: 'แสดงทั้งหมด (Reset)',
          count: total,
          pct: 100,
        });
      } else {
        if (hoveredKey !== picked.data.key) {
          hoveredKey = picked.data.key;
          setHoveredSlice({
            label: picked.data.label,
            count: picked.data.count,
            pct: picked.data.pct,
          });
        }
      }
    };

    const onPointerLeave = () => {
      hoveredKey = null;
      pointerX = 0;
      pointerY = 0;
      setHoveredSlice(null);
      renderer.domElement.style.cursor = 'default';
    };

    const onClick = (event: PointerEvent) => {
      const picked = pickObject(event);
      if (!picked) return;
      event.stopPropagation();
      if (picked.type === 'center') {
        onSelectRef.current(null);
      } else {
        const nextKey =
          selectedRef.current === picked.data.key ? null : picked.data.key;
        onSelectRef.current(nextKey);
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('click', onClick);

    let frameId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      const t = clock.getElapsedTime();
      const activeKey = selectedRef.current;

      if (!reduceMotion) {
        const targetRotY = pointerX * 0.32 + Math.sin(t * 0.9) * 0.08;
        const targetRotX = -pointerY * 0.25 + Math.cos(t * 0.7) * 0.06;
        rootGroup.rotation.y += (targetRotY - rootGroup.rotation.y) * 0.1;
        rootGroup.rotation.x += (targetRotX - rootGroup.rotation.x) * 0.1;
      }

      meshes.forEach((mesh) => {
        const d = mesh.userData;
        d.grow += (1 - d.grow) * 0.12;
        const isSelected = activeKey !== null && d.key === activeKey;
        const isHovered = hoveredKey === d.key;
        const targetLift = isSelected ? 1 : isHovered ? 0.65 : 0;
        d.lift += (targetLift - d.lift) * 0.15;

        mesh.scale.z = Math.max(d.grow, 0.01) * (1 + d.lift * 0.85);
        mesh.position.set(
          Math.cos(d.mid) * d.lift * 0.15,
          Math.sin(d.mid) * d.lift * 0.15,
          d.lift * 0.08
        );
        mesh.material.emissiveIntensity = 0.08 + d.lift * 0.35;
        const targetOpacity =
          activeKey !== null && d.key !== activeKey ? 0.35 : 1;
        mesh.material.opacity += (targetOpacity - mesh.material.opacity) * 0.15;
      });

      const centerScale = hoveredKey === '__CENTER__' ? 1.12 : 1;
      centerHub.scale.lerp(new THREE.Vector3(centerScale, centerScale, 1), 0.15);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
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
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('click', onClick);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [dataKey, total]);

  const activeFn = functions.find((f) => f.key === selectedFunction) ?? null;

  return (
    <div className={styles.fn3dContainer}>
      <div ref={hostRef} className={styles.fn3dCanvasHost} />
      <div className={styles.fn3dCenterOverlay}>
        <strong className={styles.fn3dCenterValue}>
          {(activeFn ? activeFn.count : total).toLocaleString()}
        </strong>
        <span className={styles.fn3dCenterLabel}>
          {activeFn ? activeFn.label : 'ทั้งหมด'}
        </span>
      </div>
      {hoveredSlice && (
        <div className={styles.fn3dTooltip} role="status">
          <strong>{hoveredSlice.label}</strong>
          <span>
            {hoveredSlice.count.toLocaleString()} คน ({hoveredSlice.pct}%)
          </span>
        </div>
      )}
    </div>
  );
}

export default function TolAdminKpi3D({
  filteredAdminsCount,
  filteredDepotsCount,
  functions,
  totalFunctionStaff,
  selectedFunction,
  onSelectFunction,
  sortByDepot,
  onToggleSortByDepot,
}: Props) {
  const isFiltered = selectedFunction !== null;

  return (
    <div className={styles.kpiGrid}>
      {/* Card 1: Total Admins with 3D Person in Rotating Circle */}
      <article
        className={`${styles.kpiCard} ${styles.kpiBlue} ${styles.kpiCardInteractive} ${
          !isFiltered && !sortByDepot ? styles.kpiCardSelectedBlue : ''
        }`}
        onClick={() => {
          if (isFiltered) onSelectFunction(null);
          if (sortByDepot) onToggleSortByDepot();
        }}
        role="button"
        tabIndex={0}
        aria-pressed={!isFiltered && !sortByDepot}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isFiltered) onSelectFunction(null);
            if (sortByDepot) onToggleSortByDepot();
          }
        }}
      >
        <div className={styles.kpiCardSplit}>
          <div className={styles.kpiCardContent}>
            <span className={styles.kpiLabel}>แอดมินทั้งหมด(คน)</span>
            <strong className={styles.kpiValue}>
              {filteredAdminsCount.toLocaleString()}
            </strong>
          </div>
          <AdminCore3D
            active={!isFiltered}
            onTrigger={() => {
              onSelectFunction(null);
              if (sortByDepot) onToggleSortByDepot();
            }}
          />
        </div>
      </article>

      {/* Card 2: Total Depots with 3D Depot Icon */}
      <article
        className={`${styles.kpiCard} ${styles.kpiTeal} ${styles.kpiCardInteractive} ${
          sortByDepot ? styles.kpiCardSelectedTeal : ''
        }`}
        onClick={onToggleSortByDepot}
        role="button"
        tabIndex={0}
        aria-pressed={sortByDepot}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleSortByDepot();
          }
        }}
      >
        <div className={styles.kpiCardSplit}>
          <div className={styles.kpiCardContent}>
            <span className={styles.kpiLabel}>จำนวน depot</span>
            <strong className={styles.kpiValue}>
              {filteredDepotsCount.toLocaleString()}
            </strong>
          </div>
          <DepotCluster3D active={sortByDepot} onTrigger={onToggleSortByDepot} />
        </div>
      </article>

      {/* Card 3: Function Breakdown with Interactive 3D Donut Ring & Clickable Slices */}
      <article className={`${styles.kpiCard} ${styles.kpiWide} ${styles.kpiWide3D}`}>
        <div className={styles.kpiWideLayout}>
          <FunctionRing3D
            functions={functions}
            total={totalFunctionStaff}
            selectedFunction={selectedFunction}
            onSelectFunction={onSelectFunction}
          />
          <div className={styles.kpiWideRight}>
            <div className={styles.kpiHeaderRow}>
              <span className={styles.kpiLabel}>แยกตามหน้าที่</span>
              {selectedFunction !== null && (
                <button
                  type="button"
                  className={styles.kpiResetChip}
                  onClick={() => onSelectFunction(null)}
                >
                  แสดงทั้งหมด ✕
                </button>
              )}
            </div>

            <div
              className={styles.fnBar}
              role="group"
              aria-label="สัดส่วนแอดมินแยกตามหน้าที่"
            >
              {functions
                .filter((f) => f.count > 0)
                .map((f) => {
                  const isSelected = selectedFunction === f.key;
                  const isDimmed =
                    selectedFunction !== null && selectedFunction !== f.key;
                  return (
                    <button
                      key={f.label}
                      type="button"
                      className={`${styles.fnBarSegment} ${styles[`fn_${f.tone}`]} ${
                        isSelected ? styles.fnBarSegmentActive : ''
                      } ${isDimmed ? styles.fnBarSegmentDimmed : ''}`}
                      style={{ flexGrow: f.count }}
                      title={`คลิกเพื่อกรอง ${f.label}: ${f.count.toLocaleString()} คน`}
                      onClick={() =>
                        onSelectFunction(
                          selectedFunction === f.key ? null : f.key
                        )
                      }
                    />
                  );
                })}
            </div>

            <ul className={styles.fnLegend}>
              {functions.map((f) => {
                const pct = totalFunctionStaff
                  ? Math.round((f.count / totalFunctionStaff) * 100)
                  : 0;
                const isSelected = selectedFunction === f.key;
                const isDimmed =
                  selectedFunction !== null && selectedFunction !== f.key;
                return (
                  <li key={f.label}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() =>
                        onSelectFunction(
                          selectedFunction === f.key ? null : f.key
                        )
                      }
                      className={`${styles.fnLegendButton} ${
                        isSelected ? styles.fnLegendButtonActive : ''
                      } ${isDimmed ? styles.fnLegendButtonDimmed : ''}`}
                    >
                      <span
                        className={`${styles.fnDot} ${styles[`fn_${f.tone}`]}`}
                        aria-hidden="true"
                      />
                      <span className={styles.fnName}>{f.label}</span>
                      <strong>{f.count.toLocaleString()}</strong>
                      <span className={styles.fnPct}>{pct}%</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </article>
    </div>
  );
}
