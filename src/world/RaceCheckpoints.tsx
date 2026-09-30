import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { gameSession, missionEmitter, playerPos } from "../game/runtime";
import { RACE_ROUTE, gateNormal, crossedRaceGate } from "../game/race";
import type { Vector3Like } from "../game/flight";

function CheckpointRing({ index, nextIndex }: { index: number; nextIndex: number }) {
  const position = RACE_ROUTE[index];
  const normal = useMemo(() => gateNormal(index), [index]);
  const orientation = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(normal.x, normal.y, normal.z)), [normal]);
  const previous = useRef<Vector3Like | null>(null);
  const triggered = useRef(false);
  const halo = useRef<THREE.Mesh>(null);
  const isNext = index === nextIndex;
  useFrame(() => {
    if (gameSession.paused || !gameSession.ready) {
      previous.current = null;
      return;
    }
    if (!previous.current) {
      previous.current = { ...playerPos };
      return;
    }
    if (halo.current && isNext) halo.current.scale.setScalar(1 + Math.sin(gameSession.elapsed * 3) * 0.045);
    if (isNext && !triggered.current && crossedRaceGate(previous.current, playerPos, { x: position[0], y: position[1], z: position[2] }, normal)) {
      triggered.current = true;
      missionEmitter.dispatchEvent(new CustomEvent("checkpoint_reached", { detail: { index } }));
    }
    Object.assign(previous.current, playerPos);
  });
  if (index < nextIndex) return null;
  return <group position={position} quaternion={orientation}>
    <mesh>
      <torusGeometry args={[3.5, 0.22, 8, 40]} />
      <meshStandardMaterial color={isNext ? "#55ddff" : "#587480"} emissive={isNext ? "#22bbee" : "#153442"} emissiveIntensity={isNext ? 1.7 : 0.3} transparent opacity={isNext ? 1 : 0.35} />
    </mesh>
    {isNext && <>
      <mesh ref={halo}>
        <torusGeometry args={[4.1, 0.05, 6, 40]} />
        <meshBasicMaterial color="#b6f7ff" transparent opacity={0.65} />
      </mesh>
      {/* Approach lights establish the crossing axis without a rotating target. */}
      {[4, 8, 12].map(distance => <mesh key={distance} position={[0, -2.5, -distance]}>
        <sphereGeometry args={[0.18, 6, 6]} /><meshBasicMaterial color="#72e6ff" />
      </mesh>)}
    </>}
  </group>;
}

export default function RaceCheckpoints({ passedCount }: { passedCount: number }) {
  return <group>{RACE_ROUTE.map((_, index) => <CheckpointRing key={index} index={index} nextIndex={passedCount} />)}</group>;
}
