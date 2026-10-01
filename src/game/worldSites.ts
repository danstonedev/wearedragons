import { terrainHeight } from "./landscape.ts";
import { FROZEN_LAKE, HOME_LAKE, MUD_POOLS, OASIS, PADS, SEA_STACKS, SKY_PALACE, padTop } from "./world.ts";
import type { Kingdom, KingdomId } from "./world.ts";

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

const pad = (x: number, z: number) => PADS.find(item => item.x === x && item.z === z)!;
const ICE_TERRACE = pad(-580, -790), VILLAGE = pad(-560, -180), DEN = pad(500, -340);

export type RoyalKingdom = Exclude<KingdomId, "pyrrhia">;
/**
 * Each kingdom's royal hoard: a heap of gold with its crown treasure, guarded by a champion.
 * Taking from it puts the whole kingdom on alert.
 */
export const ROYAL_HOARDS: Readonly<Record<RoyalKingdom, { x: number; y: number; z: number; r: number }>> = {
  sky: { x: SKY_PALACE.x, y: SKY_PALACE.top, z: SKY_PALACE.z + 15, r: 5 },
  ice: { x: ICE_TERRACE.x, y: ICE_TERRACE.height!, z: ICE_TERRACE.z + 17, r: 5 },
  mud: { x: VILLAGE.x, y: VILLAGE.height!, z: VILLAGE.z + 16, r: 5 },
  rainforest: { x: 556, y: terrainHeight(556, -772, "open"), z: -772, r: 5 },
  sand: { x: DEN.x, y: DEN.height!, z: DEN.z + 13, r: 4.5 },
  pantala: { x: 330, y: padTop(330, 40), z: 40, r: 5 },
  glaeryus: { x: -340, y: padTop(-340, 30), z: 38, r: 5 },
  sea: { x: SEA_STACKS[1].x, y: SEA_STACKS[1].top, z: SEA_STACKS[1].z, r: 3.6 },
};
