import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { missionEmitter, playerPos, playerStatus, gameSession } from "../game/runtime";

export default function Watchtower({
  position,
  id,
}: {
  position: [number, number, number];
  id: string;
}) {
  const hpRef = useRef(100);
  const destroyed = useRef(false);
  const [alive, setAlive] = useState(true);
  const flash = useRef(0);
  const meshRef = useRef<THREE.Group>(null);
  const lastShotRef = useRef(0);

  useFrame((_, frameDelta) => {
    if (destroyed.current || !meshRef.current) return;
    if (gameSession.paused) return;
    const now = gameSession.elapsed;
    flash.current = Math.max(0, flash.current - frameDelta);
    meshRef.current.traverse(child => {
      const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (material?.isMeshStandardMaterial) { material.emissive.set("#ffb04c"); material.emissiveIntensity = flash.current > 0 ? 2 : 0; }
    });

    // Tower shoots at player every 2 seconds
    if (!playerStatus.cloaked && now - lastShotRef.current > 2) {
      lastShotRef.current = now;
      const tx = position[0];
      const ty = position[1] + 8.8;
      const tz = position[2];
      const dx = playerPos.x - tx;
      const dy = playerPos.y - ty;
      const dz = playerPos.z - tz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > 0.01 && dist < 60) {
        const speed = 25;
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;
        const vz = (dz / dist) * speed;
        missionEmitter.dispatchEvent(
          new CustomEvent("enemy_shoot", {
            detail: {
              position: [tx, ty, tz],
              velocity: [vx, vy, vz],
            },
          }),
        );
      }
    }
  });

  // Listen for hits
  useEffect(() => {
    const handleHit = (e: Event) => {
      if (destroyed.current) return;
      const detail = (e as CustomEvent).detail;
      if (detail.targetId !== id) return;
      hpRef.current -= detail.damage;
      flash.current = 0.12;
      if (hpRef.current <= 0) {
        destroyed.current = true;
        setAlive(false);
        missionEmitter.dispatchEvent(
          new CustomEvent("tower_destroyed", { detail: { id } }),
        );
      }
    };
    missionEmitter.addEventListener("tower_hit", handleHit);
    return () => missionEmitter.removeEventListener("tower_hit", handleHit);
  }, [id]);

  if (!alive) return null;
  return (
    <RigidBody type="fixed" colliders={false} position={position} userData={{ targetId: id }}>
    <CuboidCollider args={[1.6, 4, 1.6]} position={[0, 4, 0]} />
    <group ref={meshRef}>
      {/* Stone base */}
      <mesh castShadow receiveShadow position={[0, 2, 0]}>
        <boxGeometry args={[3, 4, 3]} />
        <meshStandardMaterial color="#665544" roughness={0.9} />
      </mesh>
      {/* Tower shaft */}
      <mesh castShadow receiveShadow position={[0, 5.5, 0]}>
        <boxGeometry args={[2.2, 3, 2.2]} />
        <meshStandardMaterial color="#776655" roughness={0.85} />
      </mesh>
      {/* Battlement top */}
      <mesh castShadow receiveShadow position={[0, 7.5, 0]}>
        <boxGeometry args={[3.2, 1, 3.2]} />
        <meshStandardMaterial color="#554433" roughness={0.9} />
      </mesh>
      {/* Fire brazier glow */}
      <mesh position={[0, 8.5, 0]}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color="#ff4400" />
      </mesh>
      <pointLight
        position={[0, 8.5, 0]}
        color="#ff6600"
        intensity={3}
        distance={15}
      />
    </group>
    </RigidBody>
  );
}
