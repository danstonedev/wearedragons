import type { AttackConfig } from "../dragons";

export const keys: Record<string, boolean> = {};
export const joy = { left: { x: 0, y: 0 }, throttle: 0, fire: false, special: false, glide: false, brake: false };
export const pan = { yaw: 0, pitch: 0, active: 0, lastX: 0, lastY: 0 };
export const abilityState = { cooldownLeft: 0, active: false, label: "" };
export const playerPos = { x: 0, y: 5, z: 0 };
export const playerStatus = { cloaked: false, invulnerable: false, heading: 0, flightMode: "hover", speed: 0 };
export const aim = { origin: { x: 0, y: 6.2, z: -3 }, direction: { x: 0, y: 0, z: -1 } };
export const combatFeedback = { hitAt: -999, destroyedAt: -999 };
export const gameSession = { paused: false, elapsed: 0, ready: false };
export const xrInput = { throttle: 0, climb: 0, fire: false, special: false, snapYaw: 0, glide: false, brake: false };
export const fireballEmitter = new EventTarget();
export const missionEmitter = new EventTarget();

export interface Shot {
  position: [number, number, number];
  velocity: [number, number, number];
  attack: AttackConfig;
}

export function resetInput() {
  for (const key of Object.keys(keys)) delete keys[key];
  Object.assign(joy.left, { x: 0, y: 0 });
  Object.assign(joy, { throttle: 0, fire: false, special: false, glide: false, brake: false });
  Object.assign(xrInput, { throttle: 0, climb: 0, fire: false, special: false, snapYaw: 0, glide: false, brake: false });
  Object.assign(pan, { yaw: 0, pitch: 0, active: 0 });
}

export function shoot(shot: Shot) {
  fireballEmitter.dispatchEvent(new CustomEvent<Shot>("shoot", { detail: shot }));
}
