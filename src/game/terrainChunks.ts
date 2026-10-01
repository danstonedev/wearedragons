import { terrainHeight } from "./landscape.ts";
import { terrainColor } from "./terrainColors.ts";
import type { Rgb } from "./terrainColors.ts";
import { WORLD_BOUNDS } from "./world.ts";

/** The open world is tiled into square chunks that stream in at a level of detail. */
export const CHUNK_SIZE = 100;
export const CHUNKS_X = (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) / CHUNK_SIZE;
export const CHUNKS_Z = (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) / CHUNK_SIZE;
/** Far away, 2x2 chunks render as one tile to save draw calls. */
export const TILE_CHUNKS = 2;
export const TILES_X = CHUNKS_X / TILE_CHUNKS;
export const TILES_Z = CHUNKS_Z / TILE_CHUNKS;

export interface ChunkSurface {
  /** Grid vertices first, then skirt vertices. */
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  uvs: Float32Array;
  /** Grid triangles first, then skirt triangles. */
  indices: Uint32Array;
  gridVertices: number;
  gridIndices: number;
  minY: number;
  maxY: number;
}

export const chunkKey = (cx: number, cz: number) => `${cx},${cz}`;

export function chunkOrigin(cx: number, cz: number) {
  return { x: WORLD_BOUNDS.minX + cx * CHUNK_SIZE, z: WORLD_BOUNDS.minZ + cz * CHUNK_SIZE };
}

export function chunkOf(x: number, z: number) {
  return {
    cx: Math.max(0, Math.min(CHUNKS_X - 1, Math.floor((x - WORLD_BOUNDS.minX) / CHUNK_SIZE))),
    cz: Math.max(0, Math.min(CHUNKS_Z - 1, Math.floor((z - WORLD_BOUNDS.minZ) / CHUNK_SIZE))),
  };
}

function rectDistance(originX: number, originZ: number, size: number, x: number, z: number) {
  const dx = Math.max(originX - x, 0, x - (originX + size));
  const dz = Math.max(originZ - z, 0, z - (originZ + size));
  return Math.hypot(dx, dz);
}

/** Horizontal distance from a point to the nearest edge of a chunk (0 inside it). */
export function chunkDistance(cx: number, cz: number, x: number, z: number) {
  const origin = chunkOrigin(cx, cz);
  return rectDistance(origin.x, origin.z, CHUNK_SIZE, x, z);
}

/** The same for a far tile (TILE_CHUNKS x TILE_CHUNKS chunks). */
export function tileDistance(tx: number, tz: number, x: number, z: number) {
  const origin = chunkOrigin(tx * TILE_CHUNKS, tz * TILE_CHUNKS);
  return rectDistance(origin.x, origin.z, CHUNK_SIZE * TILE_CHUNKS, x, z);
}

/** The ground relief texture repeats every this many world units. */
export const RELIEF_TILE = 400 / 28;

/**
 * Build one chunk at `divisions` cells per side. Edge vertices sit exactly on the shared
 * chunk border and normals come from a one-cell apron, so neighbours meet without seams.
 * A skirt hangs from every edge to hide cracks against a coarser neighbour.
 */
export function buildChunkSurface(cx: number, cz: number, divisions: number, sample = terrainHeight): ChunkSurface {
  const origin = chunkOrigin(cx, cz);
  return buildSurface(origin.x, origin.z, CHUNK_SIZE, divisions, sample);
}

