import { SEA_LEVEL, shorelineZ } from "./coast.ts";
import { terrainHeight } from "./landscape.ts";
import { noise, seededRandom } from "./noise.ts";
import { CHUNK_SIZE, chunkOrigin } from "./terrainChunks.ts";
import {
  GREAT_ARCH, FALLEN_GIANT, GREAT_FALLS, LAND_KINGDOMS, MUD_POOLS, OASIS, PADS, RAINFOREST_GIANTS, SKY_PALACE, VOLCANO, kingdomWeights,
} from "./world.ts";
import type { LandKingdomId } from "./world.ts";
import { inlandWater } from "./worldSites.ts";

export type SceneryStyle =
  | "broadleaf" | "pine" | "snowpine" | "darkpine" | "palm" | "jungle" | "deadtree" | "cactus" | "acacia"
  | "reeds" | "rock" | "boulder" | "crystal" | "basalt" | "grass" | "bush" | "drybush";

export interface SceneryItem { style: SceneryStyle; x: number; y: number; z: number; scale: number; rotation: number; tint: number }

/** Trunks and big rocks block flight near the dragon; foliage, grass, and pebbles do not. */
export const SOLID_SCENERY: Partial<Record<SceneryStyle, { shape: "trunk" | "ball"; radius: number; height: number }>> = {
  broadleaf: { shape: "trunk", radius: 0.3, height: 3 },
  pine: { shape: "trunk", radius: 0.3, height: 2.6 },
  snowpine: { shape: "trunk", radius: 0.3, height: 2.6 },
  darkpine: { shape: "trunk", radius: 0.3, height: 2.6 },
  palm: { shape: "trunk", radius: 0.32, height: 5.5 },
  jungle: { shape: "trunk", radius: 0.7, height: 10.5 },
  deadtree: { shape: "trunk", radius: 0.26, height: 3.6 },
  cactus: { shape: "trunk", radius: 0.42, height: 2.8 },
  acacia: { shape: "trunk", radius: 0.24, height: 3.3 },
  basalt: { shape: "trunk", radius: 1.05, height: 4.2 },
  crystal: { shape: "trunk", radius: 0.55, height: 3.4 },
  boulder: { shape: "ball", radius: 1.25, height: 1.1 },
};

/** Small things nobody sees from far away. */
export const NEAR_ONLY: ReadonlySet<SceneryStyle> = new Set(["reeds", "rock", "grass", "bush", "drybush"]);

const SCALE: Record<SceneryStyle, [number, number]> = {
  broadleaf: [0.85, 1.9], pine: [0.9, 2.1], snowpine: [0.9, 2.0], darkpine: [0.9, 2.2], palm: [0.85, 1.35], jungle: [0.9, 1.6],
  deadtree: [0.8, 1.5], cactus: [0.8, 1.5], acacia: [0.9, 1.6], reeds: [0.7, 1.3], rock: [0.5, 1.4], boulder: [0.8, 1.9],
  crystal: [0.8, 2.2], basalt: [0.8, 1.7], grass: [0.7, 1.4], bush: [0.7, 1.5], drybush: [0.6, 1.2],
};

/** Places scenery never goes: water, flattened sites, the volcano's throat, the falls' river. */
export function sceneryBlocked(x: number, z: number) {
  // The home valley's own forest, meadow, and rocks already cover this square.
  if (Math.abs(x) < 195 && z > -195 && z < 15) return true;
  for (const pad of PADS) if (Math.hypot(x - pad.x, z - pad.z) < pad.r + 6) return true;
  if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < VOLCANO.crater + 26) return true;
  if (Math.hypot(x - SKY_PALACE.x, z - SKY_PALACE.z) < SKY_PALACE.radius + 8) return true;
  if (Math.abs(x - GREAT_FALLS.lip.x) < 20 && z > GREAT_FALLS.z && z < GREAT_FALLS.pool.z + GREAT_FALLS.pool.radius + 12) return true;
  for (const site of LANDMARK_FOOTPRINTS) if (Math.hypot(x - site.x, z - site.z) < site.r) return true;
  return inlandWater(x, z) !== null;
}

/** Landmarks that are not flattened pads but still need clear ground (see Landmarks). */
export const LANDMARK_FOOTPRINTS: readonly { x: number; z: number; r: number }[] = [
  { x: GREAT_ARCH.x, z: GREAT_ARCH.z, r: GREAT_ARCH.span / 2 + 12 },
  { x: FALLEN_GIANT.x, z: FALLEN_GIANT.z, r: 34 },
  ...RAINFOREST_GIANTS.map(giant => ({ x: giant.x, z: giant.z, r: 16 })),
];

function pickKingdom(weights: Float64Array, roll: number): LandKingdomId {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (roll <= sum) return LAND_KINGDOMS[i];
  }
  return LAND_KINGDOMS[LAND_KINGDOMS.length - 1];
}

