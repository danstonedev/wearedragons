import type { TreasureKind } from "./loot.ts";

// ---- Lair data ----

export interface Spot { x: number; z: number }
export interface Circle extends Spot { r: number }
export interface LairLight extends Circle { intensity: number; color: string }
export interface LairLoot extends Spot { id: string; name: string; kind: TreasureKind; value: number; weight: number; tint?: string; prize?: boolean }
export type DragonRole = "sleeper" | "patrol";
export interface LairDragonDef extends Spot {
  id: string;
  name: string;
  /** Dragon roster id, used for colors and the model's look. */
  tribe: string;
  role: DragonRole;
  /** Facing angle: 0 faces +Z, positive turns toward +X. */
  yaw: number;
  route?: Spot[];
  hearing: number;
  sight: number;
  speed: number;
  chaseSpeed: number;
  lightSleeper?: boolean;
}
export interface LairDef {
  id: string;
  name: string;
  region: "pyrrhia" | "pantala" | "glaeryus";
  tagline: string;
  briefing: string;
  radius: number;
  exit: Circle;
  start: Spot & { yaw: number };
  hoard: Circle & { height: number };
  pillars: Circle[];
  lights: LairLight[];
  coins: Circle[];
  bones: Circle[];
  loot: LairLoot[];
  dragons: LairDragonDef[];
  ambient: number;
  palette: { floor: string; wall: string; fog: string; pillar: string };
  stars: readonly [number, number, number];
  pebbles: number;
}

const ring = (count: number, radius: number, offset = 0): Spot[] => Array.from({ length: count }, (_, i) => {
  const angle = offset + i / count * Math.PI * 2;
  return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
});

