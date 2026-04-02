import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  PerspectiveCamera,
  Plane,
  Sky,
  Environment,
  useGLTF,
  useAnimations,
} from "@react-three/drei";
import {
  Physics,
  RigidBody,
  RapierRigidBody,
  useRapier,
} from "@react-three/rapier";
import * as THREE from "three";
import type { DragonType } from "./dragons";
import {
  DRAGON_TYPES,
  TRIBES,
  colorDragonModel,
  animateDragonEffects,
} from "./dragons";
import ProjectileMesh from "./ProjectileMesh";
import { PROJECTILE_SIZE, MAX_STAT } from "./constants";
import DragonSelect from "./DragonSelect";
import MissionSelect from "./MissionSelect";
import MissionBrief from "./MissionBrief";
import MissionResult from "./MissionResult";
import {
  MISSIONS,
  createMissionState,
  advanceObjective,
  applyDamage,
} from "./game/missions";
import type {
  AppScreen,
  MissionDefinition,
  MissionRuntimeState,
} from "./game/missions";
import "./App.css";
import TouchControls from "./controls/TouchControls";

const DRAGON_MODEL = `${import.meta.env.BASE_URL}dragon.glb`;

const keys: Record<string, boolean> = {};
const joy = {
  left: { x: 0, y: 0 },
  throttle: 0,
  fire: false,
  special: false,
};
const pan = { yaw: 0, pitch: 0, active: 0, lastX: 0, lastY: 0 };
const fireballEmitter = new EventTarget();
const missionEmitter = new EventTarget();
const abilityState = { cooldownLeft: 0, active: false, label: "" };
const playerPos = { x: 0, y: 5, z: 0 };

