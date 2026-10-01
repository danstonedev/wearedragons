import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { playerPos } from "../game/runtime";
import { kingdomAt } from "../game/world";
import type { Kingdom } from "../game/world";

/** Runs inside the Canvas and reports whenever the dragon crosses into another kingdom. */
export default function KingdomTracker({ onChange }: { onChange: (kingdom: Kingdom) => void }) {
  const last = useRef("");
  const timer = useRef(0);
  useFrame((_, delta) => {
    timer.current -= delta;
    if (timer.current > 0) return;
    timer.current = 0.25;
    const kingdom = kingdomAt(playerPos.x, playerPos.z);
    if (kingdom.id === last.current) return;
    last.current = kingdom.id;
    onChange(kingdom);
  });
  return null;
}