/** Three hand-built lairs, from a heavy sleeper to a patrolled ice cave. */
export const LAIRS: readonly LairDef[] = [
  {
    id: "mudwallow_den",
    name: "Mudwallow Den",
    region: "pyrrhia",
    tagline: "One sleepy MudWing. Lots of mud. Lots of gold.",
    briefing: "Old Gravelgut the MudWing sleeps like a boulder... mostly. Sneak while he snores, keep to the shadows between the braziers, and step around the coin piles: they jingle. Grab what you can carry and slip back down the burrow. The Heart of the Marsh rests right under his snout.",
    radius: 28,
    exit: { x: 0, z: 24, r: 2.4 },
    start: { x: 0, z: 21, yaw: Math.PI },
    hoard: { x: 0, z: -12, r: 7, height: 1.1 },
    pillars: [
      { x: -9, z: 6, r: 1.6 }, { x: 8, z: 9, r: 1.4 }, { x: -14, z: -4, r: 2 }, { x: 13, z: -5, r: 1.8 },
      { x: -4.5, z: -1, r: 1.1 }, { x: 5.5, z: 2, r: 1.2 }, { x: -18, z: 11, r: 1.5 }, { x: 17, z: 13, r: 1.6 },
      { x: 0.5, z: 12, r: 1 }, { x: -20, z: -12, r: 1.4 }, { x: 20, z: -11, r: 1.5 },
    ],
    lights: [
      { x: -10, z: -15, r: 9, intensity: 0.95, color: "#ff9a3c" },
      { x: 10.5, z: -15, r: 9, intensity: 0.95, color: "#ff9a3c" },
      { x: 0, z: 4, r: 6.5, intensity: 0.75, color: "#ffb35c" },
      { x: 0, z: 23.5, r: 4, intensity: 0.45, color: "#ffd88a" },
    ],
    coins: [{ x: -4.5, z: -6, r: 2 }, { x: 5, z: -7, r: 1.8 }, { x: 0, z: -3, r: 1.4 }, { x: -12, z: -9, r: 1.5 }],
    bones: [{ x: -6, z: 15, r: 1.5 }, { x: 7, z: 17, r: 1.3 }],
    loot: [
      { id: "m_pouch", name: "Muddy Coin Pouch", kind: "coins", value: 25, weight: 1, x: -15, z: 14 },
      { id: "m_goblet", name: "Clay-Crusted Goblet", kind: "goblet", value: 55, weight: 1, x: 16, z: 4 },
      { id: "m_map", name: "Soggy Treasure Map", kind: "scroll", value: 40, weight: 1, x: -19, z: -5 },
      { id: "m_garnet", name: "River Garnet", kind: "gem", value: 70, weight: 1, x: 9.5, z: -2.5, tint: "#ff4f6d" },
      { id: "m_idol", name: "Mud-Toad Idol", kind: "idol", value: 90, weight: 2, x: -8, z: -12 },
      { id: "m_crown", name: "Bog Queen's Crown", kind: "crown", value: 130, weight: 2, x: 8, z: -13 },
      { id: "m_boot", name: "A Very Muddy Boot", kind: "boot", value: 4, weight: 1, x: 3, z: 18 },
      { id: "m_heart", name: "Heart of the Marsh", kind: "orb", value: 220, weight: 3, x: 2, z: -5, tint: "#7dff9a", prize: true },
    ],
    dragons: [
      { id: "gravelgut", name: "Gravelgut", tribe: "mudwing", role: "sleeper", x: 0, z: -13, yaw: 0, hearing: 0.85, sight: 20, speed: 3.2, chaseSpeed: 5.7 },
    ],
    ambient: 0.16,
    palette: { floor: "#3b3226", wall: "#2a241d", fog: "#120e0a", pillar: "#5a4b38" },
    stars: [60, 200, 400],
    pebbles: 4,
  },
  {
    id: "sunscorch_vault",
    name: "Sunscorch Vault",
    region: "pantala",
    tagline: "A dozing SandWing and a HiveWing guard on patrol.",
    briefing: "Queen Scorchtail's vault is lit by shafts of desert sun, and her HiveWing guard Glimmerbuzz paces the pillars. Watch the guard's sight cone, wait for it to turn away, and throw a pebble to send it investigating. The Sunstone Scarab sits right beside Scorchtail's nose.",
    radius: 30,
    exit: { x: 0, z: 26, r: 2.4 },
    start: { x: 0, z: 23, yaw: Math.PI },
    hoard: { x: 0, z: -13, r: 7.5, height: 1.2 },
    pillars: [
      { x: -10, z: 9, r: 1.4 }, { x: 10, z: 9, r: 1.4 }, { x: -11, z: -1, r: 1.5 }, { x: 11, z: -1, r: 1.5 },
      { x: -6, z: 16, r: 1.2 }, { x: 6, z: 16, r: 1.2 }, { x: -21, z: 3, r: 1.8 }, { x: 21, z: 3, r: 1.8 },
      { x: -17, z: -14, r: 1.6 }, { x: 17, z: -14, r: 1.6 }, { x: 0, z: 5, r: 1.3 },
    ],
    lights: [
      { x: -5.5, z: 3, r: 5.5, intensity: 1, color: "#ffe2a0" },
      { x: 7, z: -6, r: 6.5, intensity: 1, color: "#ffe2a0" },
      { x: 0, z: -15, r: 8, intensity: 0.85, color: "#ffc66b" },
      { x: -16, z: -6, r: 5, intensity: 0.85, color: "#ffe2a0" },
      { x: 16, z: 11, r: 5, intensity: 0.85, color: "#ffe2a0" },
    ],
    coins: [{ x: -5, z: -7, r: 2.2 }, { x: 5.5, z: -8, r: 2 }, { x: -14, z: 12, r: 1.5 }, { x: 14, z: -6, r: 1.6 }],
    bones: [{ x: -4, z: 20, r: 1.4 }, { x: 19, z: 17, r: 1.5 }],
    loot: [
      { id: "s_pouch", name: "Sandy Coin Pouch", kind: "coins", value: 30, weight: 1, x: -22, z: 12 },
      { id: "s_hourglass", name: "Tiny Hourglass", kind: "hourglass", value: 70, weight: 1, x: 20, z: -4 },
      { id: "s_scroll", name: "Desert Star Chart", kind: "scroll", value: 60, weight: 1, x: -18, z: -9 },
      { id: "s_amber", name: "Hive Amber", kind: "gem", value: 85, weight: 1, x: 12, z: 13, tint: "#ffb238" },
      { id: "s_goblet", name: "Sun-Gold Goblet", kind: "goblet", value: 95, weight: 1, x: -9, z: -11 },
      { id: "s_crown", name: "Dune Crown", kind: "crown", value: 150, weight: 2, x: 9, z: -14 },
      { id: "s_spool", name: "Stolen Flamesilk", kind: "spool", value: 120, weight: 1, x: 0, z: 9 },
      { id: "s_kettle", name: "Somebody's Kettle", kind: "kettle", value: 6, weight: 1, x: -2, z: 21 },
      { id: "s_scarab", name: "Sunstone Scarab", kind: "idol", value: 260, weight: 3, x: 1.5, z: -5.6, tint: "#ffd56b", prize: true },
    ],
    dragons: [
      { id: "scorchtail", name: "Scorchtail", tribe: "sandwing", role: "sleeper", x: 0, z: -14, yaw: 0, hearing: 1, sight: 21, speed: 3.4, chaseSpeed: 6 },
      {
        id: "glimmerbuzz", name: "Glimmerbuzz", tribe: "hivewing", role: "patrol", x: -16, z: 8, yaw: Math.PI / 2,
        route: [{ x: -16, z: 8 }, { x: 16, z: 8 }, { x: 16, z: -7 }, { x: -16, z: -7 }], hearing: 1, sight: 17, speed: 3.6, chaseSpeed: 6,
      },
    ],
    ambient: 0.2,
    palette: { floor: "#7a5f3e", wall: "#5d4630", fog: "#1d150c", pillar: "#a07d52" },
    stars: [80, 240, 480],
    pebbles: 5,
  },
  {
    id: "frostfang_hollow",
    name: "Frostfang Hollow",
    region: "glaeryus",
    tagline: "A light-sleeping IceWing and two sharp-eyed sentries.",
    briefing: "Frostmaw sleeps lightly on a glittering hoard while Nightwhisper and Shardwing circle the crystal hollow. Blue crystal light carries far, and IceWings hear everything. Move in the shadows, time the snores, and use every pebble. The Frost Crown waits beside Frostmaw's jaws.",
    radius: 31,
    exit: { x: 0, z: 27, r: 2.4 },
    start: { x: 0, z: 24, yaw: Math.PI },
    hoard: { x: 0, z: -14, r: 7.5, height: 1.3 },
    pillars: [
      ...ring(6, 11, 0.5).map((spot, i) => ({ ...spot, z: spot.z - 1, r: 1.3 + (i % 3) * 0.25 })),
      { x: -22, z: 6, r: 1.8 }, { x: 22, z: 6, r: 1.8 }, { x: -20, z: -12, r: 1.6 }, { x: 20, z: -12, r: 1.6 },
      { x: -8, z: 20, r: 1.2 }, { x: 8, z: 20, r: 1.2 }, { x: 0, z: 14, r: 1.1 },
    ],
    lights: [
      { x: -12, z: -16, r: 8, intensity: 0.9, color: "#7fd8ff" },
      { x: 12, z: -16, r: 8, intensity: 0.9, color: "#7fd8ff" },
      { x: 0, z: 2, r: 6, intensity: 0.8, color: "#a6e4ff" },
      { x: -18, z: 14, r: 5, intensity: 0.7, color: "#7fd8ff" },
      { x: 18, z: -2, r: 5, intensity: 0.7, color: "#7fd8ff" },
    ],
    coins: [{ x: -5, z: -9, r: 2 }, { x: 5, z: -9, r: 2 }, { x: 0, z: -5, r: 1.5 }, { x: -15, z: -3, r: 1.5 }, { x: 15, z: 14, r: 1.4 }],
    bones: [{ x: -11, z: 23, r: 1.6 }, { x: 12, z: 22, r: 1.4 }, { x: 24, z: -2, r: 1.2 }],
    loot: [
      { id: "f_pouch", name: "Frosty Coin Pouch", kind: "coins", value: 35, weight: 1, x: -24, z: 12 },
      { id: "f_sapphire", name: "Frost Sapphire", kind: "gem", value: 110, weight: 1, x: 23, z: -8, tint: "#a8e6ff" },
      { id: "f_orb", name: "Snowglobe Orb", kind: "orb", value: 90, weight: 1, x: -17, z: -17, tint: "#bdf3ff" },
      { id: "f_harp", name: "Icicle Harp", kind: "harp", value: 80, weight: 1, x: 18, z: 16 },
      { id: "f_scroll", name: "Glacier Chronicle", kind: "scroll", value: 75, weight: 1, x: -2, z: 1 },
      { id: "f_goblet", name: "Rimefrost Goblet", kind: "goblet", value: 120, weight: 1, x: -9, z: -15 },
      { id: "f_idol", name: "Little Ice Dragon", kind: "idol", value: 140, weight: 2, x: 9, z: -15, tint: "#cfefff" },
      { id: "f_chest", name: "Frozen Strongbox", kind: "chest", value: 200, weight: 4, x: 26, z: 4 },
      { id: "f_crown", name: "Frost Crown of the North", kind: "crown", value: 300, weight: 3, x: 2, z: -7, tint: "#d8f1ff", prize: true },
    ],
    dragons: [
      { id: "frostmaw", name: "Frostmaw", tribe: "icewing", role: "sleeper", x: 0, z: -15, yaw: 0, hearing: 1.15, sight: 22, speed: 3.4, chaseSpeed: 6.1, lightSleeper: true },
      {
        id: "nightwhisper", name: "Nightwhisper", tribe: "nightwing", role: "patrol", x: 0, z: 18, yaw: Math.PI / 2,
        route: ring(6, 17, 0.25), hearing: 1.1, sight: 18, speed: 3.6, chaseSpeed: 6.1,
      },
      {
        id: "shardwing", name: "Shardwing", tribe: "icewing", role: "patrol", x: -4, z: -3, yaw: Math.PI / 2,
        route: [{ x: -4, z: -3 }, { x: 4, z: -3 }, { x: 4, z: 5 }, { x: -4, z: 5 }], hearing: 1, sight: 15, speed: 3, chaseSpeed: 5.8,
      },
    ],
    ambient: 0.15,
    palette: { floor: "#3b4652", wall: "#253039", fog: "#0a1016", pillar: "#7e9bb0" },
    stars: [100, 300, 560],
    pebbles: 6,
  },
];

