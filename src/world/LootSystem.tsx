import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BallCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import type { DragonType } from "../dragons";
import {
  TREASURES, TREASURE_KINDS, createCommonLoot, resolveTreasureSpot, skyDrift, appraise, emptyTalons, grabWith, releaseFrom,
  carryLoad, stepLooseLoot, inLake, inHoardZone, hoardFloor, dunkBonus, HOARD_SITE, hoardMoundHeight, talonsNeeded, hoardRank,
} from "../game/loot";
import type { HoardProgress, TalonSide, Talons, TreasureDef, TreasureKind } from "../game/loot";
import { terrainHeight } from "../game/landscape";
import { clawInput, carryState, gameSession, lootInput, missionEmitter, playerPos, playerStatus, playerVelocity, talonState, xrInput } from "../game/runtime";
import { renderingBudget } from "../game/rendering";
import { device } from "../utils/device";
import { createTreasureMaterial, RARITY_COLORS, treasureCenter, treasureGeometry } from "./treasureModels";
import DragonClaw from "./DragonClaw";
import { talonAnchor } from "../game/claws";
import { lootHud, lootMap, lootToast } from "../game/lootRuntime";
import type { CarriedSummary } from "../game/lootRuntime";

type ItemState = "world" | "falling" | "carried" | "banked";

interface LootItem {
  def: TreasureDef;
  home: THREE.Vector3;
  /** Base of the model while it rests or falls. */
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  state: ItemState;
  side: TalonSide | "both" | null;
  /** Dangling center while carried. */
  hang: THREE.Vector3;
  hangPrev: THREE.Vector3;
  /** Claw point the item hangs from (a foot, or a VR claw target). */
  anchor: THREE.Vector3;
  releaseY: number;
  ignoreUntil: number;
  onLantern: boolean;
  lanternFreedAt: number;
  slot: number;
  phase: number;
  scale: number;
  center: number;
}

/** Swooping over treasure: a column under the talons, forgiving of height. */
const SNATCH_RADIUS = 2.6;
const SNATCH_ABOVE = 3.2;
const SNATCH_BELOW = 1.3;
const CLAW_RADIUS = 1.2;
const GRAB_GRACE = 0.3;
/** Talon stretch (world units) that means the hand is reaching rather than resting on a grip. */
const REACH_INTENT = 0.9;
const MOUND_RADIUS = 4.2;

function moundSurface(r: number, height: number) {
  return r >= MOUND_RADIUS ? 0 : height * Math.sqrt(1 - (r / MOUND_RADIUS) ** 2);
}

/** Banked unique treasures are displayed in a golden spiral on top of the mound. */
function displaySpot(slot: number, height: number, floor: number, out: THREE.Vector3) {
  const angle = slot * 2.39996;
  const r = Math.min(3.6, 0.85 + 0.6 * Math.sqrt(slot));
  out.set(HOARD_SITE.x + Math.cos(angle) * r, floor + moundSurface(r, height) - 0.05, HOARD_SITE.z + Math.sin(angle) * r);
  return angle;
}

function headingTo(dx: number, dz: number) {
  const target = Math.atan2(-dx, -dz);
  let relative = target - playerStatus.heading;
  relative = Math.atan2(Math.sin(relative), Math.cos(relative));
  return relative;
}

function createItems(banked: HoardProgress["banked"]): LootItem[] {
  let slot = 0;
  return [...TREASURES, ...createCommonLoot()].map((def, index) => {
    const spot = resolveTreasureSpot(def);
    const isBanked = def.unique && Boolean(banked[def.id]);
    const home = new THREE.Vector3(spot.x, spot.y, spot.z);
    return {
      def, home, position: home.clone(), velocity: new THREE.Vector3(), state: isBanked ? "banked" : "world", side: null,
      hang: new THREE.Vector3(), hangPrev: new THREE.Vector3(), anchor: new THREE.Vector3(), releaseY: 0, ignoreUntil: 0,
      onLantern: def.perch === "sky" && !isBanked, lanternFreedAt: -1, slot: isBanked ? slot++ : -1,
      phase: index * 1.37, scale: def.kind === "chest" ? 1.15 : 1.35, center: treasureCenter(def.kind),
    } satisfies LootItem;
  });
}