function BlockyDragon({ dragon }: { dragon: DragonType }) {
  const c = dragon.colors;
  const s = dragon.stats;
  const atk = dragon.attack;
  const spec = dragon.special;
  const rbRef = useRef<RapierRigidBody>(null);
  const visualGroupRef = useRef<THREE.Group>(null);

  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const cloakRef = useRef(false);
  const rollRef = useRef(0);
  const boostRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const lastFireTimeRef = useRef(0);
  const lastSpecialTimeRef = useRef(-999);

  const { rapier, world } = useRapier();
  const { scene, animations: rawAnimations } = useGLTF(DRAGON_MODEL);

  // Strip static tracks from animations to reduce per-frame evaluation (~73% are no-ops)
  const animations = useMemo(() => {
    return rawAnimations.map((clip) => {
      const filtered = clip.tracks.filter((track) => {
        const vals = track.values;
        const stride = track.getValueSize();
        for (let i = stride; i < vals.length; i++) {
          if (Math.abs(vals[i] - vals[i % stride]) > 0.0001) return true;
        }
        return false;
      });
      return new THREE.AnimationClip(clip.name, clip.duration, filtered);
    });
  }, [rawAnimations]);

  const { actions } = useAnimations(animations, visualGroupRef);
  const activeAnimRef = useRef<string>("");
  const targetTimeScaleRef = useRef(1);
  const prevCloakRef = useRef(false);
  const meshListRef = useRef<THREE.Mesh[]>([]);

  // Reusable objects to avoid per-frame allocations
  const _camVec = useMemo(() => new THREE.Vector3(), []);
  const _camQuat = useMemo(() => new THREE.Quaternion(), []);
  const _camEuler = useMemo(() => new THREE.Euler(), []);
  const _camOffset = useMemo(() => new THREE.Vector3(), []);
  const _lookAt = useMemo(() => new THREE.Vector3(), []);
  const _muzzleOffset = useMemo(() => new THREE.Vector3(), []);
  const _muzzleEuler = useMemo(() => new THREE.Euler(), []);
  const _spawnPos = useMemo(() => new THREE.Vector3(), []);
  const _fireVel = useMemo(() => new THREE.Vector3(), []);
  const _fireEuler = useMemo(() => new THREE.Euler(), []);

  useEffect(() => {
    const flyAction = actions["Dragon_Flying"] ?? Object.values(actions)[0];
    if (flyAction) {
      flyAction.reset().fadeIn(0.5).play();
      activeAnimRef.current = "Dragon_Flying";
    }

    if (scene) {
      colorDragonModel(scene, c, dragon.effects);
      scene.scale.set(0.8, 0.8, 0.8);
      scene.rotation.y = Math.PI;

      // Cache mesh list for fast cloak updates (avoid per-frame traverse)
      const meshes: THREE.Mesh[] = [];
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
      });
      meshListRef.current = meshes;
    }
  }, [actions, scene, c]);

  useFrame((state, delta) => {
    if (!rbRef.current || !visualGroupRef.current) return;
    const now = state.clock.getElapsedTime();
    const baseMaxSpeed = 20 * s.speed;
    const maxSpeed = boostRef.current > 0 ? baseMaxSpeed * 2.0 : baseMaxSpeed;

    if (keys["f"]) joy.fire = true;
    if (joy.fire && now - lastFireTimeRef.current > 0.15 / s.firepower) {
      lastFireTimeRef.current = now;
      const dp = rbRef.current.translation();
      const ry = visualGroupRef.current.rotation.y;
      const rz = visualGroupRef.current.rotation.z;
      _muzzleOffset.set(0, 1.2, -3);
      _muzzleEuler.set(0, ry, rz);
      _muzzleOffset.applyEuler(_muzzleEuler);
      _spawnPos.set(dp.x, dp.y, dp.z).add(_muzzleOffset);
      const dv = rbRef.current.linvel();
      for (let i = 0; i < atk.count; i++) {
        const sa =
          atk.count > 1
            ? -atk.spread / 2 + (atk.spread / (atk.count - 1)) * i
            : 0;
        _fireVel.set(0, 0, -50 * atk.projectileSpeed);
        _fireEuler.set(0, ry + sa, rz);
        _fireVel.applyEuler(_fireEuler);
        _fireVel.x += dv.x;
        _fireVel.y += dv.y;
        _fireVel.z += dv.z;
        fireballEmitter.dispatchEvent(
          new CustomEvent("shoot", {
            detail: {
              position: [_spawnPos.x, _spawnPos.y, _spawnPos.z],
              velocity: [_fireVel.x, _fireVel.y, _fireVel.z],
              timestamp: Date.now(),
              attack: atk,
            },
          }),
        );
      }
    }

    if (keys["q"]) joy.special = true;
    const scd = Math.max(0, spec.cooldown - (now - lastSpecialTimeRef.current));
    abilityState.cooldownLeft = scd;
    abilityState.label = spec.label;

    if (joy.special && scd <= 0) {
      lastSpecialTimeRef.current = now;
      joy.special = false;
      switch (spec.type) {
        case "boost": {
          boostRef.current = spec.duration;
          break;
        }
        case "barrel_roll": {
          rollRef.current = spec.duration;
          break;
        }
        case "ground_slam": {
          rbRef.current.setLinvel({ x: 0, y: -60, z: 0 }, true);
          const rbCur = rbRef.current;
          setTimeout(() => {
            const p = rbCur?.translation();
            if (!p) return;
            for (let a = 0; a < 8; a++) {
              const ang = (a / 8) * Math.PI * 2;
              fireballEmitter.dispatchEvent(
                new CustomEvent("shoot", {
                  detail: {
                    position: [p.x, p.y + 1, p.z],
                    velocity: [Math.sin(ang) * 30, 10, Math.cos(ang) * 30],
                    timestamp: Date.now(),
                    attack: atk,
                  },
                }),
              );
            }
          }, 300);
          break;
        }
        case "cloak": {
          cloakRef.current = true;
          abilityState.active = true;
          setTimeout(() => {
            cloakRef.current = false;
            abilityState.active = false;
          }, spec.duration * 1000);
          break;
        }
        case "heal": {
          abilityState.active = true;
          setTimeout(() => {
            abilityState.active = false;
          }, 500);
          break;
        }
        case "scatter_shot": {
          const p = rbRef.current.translation();
          for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            fireballEmitter.dispatchEvent(
              new CustomEvent("shoot", {
                detail: {
                  position: [p.x, p.y + 1, p.z],
                  velocity: [Math.sin(ang) * 40, 5, Math.cos(ang) * 40],
                  timestamp: Date.now(),
                  attack: atk,
                },
              }),
            );
          }
          break;
        }
        case "updraft": {
          const v = rbRef.current.linvel();
          rbRef.current.setLinvel({ x: v.x, y: 40, z: v.z }, true);
          break;
        }
      }
    }
    if (joy.special && scd > 0) joy.special = false;

    if (boostRef.current > 0) {
      boostRef.current -= delta;
      abilityState.active = boostRef.current > 0;
    }
    if (rollRef.current > 0) {
      rollRef.current -= delta;
      abilityState.active = rollRef.current > 0;
    }

    let dx = joy.left.x;
    let dz = -joy.throttle;
    let dy = joy.left.y;
    if (keys["w"] || keys["arrowup"]) dz -= 1;
    if (keys["s"] || keys["arrowdown"]) dz += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;
    if (keys[" "]) dy += 1;
    if (keys["shift"]) dy -= 1;

    if (Math.abs(dx) > 0.01) {
      visualGroupRef.current.rotation.y -= dx * 2.5 * s.agility * delta;
    }

    let targetBank = (dx * Math.PI) / 6;
    if (rollRef.current > 0)
      targetBank = (rollRef.current / spec.duration) * Math.PI * 4;
    visualGroupRef.current.rotation.z =
      rollRef.current > 0
        ? targetBank
        : THREE.MathUtils.lerp(
            visualGroupRef.current.rotation.z,
            targetBank,
            10 * delta,
          );

    const pos = rbRef.current.translation();
    playerPos.x = pos.x;
    playerPos.y = pos.y;
    playerPos.z = pos.z;
    const minAltitude = 1.2;

    // Raycast down for ground detection
    const ray = new rapier.Ray(
      { x: pos.x, y: pos.y, z: pos.z },
      { x: 0, y: -1, z: 0 },
    );
    const hit = world.castRay(ray, 50, true);
    const groundY = hit ? pos.y - hit.timeOfImpact : 0;
    const altitudeAboveGround = pos.y - groundY;
    const grounded = altitudeAboveGround < minAltitude + 0.2;

    const moveSpeed = dz * maxSpeed;
    const tvx = Math.sin(visualGroupRef.current.rotation.y) * moveSpeed;
    const tvz = Math.cos(visualGroupRef.current.rotation.y) * moveSpeed;

    // Altitude: hold when no input, climb/descend with input
    let fvy = dy * (maxSpeed * 0.75);
    // Clamp: don't go below terrain
    if (altitudeAboveGround < minAltitude && fvy <= 0) {
      fvy = Math.max(fvy, (minAltitude - altitudeAboveGround) * 10);
    }

    rbRef.current.setLinvel({ x: tvx, y: fvy, z: tvz }, true);

    // Dynamic animation: vary flap speed and crossfade based on movement
    const horizontalSpeed = Math.sqrt(tvx * tvx + tvz * tvz);
    const speedRatio = horizontalSpeed / baseMaxSpeed; // 0 = still, ~1 = full speed, ~2 = boosted
    const isBoosting = boostRef.current > 0 || rollRef.current > 0;
    const isFiring = now - lastFireTimeRef.current < 0.3;

    if (grounded && speedRatio < 0.05) {
      targetTimeScaleRef.current = 0.15;
    } else if (grounded) {
      targetTimeScaleRef.current = 0.4 + speedRatio * 0.4;
    } else if (isBoosting) {
      targetTimeScaleRef.current = 2.0;
    } else {
      targetTimeScaleRef.current = 0.5 + speedRatio * 0.9;
    }

    // Pick best animation:
    //   Dragon_Attack2 — boost/barrel-roll (longer, dramatic)
    //   Dragon_Attack  — firing (quick snap)
    //   Dragon_Hit     — took damage (reactive flinch)
    //   Dragon_Death   — dying
    //   Dragon_Flying  — default flight
    let wantAnim = "Dragon_Flying";
    if (isBoosting) {
      wantAnim = "Dragon_Attack2";
    } else if (isFiring) {
      wantAnim = "Dragon_Attack";
    }

    if (wantAnim !== activeAnimRef.current) {
      const prev = actions[activeAnimRef.current];
      const next = actions[wantAnim];
      if (next) {
        next.reset().fadeIn(0.25).play();
        if (prev) prev.fadeOut(0.25);
        activeAnimRef.current = wantAnim;
      }
    }

    // Smoothly lerp timeScale toward target
    const activeAction = actions[activeAnimRef.current];
    if (activeAction) {
      activeAction.timeScale = THREE.MathUtils.lerp(
        activeAction.timeScale,
        targetTimeScaleRef.current,
        5 * delta,
      );
    }

    // --- Walking simulation (bob + tilt when grounded) ---
    if (grounded && speedRatio > 0.05) {
      // Stride bob: vertical oscillation proportional to speed
      const bobFreq = 6 + speedRatio * 8; // faster strides at higher speed
      const bobAmp = 0.08 + speedRatio * 0.12; // subtle at slow, more at fast
      const bob = Math.sin(now * bobFreq) * bobAmp;
      scene.position.y = THREE.MathUtils.lerp(scene.position.y, bob, 8 * delta);
      // Forward tilt when moving on ground
      const tiltTarget = -0.15 - speedRatio * 0.1;
      scene.rotation.x = THREE.MathUtils.lerp(
        scene.rotation.x,
        tiltTarget,
        5 * delta,
      );
    } else if (grounded) {
      // Idle on ground: gentle breathing bob
      const idleBob = Math.sin(now * 1.5) * 0.02;
      scene.position.y = THREE.MathUtils.lerp(
        scene.position.y,
        idleBob,
        4 * delta,
      );
      scene.rotation.x = THREE.MathUtils.lerp(scene.rotation.x, 0, 4 * delta);
    } else {
      // Flying: reset to neutral
      scene.position.y = THREE.MathUtils.lerp(scene.position.y, 0, 6 * delta);
      // Slight pitch up when climbing, down when diving
      const pitchTarget = fvy > 5 ? -0.1 : fvy < -5 ? 0.15 : 0;
      scene.rotation.x = THREE.MathUtils.lerp(
        scene.rotation.x,
        pitchTarget,
        4 * delta,
      );
    }

    // --- Animate dragon material effects ---
    animateDragonEffects(meshListRef.current, dragon.effects, dragon.id, now);

    // Cloak opacity — only update meshes when state changes
    if (cloakRef.current !== prevCloakRef.current) {
      const opacity = cloakRef.current ? 0.2 : 1.0;
      for (const mesh of meshListRef.current) {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.transparent = opacity < 1;
          mesh.material.opacity = opacity;
        }
      }
      prevCloakRef.current = cloakRef.current;
    }

    if (cameraRef.current) {
      const pos = rbRef.current.translation();
      _camVec.set(pos.x, pos.y, pos.z);
      const isMoving = Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01;
      if (!pan.active && isMoving) {
        pan.yaw = THREE.MathUtils.lerp(pan.yaw, 0, 3 * delta);
        pan.pitch = THREE.MathUtils.lerp(pan.pitch, 0, 3 * delta);
      }
      const cameraYaw = visualGroupRef.current.rotation.y + pan.yaw;
      _camEuler.set(pan.pitch, cameraYaw, 0, "YXZ");
      _camQuat.setFromEuler(_camEuler);
      _camOffset.set(0, 3, 7).applyQuaternion(_camQuat).add(_camVec);
      const lerpSpeed = pan.active ? 15 : 5;
      cameraRef.current.position.lerp(_camOffset, lerpSpeed * delta);
      _lookAt.set(_camVec.x, _camVec.y + 1.5, _camVec.z);
      cameraRef.current.lookAt(_lookAt);
    }
  });

  return (
    <>
      <RigidBody
        ref={rbRef}
        type="kinematicVelocity"
        position={[0, 5, 0]}
        enabledRotations={[false, false, false]}
        colliders={false}
      >
        <group ref={visualGroupRef}>
          <primitive object={scene} />
        </group>
      </RigidBody>
      <PerspectiveCamera makeDefault ref={cameraRef} position={[0, 5, 10]} />
    </>
  );
}