// ---- Geometry helpers ----

export function angleDifference(a: number, b: number) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/** Push a circle out of solid circles and keep it inside the cave. */
export function resolveCollisions(x: number, z: number, radius: number, solids: readonly Circle[], caveRadius: number): Spot {
  let px = x, pz = z;
  for (let pass = 0; pass < 3; pass++) {
    for (const solid of solids) {
      const dx = px - solid.x, dz = pz - solid.z;
      const distance = Math.hypot(dx, dz);
      const minimum = solid.r + radius;
      if (distance >= minimum) continue;
      if (distance < 1e-6) { px = solid.x + minimum; continue; }
      px = solid.x + dx / distance * minimum;
      pz = solid.z + dz / distance * minimum;
    }
    const fromCenter = Math.hypot(px, pz);
    const limit = caveRadius - radius;
    if (fromCenter > limit) { px *= limit / fromCenter; pz *= limit / fromCenter; }
  }
  return { x: px, z: pz };
}

/** Does any circle (grown by pad) block the straight line between a and b? */
export function segmentBlocked(a: Spot, b: Spot, circles: readonly Circle[], pad = 0) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  for (const circle of circles) {
    const t = lengthSq < 1e-9 ? 0 : Math.max(0, Math.min(1, ((circle.x - a.x) * dx + (circle.z - a.z) * dz) / lengthSq));
    const cx = a.x + dx * t - circle.x, cz = a.z + dz * t - circle.z;
    if (cx * cx + cz * cz < (circle.r + pad) ** 2) return true;
  }
  return false;
}

