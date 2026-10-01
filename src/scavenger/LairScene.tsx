import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { LairDef, LairLight } from "../game/scavenger";
import { floorHeight } from "../game/scavenger";
import { renderingBudget } from "../game/rendering";
import { device } from "../utils/device";

function hash(n: number) {
  const value = Math.sin(n * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

function rockTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = 150 + Math.sin(x * 0.37 + Math.sin(y * 0.21) * 2) * 22 + Math.sin(y * 0.53 - x * 0.12) * 18 + (hash(x * 131 + y) - 0.5) * 34;
    const at = (y * size + x) * 4;
    data[at] = data[at + 1] = data[at + 2] = Math.max(0, Math.min(255, v));
    data[at + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function poolTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
    const at = (y * size + x) * 4;
    data[at] = data[at + 1] = data[at + 2] = 255;
    data[at + 3] = Math.round(255 * Math.max(0, 1 - d) ** 1.8);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

/** Shared by every lair (and reused across raids). */
const rock = rockTexture();
const pool = poolTexture();

function roughen(geometry: THREE.BufferGeometry, amount: number, seed: number) {
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const n = 1 + (Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 - seed) + Math.sin(y * 4.3 + seed * 2) * 0.5) * amount;
    positions.setXYZ(i, x * n, y, z * n);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function LightSource({ light, region, index, exit }: { light: LairLight; region: LairDef["region"]; index: number; exit: boolean }) {
  const lamp = useRef<THREE.PointLight>(null);
  const flame = useRef<THREE.Mesh>(null);
  const budget = renderingBudget(device);
  useFrame(state => {
    const t = state.clock.elapsedTime + index * 1.7;
    const flicker = region === "glaeryus" ? 1 + Math.sin(t * 1.3) * 0.05 : region === "pantala" ? 1 : 0.88 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23.7) * 0.05;
    if (lamp.current) lamp.current.intensity = light.intensity * (budget.constrained ? 22 : 30) * flicker;
    if (flame.current) flame.current.scale.set(1, flicker, 1);
  });
  const sun = region === "pantala" && !exit;
  return <group position={[light.x, 0, light.z]}>
    <pointLight ref={lamp} position={[0, sun ? 6 : 2.4, 0]} color={light.color} distance={light.r * 2.4} decay={1.4} />
    {/* The lit floor is the danger zone: dragons see you much further in it. */}
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <circleGeometry args={[light.r, 40]} />
      <meshBasicMaterial map={pool} color={light.color} transparent opacity={0.32 * light.intensity} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
    {exit ? <>
      <mesh position={[1.9, 1.1, -0.4]}><cylinderGeometry args={[0.03, 0.03, 2.2, 6]} /><meshStandardMaterial color="#4a3826" /></mesh>
      <mesh ref={flame} position={[1.9, 2.25, -0.4]}><sphereGeometry args={[0.18, 10, 8]} /><meshBasicMaterial color="#ffd88a" toneMapped={false} /></mesh>
    </> : sun ? <mesh position={[0, 8, 0]}>
      {/* A shaft of desert sun from a crack in the vault roof. */}
      <cylinderGeometry args={[light.r * 0.35, light.r * 0.8, 16, 20, 1, true]} />
      <meshBasicMaterial color={light.color} transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh> : region === "glaeryus" ? <group>
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[Math.sin(i * 1.9) * 0.45, 0.6 + i * 0.12, Math.cos(i * 1.9) * 0.45]} rotation={[Math.sin(i) * 0.4, i, Math.cos(i) * 0.35]} scale={[0.35, 1.1 + (i % 2) * 0.5, 0.35]}>
        <octahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color="#c9f1ff" emissive={light.color} emissiveIntensity={1.4} roughness={0.15} />
      </mesh>)}
    </group> : <group>
      <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.18, 0.28, 1.1, 10]} /><meshStandardMaterial color="#2b2622" roughness={0.8} metalness={0.4} /></mesh>
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.65, 0.3, 0.35, 14]} /><meshStandardMaterial color="#3b322b" roughness={0.7} metalness={0.5} /></mesh>
      <mesh ref={flame} position={[0, 1.75, 0]}><coneGeometry args={[0.45, 1.1, 10]} /><meshBasicMaterial color="#ffb347" toneMapped={false} /></mesh>
      <mesh position={[0, 1.6, 0]}><sphereGeometry args={[0.35, 10, 8]} /><meshBasicMaterial color="#fff1b0" toneMapped={false} /></mesh>
    </group>}
  </group>;
}