function Projectiles() {
  const [projectiles, setProjectiles] = useState<any[]>([]);
  useEffect(() => {
    const handleShoot = (e: any) => {
      setProjectiles((prev) => [...prev, { ...e.detail, id: Math.random() }]);
    };
    fireballEmitter.addEventListener("shoot", handleShoot);
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setProjectiles((prev) =>
        prev.filter(
          (p) => now - p.timestamp < (p.attack?.lifetime ?? 3) * 1000,
        ),
      );
    }, 500);
    return () => {
      fireballEmitter.removeEventListener("shoot", handleShoot);
      clearInterval(cleanupInterval);
    };
  }, []);

  return (
    <group>
      {projectiles.map((p) => (
        <RigidBody
          key={p.id}
          position={p.position}
          colliders="ball"
          mass={2}
          linearVelocity={p.velocity}
          restitution={0.5}
          gravityScale={p.attack?.gravity ?? 0}
        >
          <ProjectileMesh
            attack={p.attack}
            size={PROJECTILE_SIZE.GAMEPLAY * p.attack.projectileSize}
            spin
          />
        </RigidBody>
      ))}
    </group>
  );
}

function Forest() {
  const trees = useMemo(
    () =>
      Array.from({ length: 50 })
        .map((_, i) => {
          const x = (Math.random() - 0.5) * 120;
          const z = (Math.random() - 0.5) * 120;
          const scale = 0.5 + Math.random() * 1.5;
          if (Math.abs(x) < 15 && Math.abs(z) < 15) return null;
          return {
            id: i,
            position: [x, 0, z] as [number, number, number],
            scale,
          };
        })
        .filter(Boolean),
    [],
  );

  return (
    <group>
      {trees.map((t: any) => (
        <RigidBody
          key={t.id}
          type="fixed"
          position={t.position}
          colliders="hull"
        >
          <group scale={t.scale}>
            <mesh castShadow receiveShadow position={[0, 1, 0]}>
              <cylinderGeometry args={[0.3, 0.4, 2]} />
              <meshStandardMaterial color="#4a3018" />
            </mesh>
            <mesh castShadow receiveShadow position={[0, 3, 0]}>
              <coneGeometry args={[1.5, 3, 8]} />
              <meshStandardMaterial color="#2d5c2f" />
            </mesh>
          </group>
        </RigidBody>
      ))}
    </group>
  );
}