/** 0 in deep shadow, 1 in a brazier's glare. Dragons see much further into light. */
export function lightLevel(lair: LairDef, x: number, z: number) {
  let light = lair.ambient;
  for (const source of lair.lights) {
    const falloff = Math.max(0, 1 - Math.hypot(x - source.x, z - source.z) / source.r);
    light += source.intensity * falloff * falloff;
  }
  return Math.min(1, light);
}

export type Surface = "stone" | "coins" | "bones";
export function surfaceAt(lair: LairDef, x: number, z: number): Surface {
  if (lair.coins.some(pile => Math.hypot(x - pile.x, z - pile.z) < pile.r)) return "coins";
  if (lair.bones.some(pile => Math.hypot(x - pile.x, z - pile.z) < pile.r)) return "bones";
  return "stone";
}

/** Walkable floor height: the hoard is a low golden mound. */
export function floorHeight(lair: LairDef, x: number, z: number) {
  const r = Math.hypot(x - lair.hoard.x, z - lair.hoard.z);
  return r >= lair.hoard.r ? 0 : lair.hoard.height * Math.sqrt(1 - (r / lair.hoard.r) ** 2);
}

// ---- The scavenger ----

export const SCAVENGER = { radius: 0.45, sneak: 2.1, walk: 3.7, sprint: 6.3, capacity: 8, catchRadius: 3.1, grabRadius: 1.7 } as const;
export type Gait = "still" | "sneak" | "walk" | "sprint";
export interface ScavengerState { x: number; z: number; vx: number; vz: number; facing: number; stride: number }
export interface MoveInput { x: number; z: number; sneak: boolean; sprint: boolean }
export type NoiseKind = "step" | "loot" | "pebble" | "drop";
export interface NoiseEvent extends Spot { radius: number; kind: NoiseKind }

export const createScavenger = (lair: LairDef): ScavengerState => ({ x: lair.start.x, z: lair.start.z, vx: 0, vz: 0, facing: lair.start.yaw, stride: 0 });

/** Loot slows you down; sprinting with a full sack is still possible, just slower. */
export function carrySpeed(weight: number) {
  return Math.max(0.5, 1 - 0.055 * Math.max(0, weight));
}

/** How far one footstep carries. Coins jingle and bones crunch, even when sneaking. */
export function footstepRadius(gait: Gait, weight: number, surface: Surface) {
  const base = gait === "sprint" ? 13 : gait === "walk" ? 6.5 : gait === "sneak" ? 2.2 : 0;
  if (base === 0) return 0;
  const jingle = Math.max(0, weight) * 0.7;
  const ground = surface === "coins" ? 6 : surface === "bones" ? 3.5 : 0;
  return base + jingle + ground;
}

