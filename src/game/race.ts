import type { Vector3Like } from "./flight";

export const RACE_ROUTE: [number, number, number][] = [
  [0, 8, -20], [20, 12, -35], [40, 6, -50], [30, 15, -70],
  [0, 10, -80], [-30, 18, -65], [-40, 8, -40], [-20, 14, -20],
];

export function gateNormal(index: number): Vector3Like {
  const center = RACE_ROUTE[index];
  const previous = index === 0 ? [0, 5, 0] : RACE_ROUTE[index - 1];
  const dx = center[0] - previous[0], dy = center[1] - previous[1], dz = center[2] - previous[2];
  const length = Math.hypot(dx, dy, dz);
  return { x: dx / length, y: dy / length, z: dz / length };
}

/** Sweep across the actual gate plane, with a small allowance for the player capsule. */
export function crossedRaceGate(start: Vector3Like, end: Vector3Like, center: Vector3Like, normal: Vector3Like, radius = 4.3): boolean {
  const dot = (point: Vector3Like) => (point.x - center.x) * normal.x + (point.y - center.y) * normal.y + (point.z - center.z) * normal.z;
  const a = dot(start), b = dot(end);
  if (a === b || a * b > 0) return false;
  const t = a / (a - b);
  const x = start.x + (end.x - start.x) * t - center.x;
  const y = start.y + (end.y - start.y) * t - center.y;
  const z = start.z + (end.z - start.z) * t - center.z;
  return x * x + y * y + z * z <= radius * radius;
}
