import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ROYAL_HOARDS } from "../../game/worldSites";
import type { RoyalKingdom } from "../../game/worldSites";
import Distant from "./Distant";
import { useStaticInstances } from "./instances";

const KINGDOMS = Object.keys(ROYAL_HOARDS) as RoyalKingdom[];
const COINS_PER_HOARD = 40;

/** Each kingdom's royal hoard: a glinting heap of gold where its crown treasure lies. */
export default function RoyalHoards() {
  const coins = useRef<THREE.InstancedMesh>(null);
  const glow = useRef<THREE.Group>(null);
  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D();
    const list: THREE.Matrix4[] = [];
    KINGDOMS.forEach((kingdom, k) => {
      const hoard = ROYAL_HOARDS[kingdom];
      for (let i = 0; i < COINS_PER_HOARD; i++) {
        const angle = i * 2.39996 + k;
        const r = hoard.r * 1.25 * Math.sqrt((i + 0.5) / COINS_PER_HOARD);
        // Rest each coin on the heap's surface, or on the ground around it.
        const surface = Math.max(0, -0.55 + 0.75 * Math.sqrt(Math.max(0, 1 - (r / hoard.r) ** 2))) * hoard.r;
        dummy.position.set(hoard.x + Math.cos(angle) * r, hoard.y + surface + 0.05, hoard.z + Math.sin(angle) * r);
        dummy.rotation.set((i % 7) * 0.4, angle, (i % 5) * 0.3);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        list.push(dummy.matrix.clone());
      }
    });
    return list;
  }, []);
  useStaticInstances(coins, matrices);
  useFrame(state => {
    const t = state.clock.elapsedTime;
    glow.current?.children.forEach((child, i) => child.scale.set(1, 0.85 + Math.sin(t * 1.5 + i) * 0.15, 1));
  });
  return <>
    {KINGDOMS.map(kingdom => {
      const hoard = ROYAL_HOARDS[kingdom];
      return <Distant key={kingdom} x={hoard.x} z={hoard.z} range={520}>
        <mesh position={[hoard.x, hoard.y - hoard.r * 0.55, hoard.z]} scale={[hoard.r, hoard.r * 0.75, hoard.r]} receiveShadow castShadow>
          <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#d9a531" emissive="#6b4a08" emissiveIntensity={0.5} metalness={0.75} roughness={0.32} />
        </mesh>
      </Distant>;
    })}
    <instancedMesh ref={coins} args={[undefined, undefined, matrices.length]}>
      <cylinderGeometry args={[0.32, 0.32, 0.07, 10]} />
      <meshStandardMaterial color="#ffd45a" metalness={0.85} roughness={0.25} emissive="#5a3c06" emissiveIntensity={0.4} />
    </instancedMesh>
    {/* A shimmer above each heap, so a sharp-eyed thief can spot it from the air. */}
    <group ref={glow}>
      {KINGDOMS.map(kingdom => {
        const hoard = ROYAL_HOARDS[kingdom];
        return <mesh key={kingdom} position={[hoard.x, hoard.y + 9, hoard.z]}>
          <cylinderGeometry args={[hoard.r * 0.3, hoard.r * 0.9, 18, 12, 1, true]} />
          <meshBasicMaterial color="#ffd27a" transparent opacity={0.13} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>;
      })}
    </group>
  </>;
}
