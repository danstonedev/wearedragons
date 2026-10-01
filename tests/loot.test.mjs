import test from "node:test";
import { SEA_LEVEL, shorelineZ } from "../src/game/coast.ts";
import assert from "node:assert/strict";
import {
  TREASURES, TREASURE_KINDS, createCommonLoot, resolveTreasureSpot, skyDrift, regionOf, appraise, TRIBE_TASTES,
  emptyTalons, grabWith, releaseFrom, carriedIds, talonsNeeded, carryLoad, stepLooseLoot, inLake, inSea,
  HOARD_SITE, LAKE, hoardFloor, inHoardZone, dunkBonus, emptyHoard, bankLoot, parseHoard, hoardRank, hoardMoundHeight,
  KINGDOM_TREASURES, ALL_TREASURES, createWildLoot, inLava, inlandSplash, restingSurface,
} from "../src/game/loot.ts";
import { KINGDOMS, FROZEN_LAKE, OASIS, VOLCANO, MUD_POOLS, SCAVENGER_CAMPS, kingdomAt } from "../src/game/world.ts";
import { inlandWater } from "../src/game/worldSites.ts";
import { terrainHeight, createPlantings } from "../src/game/landscape.ts";
import { DRAGON_TYPES } from "../src/dragons.ts";

test("every region hides eight unique treasures that sit inside their own region", () => {
  assert.equal(TREASURES.length, 24);
  assert.equal(new Set(TREASURES.map(def => def.id)).size, 24);
  for (const region of ["pyrrhia", "pantala", "glaeryus"]) {
    const local = TREASURES.filter(def => def.region === region);
    assert.equal(local.length, 8, region);
    assert.ok(local.some(def => def.weight >= 3), `${region} needs a two-talon chest`);
  }
  for (const def of TREASURES) {
    assert.ok(TREASURE_KINDS.includes(def.kind), def.id);
    assert.ok(def.unique && def.value > 0 && def.weight >= 1 && def.weight <= 3, def.id);
    const spot = resolveTreasureSpot(def);
    assert.ok([spot.x, spot.y, spot.z].every(Number.isFinite), def.id);
    assert.ok(Math.abs(spot.x) < 190 && Math.abs(spot.z) < 190, def.id);
    assert.equal(regionOf(spot.x, spot.z), def.region, `${def.id} drifted into another region`);
    const ground = terrainHeight(spot.x, spot.z, "open");
    if (def.perch === "ground") {
      assert.equal(spot.y, ground);
      assert.ok(!(Math.hypot(spot.x - LAKE.x, spot.z - LAKE.z) < LAKE.radius), `${def.id} is under water`);
    } else {
      assert.ok(spot.y > ground + 4, `${def.id} should be up high`);
    }
  }
});

test("treetop and spire perches use real scenery available on every device budget", () => {
  const trees = createPlantings("open", "tree", 120);
  for (const def of TREASURES.filter(item => item.perch === "treetop")) {
    const spot = resolveTreasureSpot(def);
    const tree = trees.find(candidate => candidate.x === spot.x && candidate.z === spot.z);
    assert.ok(tree, `${def.id} must rest on a planted tree`);
    assert.ok(Math.hypot(spot.x - def.at[0], spot.z - def.at[1]) < 30, `${def.id} snapped too far away`);
  }
  for (const def of TREASURES.filter(item => item.perch === "sky")) {
    const a = skyDrift(def, 0), b = skyDrift(def, 10);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.5, `${def.id} lantern should drift`);
    assert.ok(Math.hypot(b.x, b.z) <= 6.0001);
  }
});

test("common finds are deterministic, spread out, and avoid the lake, hoard, and beacons", () => {
  const a = createCommonLoot(), b = createCommonLoot();
  assert.deepEqual(a, b);
  assert.equal(a.length, 30);
  assert.equal(new Set(a.map(def => def.id)).size, 30);
  for (const def of a) {
    assert.equal(def.unique, false);
    assert.equal(def.region, regionOf(def.at[0], def.at[1]));
    assert.ok(Math.hypot(def.at[0] - LAKE.x, def.at[1] - LAKE.z) > LAKE.radius);
    assert.ok(Math.hypot(def.at[0] - HOARD_SITE.x, def.at[1] - HOARD_SITE.z) > HOARD_SITE.radius + 5);
  }
  assert.ok(new Set(a.map(def => def.kind)).size >= 3);
});