/** The burrow back home: a dark hole, a ladder, and a warm pulsing ring. */
function Burrow({ lair }: { lair: LairDef }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(state => {
    if (!ring.current) return;
    const pulse = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.25;
    (ring.current.material as THREE.MeshBasicMaterial).opacity = pulse;
  });
  return <group position={[lair.exit.x, 0, lair.exit.z]}>
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[lair.exit.r * 0.75, 28]} /><meshBasicMaterial color="#030201" /></mesh>
    <mesh ref={ring} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[lair.exit.r * 0.82, lair.exit.r, 40]} /><meshBasicMaterial color="#ffcf7a" transparent opacity={0.6} depthWrite={false} toneMapped={false} /></mesh>
    {Array.from({ length: 9 }, (_, i) => {
      const angle = i / 9 * Math.PI * 2;
      return <mesh key={i} position={[Math.sin(angle) * lair.exit.r * 1.15, 0.2, Math.cos(angle) * lair.exit.r * 1.15]} rotation={[i, i * 2, 0]} scale={[0.45, 0.32, 0.4]}>
        <icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#4b4136" roughness={1} />
      </mesh>;
    })}
    {/* Only the top of the ladder pokes out, on the wall side, so it never blocks the view. */}
    <group position={[0, 0, lair.exit.r * 0.45]} rotation={[0.35, 0, 0]}>
      {[-0.32, 0.32].map(x => <mesh key={x} position={[x, 0.3, 0]}><boxGeometry args={[0.07, 0.8, 0.07]} /><meshStandardMaterial color="#6b4a2b" /></mesh>)}
      {[0.15, 0.5].map(y => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[0.64, 0.05, 0.06]} /><meshStandardMaterial color="#7d5733" /></mesh>)}
    </group>
  </group>;
}

