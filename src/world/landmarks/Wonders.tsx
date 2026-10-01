import { useEffect, useMemo } from "react";
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { terrainHeight } from "../../game/landscape";
import { noise } from "../../game/noise";
import { FALLEN_GIANT, GREAT_ARCH, RAINFOREST_GIANTS, SEA_STACKS } from "../../game/world";
import Distant from "./Distant";

/** A sandstone arch over the dunes, wide enough for a dragon to thread at speed. */
export function GreatArch() {
  const radius = GREAT_ARCH.span / 2;
  const ground = Math.min(terrainHeight(GREAT_ARCH.x - radius, GREAT_ARCH.z, "open"), terrainHeight(GREAT_ARCH.x + radius, GREAT_ARCH.z, "open"));
  const center = ground + GREAT_ARCH.height - radius - 4.5;
  const arcBalls = Array.from({ length: 9 }, (_, i) => {
    const angle = (i + 0.5) / 9 * Math.PI;
    return [GREAT_ARCH.x + Math.cos(angle) * radius, center + Math.sin(angle) * radius, GREAT_ARCH.z] as const;
  });
  return <>
    <Distant x={GREAT_ARCH.x} z={GREAT_ARCH.z} range={760}>
      {[-1, 1].map(side => <mesh key={side} position={[GREAT_ARCH.x + side * radius, (ground + center) / 2 - 2, GREAT_ARCH.z]} castShadow receiveShadow>
        <boxGeometry args={[10, center - ground + 4, 10]} />
        <meshStandardMaterial color="#cf9258" roughness={0.95} />
      </mesh>)}
      <mesh position={[GREAT_ARCH.x, center, GREAT_ARCH.z]} castShadow receiveShadow>
        <torusGeometry args={[radius, 5, 8, 32, Math.PI]} />
        <meshStandardMaterial color="#d9a066" roughness={0.95} />
      </mesh>
      <mesh position={[GREAT_ARCH.x, center, GREAT_ARCH.z]}>
        <torusGeometry args={[radius - 1.5, 5.15, 8, 32, Math.PI]} />
        <meshStandardMaterial color="#b97c45" roughness={0.95} side={THREE.BackSide} />
      </mesh>
    </Distant>
    <RigidBody type="fixed" colliders={false}>
      {[-1, 1].map(side => <CuboidCollider key={side} args={[5, (center - ground + 4) / 2, 5]} position={[GREAT_ARCH.x + side * radius, (ground + center) / 2 - 2, GREAT_ARCH.z]} />)}
      {arcBalls.map((position, i) => <BallCollider key={i} args={[5]} position={position} />)}
    </RigidBody>
  </>;
}

