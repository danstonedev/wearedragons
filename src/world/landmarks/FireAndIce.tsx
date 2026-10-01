import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { terrainHeight } from "../../game/landscape";
import { FROZEN_LAKE, PADS, SKY_PALACE, VOLCANO } from "../../game/world";
import Distant from "./Distant";
import { createAuroraMaterial, createLavaMaterial } from "./shaders";

const PLUME = 26;

/** The Sky Kingdom's volcano: a churning lava lake, glowing flows, and smoke you can see from home. */
export function Volcano() {
  const lava = useMemo(() => createLavaMaterial(), []);
  const flows = useMemo(() => [0.45, 2.35, 4.15].map(angle => {
    const points: THREE.Vector3[] = [];
    for (let r = VOLCANO.crater - 3; r <= 180; r += 8) {
      const bend = Math.sin(r * 0.07 + angle * 3) * 7;
      const x = VOLCANO.x + Math.cos(angle) * r - Math.sin(angle) * bend;
      const z = VOLCANO.z + Math.sin(angle) * r + Math.cos(angle) * bend;
      points.push(new THREE.Vector3(x, terrainHeight(x, z, "open") + 0.5, z));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 60, 2.4, 6, false);
  }), []);
  const plume = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => () => { lava.dispose(); flows.forEach(flow => flow.dispose()); }, [lava, flows]);
  useFrame(state => {
    const mesh = plume.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < PLUME; i++) {
      const phase = (t * 0.03 + i / PLUME) % 1;
      const size = 9 + phase * 42;
      dummy.position.set(VOLCANO.x + phase * 70 + Math.sin(i * 1.7) * 8, VOLCANO.lava + 18 + phase * 230, VOLCANO.z - phase * 25 + Math.cos(i * 2.3) * 8);
      dummy.scale.setScalar(size * (phase > 0.85 ? (1 - phase) / 0.15 : 1));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <>
    <Distant x={VOLCANO.x} z={VOLCANO.z} range={900}>
      <mesh position={[VOLCANO.x, VOLCANO.lava, VOLCANO.z]} rotation={[-Math.PI / 2, 0, 0]} material={lava}>
        <circleGeometry args={[21, 40]} />
      </mesh>
      {flows.map((flow, i) => <mesh key={i} geometry={flow} material={lava} />)}
      <mesh position={[VOLCANO.x, VOLCANO.lava + 6, VOLCANO.z]}>
        <sphereGeometry args={[30, 16, 10]} />
        <meshBasicMaterial color="#ff7a2a" transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </Distant>
    {/* Smoke is never fogged: the plume marks the north from anywhere on the continent. */}
    <instancedMesh ref={plume} args={[undefined, undefined, PLUME]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial color="#5d5652" transparent opacity={0.3} depthWrite={false} fog={false} />
    </instancedMesh>
  </>;
}

const PALACE_TOWERS = [22, 27, 20, 29, 24, 21];

/** The SkyWing palace: a red stone keep and towers on a cliff-walled summit. */
export function SkyPalace() {
  const top = SKY_PALACE.top;
  const towers = PALACE_TOWERS.map((height, i) => {
    const angle = i / PALACE_TOWERS.length * Math.PI * 2 + Math.PI / 2 + 0.3;
    return { x: SKY_PALACE.x + Math.cos(angle) * 30, z: SKY_PALACE.z + Math.sin(angle) * 30, height };
  });
  const walls = towers.map((tower, i) => {
    const next = towers[(i + 1) % towers.length];
    return { x: (tower.x + next.x) / 2, z: (tower.z + next.z) / 2, length: Math.hypot(next.x - tower.x, next.z - tower.z), yaw: -Math.atan2(next.z - tower.z, next.x - tower.x) };
  }).filter((_, i) => i !== 5); // A gate faces the heartland.
  return <>
    <Distant x={SKY_PALACE.x} z={SKY_PALACE.z} range={820}>
      <mesh position={[SKY_PALACE.x, top + 18, SKY_PALACE.z]} castShadow receiveShadow>
        <cylinderGeometry args={[7, 9, 36, 12]} />
        <meshStandardMaterial color="#b4483a" roughness={0.85} />
      </mesh>
      <mesh position={[SKY_PALACE.x, top + 43, SKY_PALACE.z]} castShadow>
        <coneGeometry args={[10.5, 16, 12]} />
        <meshStandardMaterial color="#7a1f1f" roughness={0.7} />
      </mesh>
      <mesh position={[SKY_PALACE.x, top + 36.5, SKY_PALACE.z]}>
        <torusGeometry args={[9.6, 0.7, 6, 24]} />
        <meshStandardMaterial color="#e0b84a" metalness={0.6} roughness={0.35} />
      </mesh>
      {towers.map((tower, i) => <group key={i} position={[tower.x, top, tower.z]}>
        <mesh position={[0, tower.height / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[3.2, 3.9, tower.height, 10]} />
          <meshStandardMaterial color="#a8423a" roughness={0.85} />
        </mesh>
        <mesh position={[0, tower.height + 4.5, 0]} castShadow>
          <coneGeometry args={[4.6, 9, 10]} />
          <meshStandardMaterial color="#7a1f1f" roughness={0.7} />
        </mesh>
        <mesh position={[0, tower.height + 9.5, 0]}>
          <boxGeometry args={[0.25, 3, 2.2]} />
          <meshStandardMaterial color="#e0b84a" metalness={0.4} roughness={0.5} />
        </mesh>
      </group>)}
      {walls.map((wall, i) => <mesh key={i} position={[wall.x, top + 4.5, wall.z]} rotation={[0, wall.yaw, 0]} castShadow receiveShadow>
        <boxGeometry args={[wall.length, 9, 2.4]} />
        <meshStandardMaterial color="#9e3d33" roughness={0.9} />
      </mesh>)}
    </Distant>
    <RigidBody type="fixed" colliders={false}>
      <CylinderCollider args={[18, 9]} position={[SKY_PALACE.x, top + 18, SKY_PALACE.z]} />
      <CylinderCollider args={[8, 8]} position={[SKY_PALACE.x, top + 43, SKY_PALACE.z]} />
      {towers.map((tower, i) => <CylinderCollider key={i} args={[tower.height / 2 + 4, 3.9]} position={[tower.x, top + tower.height / 2 + 4, tower.z]} />)}
      {walls.map((wall, i) => <CuboidCollider key={i} args={[wall.length / 2, 4.5, 1.2]} position={[wall.x, top + 4.5, wall.z]} rotation={[0, wall.yaw, 0]} />)}
    </RigidBody>
  </>;
}

const ICE_PAD = PADS.find(pad => pad.height === 30)!;
const ICE_TOWERS = [18, 30, 22, 36, 20, 28, 24, 33];

/** The IceWing palace: a crystal spire ringed by glassy towers. */
export function IcePalace() {
  const base = ICE_PAD.height!;
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: "#cfefff", emissive: "#3f98d8", emissiveIntensity: 0.35, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.9 }), []);
  useEffect(() => () => material.dispose(), [material]);
  const towers = ICE_TOWERS.map((height, i) => {
    const angle = i / ICE_TOWERS.length * Math.PI * 2;
    return { x: ICE_PAD.x + Math.cos(angle) * 30, z: ICE_PAD.z + Math.sin(angle) * 30, height, angle };
  });
  return <>
    <Distant x={ICE_PAD.x} z={ICE_PAD.z} range={820}>
      <mesh position={[ICE_PAD.x, base + 26, ICE_PAD.z]} material={material} castShadow>
        <cylinderGeometry args={[4.5, 6.5, 52, 6]} />
      </mesh>
      <mesh position={[ICE_PAD.x, base + 59, ICE_PAD.z]} material={material}>
        <coneGeometry args={[4.5, 14, 6]} />
      </mesh>
      {towers.map((tower, i) => <group key={i} position={[tower.x, base, tower.z]} rotation={[Math.sin(tower.angle) * 0.07, 0, -Math.cos(tower.angle) * 0.07]}>
        <mesh position={[0, tower.height / 2, 0]} material={material} castShadow>
          <cylinderGeometry args={[2.2, 3.4, tower.height, 6]} />
        </mesh>
        <mesh position={[0, tower.height + 3, 0]} material={material}>
          <coneGeometry args={[2.2, 6, 6]} />
        </mesh>
      </group>)}
    </Distant>
    <RigidBody type="fixed" colliders={false}>
      <CylinderCollider args={[33, 6.5]} position={[ICE_PAD.x, base + 33, ICE_PAD.z]} />
      {towers.map((tower, i) => <CylinderCollider key={i} args={[tower.height / 2 + 3, 3.4]} position={[tower.x, base + tower.height / 2 + 3, tower.z]} />)}
    </RigidBody>
  </>;
}

