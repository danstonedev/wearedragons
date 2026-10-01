import test from "node:test";
import assert from "node:assert/strict";
import { TREASURE_KINDS, TREASURES, createCommonLoot } from "../src/game/loot.ts";
import { treasureGeometry, treasureCenter, createTreasureMaterial } from "../src/world/treasureModels.ts";

test("every treasure kind builds one merged, colored, ground-resting model", () => {
  for (const kind of TREASURE_KINDS) {
    const geometry = treasureGeometry(kind);
    assert.equal(treasureGeometry(kind), geometry, `${kind} geometry is cached`);
    assert.equal(geometry.index, null);
    assert.ok(geometry.attributes.color, `${kind} needs vertex colors`);
    assert.equal(geometry.attributes.color.count, geometry.attributes.position.count);
    const box = geometry.boundingBox;
    assert.ok(box.min.y > -0.06 && box.min.y < 0.12, `${kind} should rest on the ground (min y ${box.min.y})`);
    const size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
    assert.ok(size > 0.3 && size < 1.7, `${kind} size ${size}`);
    assert.ok(treasureCenter(kind) > 0.05);
    assert.ok(Array.from(geometry.attributes.position.array).every(Number.isFinite));
    assert.ok(geometry.attributes.position.count < 4000, `${kind} is too detailed for Quest`);
  }
});

test("all catalog and common loot kinds have models, and the glow material is cacheable", () => {
  for (const def of [...TREASURES, ...createCommonLoot()]) assert.ok(TREASURE_KINDS.includes(def.kind));
  const material = createTreasureMaterial();
  assert.equal(material.vertexColors, true);
  assert.equal(material.customProgramCacheKey(), "treasure-glow");
  const shader = { fragmentShader: "a\n#include <emissivemap_fragment>\nb" };
  material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /totalEmissiveRadiance \+= diffuseColor\.rgb/);
  material.dispose();
});
