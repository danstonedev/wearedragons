export type LandscapeKind = "ridge" | "open";
import { coastalHeight, shorelineZ } from "./coast.ts";

function hash(x: number, z: number) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return (n - Math.floor(n)) * 2 - 1;
}

function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz) * (1 - sx) + hash(ix + 1, iz) * sx;
  const b = hash(ix, iz + 1) * (1 - sx) + hash(ix + 1, iz + 1) * sx;
  return a * (1 - sz) + b * sz;
}

// Mission terrain is shared by Beacon Ridge, Sky Circuit, Ridge Defense and Jade Citadel.
// Keep authored structures/checkpoint approaches clear at their existing elevations.
const missionClearings = [
  [0, 0], [0, -25], [-30, -30], [25, -40], [0, -55], [0, -42],
  [20, -35], [40, -50], [30, -70], [0, -80], [-30, -65], [-40, -40], [-20, -20],
  [-25, -25], [25, -25], [-20, -20], [20, -20], [0, -35],
  [-30, -15], [30, -15], [-15, -40], [15, -40],
];
// Spawn, three beacons, and the player's hoard nest (see HOARD_SITE in loot.ts).
const openClearings = [[0, 0], [-30, -100], [130, 90], [-130, 90], [0, -13]];

function smoothstep(a: number, b: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** One continuous height source for rendering, collision, and object placement. */
export function terrainHeight(x: number, z: number, kind: LandscapeKind) {
  const clearings = kind === "ridge" ? missionClearings : openClearings;
  let clearing = 1;
  for (const [cx, cz] of clearings) {
    const distance = Math.hypot(x - cx, z - cz);
    clearing = Math.min(clearing, smoothstep(8, kind === "ridge" ? 23 : 21, distance));
  }
  const broad = noise(x * 0.012, z * 0.012) * 5.5;
  const middle = noise(x * 0.041, z * 0.041) * 2.3;
  const detail = noise(x * 0.12, z * 0.12) * 0.42;
  if (kind === "open") {
    const lakeDistance = Math.hypot((x - 62) / 42, (z + 82) / 28);
    const lakeBasin = (1 - smoothstep(0.65, 1.2, lakeDistance)) * -5.2;
    const escarpment = Math.pow(Math.max(0, noise(x * 0.009 - 4, z * 0.009 + 8)), 3) * 13;
    return coastalHeight(x, z, broad + middle + detail + lakeBasin + escarpment) * clearing;
  }
  // Raise the valley walls; keep the objective clearings at their authored y=0.
  const rim = smoothstep(35, 112, Math.hypot(x * 0.92, z + 22));
  const ridge = Math.pow(Math.max(0, noise(x * 0.017 + 11, z * 0.017)), 2) * 18;
  return (broad + middle + detail + rim * (7 + ridge)) * clearing;
}

export interface RegionalFormation { eastern: boolean; x: number; z: number; height: number; rotation: number }

/** Pantala mesas (east) and Glaeryus spires (west); shared by rendering and treasure perches. */
export function regionalFormations(): RegionalFormation[] {
  return Array.from({ length: 38 }, (_, i) => {
    const eastern = i % 2 === 0;
    const lane = Math.floor(i / 2);
    const x = (eastern ? 1 : -1) * (35 + (lane * 37 % 145));
    const z = 44 + (lane * 53 % 145);
    const height = 5 + (lane * 19 % 14);
    return { eastern, x, z, height, rotation: (lane * 2.17) % Math.PI };
  }).filter(formation => formation.z < 110); // None on the southern beach or in the sea.
}

/** Approximate top surface of a rendered formation (its icosahedron is scaled by height * 0.58). */
export function formationTop(formation: RegionalFormation) {
  return terrainHeight(formation.x, formation.z, "open") + formation.height * 1.06;
}

export interface TerrainSurface {
  vertices: Float32Array;
  indices: Uint32Array;
}

export interface Planting { x: number; y: number; z: number; scale: number; tint: number }

export interface Scatter { x: number; y: number; z: number; scale: number; rotation: number }

export function createScatter(kind: LandscapeKind, count: number, seedOffset = 0): Scatter[] {
  let seed = (kind === "ridge" ? 7321 : 18427) + seedOffset;
  const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  const size = kind === "ridge" ? 225 : 370;
  const result: Scatter[] = [];
  for (let i = 0; i < count * 10 && result.length < count; i++) {
    const x = (random() - 0.5) * size;
    const z = (random() - 0.5) * size;
    if (kind === "open" && z > shorelineZ(x) - 10) continue;
    result.push({ x, y: terrainHeight(x, z, kind), z, scale: 0.55 + random() * 1.15, rotation: random() * Math.PI });
  }
  return result;
}

export function createPlantings(kind: LandscapeKind, type: "tree" | "rock", count: number): Planting[] {
  let seed = (kind === "ridge" ? 9042 : 12345) + (type === "rock" ? 9981 : 0);
  const random = () => {
    seed = Math.imul(seed, 1664525) + 1013904223 | 0;
    return (seed >>> 0) / 4294967296;
  };
  const result: Planting[] = [];
  for (let attempt = 0; attempt < count * 35 && result.length < count; attempt++) {
    const size = kind === "ridge" ? 230 : 380;
    const x = (random() - 0.5) * size;
    const z = kind === "open" && type === "tree" ? random() * 205 - 190 : (random() - 0.5) * size;
    if (kind === "open" && z > shorelineZ(x) - 8) continue;
    if (type === "tree" && noise(x * 0.035, z * 0.035) < -0.18) continue;
    const exclusion = type === "tree" ? 14 : 5;
    const clearings = kind === "ridge" ? missionClearings : openClearings;
    if (clearings.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < exclusion)) continue;
    const scale = type === "tree" ? 0.75 + random() * 1.3 : 0.32 + random() * 1.05;
    result.push({ x, y: terrainHeight(x, z, kind), z, scale, tint: random() });
  }
  return result;
}

/** Triangles face up. Rapier receives the same buffers as the rendered mesh. */
export function createTerrainSurface(kind: LandscapeKind, size: number, divisions: number): TerrainSurface {
  const stride = divisions + 1;
  const vertices = new Float32Array(stride * stride * 3);
  const indices = new Uint32Array(divisions * divisions * 6);
  for (let z = 0; z <= divisions; z++) {
    for (let x = 0; x <= divisions; x++) {
      const wx = x / divisions * size - size / 2;
      const wz = z / divisions * size - size / 2;
      const at = (z * stride + x) * 3;
      vertices[at] = wx;
      vertices[at + 1] = terrainHeight(wx, wz, kind);
      vertices[at + 2] = wz;
    }
  }
  let at = 0;
  for (let z = 0; z < divisions; z++) {
    for (let x = 0; x < divisions; x++) {
      const a = z * stride + x, b = a + 1, c = a + stride, d = c + 1;
      indices.set([a, c, b, b, c, d], at);
      at += 6;
    }
  }
  return { vertices, indices };
}