export function stepScavenger(state: ScavengerState, input: MoveInput, lair: LairDef, weight: number, solids: readonly Circle[], delta: number) {
  const dt = Math.max(0, Math.min(delta, 1 / 15));
  const amount = Math.min(1, Math.hypot(input.x, input.z));
  const gait: Gait = amount < 0.05 ? "still" : input.sneak ? "sneak" : input.sprint ? "sprint" : "walk";
  const top = gait === "sprint" ? SCAVENGER.sprint : gait === "walk" ? SCAVENGER.walk : SCAVENGER.sneak;
  const speed = amount < 0.05 ? 0 : top * carrySpeed(weight) * amount;
  const dirX = amount < 0.05 ? 0 : input.x / Math.max(amount, Math.hypot(input.x, input.z));
  const dirZ = amount < 0.05 ? 0 : input.z / Math.max(amount, Math.hypot(input.x, input.z));
  const response = 1 - Math.exp(-12 * dt);
  const vx = state.vx + (dirX * speed - state.vx) * response;
  const vz = state.vz + (dirZ * speed - state.vz) * response;
  const moved = resolveCollisions(state.x + vx * dt, state.z + vz * dt, SCAVENGER.radius, solids, lair.radius);
  const travelled = Math.hypot(moved.x - state.x, moved.z - state.z);
  const facing = amount < 0.05 ? state.facing : state.facing + angleDifference(Math.atan2(dirX, dirZ), state.facing) * (1 - Math.exp(-14 * dt));
  const strideLength = gait === "sprint" ? 1.25 : gait === "walk" ? 0.9 : 0.7;
  let stride = state.stride + travelled;
  let step: NoiseEvent | null = null;
  if (stride >= strideLength) {
    stride -= strideLength;
    const radius = footstepRadius(gait === "still" ? "sneak" : gait, weight, surfaceAt(lair, moved.x, moved.z));
    step = { x: moved.x, z: moved.z, radius, kind: "step" };
  }
  return {
    state: { x: moved.x, z: moved.z, vx: travelled > 1e-6 ? vx : 0, vz: travelled > 1e-6 ? vz : 0, facing, stride: Math.min(stride, strideLength) },
    step,
    gait,
  };
}

/** Pebbles fly straight from the thrower and stop at the first pillar or the cave wall. */
export function pebbleLanding(lair: LairDef, from: Spot, yaw: number, distance = 10): Spot {
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  let last = from;
  for (let travelled = 0.5; travelled <= distance; travelled += 0.25) {
    const point = { x: from.x + dx * travelled, z: from.z + dz * travelled };
    if (Math.hypot(point.x, point.z) > lair.radius - 0.6) break;
    if (lair.pillars.some(pillar => Math.hypot(point.x - pillar.x, point.z - pillar.z) < pillar.r + 0.15)) break;
    last = point;
  }
  return last;
}

/** Pick up the closest loot in reach that still fits in the sack. */
export function nearestLoot(lair: LairDef, taken: ReadonlySet<string>, from: Spot, radius: number = SCAVENGER.grabRadius) {
  let best: LairLoot | null = null, bestDistance = radius;
  for (const item of lair.loot) {
    if (taken.has(item.id)) continue;
    const distance = Math.hypot(item.x - from.x, item.z - from.z);
    if (distance < bestDistance) { best = item; bestDistance = distance; }
  }
  return best;
}

export function lootNoise(item: LairLoot): number {
  return item.prize ? 12 : 3.5 + item.weight * 1.4;
}

// ---- Dragons ----

export type DragonMode = "asleep" | "stirring" | "patrol" | "investigate" | "chase" | "search" | "returning";
export interface LairDragonState extends Spot {
  id: string;
  mode: DragonMode;
  yaw: number;
  look: number;
  suspicion: number;
  timer: number;
  target: Spot | null;
  routeIndex: number;
  lastSeen: Spot | null;
  unseen: number;
  /** Seconds into the snore cycle. */
  snore: number;
  sees: boolean;
  /** The spot the dragon is walking toward, its closest approach, and how long it has made no headway. */
  progressGoal: Spot | null;
  progress: number;
  stall: number;
}
export type DragonEvent = "stir" | "wake" | "spot" | "lost" | "settle" | "caught";

export const DRAGON_BODY_RADIUS = 2.5;
const SNORE_CYCLE = 4.6;

export function createDragonState(def: LairDragonDef): LairDragonState {
  return {
    id: def.id, x: def.x, z: def.z, yaw: def.yaw, look: 0, suspicion: 0, timer: 0, target: null, routeIndex: 0, lastSeen: null, unseen: 0,
    mode: def.role === "sleeper" ? "asleep" : "patrol", snore: def.x * 0.31 + def.z * 0.17, sees: false,
    progressGoal: null, progress: 0, stall: 0,
  };
}

/** Loud snores (part of every breath cycle) mask footsteps. */
export function isSnoring(state: LairDragonState) {
  if (state.mode !== "asleep") return false;
  const phase = ((state.snore % SNORE_CYCLE) + SNORE_CYCLE) % SNORE_CYCLE / SNORE_CYCLE;
  return phase > 0.5 && phase < 0.85;
}