test("tribe tastes reward favorite loot and every playable dragon has one", () => {
  const mango = TREASURES.find(def => def.id === "perfect_mango");
  assert.deepEqual(appraise(mango, "rainwing"), { value: 240, multiplier: 6, favored: true });
  assert.deepEqual(appraise(mango, "mudwing"), { value: 40, multiplier: 1, favored: false });
  const pearl = TREASURES.find(def => def.id === "lakeshore_pearl");
  assert.equal(appraise(pearl, "seawing").value, 450);
  for (const dragon of DRAGON_TYPES) {
    const taste = TRIBE_TASTES[dragon.id];
    assert.ok(taste, `${dragon.id} needs a taste`);
    assert.ok(TREASURES.some(def => def.tags.some(tag => taste.tags.includes(tag))), `${dragon.id} must have something to love`);
  }
});

test("two talons carry two light treasures; chests need both and drop as one", () => {
  let talons = emptyTalons();
  let grab = grabWith(talons, "goblet", 1);
  assert.equal(grab.side, "right");
  talons = grab.talons;
  assert.equal(grabWith(talons, "goblet", 1), null, "cannot grab the same item twice");
  assert.equal(grabWith(talons, "chest", 3), null, "a chest needs both talons free");
  grab = grabWith(talons, "crown", 1);
  assert.equal(grab.side, "left");
  talons = grab.talons;
  assert.equal(grabWith(talons, "gem", 1), null, "talons are full");
  assert.deepEqual(carriedIds(talons), ["crown", "goblet"]);
  const dropped = releaseFrom(talons, "right");
  assert.equal(dropped.itemId, "goblet");
  assert.deepEqual(dropped.talons, { left: "crown", right: null });
  assert.deepEqual(releaseFrom(dropped.talons, "right"), { talons: dropped.talons, itemId: null });

  const chest = grabWith(emptyTalons(), "vault", 3);
  assert.equal(chest.side, "both");
  assert.deepEqual(carriedIds(chest.talons), ["vault"]);
  assert.deepEqual(releaseFrom(chest.talons, "left"), { talons: emptyTalons(), itemId: "vault" });
  assert.equal(talonsNeeded(2), 1);
  assert.equal(grabWith(emptyTalons(), "idol", 2, "left").side, "left");
});

test("heavy hauls slow flight and climbing, and armored dragons carry better", () => {
  const empty = carryLoad(0, 1);
  assert.deepEqual(empty, { speedFactor: 1, climbFactor: 1 });
  const light = carryLoad(1, 1), chest = carryLoad(3, 1);
  assert.ok(chest.speedFactor < light.speedFactor && light.speedFactor < 1);
  assert.ok(chest.climbFactor < chest.speedFactor, "climbing suffers more than cruising");
  assert.ok(carryLoad(3, 1.5).speedFactor > carryLoad(3, 0.6).speedFactor);
  const absurd = carryLoad(999, 0.1);
  assert.ok(absurd.speedFactor >= 0.55 && absurd.climbFactor >= 0.35);
  assert.deepEqual(carryLoad(NaN, NaN), { speedFactor: 1, climbFactor: 1 });
});

test("dropped treasure falls, bounces, and settles in the same spot at any frame rate", () => {
  const ground = () => 2;
  const results = [30, 60, 120].map(fps => {
    let item = { position: { x: 0, y: 30, z: 0 }, velocity: { x: 8, y: 0, z: -4 }, resting: false };
    for (let i = 0; i < fps * 6 && !item.resting; i++) item = stepLooseLoot(item, 1 / fps, ground);
    return item;
  });
  for (const item of results) {
    assert.equal(item.resting, true);
    assert.equal(item.position.y, 2);
    assert.ok(Math.hypot(item.position.x - results[1].position.x, item.position.z - results[1].position.z) < 1.5);
    assert.ok(item.position.x > 5, "thrown loot keeps its forward momentum");
  }
  const resting = { position: { x: 1, y: 2, z: 3 }, velocity: { x: 0, y: 0, z: 0 }, resting: true };
  assert.equal(stepLooseLoot(resting, 1 / 60, ground), resting);
  assert.equal(inLake({ x: LAKE.x + 3, y: LAKE.surface - 1, z: LAKE.z }), true);
  assert.equal(inLake({ x: LAKE.x + 3, y: LAKE.surface + 4, z: LAKE.z }), false);
  assert.equal(inSea({ x: 0, y: SEA_LEVEL - 2, z: shorelineZ(0) + 20 }), true);
  assert.equal(inSea({ x: 0, y: SEA_LEVEL + 6, z: shorelineZ(0) + 20 }), false, "still falling above the waves");
  assert.equal(inSea({ x: 0, y: SEA_LEVEL - 2, z: shorelineZ(0) - 30 }), false, "a dip inland is not the sea");
});

