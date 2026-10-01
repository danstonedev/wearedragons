import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import type Rapier from "@dimforge/rapier3d-compat";
import type { Collider, RigidBody, World } from "@dimforge/rapier3d-compat";
import { NEAR_ONLY, SOLID_SCENERY, chunkScenery } from "../game/scenery";
import type { SceneryItem } from "../game/scenery";
import { CHUNKS_X, CHUNKS_Z, TILE_CHUNKS, chunkDistance } from "../game/terrainChunks";
import { renderingBudget } from "../game/rendering";
import { playerPos } from "../game/runtime";
import { device } from "../utils/device";
import { createLodStreamer } from "./lodStreamer";
import { createSceneryMaterial, mergeScenery } from "./sceneryTemplates";

const budget = renderingBudget(device);
const placed = new Map<string, SceneryItem[]>();

/** Scenery of a chunk, placed once and remembered (shared by rendering and collision). */
function sceneryOf(cx: number, cz: number) {
  const key = `${cx},${cz}`;
  let items = placed.get(key);
  if (!items) {
    items = chunkScenery(cx, cz, budget.sceneryAttempts);
    placed.set(key, items);
    if (placed.size > 260) placed.delete(placed.keys().next().value!);
  }
  return items;
}
const farItems = (items: SceneryItem[]) => items.filter(item => !NEAR_ONLY.has(item.style));

function createSceneryStreamer() {
  const { material, time } = createSceneryMaterial();
  const streamer = createLodStreamer({
    levels: [{ distance: budget.sceneryNear }, { distance: budget.sceneryFar }],
    nearLevels: 1,
    material,
    castShadow: level => budget.shadows && level === 0,
    chunk: (cx, cz, level) => level === 0 ? mergeScenery(sceneryOf(cx, cz), false) : mergeScenery(farItems(sceneryOf(cx, cz)), true),
    tile: (tx, tz) => {
      const items: SceneryItem[] = [];
      for (let j = 0; j < TILE_CHUNKS; j++) for (let i = 0; i < TILE_CHUNKS; i++) items.push(...farItems(sceneryOf(tx * TILE_CHUNKS + i, tz * TILE_CHUNKS + j)));
      return mergeScenery(items, true);
    },
  });
  return { ...streamer, time, dispose() { streamer.dispose(); material.dispose(); } };
}

function SceneryMeshes() {
  const streamer = useMemo(() => createSceneryStreamer(), []);
  useEffect(() => {
    streamer.update(playerPos.x, playerPos.z, Infinity);
    return streamer.dispose;
  }, [streamer]);
  useFrame((state, delta) => {
    streamer.time.value = state.clock.elapsedTime;
    streamer.timer -= delta;
    if (streamer.timer > 0) return;
    streamer.timer = 0.15;
    streamer.update(playerPos.x, playerPos.z, 3);
  });
  return <primitive object={streamer.group} />;
}

/** Trunks and boulders near the dragon are solid. */
function createSceneryColliders(world: World, rapier: typeof Rapier, radius: number) {
  let body: RigidBody | null = null;
  const colliders = new Map<string, Collider[]>();
  const sync = (x: number, z: number) => {
    if (!body) return;
    for (let cz = 0; cz < CHUNKS_Z; cz++) for (let cx = 0; cx < CHUNKS_X; cx++) {
      const key = `${cx},${cz}`;
      const distance = chunkDistance(cx, cz, x, z);
      const existing = colliders.get(key);
      if (distance <= radius && !existing) {
        const list: Collider[] = [];
        for (const item of sceneryOf(cx, cz)) {
          const solid = SOLID_SCENERY[item.style];
          if (!solid) continue;
          const desc = solid.shape === "ball"
            ? rapier.ColliderDesc.ball(solid.radius * item.scale).setTranslation(item.x, item.y + solid.height * item.scale * 0.5, item.z)
            : rapier.ColliderDesc.cylinder(solid.height * item.scale / 2, solid.radius * item.scale).setTranslation(item.x, item.y + solid.height * item.scale / 2, item.z);
          list.push(world.createCollider(desc, body));
        }
        colliders.set(key, list);
      } else if (existing && distance > radius + 60) {
        for (const collider of existing) if (world.getCollider(collider.handle)) world.removeCollider(collider, false);
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
      if (body && world.getRigidBody(body.handle)) world.removeRigidBody(body);
      body = null;
      colliders.clear();
    },
  };
}

function SceneryColliders() {
  const { world, rapier } = useRapier();
  const streamer = useMemo(() => createSceneryColliders(world, rapier, budget.colliderRadius), [world, rapier]);
  useEffect(() => {
    streamer.start(playerPos.x, playerPos.z);
    return streamer.stop;
  }, [streamer]);
  useFrame((_, delta) => {
    streamer.timer -= delta;
    if (streamer.timer > 0) return;
    streamer.timer = 0.25;
    streamer.sync(playerPos.x, playerPos.z);
  });
  return null;
}

/** Forests, reeds, cacti, crystals, and basalt across the kingdoms beyond the home valley. */
export default function WorldScenery() {
  return <>
    <SceneryMeshes />
    <SceneryColliders />
  </>;
}