function chooseStyle(kingdom: LandKingdomId, x: number, z: number, y: number, slope: number, roll: number): SceneryStyle | null {
  const forest = noise(x * 0.02 + 40, z * 0.02 - 13);
  const steep = slope > 0.85;
  if (z > shorelineZ(x) - 34) return roll < 0.06 ? "palm" : roll < 0.12 ? "rock" : roll < 0.16 ? "drybush" : null;
  switch (kingdom) {
    case "pyrrhia":
      if (steep) return roll < 0.35 ? "rock" : null;
      if (forest > -0.05) return roll < 0.62 ? (y > 16 && roll < 0.3 ? "pine" : "broadleaf") : roll < 0.8 ? "bush" : roll < 0.92 ? "grass" : "rock";
      return roll < 0.4 ? "grass" : roll < 0.55 ? "bush" : roll < 0.65 ? "rock" : roll < 0.7 ? "broadleaf" : null;
    case "sky": {
      if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < 230) return roll < 0.22 ? "boulder" : roll < 0.3 ? "deadtree" : roll < 0.42 ? "rock" : null;
      if (steep) return roll < 0.25 ? "rock" : roll < 0.32 ? "boulder" : null;
      if (y < 78) return roll < (forest > 0 ? 0.6 : 0.3) ? "pine" : roll < 0.7 ? "boulder" : roll < 0.82 ? "rock" : null;
      return roll < 0.18 ? "rock" : roll < 0.26 ? "boulder" : null;
    }
    case "ice":
      if (!steep && y < 42 && forest > -0.2 && roll < 0.35) return "snowpine";
      return roll < 0.5 ? "crystal" : roll < 0.62 ? "boulder" : roll < 0.7 ? "rock" : null;
    case "mud": {
      const nearPool = MUD_POOLS.some(pool => Math.hypot(x - pool.x, z - pool.z) < pool.r * 1.35);
      if (nearPool) return roll < 0.75 ? "reeds" : roll < 0.85 ? "deadtree" : null;
      return roll < 0.22 ? "deadtree" : roll < 0.5 ? "reeds" : roll < 0.72 ? "bush" : roll < 0.8 ? "rock" : null;
    }
    case "rainforest":
      if (steep) return roll < 0.4 ? "rock" : roll < 0.5 ? "bush" : null;
      return roll < 0.5 ? "jungle" : roll < 0.78 ? "bush" : roll < 0.9 ? "palm" : roll < 0.95 ? "boulder" : null;
    case "sand": {
      const oasis = Math.hypot(x - OASIS.x, z - OASIS.z);
      if (oasis < OASIS.shore + 26) return roll < 0.75 ? "palm" : "bush";
      return roll < 0.1 ? "cactus" : roll < 0.17 ? "rock" : roll < 0.22 ? "drybush" : null;
    }
    case "pantala":
      if (steep) return roll < 0.3 ? "rock" : null;
      return roll < 0.2 ? "acacia" : roll < 0.4 ? "drybush" : roll < 0.52 ? "rock" : roll < 0.62 ? "grass" : null;
    case "glaeryus":
      if (steep) return roll < 0.35 ? "basalt" : null;
      return roll < 0.22 ? "basalt" : roll < 0.45 ? "darkpine" : roll < 0.62 ? "rock" : roll < 0.7 ? "grass" : null;
  }
}

/**
 * The scenery of one chunk, the same on every visit: trees, rocks, crystals, and reeds
 * chosen by the kingdom underfoot, thinned on steep ground, and kept out of water.
 */
export function chunkScenery(cx: number, cz: number, attempts: number): SceneryItem[] {
  const random = seededRandom(73856093 ^ Math.imul(cx + 1, 19349663) ^ Math.imul(cz + 1, 83492791));
  const origin = chunkOrigin(cx, cz);
  const weights = new Float64Array(LAND_KINGDOMS.length);
  const items: SceneryItem[] = [];
  for (let i = 0; i < attempts; i++) {
    const x = origin.x + random() * CHUNK_SIZE, z = origin.z + random() * CHUNK_SIZE;
    const kingdomRoll = random(), styleRoll = random(), size = random(), rotation = random() * Math.PI * 2, tint = random();
    if (sceneryBlocked(x, z)) continue;
    // The southern part of the home valley stays open, as it always was.
    if (Math.abs(x) < 195 && z >= 15 && kingdomRoll > 0.3) continue;
    const y = terrainHeight(x, z, "open");
    if (y < SEA_LEVEL + 0.6) continue;
    const slope = Math.hypot(terrainHeight(x + 1.5, z, "open") - y, terrainHeight(x, z + 1.5, "open") - y) / 1.5;
    const style = chooseStyle(pickKingdom(kingdomWeights(x, z, weights), kingdomRoll), x, z, y, slope, styleRoll);
    if (!style) continue;
    const [low, high] = SCALE[style];
    items.push({ style, x, y, z, scale: low + (high - low) * size, rotation, tint });
  }
  return items;
}
