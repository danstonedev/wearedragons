import { useRef } from "react";
import type { ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { playerPos } from "../../game/runtime";
import { renderingBudget } from "../../game/rendering";
import { device } from "../../utils/device";

/** Nothing is drawn much past the fog; constrained devices have shorter fog. */
const FOG_END = renderingBudget(device).worldFog[1];

/** Shows its children only while the dragon is within range (colliders stay regardless). */
export default function Distant({ x, z, range, children }: { x: number; z: number; range: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const timer = useRef(0);
  useFrame((_, delta) => {
    timer.current -= delta;
    if (timer.current > 0 || !group.current) return;
    timer.current = 0.3 + Math.random() * 0.2;
    group.current.visible = Math.hypot(playerPos.x - x, playerPos.z - z) < Math.min(range, FOG_END + 180);
  });
  return <group ref={group}>{children}</group>;
}
