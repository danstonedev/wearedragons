import { noise, ridged, smoothstep } from "./noise.ts";
import { shorelineZ } from "./coast.ts";

/**
 * The open world: a continent of dragon kingdoms around the player's home valley.
 * Coordinates: +X is east, +Z is south (the sea), -Z is north.
 */
export const WORLD_BOUNDS = { minX: -800, maxX: 800, minZ: -1000, maxZ: 400 } as const;

/** The original valley (hoard, lake, beacons, home treasure) keeps its exact terrain inside `inner`. */
export const HOME = { x: 0, z: -20, inner: 215, outer: 300 } as const;

export type KingdomId = "pyrrhia" | "pantala" | "glaeryus" | "sky" | "ice" | "mud" | "rainforest" | "sand" | "sea";
export type LandKingdomId = Exclude<KingdomId, "sea">;

export interface Kingdom {
  id: KingdomId;
  name: string;
  /** Dragon tribes (roster ids) that live here. Every other tribe is a trespasser. */
  tribes: readonly string[];
  description: string;
  lore: string;
  color: string;
  textColor: string;
  beaconColor: string;
  /** [x, y, z]; y is the ground (or perch) height under the beacon. */
  beaconPosition: [number, number, number];
  fog: string;
  sun: string;
}

interface LandLayout { seed: readonly [number, number]; bias: number }

/** Territory seeds: the nearest (warped) seed owns the land. */
const LAYOUT: Record<LandKingdomId, LandLayout> = {
  pyrrhia: { seed: [0, -150], bias: 0 },
  pantala: { seed: [300, 180], bias: 0 },
  glaeryus: { seed: [-300, 180], bias: 0 },
  sky: { seed: [40, -720], bias: 0 },
  ice: { seed: [-560, -740], bias: 0 },
  mud: { seed: [-620, -300], bias: 0 },
  rainforest: { seed: [560, -680], bias: 0 },
  sand: { seed: [620, -300], bias: 0 },
};
export const LAND_KINGDOMS = Object.keys(LAYOUT) as LandKingdomId[];

// ---- Landmarks the terrain is shaped around ----

/** The home valley's lake. */
export const HOME_LAKE = { x: 62, z: -82, radius: 27.5, surface: -1.55 } as const;

export const VOLCANO = { x: 60, z: -770, radius: 260, height: 185, crater: 40, lava: 100 } as const;
export const SKY_PALACE = { x: -150, z: -580, top: 92, radius: 46 } as const;
export const FROZEN_LAKE = { x: -520, z: -650, radius: 62, shore: 96, level: 15 } as const;
export const GREAT_FALLS = { x: 560, z: -720, radius: 112, cliff: 136, top: 58, lip: { x: 560, z: -605 }, pool: { x: 560, z: -572, radius: 26 } } as const;
export const OASIS = { x: 640, z: -150, radius: 34, shore: 48, level: 0.4 } as const;
export const MUD_POOLS: readonly { x: number; z: number; r: number }[] = [
  { x: -520, z: -230, r: 22 }, { x: -610, z: -330, r: 26 }, { x: -700, z: -190, r: 18 }, { x: -470, z: -380, r: 20 },
  { x: -660, z: -420, r: 24 }, { x: -560, z: -120, r: 16 }, { x: -740, z: -300, r: 17 }, { x: -430, z: -150, r: 15 },
];
export const MUD_LEVEL = 0.15;
/** Rock pillars standing in the surf; the SeaWings' beacon burns on the first. */
export const SEA_STACKS: readonly { x: number; z: number; r: number; top: number }[] = [
  { x: 60, z: 205, r: 7, top: 24 }, { x: -120, z: 196, r: 6, top: 30 }, { x: 210, z: 214, r: 8, top: 34 },
  { x: -300, z: 188, r: 9, top: 40 }, { x: 380, z: 205, r: 6, top: 27 }, { x: -520, z: 200, r: 8, top: 36 },
  { x: 560, z: 196, r: 10, top: 44 }, { x: 15, z: 260, r: 5, top: 22 },
];

