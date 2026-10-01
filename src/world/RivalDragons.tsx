import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useGLTF } from "@react-three/drei";
import { BallCollider, RigidBody, interactionGroups } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { DRAGON_TYPES, colorDragonModel } from "../dragons";
import type { DragonType } from "../dragons";
import { terrainHeight } from "../game/landscape";
import { lootHolders, lootHud, lootToast } from "../game/lootRuntime";
import { finalizeInstances, renderingBudget } from "../game/rendering";
import {
  RIVAL, RIVALS, createRivalState, hitRival, isKin, lineOfSight, maxHp, rivalGround, stepDormantRival, stepRival,
} from "../game/rivals";
import type { RivalDef, RivalEvent, RivalKingdom, RivalState } from "../game/rivals";
import { rivalHud, resetRivalHud } from "../game/rivalRuntime";
import { gameSession, missionEmitter, playerPos, playerStatus, playerVelocity } from "../game/runtime";
import { KINGDOM_BY_ID, kingdomAt } from "../game/world";
import type { KingdomId } from "../game/world";
import { ROYAL_HOARDS } from "../game/worldSites";
import { device } from "../utils/device";
import DragonAdornments from "./DragonAdornments";
import { useDragonAnimations } from "./useDragonAnimations";

const MODEL = `${import.meta.env.BASE_URL}dragon.glb`;
const budget = renderingBudget(device);
/** Nearest rivals get the full animated model; the rest are silhouettes against the sky. */
const DETAIL_RANGE = budget.constrained ? 120 : 190;
const MAX_ACTORS = budget.constrained ? 4 : 8;
const SILHOUETTE_RANGE = budget.worldFog[1] + 80;
/** Rivals this far from you just circle (no senses) until you come closer. */
const DORMANT_RANGE = 520;
const ground = rivalGround((x, z) => terrainHeight(x, z, "open"));
const typeOf = (def: RivalDef) => DRAGON_TYPES.find(type => type.id === def.tribe)!;
const tribeName = (def: RivalDef) => typeOf(def).name.replace(/ II$/, "");

const WARNINGS: Record<RivalKingdom, readonly string[]> = {
  sky: ["Turn back! These skies belong to the SkyWing queen!", "No outsiders past the red peaks!"],
  ice: ["You rank last here, outsider. Leave.", "The Ice Kingdom is closed to the likes of you!"],
  mud: ["Hey! This is our marsh!", "Big Brother says go away!"],
  rainforest: ["Shoo! You're scaring the sloths!", "We see you, intruder. Leave the canopy."],
  sand: ["The dunes have eyes, trespasser. Go home.", "Every grain of sand here is ours!"],
  pantala: ["The Hive does not welcome strangers!", "Leave the hive towers alone!"],
  glaeryus: ["Glaeryus remembers its enemies. Turn around.", "No one crosses the basalt without leave!"],
  sea: ["Get away from our coast!", "The waves are SeaWing waves!"],
};

interface RivalSim {
  states: RivalState[];
  sight: { timer: number; sees: boolean }[];
  alarms: Map<KingdomId, number>;
  /** Last toast per rival and kind, so warnings never spam. */
  spoke: Map<string, number>;
  tribe: string;
}

function announce(sim: RivalSim, key: string, text: string, tone: "info" | "warn" | "gold" | "legend" = "warn", gap = 6) {
  const now = gameSession.elapsed;
  if (now - (sim.spoke.get(key) ?? -99) < gap) return;
  sim.spoke.set(key, now);
  lootToast(text, tone);
}

