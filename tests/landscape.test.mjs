import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { terrainHeight, createTerrainSurface, createPlantings } from "../src/game/landscape.ts";

await RAPIER.init();

test("mission landmarks stay on a level clearing and plantings avoid their approaches", () => {
  for (const [x, z] of [[0, 0], [-30, -30], [25, -40], [0, -55], [0, -42], [0, -25], [40, -50]]) {
    assert.ok(Math.abs(terrainHeight(x, z, "ridge")) < 1e-6);
    for (const tree of createPlantings("ridge", "tree", 105)) {
      assert.ok(Math.hypot(tree.x - x, tree.z - z) >= 14);
      assert.equal(tree.y, terrainHeight(tree.x, tree.z, "ridge"));
    }
  }
  for (const [x, z] of [[-30, -100], [130, 90], [-130, 90]]) {
    assert.ok(Math.abs(terrainHeight(x, z, "open")) < 1e-6);
  }
});

test("sculpted terrain is deterministic, nonflat, and uses upward winding", () => {
  const a = createTerrainSurface("ridge", 250, 72);
  const b = createTerrainSurface("ridge", 250, 72);
  assert.deepEqual(a.vertices, b.vertices);
  assert.deepEqual(a.indices, b.indices);
  assert.ok(Math.max(...a.vertices.filter((_, i) => i % 3 === 1)) > 8);
  const [ia, ib, ic] = a.indices;
  const ax = a.vertices[ia * 3], az = a.vertices[ia * 3 + 2];
  const bx = a.vertices[ib * 3], bz = a.vertices[ib * 3 + 2];
  const cx = a.vertices[ic * 3], cz = a.vertices[ic * 3 + 2];
  assert.ok((bz - az) * (cx - ax) - (bx - ax) * (cz - az) > 0);
});

test("Rapier ray hits the same terrain mesh under the player and beacon", () => {
  const surface = createTerrainSurface("ridge", 250, 80);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  try {
    world.createCollider(RAPIER.ColliderDesc.trimesh(surface.vertices, surface.indices));
    world.step(); // Update the query pipeline after adding static geometry.
    for (const [x, z] of [[0, 0], [-30, -30], [0, -42], [75, 40]]) {
      const ray = new RAPIER.Ray({ x, y: 70, z }, { x: 0, y: -1, z: 0 });
      const hit = world.castRay(ray, 100, true);
      assert.ok(hit, `missing floor at ${x},${z}`);
      assert.ok(Math.abs((70 - hit.timeOfImpact) - terrainHeight(x, z, "ridge")) < 0.6);
    }
  } finally { world.free(); }
});