/** Flattened sites for beacons, palaces, villages, and camps. Heights default to the land there. */
export interface Pad { x: number; z: number; r: number; blend: number; height?: number }
export const PADS: readonly Pad[] = [
  { x: -40, z: -500, r: 14, blend: 18 },              // Sky beacon foothill
  { x: -470, z: -560, r: 14, blend: 18 },             // Ice beacon
  { x: -480, z: -300, r: 14, blend: 16 },             // Mud beacon
  { x: 430, z: -560, r: 14, blend: 18 },              // Rainforest beacon
  { x: 470, z: -200, r: 14, blend: 18 },              // Sand beacon
  { x: -580, z: -790, r: 54, blend: 30, height: 30 }, // Ice Palace terrace
  { x: -560, z: -180, r: 40, blend: 24, height: 1.2 },// MudWing village
  { x: 500, z: -340, r: 50, blend: 28, height: 6 },   // Scorpion Den
  { x: 330, z: 40, r: 30, blend: 20 },                // Pantala hive court
  { x: -340, z: 30, r: 34, blend: 20 },               // Glaeryus citadel
];

export const KINGDOMS: readonly Kingdom[] = [
  {
    id: "pyrrhia", name: "Pyrrhia", tribes: [],
    description: "Ancient forested highlands, and your home valley.",
    lore: "The oldest dragon territories stretch across Pyrrhia's green valleys. Your hoard is here, and so are the scavengers who covet it.",
    color: "#4caf50", textColor: "#b2ffb7", beaconColor: "#ffd700", beaconPosition: [-30, 0, -100], fog: "#bacdd0", sun: "#ffe0b8",
  },
  {
    id: "pantala", name: "Pantala", tribes: ["hivewing", "silkwing", "leafwing"],
    description: "Sun-scorched eastern mesas crowned with hive towers.",
    lore: "Pantala's burning winds carry sand from a hundred collapsed civilizations. HiveWings, SilkWings, and LeafWings guard the hive towers.",
    color: "#ffa726", textColor: "#ffe0a0", beaconColor: "#ff8c00", beaconPosition: [130, 0, 90], fog: "#ddbf91", sun: "#ffe0b8",
  },
  {
    id: "glaeryus", name: "Glaeryus", tribes: ["ricewing", "acewing", "bladewing", "bonewing", "hivewing2"],
    description: "Fractured basalt terraces and a ruined citadel.",
    lore: "Glaeryus dragons carved their cities into solid basalt. The skies here are always overcast, yet the beacons burn cold blue for a hundred miles.",
    color: "#78909c", textColor: "#b0d0e0", beaconColor: "#44bbff", beaconPosition: [-130, 0, 90], fog: "#8ba8bf", sun: "#dae6ff",
  },
  {
    id: "sky", name: "Sky Kingdom", tribes: ["skywing"],
    description: "Red peaks, a smoking volcano, and a palace on a mountaintop.",
    lore: "SkyWings rule the high air. Their palace crowns a cliff-walled peak, and the volcano behind it never sleeps. They guard their skies fiercely, and their queen's treasure even more.",
    color: "#e0563a", textColor: "#ffc1ad", beaconColor: "#ff5a2a", beaconPosition: [-40, 0, -500], fog: "#d6b9a8", sun: "#ffd2a8",
  },
  {
    id: "ice", name: "Ice Kingdom", tribes: ["icewing"],
    description: "A frozen plateau beneath shimmering auroras.",
    lore: "IceWings rank every dragon they meet, and outsiders rank last. Their crystal palace overlooks a lake that has not thawed in a thousand years.",
    color: "#9fd8ff", textColor: "#e3f4ff", beaconColor: "#bff0ff", beaconPosition: [-470, 0, -560], fog: "#cfdeea", sun: "#e6f0ff",
  },
  {
    id: "mud", name: "Mud Kingdom", tribes: ["mudwing"],
    description: "Warm marshes and bubbling mud pools.",
    lore: "MudWing siblings always fight together. Their dome village sits among bubbling pools, and they do not like dragons who drop in uninvited.",
    color: "#a0783c", textColor: "#f0d6a0", beaconColor: "#e0a040", beaconPosition: [-480, 0, -300], fog: "#a9a78a", sun: "#ffe2b0",
  },
  {
    id: "rainforest", name: "Rainforest Kingdom", tribes: ["rainwing", "nightwing"],
    description: "Endless canopy and a thundering waterfall.",
    lore: "RainWings drowse in the canopy above the Great Falls, and NightWings watch from the shadows. You won't see either of them until it's too late.",
    color: "#3fbf6a", textColor: "#b8ffcf", beaconColor: "#7dff9a", beaconPosition: [430, 0, -560], fog: "#9fbfa1", sun: "#fff2c0",
  },
  {
    id: "sand", name: "Sand Kingdom", tribes: ["sandwing"],
    description: "Singing dunes, an oasis, and the Scorpion Den.",
    lore: "SandWings patrol the dunes around the Scorpion Den, a walled town where thieves trade stolen treasure. Water is precious here, and so is gold.",
    color: "#e9c46a", textColor: "#fff0c0", beaconColor: "#ffd166", beaconPosition: [470, 0, -200], fog: "#e3cda0", sun: "#ffe6b0",
  },
  {
    id: "sea", name: "Sea Kingdom", tribes: ["seawing"],
    description: "Surf, sea stacks, and SeaWing patrols.",
    lore: "SeaWings rise from the waves to chase intruders off their coast. Treasure washes up on the sea stacks, and they consider all of it theirs.",
    color: "#2fa4c8", textColor: "#b9ecff", beaconColor: "#5fe0ff", beaconPosition: [60, 0, 205], fog: "#a7c8d6", sun: "#fff0d0",
  },
];
export const KINGDOM_BY_ID: ReadonlyMap<KingdomId, Kingdom> = new Map(KINGDOMS.map(kingdom => [kingdom.id, kingdom]));