/** A square of terrain of any size: one chunk, or a far tile of several. */
export function buildSurface(originX: number, originZ: number, size: number, divisions: number, sample = terrainHeight): ChunkSurface {
  const origin = { x: originX, z: originZ };
  const spacing = size / divisions;
  const apron = divisions + 3;
  const heights = new Float64Array(apron * apron);
  for (let j = 0; j < apron; j++) for (let i = 0; i < apron; i++) {
    heights[j * apron + i] = sample(origin.x + (i - 1) * spacing, origin.z + (j - 1) * spacing, "open");
  }
  const at = (i: number, j: number) => heights[(j + 1) * apron + (i + 1)];
  const stride = divisions + 1;
  const gridVertices = stride * stride;
  const skirtVertices = 4 * stride;
  const total = gridVertices + skirtVertices;
  const positions = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const uvs = new Float32Array(total * 2);
  const color: Rgb = { r: 0, g: 0, b: 0 };
  let minY = Infinity, maxY = -Infinity;
  for (let j = 0; j <= divisions; j++) for (let i = 0; i <= divisions; i++) {
    const v = j * stride + i;
    const x = origin.x + i * spacing, z = origin.z + j * spacing, y = at(i, j);
    const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * spacing);
    const dz = (at(i, j + 1) - at(i, j - 1)) / (2 * spacing);
    const length = Math.hypot(dx, 1, dz);
    positions.set([x, y, z], v * 3);
    normals.set([-dx / length, 1 / length, -dz / length], v * 3);
    terrainColor(x, z, y, Math.hypot(dx, dz), color);
    colors.set([color.r, color.g, color.b], v * 3);
    uvs.set([x / RELIEF_TILE, z / RELIEF_TILE], v * 2);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const gridIndices = divisions * divisions * 6;
  const indices = new Uint32Array(gridIndices + 4 * divisions * 12);
  let n = 0;
  for (let j = 0; j < divisions; j++) for (let i = 0; i < divisions; i++) {
    const a = j * stride + i, b = a + 1, c = a + stride, d = c + 1;
    indices[n++] = a; indices[n++] = c; indices[n++] = b;
    indices[n++] = b; indices[n++] = c; indices[n++] = d;
  }

  // Skirts: copy each edge, drop it, and stitch both faces so any viewing side is covered.
  const depth = Math.max(4, spacing * 2);
  const edges = [
    (k: number) => k,                         // north edge (j = 0)
    (k: number) => divisions * stride + k,     // south edge
    (k: number) => k * stride,                 // west edge (i = 0)
    (k: number) => k * stride + divisions,     // east edge
  ];
  let skirt = gridVertices;
  for (const edge of edges) {
    const first = skirt;
    for (let k = 0; k <= divisions; k++) {
      const source = edge(k);
      positions.set([positions[source * 3], positions[source * 3 + 1] - depth, positions[source * 3 + 2]], skirt * 3);
      normals.set(normals.subarray(source * 3, source * 3 + 3), skirt * 3);
      colors.set(colors.subarray(source * 3, source * 3 + 3), skirt * 3);
      uvs.set(uvs.subarray(source * 2, source * 2 + 2), skirt * 2);
      skirt++;
    }
    for (let k = 0; k < divisions; k++) {
      const top0 = edge(k), top1 = edge(k + 1), low0 = first + k, low1 = first + k + 1;
      indices[n++] = top0; indices[n++] = low0; indices[n++] = top1;
      indices[n++] = top1; indices[n++] = low0; indices[n++] = low1;
      indices[n++] = top0; indices[n++] = top1; indices[n++] = low0;
      indices[n++] = top1; indices[n++] = low1; indices[n++] = low0;
    }
  }
  return { positions, normals, colors, uvs, indices, gridVertices, gridIndices, minY: minY - depth, maxY };
}

export interface TerrainLod { divisions: number; distance: number }

/** Pick the finest level whose range covers the chunk, with a little hysteresis. */
export function chooseLod(lods: readonly { distance: number }[], distance: number, current = -1) {
  for (let level = 0; level < lods.length; level++) {
    const slack = level === current ? 20 : 0;
    if (distance <= lods[level].distance + slack) return level;
  }
  return -1;
}

const surfaces = new Map<string, ChunkSurface>();
const SURFACE_CACHE_LIMIT = 320;

function cachedSurface(key: string, build: () => ChunkSurface) {
  let surface = surfaces.get(key);
  if (surface) {
    surfaces.delete(key);
    surfaces.set(key, surface);
    return surface;
  }
  surface = build();
  surfaces.set(key, surface);
  if (surfaces.size > SURFACE_CACHE_LIMIT) surfaces.delete(surfaces.keys().next().value!);
  return surface;
}

/** Built surfaces are shared by rendering and collision, most recently used kept. */
export function getChunkSurface(cx: number, cz: number, divisions: number) {
  return cachedSurface(`c${cx},${cz},${divisions}`, () => buildChunkSurface(cx, cz, divisions));
}

export function getTileSurface(tx: number, tz: number, divisions: number) {
  const origin = chunkOrigin(tx * TILE_CHUNKS, tz * TILE_CHUNKS);
  return cachedSurface(`t${tx},${tz},${divisions}`, () => buildSurface(origin.x, origin.z, CHUNK_SIZE * TILE_CHUNKS, divisions));
}
