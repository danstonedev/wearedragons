import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useGLTF } from "@react-three/drei";
import { BallCollider, RigidBody, interactionGroups, useRapier } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { colorDragonModel, DRAGON_TYPES } from "../dragons";
import { WORLD_ONLY } from "../game/aim";
import { advanceRaider, createRaiderState, RAIDER_HP, RAIDER_ID, RAIDER_SPAWN } from "../game/raider";
import { gameSession, missionEmitter, playerPos, playerStatus } from "../game/runtime";
import { useDragonAnimations } from "./useDragonAnimations";

const RAIDER_COLOR = { ...DRAGON_TYPES[0].colors, body: "#453849", wing: "#842f46", belly: "#ad704e", eye: "#ffbe5c", horn: "#211b27", spike: "#211b27" };

/** A single optional airborne threat in Beacon Ridge. Its collider is a real projectile target. */
export default function FlyingRaider() {
  const body = useRef<RapierRigidBody>(null);
  const facing = useRef<THREE.Group>(null);
  const healthBar = useRef<THREE.Mesh>(null);
  const warning = useRef<THREE.Mesh>(null);
  const logic = useRef(createRaiderState());
  const hp = useRef(RAIDER_HP);
  const dead = useRef(false);
  const [alive, setAlive] = useState(true);
  const { world, rapier } = useRapier();
  const ray = useMemo(() => new rapier.Ray(RAIDER_SPAWN, { x: 0, y: 0, z: 1 }), [rapier]);

  const { scene: source, animations } = useGLTF(`${import.meta.env.BASE_URL}dragon.glb`);
  const scene = useMemo(() => {
    const clone = SkeletonUtils.clone(source);
    colorDragonModel(clone, RAIDER_COLOR);
    clone.scale.setScalar(0.65);
    clone.rotation.y = Math.PI;
    return clone;
  }, [source]);
  useDragonAnimations(scene, animations);
  useEffect(() => {
    return () => {
      const owned = new Set<THREE.Material>();
      scene.traverse(child => {
        if (!(child as THREE.Mesh).isMesh) return;
        const material = (child as THREE.Mesh).material;
        for (const item of Array.isArray(material) ? material : [material]) owned.add(item);
      });
      owned.forEach(material => material.dispose());
    };
  }, [scene]);

  useEffect(() => {
    const hit = (event: Event) => {
      if (dead.current || gameSession.paused) return;
      const { targetId, damage } = (event as CustomEvent<{ targetId: string; damage: number }>).detail;
      if (targetId !== RAIDER_ID || !Number.isFinite(damage) || damage <= 0) return;
      hp.current = Math.max(0, hp.current - damage);
      if (hp.current > 0) return;
      dead.current = true;
      const position = { ...logic.current.position };
      missionEmitter.dispatchEvent(new CustomEvent("impact", { detail: { position, color: "#ffb45b", large: true, targetId: RAIDER_ID } }));
      missionEmitter.dispatchEvent(new CustomEvent("raider_destroyed"));
      setAlive(false);
    };
    missionEmitter.addEventListener("tower_hit", hit);
    return () => missionEmitter.removeEventListener("tower_hit", hit);
  }, []);

  useFrame((_, frameDelta) => {
    if (dead.current || gameSession.paused || !body.current) return;
    const current = logic.current.position;
    const delta = Math.min(frameDelta, 1 / 15);
    const dx = playerPos.x - current.x, dy = playerPos.y - current.y, dz = playerPos.z - current.z;
    const distance = Math.hypot(dx, dy, dz);
    let visible = !playerStatus.cloaked;
    if (visible && distance > 0.01) {
      ray.origin = current;
      ray.dir = { x: dx / distance, y: dy / distance, z: dz / distance };
      visible = !world.castRay(ray, Math.max(0, distance - 2.5), true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, WORLD_ONLY, undefined, body.current);
    }
    const { state, fire } = advanceRaider(logic.current, playerPos, delta, visible);
    logic.current = state;
    body.current.setNextKinematicTranslation(state.position);
    if (facing.current && distance > 0.01) {
      const targetYaw = Math.atan2(-dx, -dz);
      facing.current.rotation.y = targetYaw;
      facing.current.rotation.z = state.phase === "evade" ? state.orbit * 0.35 : 0;
    }
    if (healthBar.current) {
      const fraction = hp.current / RAIDER_HP;
      healthBar.current.scale.x = fraction;
      healthBar.current.position.x = -1.25 * (1 - fraction);
    }
    if (warning.current) {
      const telegraph = state.phase === "windup";
      warning.current.visible = telegraph;
      warning.current.scale.setScalar(telegraph ? 1 + Math.sin(state.phaseTime * 25) * 0.2 : 1);
    }
    if (fire && distance > 0.01) {
      // Begin outside the 1.6-unit body collider and aim at the player's current position.
      const norm = Math.hypot(playerPos.x - state.position.x, playerPos.y - state.position.y, playerPos.z - state.position.z);
      if (norm > 0.01) {
        const ux = (playerPos.x - state.position.x) / norm;
        const uy = (playerPos.y - state.position.y) / norm;
        const uz = (playerPos.z - state.position.z) / norm;
        missionEmitter.dispatchEvent(new CustomEvent("enemy_shoot", { detail: {
          position: [state.position.x + ux * 2.5, state.position.y + uy * 2.5, state.position.z + uz * 2.5],
          velocity: [ux * 23, uy * 23, uz * 23],
        } }));
      }
    }
  });

  if (!alive) return null;
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[RAIDER_SPAWN.x, RAIDER_SPAWN.y, RAIDER_SPAWN.z]} userData={{ targetId: RAIDER_ID }} collisionGroups={interactionGroups(0, [1])}>
      <BallCollider args={[1.6]} />
      <group ref={facing}>
        <primitive object={scene} />
        <mesh ref={warning} position={[0, 0, -2.5]} visible={false}>
          <sphereGeometry args={[0.75, 12, 8]} />
          <meshBasicMaterial color="#ff6a26" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      </group>
      <Billboard position={[0, 3.2, 0]}>
        <mesh><planeGeometry args={[2.7, 0.34]} /><meshBasicMaterial color="#231d27" depthTest={false} /></mesh>
        <mesh ref={healthBar} position={[0, 0, 0.01]}><planeGeometry args={[2.5, 0.2]} /><meshBasicMaterial color="#ff7557" depthTest={false} /></mesh>
      </Billboard>
    </RigidBody>
  );
}
