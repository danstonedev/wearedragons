import { SEA_LEVEL, shorelineZ } from "../game/coast";
import { terrainHeight } from "../game/landscape";
import { terrainColor } from "../game/terrainColors";
import type { Rgb } from "../game/terrainColors";
import { WORLD_BOUNDS } from "../game/world";
import { inlandWater } from "../game/worldSites";

export const MAP_WIDTH = 240;
export const MAP_HEIGHT = 210;

const WATER: Record<string, [number, number, number]> = {
  lake: [72, 128, 140], ice: [206, 232, 245], oasis: [64, 170, 190], mud: [86, 66, 40],
};

function toSrgb(value: number) {
  const c = Math.max(0, Math.min(1, value));
  return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
}

/** CSS position of a world point on the map. */
export function mapPercent(x: number, z: number) {
  return {
    left: `${(x - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) * 100}%`,
    top: `${(z - WORLD_BOUNDS.minZ) / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) * 100}%`,
  };
}

/** World position at the center of a map pixel. */
export function mapPixelToWorld(i: number, j: number, width = MAP_WIDTH, height = MAP_HEIGHT) {
  return {
    x: WORLD_BOUNDS.minX + (i + 0.5) / width * (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX),
    z: WORLD_BOUNDS.minZ + (j + 0.5) / height * (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ),
  };
}

/**
 * Paints a shaded relief map of the continent a few rows at a time, so the work can
 * share frames with the game. `step` returns true once every row is done.
 */
export function createMapPainter(width = MAP_WIDTH, height = MAP_HEIGHT) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const heights = new Float32Array(width * height);
  const spacing = (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) / width;
  const color: Rgb = { r: 0, g: 0, b: 0 };
  let row = 0;
  const paintRow = (j: number) => {
    for (let i = 0; i < width; i++) {
      const { x, z } = mapPixelToWorld(i, j, width, height);
      const y = terrainHeight(x, z, "open");
      heights[j * width + i] = y;
      const at = (j * width + i) * 4;
      pixels[at + 3] = 255;
      if (y < SEA_LEVEL && z > shorelineZ(x) - 3) {
        const depth = Math.min(1, (SEA_LEVEL - y) / 30);
        pixels[at] = 58 - depth * 30; pixels[at + 1] = 138 - depth * 50; pixels[at + 2] = 168 - depth * 40;
        continue;
      }
      const water = inlandWater(x, z);
      if (water) {
        [pixels[at], pixels[at + 1], pixels[at + 2]] = WATER[water];
        continue;
      }
      // Light from the north-west: compare with the pixels already painted up and to the left.
      const left = i > 0 ? heights[j * width + i - 1] : y;
      const up = j > 0 ? heights[(j - 1) * width + i] : y;
      const slope = Math.hypot(y - left, y - up) / spacing;
      terrainColor(x, z, y, slope, color);
      const shade = Math.max(0.55, Math.min(1.35, 1 + ((y - left) + (y - up)) / spacing * 0.9));
      pixels[at] = toSrgb(color.r * shade); pixels[at + 1] = toSrgb(color.g * shade); pixels[at + 2] = toSrgb(color.b * shade);
    }
  };
  return {
    width, height, pixels,
    get done() { return row >= height; },
    step(budgetMs: number) {
      const start = performance.now();
      while (row < height) {
        paintRow(row++);
        if (performance.now() - start > budgetMs) break;
      }
      return row >= height;
    },
  };
}

let shared: ReturnType<typeof createMapPainter> | null = null;
/** One map per page: painted in idle time after the world loads, reused on every open. */
export function sharedMapPainter() {
  shared ??= createMapPainter();
  return shared;
}