function GoldPile({ x, z, r, height, coins, seed }: { x: number; z: number; r: number; height: number; coins: number; seed: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const coin = useMemo(() => new THREE.CylinderGeometry(0.16, 0.16, 0.04, 10), []);
  useEffect(() => () => coin.dispose(), [coin]);
  useEffect(() => {
    if (!mesh.current) return;
    const object = new THREE.Object3D();
    for (let i = 0; i < coins; i++) {
      const angle = i * 2.39996 + seed;
      const radius = Math.sqrt(hash(i + seed * 7)) * r * 1.05;
      const surface = radius >= r ? 0 : height * Math.sqrt(1 - (radius / r) ** 2);
      object.position.set(x + Math.sin(angle) * radius, surface + 0.02, z + Math.cos(angle) * radius);
      object.rotation.set((hash(i * 3 + seed) - 0.5) * 1.2, angle, (hash(i * 5 + seed) - 0.5) * 1.2);
      object.updateMatrix();
      mesh.current.setMatrixAt(i, object.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [coins, height, r, seed, x, z]);
  return <>
    <mesh position={[x, -0.02, z]} scale={[r, height, r]}>
      <sphereGeometry args={[1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#d9a531" roughness={0.36} metalness={0.3} emissive="#4a3000" emissiveIntensity={0.35} />
    </mesh>
    <instancedMesh ref={mesh} args={[coin, undefined, coins]}>
      <meshStandardMaterial color="#f6cb52" roughness={0.3} metalness={0.35} emissive="#5b3d00" emissiveIntensity={0.4} />
    </instancedMesh>
  </>;
}

function BonePile({ x, z, r, seed }: { x: number; z: number; r: number; seed: number }) {
  return <group position={[x, 0, z]}>
    {Array.from({ length: 6 }, (_, i) => {
      const angle = i * 2.1 + seed;
      const radius = hash(i + seed) * r * 0.8;
      return <group key={i} position={[Math.sin(angle) * radius, 0.08, Math.cos(angle) * radius]} rotation={[0, angle * 1.7, Math.PI / 2]}>
        <mesh><cylinderGeometry args={[0.05, 0.05, 0.7 + hash(i * 3) * 0.5, 6]} /><meshStandardMaterial color="#d8d0bc" roughness={0.9} /></mesh>
        <mesh position={[0, 0.4, 0]}><sphereGeometry args={[0.09, 6, 5]} /><meshStandardMaterial color="#d8d0bc" roughness={0.9} /></mesh>
      </group>;
    })}
    <mesh position={[0.2, 0.18, 0.1]} scale={[1, 0.85, 1.15]}><sphereGeometry args={[0.2, 10, 8]} /><meshStandardMaterial color="#e2dac6" roughness={0.85} /></mesh>
  </group>;
}

export default function LairScene({ lair }: { lair: LairDef }) {
  const pillarMesh = useRef<THREE.InstancedMesh>(null);
  const stalactiteMesh = useRef<THREE.InstancedMesh>(null);
  const domeHeight = lair.radius * 0.62;
  const geometries = useMemo(() => {
    const dome = roughen(new THREE.SphereGeometry(lair.radius + 1.5, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2), 0.05, 3);
    const pillar = roughen(new THREE.CylinderGeometry(0.42, 1, 1, 10, 6), 0.12, 7).translate(0, 0.5, 0);
    const stalactite = roughen(new THREE.ConeGeometry(1, 1, 9, 4), 0.1, 11).rotateX(Math.PI).translate(0, -0.5, 0);
    return { dome, pillar, stalactite };
  }, [lair.radius]);
  useEffect(() => () => Object.values(geometries).forEach(geometry => geometry.dispose()), [geometries]);

  const ceilingSpikes = useMemo(() => Array.from({ length: 26 }, (_, i) => {
    const angle = i * 2.39996;
    const radius = Math.sqrt(hash(i * 7.3)) * lair.radius * 0.85;
    return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius, r: 0.4 + hash(i) * 0.9, length: 1.5 + hash(i * 2.2) * 3.5 };
  }), [lair.radius]);

  useEffect(() => {
    const object = new THREE.Object3D();
    const color = new THREE.Color();
    lair.pillars.forEach((pillar, i) => {
      object.position.set(pillar.x, -0.1, pillar.z);
      object.rotation.set(0, i * 1.3, 0);
      object.scale.set(pillar.r, 4.5 + hash(i * 3.1) * 4, pillar.r);
      object.updateMatrix();
      pillarMesh.current?.setMatrixAt(i, object.matrix);
      pillarMesh.current?.setColorAt(i, color.set(lair.palette.pillar).multiplyScalar(0.8 + hash(i) * 0.35));
    });
    const spikes = [...lair.pillars.map((pillar, i) => ({ x: pillar.x, z: pillar.z, r: pillar.r * 0.8, length: 3 + hash(i * 5.5) * 3 })), ...ceilingSpikes];
    spikes.forEach((spike, i) => {
      const dome = Math.sqrt(Math.max(0, 1 - (Math.hypot(spike.x, spike.z) / (lair.radius + 1.5)) ** 2)) * domeHeight;
      object.position.set(spike.x, dome + 0.3, spike.z);
      object.rotation.set(0, i * 0.7, 0);
      object.scale.set(spike.r, spike.length, spike.r);
      object.updateMatrix();
      stalactiteMesh.current?.setMatrixAt(i, object.matrix);
      stalactiteMesh.current?.setColorAt(i, color.set(lair.palette.pillar).multiplyScalar(0.6 + hash(i * 9) * 0.3));
    });
    for (const mesh of [pillarMesh.current, stalactiteMesh.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [lair, ceilingSpikes, domeHeight]);

  const nearExit = (light: LairLight) => Math.hypot(light.x - lair.exit.x, light.z - lair.exit.z) < 4;
  return <>
    <color attach="background" args={[lair.palette.fog]} />
    <fog attach="fog" args={[lair.palette.fog, 16, 62]} />
    <hemisphereLight args={["#a89a84", "#2a2218", lair.region === "glaeryus" ? 0.95 : 0.85]} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[lair.radius + 1.5, 72]} />
      <meshStandardMaterial color={lair.palette.floor} roughness={0.95} bumpMap={rock} bumpScale={0.6} />
    </mesh>
    <mesh geometry={geometries.dome} scale={[1, domeHeight / (lair.radius + 1.5), 1]}>
      <meshStandardMaterial color={lair.palette.wall} roughness={1} side={THREE.BackSide} bumpMap={rock} bumpScale={0.8} />
    </mesh>
    <instancedMesh ref={pillarMesh} args={[geometries.pillar, undefined, lair.pillars.length]} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.92} bumpMap={rock} bumpScale={0.5} />
    </instancedMesh>
    <instancedMesh ref={stalactiteMesh} args={[geometries.stalactite, undefined, lair.pillars.length + ceilingSpikes.length]}>
      <meshStandardMaterial roughness={0.95} />
    </instancedMesh>
    <GoldPile x={lair.hoard.x} z={lair.hoard.z} r={lair.hoard.r} height={floorHeight(lair, lair.hoard.x, lair.hoard.z)} coins={170} seed={1} />
    {lair.coins.map((pile, i) => <GoldPile key={i} x={pile.x} z={pile.z} r={pile.r} height={0.35} coins={26} seed={i + 4} />)}
    {lair.bones.map((pile, i) => <BonePile key={i} x={pile.x} z={pile.z} r={pile.r} seed={i * 3.7} />)}
    {lair.lights.map((light, i) => <LightSource key={i} light={light} region={lair.region} index={i} exit={nearExit(light)} />)}
    <Burrow lair={lair} />
  </>;
}
