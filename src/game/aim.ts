import type { World, Ray } from "@dimforge/rapier3d-compat";
import type { Vector3Like } from "./flight";

export const WORLD_ONLY = (1 << 16) | 1;
// Query as a player shot (group 1 against group 0): sees solid targets, not friendly shots or the player.
export const AIM_TARGETS = (2 << 16) | 1;

/** Keep the projectile origin on the player's side of blocking geometry. */
export function safeMuzzle(world: World, ray: Ray, from: Vector3Like, desired: Vector3Like, excludeSensors: number) {
  const x = desired.x - from.x, y = desired.y - from.y, z = desired.z - from.z;
  const distance = Math.hypot(x, y, z);
  if (distance < 1e-6) return { ...from };
  ray.origin = from;
  ray.dir = { x: x / distance, y: y / distance, z: z / distance };
  const hit = world.castRay(ray, distance, true, excludeSensors, WORLD_ONLY);
  const reach = hit ? Math.max(0, hit.timeOfImpact - 0.4) : distance;
  return { x: from.x + ray.dir.x * reach, y: from.y + ray.dir.y * reach, z: from.z + ray.dir.z * reach };
}
