import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createScatter, terrainHeight } from "../game/landscape";
import type { LandscapeKind } from "../game/landscape";
import { finalizeInstances, renderingBudget } from "../game/rendering";
import { device } from "../utils/device";

function pathGeometry(points: Array<[number, number]>, kind: LandscapeKind, width: number) {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    const previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    const dx = next[0] - previous[0], dz = next[1] - previous[1];
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const px = -dz / length * width, pz = dx / length * width;
    for (const side of [-1, 1]) vertices.push(x + px * side, terrainHeight(x + px * side, z + pz * side, kind) + 0.055, z + pz * side);
    if (i > 0) { const a = (i - 1) * 2, b = a + 1, c = i * 2, d = c + 1; indices.push(a, c, b, b, c, d); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function MountainBackdrop({ kind }: { kind: LandscapeKind }) {
  const mountains = useMemo(() => Array.from({ length: kind === "ridge" ? 26 : 34 }, (_, i) => {
    const angle = i / (kind === "ridge" ? 26 : 34) * Math.PI * 2;
    const radius = kind === "ridge" ? 142 + Math.sin(i * 2.7) * 12 : 228 + Math.sin(i * 1.9) * 18;
    const height = 24 + (Math.sin(i * 4.13) * 0.5 + 0.5) * 35;
    return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius, height, width: 15 + height * 0.35, rotation: angle };
  }), [kind]);
  const geometry = useMemo(() => {
    const ridge = new THREE.ConeGeometry(1, 1, 12, 7);
    const vertices = ridge.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
      const erosion = 1 + Math.sin(x * 7 + z * 4) * 0.16 + Math.cos(z * 9 - y * 6) * 0.12;
      vertices.setXYZ(i, x * erosion + (y + 0.5) * 0.1, y + Math.sin(x * 5 + z * 6) * 0.04, z * erosion);
    }
    ridge.computeVertexNormals();
    return ridge;
  }, []);
  const mesh = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const object = new THREE.Object3D();
    mountains.forEach((mountain, i) => {
      object.position.set(mountain.x, mountain.height * 0.42 - 3, mountain.z);
      object.scale.set(mountain.width, mountain.height, mountain.width * 0.72);
      object.rotation.set(0, mountain.rotation, 0);
      object.updateMatrix(); mesh.current?.setMatrixAt(i, object.matrix);
    });
    finalizeInstances(mesh.current);
  }, [mountains]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <instancedMesh ref={mesh} args={[geometry, undefined, mountains.length]} receiveShadow>
    <meshStandardMaterial color={kind === "ridge" ? "#5f6861" : "#657069"} roughness={1} />
  </instancedMesh>;
}

function Meadow({ kind }: { kind: LandscapeKind }) {
  const count = renderingBudget(device).grass;
  const scatter = useMemo(() => createScatter(kind, count, 442), [kind, count]);
  const grass = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    const shape = new THREE.BufferGeometry();
    shape.setAttribute("position", new THREE.Float32BufferAttribute([-0.13, 0, 0, 0, 1, 0, 0.13, 0, 0], 3));
    shape.setIndex([0, 1, 2]);
    shape.computeVertexNormals();
    return shape;
  }, []);
  useEffect(() => {
    const object = new THREE.Object3D();
    const color = new THREE.Color();
    scatter.forEach((item, i) => {
      object.position.set(item.x, item.y + 0.02, item.z);
      object.rotation.set(0, item.rotation, 0);
      object.scale.setScalar(item.scale);
      object.updateMatrix(); grass.current?.setMatrixAt(i, object.matrix);
      grass.current?.setColorAt(i, color.set(i % 4 === 0 ? "#9d9859" : "#6e8b4d").multiplyScalar(0.75 + (i % 11) * 0.025));
    });
    finalizeInstances(grass.current);
  }, [scatter]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <instancedMesh ref={grass} args={[geometry, undefined, count]} frustumCulled castShadow={false}>
    <meshStandardMaterial roughness={1} side={THREE.DoubleSide} />
  </instancedMesh>;
}

