import test from "node:test";
import assert from "node:assert/strict";
import { WINDWAYS, WIND, windAt, windwaySamples } from "../src/game/windways.ts";
import { terrainHeight } from "../src/game/landscape.ts";
import { WORLD_BOUNDS, kingdomAt } from "../src/game/world.ts";

test("windways loop between the kingdoms, clear of the land", () => {
  const samples = windwaySamples();
  assert.equal(samples.length, WINDWAYS.length);
  for (const [w, path] of samples.entries()) {
    const kingdoms = new Set();
    for (const [i, sample] of path.entries()) {
      assert.ok(sample.y - terrainHeight(sample.x, sample.z, "open") >= WIND.clearance - 0.01, `${WINDWAYS[w].id} sample ${i} clears the ground`);
      assert.ok(Math.abs(Math.hypot(sample.tx, sample.ty, sample.tz) - 1) < 1e-6);
      const next = path[(i + 1) % path.length];
      assert.ok(Math.hypot(next.x - sample.x, next.y - sample.y, next.z - sample.z) < 20, "the loop has no gaps");
      kingdoms.add(kingdomAt(sample.x, sample.z).id);
    }
    assert.ok(kingdoms.size >= 3, `${WINDWAYS[w].id} links several kingdoms`);
  }
});

test("a current carries you along its middle and fades at its edge", () => {
  const sample = windwaySamples()[0][40];
  const center = windAt(sample.x, sample.y, sample.z);
  assert.equal(center.windway, 0);
  assert.ok(Math.abs(center.strength - WIND.speed) < 0.5);
  assert.ok(center.x * sample.tx + center.y * sample.ty + center.z * sample.tz > WIND.speed * 0.95, "the push runs along the current");
  const edge = windAt(sample.x, sample.y + WIND.radius * 0.8, sample.z);
  assert.ok(edge.strength < center.strength * 0.5 && edge.y < 0, "near the edge it is weaker and pulls you back in");
  const calm = windAt(0, 300, 0);
  assert.deepEqual([calm.x, calm.y, calm.z, calm.windway], [0, 0, 0, -1]);
});

test("the storm wall pushes a dragon back from every edge of the world", () => {
  assert.ok(windAt(WORLD_BOUNDS.minX + 5, 200, -300).x > 20);
  assert.ok(windAt(WORLD_BOUNDS.maxX - 5, 200, -300).x < -20);
  assert.ok(windAt(0, 200, WORLD_BOUNDS.minZ + 5).z > 20);
  assert.ok(windAt(0, 200, WORLD_BOUNDS.maxZ - 5).z < -20);
});
