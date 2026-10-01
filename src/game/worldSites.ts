import { terrainHeight } from "./landscape.ts";
import { FROZEN_LAKE, HOME_LAKE, MUD_POOLS, OASIS, SEA_STACKS } from "./world.ts";
import type { Kingdom } from "./world.ts";

/** Where a kingdom's beacon stands: on its flattened pad, or atop the sea stack for the SeaWings. */
export function beaconBase(kingdom: Kingdom) {
  const [x, , z] = kingdom.beaconPosition;
  if (kingdom.id === "sea") {
    const stack = SEA_STACKS[0];
    return { x: stack.x, y: stack.top, z: stack.z };
  }
  return { x, y: terrainHeight(x, z, "open"), z };
}

export type WaterKind = "lake" | "ice" | "oasis" | "mud";

/** Inland water bodies, shared by the renderer, the map, and anything that must not land in them. */
export function inlandWater(x: number, z: number): WaterKind | null {
  if (Math.hypot(x - HOME_LAKE.x, z - HOME_LAKE.z) < HOME_LAKE.radius) return "lake";
  if (Math.hypot(x - FROZEN_LAKE.x, z - FROZEN_LAKE.z) < FROZEN_LAKE.radius) return "ice";
  if (Math.hypot(x - OASIS.x, z - OASIS.z) < OASIS.radius) return "oasis";
  for (const pool of MUD_POOLS) if (Math.hypot(x - pool.x, z - pool.z) < pool.r * 0.62) return "mud";
  return null;
}