export function SmashableCastle() {
  return (
    <group position={[0, 0.5, -25]}>
      {Array.from({ length: 4 }).map((_, y) =>
        Array.from({ length: 4 }).map((_, x) =>
          Array.from({ length: 4 }).map((_, z) => (
            <RigidBody
              key={`box-${x}-${y}-${z}`}
              position={[x * 2 - 3, y * 2 + 1, z * 2 - 3]}
              mass={0.5}
            >
              <mesh castShadow receiveShadow>
                <boxGeometry args={[1.9, 1.9, 1.9]} />
                <meshStandardMaterial color="#888" roughness={0.7} />
              </mesh>
            </RigidBody>
          )),
        ),
      )}
    </group>
  );
}

function Terrain() {
  return (
    <RigidBody type="fixed" friction={1}>
      <Plane args={[250, 250]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#3f8a4b" />
      </Plane>
    </RigidBody>
  );
}

const TOWER_POSITIONS: [number, number, number][] = [
  [-30, 0, -30],
  [25, 0, -40],
  [0, 0, -55],
];

const BEACON_POSITION: [number, number, number] = [0, 0, -42];

function Watchtower({
  position,
  id,
}: {
  position: [number, number, number];
  id: string;
}) {
  const hpRef = useRef(100);
  const destroyed = useRef(false);
  const meshRef = useRef<THREE.Group>(null);
  const lastShotRef = useRef(0);

  useFrame((state) => {
    if (destroyed.current || !meshRef.current) return;
    const now = state.clock.getElapsedTime();

    // Check player projectile proximity
    // (handled via projectile system — we check distance from tower to each projectile)
    // Tower shoots at player every 2 seconds
    if (now - lastShotRef.current > 2) {
      lastShotRef.current = now;
      const tx = position[0];
      const ty = position[1] + 8;
      const tz = position[2];
      const dx = playerPos.x - tx;
      const dy = playerPos.y - ty;
      const dz = playerPos.z - tz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 60) {
        const speed = 25;
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;
        const vz = (dz / dist) * speed;
        missionEmitter.dispatchEvent(
          new CustomEvent("enemy_shoot", {
            detail: {
              position: [tx, ty, tz],
              velocity: [vx, vy, vz],
              timestamp: Date.now(),
            },
          }),
        );
      }
    }
  });

  // Listen for hits
  useEffect(() => {
    const handleHit = (e: Event) => {
      if (destroyed.current) return;
      const detail = (e as CustomEvent).detail;
      if (detail.targetId !== id) return;
      hpRef.current -= detail.damage;
      if (hpRef.current <= 0) {
        destroyed.current = true;
        if (meshRef.current) meshRef.current.visible = false;
        missionEmitter.dispatchEvent(
          new CustomEvent("tower_destroyed", { detail: { id } }),
        );
      }
    };
    missionEmitter.addEventListener("tower_hit", handleHit);
    return () => missionEmitter.removeEventListener("tower_hit", handleHit);
  }, [id]);

  return (
    <group ref={meshRef} position={position}>
      {/* Stone base */}
      <mesh castShadow receiveShadow position={[0, 2, 0]}>
        <boxGeometry args={[3, 4, 3]} />
        <meshStandardMaterial color="#665544" roughness={0.9} />
      </mesh>
      {/* Tower shaft */}
      <mesh castShadow receiveShadow position={[0, 5.5, 0]}>
        <boxGeometry args={[2.2, 3, 2.2]} />
        <meshStandardMaterial color="#776655" roughness={0.85} />
      </mesh>
      {/* Battlement top */}
      <mesh castShadow receiveShadow position={[0, 7.5, 0]}>
        <boxGeometry args={[3.2, 1, 3.2]} />
        <meshStandardMaterial color="#554433" roughness={0.9} />
      </mesh>
      {/* Fire brazier glow */}
      <mesh position={[0, 8.5, 0]}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color="#ff4400" />
      </mesh>
      <pointLight
        position={[0, 8.5, 0]}
        color="#ff6600"
        intensity={3}
        distance={15}
      />
    </group>
  );
}

function BeaconObj({
  position,
  active,
}: {
  position: [number, number, number];
  active: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const [reached, setReached] = useState(false);

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * 0.5;
      ringRef.current.rotation.z += delta * 0.3;
    }
    if (active && !reached) {
      const dx = playerPos.x - position[0];
      const dy = playerPos.y - (position[1] + 10);
      const dz = playerPos.z - position[2];
      if (dx * dx + dy * dy + dz * dz < 36) {
        setReached(true);
        missionEmitter.dispatchEvent(new CustomEvent("beacon_reached"));
      }
    }
  });

  return (
    <group position={position}>
      {/* Base pillar */}
      <mesh castShadow receiveShadow position={[0, 3, 0]}>
        <cylinderGeometry args={[1.5, 2, 6, 8]} />
        <meshStandardMaterial color="#334455" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Beacon ring */}
      <mesh ref={ringRef} position={[0, 10, 0]}>
        <torusGeometry args={[3, 0.3, 8, 24]} />
        <meshStandardMaterial
          color={active ? "#ffd700" : "#333"}
          emissive={active ? "#ffd700" : "#000"}
          emissiveIntensity={active ? 1.5 : 0}
          metalness={0.5}
        />
      </mesh>
      {active && (
        <pointLight
          position={[0, 10, 0]}
          color="#ffd700"
          intensity={8}
          distance={30}
        />
      )}
      {!active && (
        <mesh position={[0, 10, 0]}>
          <sphereGeometry args={[0.8, 8, 8]} />
          <meshStandardMaterial color="#222" roughness={1} />
        </mesh>
      )}
    </group>
  );
}

