import * as THREE from "three";
import { TILE_CHUNKS, TILES_X, TILES_Z, chooseLod, chunkDistance, tileDistance } from "../game/terrainChunks";
import type { TerrainLod } from "../game/terrainChunks";

export interface LodSource {
  /** Ranges for each level, finest first. */
  levels: readonly Pick<TerrainLod, "distance">[];
  /** Levels below this render chunk by chunk; coarser levels may render whole tiles. */
  nearLevels: number;
  chunk(cx: number, cz: number, level: number): THREE.BufferGeometry | null;
  tile(tx: number, tz: number, level: number): THREE.BufferGeometry | null;
  material: THREE.Material;
  castShadow?: (level: number) => boolean;
}

interface Entry { mesh: THREE.Mesh | null; level: number }
interface Wanted { key: string; tile: boolean; x: number; z: number; level: number; distance: number }

/**
 * Streams meshes nearest first. Near the dragon each chunk has its own mesh; far away a
 * 2x2 tile is one mesh, so the distant view costs few draw calls. A mesh is only removed
 * once whatever replaces it is on screen, so nothing blinks out while it rebuilds.
 */
export function createLodStreamer(source: LodSource) {
  const group = new THREE.Group();
  const entries = new Map<string, Entry>();
  const geometries = new Map<string, THREE.BufferGeometry | null>();

  const geometryFor = (item: Wanted) => {
    const key = `${item.key},${item.level}`;
    if (geometries.has(key)) return geometries.get(key)!;
    const geometry = item.tile ? source.tile(item.x, item.z, item.level) : source.chunk(item.x, item.z, item.level);
    geometries.set(key, geometry);
    return geometry;
  };
  const remove = (key: string) => {
    const entry = entries.get(key);
    if (!entry) return;
    if (entry.mesh) group.remove(entry.mesh);
    entries.delete(key);
  };
  const chunkKeysOf = (tx: number, tz: number) => {
    const keys: string[] = [];
    for (let j = 0; j < TILE_CHUNKS; j++) for (let i = 0; i < TILE_CHUNKS; i++) keys.push(`c${tx * TILE_CHUNKS + i},${tz * TILE_CHUNKS + j}`);
    return keys;
  };

  const update = (x: number, z: number, budgetMs: number) => {
    const start = performance.now();
    const wanted: Wanted[] = [];
    for (let tz = 0; tz < TILES_Z; tz++) for (let tx = 0; tx < TILES_X; tx++) {
      const tileKey = `t${tx},${tz}`;
      const tile = entries.get(tileKey);
      const distance = tileDistance(tx, tz, x, z);
      const level = chooseLod(source.levels, distance, tile?.level ?? -1);
      if (level < 0) {
        remove(tileKey);
        chunkKeysOf(tx, tz).forEach(remove);
        continue;
      }
      if (level >= source.nearLevels) {
        if (tile?.level !== level) wanted.push({ key: tileKey, tile: true, x: tx, z: tz, level, distance });
        else chunkKeysOf(tx, tz).forEach(remove);
        continue;
      }
      let complete = true;
      for (let j = 0; j < TILE_CHUNKS; j++) for (let i = 0; i < TILE_CHUNKS; i++) {
        const cx = tx * TILE_CHUNKS + i, cz = tz * TILE_CHUNKS + j;
        const key = `c${cx},${cz}`;
        const entry = entries.get(key);
        const chunkDistanceToPlayer = chunkDistance(cx, cz, x, z);
        const chunkLevel = Math.max(0, chooseLod(source.levels, chunkDistanceToPlayer, entry?.level ?? -1));
        if (entry?.level !== chunkLevel) wanted.push({ key, tile: false, x: cx, z: cz, level: chunkLevel, distance: chunkDistanceToPlayer });
        if (!entry) complete = false;
      }
      if (complete) remove(tileKey);
    }
    wanted.sort((a, b) => a.distance - b.distance);
    for (const item of wanted) {
      if (performance.now() - start > budgetMs) break;
      const geometry = geometryFor(item);
      const entry = entries.get(item.key);
      if (entry?.mesh && geometry) {
        entry.mesh.geometry = geometry;
        entry.mesh.castShadow = source.castShadow?.(item.level) ?? false;
        entry.level = item.level;
      } else {
        if (entry?.mesh) group.remove(entry.mesh);
        let mesh: THREE.Mesh | null = null;
        if (geometry) {
          mesh = new THREE.Mesh(geometry, source.material);
          mesh.receiveShadow = true;
          mesh.castShadow = source.castShadow?.(item.level) ?? false;
          mesh.matrixAutoUpdate = false;
          group.add(mesh);
        }
        entries.set(item.key, { mesh, level: item.level });
      }
      if (item.tile) chunkKeysOf(item.x, item.z).forEach(remove);
    }
    // Free GPU copies of levels nothing shows.
    if (geometries.size > 200) {
      const shown = new Set(Array.from(entries.values(), entry => entry.mesh?.geometry));
      for (const [key, geometry] of geometries) {
        if (geometry && shown.has(geometry)) continue;
        geometry?.dispose();
        geometries.delete(key);
      }
    }
  };

  const dispose = () => {
    geometries.forEach(geometry => geometry?.dispose());
    geometries.clear();
    entries.clear();
    group.clear();
  };
  return { group, update, dispose, timer: 0 };
}
