import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera, useGLTF } from "@react-three/drei";
import { CapsuleCollider, RigidBody, useRapier, useBeforePhysicsStep } from "@react-three/rapier";
import type { RapierRigidBody, RapierCollider } from "@react-three/rapier";
import type { KinematicCharacterController } from "@dimforge/rapier3d-compat";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import type { DragonType } from "../dragons";
import { colorDragonModel, animateDragonEffects } from "../dragons";
import { keys, joy, pan, abilityState, playerPos, playerStatus, gameSession, xrInput, resetInput, shoot, missionEmitter, aim, combatFeedback, talonState, playerVelocity, carryState, clawInput } from "../game/runtime";
import { clampInput, damp, damping, flightVelocity } from "../game/flight";
import { createAbilityState, activateAbility, stepAbility } from "../game/abilities";
import { settings } from "../controls/ControlSettings";
import { configureFlightController, moveFlightCharacter, PLAYER_GROUPS, PLAYER_CAPSULE, flightMode } from "../game/characterMovement";
import { safeMuzzle, WORLD_ONLY } from "../game/aim";
import DragonAdornments from "./DragonAdornments";
import { useDragonAnimations } from "./useDragonAnimations";

const DRAGON_MODEL = `${import.meta.env.BASE_URL}dragon.glb`;