function EnemyProjectiles() {
  const [projectiles, setProjectiles] = useState<any[]>([]);

  useEffect(() => {
    const handleShoot = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setProjectiles((prev) => [...prev, { ...detail, id: Math.random() }]);
    };
    missionEmitter.addEventListener("enemy_shoot", handleShoot);
    const cleanup = setInterval(() => {
      const now = Date.now();
      setProjectiles((prev) => prev.filter((p) => now - p.timestamp < 4000));
    }, 500);
    return () => {
      missionEmitter.removeEventListener("enemy_shoot", handleShoot);
      clearInterval(cleanup);
    };
  }, []);

  // Check proximity to player each frame
  useFrame(() => {
    for (const p of projectiles) {
      if (p.hit) continue;
      const age = (Date.now() - p.timestamp) / 1000;
      const px = p.position[0] + p.velocity[0] * age;
      const py = p.position[1] + p.velocity[1] * age;
      const pz = p.position[2] + p.velocity[2] * age;
      const dx = playerPos.x - px;
      const dy = playerPos.y - py;
      const dz = playerPos.z - pz;
      if (dx * dx + dy * dy + dz * dz < 2.5 * 2.5) {
        p.hit = true;
        missionEmitter.dispatchEvent(
          new CustomEvent("player_hit", { detail: { damage: 12 } }),
        );
      }
    }
  });

  return (
    <group>
      {projectiles.map((p) => (
        <EnemyProjectileMesh key={p.id} data={p} />
      ))}
    </group>
  );
}

function EnemyProjectileMesh({ data }: { data: any }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current || data.hit) return;
    const age = (Date.now() - data.timestamp) / 1000;
    meshRef.current.position.set(
      data.position[0] + data.velocity[0] * age,
      data.position[1] + data.velocity[1] * age,
      data.position[2] + data.velocity[2] * age,
    );
    meshRef.current.rotation.x += 0.2;
    meshRef.current.rotation.z += 0.15;
  });

  if (data.hit) return null;

  return (
    <mesh ref={meshRef}>
      <octahedronGeometry args={[0.4, 0]} />
      <meshBasicMaterial color="#ff3300" />
    </mesh>
  );
}

// ---- Race Checkpoint Rings ----

const CHECKPOINT_POSITIONS: [number, number, number][] = [
  [0, 8, -20],
  [20, 12, -35],
  [40, 6, -50],
  [30, 15, -70],
  [0, 10, -80],
  [-30, 18, -65],
  [-40, 8, -40],
  [-20, 14, -20],
];

function CheckpointRing({
  position,
  index,
  nextIndex,
}: {
  position: [number, number, number];
  index: number;
  nextIndex: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const isNext = index === nextIndex;
  const isPassed = index < nextIndex;

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * 0.8;
    }
    if (isNext && ringRef.current) {
      const dx = playerPos.x - position[0];
      const dy = playerPos.y - position[1];
      const dz = playerPos.z - position[2];
      if (dx * dx + dy * dy + dz * dz < 25) {
        missionEmitter.dispatchEvent(
          new CustomEvent("checkpoint_reached", { detail: { index } }),
        );
      }
    }
  });

  if (isPassed) return null;

  return (
    <group position={position}>
      <mesh ref={ringRef}>
        <torusGeometry args={[3.5, 0.25, 8, 24]} />
        <meshStandardMaterial
          color={isNext ? "#44bbff" : "#335566"}
          emissive={isNext ? "#44bbff" : "#000"}
          emissiveIntensity={isNext ? 1.5 : 0}
          transparent
          opacity={isNext ? 1 : 0.4}
        />
      </mesh>
      {isNext && <pointLight color="#44bbff" intensity={5} distance={20} />}
    </group>
  );
}

function RaceCheckpoints({ passedCount }: { passedCount: number }) {
  return (
    <group>
      {CHECKPOINT_POSITIONS.map((pos, i) => (
        <CheckpointRing
          key={i}
          position={pos}
          index={i}
          nextIndex={passedCount}
        />
      ))}
    </group>
  );
}

// ---- Wave Spawner (Survival Mission) ----

const WAVE_TOWER_POSITIONS: [number, number, number][][] = [
  // Wave 1: 2 towers
  [
    [-25, 0, -25],
    [25, 0, -25],
  ],
  // Wave 2: 3 towers, closer
  [
    [-20, 0, -20],
    [20, 0, -20],
    [0, 0, -35],
  ],
  // Wave 3: 4 towers, aggressive placement
  [
    [-30, 0, -15],
    [30, 0, -15],
    [-15, 0, -40],
    [15, 0, -40],
  ],
];

function WaveTowers({
  waveIndex,
  onWaveCleared,
}: {
  waveIndex: number;
  onWaveCleared: () => void;
}) {
  const positions = WAVE_TOWER_POSITIONS[waveIndex] ?? [];
  const [destroyedIds, setDestroyedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDestroyedIds(new Set());
  }, [waveIndex]);

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail.id;
      setDestroyedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        if (next.size >= positions.length) {
          setTimeout(() => onWaveCleared(), 500);
        }
        return next;
      });
    };
    missionEmitter.addEventListener("tower_destroyed", handler);
    return () => missionEmitter.removeEventListener("tower_destroyed", handler);
  }, [positions.length, onWaveCleared]);

  return (
    <group>
      {positions.map((pos, i) => {
        const id = `wave_${waveIndex}_tower_${i}`;
        if (destroyedIds.has(id)) return null;
        return <Watchtower key={id} position={pos} id={id} />;
      })}
    </group>
  );
}

