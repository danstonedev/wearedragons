import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Three curved talons around a palm. `grip` (0 open → 1 closed) curls them; the halo
 * brightens when `glow` reports treasure in reach.
 */
export default function DragonClaw({ color, glowColor, grip, glow, scale = 1, groupRef }: {
  color: string;
  glowColor: string;
  grip: () => number;
  glow?: () => boolean;
  scale?: number;
  groupRef?: RefObject<THREE.Group | null>;
}) {
  const talons = useRef<THREE.Mesh[]>([]);
  const halo = useRef<THREE.Mesh>(null);
  const geometries = useMemo(() => {
    const talon = new THREE.ConeGeometry(0.065, 0.46, 7, 3);
    const positions = talon.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      // Hook the tip forward so each talon reads as a claw, not a spike.
      const t = (0.23 - positions.getY(i)) / 0.46;
      positions.setZ(i, positions.getZ(i) - t * t * 0.16);
    }
    talon.computeVertexNormals();
    talon.translate(0, -0.23, 0);
    return { talon, palm: new THREE.SphereGeometry(0.16, 12, 10), halo: new THREE.TorusGeometry(0.42, 0.022, 6, 32) };
  }, []);
  const materials = useMemo(() => ({
    claw: new THREE.MeshStandardMaterial({ color, emissive: glowColor, emissiveIntensity: 0.5, roughness: 0.42, metalness: 0.2 }),
    halo: new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }),
  }), [color, glowColor]);
  useEffect(() => () => Object.values(geometries).forEach(geometry => geometry.dispose()), [geometries]);
  useEffect(() => () => Object.values(materials).forEach(material => material.dispose()), [materials]);

  useFrame(state => {
    const curl = 0.18 + (1 - Math.max(0, Math.min(1, grip()))) * 0.62;
    talons.current.forEach((talon, i) => talon.rotation.set(-curl, (i - 1) * 0.55, 0, "YXZ"));
    if (halo.current) {
      const lit = glow?.() ?? false;
      materials.halo.opacity = lit ? 0.6 + Math.sin(state.clock.elapsedTime * 12) * 0.25 : 0.22;
      halo.current.scale.setScalar(lit ? 1.15 : 1);
    }
  });

  return <group ref={groupRef} scale={scale}>
    <mesh geometry={geometries.palm} material={materials.claw} />
    {[0, 1, 2].map(i => <mesh key={i} ref={(mesh: THREE.Mesh | null) => { if (mesh) talons.current[i] = mesh; }} geometry={geometries.talon} material={materials.claw} position={[(i - 1) * 0.1, -0.05, -0.06]} />)}
    <mesh ref={halo} geometry={geometries.halo} material={materials.halo} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.28, 0]} />
  </group>;
}
