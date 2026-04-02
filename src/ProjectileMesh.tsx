import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AttackConfig } from "./dragons";

/**
 * Shared projectile mesh used by both gameplay (App.tsx) and
 * the dragon-select preview (DragonSelect.tsx).
 *
 * @param attack  The dragon's attack config (style, colors, size).
 * @param size    Pre-computed size (e.g. PROJECTILE_SIZE.GAMEPLAY * attack.projectileSize).
 * @param spin    Whether to auto-rotate the mesh each frame (true for gameplay projectiles).
 */
export default function ProjectileMesh({
  attack,
  size,
  spin = false,
}: {
  attack: AttackConfig;
  size: number;
  spin?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!spin || !meshRef.current) return;
    meshRef.current.rotation.x += 0.15;
    meshRef.current.rotation.y += 0.2;
  });

  switch (attack.style) {
    case "frostbreath":
      return (
        <mesh ref={meshRef}>
          <icosahedronGeometry args={[size, 1]} />
          <meshStandardMaterial
            color={attack.color1}
            emissive={attack.color2}
            emissiveIntensity={1}
            transparent
            opacity={0.6}
          />
        </mesh>
      );
    case "venom":
      return (
        <mesh ref={meshRef}>
          <sphereGeometry args={[size, 8, 8]} />
          <meshStandardMaterial
            color={attack.color1}
            emissive={attack.color2}
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      );
    case "flamesilk":
      return (
        <mesh ref={meshRef}>
          <cylinderGeometry args={[size * 0.3, size * 0.1, size * 3, 6]} />
          <meshBasicMaterial color={attack.color2} />
          <mesh>
            <cylinderGeometry
              args={[size * 0.15, size * 0.05, size * 3.5, 6]}
            />
            <meshBasicMaterial color={attack.color1} />
          </mesh>
        </mesh>
      );
    case "decay":
      return (
        <mesh ref={meshRef}>
          <dodecahedronGeometry args={[size, 0]} />
          <meshStandardMaterial
            color={attack.color1}
            emissive={attack.color2}
            emissiveIntensity={0.5}
            roughness={1}
          />
          <mesh>
            <dodecahedronGeometry args={[size * 1.3, 0]} />
            <meshBasicMaterial
              color={attack.color2}
              wireframe
              transparent
              opacity={0.3}
            />
          </mesh>
        </mesh>
      );
    case "shards":
      return (
        <mesh ref={meshRef}>
          <coneGeometry args={[size * 0.4, size * 2, 4]} />
          <meshStandardMaterial
            color={attack.color1}
            emissive={attack.color2}
            emissiveIntensity={1}
          />
        </mesh>
      );
    case "stinger":
      return (
        <mesh ref={meshRef}>
          <coneGeometry args={[size * 0.3, size * 1.5, 3]} />
          <meshBasicMaterial color={attack.color1} />
        </mesh>
      );
    case "sonic":
      return (
        <mesh ref={meshRef}>
          <ringGeometry args={[size * 0.6, size, 16]} />
          <meshBasicMaterial
            color={attack.color1}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
          />
        </mesh>
      );
    case "thorns":
      return (
        <mesh ref={meshRef}>
          <octahedronGeometry args={[size * 0.6, 0]} />
          <meshStandardMaterial
            color={attack.color1}
            emissive={attack.color2}
            emissiveIntensity={0.8}
            roughness={0.8}
          />
        </mesh>
      );
    default:
      // fireball
      return (
        <mesh ref={meshRef}>
          <icosahedronGeometry args={[size, 0]} />
          <meshBasicMaterial color={attack.color1} wireframe />
          <mesh>
            <icosahedronGeometry args={[size * 0.65, 0]} />
            <meshBasicMaterial color={attack.color2} />
          </mesh>
        </mesh>
      );
  }
}