/** Turn a rival's step events into treasure moves, toasts, and sounds. */
function handleEvents(sim: RivalSim, index: number, events: readonly RivalEvent[]) {
  const def = RIVALS[index];
  const state = sim.states[index];
  const holder = `rival:${def.id}`;
  const kingdom = KINGDOM_BY_ID.get(def.kingdom)!;
  const near = Math.hypot(playerPos.x - state.x, playerPos.z - state.z) < 260;
  for (const event of events) {
    if (event === "warn") {
      const lines = WARNINGS[def.kingdom];
      announce(sim, `${def.id}:warn`, `${def.name} the ${tribeName(def)}: "${lines[index % lines.length]}"`, "warn", 12);
      missionEmitter.dispatchEvent(new CustomEvent("rival_roar", { detail: { id: def.id, champion: def.champion } }));
    } else if (event === "engage") {
      announce(sim, `${def.id}:engage`, `${def.name} attacks!`, "warn", 10);
      missionEmitter.dispatchEvent(new CustomEvent("rival_roar", { detail: { id: def.id, champion: def.champion } }));
    } else if (event === "snatch") {
      const steal = new CustomEvent<{ holder: string; name: string; result: string | null }>("loot_steal", { detail: { holder, name: def.name, result: null } });
      missionEmitter.dispatchEvent(steal);
      if (steal.detail.result) sim.states[index] = { ...sim.states[index], carrying: steal.detail.result, mode: "carry", timer: 0 };
    } else if (event === "stash") {
      const hoard = ROYAL_HOARDS[def.kingdom];
      missionEmitter.dispatchEvent(new CustomEvent("loot_holder_stash", { detail: { holder, spot: { x: hoard.x, y: hoard.y + 0.4, z: hoard.z } } }));
      if (near) lootToast(`${def.name} piled your treasure on the ${kingdom.name}'s royal hoard. Steal it back!`, "info");
    } else if (event === "drop") {
      missionEmitter.dispatchEvent(new CustomEvent("loot_holder_drop", { detail: { holder } }));
      lootToast(`${def.name} dropped it! Catch it!`, "gold");
    } else if (event === "downed") {
      lootToast(def.champion ? `${def.name}, champion of the ${kingdom.name}, yields! The royal hoard is unguarded.` : `${def.name} yields!`, def.champion ? "legend" : "gold");
      missionEmitter.dispatchEvent(new CustomEvent("impact", { detail: { position: { x: state.x, y: state.y, z: state.z }, color: typeOf(def).attack.color1, large: true } }));
    } else if (event === "retreat") {
      announce(sim, `${def.id}:retreat`, `${def.name} flees!`, "info", 4);
    }
  }
}

