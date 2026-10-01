import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import type Rapier from "@dimforge/rapier3d-compat";
import type { Collider, RigidBody, World } from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { CHUNKS_X, CHUNKS_Z, TILE_CHUNKS, TILES_X, TILES_Z, chooseLod, chunkDistance, chunkKey, getChunkSurface, getTileSurface, tileDistance } from "../game/terrainChunks";
import type { TerrainLod } from "../game/terrainChunks";
import { renderingBudget } from "../game/rendering";
import { playerPos } from "../game/runtime";
import { device } from "../utils/device";
import { groundRelief } from "./groundRelief";

interface TerrainMesh { mesh: THREE.Mesh; level: number }
interface Wanted { key: string; tile: boolean; x: number; z: number; level: number; distance: number }

/** Levels below this render chunk by chunk; coarser levels render whole tiles. */
const NEAR_LEVELS = 2;

/**
 * Streams terrain meshes nearest first. Near the dragon each chunk has its own mesh;
 * far away a 2x2 tile is one mesh, so the distant view costs few draw calls. A mesh is
 * only removed once whatever replaces it is on screen, so the ground never has holes.
 */
function createTerrainStreamer(lods: readonly TerrainLod[]) {
  const relief = groundRelief();
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, bumpMap: relief, bumpScale: 0.22 });
  const meshes = new Map<string, TerrainMesh>();
  const geometries = new Map<string, THREE.BufferGeometry>();

  const geometryFor = (item: Wanted) => {
    const key = `${item.key},${item.level}`;
    const cached = geometries.get(key);
    if (cached) return cached;
    const surface = item.tile
      ? getTileSurface(item.x, item.z, lods[item.level].divisions * TILE_CHUNKS)
      : getChunkSurface(item.x, item.z, lods[item.level].divisions);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(surface.positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(surface.normals, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(surface.colors, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(surface.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(surface.indices, 1));
    geometry.computeBoundingSphere();
    geometries.set(key, geometry);
    return geometry;
  };

  const remove = (key: string) => {
    const entry = meshes.get(key);
    if (!entry) return;
    group.remove(entry.mesh);
    meshes.delete(key);
  };
  const tileKey = (tx: number, tz: number) => `t${tx},${tz}`;
  const chunkKeysOf = (tx: number, tz: number) => {
    const keys: string[] = [];
    for (let j = 0; j < TILE_CHUNKS; j++) for (let i = 0; i < TILE_CHUNKS; i++) keys.push(`c${chunkKey(tx * TILE_CHUNKS + i, tz * TILE_CHUNKS + j)}`);
    return keys;
  };

  const update = (x: number, z: number, budgetMs: number) => {
    const start = performance.now();
    const wanted: Wanted[] = [];
    for (let tz = 0; tz < TILES_Z; tz++) for (let tx = 0; tx < TILES_X; tx++) {
      const tKey = tileKey(tx, tz);
      const tile = meshes.get(tKey);
      const level = chooseLod(lods, tileDistance(tx, tz, x, z), tile?.level ?? -1);
      if (level < 0) {
        remove(tKey);
        chunkKeysOf(tx, tz).forEach(remove);
        continue;
      }
      if (level >= NEAR_LEVELS) {
        if (tile?.level !== level) wanted.push({ key: tKey, tile: true, x: tx, z: tz, level, distance: tileDistance(tx, tz, x, z) });
        else chunkKeysOf(tx, tz).forEach(remove);
        continue;
      }
      let complete = true;
      for (let j = 0; j < TILE_CHUNKS; j++) for (let i = 0; i < TILE_CHUNKS; i++) {
        const cx = tx * TILE_CHUNKS + i, cz = tz * TILE_CHUNKS + j;
        const key = `c${chunkKey(cx, cz)}`;
        const entry = meshes.get(key);
        const distance = chunkDistance(cx, cz, x, z);
        const chunkLevel = Math.max(0, chooseLod(lods, distance, entry?.level ?? -1));
        if (entry?.level !== chunkLevel) wanted.push({ key, tile: false, x: cx, z: cz, level: chunkLevel, distance });
        if (!entry) complete = false;
      }
      if (complete) remove(tKey);
    }
    wanted.sort((a, b) => a.distance - b.distance);
    for (const item of wanted) {
      if (performance.now() - start > budgetMs) break;
      const geometry = geometryFor(item);
      const entry = meshes.get(item.key);
      if (entry) {
        entry.mesh.geometry = geometry;
        entry.level = item.level;
      } else {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        group.add(mesh);
        meshes.set(item.key, { mesh, level: item.level });
      }
      // The tile now covers its chunks (or the chunks may now replace their tile on the next pass).
      if (item.tile) chunkKeysOf(item.x, item.z).forEach(remove);
    }
    // Free GPU copies of levels nobody is showing.
    if (geometries.size > 200) {
      const shown = new Set(Array.from(meshes.values(), entry => entry.mesh.geometry));
      for (const [key, geometry] of geometries) {
        if (shown.has(geometry)) continue;
        geometry.dispose();
        geometries.delete(key);
      }
    }
  };

  const dispose = () => {
    geometries.forEach(geometry => geometry.dispose());
    geometries.clear();
    meshes.clear();
    group.clear();
    material.dispose();
    relief.dispose();
  };
  return { group, update, dispose, timer: 0, meshes };
}

function TerrainChunks() {
  const streamer = useMemo(() => createTerrainStreamer(renderingBudget(device).worldLods), []);
  useEffect(() => {
    // Build the whole view before the first frame so the world never pops in around the spawn.
    streamer.update(playerPos.x, playerPos.z, Infinity);
    return streamer.dispose;
  }, [streamer]);
  useFrame((_, delta) => {
    streamer.timer -= delta;
    if (streamer.timer > 0) return;
    streamer.timer = 0.12;
    streamer.update(playerPos.x, playerPos.z, 3);
  });
  return <primitive object={streamer.group} />;
}

/** Keeps trimesh colliders, built from the finest surface, under and around the dragon. */
function createColliderStreamer(world: World, rapier: typeof Rapier, divisions: number, radius: number) {
  let body: RigidBody | null = null;
  const colliders = new Map<string, Collider>();
  const sync = (x: number, z: number) => {
    if (!body) return;
    for (let cz = 0; cz < CHUNKS_Z; cz++) for (let cx = 0; cx < CHUNKS_X; cx++) {
      const key = chunkKey(cx, cz);
      const distance = chunkDistance(cx, cz, x, z);
      const collider = colliders.get(key);
      if (distance <= radius && !collider) {
        const surface = getChunkSurface(cx, cz, divisions);
        const desc = rapier.ColliderDesc.trimesh(surface.positions.slice(0, surface.gridVertices * 3), surface.indices.slice(0, surface.gridIndices)).setFriction(1);
        colliders.set(key, world.createCollider(desc, body));
      } else if (collider && distance > radius + 60) {
        if (world.getCollider(collider.handle)) world.removeCollider(collider, false);
        colliders.delete(key);
      }
    }
  };
  return {
    timer: 0,
    sync,
    start(x: number, z: number) {
      body = world.createRigidBody(rapier.RigidBodyDesc.fixed());
      sync(x, z);
    },
    stop() {
      // Physics may already have replaced its world (StrictMode remounts do); only remove what it still holds.
      if (body && world.getRigidBody(body.handle)) world.removeRigidBody(body);
      body = null;
      colliders.clear();
    },
  };
}

function TerrainColliders() {
  const { world, rapier } = useRapier();
  const streamer = useMemo(() => {
    const budget = renderingBudget(device);
    return createColliderStreamer(world, rapier, budget.worldLods[0].divisions, budget.colliderRadius);
  }, [world, rapier]);
  useEffect(() => {
    streamer.start(playerPos.x, playerPos.z);
    return streamer.stop;
  }, [streamer]);
  useFrame((_, delta) => {
    streamer.timer -= delta;
    if (streamer.timer > 0) return;
    streamer.timer = 0.2;
    streamer.sync(playerPos.x, playerPos.z);
  });
  return null;
}

/** The open world's ground: streamed, level-of-detail terrain with collision near the dragon. */
export default function WorldTerrain() {
  return <>
    <TerrainChunks />
    <TerrainColliders />
  </>;
}