// ---- Territory ----

const seedX = LAND_KINGDOMS.map(id => LAYOUT[id].seed[0]);
const seedZ = LAND_KINGDOMS.map(id => LAYOUT[id].seed[1]);
const seedBias = LAND_KINGDOMS.map(id => LAYOUT[id].bias);
/** Width of the blend between neighbouring kingdoms' land shapes. */
const BLEND = 32;

/** Borders wander organically away from home; the home valley keeps straight, familiar borders. */
function warped(x: number, z: number) {
  const amount = 70 * smoothstep(160, 380, Math.hypot(x - HOME.x, z - HOME.z));
  return {
    x: x + noise(x * 0.004 + 11, z * 0.004 - 6) * amount,
    z: z + noise(x * 0.004 - 9, z * 0.004 + 4) * amount,
  };
}

/** Reused by the hot terrain path: effective distance and blend weight per land kingdom. */
const distances = new Float64Array(LAND_KINGDOMS.length);
const weightScratch = new Float64Array(LAND_KINGDOMS.length);

function territoryWeights(x: number, z: number, out: Float64Array) {
  const p = warped(x, z);
  let best = Infinity;
  for (let i = 0; i < LAND_KINGDOMS.length; i++) {
    distances[i] = Math.hypot(p.x - seedX[i], p.z - seedZ[i]) - seedBias[i];
    if (distances[i] < best) best = distances[i];
  }
  let total = 0;
  for (let i = 0; i < LAND_KINGDOMS.length; i++) {
    const gap = distances[i] - best;
    out[i] = gap > BLEND * 6 ? 0 : Math.exp(-gap / BLEND);
    total += out[i];
  }
  for (let i = 0; i < LAND_KINGDOMS.length; i++) out[i] /= total;
  return out;
}

/** The land kingdom that owns a point (ignores the sea). */
export function landKingdomAt(x: number, z: number): LandKingdomId {
  const p = warped(x, z);
  let best = 0, bestDistance = Infinity;
  for (let i = 0; i < LAND_KINGDOMS.length; i++) {
    const distance = Math.hypot(p.x - seedX[i], p.z - seedZ[i]) - seedBias[i];
    if (distance < bestDistance) { best = i; bestDistance = distance; }
  }
  return LAND_KINGDOMS[best];
}

/** The kingdom whose skies you are in: open water belongs to the SeaWings. */
export function kingdomAt(x: number, z: number): Kingdom {
  if (z > shorelineZ(x) - 4) return KINGDOM_BY_ID.get("sea")!;
  return KINGDOM_BY_ID.get(landKingdomAt(x, z))!;
}

/** Blend weights per land kingdom (same order as LAND_KINGDOMS); for colors and scenery. */
export function kingdomWeights(x: number, z: number, out = new Float64Array(LAND_KINGDOMS.length)) {
  return territoryWeights(x, z, out);
}

/** 1 inside the original valley, 0 beyond it. */
export function homeWeight(x: number, z: number) {
  return 1 - smoothstep(HOME.inner, HOME.outer, Math.hypot(x - HOME.x, z - HOME.z));
}

// ---- Land shapes ----

/** Irregular cliff lines: a circle's radius pushed in and out by direction (no seam). */
function wobble(dx: number, dz: number, distance: number, amount: number, seed: number) {
  if (distance < 1e-6) return 0;
  return noise(dx / distance * 1.6 + seed, dz / distance * 1.6 - seed) * amount;
}

