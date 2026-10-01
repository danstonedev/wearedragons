export const SEA_LEVEL = -2;

/** Shared shoreline for terrain, water, beach color and vegetation exclusion. */
export function shorelineZ(x: number) {
  return 140 + Math.sin(x * 0.035) * 12 + Math.cos(x * 0.079) * 5;
}

export function coastalHeight(x: number, z: number, inland: number) {
  const distance = z - shorelineZ(x);
  if (distance < -36) return inland;
  const t = Math.max(0, Math.min(1, (distance + 36) / 20));
  const blend = t * t * (3 - 2 * t);
  const dunes = Math.sin(x * 0.095 + z * 0.14) ** 2 * 2.4 * Math.max(0, 1 - Math.abs(distance + 16) / 20) * Math.max(0, Math.min(1, -distance / 6));
  const cliff = Math.max(0, Math.min(1, (Math.abs(x) - 95) / 60)) * Math.max(0, 1 - Math.abs(distance + 28) / 15) * 9;
  const beach = SEA_LEVEL - distance * (distance > 0 ? 0.22 : 0.12) + dunes + cliff;
  return inland * (1 - blend) + beach * blend;
}