/** The simulation of every rival, and the actors and silhouettes that show it. */
export default function RivalDragons({ dragon }: { dragon: DragonType }) {
  // One simulation per flight: switching dragons changes who counts as kin, not where rivals are.
  const [sim] = useState<RivalSim>(() => ({
    states: RIVALS.map(def => createRivalState(def, ground)),
    sight: RIVALS.map((_, i) => ({ timer: (i % 5) * 0.05, sees: false })),
    alarms: new Map(),
    spoke: new Map(),
    tribe: dragon.id,
  }));
  const [active, setActive] = useState<number[]>([]);
  const activeRef = useRef<number[]>([]);
  const timers = useRef({ active: 0, hud: 0 });

  useEffect(() => {
    sim.tribe = dragon.id;
  }, [sim, dragon.id]);

  useEffect(() => {
    const hit = (event: Event) => {
      const { targetId, damage } = (event as CustomEvent<{ targetId?: string; damage: number }>).detail;
      if (!targetId?.startsWith("rival:") || gameSession.paused) return;
      const index = RIVALS.findIndex(def => `rival:${def.id}` === targetId);
      if (index < 0) return;
      const result = hitRival(RIVALS[index], sim.states[index], damage);
      sim.states[index] = result.state;
      handleEvents(sim, index, result.events);
    };
    const alarm = (event: Event) => {
      const { kingdom, item } = (event as CustomEvent<{ kingdom: RivalKingdom; item: string }>).detail;
      sim.alarms.set(kingdom, gameSession.elapsed + 60);
      lootToast(`The ${KINGDOM_BY_ID.get(kingdom)!.name} is on alert! Every dragon there wants the ${item} back!`, "legend");
    };
    const knockout = () => {
      // You were driven off: the chase is over and nobody holds a grudge for long.
      sim.states = sim.states.map(state => ["chase", "windup", "evade", "warn"].includes(state.mode) ? { ...state, mode: "return", anger: 0, timer: 0 } : { ...state, anger: 0 });
      sim.alarms.clear();
    };
    missionEmitter.addEventListener("tower_hit", hit);
    missionEmitter.addEventListener("kingdom_alarm", alarm);
    missionEmitter.addEventListener("player_knockout", knockout);
    return () => {
      missionEmitter.removeEventListener("tower_hit", hit);
      missionEmitter.removeEventListener("kingdom_alarm", alarm);
      missionEmitter.removeEventListener("player_knockout", knockout);
      for (const def of RIVALS) lootHolders.delete(`rival:${def.id}`);
      resetRivalHud();
    };
  }, [sim]);

  useFrame((_, frameDelta) => {
    if (gameSession.paused || !gameSession.ready) return;
    const delta = Math.min(frameDelta, 1 / 15);
    const now = gameSession.elapsed;
    const playerKingdom = kingdomAt(playerPos.x, playerPos.z).id;
    const carrying = Boolean(lootHud.left || lootHud.right);
    for (let i = 0; i < RIVALS.length; i++) {
      const def = RIVALS[i];
      const state = sim.states[i];
      const horizontal = Math.hypot(playerPos.x - state.x, playerPos.z - state.z);
      if (horizontal > DORMANT_RANGE && (state.mode === "patrol" || state.mode === "return" || state.mode === "downed")) {
        sim.states[i] = stepDormantRival(def, state, delta, ground);
      } else {
        const sight = sim.sight[i];
        sight.timer -= delta;
        if (horizontal > (def.champion ? RIVAL.championSight : RIVAL.sight)) sight.sees = false;
        else if (sight.timer <= 0) {
          sight.timer = 0.25;
          sight.sees = lineOfSight(state, playerPos, ground);
        }
        const result = stepRival(def, state, {
          player: playerPos, playerVelocity, playerTribe: sim.tribe, playerKingdom, carrying,
          cloaked: playerStatus.cloaked, alarm: (sim.alarms.get(def.kingdom) ?? 0) > now, sees: sight.sees, ground,
        }, delta);
        sim.states[i] = result.state;
        if (result.events.length) handleEvents(sim, i, result.events);
        if (result.shot) {
          const breath = typeOf(def).attack.color1;
          missionEmitter.dispatchEvent(new CustomEvent("enemy_shoot", { detail: { ...result.shot, color: breath, size: def.champion ? 2.4 : 1.8 } }));
        }
      }
      const current = sim.states[i];
      const holder = lootHolders.get(`rival:${def.id}`);
      if (holder) Object.assign(holder, { x: current.x, y: current.y, z: current.z, vx: current.vx, vy: current.vy, vz: current.vz });
      else lootHolders.set(`rival:${def.id}`, { x: current.x, y: current.y, z: current.z, vx: current.vx, vy: current.vy, vz: current.vz, carry: "claws" });
    }

    // Which rivals get full models: the nearest few, kept a little longer once shown.
    timers.current.active -= delta;
    if (timers.current.active <= 0) {
      timers.current.active = 0.4;
      const ranked = sim.states
        .map((state, index) => ({ index, distance: Math.hypot(state.x - playerPos.x, state.y - playerPos.y, state.z - playerPos.z) }))
        .filter(item => item.distance < DETAIL_RANGE + (activeRef.current.includes(item.index) ? 40 : 0))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MAX_ACTORS)
        .map(item => item.index)
        .sort((a, b) => a - b);
      if (ranked.join() !== activeRef.current.join()) {
        activeRef.current = ranked;
        setActive(ranked);
      }
    }

    // The HUD: who is after you, and where is the nearest of them.
    timers.current.hud -= delta;
    if (timers.current.hud <= 0) {
      timers.current.hud = 0.2;
      let chasing = 0, warning = 0, nearest: typeof rivalHud.nearest = null;
      sim.states.forEach((state, index) => {
        const engaged = state.mode === "chase" || state.mode === "windup" || state.mode === "evade";
        if (engaged) chasing++;
        if (state.mode === "warn") warning++;
        if (!engaged && state.mode !== "warn") return;
        const distance = Math.hypot(state.x - playerPos.x, state.y - playerPos.y, state.z - playerPos.z);
        if (nearest && nearest.distance < distance) return;
        const def = RIVALS[index];
        let bearing = Math.atan2(-(state.x - playerPos.x), -(state.z - playerPos.z)) - playerStatus.heading;
        bearing = Math.atan2(Math.sin(bearing), Math.cos(bearing));
        nearest = { name: def.name, tribe: tribeName(def), mode: state.mode, distance, bearing, hp: state.hp, maxHp: maxHp(def), champion: def.champion };
      });
      let alarm: typeof rivalHud.alarm = null;
      for (const [kingdom, until] of sim.alarms) {
        if (until > now && (!alarm || until - now > alarm.remaining)) alarm = { kingdom, name: KINGDOM_BY_ID.get(kingdom)!.name, remaining: until - now };
      }
      Object.assign(rivalHud, { chasing, warning, nearest, alarm });
    }
  }, -1);

  return <>
    {active.map(index => <RivalActor key={RIVALS[index].id} index={index} sim={sim} />)}
    <RivalSilhouettes sim={sim} active={active} />
  </>;
}