/** Sleeping and stirring dragons lie sprawled; everything else is up and moving. */
export function isLying(state: LairDragonState) {
  return state.mode === "asleep" || state.mode === "stirring";
}

/** Where the dragon hears and sees from. A lying dragon's head rests off to one side. */
export function dragonHead(state: LairDragonState): Spot {
  const lying = isLying(state);
  const side = lying ? 4.6 : 0, forward = lying ? 3.8 : 4.2;
  const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
  return { x: state.x + sin * forward + cos * side, z: state.z + cos * forward - sin * side };
}

export interface SenseContext {
  player: Spot;
  sneaking: boolean;
  light: number;
  noises: readonly NoiseEvent[];
  pillars: readonly Circle[];
}

export function canSee(def: LairDragonDef, state: LairDragonState, context: SenseContext) {
  if (state.mode === "asleep") return { visible: false, range: 0 };
  const head = dragonHead(state);
  const dx = context.player.x - head.x, dz = context.player.z - head.z;
  const distance = Math.hypot(dx, dz);
  const range = def.sight * (0.35 + 0.65 * context.light) * (context.sneaking ? 0.75 : 1) * (state.mode === "chase" ? 1.4 : state.mode === "stirring" ? 0.75 : 1);
  if (distance < 2.6) return { visible: true, range };
  if (distance > range) return { visible: false, range };
  const half = state.mode === "chase" ? 1.4 : state.mode === "stirring" ? 0.65 : 0.95;
  if (Math.abs(angleDifference(Math.atan2(dx, dz), state.yaw + state.look)) > half) return { visible: false, range };
  return { visible: !segmentBlocked(head, context.player, context.pillars, 0.1), range };
}

function routeTarget(def: LairDragonDef, index: number): Spot {
  const route = def.route ?? [{ x: def.x, z: def.z }];
  return route[((index % route.length) + route.length) % route.length];
}

/** Turn toward a target and walk when roughly facing it. */
function travel(state: LairDragonState, target: Spot, speed: number, dt: number, lair: LairDef) {
  const dx = target.x - state.x, dz = target.z - state.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.6) return true;
  const desired = Math.atan2(dx, dz);
  const turn = angleDifference(desired, state.yaw);
  state.yaw += Math.sign(turn) * Math.min(Math.abs(turn), 2.6 * dt);
  const align = Math.max(0, Math.cos(angleDifference(desired, state.yaw)));
  const step = Math.min(distance, speed * dt * align);
  const moved = resolveCollisions(state.x + Math.sin(state.yaw) * step, state.z + Math.cos(state.yaw) * step, DRAGON_BODY_RADIUS, lair.pillars, lair.radius);
  state.x = moved.x;
  state.z = moved.z;
  return distance < 1.2;
}

/** Seconds without closing in before a dragon gives up on a spot that pillars keep it from reaching. */
const STALL_SECONDS = 2;

/** Travel, but report "stalled" instead of pushing against a pillar forever. */
function travelOrGiveUp(state: LairDragonState, target: Spot, speed: number, dt: number, lair: LairDef): "arrived" | "moving" | "stalled" {
  const goal = state.progressGoal;
  // A new destination (not just a noise a step away from the last one) gets a fresh attempt.
  if (!goal || Math.hypot(goal.x - target.x, goal.z - target.z) > 2) {
    state.progressGoal = { x: target.x, z: target.z };
    state.progress = Math.hypot(target.x - state.x, target.z - state.z);
    state.stall = 0;
  }
  if (state.stall > STALL_SECONDS) return "stalled";
  if (travel(state, target, speed, dt, lair)) return "arrived";
  const distance = Math.hypot(target.x - state.x, target.z - state.z);
  if (distance < state.progress - 0.25) { state.progress = distance; state.stall = 0; }
  else state.stall += dt;
  return "moving";
}