test("the sea never swallows treasure: ground loot sits ashore, above the waterline", () => {
  for (const def of [...TREASURES, ...createCommonLoot()]) {
    const spot = resolveTreasureSpot(def);
    if (def.perch === "sky") {
      assert.ok(spot.y > SEA_LEVEL + 10, `${def.id} lantern flies above the sea`);
      continue;
    }
    assert.ok(spot.z < shorelineZ(spot.x) - 6, `${def.id} is in the surf`);
    // On the beach (the 36-unit coastal blend), sand must stand clear of the waves.
    if (spot.z > shorelineZ(spot.x) - 36) assert.ok(spot.y > SEA_LEVEL + 1, `${def.id} is under water`);
  }
});

test("the hoard nest is level, banks loot in its column, and rewards high dunks", () => {
  const floor = hoardFloor();
  assert.ok(Math.abs(floor) < 1e-6, "the nest sits in a level clearing");
  for (const tree of createPlantings("open", "tree", 210)) {
    assert.ok(Math.hypot(tree.x - HOARD_SITE.x, tree.z - HOARD_SITE.z) > HOARD_SITE.radius + 4, "no tree grows in the hoard");
  }
  assert.equal(inHoardZone({ x: HOARD_SITE.x + 3, y: floor + 6, z: HOARD_SITE.z }), true);
  assert.equal(inHoardZone({ x: HOARD_SITE.x + 3, y: floor + 40, z: HOARD_SITE.z }), false);
  assert.equal(inHoardZone({ x: HOARD_SITE.x + 20, y: floor + 3, z: HOARD_SITE.z }), false);
  assert.equal(dunkBonus(4), 1);
  assert.equal(dunkBonus(12), 1.25);
  assert.equal(dunkBonus(30), 1.5);
  assert.equal(dunkBonus(NaN), 1);
});

test("banking grows the saved hoard once per unique treasure and survives reloads", () => {
  const crown = TREASURES.find(def => def.id === "mossy_crown");
  const [coins] = createCommonLoot();
  let hoard = bankLoot(emptyHoard(), crown, "skywing", 455);
  assert.equal(hoard.gold, 455);
  assert.deepEqual(hoard.banked.mossy_crown, { by: "skywing", value: 455 });
  assert.equal(bankLoot(hoard, crown, "mudwing", 260), hoard, "a unique treasure cannot be banked twice");
  hoard = bankLoot(hoard, coins, "mudwing", 20);
  hoard = bankLoot(hoard, coins, "mudwing", 20);
  assert.equal(hoard.gold, 495);
  assert.equal(hoard.deliveries, 3);
  assert.deepEqual(hoard.byDragon, { skywing: 455, mudwing: 40 });
  for (const bad of [NaN, -5, Infinity]) assert.equal(bankLoot(hoard, coins, "mudwing", bad), hoard);
  assert.equal(bankLoot(hoard, coins, "Not A Dragon!", 5), hoard);
  assert.deepEqual(parseHoard(JSON.stringify(hoard)), hoard);
});

test("damaged hoard saves keep valid records and reject corrupt ones", () => {
  for (const raw of [null, "{", "null", '{"version":2,"gold":50}', "[]"]) assert.deepEqual(parseHoard(raw), emptyHoard());
  const parsed = parseHoard(JSON.stringify({
    version: 1, gold: -4, deliveries: 2.5,
    banked: { mossy_crown: { by: "skywing", value: 300 }, fake_treasure: { by: "skywing", value: 9 }, ember_opal: { by: "<script>", value: 4 } },
    byDragon: { skywing: 300, "__proto__": 5, bad: "lots" },
  }));
  assert.equal(parsed.gold, 0);
  assert.equal(parsed.deliveries, 0);
  assert.deepEqual(Object.keys(parsed.banked), ["mossy_crown"]);
  assert.deepEqual(parsed.byDragon, { skywing: 300 });
});

