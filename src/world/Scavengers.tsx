import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { SCAVENGER_CAMPS } from "../game/world";
import { SCAV, campLayouts, createScavengerWorld, hitBallista, stepScavengers } from "../game/scavengerCamps";
import type { Scavenger, ScavengerEvent, ScavengerSenses, ScavengerWorld } from "../game/scavengerCamps";
import { gameSession, missionEmitter, playerPos, playerStatus, playerVelocity } from "../game/runtime";
import { lootHolders, lootMap, lootToast } from "../game/lootRuntime";
import { resetScavengerHud, scavengerHud, scavengerMap } from "../game/scavengerRuntime";
import type { ScavengerMarker } from "../game/scavengerRuntime";
import type { Vector3Like } from "../game/flight";
import { mergePieces, piece } from "./pieces";
import Distant from "./landmarks/Distant";

/** Scavengers are drawn a little larger than life so you can spot them from a dragon's height. */
const SCALE = 1.2;
const DRAW_RANGE = 280;
const MARKER_RANGE = 520;
const CLOAK = "#6e5a40", CLOAK_DARK = "#4f3f2e", SCARF = "#a33a2c", SKIN = "#d9a77c", BOOT = "#2e231a";
const TINTS = ["#ffffff", "#f0dcc8", "#d6dcea", "#ece2bd", "#e2d0d0"];
const MARKER_COLORS: Record<"raider" | "hauler", string> = { raider: "#ff4a3a", hauler: "#ffb02e" };

function bodyGeometry() {
  return mergePieces([
    piece(new THREE.ConeGeometry(0.36, 0.95, 10), CLOAK, { p: [0, 1.02, 0] }),
    piece(new THREE.CapsuleGeometry(0.2, 0.35, 3, 8), CLOAK, { p: [0, 1.24, 0] }),
    piece(new THREE.TorusGeometry(0.13, 0.06, 6, 12), SCARF, { p: [0, 1.5, 0.02], r: [Math.PI / 2, 0, 0] }),
    piece(new THREE.BoxGeometry(0.09, 0.28, 0.03), SCARF, { p: [0.08, 1.38, 0.17], r: [0.3, 0, 0.2] }),
    piece(new THREE.SphereGeometry(0.14, 10, 8), SKIN, { p: [0, 1.7, 0.02] }),
    piece(new THREE.SphereGeometry(0.02, 5, 4), "#1a1410", { p: [-0.05, 1.72, 0.15] }),
    piece(new THREE.SphereGeometry(0.02, 5, 4), "#1a1410", { p: [0.05, 1.72, 0.15] }),
    piece(new THREE.SphereGeometry(0.18, 10, 8, Math.PI * 0.62, Math.PI * 1.76), CLOAK, { p: [0, 1.74, -0.02], r: [-0.25, 0, 0], s: [1, 1.05, 1.1] }),
    piece(new THREE.ConeGeometry(0.1, 0.26, 6), CLOAK, { p: [0, 1.88, -0.12], r: [-0.9, 0, 0] }),
    // A rolled pack on every back, so even an empty-handed forager reads as a scavenger.
    piece(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), "#7a6040", { p: [0, 1.42, -0.24], r: [0, 0, Math.PI / 2] }),
  ]);
}
function legGeometry() {
  return mergePieces([
    piece(new THREE.CapsuleGeometry(0.085, 0.6, 3, 6), CLOAK_DARK, { p: [0, -0.4, 0] }),
    piece(new THREE.BoxGeometry(0.15, 0.12, 0.26), BOOT, { p: [0, -0.8, 0.05] }),
  ]);
}
function armGeometry() {
  return mergePieces([
    piece(new THREE.CapsuleGeometry(0.065, 0.4, 3, 6), CLOAK, { p: [0, -0.27, 0] }),
    piece(new THREE.SphereGeometry(0.06, 6, 5), SKIN, { p: [0, -0.55, 0] }),
  ]);
}

interface Pose { phase: number; crouch: number; wave: number }