export default function PlayerDragon({ dragon }: { dragon: DragonType }) {
  const c = dragon.colors;
  const s = dragon.stats;
  const atk = dragon.attack;
  const spec = dragon.special;
  const rbRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const controllerRef = useRef<KinematicCharacterController | null>(null);
  const desiredVelocity = useRef({ x: 0, y: 0, z: 0 });
  const actualVelocity = useRef({ x: 0, y: 0, z: 0 });
  const visualGroupRef = useRef<THREE.Group>(null);

  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const cloakRef = useRef(false);
  const rollRef = useRef(0);
  const boostRef = useRef(0);

  const abilityRef = useRef(createAbilityState());

  useEffect(() => {
    resetInput();
    Object.assign(combatFeedback, { hitAt: -999, destroyedAt: -999 });
    gameSession.ready = true;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
      const key = e.key.toLowerCase();
      if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "shift", "f", "q", "g", "b"].includes(key)) return;
      e.preventDefault();
      if (gameSession.paused) return;
      keys[key] = true;
      if (key === "q" && !e.repeat) joy.special = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", resetInput);
    return () => {
      resetInput();
      gameSession.ready = false;
      talonState.ready = false;
      Object.assign(carryState, { speedFactor: 1, climbFactor: 1 });
      Object.assign(playerVelocity, { x: 0, y: 0, z: 0 });
      playerStatus.cloaked = false;
      playerStatus.invulnerable = false;
      Object.assign(abilityState, { cooldownLeft: 0, active: false, label: "" });
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", resetInput);
    };
  }, []);

  useEffect(() => {
    abilityRef.current = createAbilityState();
    prevCloakRef.current = false;
    cloakRef.current = false;
    boostRef.current = 0;
    rollRef.current = 0;
    playerStatus.cloaked = false;
    playerStatus.invulnerable = false;
  }, [dragon.id]);

  const lastFireTimeRef = useRef(-999);

  const { rapier, world } = useRapier();
  useEffect(() => {
    const controller = world.createCharacterController(PLAYER_CAPSULE.offset);
    configureFlightController(controller);
    controllerRef.current = controller;
    return () => { controllerRef.current = null; world.removeCharacterController(controller); };
  }, [world]);
  // Respawns (and test tooling) move the dragon instantly, dropping any momentum.
  useEffect(() => {
    const teleport = (event: Event) => {
      const target = (event as CustomEvent<{ x: number; y: number; z: number; heading?: number }>).detail;
      const body = rbRef.current;
      if (!body || ![target.x, target.y, target.z].every(Number.isFinite)) return;
      body.setTranslation(target, true);
      body.setNextKinematicTranslation(target);
      Object.assign(playerPos, { x: target.x, y: target.y, z: target.z });
      Object.assign(desiredVelocity.current, { x: 0, y: 0, z: 0 });
      Object.assign(actualVelocity.current, { x: 0, y: 0, z: 0 });
      if (Number.isFinite(target.heading) && visualGroupRef.current) visualGroupRef.current.rotation.y = target.heading!;
    };
    missionEmitter.addEventListener("player_teleport", teleport);
    return () => missionEmitter.removeEventListener("player_teleport", teleport);
  }, []);
  useBeforePhysicsStep(() => {
    if (gameSession.paused || !rbRef.current || !colliderRef.current || !controllerRef.current) return;
    const result = moveFlightCharacter(controllerRef.current, rbRef.current, colliderRef.current, desiredVelocity.current, world.timestep, rapier.QueryFilterFlags.EXCLUDE_SENSORS);
    Object.assign(actualVelocity.current, result.velocity);
  });
  const { scene: sourceScene, animations: rawAnimations } = useGLTF(DRAGON_MODEL);
  // The loader cache is shared with every selection preview. Own this skeleton/material set.
  const scene = useMemo(() => {
    const clone = SkeletonUtils.clone(sourceScene);
    colorDragonModel(clone, c, dragon.effects);
    clone.scale.setScalar(0.8);
    clone.rotation.y = Math.PI;
    return clone;
  }, [sourceScene, c, dragon.effects]);


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
  // Clips must be rebound to the new owned skeleton after a dragon swap.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawAnimations, scene]);

  const animation = useDragonAnimations(scene, animations);
  useEffect(() => () => {
    const ownedMaterials = new Set<THREE.Material>();
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const material = (child as THREE.Mesh).material;
        for (const item of Array.isArray(material) ? material : [material]) ownedMaterials.add(item);
      }
    });
    for (const material of ownedMaterials) material.dispose();
  }, [scene]);

  const activeAnimRef = useRef<string>("");
  const targetTimeScaleRef = useRef(1);
  const prevCloakRef = useRef(false);
  const meshListRef = useRef<THREE.Mesh[]>([]);
  // Hind feet carry treasure; they follow every animation clip, bank, and pitch.
  const feet = useMemo(() => ({ left: scene.getObjectByName("FeetL") ?? null, right: scene.getObjectByName("FeetR") ?? null }), [scene]);
  const _footWorld = useMemo(() => new THREE.Vector3(), []);
  const _bodyWorld = useMemo(() => new THREE.Vector3(), []);
  // In VR the hind legs swing toward the talon targets your hands set.
  const legs = useMemo(() => {
    const leg = (upper: string, foot: string) => {
      const bone = scene.getObjectByName(upper), tip = scene.getObjectByName(foot);
      return bone && tip ? { bone, tip, rest: bone.quaternion.clone() } : null;
    };
    return { left: leg("UpperLegL", "FeetL"), right: leg("UpperLegR", "FeetR") };
  }, [scene]);
  const legsReaching = useRef(false);
  const _leg = useMemo(() => ({ hip: new THREE.Vector3(), tip: new THREE.Vector3(), aim: new THREE.Vector3(), turn: new THREE.Quaternion(), limited: new THREE.Quaternion(), parent: new THREE.Quaternion(), identity: new THREE.Quaternion() }), []);

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
  const _inheritedVelocity = useMemo(() => new THREE.Vector3(), []);
  const _fireEuler = useMemo(() => new THREE.Euler(), []);
  const _ray = useMemo(
    () => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }),
    [rapier],
  );
  const _muzzleRay = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }), [rapier]);

  useEffect(() => {
    // The animation rig starts flying whenever the skeleton changes.
    activeAnimRef.current = "Dragon_Flying";

    if (scene) {

      // Cache mesh list for fast cloak updates (avoid per-frame traverse)
      const meshes: THREE.Mesh[] = [];
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
      });
      meshListRef.current = meshes;
    }
  }, [scene, animations]);

  useFrame((state, frameDelta) => {
    if (!rbRef.current || !visualGroupRef.current) return;
    const body = rbRef.current;
    if (gameSession.paused) { Object.assign(desiredVelocity.current, { x: 0, y: 0, z: 0 }); return; }
    const delta = Math.min(frameDelta, 1 / 15);
    const now = gameSession.elapsed;
    const inVR = state.gl.xr.isPresenting;
    const ability = abilityRef.current;
    let dx = clampInput(joy.left.x + (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0));
    let dz = clampInput(-joy.throttle - (keys["w"] || keys["arrowup"] ? 1 : 0) + (keys["s"] || keys["arrowdown"] ? 1 : 0));
    let dy = clampInput(joy.left.y + (keys[" "] ? 1 : 0) - (keys["shift"] ? 1 : 0));
    if (inVR) {
      dx = 0;
      dz = -xrInput.throttle;
      dy = xrInput.climb;
      visualGroupRef.current.rotation.y += xrInput.snapYaw;
      xrInput.snapYaw = 0;
    }

    const pos = body.translation();
    Object.assign(playerPos, pos);
    _ray.origin = { x: pos.x, y: pos.y + 0.1, z: pos.z };
    const hit = world.castRay(_ray, 250, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, WORLD_ONLY, undefined, body);
    const groundY = hit ? pos.y + 0.1 - hit.timeOfImpact : 0;
    const minAltitude = 1.2;
    const altitudeAboveGround = pos.y - groundY;
    const grounded = altitudeAboveGround <= minAltitude + 0.2;

    const burst = () => {
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        shoot({ position: [pos.x, pos.y + 1, pos.z], velocity: [Math.sin(a) * 40, 8, Math.cos(a) * 40], attack: atk });
      }
    };
    if (stepAbility(ability, delta, grounded)) burst();
    const wantsSpecial = inVR ? xrInput.special : joy.special;
    joy.special = false;
    xrInput.special = false;
    if (wantsSpecial && activateAbility(ability, spec)) {
      if (spec.type === "heal") missionEmitter.dispatchEvent(new CustomEvent("player_heal", { detail: { amount: 35 } }));
      if (spec.type === "scatter_shot") burst();
      if (spec.type === "ground_slam" && grounded) { burst(); ability.remaining = 0; ability.type = null; }
    }
    boostRef.current = ability.type === "boost" ? ability.remaining : 0;
    rollRef.current = ability.type === "barrel_roll" ? ability.remaining : 0;
    cloakRef.current = ability.type === "cloak";
    playerStatus.cloaked = cloakRef.current;
    playerStatus.invulnerable = rollRef.current > 0;
    Object.assign(abilityState, { cooldownLeft: ability.cooldown, label: spec.label, active: ability.remaining > 0 });

    const baseMaxSpeed = 20 * s.speed;
    const requestedSpeed = (boostRef.current > 0 ? baseMaxSpeed * 2 : baseMaxSpeed) * settings.speedSensitivity * carryState.speedFactor;
    const airborneSpeed = inVR ? Math.min(12, requestedSpeed) : requestedSpeed;
    const maxSpeed = grounded && dy <= 0 && ability.type !== "updraft" ? Math.min(6 * s.speed, airborneSpeed) : airborneSpeed;
    if (boostRef.current > 0) dz = Math.min(dz, -0.75);
    const braking = inVR ? xrInput.brake : keys.b || joy.brake;
    const gliding = (inVR ? xrInput.glide : keys.g || joy.glide) && !grounded && !braking && !ability.type;
    visualGroupRef.current.rotation.y -= dx * 2.5 * s.agility * settings.turnSensitivity * delta;
    playerStatus.heading = visualGroupRef.current.rotation.y;
    const bankStrength = grounded ? 0 : (0.35 + 0.65 * Math.min(1, Math.hypot(actualVelocity.current.x, actualVelocity.current.z) / Math.max(1, baseMaxSpeed))) * (gliding ? 0.6 : 1);
    const targetBank = rollRef.current > 0 ? (rollRef.current / Math.max(spec.duration, 0.1)) * Math.PI * 4 : -dx * Math.PI / 6 * bankStrength;
    visualGroupRef.current.rotation.z = rollRef.current > 0 ? targetBank : damp(visualGroupRef.current.rotation.z, targetBank, 10, delta);
    const override = ability.type === "ground_slam" ? -60 : ability.type === "updraft" ? 40 * Math.min(1, ability.remaining / 0.25) : undefined;
    const velocity = flightVelocity(actualVelocity.current, { forward: dz, climb: dy }, playerStatus.heading, maxSpeed, settings.climbSensitivity * carryState.climbFactor, altitudeAboveGround, delta, override, { glide: Boolean(gliding), brake: Boolean(braking), agility: s.agility, grounded, speedCeiling: inVR ? 12 : undefined });
    const tvx = velocity.x, fvy = velocity.y, tvz = velocity.z;
    Object.assign(desiredVelocity.current, velocity);
    Object.assign(playerVelocity, actualVelocity.current);
    playerStatus.flightMode = gliding ? "glide" : braking ? "braking" : flightMode(grounded, altitudeAboveGround, actualVelocity.current);
    playerStatus.speed = Math.hypot(actualVelocity.current.x, actualVelocity.current.y, actualVelocity.current.z);

    // Aim feedback and emitted shots share the same muzzle and central direction.
    _muzzleOffset.set(0, 1.2, -3);
    _muzzleEuler.set(0, playerStatus.heading, 0);
    _muzzleOffset.applyEuler(_muzzleEuler);
    _spawnPos.set(pos.x, pos.y, pos.z).add(_muzzleOffset);
    // Do not let a long visual muzzle fire from the far side of a wall.
    const muzzle = safeMuzzle(world, _muzzleRay, { x: pos.x, y: pos.y + 0.4, z: pos.z }, _spawnPos, rapier.QueryFilterFlags.EXCLUDE_SENSORS);
    _spawnPos.set(muzzle.x, muzzle.y, muzzle.z);
    Object.assign(aim.origin, { x: _spawnPos.x, y: _spawnPos.y, z: _spawnPos.z });
    _fireVel.set(0, Math.sin(dy * 0.45) * 50 * atk.projectileSpeed, -Math.cos(dy * 0.45) * 50 * atk.projectileSpeed).applyEuler(_muzzleEuler).add(_inheritedVelocity.set(tvx, fvy, tvz)).normalize();
    Object.assign(aim.direction, { x: _fireVel.x, y: _fireVel.y, z: _fireVel.z });

    // Fire is sampled from the active input; releasing F cannot latch the touch button.
    const wantsFire = inVR ? xrInput.fire : keys["f"] || joy.fire;
    if (wantsFire && now - lastFireTimeRef.current > 0.15 / s.firepower) {
      lastFireTimeRef.current = now;
      const ry = playerStatus.heading;
      const angle = dy * 0.45;
      for (let i = 0; i < atk.count; i++) {
        const spread = atk.count > 1 ? -atk.spread / 2 + atk.spread / (atk.count - 1) * i : 0;
        _fireVel.set(0, Math.sin(angle) * 50 * atk.projectileSpeed, -Math.cos(angle) * 50 * atk.projectileSpeed);
        _fireEuler.set(0, ry + spread, 0);
        _fireVel.applyEuler(_fireEuler).add(_inheritedVelocity.set(tvx, fvy, tvz));
        shoot({ position: [_spawnPos.x, _spawnPos.y, _spawnPos.z], velocity: [_fireVel.x, _fireVel.y, _fireVel.z], attack: atk });
      }
    }

    // Dynamic animation: vary flap speed and crossfade based on movement
    const horizontalSpeed = Math.sqrt(tvx * tvx + tvz * tvz);
    const speedRatio = horizontalSpeed / baseMaxSpeed; // 0 = still, ~1 = full speed, ~2 = boosted
    const isBoosting = boostRef.current > 0 || rollRef.current > 0;
    const isFiring = now - lastFireTimeRef.current < 0.3;

    if (grounded && speedRatio < 0.05) {
      targetTimeScaleRef.current = 0.15;
    } else if (grounded) {
      targetTimeScaleRef.current = 0.4 + speedRatio * 0.4;
    } else if (gliding) {
      targetTimeScaleRef.current = 0.12;
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

    const actions = animation.current.actions;
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
        damping(5, delta),
      );
    }

    // --- Walking simulation (bob + tilt when grounded) ---
    if (grounded && speedRatio > 0.05) {
      // Stride bob: vertical oscillation proportional to speed
      const bobFreq = 6 + speedRatio * 8; // faster strides at higher speed
      const bobAmp = 0.08 + speedRatio * 0.12; // subtle at slow, more at fast
      const bob = Math.sin(now * bobFreq) * bobAmp;
      scene.position.y = THREE.MathUtils.lerp(scene.position.y, bob, damping(8, delta));
      // Forward tilt when moving on ground
      const tiltTarget = -0.15 - speedRatio * 0.1;
      scene.rotation.x = THREE.MathUtils.lerp(
        scene.rotation.x,
        tiltTarget,
        damping(5, delta),
      );
    } else if (grounded) {
      // Idle on ground: gentle breathing bob
      const idleBob = Math.sin(now * 1.5) * 0.02;
      scene.position.y = THREE.MathUtils.lerp(
        scene.position.y,
        idleBob,
        damping(4, delta),
      );
      scene.rotation.x = THREE.MathUtils.lerp(scene.rotation.x, 0, damping(4, delta));
    } else {
      // Flying: reset to neutral
      scene.position.y = THREE.MathUtils.lerp(scene.position.y, 0, damping(6, delta));
      // Pitch up when climbing, down when diving — proportional to input
      const pitchTarget = -dy * 0.35 * settings.climbSensitivity;
      scene.rotation.x = THREE.MathUtils.lerp(
        scene.rotation.x,
        pitchTarget,
        damping(4, delta),
      );
    }

    // Publish claw positions for treasure. The physics group can lag one frame behind the
    // body, so measure each foot relative to it and re-anchor on this frame's translation.
    const bodyGroup = visualGroupRef.current.parent;
    const reaching = inVR && clawInput.active;
    if (bodyGroup && (reaching || legsReaching.current)) {
      bodyGroup.getWorldPosition(_bodyWorld);
      for (const side of ["left", "right"] as const) {
        const leg = legs[side];
        if (!leg) continue;
        leg.bone.quaternion.copy(leg.rest);
        const hand = clawInput[side];
        if (!reaching || !hand.tracked) continue;
        const { hip, tip, aim: target, turn, parent, identity } = _leg;
        leg.bone.getWorldPosition(hip).sub(_bodyWorld).add(pos as THREE.Vector3Like);
        leg.tip.getWorldPosition(tip).sub(_bodyWorld).add(pos as THREE.Vector3Like).sub(hip).normalize();
        target.set(hand.target.x - hip.x, hand.target.y - hip.y, hand.target.z - hip.z);
        if (target.lengthSq() < 1e-6) continue;
        turn.setFromUnitVectors(tip, target.normalize());
        const angle = 2 * Math.acos(Math.min(1, Math.abs(turn.w)));
        if (angle > 1.3) turn.copy(_leg.limited.copy(identity).slerp(turn, 1.3 / angle));
        leg.bone.parent!.getWorldQuaternion(parent);
        leg.bone.quaternion.copy(parent).invert().multiply(turn).multiply(parent).multiply(leg.rest);
      }
      legsReaching.current = reaching;
    }
    if (feet.left && feet.right && bodyGroup) {
      bodyGroup.getWorldPosition(_bodyWorld);
      for (const side of ["left", "right"] as const) {
        feet[side]!.getWorldPosition(_footWorld).sub(_bodyWorld);
        Object.assign(talonState[side], { x: pos.x + _footWorld.x, y: pos.y + _footWorld.y, z: pos.z + _footWorld.z });
      }
      talonState.ready = true;
    }

    // --- Animate dragon material effects ---
    animateDragonEffects(meshListRef.current, dragon.effects, dragon.id, now);

    // Cloak opacity — only update meshes when state changes
    if (cloakRef.current !== prevCloakRef.current) {
      const opacity = cloakRef.current ? 0.2 : 1.0;
      for (const mesh of meshListRef.current) {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          const baseOpacity = mesh.material.name === "Wings" ? dragon.effects?.wingOpacity ?? 0.88 : 1;
          mesh.material.transparent = baseOpacity < 1 || cloakRef.current;
          mesh.material.opacity = baseOpacity * opacity;
        }
      }
      scene.traverse(child => {
        if (!(child as THREE.Mesh).isMesh || meshListRef.current.includes(child as THREE.Mesh)) return;
        const material = (child as THREE.Mesh).material;
        if (material instanceof THREE.MeshStandardMaterial) {
          material.transparent = cloakRef.current;
          material.opacity = opacity;
        }
      });
      prevCloakRef.current = cloakRef.current;
    }

    if (cameraRef.current && !inVR) {
      const targetFov = 60 + Math.min(1, playerStatus.speed / Math.max(1, baseMaxSpeed)) * 7;
      const fov = damp(cameraRef.current.fov, targetFov, 2, delta);
      if (Math.abs(fov - cameraRef.current.fov) > 0.01) {
        cameraRef.current.fov = fov;
        cameraRef.current.updateProjectionMatrix();
      }
      const pos = rbRef.current.translation();
      _camVec.set(pos.x, pos.y, pos.z);
      const isMoving = Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01;
      if (!pan.active && isMoving) {
        pan.yaw = THREE.MathUtils.lerp(pan.yaw, 0, damping(3, delta));
        pan.pitch = THREE.MathUtils.lerp(pan.pitch, 0, damping(3, delta));
      }
      const cameraYaw = visualGroupRef.current.rotation.y + pan.yaw;
      _camEuler.set(pan.pitch, cameraYaw, 0, "YXZ");
      _camQuat.setFromEuler(_camEuler);
      _camOffset.set(0, 3, 7).applyQuaternion(_camQuat).add(_camVec);
      const lerpSpeed = pan.active ? 15 : 5;
      cameraRef.current.position.lerp(_camOffset, damping(lerpSpeed, delta));
      _lookAt.set(_camVec.x, _camVec.y + 1.5, _camVec.z);
      cameraRef.current.lookAt(_lookAt);
    }
  });

  return (
    <>
      <RigidBody
        ref={rbRef}
        type="kinematicPosition"
        position={[0, 5, 0]}
        enabledRotations={[false, false, false]}
        colliders={false}
        collisionGroups={PLAYER_GROUPS}
      >
        <CapsuleCollider ref={colliderRef} args={[PLAYER_CAPSULE.halfHeight, PLAYER_CAPSULE.radius]} collisionGroups={PLAYER_GROUPS} />
        <group ref={visualGroupRef}>
          <primitive object={scene} />
          <DragonAdornments dragon={dragon} scene={scene} />
        </group>
      </RigidBody>
      <PerspectiveCamera makeDefault ref={cameraRef} position={[0, 5, 10]} />
    </>
  );
}
