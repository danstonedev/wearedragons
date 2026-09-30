import type { Collider, KinematicCharacterController, RigidBody } from "@dimforge/rapier3d-compat";
import type { Vector3Like } from "./flight";

export const PLAYER_GROUPS = (4 << 16) | 1;
export const PLAYER_CAPSULE = { halfHeight: 0.5, radius: 0.65, offset: 0.05 };

export function configureFlightController(controller: KinematicCharacterController) {
  controller.setSlideEnabled(true);
  controller.setMaxSlopeClimbAngle(Math.PI / 4);
  controller.setMinSlopeSlideAngle(Math.PI / 3);
  // Flight must not snap back down when taking off or crossing a ledge.
  controller.disableSnapToGround();
  controller.disableAutostep();
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(8);
}

/** Resolve every physics step, including catch-up steps, before committing the pose. */
export function moveFlightCharacter(controller: KinematicCharacterController, body: RigidBody, collider: Collider, velocity: Vector3Like, delta: number, excludeSensors: number) {
  // Bound extreme commands/stalls; normal flight remains below this per-step travel.
  const scale = Math.min(delta, 4 / Math.max(1e-9, Math.hypot(velocity.x, velocity.y, velocity.z)));
  controller.computeColliderMovement(collider, { x: velocity.x * scale, y: velocity.y * scale, z: velocity.z * scale }, excludeSensors, PLAYER_GROUPS);
  const movement = controller.computedMovement();
  const position = body.translation();
  body.setNextKinematicTranslation({ x: position.x + movement.x, y: position.y + movement.y, z: position.z + movement.z });
  return { velocity: { x: movement.x / delta, y: movement.y / delta, z: movement.z / delta }, grounded: controller.computedGrounded() };
}

export type FlightMode = "grounded" | "takeoff" | "landing" | "dive" | "cruise" | "hover";
export function flightMode(grounded: boolean, altitude: number, velocity: Vector3Like): FlightMode {
  if (grounded && velocity.y <= 0.1) return "grounded";
  if (altitude < 4 && velocity.y > 0.5) return "takeoff";
  if (altitude < 4 && velocity.y < -0.5) return "landing";
  if (velocity.y < -4) return "dive";
  return Math.hypot(velocity.x, velocity.z) > 1 ? "cruise" : "hover";
}
