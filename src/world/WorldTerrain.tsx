import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import type Rapier from "@dimforge/rapier3d-compat";
import type { Collider, RigidBody, World } from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { CHUNKS_X, CHUNKS_Z, TILE_CHUNKS, chunkDistance, chunkKey, getChunkSurface, getTileSurface } from "../game/terrainChunks";
import type { ChunkSurface, TerrainLod } from "../game/terrainChunks";
import { renderingBudget } from "../game/rendering";
import { playerPos } from "../game/runtime";
import { device } from "../utils/device";
import { groundRelief } from "./groundRelief";
import { createLodStreamer } from "./lodStreamer";

function surfaceGeometry(surface: ChunkSurface) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(surface.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(surface.normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(surface.colors, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(surface.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(surface.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Terrain levels below the second render per chunk; coarser ones as 2x2 tiles. */
function createTerrainStreamer(lods: readonly TerrainLod[]) {
  const relief = groundRelief();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, bumpMap: relief, bumpScale: 0.22 });
  const streamer = createLodStreamer({
    levels: lods,
    nearLevels: 2,
    material,
    chunk: (cx, cz, level) => surfaceGeometry(getChunkSurface(cx, cz, lods[level].divisions)),
    tile: (tx, tz, level) => surfaceGeometry(getTileSurface(tx, tz, lods[level].divisions * TILE_CHUNKS)),
  });
  return {
    ...streamer,
    dispose() {
      streamer.dispose();
      material.dispose();
      relief.dispose();
    },
  };
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
