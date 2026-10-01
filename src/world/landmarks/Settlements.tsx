import { BallCollider, CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { PADS, padTop } from "../../game/world";
import Distant from "./Distant";

const padAt = (x: number, z: number) => PADS.find(pad => pad.x === x && pad.z === z)!;
const VILLAGE = padAt(-560, -180), DEN = padAt(500, -340), HIVES = padAt(330, 40), CITADEL = padAt(-340, 30);

/** Seeded jitter so settlements look hand-built but never change between visits. */
const jitter = (seed: number) => {
  const n = Math.sin(seed * 127.1) * 43758.5453;
  return n - Math.floor(n);
};

const HUTS = Array.from({ length: 9 }, (_, i) => {
  const angle = i / 9 * Math.PI * 2 + 0.2;
  return { x: VILLAGE.x + Math.cos(angle) * 25, z: VILLAGE.z + Math.sin(angle) * 25, r: 4.5 + jitter(i) * 2.5, facing: angle + Math.PI };
});

/** MudWing domes around the great mud hall. */
export function MudVillage() {
  const y = VILLAGE.height!;
  return <>
    <Distant x={VILLAGE.x} z={VILLAGE.z} range={700}>
      <mesh position={[VILLAGE.x, y, VILLAGE.z]} castShadow receiveShadow>
        <sphereGeometry args={[11, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#6b4f2c" roughness={1} />
      </mesh>
      <mesh position={[VILLAGE.x, y + 2.5, VILLAGE.z + 10.4]}>
        <boxGeometry args={[4, 5, 1.2]} />
        <meshStandardMaterial color="#1c140c" roughness={1} />
      </mesh>
      {HUTS.map((hut, i) => <group key={i} position={[hut.x, y, hut.z]} rotation={[0, -hut.facing + Math.PI / 2, 0]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[hut.r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={i % 2 ? "#7a5a33" : "#5f4527"} roughness={1} />
        </mesh>
        <mesh position={[0, 1.4, hut.r * 0.92]}>
          <boxGeometry args={[1.8, 2.8, 0.8]} />
          <meshStandardMaterial color="#1c140c" roughness={1} />
        </mesh>
      </group>)}
    </Distant>
    <RigidBody type="fixed" colliders={false}>
      <BallCollider args={[11]} position={[VILLAGE.x, y, VILLAGE.z]} />
      {HUTS.map((hut, i) => <BallCollider key={i} args={[hut.r]} position={[hut.x, y, hut.z]} />)}
    </RigidBody>
  </>;
}

const DEN_HALF = 36;
const DEN_HOUSES = Array.from({ length: 14 }, (_, i) => {
  const col = i % 4, row = Math.floor(i / 4);
  const w = 6 + jitter(i + 3) * 5, d = 6 + jitter(i + 9) * 5, h = 5 + jitter(i + 17) * 5;
  return { x: DEN.x - 22 + col * 14.5 + jitter(i) * 2, z: DEN.z - 24 + row * 13 + jitter(i + 1) * 2, w, d, h, dome: i % 5 === 2 };
}).filter(house => Math.hypot(house.x - DEN.x, house.z - DEN.z) > 9);
const AWNINGS = ["#c0392b", "#2f6fb0", "#e2b33c", "#8e44ad", "#27ae60", "#d35400"];

/** The Scorpion Den: a walled SandWing town of flat roofs, domes, awnings, and one tall watchtower. */
export function ScorpionDen() {
  const y = DEN.height!;
  const walls = [
    { x: DEN.x, z: DEN.z - DEN_HALF, length: DEN_HALF * 2, yaw: 0 },
    { x: DEN.x - DEN_HALF, z: DEN.z, length: DEN_HALF * 2, yaw: Math.PI / 2 },
    { x: DEN.x + DEN_HALF, z: DEN.z, length: DEN_HALF * 2, yaw: Math.PI / 2 },
    // The south wall has a gate.
    { x: DEN.x - DEN_HALF / 2 - 4, z: DEN.z + DEN_HALF, length: DEN_HALF - 8, yaw: 0 },
    { x: DEN.x + DEN_HALF / 2 + 4, z: DEN.z + DEN_HALF, length: DEN_HALF - 8, yaw: 0 },
  ];
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ({ x: DEN.x + sx * DEN_HALF, z: DEN.z + sz * DEN_HALF }));
  return <>
    <Distant x={DEN.x} z={DEN.z} range={760}>
      {walls.map((wall, i) => <mesh key={i} position={[wall.x, y + 5, wall.z]} rotation={[0, wall.yaw, 0]} castShadow receiveShadow>
        <boxGeometry args={[wall.length, 10, 3]} />
        <meshStandardMaterial color="#c9a46a" roughness={0.95} />
      </mesh>)}
      {corners.map((corner, i) => <mesh key={i} position={[corner.x, y + 8, corner.z]} castShadow>
        <cylinderGeometry args={[4.5, 5, 16, 10]} />
        <meshStandardMaterial color="#b98f58" roughness={0.95} />
      </mesh>)}
      {DEN_HOUSES.map((house, i) => <group key={i} position={[house.x, y, house.z]}>
        <mesh position={[0, house.h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[house.w, house.h, house.d]} />
          <meshStandardMaterial color={["#d8b885", "#c49a62", "#e0c592"][i % 3]} roughness={0.95} />
        </mesh>
        {house.dome && <mesh position={[0, house.h, 0]}>
          <sphereGeometry args={[Math.min(house.w, house.d) * 0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#e6d2a4" roughness={0.8} />
        </mesh>}
      </group>)}
      {AWNINGS.map((color, i) => <mesh key={color} position={[DEN.x - 15 + i * 6, y + 3.2, DEN.z + DEN_HALF - 9]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[4.6, 0.15, 3.4]} />
        <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>)}
      <mesh position={[DEN.x, y + 13, DEN.z]} castShadow>
        <cylinderGeometry args={[4.2, 5.4, 26, 12]} />
        <meshStandardMaterial color="#c49a62" roughness={0.9} />
      </mesh>
      <mesh position={[DEN.x, y + 26, DEN.z]}>
        <sphereGeometry args={[4.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e6b84a" metalness={0.6} roughness={0.35} />
      </mesh>
    </Distant>
    <RigidBody type="fixed" colliders={false}>
      {walls.map((wall, i) => <CuboidCollider key={i} args={[wall.length / 2, 5, 1.5]} position={[wall.x, y + 5, wall.z]} rotation={[0, wall.yaw, 0]} />)}
      {corners.map((corner, i) => <CylinderCollider key={i} args={[8, 5]} position={[corner.x, y + 8, corner.z]} />)}
      {DEN_HOUSES.map((house, i) => <CuboidCollider key={i} args={[house.w / 2, house.h / 2, house.d / 2]} position={[house.x, y + house.h / 2, house.z]} />)}
      <CylinderCollider args={[15, 5.4]} position={[DEN.x, y + 15, DEN.z]} />
    </RigidBody>
  </>;
}

const HIVE_TOWERS = [
  { dx: -14, dz: -9, segments: [16, 14, 12, 10] },
  { dx: 13, dz: -12, segments: [18, 16, 14, 12, 8] },
  { dx: 15, dz: 12, segments: [14, 12, 10] },
  { dx: -12, dz: 14, segments: [15, 13, 12, 9] },
];

/** Pantala's hive towers: stacked amber spires banded with honeycomb. */
export function HiveTowers() {
  const base = (x: number, z: number) => ({ x: HIVES.x + x, z: HIVES.z + z });
  const ground = padTop(HIVES.x, HIVES.z);
  return <>
    <Distant x={HIVES.x} z={HIVES.z} range={760}>
      {HIVE_TOWERS.map((tower, t) => {
        const at = base(tower.dx, tower.dz);
        let y = 0;
        return <group key={t} position={[at.x, ground, at.z]}>
          {tower.segments.map((height, i) => {
            const radius = 6.5 - i * 1.1;
            const center = y + height / 2;
            y += height;
            return <group key={i}>
              <mesh position={[0, center, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[radius * 0.82, radius, height, 6]} />
                <meshStandardMaterial color={i % 2 ? "#5a3a1a" : "#c98a2b"} roughness={0.75} />
              </mesh>
              <mesh position={[0, center + height / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[radius * 0.86, 0.5, 6, 6]} />
                <meshStandardMaterial color="#e8b84a" emissive="#7a4a10" emissiveIntensity={0.4} roughness={0.5} />
              </mesh>
            </group>;
          })}
          <mesh position={[0, y + 5, 0]}>
            <coneGeometry args={[2.4, 10, 6]} />
            <meshStandardMaterial color="#c98a2b" roughness={0.7} />
          </mesh>
        </group>;
      })}
    </Distant>
    <RigidBody type="fixed" colliders={false}>
      {HIVE_TOWERS.map((tower, t) => {
        const at = base(tower.dx, tower.dz);
        const height = tower.segments.reduce((sum, value) => sum + value, 0) + 10;
        return <CylinderCollider key={t} args={[height / 2, 5.5]} position={[at.x, ground + height / 2, at.z]} />;
      })}
    </RigidBody>
  </>;
}

const CITADEL_WALLS = Array.from({ length: 10 }, (_, i) => {
  const angle = i / 10 * Math.PI * 2;
  return { angle, height: 3 + jitter(i + 40) * 10, broken: i === 3 || i === 7 };
}).filter(wall => !wall.broken);
const CITADEL_TOWERS = [
  { angle: 0.6, height: 26, roof: true },
  { angle: 2.7, height: 13, roof: false },
  { angle: 4.6, height: 8, roof: false },
];

/** A ruined basalt citadel: broken walls, toppled columns, and one tower still standing. */
export function Citadel() {
  const y = padTop(CITADEL.x, CITADEL.z);
  const ring = 28;
  const at = (angle: number, radius = ring) => ({ x: CITADEL.x + Math.cos(angle) * radius, z: CITADEL.z + Math.sin(angle) * radius });
  const segment = 2 * ring * Math.sin(Math.PI / 10);
  return <>
    <Distant x={CITADEL.x} z={CITADEL.z} range={760}>
      {CITADEL_WALLS.map((wall, i) => {
        const p = at(wall.angle);
        return <mesh key={i} position={[p.x, y + wall.height / 2, p.z]} rotation={[0, -wall.angle + Math.PI / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[segment, wall.height, 2.6]} />
          <meshStandardMaterial color={i % 2 ? "#4a535a" : "#5c666d"} roughness={0.95} />
        </mesh>;
      })}
      {CITADEL_TOWERS.map((tower, i) => {
        const p = at(tower.angle, ring - 2);
        return <group key={i} position={[p.x, y, p.z]}>
          <mesh position={[0, tower.height / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[4.4, 5.2, tower.height, 8]} />
            <meshStandardMaterial color="#3a4248" roughness={0.95} />
          </mesh>
          {tower.roof && <mesh position={[0, tower.height + 6, 0]} castShadow>
            <coneGeometry args={[5.6, 12, 8]} />
            <meshStandardMaterial color="#2c3236" roughness={0.8} />
          </mesh>}
        </group>;
      })}
      {/* The great gate still stands, facing the sea. */}
      <group position={[CITADEL.x, y, CITADEL.z + ring + 1]}>
        {[-7, 7].map(dx => <mesh key={dx} position={[dx, 8, 0]} castShadow>
          <boxGeometry args={[3.4, 16, 3.4]} />
          <meshStandardMaterial color="#5c666d" roughness={0.95} />
        </mesh>)}
        <mesh position={[0, 16, 0]}>
          <torusGeometry args={[7, 1.7, 6, 18, Math.PI]} />
          <meshStandardMaterial color="#4a535a" roughness={0.95} />
        </mesh>
      </group>
      {[0.3, 1.9, 3.6].map((angle, i) => {
        const p = at(angle, 12);
        return <mesh key={i} position={[p.x, y + 1.2, p.z]} rotation={[0, angle, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[1.2, 1.2, 9 + i * 2, 10]} />
          <meshStandardMaterial color="#6b747a" roughness={0.9} />
        </mesh>;
      })}
    </Distant>
    <RigidBody type="fixed" colliders={false}>
      {CITADEL_WALLS.map((wall, i) => {
        const p = at(wall.angle);
        return <CuboidCollider key={i} args={[segment / 2, wall.height / 2, 1.3]} position={[p.x, y + wall.height / 2, p.z]} rotation={[0, -wall.angle + Math.PI / 2, 0]} />;
      })}
      {CITADEL_TOWERS.map((tower, i) => {
        const p = at(tower.angle, ring - 2);
        const height = tower.height + (tower.roof ? 12 : 0);
        return <CylinderCollider key={i} args={[height / 2, 5.2]} position={[p.x, y + height / 2, p.z]} />;
      })}
      {[-7, 7].map(dx => <CuboidCollider key={dx} args={[1.7, 8, 1.7]} position={[CITADEL.x + dx, y + 8, CITADEL.z + ring + 1]} />)}
    </RigidBody>
  </>;
}
