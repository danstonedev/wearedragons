import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RaidState } from "./raidState";

const CLOAK = "#5b4a36", CLOAK_DARK = "#43362a", SCARF = "#a33a2c", SKIN = "#d9a77c", SACK = "#9c7d55", BOOT = "#2e231a";

/** A small hooded scavenger with a loot sack that swells as it fills. */
export default function ScavengerAvatar({ raid }: { raid: RaidState }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legLeft = useRef<THREE.Group>(null);
  const legRight = useRef<THREE.Group>(null);
  const armLeft = useRef<THREE.Group>(null);
  const armRight = useRef<THREE.Group>(null);
  const sack = useRef<THREE.Mesh>(null);
  const phase = useRef(0);
  const crouch = useRef(0);
  const materials = useMemo(() => ({
    cloak: new THREE.MeshStandardMaterial({ color: CLOAK, roughness: 0.95 }),
    cloakDark: new THREE.MeshStandardMaterial({ color: CLOAK_DARK, roughness: 0.95 }),
    scarf: new THREE.MeshStandardMaterial({ color: SCARF, roughness: 0.85 }),
    skin: new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7 }),
    sack: new THREE.MeshStandardMaterial({ color: SACK, roughness: 1 }),
    boot: new THREE.MeshStandardMaterial({ color: BOOT, roughness: 0.9 }),
    eye: new THREE.MeshBasicMaterial({ color: "#1a1410" }),
    shadow: new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.4, depthWrite: false }),
    glint: new THREE.MeshStandardMaterial({ color: "#f6cb52", emissive: "#6b4a00", emissiveIntensity: 0.6, roughness: 0.3 }),
  }), []);
  useEffect(() => () => Object.values(materials).forEach(material => material.dispose()), [materials]);

  useFrame((state, frameDelta) => {
    if (!root.current || !body.current) return;
    // In VR you are the scavenger, so the body is hidden.
    const hidden = state.gl.xr.isPresenting;
    const delta = Math.min(frameDelta, 1 / 15);
    const { player, gait } = raid;
    root.current.position.set(player.x, raid.feet, player.z);
    root.current.rotation.y = player.facing;
    root.current.visible = !hidden;
    const speed = Math.hypot(player.vx, player.vz);
    phase.current += speed * delta * (gait === "sneak" ? 3.4 : 2.6);
    const swing = Math.min(1, speed / 3) * (gait === "sprint" ? 0.95 : gait === "sneak" ? 0.45 : 0.7);
    const s = Math.sin(phase.current);
    crouch.current += ((raid.sneaking ? 1 : 0) - crouch.current) * (1 - Math.exp(-10 * delta));
    const c = crouch.current;
    legLeft.current?.rotation.set(s * swing - c * 0.5, 0, 0);
    legRight.current?.rotation.set(-s * swing - c * 0.5, 0, 0);
    armLeft.current?.rotation.set(-s * swing * 0.9 - c * 0.6 - (gait === "sprint" ? 0.4 : 0), 0, 0.12);
    armRight.current?.rotation.set(s * swing * 0.9 - c * 0.6 - (gait === "sprint" ? 0.4 : 0), 0, -0.12);
    body.current.position.y = -c * 0.32 + Math.abs(Math.cos(phase.current)) * swing * 0.05;
    body.current.rotation.x = c * 0.42 + (gait === "sprint" ? 0.18 : 0);
    if (sack.current) {
      const weight = raid.sack.length ? raid.lair.loot.filter(item => raid.sack.includes(item.id)).reduce((sum, item) => sum + item.weight, 0) : 0;
      const size = 0.55 + Math.min(1, weight / 8) * 0.75;
      sack.current.scale.setScalar(size);
      sack.current.visible = weight > 0;
    }
  });

  return <group ref={root}>
    {/* Eyes adjusted to the dark: a soft fill so you can see yourself. Not a light dragons can see. */}
    <pointLight position={[0, 2.4, -1.2]} color="#9fb0d0" intensity={2.4} distance={7} decay={1.4} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={materials.shadow}><circleGeometry args={[0.5, 20]} /></mesh>
    <group ref={body}>
      <group ref={legLeft} position={[-0.11, 0.86, 0]}>
        <mesh position={[0, -0.4, 0]} material={materials.cloakDark}><capsuleGeometry args={[0.085, 0.6, 4, 8]} /></mesh>
        <mesh position={[0, -0.8, 0.05]} material={materials.boot}><boxGeometry args={[0.15, 0.12, 0.26]} /></mesh>
      </group>
      <group ref={legRight} position={[0.11, 0.86, 0]}>
        <mesh position={[0, -0.4, 0]} material={materials.cloakDark}><capsuleGeometry args={[0.085, 0.6, 4, 8]} /></mesh>
        <mesh position={[0, -0.8, 0.05]} material={materials.boot}><boxGeometry args={[0.15, 0.12, 0.26]} /></mesh>
      </group>
      {/* Cloak and torso */}
      <mesh position={[0, 1.02, 0]} material={materials.cloak}><coneGeometry args={[0.36, 0.95, 12, 1, true]} /></mesh>
      <mesh position={[0, 1.24, 0]} material={materials.cloak}><capsuleGeometry args={[0.2, 0.35, 4, 10]} /></mesh>
      <mesh position={[0, 1.5, 0.02]} rotation={[Math.PI / 2, 0, 0]} material={materials.scarf}><torusGeometry args={[0.13, 0.06, 8, 16]} /></mesh>
      <mesh position={[0.08, 1.38, 0.17]} rotation={[0.3, 0, 0.2]} material={materials.scarf}><boxGeometry args={[0.09, 0.28, 0.03]} /></mesh>
      {/* Head and hood */}
      <mesh position={[0, 1.7, 0.02]} material={materials.skin}><sphereGeometry args={[0.14, 14, 12]} /></mesh>
      <mesh position={[-0.05, 1.72, 0.15]} material={materials.eye}><sphereGeometry args={[0.018, 6, 5]} /></mesh>
      <mesh position={[0.05, 1.72, 0.15]} material={materials.eye}><sphereGeometry args={[0.018, 6, 5]} /></mesh>
      <mesh position={[0, 1.74, -0.02]} rotation={[-0.25, 0, 0]} scale={[1, 1.05, 1.1]} material={materials.cloak}>
        <sphereGeometry args={[0.18, 14, 10, Math.PI * 0.62, Math.PI * 1.76]} />
      </mesh>
      <mesh position={[0, 1.88, -0.12]} rotation={[-0.9, 0, 0]} material={materials.cloak}><coneGeometry args={[0.1, 0.26, 8]} /></mesh>
      <group ref={armLeft} position={[-0.25, 1.42, 0]}>
        <mesh position={[0, -0.27, 0]} material={materials.cloak}><capsuleGeometry args={[0.065, 0.4, 4, 8]} /></mesh>
        <mesh position={[0, -0.55, 0]} material={materials.skin}><sphereGeometry args={[0.06, 8, 6]} /></mesh>
      </group>
      <group ref={armRight} position={[0.25, 1.42, 0]}>
        <mesh position={[0, -0.27, 0]} material={materials.cloak}><capsuleGeometry args={[0.065, 0.4, 4, 8]} /></mesh>
        <mesh position={[0, -0.55, 0]} material={materials.skin}><sphereGeometry args={[0.06, 8, 6]} /></mesh>
      </group>
      {/* The loot sack, slung on the back */}
      <mesh ref={sack} position={[0, 1.18, -0.3]} visible={false} material={materials.sack}>
        <sphereGeometry args={[0.3, 12, 10]} />
        <mesh position={[0.06, 0.3, 0.02]} material={materials.glint}><cylinderGeometry args={[0.07, 0.07, 0.02, 8]} /></mesh>
      </mesh>
    </group>
  </group>;
}