/** A lake frozen solid for a thousand years. */
export function FrozenLake() {
  return <Distant x={FROZEN_LAKE.x} z={FROZEN_LAKE.z} range={760}>
    <mesh position={[FROZEN_LAKE.x, FROZEN_LAKE.level, FROZEN_LAKE.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[FROZEN_LAKE.radius + 3, 56]} />
      <meshStandardMaterial color="#d6ecf7" roughness={0.12} metalness={0.25} />
    </mesh>
  </Distant>;
}

/** Curtains of northern light over the Ice Kingdom, visible from far to the south. */
export function Aurora() {
  const material = useMemo(() => createAuroraMaterial(), []);
  const ribbons = useMemo(() => [0, 1, 2].map(i => {
    const geometry = new THREE.PlaneGeometry(760, 120, 72, 1);
    const position = geometry.attributes.position;
    for (let v = 0; v < position.count; v++) {
      const x = position.getX(v);
      position.setZ(v, Math.sin(x * 0.009 + i * 1.7) * 70 + Math.sin(x * 0.023 + i) * 18);
    }
    geometry.computeBoundingSphere();
    return geometry;
  }), []);
  useEffect(() => () => { material.dispose(); ribbons.forEach(ribbon => ribbon.dispose()); }, [material, ribbons]);
  return <group position={[-470, 0, -900]}>
    {ribbons.map((ribbon, i) => <mesh key={i} geometry={ribbon} material={material} position={[i * 60 - 60, 230 + i * 26, i * 55]} rotation={[0, 0.25 - i * 0.18, 0]} renderOrder={-1} frustumCulled={false} />)}
  </group>;
}