test("hoard ranks and the gold mound grow with the hoard", () => {
  assert.equal(hoardRank(0).title, "Shiny-Pebble Keeper");
  assert.equal(hoardRank(0).next, 150);
  assert.equal(hoardRank(1500).title, "Treasure Warden");
  assert.equal(hoardRank(99999).next, undefined);
  assert.ok(hoardMoundHeight(0) < hoardMoundHeight(500));
  assert.ok(hoardMoundHeight(500) < hoardMoundHeight(5000));
  assert.ok(hoardMoundHeight(1e9) <= 2.05 + 1e-9);
});

test("every kingdom beyond the valley hides three treasures of its own, perched on its landmarks", () => {
  assert.equal(new Set(ALL_TREASURES.map(def => def.id)).size, ALL_TREASURES.length);
  for (const kingdom of KINGDOMS.filter(item => item.id !== "pyrrhia")) {
    const local = KINGDOM_TREASURES.filter(def => def.kingdom === kingdom.id);
    assert.equal(local.length, 3, kingdom.id);
  }
  assert.ok(KINGDOM_TREASURES.filter(def => def.weight >= 3).length >= 3, "a few two-talon chests out there");
  for (const def of KINGDOM_TREASURES) {
    const spot = resolveTreasureSpot(def);
    assert.ok([spot.x, spot.y, spot.z].every(Number.isFinite), def.id);
    assert.equal(kingdomAt(spot.x, spot.z).id, def.kingdom, `${def.id} lies in its kingdom`);
    assert.ok(def.unique && TREASURE_KINDS.includes(def.kind), def.id);
    assert.ok(!inSea(spot) && !inLava(spot) && !inlandSplash(spot), `${def.id} is high and dry`);
    if (def.perch === "ground") {
      assert.equal(inlandWater(spot.x, spot.z), null, def.id);
      assert.ok(spot.y > SEA_LEVEL, def.id);
    }
    if (def.perch === "ledge") assert.ok(spot.y > terrainHeight(spot.x, spot.z, "open") + 20, `${def.id} sits high on its landmark`);
  }
});

test("wild loot is scattered over every kingdom, never in water, camps, or the home valley's own patch", () => {
  const wild = createWildLoot();
  assert.deepEqual(wild.map(def => def.id), createWildLoot().map(def => def.id), "the same every flight");
  assert.ok(wild.length >= 50, `${wild.length}`);
  const kingdoms = new Set(wild.map(def => kingdomAt(def.at[0], def.at[1]).id));
  for (const id of ["sky", "ice", "mud", "rainforest", "sand", "pantala", "glaeryus"]) assert.ok(kingdoms.has(id), id);
  for (const def of wild) {
    const [x, z] = def.at;
    assert.ok(!def.unique && def.perch === "ground", def.id);
    assert.ok(!(Math.abs(x) < 215 && z > -215 && z < 170), `${def.id} leaves the valley to the valley's own loot`);
    const y = terrainHeight(x, z, "open");
    assert.equal(inlandWater(x, z), null, def.id);
    assert.ok(!inSea({ x, y, z }) && !inlandSplash({ x, y, z }), def.id);
    assert.ok(SCAVENGER_CAMPS.every(camp => Math.hypot(x - camp.x, z - camp.z) > 26), `${def.id} is not already in a stash`);
  }
});

test("dropped treasure sinks in lava, mud, and the oasis, and rests on the frozen lake's ice", () => {
  assert.ok(inLava({ x: VOLCANO.x, y: VOLCANO.lava - 1, z: VOLCANO.z }));
  assert.ok(!inLava({ x: VOLCANO.x, y: VOLCANO.lava + 20, z: VOLCANO.z }));
  assert.equal(inlandSplash({ x: OASIS.x, y: OASIS.level - 0.5, z: OASIS.z }), "oasis");
  assert.equal(inlandSplash({ x: MUD_POOLS[0].x, y: 0, z: MUD_POOLS[0].z }), "mud");
  assert.equal(inlandSplash({ x: 0, y: 0, z: -300 }), null);
  assert.equal(restingSurface(FROZEN_LAKE.x, FROZEN_LAKE.z), Math.max(terrainHeight(FROZEN_LAKE.x, FROZEN_LAKE.z, "open"), FROZEN_LAKE.level));
  assert.ok(restingSurface(FROZEN_LAKE.x, FROZEN_LAKE.z) >= FROZEN_LAKE.level);
  assert.equal(restingSurface(0, -300), terrainHeight(0, -300, "open"));
});
