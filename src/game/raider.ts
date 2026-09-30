import { damp } from "./flight.ts";
import type { Vector3Like } from "./flight.ts";

export type RaiderPhase = "patrol" | "intercept" | "windup" | "evade" | "retreat";
export interface RaiderState {
  position: Vector3Like;
  velocity: Vector3Like;
  phase: RaiderPhase;
  phaseTime: number;
  cooldown: number;
  orbit: number;
}

export const RAIDER_ID = "raider_scout";
export const RAIDER_HP = 105;
export const RAIDER_SPAWN = { x: -12, y: 18, z: -48 };

export function createRaiderState(): RaiderState {
  return { position: { ...RAIDER_SPAWN }, velocity: { x: 0, y: 0, z: 0 }, phase: "patrol", phaseTime: 0, cooldown: 1.5, orbit: 1 };
}

/** Simulation-time combat step. World visibility comes from the scene's solid-geometry ray. */
export function advanceRaider(state: RaiderState, player: Vector3Like, delta: number, visible: boolean): { state: RaiderState; fire: boolean } {
  const dt = Math.max(0, Math.min(delta, 1 / 15));
  const { position, velocity } = state;
  const dx = player.x - position.x, dz = player.z - position.z;
  const horizontal = Math.hypot(dx, dz);
  const distance = Math.hypot(dx, player.y - position.y, dz);
  const detected = visible && distance < 65;
  let phase = state.phase;
  let phaseTime = state.phaseTime + dt;
  let cooldown = Math.max(0, state.cooldown - dt);
  let orbit = state.orbit;
  let fire = false;
  const change = (next: RaiderPhase) => { phase = next; phaseTime = 0; };

  if (!detected) {
    if (phase !== "patrol") change("patrol");
  } else if (phase === "patrol") {
    change("intercept");
  } else if (phase === "windup") {
    if (phaseTime >= 0.75) {
      fire = true;
      cooldown = 2.4;
      orbit = -orbit;
      change("evade");
    }
  } else if (phase === "evade") {
    if (phaseTime >= 0.9) change("intercept");
  } else if (phase === "retreat") {
    if (horizontal > 13) change("intercept");
  } else if (horizontal < 9) {
    change("retreat");
  } else if (distance < 34 && cooldown <= 0) {
    change("windup");
  }

  const nx = dx / Math.max(horizontal, 0.01), nz = dz / Math.max(horizontal, 0.01);
  const altitude = Math.max(14, Math.min(32, player.y + 6));
  let target: Vector3Like;
  if (phase === "patrol") {
    const angle = phaseTime * 0.36;
    target = { x: RAIDER_SPAWN.x + Math.cos(angle) * 8, y: 18 + Math.sin(angle * 2) * 2, z: RAIDER_SPAWN.z + Math.sin(angle) * 8 };
  } else if (phase === "retreat") {
    target = { x: player.x - nx * 19, y: altitude + 3, z: player.z - nz * 19 };
  } else if (phase === "evade") {
    target = { x: position.x + nz * orbit * 12, y: altitude, z: position.z - nx * orbit * 12 };
  } else {
    target = { x: player.x - nx * 20 + nz * orbit * 5, y: altitude, z: player.z - nz * 20 - nx * orbit * 5 };
  }
  const tx = target.x - position.x, ty = target.y - position.y, tz = target.z - position.z;
  const length = Math.max(0.01, Math.hypot(tx, ty, tz));
  const speed = phase === "windup" ? 2 : phase === "evade" ? 15 : 10;
  const nextVelocity = {
    x: damp(velocity.x, tx / length * Math.min(speed, length * 2), 4, dt),
    y: damp(velocity.y, ty / length * Math.min(speed, length * 2), 4, dt),
    z: damp(velocity.z, tz / length * Math.min(speed, length * 2), 4, dt),
  };
  return {
    state: {
      position: { x: position.x + nextVelocity.x * dt, y: Math.max(12, position.y + nextVelocity.y * dt), z: position.z + nextVelocity.z * dt },
      velocity: nextVelocity, phase, phaseTime, cooldown, orbit,
    },
    fire,
  };
}