/** One deterministic AI step: hearing, sight, suspicion, then movement. */
export function stepLairDragon(def: LairDragonDef, previous: LairDragonState, context: SenseContext, lair: LairDef, delta: number) {
  const dt = Math.max(0, Math.min(delta, 1 / 15));
  const state: LairDragonState = {
    ...previous,
    target: previous.target ? { ...previous.target } : null,
    lastSeen: previous.lastSeen ? { ...previous.lastSeen } : null,
    progressGoal: previous.progressGoal ? { ...previous.progressGoal } : null,
  };
  const events: DragonEvent[] = [];
  const head = dragonHead(state);
  state.snore += dt;

  // Hearing: the strongest noise this step points the dragon's attention.
  let heard: Spot | null = null, heardGain = 0;
  const asleep = state.mode === "asleep";
  // Snores mask quiet steps; loud noises still carry, and very loud ones jolt a sleeper awake.
  const sleepMultiplier = asleep ? (isSnoring(state) ? 0.45 : 0.65) * (def.lightSleeper ? 1.5 : 1) : 1;
  for (const noise of context.noises) {
    const reach = noise.radius * def.hearing * sleepMultiplier;
    const distance = Math.hypot(noise.x - head.x, noise.z - head.z);
    if (reach <= 0 || distance >= reach) continue;
    // A clattering pebble always draws an awake dragon's attention.
    const gain = noise.kind === "pebble" && !asleep ? 45 + 40 * (1 - distance / reach) : 20 + 60 * (1 - distance / reach) + (asleep && noise.radius >= 15 ? 25 : 0);
    if (gain > heardGain) { heardGain = gain; heard = { x: noise.x, z: noise.z }; }
  }
  if (heardGain > 0) state.suspicion = Math.min(100, state.suspicion + heardGain);

  // Sight: light, distance, and pillars decide how fast suspicion builds.
  const sight = canSee(def, state, context);
  state.sees = sight.visible;
  if (sight.visible) {
    const distance = Math.hypot(context.player.x - head.x, context.player.z - head.z);
    state.suspicion = Math.min(100, state.suspicion + (30 + 150 * Math.max(0, 1 - distance / Math.max(1, sight.range))) * dt);
    state.lastSeen = { ...context.player };
  }
  if (!sight.visible && heardGain === 0) state.suspicion = Math.max(0, state.suspicion - (asleep ? 9 : 5) * dt);

  const awake = state.mode !== "asleep";
  const alerted = heard ?? (sight.visible ? context.player : null);
  if (awake && sight.visible && state.suspicion >= 100 && state.mode !== "chase") {
    state.mode = "chase";
    state.unseen = 0;
    events.push("spot");
  }

  state.timer += dt;
  switch (state.mode) {
    case "asleep": {
      state.look = 0;
      if (state.suspicion >= 65) {
        state.mode = "investigate"; state.timer = 0; state.target = alerted; events.push("wake");
      } else if (state.suspicion >= 30) {
        state.mode = "stirring"; state.timer = 0; state.target = alerted; events.push("stir");
      }
      break;
    }
    case "stirring": {
      // Head up, glaring toward the noise; settles back unless something else happens.
      const focus = state.target ?? heard;
      const turn = focus ? angleDifference(Math.atan2(focus.x - head.x, focus.z - head.z), state.yaw) : 0;
      state.look += (Math.max(-1.3, Math.min(1.3, turn)) + Math.sin(state.timer * 1.7) * 0.25 - state.look) * (1 - Math.exp(-3 * dt));
      if (heard) state.target = heard;
      if (state.suspicion >= 65) { state.mode = "investigate"; state.timer = 0; events.push("wake"); }
      else if (state.timer > 4 && state.suspicion < 30) { state.mode = "asleep"; state.timer = 0; state.look = 0; events.push("settle"); }
      break;
    }
    case "patrol": {
      if (state.suspicion >= 40 && alerted) { state.mode = "investigate"; state.timer = 0; state.target = alerted; events.push("stir"); break; }
      const waypoint = routeTarget(def, state.routeIndex);
      if (state.target === null) {
        const step = travelOrGiveUp(state, waypoint, def.speed * 0.8, dt, lair);
        if (step === "arrived") { state.target = waypoint; state.timer = 0; }
        else if (step === "stalled") { state.routeIndex++; state.progressGoal = null; state.timer = 0; }
        state.look += (0 - state.look) * (1 - Math.exp(-4 * dt));
      } else {
        // Pause at each waypoint and scan the room.
        state.look = Math.sin(state.timer * 1.4) * 0.9;
        if (state.timer > 1.8) { state.routeIndex++; state.target = null; state.progressGoal = null; state.timer = 0; }
      }
      break;
    }
    case "investigate": {
      if (heard) state.target = heard;
      const destination = state.target ?? state.lastSeen;
      if (destination && Math.hypot(destination.x - state.x, destination.z - state.z) > DRAGON_BODY_RADIUS + 1.6
        && travelOrGiveUp(state, destination, def.speed, dt, lair) === "moving") {
        state.look *= Math.exp(-3 * dt);
        state.timer = 0;
      } else {
        state.look = Math.sin(state.timer * 1.9) * 1.1;
        if (state.timer > 3.2) { state.mode = "returning"; state.timer = 0; state.target = null; }
      }
      break;
    }
    case "chase": {
      if (sight.visible) state.unseen = 0; else state.unseen += dt;
      const destination = sight.visible ? context.player : state.lastSeen ?? context.player;
      travel(state, destination, def.chaseSpeed, dt, lair);
      state.look *= Math.exp(-6 * dt);
      if (state.unseen > 2.5) { state.mode = "search"; state.timer = 0; state.target = state.lastSeen; events.push("lost"); }
      break;
    }
    case "search": {
      if (heard) state.target = heard;
      const destination = state.target;
      // The dragon's bulk stops it short of where the scavenger stood; close enough is close enough.
      const arrive = DRAGON_BODY_RADIUS + SCAVENGER.radius + 0.6;
      if (destination && Math.hypot(destination.x - state.x, destination.z - state.z) > arrive
        && travelOrGiveUp(state, destination, def.speed, dt, lair) === "moving") state.timer = 0;
      else state.look = Math.sin(state.timer * 2.1) * 1.2;
      if (state.timer > 5) { state.mode = "returning"; state.timer = 0; state.target = null; }
      break;
    }
    case "returning": {
      if (state.suspicion >= 55 && alerted) { state.mode = "investigate"; state.timer = 0; state.target = alerted; break; }
      const home = def.role === "sleeper" ? { x: def.x, z: def.z } : routeTarget(def, state.routeIndex);
      state.look *= Math.exp(-3 * dt);
      const step = travelOrGiveUp(state, home, def.speed * 0.9, dt, lair);
      if (step === "stalled") {
        if (def.role === "sleeper") { state.mode = "asleep"; state.timer = 0; state.suspicion = Math.min(state.suspicion, 20); events.push("settle"); }
        else { state.mode = "patrol"; state.routeIndex++; state.target = null; state.timer = 0; }
      } else if (step === "arrived") {
        if (def.role === "sleeper") {
          const turn = angleDifference(def.yaw, state.yaw);
          state.yaw += Math.sign(turn) * Math.min(Math.abs(turn), 2 * dt);
          if (Math.abs(turn) < 0.05) { state.mode = "asleep"; state.timer = 0; state.suspicion = Math.min(state.suspicion, 20); events.push("settle"); }
        } else { state.mode = "patrol"; state.target = null; state.timer = 0; }
      }
      break;
    }
  }

  if (state.mode !== previous.mode) { state.progressGoal = null; state.stall = 0; }

  if (state.mode !== "asleep") {
    const reach = dragonHead(state);
    const snout = Math.hypot(context.player.x - reach.x, context.player.z - reach.z);
    const body = Math.hypot(context.player.x - state.x, context.player.z - state.z);
    if ((state.mode === "chase" && snout < SCAVENGER.catchRadius) || body < DRAGON_BODY_RADIUS + SCAVENGER.radius + 0.2) events.push("caught");
  }
  return { state, events };
}

