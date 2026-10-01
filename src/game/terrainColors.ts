import { shorelineZ } from "./coast.ts";
import { smoothstep } from "./noise.ts";
import { LAND_KINGDOMS, VOLCANO, homeWeight, kingdomWeights } from "./world.ts";
import type { LandKingdomId } from "./world.ts";

/** Linear-space RGB, matching THREE.Color with color management (hex values are sRGB). */
export interface Rgb { r: number; g: number; b: number }

function channel(value: number) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export function linear(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return { r: channel(n >> 16 & 255), g: channel(n >> 8 & 255), b: channel(n & 255) };
}
function mix(out: Rgb, to: Rgb, t: number) {
  out.r += (to.r - out.r) * t; out.g += (to.g - out.g) * t; out.b += (to.b - out.b) * t;
  return out;
}

// The home valley's original palette (see the mission Landscape).
const GREEN = linear("#526e42"), DRY = linear("#ad8459"), BASALT = linear("#555f65");
const EARTH = linear("#6f644d"), ROCK = linear("#8a8374"), BEACH = linear("#cfb986");
const SNOW = linear("#f2f1ec"), ASH = linear("#3b3431"), SCORCH = linear("#2a2422");

interface Palette { low: Rgb; high: Rgb; rock: Rgb; highFrom: number; highTo: number }
const palette = (low: string, high: string, rock: string, highFrom: number, highTo: number): Palette =>
  ({ low: linear(low), high: linear(high), rock: linear(rock), highFrom, highTo });

const PALETTES: Record<LandKingdomId, Palette> = {
  pyrrhia: palette("#55743f", "#6f644d", "#8a8374", 6, 30),
  pantala: palette("#ad8459", "#c4935e", "#9a684d", 4, 26),
  glaeryus: palette("#59646a", "#4b555b", "#3f474c", 4, 24),
  sky: palette("#8a6a52", "#a5654a", "#6b4b40", 20, 90),
  ice: palette("#dbe6ee", "#f4f8fb", "#9fbcd0", 18, 60),
  mud: palette("#5d4c2e", "#6e6a3a", "#4b3c26", 0, 8),
  rainforest: palette("#2f6a33", "#3f8040", "#4d5a3a", 10, 50),
  sand: palette("#d4ae6e", "#e4c58c", "#b98d58", 3, 14),
};
const PALETTE_LIST = LAND_KINGDOMS.map(id => PALETTES[id]);

const weights = new Float64Array(LAND_KINGDOMS.length);
const scratch: Rgb = { r: 0, g: 0, b: 0 };

function homeColor(x: number, z: number, y: number, slope: number, out: Rgb) {
  const regionMix = smoothstep(23, 38, z);
  out.r = GREEN.r; out.g = GREEN.g; out.b = GREEN.b;
  mix(out, x >= 0 ? DRY : BASALT, regionMix);
  mix(out, EARTH, Math.max(0, Math.min(0.55, (y - 4) / 19)));
  mix(out, ROCK, Math.max(0, Math.min(0.75, (slope - 0.35) * 0.75)));
  return out;
}

function kingdomColor(x: number, z: number, y: number, slope: number, out: Rgb) {
  kingdomWeights(x, z, weights);
  out.r = out.g = out.b = 0;
  for (let i = 0; i < PALETTE_LIST.length; i++) {
    const w = weights[i];
    if (w < 0.002) continue;
    const p = PALETTE_LIST[i];
    scratch.r = p.low.r; scratch.g = p.low.g; scratch.b = p.low.b;
    mix(scratch, p.high, smoothstep(p.highFrom, p.highTo, y));
    mix(scratch, p.rock, Math.max(0, Math.min(0.8, (slope - 0.4) * 0.8)));
    out.r += scratch.r * w; out.g += scratch.g * w; out.b += scratch.b * w;
  }
  // Ash and scorched rock around the volcano.
  const rv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
  if (rv < VOLCANO.radius) {
    mix(out, ASH, (1 - smoothstep(80, VOLCANO.radius, rv)) * 0.85);
    mix(out, SCORCH, 1 - smoothstep(VOLCANO.crater * 0.6, VOLCANO.crater * 1.6, rv));
  }
  return out;
}

/**
 * Ground color for the open world. Inside the home valley this matches the original
 * landscape; beyond it each kingdom has its own palette, blended across borders.
 */
export function terrainColor(x: number, z: number, y: number, slope: number, out: Rgb = { r: 0, g: 0, b: 0 }) {
  const home = homeWeight(x, z);
  if (home >= 1) homeColor(x, z, y, slope, out);
  else if (home <= 0) kingdomColor(x, z, y, slope, out);
  else {
    const inner = homeColor(x, z, y, slope, { r: 0, g: 0, b: 0 });
    kingdomColor(x, z, y, slope, out);
    mix(out, inner, home);
  }
  // Snow caps on the high peaks everywhere.
  mix(out, SNOW, smoothstep(128, 165, y) * (1 - Math.max(0, Math.min(1, (slope - 1.1) * 1.5))));
  mix(out, BEACH, smoothstep(-36, -12, z - shorelineZ(x)));
  const variation = Math.sin(x * 0.57 + z * 0.36) * Math.sin(z * 0.41 - x * 0.2) * 0.04;
  out.r *= 1 + variation; out.g *= 1 + variation; out.b *= 1 + variation;
  return out;
}
