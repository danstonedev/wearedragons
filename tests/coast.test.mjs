import test from "node:test";
import assert from "node:assert/strict";
import { SEA_LEVEL, shorelineZ, coastalHeight } from "../src/game/coast.ts";
import { terrainHeight, createPlantings, createScatter } from "../src/game/landscape.ts";

test("coast meets sea level, slopes into water and preserves inland terrain", () => {
  for (const x of [-180, -100, 0, 100, 180]) {
    const shore = shorelineZ(x);
    assert.ok(Math.abs(coastalHeight(x, shore, 8) - SEA_LEVEL) < 1e-9);
    assert.ok(coastalHeight(x, shore + 30, 8) < SEA_LEVEL - 5);
    assert.ok(coastalHeight(x, shore - 16, 8) > SEA_LEVEL);
    assert.equal(coastalHeight(x, shore - 40, 8), 8);
    assert.ok(Number.isFinite(terrainHeight(x, shore, "open")));
  }
});

test("grass and large decorative rocks remain on land", () => {
  for (const item of createScatter("open", 750)) assert.ok(item.z <= shorelineZ(item.x) - 10);
  for (const item of createPlantings("open", "rock", 165)) assert.ok(item.z <= shorelineZ(item.x) - 8);
});
