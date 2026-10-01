import type { Vector3Like } from "./flight.ts";

/**
 * VR hands puppeteer the dragon's hind talons. A hand held relaxed in front of the chest
 * leaves the talon at rest; reaching out or down moves the talon the same way, magnified.
 */
export const CLAW_REACH = {
  /** Talon travel per metre of hand travel. */
  gain: 3.4,
  /** Furthest a talon can stretch from its rest point, in world units. */
  maxReach: 2.6,
  /** Small hand motions near the neutral pose leave the talon still. */
  deadzone: 0.05,
  /** Neutral hand position relative to the head (metres, origin axes). */
  neutral: { side: 0.2, down: 0.5, forward: 0.28 },
} as const;

/** Rest positions of the hind feet relative to the player body (model scale 0.8, facing -Z). */
export const FOOT_REST = {
  left: { x: -0.42, y: 0.63, z: 0.23 },
  right: { x: 0.43, y: 0.63, z: 0.23 },
} as const;

export type ClawSide = "left" | "right";

/** Same convention as Object3D.rotation.y: heading 0 faces -Z. */
export function rotateY(vector: Vector3Like, yaw: number): Vector3Like {
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  return { x: vector.x * cos + vector.z * sin, y: vector.y, z: -vector.x * sin + vector.z * cos };
}

/** Where a talon rests in the world when the hand is neutral. */
export function talonAnchor(side: ClawSide, body: Vector3Like, yaw: number): Vector3Like {
  const offset = rotateY(FOOT_REST[side], yaw);
  return { x: body.x + offset.x, y: body.y + offset.y, z: body.z + offset.z };
}

/**
 * World-space talon offset for a tracked hand. Hand and head are in XR origin space, whose
 * axes follow the dragon's yaw, so the offset is rotated by the same yaw into the world.
 * The relaxed pose turns with the head (headYaw, origin space), so a player who turns their
 * body still has relaxed hands; the reach itself keeps world-consistent directions.
 */
export function clawReach(side: ClawSide, hand: Vector3Like, head: Vector3Like, yaw: number, headYaw = 0): Vector3Like {
  const values = [hand.x, hand.y, hand.z, head.x, head.y, head.z, yaw, headYaw];
  if (!values.every(Number.isFinite)) return { x: 0, y: 0, z: 0 };
  const sign = side === "left" ? -1 : 1;
  const relaxed = rotateY({ x: sign * CLAW_REACH.neutral.side, y: 0, z: -CLAW_REACH.neutral.forward }, headYaw);
  let x = hand.x - (head.x + relaxed.x);
  let y = hand.y - (head.y - CLAW_REACH.neutral.down);
  let z = hand.z - (head.z + relaxed.z);
  const length = Math.hypot(x, y, z);
  if (length <= CLAW_REACH.deadzone) return { x: 0, y: 0, z: 0 };
  const travel = Math.min(CLAW_REACH.maxReach, (length - CLAW_REACH.deadzone) * CLAW_REACH.gain);
  x *= travel / length; y *= travel / length; z *= travel / length;
  return rotateY({ x, y, z }, yaw);
}