function RegionalLandmarks() {
  const formations = useMemo(() => Array.from({ length: 38 }, (_, i) => {
    const eastern = i % 2 === 0;
    const lane = Math.floor(i / 2);
    const x = (eastern ? 1 : -1) * (35 + (lane * 37 % 145));
    const z = 44 + (lane * 53 % 145);
    const height = 5 + (lane * 19 % 14);
    return { eastern, x, z, height, rotation: (lane * 2.17) % Math.PI };
  }), []);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 2), []);
  useEffect(() => {
    const object = new THREE.Object3D();
    const color = new THREE.Color();
    formations.forEach((formation, i) => {
      object.position.set(formation.x, terrainHeight(formation.x, formation.z, "open") + formation.height * 0.48, formation.z);
      object.rotation.set(formation.eastern ? 0.05 : -0.08, formation.rotation, formation.eastern ? 0.08 : -0.12);
      object.scale.set(formation.eastern ? 2.5 : 1.5, formation.height * 0.58, formation.eastern ? 3.4 : 1.15);
      object.updateMatrix(); rocks.current?.setMatrixAt(i, object.matrix);
      rocks.current?.setColorAt(i, color.set(formation.eastern ? "#9a684d" : "#586a72").multiplyScalar(0.78 + (i % 7) * 0.045));
    });
    finalizeInstances(rocks.current);
  }, [formations]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <instancedMesh ref={rocks} args={[geometry, undefined, formations.length]} castShadow receiveShadow>
    <meshStandardMaterial roughness={0.96} />
  </instancedMesh>;
}

function Lake() {
  const surface = useRef<THREE.Mesh>(null);
  const rippleA = useRef<THREE.Mesh>(null);
  const rippleB = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (surface.current) surface.current.position.y = -1.55 + Math.sin(time * 0.42) * 0.035;
    for (const [ripple, offset] of [[rippleA.current, 0], [rippleB.current, 0.5]] as const) {
      if (!ripple) continue;
      const phase = (time * 0.08 + offset) % 1;
      ripple.scale.setScalar(0.72 + phase * 0.32);
      (ripple.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.16;
    }
  });
  return <>
    <mesh ref={surface} position={[62, -1.55, -82]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[28, 64]} />
      <meshStandardMaterial color="#416e79" roughness={0.24} metalness={0.15} />
    </mesh>
    <mesh ref={rippleA} position={[62, -1.46, -82]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[22, 28, 64]} />
      <meshBasicMaterial color="#b3cfca" transparent opacity={0.12} depthWrite={false} />
    </mesh>
    <mesh ref={rippleB} position={[62, -1.45, -82]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[22, 28, 64]} />
      <meshBasicMaterial color="#b3cfca" transparent opacity={0.12} depthWrite={false} />
    </mesh>
  </>;
}

export default function WorldDetails({ kind }: { kind: LandscapeKind }) {
  const paths = useMemo(() => kind === "ridge" ? [
    pathGeometry([[0, 2], [-4, -10], [-15, -22], [-30, -30]], kind, 1.15),
    pathGeometry([[0, 2], [6, -13], [18, -26], [25, -40]], kind, 1.15),
    pathGeometry([[0, 2], [0, -18], [0, -42], [0, -55]], kind, 1.25),
  ] : [pathGeometry([[-5, 4], [-15, -28], [-28, -62], [-30, -100]], kind, 1.5)], [kind]);
  useEffect(() => () => paths.forEach(path => path.dispose()), [paths]);
  return <>
    <MountainBackdrop kind={kind} />
    <Meadow kind={kind} />
    {kind === "open" && <RegionalLandmarks />}
    {paths.map((geometry, index) => <mesh key={index} geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#8a7658" roughness={1} polygonOffset polygonOffsetFactor={-1} />
    </mesh>)}
    {kind === "open" && <Lake />}
  </>;
}