function base(x: number, z: number) {
  return noise(x * 0.012, z * 0.012) * 5.5 + noise(x * 0.041, z * 0.041) * 2.3 + noise(x * 0.12, z * 0.12) * 0.42;
}

export function volcanoHeight(r: number) {
  const cone = (distance: number) => VOLCANO.height * Math.pow(Math.max(0, 1 - distance / VOLCANO.radius), 1.8);
  if (r >= VOLCANO.crater) return cone(r);
  return cone(VOLCANO.crater) - 48 * (1 - (r / VOLCANO.crater) ** 2);
}

function skyRelief(x: number, z: number, b: number) {
  const ranges = Math.pow(ridged(x * 0.0065, z * 0.0065), 2.2) * 62 + Math.pow(ridged(x * 0.016 + 4, z * 0.016 - 2), 2) * 22;
  let height = 14 + ranges + b * 1.2;
  // The volcano rises out of the ranges.
  const rv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
  if (rv < VOLCANO.radius + 60) {
    const fade = smoothstep(150, VOLCANO.radius + 60, rv);
    height = Math.max(volcanoHeight(rv), height * fade + 16 * (1 - fade));
  }
  // The palace peak: a cliff-walled plateau.
  const rp = Math.hypot(x - SKY_PALACE.x, z - SKY_PALACE.z);
  if (rp < 140) {
    const edge = SKY_PALACE.radius + Math.max(0, wobble(x - SKY_PALACE.x, z - SKY_PALACE.z, rp, 10, 3));
    height = Math.max(height, SKY_PALACE.top * (1 - smoothstep(edge, edge + 70, rp)) + noise(x * 0.2, z * 0.2) * 0.3 * (rp > edge ? 1 : 0));
  }
  return height;
}

function iceRelief(x: number, z: number, b: number) {
  let height = 20 + b * 1.4 + Math.pow(ridged(x * 0.01 - 7, z * 0.01 + 3), 3) * 34 + Math.pow(ridged(x * 0.03, z * 0.03), 2) * 6;
  const rl = Math.hypot(x - FROZEN_LAKE.x, z - FROZEN_LAKE.z);
  if (rl < FROZEN_LAKE.shore) {
    const t = smoothstep(FROZEN_LAKE.radius - 6, FROZEN_LAKE.shore, rl);
    height = (FROZEN_LAKE.level - 1.2) * (1 - t) + height * t;
  }
  return height;
}

function mudRelief(x: number, z: number, b: number) {
  let height = 0.6 + b * 0.45 + noise(x * 0.05, z * 0.05) * 0.6;
  for (const pool of MUD_POOLS) {
    const d = Math.hypot(x - pool.x, z - pool.z);
    if (d < pool.r) height -= (1 - smoothstep(pool.r * 0.45, pool.r, d)) * 2.6;
  }
  return height;
}

function rainforestRelief(x: number, z: number, b: number) {
  let height = 10 + b * 1.8 + Math.max(0, noise(x * 0.009 + 9, z * 0.009 + 2)) * 26 + Math.pow(ridged(x * 0.02, z * 0.02), 3) * 8;
  const rf = Math.hypot(x - GREAT_FALLS.x, z - GREAT_FALLS.z);
  if (rf < GREAT_FALLS.cliff + 30) {
    // A cliff-ringed plateau with a river running to the falls on its southern lip.
    // The lip itself stays put so the waterfall always pours from the same place.
    const lip = smoothstep(0.55, 0.9, (z - GREAT_FALLS.z) / Math.max(rf, 1));
    const shift = wobble(x - GREAT_FALLS.x, z - GREAT_FALLS.z, rf, 18, 9) * (1 - lip);
    const t = smoothstep(GREAT_FALLS.radius + shift, GREAT_FALLS.cliff + shift, rf);
    let top = GREAT_FALLS.top + noise(x * 0.03, z * 0.03) * 2.5;
    const across = Math.abs(x - GREAT_FALLS.lip.x);
    if (z > GREAT_FALLS.z && across < 16) top -= (1 - smoothstep(6, 16, across)) * 5;
    height = top * (1 - t) + Math.min(height, 22) * t;
  }
  const rp = Math.hypot(x - GREAT_FALLS.pool.x, z - GREAT_FALLS.pool.z);
  if (rp < GREAT_FALLS.pool.radius * 1.6) height = Math.min(height, 4 + smoothstep(GREAT_FALLS.pool.radius * 0.6, GREAT_FALLS.pool.radius * 1.6, rp) * 14);
  return height;
}

