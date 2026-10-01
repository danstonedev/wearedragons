import test from "node:test";
import assert from "node:assert/strict";
import { chunkScenery, sceneryBlocked, SOLID_SCENERY, NEAR_ONLY } from "../src/game/scenery.ts";
import { chunkOf, CHUNKS_X, CHUNKS_Z } from "../src/game/terrainChunks.ts";
import { PADS, OASIS, FROZEN_LAKE, VOLCANO, kingdomAt } from "../src/game/world.ts";
import { inlandWater } from "../src/game/worldSites.ts";
import { terrainHeight } from "../src/game/landscape.ts";
import { SEA_LEVEL } from "../src/game/coast.ts";
import { mergeScenery } from "../src/world/sceneryTemplates.ts";

const styles = items => new Set(items.map(item => item.style));
const near = (x, z) => { const { cx, cz } = chunkOf(x, z); return chunkScenery(cx, cz, 140); };

test("scenery is the same on every visit and sits on dry ground", () => {
  const { cx, cz } = chunkOf(-400, -300);
  assert.deepEqual(chunkScenery(cx, cz, 140), chunkScenery(cx, cz, 140));
  let total = 0;
  for (let cz = 0; cz < CHUNKS_Z; cz += 3) for (let cx = 0; cx < CHUNKS_X; cx += 3) {
    for (const item of chunkScenery(cx, cz, 60)) {
      total++;
      assert.equal(item.y, terrainHeight(item.x, item.z, "open"));
      assert.ok(item.y > SEA_LEVEL + 0.5, "nothing grows underwater");
      assert.equal(inlandWater(item.x, item.z), null, "nothing stands in a lake");
      assert.ok(!PADS.some(pad => Math.hypot(item.x - pad.x, item.z - pad.z) < pad.r), "pads stay clear for their buildings");
      assert.ok(!(Math.abs(item.x) < 195 && item.z > -195 && item.z < 15), "the home forest is left as it was");
    }
  }
  assert.ok(total > 500, `the continent is well planted (${total})`);
  assert.ok(sceneryBlocked(OASIS.x, OASIS.z) && sceneryBlocked(FROZEN_LAKE.x, FROZEN_LAKE.z) && sceneryBlocked(VOLCANO.x, VOLCANO.z));
});

test("each kingdom grows its own kind of scenery", () => {
  const ice = styles(near(-560, -720)), sand = styles(near(700, -250)), mud = styles(near(-650, -250));
  const rain = styles(near(470, -600)), glaeryus = styles(near(-450, 60)), pantala = styles(near(450, 40));
  assert.equal(kingdomAt(-560, -720).id, "ice");
  assert.ok(ice.has("crystal") && !ice.has("cactus") && !ice.has("jungle"), [...ice].join());
  assert.ok((sand.has("cactus") || sand.has("palm")) && !sand.has("snowpine"), [...sand].join());
  assert.ok(mud.has("reeds") || mud.has("deadtree"), [...mud].join());
  assert.ok(rain.has("jungle"), [...rain].join());
  assert.ok(glaeryus.has("basalt") || glaeryus.has("darkpine"), [...glaeryus].join());
  assert.ok(pantala.has("acacia") || pantala.has("drybush"), [...pantala].join());
});

test("scenery merges into one geometry per chunk, with far versions only for big shapes", () => {
  const items = near(470, -600);
  const geometry = mergeScenery(items, false);
  const count = geometry.attributes.position.count;
  for (const name of ["normal", "color", "aSway"]) assert.equal(geometry.attributes[name].count, count, name);
  assert.ok(geometry.index.count % 3 === 0 && Math.max(...geometry.index.array) < count);
  assert.ok(geometry.boundingSphere.radius > 10);
  const far = mergeScenery(items.filter(item => !NEAR_ONLY.has(item.style)), true);
  assert.ok(far.attributes.position.count < count / 2, "far scenery is much lighter");
  assert.equal(mergeScenery([], false), null);
  for (const style of Object.keys(SOLID_SCENERY)) assert.ok(!NEAR_ONLY.has(style), `${style} is solid, so it must stay visible far away`);
  geometry.dispose(); far.dispose();
});
