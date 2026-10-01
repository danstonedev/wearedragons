import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  KINGDOMS, PADS, SEA_STACKS, VOLCANO, SKY_PALACE, FROZEN_LAKE, GREAT_FALLS, OASIS, WORLD_BOUNDS, HOME,
  kingdomAt, homeWeight, attitudeOf, rimHeight,
} from "../src/game/world.ts";
import { beaconBase, inlandWater } from "../src/game/worldSites.ts";
import { terrainHeight } from "../src/game/landscape.ts";
import { SEA_LEVEL, shorelineZ } from "../src/game/coast.ts";
import { TREASURES, HOARD_SITE, LAKE, resolveTreasureSpot } from "../src/game/loot.ts";
import {
  CHUNK_SIZE, CHUNKS_X, CHUNKS_Z, TILE_CHUNKS, buildChunkSurface, buildSurface, chooseLod, chunkDistance, chunkOrigin, chunkOf,
} from "../src/game/terrainChunks.ts";
import { DRAGON_TYPES } from "../src/dragons.ts";

await RAPIER.init();
const kingdom = id => KINGDOMS.find(item => item.id === id);

test("the continent is laid out as tribe kingdoms around the home valley", () => {
  const expect = [
    [[0, 0], "pyrrhia"], [[-30, -100], "pyrrhia"], [[HOARD_SITE.x, HOARD_SITE.z], "pyrrhia"], [[130, 90], "pantala"], [[-130, 90], "glaeryus"],
    [[VOLCANO.x, VOLCANO.z], "sky"], [[SKY_PALACE.x, SKY_PALACE.z], "sky"], [[FROZEN_LAKE.x, FROZEN_LAKE.z], "ice"],
    [[GREAT_FALLS.x, GREAT_FALLS.z], "rainforest"], [[OASIS.x, OASIS.z], "sand"], [[-600, -250], "mud"], [[0, 300], "sea"],
  ];
  for (const [[x, z], id] of expect) assert.equal(kingdomAt(x, z).id, id, `${x},${z}`);
  for (const item of KINGDOMS) {
    assert.equal(kingdomAt(beaconBase(item).x, beaconBase(item).z).id, item.id, `${item.id} beacon stands in its own kingdom`);
    for (const tribe of item.tribes) assert.ok(DRAGON_TYPES.some(type => type.id === tribe), `${item.id}: unknown tribe ${tribe}`);
  }
  // Every playable tribe has a kingdom to call home.
  for (const type of DRAGON_TYPES) assert.ok(KINGDOMS.some(item => item.tribes.includes(type.id)), type.id);
  assert.equal(attitudeOf(kingdom("sky"), "skywing"), "home");
  assert.equal(attitudeOf(kingdom("sky"), "mudwing"), "rival");
  assert.equal(attitudeOf(kingdom("pyrrhia"), "skywing"), "neutral");
});

test("the home valley keeps its exact shape, and everything placed there stays inside it", () => {
  for (const [x, z] of [[0, 0], [HOARD_SITE.x, HOARD_SITE.z], [LAKE.x, LAKE.z], [-30, -100], [130, 90], [-130, 90]]) {
    assert.equal(homeWeight(x, z), 1, `${x},${z}`);
  }
  for (const def of TREASURES) {
    const spot = resolveTreasureSpot(def);
    // The furthest dune treasures sit where the valley starts to blend into the kingdoms.
    assert.ok(homeWeight(spot.x, spot.z) > 0.9, `${def.id} sits in the home valley`);
  }
  assert.ok(Math.hypot(HOARD_SITE.x - HOME.x, HOARD_SITE.z - HOME.z) < HOME.inner);
});

test("kingdoms have their own land: peaks, a volcano crater, a frozen lake, dunes, and marsh", () => {
  const volcanoRim = terrainHeight(VOLCANO.x + VOLCANO.crater, VOLCANO.z, "open");
  const crater = terrainHeight(VOLCANO.x, VOLCANO.z, "open");
  assert.ok(volcanoRim > 120 && crater < volcanoRim - 30, `volcano rim ${volcanoRim} over crater ${crater}`);
  assert.ok(Math.abs(terrainHeight(SKY_PALACE.x, SKY_PALACE.z, "open") - SKY_PALACE.top) < 1, "the palace stands on a level summit");
  assert.ok(Math.abs(terrainHeight(FROZEN_LAKE.x, FROZEN_LAKE.z, "open") - (FROZEN_LAKE.level - 1.2)) < 0.5);
  assert.ok(terrainHeight(GREAT_FALLS.x, GREAT_FALLS.z, "open") > terrainHeight(GREAT_FALLS.pool.x, GREAT_FALLS.pool.z, "open") + 35, "the falls drop off a cliff");
  assert.ok(inlandWater(OASIS.x, OASIS.z) === "oasis" && inlandWater(FROZEN_LAKE.x, FROZEN_LAKE.z) === "ice" && inlandWater(LAKE.x, LAKE.z) === "lake");
  // Mud lowlands sit far below the ice plateau.
  assert.ok(terrainHeight(-600, -250, "open") < 6 && terrainHeight(-600, -800, "open") > 15);
  for (const pad of PADS) {
    const center = terrainHeight(pad.x, pad.z, "open");
    for (const angle of [0, 2, 4]) {
      const edge = terrainHeight(pad.x + Math.cos(angle) * pad.r * 0.6, pad.z + Math.sin(angle) * pad.r * 0.6, "open");
      assert.ok(Math.abs(edge - center) < 0.01, `pad at ${pad.x},${pad.z} is level`);
    }
  }
  for (const stack of SEA_STACKS) assert.ok(stack.z > shorelineZ(stack.x) && terrainHeight(stack.x, stack.z, "open") < SEA_LEVEL, "sea stacks stand in water");
});