/** A name plate drawn once per rival: red for rivals, green for your tribe's kin. */
function useNamePlate(def: RivalDef, kin: boolean) {
  const plate = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 112;
    const context = canvas.getContext("2d")!;
    context.textAlign = "center";
    context.font = "bold 46px sans-serif";
    context.lineWidth = 8;
    context.strokeStyle = "rgba(10, 8, 12, 0.85)";
    context.fillStyle = kin ? "#9dffbf" : def.champion ? "#ffd27a" : "#ff9d80";
    const title = `${def.champion ? "★ " : ""}${def.name}`;
    context.strokeText(title, 256, 52, 500);
    context.fillText(title, 256, 52, 500);
    context.font = "30px sans-serif";
    context.fillStyle = "#f2e8dc";
    const subtitle = `${tribeName(def)}${kin ? " · kin" : ""}`;
    context.strokeText(subtitle, 256, 96, 500);
    context.fillText(subtitle, 256, 96, 500);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [def, kin]);
  useEffect(() => () => plate.dispose(), [plate]);
  return plate;
}

function RivalActor({ index, sim }: { index: number; sim: RivalSim }) {
  const def = RIVALS[index];
  const type = typeOf(def);
  const body = useRef<RapierRigidBody>(null);
  const facing = useRef<THREE.Group>(null);
  const tag = useRef<THREE.Group>(null);
  const healthBar = useRef<THREE.Mesh>(null);
  const breath = useRef<THREE.Mesh>(null);
  const [kin, setKin] = useState(() => isKin(def, sim.tribe));
  const plate = useNamePlate(def, kin);
  const bank = useRef(0);
  const lastHeading = useRef(sim.states[index].heading);

  const { scene: source, animations } = useGLTF(MODEL);
  const scene = useMemo(() => {
    const clone = SkeletonUtils.clone(source);
    colorDragonModel(clone, type.colors, type.effects);
    clone.scale.setScalar(def.champion ? 1.08 : 0.8);
    clone.rotation.y = Math.PI;
    return clone;
  }, [source, type, def.champion]);
  const rig = useDragonAnimations(scene, animations);
  useEffect(() => () => {
    const owned = new Set<THREE.Material>();
    scene.traverse(child => {
      if (!(child as THREE.Mesh).isMesh) return;
      const material = (child as THREE.Mesh).material;
      for (const item of Array.isArray(material) ? material : [material]) owned.add(item);
    });
    owned.forEach(material => material.dispose());
  }, [scene]);

  useFrame((_, frameDelta) => {
    const state = sim.states[index];
    if (!body.current || !facing.current) return;
    body.current.setNextKinematicTranslation({ x: state.x, y: state.y, z: state.z });
    const delta = Math.min(frameDelta, 1 / 15);
    // Bank into turns; lie on one side when yielding.
    const turn = Math.atan2(Math.sin(state.heading - lastHeading.current), Math.cos(state.heading - lastHeading.current)) / Math.max(delta, 1e-3);
    lastHeading.current = state.heading;
    bank.current += (Math.max(-0.7, Math.min(0.7, -turn * 0.35)) - bank.current) * (1 - Math.exp(-4 * delta));
    facing.current.rotation.set(0, state.heading, state.mode === "downed" ? 1.25 : bank.current, "YXZ");
    const speed = Math.hypot(state.vx, state.vy, state.vz);
    const flying = rig.current.actions["Dragon_Flying"];
    if (flying) flying.timeScale = state.mode === "downed" ? 0.08 : 0.6 + Math.min(1.4, speed / 14);
    const engaged = state.mode !== "patrol" && state.mode !== "return";
    const close = Math.hypot(playerPos.x - state.x, playerPos.y - state.y, playerPos.z - state.z) < 90;
    if (tag.current) tag.current.visible = engaged || close || state.hp < maxHp(def);
    if (healthBar.current) {
      const fraction = Math.max(0, state.hp / maxHp(def));
      healthBar.current.scale.x = Math.max(0.001, fraction);
      healthBar.current.position.x = -1.45 * (1 - fraction);
    }
    if (breath.current) {
      breath.current.visible = state.mode === "windup";
      breath.current.scale.setScalar(1 + Math.sin(state.timer * 28) * 0.25);
    }
    const nowKin = isKin(def, sim.tribe);
    if (nowKin !== kin) setKin(nowKin);
  });

  const start = sim.states[index];
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[start.x, start.y, start.z]} userData={{ targetId: `rival:${def.id}` }} collisionGroups={interactionGroups(0, [1])}>
      <BallCollider args={[def.champion ? 2.9 : 2.2]} />
      <group ref={facing}>
        <primitive object={scene} />
        <mesh ref={breath} position={[0, 0.6, -3.2]} visible={false}>
          <sphereGeometry args={[0.8, 12, 8]} />
          <meshBasicMaterial color={type.attack.color1} transparent opacity={0.75} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <DragonAdornments dragon={type} scene={scene} />
      <Billboard position={[0, def.champion ? 4.6 : 3.8, 0]}>
        <group ref={tag}>
          <mesh position={[0, 0.75, 0]} renderOrder={10}>
            <planeGeometry args={[4.4, 0.96]} />
            <meshBasicMaterial map={plate} transparent depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh renderOrder={10}><planeGeometry args={[3.1, 0.3]} /><meshBasicMaterial color="#231d27" depthWrite={false} /></mesh>
          <mesh ref={healthBar} position={[0, 0, 0.01]} renderOrder={11}>
            <planeGeometry args={[2.9, 0.18]} />
            <meshBasicMaterial color={kin ? "#5fe08a" : def.champion ? "#ffc14a" : "#ff7557"} depthWrite={false} />
          </mesh>
        </group>
      </Billboard>
    </RigidBody>
  );
}