function summary(item: LootItem, dragonId: string): CarriedSummary {
  const appraisal = appraise(item.def, dragonId);
  return { name: item.def.name, value: appraisal.value, rarity: item.def.rarity, favored: appraisal.favored };
}

export default function LootSystem({ dragon, hoard }: { dragon: DragonType; hoard: HoardProgress }) {
  // The world layout is fixed for this flight; the persistent hoard only decides what has already been taken.
  const [items] = useState(() => createItems(hoard.banked));
  const talons = useRef<Talons>(emptyTalons());
  const nextSlot = useRef(items.reduce((max, item) => Math.max(max, item.slot + 1), 0));
  const hints = useRef(new Map<string, number>());
  const pressAt = useRef({ left: -99, right: -99 });
  const lastGrip = useRef({ left: false, right: false });
  const hudTimer = useRef(0);
  const dragonRef = useRef(dragon);
  const goldRef = useRef(hoard.gold);
  useEffect(() => { dragonRef.current = dragon; }, [dragon]);
  useEffect(() => { goldRef.current = hoard.gold; }, [hoard.gold]);

  const shadows = renderingBudget(device).shadows;
  const batches = useMemo(() => {
    const material = createTreasureMaterial();
    const color = new THREE.Color();
    const list: { mesh: THREE.InstancedMesh; members: LootItem[] }[] = [];
    for (const kind of TREASURE_KINDS) {
      const members = items.filter(item => item.def.kind === kind);
      if (!members.length) continue;
      const mesh = new THREE.InstancedMesh(treasureGeometry(kind as TreasureKind), material, members.length);
      mesh.frustumCulled = false;
      mesh.castShadow = shadows;
      members.forEach((item, i) => mesh.setColorAt(i, color.set(item.def.tint)));
      list.push({ mesh, members });
    }
    return { material, list };
  }, [items, shadows]);
  useEffect(() => () => { batches.list.forEach(batch => batch.mesh.dispose()); batches.material.dispose(); }, [batches]);

  const shafts = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(0.22, 0.55, 26, 10, 4, true).translate(0, 13, 0);
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 4);
    for (let i = 0; i < positions.count; i++) {
      colors.set([1, 1, 1, Math.pow(1 - positions.getY(i) / 26, 1.7)], i * 4);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    const color = new THREE.Color();
    items.forEach((item, i) => mesh.setColorAt(i, color.set(RARITY_COLORS[item.def.rarity])));
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    return { geometry, material, mesh };
  }, [items]);
  useEffect(() => () => { shafts.mesh.dispose(); shafts.geometry.dispose(); shafts.material.dispose(); }, [shafts]);

  const lanterns = useMemo(() => {
    const members = items.filter(item => item.def.perch === "sky");
    const lantern = new THREE.InstancedMesh(new THREE.SphereGeometry(0.85, 14, 10), new THREE.MeshBasicMaterial({ color: "#ffcf7a", toneMapped: false }), members.length);
    const rope = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), new THREE.MeshBasicMaterial({ color: "#6b5536" }), members.length);
    lantern.frustumCulled = rope.frustumCulled = false;
    return { members, lantern, rope };
  }, [items]);
  useEffect(() => () => {
    for (const mesh of [lanterns.lantern, lanterns.rope]) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.dispose(); }
  }, [lanterns]);

  // Desktop drop key. Touch uses the HUD button; VR opens the claw.
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.repeat || event.key.toLowerCase() !== "e" || gameSession.paused) return;
      if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      lootInput.drop = true;
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      Object.assign(carryState, { speedFactor: 1, climbFactor: 1 });
      Object.assign(lootHud, { left: null, right: null, both: false, weight: 0, nearest: null });
      lootMap.items = [];
    };
  }, []);

  const scratch = useMemo(() => ({
    dummy: new THREE.Object3D(), reach: new THREE.Vector3(), center: new THREE.Vector3(), target: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0), dir: new THREE.Vector3(), prev: new THREE.Vector3(), offset: new THREE.Vector3(),
    quat: new THREE.Quaternion(), yaw: new THREE.Quaternion(), euler: new THREE.Euler(),
    zero: new THREE.Matrix4().makeScale(0, 0, 0), display: new THREE.Vector3(),
  }), []);

  const hint = (key: string, text: string, tone: "info" | "warn" = "warn") => {
    const now = gameSession.elapsed;
    if (now - (hints.current.get(key) ?? -99) < 4) return;
    hints.current.set(key, now);
    lootToast(text, tone);
  };

  const itemCenter = (item: LootItem, time: number, out: THREE.Vector3) => {
    if (item.state === "carried") return out.copy(item.hang);
    out.copy(item.position);
    if (item.state === "world" && item.onLantern) {
      const drift = skyDrift(item.def, time);
      out.x += drift.x; out.y += drift.y; out.z += drift.z;
    }
    out.y += item.center * item.scale;
    return out;
  };

  const snatch = (item: LootItem, side?: TalonSide | "both") => {
    const grab = side === "both" ? grabWith(talons.current, item.def.id, 3) : grabWith(talons.current, item.def.id, item.def.weight, side);
    if (!grab) return false;
    talons.current = grab.talons;
    itemCenter(item, gameSession.elapsed, item.hang);
    item.hangPrev.copy(item.hang);
    item.anchor.copy(item.hang);
    item.state = "carried";
    item.side = grab.side;
    if (item.onLantern) { item.onLantern = false; item.lanternFreedAt = gameSession.elapsed; }
    const appraisal = appraise(item.def, dragonRef.current.id);
    missionEmitter.dispatchEvent(new CustomEvent("loot_snatched", { detail: { id: item.def.id, side: grab.side } }));
    missionEmitter.dispatchEvent(new CustomEvent("impact", { detail: { position: { x: item.hang.x, y: item.hang.y, z: item.hang.z }, color: RARITY_COLORS[item.def.rarity], quiet: true } }));
    const legendary = item.def.rarity === "legendary";
    lootToast(`${legendary ? "★ " : ""}SNATCHED ${item.def.name.toUpperCase()} · ${appraisal.value} gold${appraisal.favored ? ` · ${dragonRef.current.name} taste ×${appraisal.multiplier}` : ""}`, legendary ? "legend" : "gold");
    return true;
  };

  const bank = (item: LootItem, dunkHeight?: number) => {
    const appraisal = appraise(item.def, dragonRef.current.id);
    const bonus = dunkHeight === undefined ? 1 : dunkBonus(dunkHeight);
    const value = Math.round(appraisal.value * bonus);
    if (item.state === "carried" && item.side) {
      talons.current = releaseFrom(talons.current, item.side === "both" ? "left" : item.side).talons;
    }
    item.state = "banked";
    item.side = null;
    item.slot = item.def.unique ? nextSlot.current++ : -1;
    missionEmitter.dispatchEvent(new CustomEvent("loot_banked", { detail: { id: item.def.id, def: item.def, value, dragonId: dragonRef.current.id } }));
    lootToast(bonus > 1 ? `HOARD DUNK ×${bonus} · +${value} gold` : `HOARDED ${item.def.name} · +${value} gold`, item.def.rarity === "legendary" ? "legend" : "gold");
  };

  const release = (side: TalonSide, throwVelocity?: { x: number; y: number; z: number }) => {
    const { talons: next, itemId } = releaseFrom(talons.current, side);
    if (!itemId) return;
    talons.current = next;
    const item = items.find(candidate => candidate.def.id === itemId);
    if (!item) return;
    item.state = "falling";
    item.side = null;
    item.position.copy(item.hang);
    item.position.y -= item.center * item.scale;
    item.velocity.set(
      playerVelocity.x + (throwVelocity?.x ?? 0),
      playerVelocity.y * 0.6 + (throwVelocity?.y ?? 0),
      playerVelocity.z + (throwVelocity?.z ?? 0),
    );
    item.releaseY = item.position.y;
    item.ignoreUntil = gameSession.elapsed + 1.2;
    missionEmitter.dispatchEvent(new CustomEvent("loot_dropped", { detail: { id: item.def.id } }));
  };

  const groundAt = (x: number, z: number) => {
    const ground = terrainHeight(x, z, "open");
    const r = Math.hypot(x - HOARD_SITE.x, z - HOARD_SITE.z);
    return ground + moundSurface(r, hoardMoundHeight(goldRef.current));
  };

  // Input and grabbing run before the flight model, so a busy claw does not also brake or glide.
  useFrame(() => {
    if (gameSession.paused || !gameSession.ready) return;
    const now = gameSession.elapsed;
    const vr = clawInput.active;
    if (lootInput.drop) {
      lootInput.drop = false;
      if (talons.current.right) release("right");
      else if (talons.current.left) release("left");
    }

    if (!vr) {
      clawInput.left.busy = clawInput.right.busy = clawInput.left.near = clawInput.right.near = false;
      const { reach } = scratch;
      if (talonState.ready) {
        reach.set((talonState.left.x + talonState.right.x) / 2, (talonState.left.y + talonState.right.y) / 2 - 0.55, (talonState.left.z + talonState.right.z) / 2);
      } else return;
      for (const item of items) {
        if (item.state !== "world" || now < item.ignoreUntil) continue;
        if (Math.abs(item.position.x - reach.x) > 9 || Math.abs(item.position.z - reach.z) > 9) continue;
        const center = itemCenter(item, now, scratch.center);
        const lift = reach.y - center.y;
        if (Math.hypot(center.x - reach.x, center.z - reach.z) > SNATCH_RADIUS || lift > SNATCH_ABOVE || lift < -SNATCH_BELOW) continue;
        if (talonsNeeded(item.def.weight) === 2 && (talons.current.left || talons.current.right)) {
          hint(`both_${item.def.id}`, `${item.def.name} needs both talons. Bank or drop your loot first (E).`);
          continue;
        }
        if (!snatch(item)) hint("full", "Your talons are full! Fly to your hoard or press E to drop.");
      }
      return;
    }

    // VR: each controller steers one talon; squeeze near treasure to grab, release to drop or throw.
    for (const side of ["left", "right"] as const) {
      const hand = clawInput[side];
      if (hand.grip && !lastGrip.current[side]) pressAt.current[side] = now;
      lastGrip.current[side] = hand.grip;
      const holding = talons.current[side];
      if (holding) {
        hand.near = false;
        if (!hand.grip || !hand.tracked) {
          const other = side === "left" ? clawInput.right : clawInput.left;
          const both = talons.current.left === talons.current.right;
          const velocity = both ? { x: (hand.velocity.x + other.velocity.x) / 2, y: (hand.velocity.y + other.velocity.y) / 2, z: (hand.velocity.z + other.velocity.z) / 2 } : hand.velocity;
          release(side, velocity);
        }
        hand.busy = Boolean(talons.current[side]) || hand.grip;
        continue;
      }
      hand.near = false;
      if (!hand.tracked) { hand.busy = false; continue; }
      // Relaxed hands keep the grips for braking and gliding; a reaching hand's grip is a claw.
      const rest = talonAnchor(side, playerPos, playerStatus.heading);
      const reaching = Math.hypot(hand.target.x - rest.x, hand.target.y - rest.y, hand.target.z - rest.z) > REACH_INTENT;
      hand.busy = hand.grip && reaching;
      let best: LootItem | null = null, bestDistance = CLAW_RADIUS;
      for (const item of items) {
        if (item.state !== "world" || now < item.ignoreUntil) continue;
        const distance = itemCenter(item, now, scratch.center).distanceTo(scratch.target.set(hand.target.x, hand.target.y, hand.target.z));
        if (distance < bestDistance) { best = item; bestDistance = distance; }
      }
      hand.near = Boolean(best);
      // Squeeze near treasure, or sweep an outstretched closed claw through it.
      if (!best || !hand.grip || (now - pressAt.current[side] > GRAB_GRACE && !reaching)) continue;
      if (talonsNeeded(best.def.weight) === 2) {
        const other = side === "left" ? clawInput.right : clawInput.left;
        const otherNear = other.grip && other.tracked && itemCenter(best, now, scratch.center).distanceTo(scratch.target.set(other.target.x, other.target.y, other.target.z)) < CLAW_RADIUS * 1.4;
        if (otherNear && !talons.current.left && !talons.current.right) {
          if (snatch(best, "both")) { clawInput.left.busy = clawInput.right.busy = true; }
        } else hint(`both_${best.def.id}`, `Grab the ${best.def.name} with both claws!`);
        continue;
      }
      if (snatch(best, side)) hand.busy = true;
    }
    if (clawInput.left.busy) xrInput.brake = false;
    if (clawInput.right.busy) xrInput.glide = false;
  }, -1);

  useFrame((state, frameDelta) => {
    const time = state.clock.elapsedTime;
    const delta = Math.min(frameDelta, 1 / 15);
    const now = gameSession.elapsed;
    const running = !gameSession.paused && gameSession.ready;
    const floor = hoardFloor();
    const moundHeight = hoardMoundHeight(goldRef.current);
    const { dummy, dir, prev, offset, quat, yaw, up, zero, display, euler } = scratch;

    if (running) {
      // Carried treasure swings on a short tether below each claw.
      let weight = 0;
      for (const item of items) {
        if (item.state === "carried") {
          const side = item.side;
          const anchor = item.anchor;
          if (side === "both") {
            const a = clawInput.active && clawInput.left.tracked ? clawInput.left.target : talonState.left;
            const b = clawInput.active && clawInput.right.tracked ? clawInput.right.target : talonState.right;
            anchor.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
          } else if (side) {
            const hand = clawInput[side];
            const source = clawInput.active && hand.tracked ? hand.target : talonState[side];
            anchor.set(source.x, source.y, source.z);
          }
          // Position Verlet: the treasure lags, swings on turns, and settles below the claw.
          const length = item.def.weight >= 3 ? 0.85 : 0.5;
          prev.copy(item.hang);
          const damping = Math.exp(-2.4 * delta);
          item.hang.set(
            item.hang.x + (item.hang.x - item.hangPrev.x) * damping,
            item.hang.y + (item.hang.y - item.hangPrev.y) * damping - 22 * delta * delta,
            item.hang.z + (item.hang.z - item.hangPrev.z) * damping,
          );
          offset.copy(item.hang).sub(anchor);
          const distance = offset.length();
          if (distance < 1e-6) item.hang.copy(anchor).add(offset.set(0, -length, 0));
          else if (distance > length) item.hang.copy(anchor).addScaledVector(offset, length / distance);
          const clearance = terrainHeight(item.hang.x, item.hang.z, "open") + item.center * item.scale;
          if (item.hang.y < clearance) item.hang.y = clearance;
          item.hangPrev.copy(prev);
          weight += item.def.weight;
          if (inHoardZone(item.hang, floor)) bank(item);
        } else if (item.state === "falling") {
          const next = stepLooseLoot({ position: item.position, velocity: item.velocity, resting: false }, delta, groundAt);
          item.position.set(next.position.x, next.position.y, next.position.z);
          item.velocity.set(next.velocity.x, next.velocity.y, next.velocity.z);
          const r = Math.hypot(item.position.x - HOARD_SITE.x, item.position.z - HOARD_SITE.z);
          if (r <= HOARD_SITE.radius && item.position.y <= groundAt(item.position.x, item.position.z) + 0.05) {
            bank(item, item.releaseY - floor);
          } else if (inLake(item.position)) {
            item.state = "world";
            item.position.copy(item.home);
            item.ignoreUntil = now + 2;
            missionEmitter.dispatchEvent(new CustomEvent("impact", { detail: { position: { x: item.position.x, y: item.position.y + 1, z: item.position.z }, color: "#a6e4ff", quiet: true } }));
            lootToast(`Splash! The lake spat the ${item.def.name} back where you found it.`, "info");
          } else if (next.resting) {
            item.state = "world";
          }
        }
      }
      Object.assign(carryState, carryLoad(weight, dragonRef.current.stats.armor));

      hudTimer.current -= delta;
      if (hudTimer.current <= 0) {
        hudTimer.current = 0.15;
        const left = talons.current.left ? items.find(item => item.def.id === talons.current.left) : undefined;
        const right = talons.current.right ? items.find(item => item.def.id === talons.current.right) : undefined;
        lootHud.left = left ? summary(left, dragonRef.current.id) : null;
        lootHud.right = right ? summary(right, dragonRef.current.id) : null;
        lootHud.both = Boolean(left && left === right);
        lootHud.weight = weight;
        const px = playerPos.x, pz = playerPos.z;
        lootHud.hoardDistance = Math.hypot(HOARD_SITE.x - px, HOARD_SITE.z - pz);
        lootHud.hoardBearing = headingTo(HOARD_SITE.x - px, HOARD_SITE.z - pz);
        let nearest: LootItem | null = null, nearestDistance = Infinity, remaining = 0;
        lootMap.items = [];
        for (const item of items) {
          if (item.state !== "world") continue;
          remaining++;
          lootMap.items.push({ x: item.position.x, z: item.position.z, rarity: item.def.rarity, unique: item.def.unique, region: item.def.region });
          const distance = Math.hypot(item.position.x - px, item.position.z - pz);
          if (distance < nearestDistance) { nearest = item; nearestDistance = distance; }
        }
        lootHud.remaining = remaining;
        lootHud.nearest = nearest ? { name: nearest.def.name, distance: nearestDistance, bearing: headingTo(nearest.position.x - px, nearest.position.z - pz), rarity: nearest.def.rarity } : null;
      }
    }

    // Compose every treasure, shaft and lantern from its current state.
    let shaftIndex = 0;
    for (const batch of batches.list) {
      batch.members.forEach((item, i) => {
        if (item.state === "banked" && item.slot < 0) { batch.mesh.setMatrixAt(i, zero); return; }
        let scale = item.scale;
        if (item.state === "carried") {
          // Hang upright along the tether, facing the dragon's heading.
          dir.copy(item.anchor).sub(item.hang);
          if (dir.lengthSq() > 1e-6) dir.normalize(); else dir.set(0, 1, 0);
          quat.setFromUnitVectors(up, dir).multiply(yaw.setFromAxisAngle(up, playerStatus.heading));
          dummy.position.copy(item.hang).addScaledVector(dir, -item.center * scale);
          dummy.quaternion.copy(quat);
        } else if (item.state === "banked") {
          const angle = displaySpot(item.slot, moundHeight, floor, display);
          dummy.position.copy(display);
          dummy.quaternion.setFromAxisAngle(up, -angle + Math.PI / 2);
          scale *= 0.95;
        } else {
          dummy.position.copy(item.position);
          if (item.state === "world" && item.onLantern) {
            const drift = skyDrift(item.def, now);
            dummy.position.x += drift.x; dummy.position.y += drift.y; dummy.position.z += drift.z;
          }
          const bob = item.state === "world" ? Math.sin(time * 1.6 + item.phase) * 0.06 + 0.06 : 0;
          dummy.position.y += bob;
          const spin = item.state === "falling" ? time * 5 : time * 0.55 + item.phase;
          dummy.quaternion.setFromEuler(euler.set(item.state === "falling" ? time * 3 : 0, spin, 0));
        }
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        batch.mesh.setMatrixAt(i, dummy.matrix);
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.state !== "world" || item.onLantern) { shafts.mesh.setMatrixAt(shaftIndex++, zero); continue; }
      dummy.position.copy(item.position);
      dummy.quaternion.identity();
      const pulse = item.def.rarity === "legendary" ? 1.25 + Math.sin(time * 3 + item.phase) * 0.15 : item.def.rarity === "junk" ? 0.6 : 1;
      dummy.scale.set(pulse, item.def.rarity === "junk" ? 0.45 : 1, pulse);
      dummy.updateMatrix();
      shafts.mesh.setMatrixAt(shaftIndex++, dummy.matrix);
    }
    shafts.mesh.instanceMatrix.needsUpdate = true;

    lanterns.members.forEach((item, i) => {
      let age = 0;
      if (!item.onLantern) {
        age = item.lanternFreedAt < 0 ? 99 : now - item.lanternFreedAt;
        if (age > 6) { lanterns.lantern.setMatrixAt(i, zero); lanterns.rope.setMatrixAt(i, zero); return; }
      }
      const drift = skyDrift(item.def, item.onLantern ? now : item.lanternFreedAt);
      const base = display.set(item.home.x + drift.x, item.home.y + drift.y + item.center * item.scale * 2 + 0.35 + age * age * 0.9, item.home.z + drift.z);
      dummy.quaternion.identity();
      dummy.position.set(base.x, base.y + 1.75, base.z);
      dummy.scale.set(1, 1.25, 1).multiplyScalar(Math.max(0.01, 1 - age / 6));
      dummy.updateMatrix();
      lanterns.lantern.setMatrixAt(i, dummy.matrix);
      if (item.onLantern) {
        dummy.position.set(base.x, base.y + 0.3, base.z);
        dummy.scale.set(1, 0.75, 1);
        dummy.updateMatrix();
        lanterns.rope.setMatrixAt(i, dummy.matrix);
      } else lanterns.rope.setMatrixAt(i, zero);
    });
    lanterns.lantern.instanceMatrix.needsUpdate = true;
    lanterns.rope.instanceMatrix.needsUpdate = true;
  });

  return <>
    {batches.list.map(batch => <primitive key={batch.mesh.uuid} object={batch.mesh} />)}
    <primitive object={shafts.mesh} />
    <primitive object={lanterns.lantern} />
    <primitive object={lanterns.rope} />
    <HoardNest gold={hoard.gold} />
    <ClawCursors dragon={dragon} />
  </>;
}

