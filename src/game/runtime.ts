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
export const xrInput = { throttle: 0, stickThrottle: 0, climb: 0, fire: false, special: false, snapYaw: 0, glide: false, brake: false };
/** World positions of the dragon's hind claws, refreshed by the player every frame. */
export const talonState = { left: { x: 0, y: 4.6, z: 0.2 }, right: { x: 0, y: 4.6, z: 0.2 }, ready: false };
export const playerVelocity = { x: 0, y: 0, z: 0 };
/** Treasure weight slows the flight model; written by the loot system. */
export const carryState = { speedFactor: 1, climbFactor: 1 };
export const lootInput = { drop: false };

export interface ClawHand {
  /** A tracked controller is steering this talon. */
  tracked: boolean;
  /** Where the hand puts the dragon's talon, in world space. */
  target: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  grip: boolean;
  /** The loot system claimed this grip, so it is not braking or gliding. */
  busy: boolean;
  /** Treasure is within reach of this talon (drives a haptic tick). */
  near: boolean;
}
const clawHand = (): ClawHand => ({ tracked: false, target: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, grip: false, busy: false, near: false });
/** VR controllers puppeteer the talons; desktop and touch snatch automatically. */
export const clawInput = { active: false, left: clawHand(), right: clawHand() };
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
  Object.assign(xrInput, { throttle: 0, stickThrottle: 0, climb: 0, fire: false, special: false, snapYaw: 0, glide: false, brake: false });
  Object.assign(pan, { yaw: 0, pitch: 0, active: 0 });
  lootInput.drop = false;
  clawInput.left.grip = clawInput.right.grip = false;
}

export function shoot(shot: Shot) {
  fireballEmitter.dispatchEvent(new CustomEvent<Shot>("shoot", { detail: shot }));
}