// ---- Mission Timer ----

function MissionTimer({
  missionState,
  onTick,
}: {
  missionState: MissionRuntimeState;
  onTick: (elapsed: number) => void;
}) {
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
  }, [missionState.missionId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      onTick(elapsed);
    }, 200);
    return () => clearInterval(interval);
  }, [onTick]);

  return null;
}

// ---- HUD ----

function MissionHUD({ missionState }: { missionState: MissionRuntimeState }) {
  const mission = MISSIONS.find((m) => m.id === missionState.missionId);
  if (!mission) return null;
  const obj = mission.objectives[missionState.activeObjectiveIndex];
  const allDone =
    missionState.activeObjectiveIndex >= mission.objectives.length;

  const timeLeft = mission.timeLimitSeconds
    ? Math.max(0, mission.timeLimitSeconds - missionState.elapsedTime)
    : null;
  const timeUrgent = timeLeft !== null && timeLeft < 15;

  return (
    <div className="mission-hud">
      <div className="mission-hud-name">{mission.name}</div>
      {!allDone && obj && (
        <>
          <div className="mission-hud-objective">{obj.label}</div>
          {obj.requiredCount && obj.requiredCount > 1 && (
            <div className="mission-hud-progress">
              {missionState.progress[obj.id] ?? 0} / {obj.requiredCount}
            </div>
          )}
        </>
      )}
      {allDone && (
        <div className="mission-hud-objective" style={{ color: "#44ff88" }}>
          All objectives complete!
        </div>
      )}
      {timeLeft !== null && (
        <div
          className="mission-hud-progress"
          style={{
            color: timeUrgent ? "#ff4444" : "#aaa",
            fontSize: 18,
            fontWeight: 800,
            marginTop: 4,
          }}
        >
          {Math.ceil(timeLeft)}s
        </div>
      )}
      {mission.type === "hunter_ambush" && (
        <div className="mission-hud-progress" style={{ marginTop: 2 }}>
          Wave {Math.min(missionState.waveIndex + 1, 3)} / 3
        </div>
      )}
    </div>
  );
}

function HealthBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const color = pct > 50 ? "#44ff88" : pct > 25 ? "#ffc107" : "#ff4444";
  return (
    <div className="health-bar-container">
      <div className="health-bar-track">
        <div
          className="health-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="health-bar-label" style={{ color }}>
        HP {Math.ceil(hp)}/{maxHp}
      </div>
    </div>
  );
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const value = Number.parseInt(fullHex, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function getReadableAccent(dragon: DragonType) {
  const preferred =
    dragon.colors.eye === "#1A1A1A" ? dragon.colors.body : dragon.colors.eye;
  return relativeLuminance(preferred) < 0.14 ? dragon.colors.wing : preferred;
}

function getReadableTextColor(backgroundHex: string) {
  return relativeLuminance(backgroundHex) > 0.58 ? "#140f0b" : "#fff7ed";
}

function DragonSwitcher({
  current,
  onSwap,
}: {
  current: DragonType;
  onSwap: (d: DragonType) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tribe, setTribe] = useState<string>(current.tribe);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const tribeDragons = DRAGON_TYPES.filter((d) => d.tribe === tribe);
  const currentAccent = getReadableAccent(current);

  useEffect(() => {
    setTribe(current.tribe);
  }, [current.tribe]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        shellRef.current &&
        event.target instanceof Node &&
        !shellRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`switcher-shell ${open ? "open" : ""}`} ref={shellRef}>
      <button
        type="button"
        className="switcher-summary"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="dragon-switcher-panel"
        style={{
          borderColor: rgba(currentAccent, open ? 0.55 : 0.26),
          boxShadow: `0 18px 48px rgba(0, 0, 0, 0.36), 0 0 0 1px ${rgba(currentAccent, open ? 0.26 : 0.14)} inset`,
        }}
      >
        <div
          className="switcher-summary-swatch"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${current.colors.wing}, ${current.colors.body}, ${current.colors.bodyDark})`,
            boxShadow: `0 0 0 1px ${rgba(currentAccent, 0.28)} inset, 0 0 18px ${rgba(currentAccent, 0.18)}`,
          }}
        />
        <span
          className="switcher-summary-name"
          style={{ color: open ? "#fff7ed" : currentAccent }}
        >
          {current.name}
        </span>
        <span className="switcher-summary-chevron" aria-hidden="true">
          v
        </span>
      </button>

      <div
        id="dragon-switcher-panel"
        className="switcher-panel"
        style={{
          borderColor: rgba(currentAccent, 0.18),
          boxShadow: `0 24px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px ${rgba(currentAccent, 0.08)} inset`,
        }}
      >
        <div className="switcher-panel-top">
          <p className="switcher-title">Switch Dragon</p>
          <p className="switcher-subtitle">
            Swap mid-flight whenever you need a different edge.
          </p>
        </div>

        <div className="switcher-tribe-row">
          {TRIBES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`switcher-tribe-btn ${tribe === t.id ? "active" : ""}`}
              onClick={() => setTribe(t.id)}
              style={
                tribe === t.id
                  ? {
                      background: `linear-gradient(180deg, ${rgba(t.color, 0.34)}, ${rgba(t.color, 0.16)})`,
                      borderColor: rgba(t.color, 0.64),
                      boxShadow: `0 0 0 1px ${rgba(t.color, 0.14)} inset`,
                    }
                  : undefined
              }
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="switcher-list">
          {tribeDragons.map((d) => {
            const isCurrent = d.id === current.id;
            const accent = getReadableAccent(d);
            return (
              <button
                key={d.id}
                type="button"
                className={`switcher-item ${isCurrent ? "active" : ""}`}
                onClick={() => {
                  onSwap(d);
                  setOpen(false);
                }}
                style={{
                  borderColor: isCurrent
                    ? rgba(accent, 0.9)
                    : rgba(accent, 0.12),
                  background: isCurrent ? rgba(accent, 0.12) : undefined,
                  boxShadow: isCurrent
                    ? `0 0 0 1px ${rgba(accent, 0.2)} inset`
                    : undefined,
                }}
              >
                <div
                  className="switcher-swatch"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${d.colors.wing}, ${d.colors.body}, ${d.colors.bodyDark})`,
                    boxShadow: `0 0 0 1px ${rgba(accent, 0.22)} inset`,
                  }}
                />
                <div className="switcher-item-info">
                  <div className="switcher-item-head">
                    <p
                      className="switcher-item-name"
                      style={isCurrent ? { color: accent } : undefined}
                    >
                      {d.name}
                    </p>
                    {isCurrent && (
                      <span
                        className="switcher-current-badge"
                        style={{
                          background: accent,
                          color: getReadableTextColor(accent),
                        }}
                      >
                        Current
                      </span>
                    )}
                  </div>
                  <p className="switcher-item-ability">{d.ability}</p>
                </div>
                <div className="switcher-item-stats">
                  {[
                    d.stats.speed,
                    d.stats.firepower,
                    d.stats.agility,
                    d.stats.armor,
                  ].map((v, i) => {
                    const pct = Math.round((v / MAX_STAT) * 100);
                    const col =
                      v >= 1.2 ? "#4caf50" : v >= 0.9 ? "#ffc107" : "#ff5722";
                    return (
                      <div key={i} className="switcher-mini-bar">
                        <div
                          className="switcher-mini-fill"
                          style={{ height: `${pct}%`, background: col }}
                        />
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GameWorld({
  dragon,
  mission,
  onSwap,
  missionState,
  onMissionUpdate,
}: {
  dragon: DragonType;
  mission: MissionDefinition;
  onSwap: (d: DragonType) => void;
  missionState: MissionRuntimeState;
  onMissionUpdate: (s: MissionRuntimeState) => void;
}) {
  const [damageFlash, setDamageFlash] = useState(false);
  const beaconActive =
    missionState.completedObjectiveIds.includes("destroy_towers");
  const missionType = mission.type;

  // Collect all active tower positions for projectile collision checks
  const activeTowerPositions = useMemo(() => {
    if (missionType === "fortress_raid") return TOWER_POSITIONS;
    if (missionType === "hunter_ambush") {
      return WAVE_TOWER_POSITIONS[missionState.waveIndex] ?? [];
    }
    return [];
  }, [missionType, missionState.waveIndex]);

  // Listen for mission events
  useEffect(() => {
    const onTowerDestroyed = () => {
      if (missionType === "fortress_raid") {
        onMissionUpdate(
          advanceObjective(missionState, mission, "destroy_towers"),
        );
      }
    };
    const onBeaconReached = () => {
      if (missionType === "fortress_raid" && beaconActive) {
        onMissionUpdate(
          advanceObjective(missionState, mission, "activate_beacon"),
        );
      }
    };
    const onCheckpoint = () => {
      if (missionType === "beacon_run") {
        onMissionUpdate(advanceObjective(missionState, mission, "checkpoints"));
      }
    };
    const onPlayerHit = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      onMissionUpdate(applyDamage(missionState, detail.damage));
      setDamageFlash(true);
      setTimeout(() => setDamageFlash(false), 200);
    };
    missionEmitter.addEventListener("tower_destroyed", onTowerDestroyed);
    missionEmitter.addEventListener("beacon_reached", onBeaconReached);
    missionEmitter.addEventListener("checkpoint_reached", onCheckpoint);
    missionEmitter.addEventListener("player_hit", onPlayerHit);
    return () => {
      missionEmitter.removeEventListener("tower_destroyed", onTowerDestroyed);
      missionEmitter.removeEventListener("beacon_reached", onBeaconReached);
      missionEmitter.removeEventListener("checkpoint_reached", onCheckpoint);
      missionEmitter.removeEventListener("player_hit", onPlayerHit);
    };
  }, [missionType, beaconActive, missionState, mission, onMissionUpdate]);

  // Player projectile vs tower proximity check
  useEffect(() => {
    if (activeTowerPositions.length === 0) return;
    const handleShoot = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const checkInterval = setInterval(() => {
        const age = (Date.now() - detail.timestamp) / 1000;
        if (age > 3) {
          clearInterval(checkInterval);
          return;
        }
        const px = detail.position[0] + detail.velocity[0] * age;
        const py = detail.position[1] + detail.velocity[1] * age;
        const pz = detail.position[2] + detail.velocity[2] * age;
        for (let i = 0; i < activeTowerPositions.length; i++) {
          const [tx, , tz] = activeTowerPositions[i];
          const ty = 4;
          const dx = px - tx;
          const dy = py - ty;
          const dz = pz - tz;
          if (dx * dx + dy * dy + dz * dz < 16) {
            const tId =
              missionType === "fortress_raid"
                ? `tower_${i}`
                : `wave_${missionState.waveIndex}_tower_${i}`;
            missionEmitter.dispatchEvent(
              new CustomEvent("tower_hit", {
                detail: { targetId: tId, damage: 35 },
              }),
            );
            clearInterval(checkInterval);
            return;
          }
        }
      }, 50);
    };
    fireballEmitter.addEventListener("shoot", handleShoot);
    return () => fireballEmitter.removeEventListener("shoot", handleShoot);
  }, [activeTowerPositions, missionType, missionState.waveIndex]);

  // Wave advancement for survival missions
  const handleWaveCleared = useCallback(() => {
    const next = { ...missionState };
    next.waveIndex = missionState.waveIndex + 1;
    next.progress = { ...next.progress };
    next.progress["survive_waves"] = next.waveIndex;
    if (next.waveIndex >= 3) {
      next.completedObjectiveIds = [
        ...next.completedObjectiveIds,
        "survive_waves",
      ];
      next.activeObjectiveIndex = mission.objectives.length;
      next.succeeded = true;
    }
    onMissionUpdate(next);
  }, [missionState, mission, onMissionUpdate]);

  // Timer tick handler
  const handleTimerTick = useCallback(
    (elapsed: number) => {
      onMissionUpdate({ ...missionState, elapsedTime: elapsed });
      if (mission.timeLimitSeconds && elapsed >= mission.timeLimitSeconds) {
        onMissionUpdate({
          ...missionState,
          elapsedTime: elapsed,
          failed: true,
        });
      }
    },
    [missionState, mission, onMissionUpdate],
  );

  return (
    <div
      tabIndex={0}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        outline: "none",
        touchAction: "none",
      }}
    >
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: [0, 5, 10], fov: 60 }}
      >
        <Sky sunPosition={[100, 20, 100]} />
        <Environment preset="sunset" />
        <ambientLight intensity={0.3} />
        <directionalLight
          castShadow
          position={[50, 50, 20]}
          intensity={1.2}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
        />
        <Physics debug={false}>
          <Terrain />
          <Forest />

          {/* Fortress Raid: static towers + beacon */}
          {missionType === "fortress_raid" && (
            <>
              {TOWER_POSITIONS.map((pos, i) => (
                <Watchtower key={i} position={pos} id={`tower_${i}`} />
              ))}
              <BeaconObj position={BEACON_POSITION} active={beaconActive} />
            </>
          )}

          {/* Beacon Run: checkpoint rings */}
          {missionType === "beacon_run" && (
            <RaceCheckpoints
              passedCount={missionState.progress["checkpoints"] ?? 0}
            />
          )}

          {/* Hunter Ambush: wave-spawned towers */}
          {missionType === "hunter_ambush" && missionState.waveIndex < 3 && (
            <WaveTowers
              waveIndex={missionState.waveIndex}
              onWaveCleared={handleWaveCleared}
            />
          )}

          <BlockyDragon dragon={dragon} />
          <Projectiles />
          {missionType !== "beacon_run" && <EnemyProjectiles />}
        </Physics>
      </Canvas>

      <MissionTimer missionState={missionState} onTick={handleTimerTick} />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          if (e.target instanceof Element)
            e.target.setPointerCapture(e.pointerId);
          pan.active = e.pointerId;
          pan.lastX = e.clientX;
          pan.lastY = e.clientY;
        }}
        onPointerMove={(e) => {
          if (pan.active === e.pointerId) {
            pan.yaw += (e.clientX - pan.lastX) * -0.005;
            pan.pitch += (e.clientY - pan.lastY) * -0.005;
            pan.pitch = Math.max(
              -Math.PI / 3,
              Math.min(Math.PI / 3, pan.pitch),
            );
            pan.lastX = e.clientX;
            pan.lastY = e.clientY;
          }
        }}
        onPointerUp={(e) => {
          if (e.target instanceof Element)
            e.target.releasePointerCapture(e.pointerId);
          if (pan.active === e.pointerId) pan.active = 0;
        }}
        onPointerCancel={(e) => {
          if (e.target instanceof Element)
            e.target.releasePointerCapture(e.pointerId);
          if (pan.active === e.pointerId) pan.active = 0;
        }}
      />

      <MissionHUD missionState={missionState} />
      <HealthBar hp={missionState.playerHp} maxHp={missionState.maxHp} />
      <div className={`damage-vignette ${damageFlash ? "active" : ""}`} />

      <TouchControls dragon={dragon} joy={joy} abilityState={abilityState} />

      <DragonSwitcher current={dragon} onSwap={onSwap} />
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("dragon_select");
  const [selectedDragon, setSelectedDragon] = useState<DragonType | null>(null);
  const [currentMission, setCurrentMission] = useState<MissionDefinition>(
    MISSIONS[0],
  );
  const [missionState, setMissionState] = useState<MissionRuntimeState>(
    createMissionState(MISSIONS[0]),
  );

  // Check for mission end conditions
  useEffect(() => {
    if (screen !== "in_mission") return;
    if (missionState.succeeded) {
      setScreen("mission_success");
    } else if (missionState.failed) {
      setScreen("mission_fail");
    }
  }, [missionState, screen]);

  if (screen === "dragon_select" || !selectedDragon) {
    return (
      <DragonSelect
        onSelect={(d) => {
          setSelectedDragon(d);
          setScreen("mission_select");
        }}
      />
    );
  }

  if (screen === "mission_select") {
    return (
      <MissionSelect
        dragon={selectedDragon}
        onSelect={(m) => {
          setCurrentMission(m);
          setScreen("mission_brief");
        }}
        onBack={() => {
          setScreen("dragon_select");
        }}
      />
    );
  }

  if (screen === "mission_brief") {
    return (
      <MissionBrief
        mission={currentMission}
        dragon={selectedDragon}
        onStart={() => {
          setMissionState(createMissionState(currentMission));
          setScreen("in_mission");
        }}
        onBack={() => {
          setScreen("mission_select");
        }}
      />
    );
  }

  if (screen === "mission_success" || screen === "mission_fail") {
    return (
      <MissionResult
        mission={currentMission}
        dragon={selectedDragon}
        success={screen === "mission_success"}
        missionState={missionState}
        onRetry={() => {
          setMissionState(createMissionState(currentMission));
          setScreen("in_mission");
        }}
        onBack={() => {
          setScreen("mission_select");
        }}
      />
    );
  }

  return (
    <GameWorld
      dragon={selectedDragon}
      mission={currentMission}
      onSwap={setSelectedDragon}
      missionState={missionState}
      onMissionUpdate={setMissionState}
    />
  );
}
