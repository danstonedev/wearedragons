import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import * as THREE from "three";
import { aim, gameSession, missionEmitter, combatFeedback } from "../game/runtime";

interface Burst { position: THREE.Vector3; color: THREE.Color; age: number; large: boolean }
const MAX_BURSTS = 16;
const PARTICLES = 8;

/** World-space guidance/feedback is visible in desktop and immersive rendering. */
export default function CombatFeedback() {
  const { world, rapier, rigidBodyStates } = useRapier();
  const reticle = useRef<THREE.Mesh>(null);
  const particles = useRef<THREE.InstancedMesh>(null);
  const bursts = useRef<Burst[]>([]);
  const scratch = useMemo(() => ({ dummy: new THREE.Object3D(), eye: new THREE.Vector3(), offset: new THREE.Vector3(), color: new THREE.Color(), ray: new rapier.Ray(aim.origin, aim.direction) }), [rapier]);
  useEffect(() => {
    const impact = (event: Event) => {
      const detail = (event as CustomEvent<{ position: { x: number; y: number; z: number }; color?: string; targetId?: string; large?: boolean }>).detail;
      if (gameSession.paused || !detail?.position) return;
      if (detail.targetId) combatFeedback.hitAt = gameSession.elapsed;
      if (detail.large) combatFeedback.destroyedAt = gameSession.elapsed;
      bursts.current.push({ position: new THREE.Vector3(detail.position.x, detail.position.y, detail.position.z), color: new THREE.Color(detail.color ?? "#ffd27c"), age: 0, large: Boolean(detail.large) });
      if (bursts.current.length > MAX_BURSTS) bursts.current.shift();
    };
    missionEmitter.addEventListener("impact", impact);
    return () => missionEmitter.removeEventListener("impact", impact);
  }, []);
  useFrame((state, delta) => {
    if (!reticle.current || !particles.current || gameSession.paused) return;
    scratch.ray.origin = aim.origin;
    scratch.ray.dir = aim.direction;
    const hit = world.castRay(scratch.ray, 100, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, (1 << 16) | 1);
    const distance = hit?.timeOfImpact ?? 60;
    reticle.current.position.set(aim.origin.x + aim.direction.x * distance, aim.origin.y + aim.direction.y * distance, aim.origin.z + aim.direction.z * distance);
    reticle.current.lookAt(state.camera.getWorldPosition(scratch.eye));
    reticle.current.scale.setScalar(Math.max(0.3, distance * 0.015));
    const parent = hit?.collider.parent();
    const target = parent && rigidBodyStates.get(parent.handle)?.object.userData.targetId;
    (reticle.current.material as THREE.MeshBasicMaterial).color.set(target ? "#ffb45b" : "#cceaff");

    let count = 0;
    const alive: Burst[] = [];
    for (const burst of bursts.current) {
      burst.age += Math.min(delta, 1 / 15);
      if (burst.age >= 0.6) continue;
      alive.push(burst);
      const spread = burst.age * (burst.large ? 10 : 4);
      for (let i = 0; i < PARTICLES; i++) {
        const theta = i * Math.PI * 2 / PARTICLES;
        scratch.dummy.position.copy(burst.position).add(scratch.offset.set(Math.cos(theta) * spread, Math.sin(theta * 3) * spread * 0.6 + spread * 0.2, Math.sin(theta) * spread));
        scratch.dummy.scale.setScalar((1 - burst.age / 0.6) * (burst.large ? 0.25 : 0.12));
        scratch.dummy.updateMatrix();
        particles.current.setMatrixAt(count, scratch.dummy.matrix);
        particles.current.setColorAt(count++, scratch.color.copy(burst.color).multiplyScalar(1 - burst.age / 0.6));
      }
    }
    bursts.current = alive;
    particles.current.count = count;
    particles.current.instanceMatrix.needsUpdate = true;
    if (particles.current.instanceColor) particles.current.instanceColor.needsUpdate = true;
  });
  return <>
    <mesh ref={reticle} renderOrder={10}>
      <torusGeometry args={[0.35, 0.045, 4, 20]} />
      <meshBasicMaterial color="#cceaff" transparent opacity={0.85} depthTest={false} toneMapped={false} />
    </mesh>
    <instancedMesh ref={particles} args={[undefined, undefined, MAX_BURSTS * PARTICLES]} count={0} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  </>;
}
