import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { Billboard } from "@react-three/drei";
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
  const healthRef = useRef<THREE.Mesh>(null);
  const lastShotRef = useRef(0);

  useFrame((_, frameDelta) => {
    if (destroyed.current || !meshRef.current) return;
    if (gameSession.paused) return;
    const now = gameSession.elapsed;
    if (healthRef.current) { healthRef.current.scale.x = hpRef.current / 100; healthRef.current.position.x = -1.5 * (1 - hpRef.current / 100); }
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
        missionEmitter.dispatchEvent(new CustomEvent("impact", { detail: { position: { x: position[0], y: position[1] + 4, z: position[2] }, color: "#ffb45b", large: true } }));
        setAlive(false);
        missionEmitter.dispatchEvent(
          new CustomEvent("tower_destroyed", { detail: { id } }),
        );
      }
    };
    missionEmitter.addEventListener("tower_hit", handleHit);
    return () => missionEmitter.removeEventListener("tower_hit", handleHit);
  }, [id, position]);

  if (!alive) return null;
  return (
    <RigidBody type="fixed" colliders={false} position={position} userData={{ targetId: id }}>
    <CylinderCollider args={[1.15, 2.3]} position={[0, 1.15, 0]} />
    <CylinderCollider args={[3.25, 1.65]} position={[0, 5.55, 0]} />
    <group ref={meshRef}>
      <Billboard position={[0, 10.3, 0]}>
        <mesh><planeGeometry args={[3.2, 0.35]} /><meshBasicMaterial color="#13232b" /></mesh>
        <mesh ref={healthRef} position={[0, 0, 0.01]}><planeGeometry args={[3, 0.22]} /><meshBasicMaterial color="#ffb45b" /></mesh>
      </Billboard>
      <mesh castShadow receiveShadow position={[0, 1.15, 0]}>
        <cylinderGeometry args={[1.95, 2.35, 2.3, 16]} />
        <meshStandardMaterial color="#71675a" roughness={0.96} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 4.6, 0]}>
        <cylinderGeometry args={[1.32, 1.82, 5.8, 16, 4]} />
        <meshStandardMaterial color="#8f8171" roughness={0.94} />
      </mesh>
      {[2.3, 5.2, 7.2].map(height => <mesh key={height} position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[height === 2.3 ? 1.78 : 1.42, 0.11, 5, 20]} />
        <meshStandardMaterial color="#625b52" roughness={0.98} />
      </mesh>)}
      <mesh castShadow receiveShadow position={[0, 7.9, 0]}>
        <cylinderGeometry args={[1.85, 1.46, 1.05, 16]} />
        <meshStandardMaterial color="#665d52" roughness={0.94} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const angle = i / 12 * Math.PI * 2;
        return <mesh key={i} castShadow position={[Math.cos(angle) * 1.6, 8.65, Math.sin(angle) * 1.6]} rotation={[0, -angle, 0]}>
          <boxGeometry args={[0.55, 0.65, 0.65]} />
          <meshStandardMaterial color="#756b5d" roughness={0.96} />
        </mesh>;
      })}
      <mesh position={[0, 8.9, 0]}>
        <sphereGeometry args={[0.42, 12, 10]} />
        <meshBasicMaterial color="#ff6b24" />
      </mesh>

    </group>
    </RigidBody>
  );
}
