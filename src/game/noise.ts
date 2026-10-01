/** Deterministic value noise shared by terrain, scenery, and world layout. */

export function hash(x: number, z: number) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return (n - Math.floor(n)) * 2 - 1;
}

/** Smooth value noise in [-1, 1]. */
export function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz) * (1 - sx) + hash(ix + 1, iz) * sx;
  const b = hash(ix, iz + 1) * (1 - sx) + hash(ix + 1, iz + 1) * sx;
  return a * (1 - sz) + b * sz;
}

export function smoothstep(a: number, b: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Sharp-crested ridges in [0, 1]: high where the noise crosses zero. */
export function ridged(x: number, z: number) {
  return 1 - Math.abs(noise(x, z));
}

/** Seeded generator for repeatable scatter (same LCG as the original plantings). */
export function seededRandom(seed: number) {
  let state = seed | 0;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223 | 0;
    return (state >>> 0) / 4294967296;
  };
}
