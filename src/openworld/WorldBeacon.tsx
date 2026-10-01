import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { gameSession, playerPos } from "../game/runtime";
import type { Kingdom } from "../game/world";
import { beaconBase } from "../game/worldSites";

/** A kingdom's beacon. A pillar of light marks it from far away; fly through the ring to light it. */
export default function WorldBeacon({ kingdom, discovered, onDiscovered }: { kingdom: Kingdom; discovered: boolean; onDiscovered: () => void }) {
  const ring = useRef<THREE.Mesh>(null);
  const pillar = useRef<THREE.Mesh>(null);
  const detail = useRef<THREE.Group>(null);
  const triggered = useRef(false);
  const base = useMemo(() => beaconBase(kingdom), [kingdom]);

  useFrame((state, delta) => {
    if (ring.current) {
      ring.current.rotation.y += delta * 0.5;
      ring.current.rotation.z += delta * 0.28;
    }
    if (pillar.current) {
      const material = pillar.current.material as THREE.MeshBasicMaterial;
      material.opacity = discovered ? 0.2 : 0.07 + Math.sin(state.clock.elapsedTime * 1.6) * 0.03;
    }
    // From far away only the light pillar shows; the tower itself is lost in the haze anyway.
    if (detail.current) detail.current.visible = Math.hypot(playerPos.x - base.x, playerPos.z - base.z) < 380;
    if (gameSession.paused || triggered.current || discovered) return;
    const dx = playerPos.x - base.x, dy = playerPos.y - (base.y + 10), dz = playerPos.z - base.z;
    if (dx * dx + dy * dy + dz * dz < 81) {
      triggered.current = true;
      onDiscovered();
    }
  });

  return (
    <group position={[base.x, base.y, base.z]}>
      <group ref={detail}>
      <mesh castShadow receiveShadow position={[0, 0.65, 0]}>
        <cylinderGeometry args={[2.4, 3, 1.3, 16]} />
        <meshStandardMaterial color="#686b67" roughness={0.95} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 3.8, 0]}>
        <cylinderGeometry args={[0.68, 1.35, 6.3, 16, 4]} />
        <meshStandardMaterial color="#858982" roughness={0.9} />
      </mesh>
      <mesh ref={ring} position={[0, 10, 0]}>
        <torusGeometry args={[3, 0.22, 12, 48]} />
        <meshStandardMaterial
          color={discovered ? kingdom.beaconColor : "#333"}
          emissive={discovered ? kingdom.beaconColor : "#000"}
          emissiveIntensity={discovered ? 1.8 : 0}
          metalness={0.5}
        />
      </mesh>
      <mesh position={[0, 10, 0]}>
        <torusGeometry args={[5.5, 0.1, 6, 36]} />
        <meshStandardMaterial color={kingdom.color} emissive={kingdom.color} emissiveIntensity={discovered ? 0.5 : 0.12} transparent opacity={0.55} />
      </mesh>
      </group>
      {/* A column of light you can steer by from across the continent. */}
      <mesh ref={pillar} position={[0, 92, 0]} renderOrder={2}>
        <cylinderGeometry args={[1.1, 2.2, 160, 12, 1, true]} />
        <meshBasicMaterial color={kingdom.beaconColor} transparent opacity={0.08} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} fog={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