/** Every scavenger out of its burrow, drawn as one instanced body, two legs, and two arms each. */
function ScavengerCrowd({ world }: { world: ScavengerWorld }) {
  const count = world.agents.length;
  const geometries = useMemo(() => ({ body: bodyGeometry(), leg: legGeometry(), arm: armGeometry(), marker: new THREE.OctahedronGeometry(0.42, 0) }), []);
  useEffect(() => () => Object.values(geometries).forEach(geometry => geometry.dispose()), [geometries]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), []);
  const markerMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), []);
  useEffect(() => () => { material.dispose(); markerMaterial.dispose(); }, [material, markerMaterial]);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const legs = useRef<THREE.InstancedMesh>(null);
  const arms = useRef<THREE.InstancedMesh>(null);
  const markers = useRef<THREE.InstancedMesh>(null);
  const poses = useRef<Pose[]>(world.agents.map((_, i) => ({ phase: i * 1.7, crouch: 0, wave: 0 })));
  const scratch = useMemo(() => ({
    root: new THREE.Matrix4(), body: new THREE.Matrix4(), local: new THREE.Matrix4(), out: new THREE.Matrix4(),
    position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(SCALE, SCALE, SCALE),
    up: new THREE.Vector3(0, 1, 0), euler: new THREE.Euler(), color: new THREE.Color(), markerScale: new THREE.Vector3(),
  }), []);

  // Tints never change, so they are set once.
  useEffect(() => {
    const color = new THREE.Color();
    world.agents.forEach((agent, i) => {
      color.set(TINTS[(i * 7 + agent.camp) % TINTS.length]);
      bodies.current?.setColorAt(i, color);
      legs.current?.setColorAt(i * 2, color); legs.current?.setColorAt(i * 2 + 1, color);
      arms.current?.setColorAt(i * 2, color); arms.current?.setColorAt(i * 2 + 1, color);
    });
    for (const mesh of [bodies.current, legs.current, arms.current]) if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [world]);

  useFrame((state, frameDelta) => {
    const body = bodies.current, leg = legs.current, arm = arms.current, marker = markers.current;
    if (!body || !leg || !arm || !marker) return;
    const delta = Math.min(frameDelta, 1 / 15);
    const t = state.clock.elapsedTime;
    const camera = state.camera.position;
    const { root, local, out, position, quaternion, scale, up, euler, color, markerScale } = scratch;
    const limb = (mesh: THREE.InstancedMesh, index: number, parent: THREE.Matrix4, x: number, y: number, z: number, rx: number, rz: number) => {
      local.makeRotationFromEuler(euler.set(rx, 0, rz));
      local.setPosition(x, y, z);
      out.multiplyMatrices(parent, local);
      mesh.setMatrixAt(index, out);
    };
    let n = 0, m = 0;
    world.agents.forEach((agent, i) => {
      const pose = poses.current[i];
      const distance = Math.hypot(agent.x - camera.x, agent.y - camera.y, agent.z - camera.z);
      const underground = agent.mode === "home";
      // Markers float over raiders and haulers, visible from much farther than the scavengers themselves.
      const flagged = !underground && (agent.mode === "raid" || agent.mode === "scoop" || agent.mode === "escape" ? "raider" : agent.carrying ? "hauler" : null);
      if (flagged && distance < MARKER_RANGE) {
        const size = Math.min(6, Math.max(1, distance / 32));
        position.set(agent.x, agent.y + 2.9 * SCALE + size * 0.5 + Math.sin(t * 3 + i) * 0.25, agent.z);
        quaternion.setFromAxisAngle(up, t * 2 + i);
        root.compose(position, quaternion, markerScale.set(size, size * 1.3, size));
        marker.setMatrixAt(m, root);
        marker.setColorAt(m, color.set(MARKER_COLORS[flagged]));
        m++;
      }
      if (underground || distance > DRAW_RANGE) return;
      // Walk cycle, crouch, and the frantic arm-waving of a panicked scavenger.
      const sprint = agent.mode === "flee" || (agent.hurry && agent.speed > SCAV.walk);
      pose.phase += agent.speed * delta * (sprint ? 2.2 : 2.7);
      const crouching = agent.mode === "grab" || agent.mode === "scoop";
      pose.crouch += ((crouching ? 1 : 0) - pose.crouch) * (1 - Math.exp(-8 * delta));
      pose.wave += ((agent.mode === "flee" ? 1 : 0) - pose.wave) * (1 - Math.exp(-10 * delta));
      const swing = Math.min(1, agent.speed / 3) * (sprint ? 0.95 : 0.7);
      const s = Math.sin(pose.phase), c = pose.crouch;
      position.set(agent.x, agent.y, agent.z);
      quaternion.setFromAxisAngle(up, agent.facing);
      root.compose(position, quaternion, scale);
      const bob = Math.abs(Math.cos(pose.phase)) * swing * 0.05;
      local.makeRotationX(c * 0.5 + (sprint ? 0.2 : 0));
      local.setPosition(0, -c * 0.3 + bob, 0);
      scratch.body.multiplyMatrices(root, local);
      body.setMatrixAt(n, scratch.body);
      limb(leg, n * 2, root, -0.11, 0.86, 0, s * swing - c * 0.6, 0);
      limb(leg, n * 2 + 1, root, 0.11, 0.86, 0, -s * swing - c * 0.6, 0);
      // Digging hands while crouched; hands up and waving when fleeing; braced on the ballista when manning it.
      const dig = c * (-1.0 + Math.sin(t * 7 + i) * 0.35);
      const reach = agent.mode === "gunner" ? -1.25 : 0;
      const wave = pose.wave * (-2.7 + Math.sin(t * 14 + i) * 0.35);
      limb(arm, n * 2, scratch.body, -0.25, 1.42, 0, (-s * swing * 0.9) * (1 - pose.wave) + dig + reach + wave, 0.12 + pose.wave * 0.3);
      limb(arm, n * 2 + 1, scratch.body, 0.25, 1.42, 0, (s * swing * 0.9) * (1 - pose.wave) + dig + reach + wave, -0.12 - pose.wave * 0.3);
      // Keep each instance's tint with it as the visible ones are packed to the front.
      color.set(TINTS[(i * 7 + agent.camp) % TINTS.length]);
      body.setColorAt(n, color);
      leg.setColorAt(n * 2, color); leg.setColorAt(n * 2 + 1, color);
      arm.setColorAt(n * 2, color); arm.setColorAt(n * 2 + 1, color);
      n++;
    });
    body.count = n; leg.count = n * 2; arm.count = n * 2; marker.count = m;
    for (const mesh of [body, leg, arm, marker]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return <>
    <instancedMesh ref={bodies} args={[geometries.body, material, count]} count={0} frustumCulled={false} castShadow />
    <instancedMesh ref={legs} args={[geometries.leg, material, count * 2]} count={0} frustumCulled={false} castShadow />
    <instancedMesh ref={arms} args={[geometries.arm, material, count * 2]} count={0} frustumCulled={false} castShadow />
    <instancedMesh ref={markers} args={[geometries.marker, markerMaterial, count]} count={0} frustumCulled={false} />
  </>;
}

/** A camp's ballista: it swings to track you, and slumps into a wreck when you break it. */
function Ballista({ world, campIndex }: { world: ScavengerWorld; campIndex: number }) {
  const camp = SCAVENGER_CAMPS[campIndex];
  const spot = campLayouts()[campIndex].ballista!;
  const frame = useRef<THREE.Group>(null);
  const yaw = useRef<THREE.Group>(null);
  const pitch = useRef<THREE.Group>(null);
  const bolt = useRef<THREE.Group>(null);
  useFrame((_, frameDelta) => {
    const state = world.camps[campIndex];
    const delta = Math.min(frameDelta, 1 / 15);
    const broken = state.ballistaHp <= 0;
    if (frame.current) {
      frame.current.rotation.z += ((broken ? 0.55 : 0) - frame.current.rotation.z) * (1 - Math.exp(-6 * delta));
      frame.current.position.y = spot.y - (broken ? 0.5 : 0);
    }
    if (yaw.current) {
      let difference = state.aimYaw - yaw.current.rotation.y;
      difference = Math.atan2(Math.sin(difference), Math.cos(difference));
      yaw.current.rotation.y += difference * (1 - Math.exp(-5 * delta));
    }
    if (pitch.current) pitch.current.rotation.x += ((broken ? 0.45 : -state.aimPitch) - pitch.current.rotation.x) * (1 - Math.exp(-5 * delta));
    if (bolt.current) bolt.current.visible = !broken && state.reload < SCAV.ballista.reload * 0.4;
  });
  return <>
    <Distant x={spot.x} z={spot.z} range={420}>
      <group ref={frame} position={[spot.x, spot.y, spot.z]}>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 0.4, 3.2]} />
          <meshStandardMaterial color="#6b4a2c" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.95, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.36, 1.3, 8]} />
          <meshStandardMaterial color="#4e3826" roughness={0.95} />
        </mesh>
        <group ref={yaw} position={[0, 1.7, 0]} rotation={[0, camp.facing, 0]}>
          <group ref={pitch}>
            <mesh position={[0, 0, 0.4]} castShadow>
              <boxGeometry args={[0.36, 0.3, 3.4]} />
              <meshStandardMaterial color="#7a5530" roughness={0.9} />
            </mesh>
            {[-1, 1].map(side => <mesh key={side} position={[side * 0.75, 0, 1.75]} rotation={[0, side * -0.35, 0]} castShadow>
              <boxGeometry args={[1.6, 0.16, 0.2]} />
              <meshStandardMaterial color="#5a3f26" roughness={0.9} />
            </mesh>)}
            <mesh position={[0, 0, 1.1]}>
              <boxGeometry args={[2.7, 0.03, 0.03]} />
              <meshStandardMaterial color="#d8cfb8" roughness={0.8} />
            </mesh>
            <group ref={bolt} position={[0, 0.2, 1.3]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 2.4, 6]} />
                <meshStandardMaterial color="#cbb894" roughness={0.7} />
              </mesh>
              <mesh position={[0, 0, 1.35]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.11, 0.35, 6]} />
                <meshStandardMaterial color="#8a8f96" metalness={0.6} roughness={0.4} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </Distant>
    {/* Fire breaks it: the collider tells your breath what it hit. */}
    <RigidBody type="fixed" colliders={false} userData={{ targetId: `ballista:${camp.id}` }}>
      <CuboidCollider args={[1.3, 1.3, 1.3]} position={[spot.x, spot.y + 1.3, spot.z]} />
    </RigidBody>
  </>;
}