/** The bones of a dragon larger than any living one, half sunk in the sand. */
export function FallenGiant() {
  const along = new THREE.Vector2(Math.cos(FALLEN_GIANT.heading), Math.sin(FALLEN_GIANT.heading));
  const across = new THREE.Vector2(-along.y, along.x);
  const ground = terrainHeight(FALLEN_GIANT.x, FALLEN_GIANT.z, "open");
  const spine = Array.from({ length: 16 }, (_, i) => ({
    x: FALLEN_GIANT.x + along.x * (i - 6) * 5.5,
    z: FALLEN_GIANT.z + along.y * (i - 6) * 5.5,
    size: 2.6 - Math.abs(i - 5) * 0.12,
  }));
  const yaw = -FALLEN_GIANT.heading;
  return <Distant x={FALLEN_GIANT.x} z={FALLEN_GIANT.z} range={700}>
    {spine.map((bone, i) => <mesh key={i} position={[bone.x, ground + 1.2, bone.z]} castShadow>
      <icosahedronGeometry args={[bone.size, 0]} />
      <meshStandardMaterial color="#e8dcc0" roughness={0.85} />
    </mesh>)}
    {spine.slice(1, 11).map((bone, i) => <mesh key={i} position={[bone.x, ground + 0.5, bone.z]} rotation={[0, yaw + Math.PI / 2, 0]} castShadow>
      <torusGeometry args={[11 - Math.abs(i - 4) * 0.9, 0.9, 6, 18, Math.PI * 0.86]} />
      <meshStandardMaterial color="#efe4c9" roughness={0.85} />
    </mesh>)}
    <group position={[FALLEN_GIANT.x - along.x * 40, ground + 3, FALLEN_GIANT.z - along.y * 40]} rotation={[0, yaw, 0.25]}>
      <mesh castShadow scale={[10, 5.5, 6]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#e8dcc0" roughness={0.85} />
      </mesh>
      {[-1, 1].map(side => <mesh key={side} position={[2, 1.6, side * 3.2]}>
        <sphereGeometry args={[1.5, 10, 8]} />
        <meshStandardMaterial color="#2a2118" roughness={1} />
      </mesh>)}
      {[-1, 1].map(side => <mesh key={`horn${side}`} position={[5, 4.5, side * 3]} rotation={[side * 0.4, 0, -1.1]}>
        <coneGeometry args={[1.1, 9, 8]} />
        <meshStandardMaterial color="#d8c9a6" roughness={0.8} />
      </mesh>)}
    </group>
    {[-1, 1].map(side => <mesh key={side} position={[FALLEN_GIANT.x + across.x * side * 22, ground + 6, FALLEN_GIANT.z + across.y * side * 22]} rotation={[0, yaw, side * 0.9]}>
      <cylinderGeometry args={[0.7, 1.1, 34, 8]} />
      <meshStandardMaterial color="#e2d6b8" roughness={0.85} />
    </mesh>)}
  </Distant>;
}

/** Canopy giants on the waterfall plateau, each with RainWing platforms in its branches. */
export function RainforestGiants() {
  const trees = RAINFOREST_GIANTS.map(giant => ({ ...giant, y: terrainHeight(giant.x, giant.z, "open") }));
  return <>
    <Distant x={556} z={-770} range={820}>
      {trees.map((tree, t) => <group key={t} position={[tree.x, tree.y, tree.z]}>
        <mesh position={[0, tree.height / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[2.1, 3.6, tree.height, 10]} />
          <meshStandardMaterial color="#5a4632" roughness={0.95} />
        </mesh>
        {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[Math.cos(i * 1.26) * 3.2, 2.4, Math.sin(i * 1.26) * 3.2]} rotation={[0, -i * 1.26, 0.5]} castShadow>
          <boxGeometry args={[0.6, 6, 3.6]} />
          <meshStandardMaterial color="#4e3c2a" roughness={0.95} />
        </mesh>)}
        {[[0, 1, 0, 19], [9, 0.9, 6, 13], [-10, 0.86, -4, 14], [4, 0.94, -10, 12], [-5, 0.82, 10, 11]].map(([dx, h, dz, r], i) => <mesh key={i} position={[dx, tree.height * h, dz]} scale={[r, r * 0.38, r]} castShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={i % 2 ? "#3b8037" : "#2c6a2c"} roughness={0.9} />
        </mesh>)}
        {[0.45, 0.66].map((h, i) => <group key={i} position={[0, tree.height * h, 0]}>
          <mesh receiveShadow>
            <cylinderGeometry args={[7.5 - i, 7.5 - i, 0.6, 16]} />
            <meshStandardMaterial color="#8a6a3a" roughness={0.9} />
          </mesh>
          <mesh position={[4.5, 1.6, 0]}>
            <coneGeometry args={[1.8, 3.2, 6]} />
            <meshStandardMaterial color="#b6893c" roughness={0.85} />
          </mesh>
        </group>)}
      </group>)}
    </Distant>
    <RigidBody type="fixed" colliders={false}>
      {trees.map((tree, t) => <CylinderCollider key={t} args={[tree.height / 2, 3]} position={[tree.x, tree.y + tree.height / 2, tree.z]} />)}
      {trees.flatMap((tree, t) => [0.45, 0.66].map((h, i) => <CylinderCollider key={`${t}-${i}`} args={[0.3, 7.5 - i]} position={[tree.x, tree.y + tree.height * h, tree.z]} />))}
    </RigidBody>
  </>;
}

/** Rock pillars standing in the surf. The first carries the SeaWings' beacon on its flat top. */
export function SeaStacks() {
  const stacks = useMemo(() => SEA_STACKS.map((stack, s) => {
    const bottom = Math.min(-12, terrainHeight(stack.x, stack.z, "open") - 2);
    const height = stack.top - bottom;
    const geometry = new THREE.CylinderGeometry(stack.r * 0.8, stack.r * 1.25, height, 10, 6);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const top = y > height / 2 - 0.01;
      const bump = top ? 1 : 1 + noise(x * 0.4 + s * 7, y * 0.15 + z * 0.4) * 0.22;
      position.setXYZ(i, x * bump, y, z * bump);
    }
    geometry.computeVertexNormals();
    return { ...stack, bottom, height, geometry };
  }), []);
  useEffect(() => () => stacks.forEach(stack => stack.geometry.dispose()), [stacks]);
  return <>
    <Distant x={0} z={205} range={1100}>
      {stacks.map((stack, i) => <group key={i}>
        <mesh geometry={stack.geometry} position={[stack.x, stack.bottom + stack.height / 2, stack.z]} castShadow receiveShadow>
          <meshStandardMaterial color="#6f6a60" roughness={0.95} />
        </mesh>
        <mesh position={[stack.x, stack.top + 0.05, stack.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[stack.r * 0.8, 16]} />
          <meshStandardMaterial color="#5d7a4a" roughness={1} />
        </mesh>
      </group>)}
    </Distant>
    <RigidBody type="fixed" colliders={false}>
      {stacks.map((stack, i) => <CylinderCollider key={i} args={[stack.height / 2, stack.r * 1.05]} position={[stack.x, stack.bottom + stack.height / 2, stack.z]} />)}
    </RigidBody>
  </>;
}
