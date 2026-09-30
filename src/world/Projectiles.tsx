import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BallCollider, RigidBody, useRapier, interactionGroups } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import ProjectileMesh from "../ProjectileMesh";
import { PROJECTILE_SIZE } from "../constants";
import { fireballEmitter, missionEmitter, gameSession, playerPos } from "../game/runtime";
import type { Shot } from "../game/runtime";
import { segmentSphereHit } from "../game/flight";

let nextId = 0;
interface PlayerShot extends Shot { id: number }

function PlayerProjectile({ shot, remove }: { shot: PlayerShot; remove: (id: number) => void }) {
  const body = useRef<RapierRigidBody>(null);
  const age = useRef(0);
  const spent = useRef(false);
  const size = PROJECTILE_SIZE.GAMEPLAY * shot.attack.projectileSize;
  useFrame((_, delta) => {
    if (gameSession.paused) return;
    age.current += Math.min(delta, 1 / 15);
    if (age.current >= shot.attack.lifetime && !spent.current) {
      spent.current = true;
      remove(shot.id);
    }
  });
  return (
    <RigidBody
      ref={body}
      position={shot.position}
      linearVelocity={shot.velocity}
      colliders={false}
      collisionGroups={interactionGroups(1, [0])}
      mass={2}
      ccd
      gravityScale={shot.attack.gravity}
      onCollisionEnter={({ other }) => {
        if (spent.current) return;
        spent.current = true;
        const targetId = other.rigidBodyObject?.userData.targetId as string | undefined;
        const position = body.current?.translation();
        if (targetId) missionEmitter.dispatchEvent(new CustomEvent("tower_hit", { detail: { targetId, damage: 35 } }));
        if (position) missionEmitter.dispatchEvent(new CustomEvent("impact", { detail: { position, color: shot.attack.color2, targetId } }));
        remove(shot.id);
      }}
    >
      <BallCollider args={[Math.max(0.12, size * 0.75)]} />
      <ProjectileMesh attack={shot.attack} size={size} spin />
    </RigidBody>
  );
}

export default function Projectiles() {
  const [shots, setShots] = useState<PlayerShot[]>([]);
  useEffect(() => {
    const handle = (event: Event) => {
      if (gameSession.paused) return;
      const shot = { ...(event as CustomEvent<Shot>).detail, id: nextId++ };
      // Bound the actor count even for rapid-fire/multi-shot dragons.
      setShots(previous => [...previous.slice(-95), shot]);
    };
    fireballEmitter.addEventListener("shoot", handle);
    return () => fireballEmitter.removeEventListener("shoot", handle);
  }, []);
  const remove = useCallback((id: number) => setShots(previous => previous.filter(shot => shot.id !== id)), []);
  return <group>{shots.map(shot => <PlayerProjectile key={shot.id} shot={shot} remove={remove} />)}</group>;
}

interface EnemyShot {
  position: [number, number, number];
  velocity: [number, number, number];
}
interface EnemyActor { position: THREE.Vector3; velocity: THREE.Vector3; age: number }
const MAX_ENEMY_SHOTS = 64;

/** One instanced mesh and one simulation loop, with swept hits against a moving player. */
export function EnemyProjectiles() {
  const actors = useRef<EnemyActor[]>([]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const previousPlayer = useRef(new THREE.Vector3(0, 5, 0));
  const scratch = useRef({
    from: new THREE.Vector3(), to: new THREE.Vector3(), relativeFrom: new THREE.Vector3(),
    relativeTo: new THREE.Vector3(), zero: new THREE.Vector3(), dummy: new THREE.Object3D(),
  });
  const { world, rapier } = useRapier();
  const ray = useRef(new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }));
  useEffect(() => {
    const handle = (event: Event) => {
      if (gameSession.paused) return;
      const shot = (event as CustomEvent<EnemyShot>).detail;
      if (!shot.velocity.every(Number.isFinite)) return;
      if (actors.current.length >= MAX_ENEMY_SHOTS) actors.current.shift();
      actors.current.push({ position: new THREE.Vector3(...shot.position), velocity: new THREE.Vector3(...shot.velocity), age: 0 });
    };
    missionEmitter.addEventListener("enemy_shoot", handle);
    return () => missionEmitter.removeEventListener("enemy_shoot", handle);
  }, []);
  useFrame((_, delta) => {
    if (!mesh.current || gameSession.paused) return;
    const dt = Math.min(delta, 1 / 15);
    const work = scratch.current;
    const remaining: EnemyActor[] = [];
    for (const actor of actors.current) {
      actor.age += dt;
      work.from.copy(actor.position);
      work.to.copy(actor.position).addScaledVector(actor.velocity, dt);
      work.relativeFrom.copy(work.from).sub(previousPlayer.current);
      work.relativeTo.copy(work.to).sub(playerPos);
      const hitPlayer = segmentSphereHit(work.relativeFrom, work.relativeTo, work.zero, 2.5);
      const length = work.from.distanceTo(work.to);
      ray.current.origin = work.from;
      ray.current.dir = work.relativeTo.copy(work.to).sub(work.from).normalize();
      const hitWorld = world.castRay(ray.current, length, true, undefined, interactionGroups(0, [0]));
      if (hitPlayer !== null && (!hitWorld || hitPlayer * length < hitWorld.timeOfImpact)) {
        missionEmitter.dispatchEvent(new CustomEvent("player_hit", { detail: { damage: 12 } }));
        continue;
      }
      if (actor.age >= 4 || hitWorld) continue;
      actor.position.copy(work.to);
      work.dummy.position.copy(actor.position);
      work.dummy.rotation.set(actor.age * 3, 0, actor.age * 2);
      work.dummy.updateMatrix();
      mesh.current.setMatrixAt(remaining.length, work.dummy.matrix);
      remaining.push(actor);
    }
    actors.current = remaining;
    previousPlayer.current.copy(playerPos);
    mesh.current.count = remaining.length;
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_ENEMY_SHOTS]} frustumCulled={false} count={0}>
      <octahedronGeometry args={[0.4, 0]} />
      <meshBasicMaterial color="#ff6138" toneMapped={false} />
    </instancedMesh>
  );
}