function bearingTo(dx: number, dz: number) {
  const relative = Math.atan2(-dx, -dz) - playerStatus.heading;
  return Math.atan2(Math.sin(relative), Math.cos(relative));
}

type ScavSound = "yelp" | "horn" | "twang";
const sound = (kind: ScavSound) => missionEmitter.dispatchEvent(new CustomEvent("scav_sound", { detail: { kind } }));

/**
 * The scavengers of the wilds: foragers who carry off loose treasure, raiders who creep to your
 * hoard while you are away, and gunners on their camps' ballistas. Swoop low to scare them.
 */
export default function Scavengers({ gold, onSteal, knockedOut }: { gold: number; onSteal: (campId: string, amount: number) => number; knockedOut: boolean }) {
  const [world] = useState(createScavengerWorld);
  const goldRef = useRef(gold);
  const stealRef = useRef(onSteal);
  const downRef = useRef(knockedOut);
  useEffect(() => { goldRef.current = gold; }, [gold]);
  useEffect(() => { stealRef.current = onSteal; }, [onSteal]);
  useEffect(() => { downRef.current = knockedOut; }, [knockedOut]);
  const impacts = useRef<Vector3Like[]>([]);
  const names = useRef(new Map<string, string>());
  const hauls = useRef(new Map<string, number>());
  const found = useRef(new Set<string>());
  const quiet = useRef(new Map<string, number>());
  const hudTimer = useRef(0);

  const publish = (agent: Scavenger) => {
    const speed = agent.speed;
    lootHolders.set(agent.id, {
      x: agent.x - Math.sin(agent.facing) * 0.42 * SCALE, y: agent.y + 1.3 * SCALE, z: agent.z - Math.cos(agent.facing) * 0.42 * SCALE,
      vx: Math.sin(agent.facing) * speed, vy: 0, vz: Math.cos(agent.facing) * speed, carry: "back",
    });
  };

  const senses = useMemo<ScavengerSenses>(() => ({
    dragon: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, cloaked: false, down: false },
    impacts: [],
    loose: [],
    gold: 0,
    claim: (agent, itemId) => {
      const detail = { holder: agent.id, itemId, result: false };
      missionEmitter.dispatchEvent(new CustomEvent("loot_claim", { detail }));
      return detail.result;
    },
    steal: (agent, campId, amount) => {
      const taken = stealRef.current(campId, amount);
      if (!taken) return null;
      publish(agent);
      const detail = { holder: agent.id, amount: taken, camp: campId, result: null as string | null };
      missionEmitter.dispatchEvent(new CustomEvent("loot_sack", { detail }));
      if (detail.result) hauls.current.set(detail.result, taken);
      return detail.result;
    },
  }), []);

  useEffect(() => {
    const impact = (event: Event) => {
      const detail = (event as CustomEvent<{ position: Vector3Like; quiet?: boolean }>).detail;
      if (!detail?.quiet && detail?.position) impacts.current.push({ x: detail.position.x, y: detail.position.y, z: detail.position.z });
    };
    const hit = (event: Event) => {
      const { targetId, damage } = (event as CustomEvent<{ targetId?: string; damage: number }>).detail;
      if (!targetId?.startsWith("ballista:") || gameSession.paused) return;
      const index = SCAVENGER_CAMPS.findIndex(camp => `ballista:${camp.id}` === targetId);
      if (index >= 0) handle(hitBallista(world, index, damage));
    };
    missionEmitter.addEventListener("impact", impact);
    missionEmitter.addEventListener("tower_hit", hit);
    return () => {
      missionEmitter.removeEventListener("impact", impact);
      missionEmitter.removeEventListener("tower_hit", hit);
      for (const agent of world.agents) lootHolders.delete(agent.id);
      resetScavengerHud();
    };
    // handle only reads refs and module state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  /** Toasts within earshot only, and not the same one over and over. */
  const tell = (key: string, near: boolean, text: string, tone: "gold" | "info" | "warn" | "legend", cooldown = 5) => {
    if (!near) return;
    const now = gameSession.elapsed;
    if (now - (quiet.current.get(key) ?? -99) < cooldown) return;
    quiet.current.set(key, now);
    lootToast(text, tone);
  };

  /** Treasure names, kept for the alerts while the treasure is out of sight on someone's back. */
  const remember = (itemId: string) => {
    const entry = lootMap.items.find(item => item.id === itemId);
    if (entry) names.current.set(itemId, entry.name);
  };

  function handle(events: ScavengerEvent[]) {
    for (const event of events) {
      const campIndex = "camp" in event ? event.camp : event.agent.camp;
      const camp = SCAVENGER_CAMPS[campIndex];
      const where = "agent" in event ? event.agent : camp;
      const distance = Math.hypot(where.x - playerPos.x, where.z - playerPos.z);
      switch (event.type) {
        case "outing":
          remember(event.item);
          break;
        case "claimed":
          remember(event.item);
          tell(`claim:${event.item}`, distance < 260, `A scavenger from ${camp.name} is making off with the ${names.current.get(event.item) ?? "treasure"}! Swoop low to scare it.`, "warn");
          break;
        case "panic":
          if (event.dropped) {
            missionEmitter.dispatchEvent(new CustomEvent("loot_holder_drop", { detail: { holder: event.agent.id } }));
            tell("drop", distance < 200, "The scavenger dropped it and ran! Grab it!", "gold");
          }
          if (distance < 140) sound("yelp");
          break;
        case "stashed": {
          missionEmitter.dispatchEvent(new CustomEvent("loot_holder_stash", { detail: { holder: event.agent.id, spot: campLayouts()[campIndex].stash, grounded: true } }));
          const amount = hauls.current.get(event.item);
          if (amount) tell(`stash:${camp.id}`, true, `The raiders got ${amount} gold home to ${camp.name}. Raid their stash to win it back!`, "warn");
          else tell(`stash:${camp.id}`, distance < 300, `Scavengers stashed the ${names.current.get(event.item) ?? "treasure"} at ${camp.name}.`, "info");
          break;
        }
        case "raid":
          lootToast(`⚠ Scavengers from ${camp.name} are creeping toward your hoard!`, "warn");
          sound("horn");
          break;
        case "stole":
          lootToast(`Scavengers are stealing ${hauls.current.get(event.item) ?? "your"} gold from your hoard!`, "warn");
          break;
        case "raid_over":
          if (!event.escaped) lootToast(`You chased off the raiders from ${camp.name}!`, "gold");
          break;
        case "fire": {
          const speed = Math.hypot(event.velocity.x, event.velocity.y, event.velocity.z) || 1;
          // Start the bolt clear of the ballista's own collider.
          const lead = 2.6 / speed;
          missionEmitter.dispatchEvent(new CustomEvent("enemy_shoot", { detail: {
            position: [event.from.x + event.velocity.x * lead, event.from.y + event.velocity.y * lead, event.from.z + event.velocity.z * lead],
            velocity: [event.velocity.x, event.velocity.y, event.velocity.z], color: "#e0cf9e", damage: SCAV.ballista.damage, size: 0.85,
          } }));
          if (distance < 160) sound("twang");
          tell(`ballista:${camp.id}`, true, `The ballista at ${camp.name} is shooting at you! Swoop on its gunner or burn it.`, "warn", 25);
          break;
        }
        case "ballista_broken": {
          const spot = campLayouts()[campIndex].ballista!;
          missionEmitter.dispatchEvent(new CustomEvent("impact", { detail: { position: { x: spot.x, y: spot.y + 1.5, z: spot.z }, color: "#ffb347", large: true } }));
          lootToast(`You smashed the ballista at ${camp.name}!`, "gold");
          break;
        }
        case "ballista_rebuilt":
          break;
      }
    }
  }

  useFrame((_, frameDelta) => {
    if (gameSession.paused || !gameSession.ready) return;
    const delta = Math.min(frameDelta, 1 / 15);
    Object.assign(senses.dragon, {
      x: playerPos.x, y: playerPos.y, z: playerPos.z, vx: playerVelocity.x, vy: playerVelocity.y, vz: playerVelocity.z,
      cloaked: playerStatus.cloaked, down: downRef.current,
    });
    senses.impacts = impacts.current;
    impacts.current = [];
    senses.loose = lootMap.items;
    senses.gold = goldRef.current;
    handle(stepScavengers(world, senses, delta));
    for (const agent of world.agents) {
      if (agent.mode === "home") lootHolders.delete(agent.id);
      else publish(agent);
    }

    hudTimer.current -= delta;
    if (hudTimer.current > 0) return;
    hudTimer.current = 0.2;
    // Finding a camp for the first time.
    SCAVENGER_CAMPS.forEach(camp => {
      if (found.current.has(camp.id) || Math.hypot(camp.x - playerPos.x, camp.z - playerPos.z) > 120) return;
      found.current.add(camp.id);
      lootToast(`⛺ ${camp.name}: a scavenger warren. Their stash lies by the fire${camp.ballista ? ", under a ballista's eye" : ""}.`, "info");
    });
    const raid = world.raid;
    let raider: Scavenger | null = null, raiderDistance = Infinity;
    let hauler: Scavenger | null = null, haulerDistance = 260;
    const markers: { x: number; z: number; kind: ScavengerMarker }[] = [];
    for (const agent of world.agents) {
      if (agent.mode === "home") continue;
      const distance = Math.hypot(agent.x - playerPos.x, agent.z - playerPos.z);
      const raiding = Boolean(raid?.raiders.includes(agent.id)) && (agent.mode === "raid" || agent.mode === "scoop" || agent.mode === "escape");
      if (raiding && distance < raiderDistance) { raider = agent; raiderDistance = distance; }
      if (!raiding && agent.carrying && distance < haulerDistance) { hauler = agent; haulerDistance = distance; }
      markers.push({ x: agent.x, z: agent.z, kind: raiding ? "raider" : agent.carrying ? "hauler" : agent.role === "gunner" ? "gunner" : "forager" });
    }
    scavengerMap.agents = markers;
    scavengerHud.raid = raid && raider ? {
      camp: SCAVENGER_CAMPS[raid.camp].name, stage: raid.stage, distance: raiderDistance, bearing: bearingTo(raider.x - playerPos.x, raider.z - playerPos.z),
    } : null;
    scavengerHud.hauler = hauler ? {
      item: names.current.get(hauler.item ?? "") ?? "treasure", camp: SCAVENGER_CAMPS[hauler.camp].name,
      distance: haulerDistance, bearing: bearingTo(hauler.x - playerPos.x, hauler.z - playerPos.z),
    } : null;
  });

  return <>
    <ScavengerCrowd world={world} />
    {SCAVENGER_CAMPS.map((camp, i) => camp.ballista ? <Ballista key={camp.id} world={world} campIndex={i} /> : null)}
  </>;
}