const SILHOUETTES = RIVALS.length;

/** Far-off rivals as flapping silhouettes: two draw calls for the whole sky. */
function RivalSilhouettes({ sim, active }: { sim: RivalSim; active: readonly number[] }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const wings = useRef<THREE.InstancedMesh>(null);
  const geometries = useMemo(() => {
    const parts = [
      new THREE.OctahedronGeometry(1, 0).scale(0.75, 0.6, 2.6),
      new THREE.ConeGeometry(0.45, 2.2, 5).rotateX(-Math.PI / 2).translate(0, 0.35, -2.6),
      new THREE.ConeGeometry(0.35, 3.4, 4).rotateX(Math.PI / 2).translate(0, 0, 3.6),
    ];
    const positions: number[] = [];
    for (const part of parts) {
      const flat = part.index ? part.toNonIndexed() : part;
      positions.push(...flat.attributes.position.array);
      part.dispose();
      if (flat !== part) flat.dispose();
    }
    const body = new THREE.BufferGeometry();
    body.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    body.computeVertexNormals();
    // A shallow V of two wings; scaling it in height flaps them.
    const wing = new THREE.BufferGeometry();
    wing.setAttribute("position", new THREE.Float32BufferAttribute([
      -0.4, 0, -0.9, -4.6, 1, 0.4, -0.4, 0, 1.0,
      0.4, 0, -0.9, 0.4, 0, 1.0, 4.6, 1, 0.4,
    ], 3));
    wing.computeVertexNormals();
    return { body, wing };
  }, []);
  useEffect(() => () => { geometries.body.dispose(); geometries.wing.dispose(); }, [geometries]);
  const scratch = useMemo(() => ({ dummy: new THREE.Object3D(), color: new THREE.Color(), hidden: new THREE.Matrix4().makeScale(0, 0, 0) }), []);
  useEffect(() => {
    RIVALS.forEach((def, i) => {
      const type = typeOf(def);
      bodies.current?.setColorAt(i, scratch.color.set(type.colors.body));
      wings.current?.setColorAt(i, scratch.color.set(type.colors.wing));
    });
    finalizeInstances(bodies.current);
    finalizeInstances(wings.current);
  }, [scratch]);
  useFrame(state => {
    const t = state.clock.elapsedTime;
    const { dummy, hidden } = scratch;
    sim.states.forEach((rival, i) => {
      const distance = Math.hypot(rival.x - playerPos.x, rival.z - playerPos.z);
      if (active.includes(i) || distance > SILHOUETTE_RANGE || rival.mode === "downed") {
        bodies.current?.setMatrixAt(i, hidden);
        wings.current?.setMatrixAt(i, hidden);
        return;
      }
      const size = RIVALS[i].champion ? 1.3 : 1;
      dummy.position.set(rival.x, rival.y, rival.z);
      dummy.rotation.set(0, rival.heading, 0);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      bodies.current?.setMatrixAt(i, dummy.matrix);
      dummy.scale.set(size, size * Math.sin(t * 5 + i * 1.3) * 1.4, size);
      dummy.updateMatrix();
      wings.current?.setMatrixAt(i, dummy.matrix);
    });
    for (const mesh of [bodies.current, wings.current]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
  });
  return <>
    <instancedMesh ref={bodies} args={[geometries.body, undefined, SILHOUETTES]} frustumCulled={false}>
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
    <instancedMesh ref={wings} args={[geometries.wing, undefined, SILHOUETTES]} frustumCulled={false}>
      <meshStandardMaterial roughness={0.8} side={THREE.DoubleSide} />
    </instancedMesh>
  </>;
}