function sandRelief(x: number, z: number, b: number) {
  const crest = (x * 0.8 + z * 0.6 + noise(x * 0.006, z * 0.006) * 40) * 0.045;
  const dunes = Math.pow(Math.sin(crest) * 0.5 + 0.5, 2) * 9 * (0.6 + 0.4 * noise(x * 0.02, z * 0.02));
  let height = 3.5 + dunes + b * 0.4;
  const ro = Math.hypot(x - OASIS.x, z - OASIS.z);
  if (ro < OASIS.shore + 30) height = height * smoothstep(OASIS.radius - 4, OASIS.shore + 30, ro) + (OASIS.level - 1.4) * (1 - smoothstep(OASIS.radius - 4, OASIS.shore + 30, ro));
  return height;
}

function pantalaRelief(x: number, z: number, b: number) {
  const m = noise(x * 0.011 + 20, z * 0.011 - 4);
  return 2.5 + b * 0.8 + smoothstep(0.05, 0.16, m) * 16 + smoothstep(0.35, 0.45, m) * 12;
}

function glaeryusRelief(x: number, z: number, b: number) {
  const raw = (noise(x * 0.013 - 30, z * 0.013 + 12) * 1.4 + 0.6) * 14;
  const step = 5;
  const terraced = Math.floor(raw / step) * step + smoothstep(0.72, 1, raw / step - Math.floor(raw / step)) * step;
  return 3 + Math.max(0, terraced) + b * 0.5;
}

function pyrrhiaRelief(x: number, z: number, b: number) {
  return b * 1.3 + Math.pow(Math.max(0, noise(x * 0.007 + 3, z * 0.007 - 5)), 1.5) * 26;
}

const RELIEF: Record<LandKingdomId, (x: number, z: number, b: number) => number> = {
  pyrrhia: pyrrhiaRelief, pantala: pantalaRelief, glaeryus: glaeryusRelief, sky: skyRelief,
  ice: iceRelief, mud: mudRelief, rainforest: rainforestRelief, sand: sandRelief,
};
const RELIEF_LIST = LAND_KINGDOMS.map(id => RELIEF[id]);

/** Towering peaks wall the continent on the north, east, and west. */
export function rimHeight(x: number, z: number) {
  const edge = Math.min(x - WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX - x, z - WORLD_BOUNDS.minZ);
  if (edge > 170) return 0;
  const t = Math.pow(1 - smoothstep(0, 170, edge), 1.6);
  return t * (80 + Math.pow(ridged(x * 0.012, z * 0.012), 2) * 90 + noise(x * 0.04, z * 0.04) * 6);
}

function blendedRelief(x: number, z: number) {
  const weights = territoryWeights(x, z, weightScratch);
  const b = base(x, z);
  let height = 0;
  for (let i = 0; i < RELIEF_LIST.length; i++) if (weights[i] > 0.002) height += weights[i] * RELIEF_LIST[i](x, z, b);
  return height + rimHeight(x, z);
}

const padHeights = PADS.map(() => NaN);
function padHeight(index: number) {
  if (Number.isNaN(padHeights[index])) padHeights[index] = PADS[index].height ?? blendedRelief(PADS[index].x, PADS[index].z);
  return padHeights[index];
}

/** Land height outside the home valley (before the coastline is applied). */
export function outerInland(x: number, z: number) {
  let height = blendedRelief(x, z);
  for (let i = 0; i < PADS.length; i++) {
    const pad = PADS[i];
    const d = Math.hypot(x - pad.x, z - pad.z);
    if (d >= pad.r + pad.blend) continue;
    const t = smoothstep(pad.r, pad.r + pad.blend, d);
    height = padHeight(i) * (1 - t) + height * t;
  }
  return height;
}

/** Ground height of a beacon or pad site, for placing structures. */
export function padTop(x: number, z: number) {
  const index = PADS.findIndex(pad => pad.x === x && pad.z === z);
  return index >= 0 ? padHeight(index) : outerInland(x, z);
}

export type Attitude = "home" | "rival" | "neutral";
/** How a kingdom's dragons see you: your own tribe's land is home; every other tribe's is rival. */
export function attitudeOf(kingdom: Kingdom, tribe: string): Attitude {
  if (!kingdom.tribes.length) return "neutral";
  return kingdom.tribes.includes(tribe) ? "home" : "rival";
}
