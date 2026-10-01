import { terrainHeight } from "./landscape.ts";
import type { Vector3Like } from "./flight.ts";
import { WORLD_BOUNDS } from "./world.ts";

/**
 * Windways are rivers of air looping between the kingdoms. Fly into one and it carries
 * you along; near the world's edge a storm wall pushes you back toward the continent.
 */
export interface Windway { id: string; name: string; points: readonly (readonly [number, number, number])[] }

export const WINDWAYS: readonly Windway[] = [
  {
    id: "northern_gale", name: "the Northern Gale",
    points: [[0, 72, -200], [-150, 80, -330], [-300, 76, -430], [-470, 84, -520], [-640, 96, -640], [-600, 112, -860], [-380, 124, -900], [-170, 140, -790], [-80, 128, -640], [-40, 104, -470], [0, 80, -300]],
  },
  {
    id: "eastern_zephyr", name: "the Eastern Zephyr",
    points: [[40, 70, -170], [200, 70, -230], [380, 64, -260], [560, 72, -300], [690, 84, -430], [700, 104, -620], [600, 128, -860], [400, 126, -800], [250, 108, -620], [150, 90, -420], [70, 76, -260]],
  },
  {
    id: "coast_current", name: "the Coast Current",
    points: [[-700, 46, 110], [-400, 46, 116], [-100, 46, 110], [200, 46, 116], [500, 46, 110], [720, 52, 96], [700, 70, 20], [400, 70, 30], [100, 70, 18], [-200, 70, 30], [-500, 70, 24], [-720, 62, 42]],
  },
];

export const WIND = {
  /** Air speed along the middle of a windway. */
  speed: 26,
  /** Radius of the current; the push fades to nothing at its edge. */
  radius: 13,
  /** Clearance kept above the ground under every windway. */
  clearance: 28,
  /** The storm wall starts this far inside the world's edge. */
  edge: 60,
};

export interface WindSample { x: number; y: number; z: number; tx: number; ty: number; tz: number }

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** A closed loop through the control points, sampled every `spacing` units and lifted clear of the land. */
export function sampleWindway(windway: Windway, spacing = 6): WindSample[] {
  const points = windway.points;
  const n = points.length;
  const raw: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    const length = Math.hypot(p2[0] - p1[0], p2[2] - p1[2]);
    const steps = Math.max(2, Math.ceil(length / spacing));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      raw.push({ x: catmullRom(p0[0], p1[0], p2[0], p3[0], t), y: catmullRom(p0[1], p1[1], p2[1], p3[1], t), z: catmullRom(p0[2], p1[2], p2[2], p3[2], t) });
    }
  }
  for (const point of raw) point.y = Math.max(point.y, terrainHeight(point.x, point.z, "open") + WIND.clearance);
  // Ease the lifts so the current never kinks over a ridge.
  for (let pass = 0; pass < 3; pass++) {
    const ys = raw.map(point => point.y);
    for (let i = 0; i < raw.length; i++) raw[i].y = Math.max(ys[i], (ys[(i - 1 + raw.length) % raw.length] + ys[i] * 2 + ys[(i + 1) % raw.length]) / 4);
  }
  return raw.map((point, i) => {
    const next = raw[(i + 1) % raw.length], previous = raw[(i - 1 + raw.length) % raw.length];
    const tx = next.x - previous.x, ty = next.y - previous.y, tz = next.z - previous.z;
    const length = Math.hypot(tx, ty, tz) || 1;
    return { ...point, tx: tx / length, ty: ty / length, tz: tz / length };
  });
}

let sampled: WindSample[][] | null = null;
export function windwaySamples() {
  sampled ??= WINDWAYS.map(windway => sampleWindway(windway));
  return sampled;
}

export interface WindState extends Vector3Like { windway: number; strength: number }

/**
 * The air's push at a point: along the nearest windway (with a gentle pull to its middle),
 * plus the storm wall at the edge of the world. `windway` is -1 outside every current.
 */
export function windAt(x: number, y: number, z: number, out: WindState = { x: 0, y: 0, z: 0, windway: -1, strength: 0 }): WindState {
  out.x = out.y = out.z = 0;
  out.windway = -1;
  out.strength = 0;
  const all = windwaySamples();
  for (let w = 0; w < all.length; w++) {
    let best = -1, bestDistance = WIND.radius * WIND.radius;
    const samples = all[w];
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const dx = x - s.x, dz = z - s.z;
      if (dx * dx + dz * dz > bestDistance) continue;
      const dy = y - s.y;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < bestDistance) { best = i; bestDistance = d2; }
    }
    if (best < 0) continue;
    const s = samples[best];
    const fade = 1 - bestDistance / (WIND.radius * WIND.radius);
    const strength = WIND.speed * fade;
    if (strength <= out.strength) continue;
    const pull = 1.6 * fade;
    out.x = s.tx * strength + (s.x - x) * pull;
    out.y = s.ty * strength + (s.y - y) * pull;
    out.z = s.tz * strength + (s.z - z) * pull;
    out.windway = w;
    out.strength = strength;
  }
  // The storm wall: a steady push back toward the middle near every edge.
  const push = (distance: number) => Math.max(0, 1 - distance / WIND.edge) * 30;
  out.x += push(x - WORLD_BOUNDS.minX) - push(WORLD_BOUNDS.maxX - x);
  out.z += push(z - WORLD_BOUNDS.minZ) - push(WORLD_BOUNDS.maxZ - z);
  return out;
}