test("peaks wall the continent, the sea bounds the south, and the land has no tears", () => {
  for (const [x, z] of [[WORLD_BOUNDS.minX + 5, -400], [WORLD_BOUNDS.maxX - 5, -500], [0, WORLD_BOUNDS.minZ + 5]]) {
    assert.ok(rimHeight(x, z) > 60 && terrainHeight(x, z, "open") > 60, `edge peak at ${x},${z}`);
  }
  assert.equal(rimHeight(0, -300), 0);
  assert.ok(terrainHeight(0, 300, "open") < SEA_LEVEL - 10);
  // One-unit steps never jump more than a cliff's worth anywhere on a coarse sweep.
  let worst = 0;
  for (let z = WORLD_BOUNDS.minZ; z < 160; z += 37) {
    let previous = terrainHeight(WORLD_BOUNDS.minX, z, "open");
    for (let x = WORLD_BOUNDS.minX + 1; x < WORLD_BOUNDS.maxX; x += 1) {
      const height = terrainHeight(x, z, "open");
      assert.ok(Number.isFinite(height));
      worst = Math.max(worst, Math.abs(height - previous));
      previous = height;
    }
  }
  assert.ok(worst < 14, `largest one-unit step ${worst.toFixed(2)}`);
});

test("chunks meet exactly at shared edges, across levels of detail, and tiles agree with chunks", () => {
  const a = buildChunkSurface(7, 6, 16), b = buildChunkSurface(8, 6, 16);
  const stride = 17;
  for (let j = 0; j <= 16; j++) {
    const east = (j * stride + 16) * 3, west = (j * stride) * 3;
    assert.deepEqual([...a.positions.subarray(east, east + 3)], [...b.positions.subarray(west, west + 3)]);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(a.normals[east + k] - b.normals[west + k]) < 1e-6, "seamless lighting");
  }
  // A coarser neighbour's vertices are a subset of the finer chunk's, at the same heights.
  const fine = buildChunkSurface(7, 6, 32), coarse = buildChunkSurface(7, 6, 8);
  for (let j = 0; j <= 8; j++) for (let i = 0; i <= 8; i++) {
    const c = (j * 9 + i) * 3, f = (j * 4 * 33 + i * 4) * 3;
    assert.equal(coarse.positions[c + 1], fine.positions[f + 1]);
  }
  const origin = chunkOrigin(6, 6);
  const tile = buildSurface(origin.x, origin.z, CHUNK_SIZE * TILE_CHUNKS, 16);
  const chunk = buildChunkSurface(6, 6, 8);
  assert.equal(tile.positions[1], chunk.positions[1]);
  // Skirts hang below their edge and every grid triangle faces up.
  assert.ok(a.positions[a.gridVertices * 3 + 1] < a.positions[1]);
  for (let t = 0; t < a.gridIndices; t += 3) {
    const [i0, i1, i2] = [a.indices[t], a.indices[t + 1], a.indices[t + 2]];
    const ax = a.positions[i0 * 3], az = a.positions[i0 * 3 + 2];
    const bx = a.positions[i1 * 3], bz = a.positions[i1 * 3 + 2];
    const cx = a.positions[i2 * 3], cz = a.positions[i2 * 3 + 2];
    assert.ok((bz - az) * (cx - ax) - (bx - ax) * (cz - az) > 0);
  }
  assert.equal(CHUNKS_X * CHUNK_SIZE, WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX);
  assert.equal(CHUNKS_Z * CHUNK_SIZE, WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ);
  assert.deepEqual(chunkOf(0, 0), { cx: 8, cz: 10 });
  assert.equal(chunkDistance(8, 10, 0, 0), 0);
});

test("levels of detail switch with hysteresis, and Rapier hits the streamed collision surface", () => {
  const lods = [{ divisions: 32, distance: 170 }, { divisions: 16, distance: 360 }];
  assert.equal(chooseLod(lods, 100), 0);
  assert.equal(chooseLod(lods, 180), 1);
  assert.equal(chooseLod(lods, 180, 0), 0, "a chunk already at a level keeps it a little longer");
  assert.equal(chooseLod(lods, 400), -1);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  try {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    // The Sky Kingdom: steep peaks are the hardest place to match.
    const { cx, cz } = chunkOf(-120, -560);
    const surface = buildChunkSurface(cx, cz, 32);
    world.createCollider(RAPIER.ColliderDesc.trimesh(surface.positions.slice(0, surface.gridVertices * 3), surface.indices.slice(0, surface.gridIndices)), body);
    world.step();
    const origin = chunkOrigin(cx, cz);
    for (const [fx, fz] of [[0.5, 0.5], [0.13, 0.81], [0.77, 0.2], [0.0, 0.0]]) {
      const x = origin.x + fx * CHUNK_SIZE, z = origin.z + fz * CHUNK_SIZE;
      const hit = world.castRay(new RAPIER.Ray({ x, y: 400, z }, { x: 0, y: -1, z: 0 }), 600, true);
      assert.ok(hit, `floor at ${x},${z}`);
      assert.ok(Math.abs(400 - hit.timeOfImpact - terrainHeight(x, z, "open")) < 2.5, "collision follows the rendered ground");
    }
  } finally { world.free(); }
});