// ---- Results and saves ----

export function raidStars(lair: LairDef, value: number) {
  return value >= lair.stars[2] ? 3 : value >= lair.stars[1] ? 2 : value >= lair.stars[0] ? 1 : 0;
}

export const SCAVENGER_KEY = "wearedragons.scavenger.v1";
export interface RaidRecord { stars: number; bestLoot: number; escapes: number; ghost: boolean; prize: boolean }
export interface ScavengerProgress { version: 1; lairs: Record<string, RaidRecord> }
export const emptyScavengerProgress = (): ScavengerProgress => ({ version: 1, lairs: {} });
export interface RaidResult { escaped: boolean; value: number; ghost: boolean; prize: boolean }

export function parseScavengerProgress(raw: string | null): ScavengerProgress {
  const result = emptyScavengerProgress();
  try {
    const input = JSON.parse(raw ?? "null");
    if (input?.version !== 1 || !input.lairs || typeof input.lairs !== "object") return result;
    for (const lair of LAIRS) {
      const record = input.lairs[lair.id];
      if (!record || !Number.isInteger(record.stars) || record.stars < 0 || record.stars > 3 || !Number.isFinite(record.bestLoot) || record.bestLoot < 0 ||
          !Number.isSafeInteger(record.escapes) || record.escapes < 1) continue;
      result.lairs[lair.id] = { stars: record.stars, bestLoot: Math.round(record.bestLoot), escapes: record.escapes, ghost: record.ghost === true, prize: record.prize === true };
    }
  } catch { /* A damaged save starts fresh. */ }
  return result;
}

/** Only escapes with loot count; better results never get worse on a replay. */
export function recordRaid(progress: ScavengerProgress, lair: LairDef, result: RaidResult): ScavengerProgress {
  if (!result.escaped || !Number.isFinite(result.value) || result.value <= 0 || !LAIRS.some(item => item.id === lair.id)) return progress;
  const previous = progress.lairs[lair.id];
  return { version: 1, lairs: { ...progress.lairs, [lair.id]: {
    stars: Math.max(previous?.stars ?? 0, raidStars(lair, result.value)),
    bestLoot: Math.max(previous?.bestLoot ?? 0, Math.round(result.value)),
    escapes: Math.min(Number.MAX_SAFE_INTEGER, (previous?.escapes ?? 0) + 1),
    ghost: Boolean(previous?.ghost) || result.ghost,
    prize: Boolean(previous?.prize) || result.prize,
  } } };
}