/** The player's nest beside the spawn: a boulder ring around a gold mound that grows with the hoard. */
function HoardNest({ gold }: { gold: number }) {
  const floor = useMemo(() => hoardFloor(), []);
  const height = hoardMoundHeight(gold);
  const boulders = useMemo(() => Array.from({ length: 9 }, (_, i) => {
    const angle = i / 9 * Math.PI * 2 + 0.35;
    const radius = 9 + Math.sin(i * 2.3) * 0.45;
    return { x: HOARD_SITE.x + Math.cos(angle) * radius, z: HOARD_SITE.z + Math.sin(angle) * radius, size: 1.05 + (i * 37 % 7) / 11, rotation: i * 1.7 };
  }), []);
  const boulderMesh = useRef<THREE.InstancedMesh>(null);
  const coinMesh = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const geometries = useMemo(() => ({
    boulder: new THREE.IcosahedronGeometry(1, 1),
    mound: new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    coin: new THREE.CylinderGeometry(0.17, 0.17, 0.045, 10),
    ring: new THREE.TorusGeometry(HOARD_SITE.radius, 0.09, 6, 72),
  }), []);
  useEffect(() => () => Object.values(geometries).forEach(geometry => geometry.dispose()), [geometries]);

  useEffect(() => {
    const object = new THREE.Object3D();
    const color = new THREE.Color();
    boulders.forEach((boulder, i) => {
      object.position.set(boulder.x, terrainHeight(boulder.x, boulder.z, "open") + boulder.size * 0.45, boulder.z);
      object.rotation.set(boulder.rotation * 0.3, boulder.rotation, 0.1);
      object.scale.set(boulder.size * 1.25, boulder.size * 0.9, boulder.size);
      object.updateMatrix();
      boulderMesh.current?.setMatrixAt(i, object.matrix);
      boulderMesh.current?.setColorAt(i, color.set("#7d776b").multiplyScalar(0.8 + (i % 4) * 0.08));
    });
    if (boulderMesh.current) {
      boulderMesh.current.instanceMatrix.needsUpdate = true;
      if (boulderMesh.current.instanceColor) boulderMesh.current.instanceColor.needsUpdate = true;
      boulderMesh.current.computeBoundingSphere();
    }
  }, [boulders]);

  useEffect(() => {
    const mesh = coinMesh.current;
    if (!mesh) return;
    const object = new THREE.Object3D();
    const count = Math.min(220, 14 + Math.floor(gold / 18));
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996 + Math.sin(i * 7.1) * 0.4;
      const r = Math.min(5.2, Math.sqrt((i * 0.618) % 1) * 4.9 + (i % 9 === 0 ? 0.6 : 0));
      object.position.set(HOARD_SITE.x + Math.cos(angle) * r, floor + moundSurface(r, height) + 0.02, HOARD_SITE.z + Math.sin(angle) * r);
      object.rotation.set(Math.sin(i * 3.3) * 0.5, angle, Math.cos(i * 2.1) * 0.5);
      object.updateMatrix();
      mesh.setMatrixAt(i, object.matrix);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [gold, height, floor]);

  const label = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 176;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { canvas, texture };
  }, []);
  useEffect(() => () => label.texture.dispose(), [label]);
  useEffect(() => {
    const ctx = label.canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 512, 176);
    ctx.fillStyle = "rgba(20, 13, 4, 0.72)";
    ctx.beginPath(); ctx.roundRect(8, 8, 496, 160, 26); ctx.fill();
    ctx.strokeStyle = "rgba(255, 210, 122, 0.8)"; ctx.lineWidth = 4; ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe3a3";
    ctx.font = "bold 34px Cinzel, Georgia, serif";
    ctx.fillText("YOUR HOARD", 256, 58);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 46px Inter, system-ui, sans-serif";
    ctx.fillText(`${gold.toLocaleString()} gold`, 256, 112);
    ctx.fillStyle = "#f0c56a";
    ctx.font = "24px Inter, system-ui, sans-serif";
    ctx.fillText(hoardRank(gold).title, 256, 148);
    label.texture.needsUpdate = true;
  }, [gold, label]);

  useFrame(state => {
    if (!ring.current) return;
    const carrying = Boolean(lootHud.left || lootHud.right);
    const material = ring.current.material as THREE.MeshBasicMaterial;
    material.opacity = carrying ? 0.55 + Math.sin(state.clock.elapsedTime * 5) * 0.3 : 0.28;
    ring.current.scale.setScalar(carrying ? 1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.03 : 1);
  });

  return <group>
    <RigidBody type="fixed" colliders={false}>
      {boulders.map((boulder, i) => <BallCollider key={i} args={[boulder.size * 0.85]} position={[boulder.x, terrainHeight(boulder.x, boulder.z, "open") + boulder.size * 0.45, boulder.z]} />)}
    </RigidBody>
    <instancedMesh ref={boulderMesh} args={[geometries.boulder, undefined, boulders.length]} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.95} />
    </instancedMesh>
    <mesh geometry={geometries.mound} position={[HOARD_SITE.x, floor - 0.02, HOARD_SITE.z]} scale={[MOUND_RADIUS, height, MOUND_RADIUS]} receiveShadow>
      <meshStandardMaterial color="#e9b23a" roughness={0.34} metalness={0.25} emissive="#5a3a00" emissiveIntensity={0.35} />
    </mesh>
    <instancedMesh ref={coinMesh} args={[geometries.coin, undefined, 220]} count={0} frustumCulled={false}>
      <meshStandardMaterial color="#f6cb52" roughness={0.3} metalness={0.3} emissive="#6b4a00" emissiveIntensity={0.4} />
    </instancedMesh>
    <mesh ref={ring} geometry={geometries.ring} position={[HOARD_SITE.x, floor + 0.12, HOARD_SITE.z]} rotation={[Math.PI / 2, 0, 0]}>
      <meshBasicMaterial color="#ffd27a" transparent opacity={0.3} depthWrite={false} toneMapped={false} />
    </mesh>
    <sprite position={[HOARD_SITE.x, floor + height + 5.2, HOARD_SITE.z]} scale={[6.4, 2.2, 1]}>
      <spriteMaterial map={label.texture} transparent depthWrite={false} />
    </sprite>
  </group>;
}

/** VR: glowing talons show where each hand is reaching; they curl when you squeeze. */
function ClawCursors({ dragon }: { dragon: DragonType }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const glowColor = dragon.colors.eye === "#1A1A1A" ? "#ffd27a" : dragon.colors.eye;
  useFrame(() => {
    for (const [side, group] of [["left", left.current], ["right", right.current]] as const) {
      if (!group) continue;
      const hand = clawInput[side];
      group.visible = clawInput.active && hand.tracked;
      if (!group.visible) continue;
      group.position.set(hand.target.x, hand.target.y, hand.target.z);
      group.rotation.set(0, playerStatus.heading, 0);
    }
  });
  return <>
    <group ref={left} visible={false}>
      <DragonClaw color={dragon.colors.horn} glowColor={glowColor} grip={() => clawInput.left.grip ? 1 : 0} glow={() => clawInput.left.near} />
    </group>
    <group ref={right} visible={false}>
      <DragonClaw color={dragon.colors.horn} glowColor={glowColor} grip={() => clawInput.right.grip ? 1 : 0} glow={() => clawInput.right.near} />
    </group>
  </>;
}
