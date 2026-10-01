import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { gameSession } from "../game/runtime";

/** Advances the shared game clock before every other frame task. */
export default function MissionTimer({ onTick }: { onTick?: (elapsed: number) => void }) {
  const pending = useRef(0);
  useFrame((_, delta) => {
    if (gameSession.paused || !gameSession.ready) return;
    const dt = Math.min(delta, 1 / 15);
    gameSession.elapsed += dt;
    pending.current += dt;
    if (pending.current >= 0.2) {
      pending.current = 0;
      onTick?.(gameSession.elapsed);
    }
  }, -3);
  return null;
}
