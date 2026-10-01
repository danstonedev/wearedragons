import test from "node:test";
import assert from "node:assert/strict";
import {
  LAIRS, SCAVENGER, DRAGON_BODY_RADIUS, resolveCollisions, segmentBlocked, lightLevel, surfaceAt, floorHeight, carrySpeed, footstepRadius,
  createScavenger, stepScavenger, pebbleLanding, nearestLoot, lootNoise, createDragonState, stepLairDragon, dragonHead, isSnoring, canSee,
  raidStars, emptyScavengerProgress, recordRaid, parseScavengerProgress,
} from "../src/game/scavenger.ts";
import { TREASURE_KINDS } from "../src/game/loot.ts";
import { DRAGON_TYPES } from "../src/dragons.ts";

const den = LAIRS[0];
const vault = LAIRS[1];

function runDragon(def, state, context, lair, seconds, fps = 60) {
  const events = [];
  for (let i = 0; i < seconds * fps; i++) {
    const next = stepLairDragon(def, state, typeof context === "function" ? context(state, i) : context, lair, 1 / fps);
    state = next.state;
    events.push(...next.events);
  }
  return { state, events };
}
const quiet = (player, extra = {}) => ({ player, sneaking: false, light: 0.2, noises: [], pillars: den.pillars, ...extra });

test("every lair is walkable, its loot reachable, and three stars fits in one sack", () => {
  assert.equal(new Set(LAIRS.map(lair => lair.id)).size, LAIRS.length);
  for (const lair of LAIRS) {
    const inside = (spot, margin = 0) => Math.hypot(spot.x, spot.z) < lair.radius - margin;
    const clearOfPillars = (spot, margin) => lair.pillars.every(pillar => Math.hypot(spot.x - pillar.x, spot.z - pillar.z) > pillar.r + margin);
    assert.ok(inside(lair.start, 1) && clearOfPillars(lair.start, SCAVENGER.radius), `${lair.id} start`);
    assert.ok(Math.hypot(lair.start.x - lair.exit.x, lair.start.z - lair.exit.z) < 4, `${lair.id} starts at the burrow`);
    assert.equal(lair.loot.filter(item => item.prize).length, 1, `${lair.id} has one prize`);
    for (const item of lair.loot) {
      assert.ok(TREASURE_KINDS.includes(item.kind), item.id);
      assert.ok(inside(item, 1) && clearOfPillars(item, 0.6), `${item.id} is reachable`);
    }
    for (const dragon of lair.dragons) {
      assert.ok(DRAGON_TYPES.some(type => type.id === dragon.tribe), dragon.id);
      for (const point of [dragon, ...(dragon.route ?? [])]) assert.ok(inside(point, DRAGON_BODY_RADIUS) && clearOfPillars(point, DRAGON_BODY_RADIUS * 0.6), `${dragon.id} route point`);
    }
    assert.ok(lair.stars[0] < lair.stars[1] && lair.stars[1] < lair.stars[2]);
    let best = 0;
    for (let mask = 0; mask < 1 << lair.loot.length; mask++) {
      let weight = 0, value = 0;
      lair.loot.forEach((item, i) => { if (mask & (1 << i)) { weight += item.weight; value += item.value; } });
      if (weight <= SCAVENGER.capacity) best = Math.max(best, value);
    }
    assert.ok(best >= lair.stars[2], `${lair.id}: three stars needs ${lair.stars[2]}, best haul is ${best}`);
  }
});

test("sneaking is slow and quiet, sprinting is fast and loud, and loot weighs you down", () => {
  const run = (input, weight = 0) => {
    let state = createScavenger(den), steps = [];
    for (let i = 0; i < 120; i++) { const next = stepScavenger(state, input, den, weight, den.pillars, 1 / 60); state = next.state; if (next.step) steps.push(next.step); }
    return { distance: Math.hypot(state.x - den.start.x, state.z - den.start.z), steps };
  };
  const sneak = run({ x: 0, z: -1, sneak: true, sprint: false });
  const walk = run({ x: 0, z: -1, sneak: false, sprint: false });
  const sprint = run({ x: 0, z: -1, sneak: false, sprint: true });
  const laden = run({ x: 0, z: -1, sneak: false, sprint: true }, 6);
  assert.ok(sneak.distance < walk.distance && walk.distance < sprint.distance);
  assert.ok(laden.distance < sprint.distance * 0.8);
  assert.ok(Math.max(...sneak.steps.map(step => step.radius)) < Math.min(...walk.steps.map(step => step.radius)));
  assert.ok(Math.min(...sprint.steps.map(step => step.radius)) > 10);
  assert.ok(footstepRadius("sneak", 0, "coins") > footstepRadius("walk", 0, "stone"), "coins jingle even when sneaking");
  assert.ok(footstepRadius("walk", 6, "stone") > footstepRadius("walk", 0, "stone"), "a full sack rattles");
  assert.equal(footstepRadius("still", 8, "coins"), 0);
  assert.ok(carrySpeed(100) >= 0.5);
});

test("pillars, sleeping dragons, and the cave wall block movement", () => {
  const pillar = den.pillars[0];
  const pushed = resolveCollisions(pillar.x + 0.1, pillar.z, SCAVENGER.radius, den.pillars, den.radius);
  assert.ok(Math.hypot(pushed.x - pillar.x, pushed.z - pillar.z) >= pillar.r + SCAVENGER.radius - 1e-6);
  const wall = resolveCollisions(100, 0, SCAVENGER.radius, [], den.radius);
  assert.ok(Math.hypot(wall.x, wall.z) <= den.radius - SCAVENGER.radius + 1e-6);
  let state = { ...createScavenger(den), x: pillar.x, z: pillar.z + 4 };
  for (let i = 0; i < 240; i++) state = stepScavenger(state, { x: 0, z: -1, sneak: false, sprint: true }, den, 0, den.pillars, 1 / 60).state;
  assert.ok(Math.hypot(state.x - pillar.x, state.z - pillar.z) >= pillar.r + SCAVENGER.radius - 1e-3);
});

test("pillars block sight, braziers light you up, and the hoard is a low mound", () => {
  const pillar = den.pillars[0];
  assert.equal(segmentBlocked({ x: pillar.x, z: pillar.z - 5 }, { x: pillar.x, z: pillar.z + 5 }, den.pillars), true);
  assert.equal(segmentBlocked({ x: pillar.x + 5, z: pillar.z - 5 }, { x: pillar.x + 5, z: pillar.z + 5 }, [pillar]), false);
  const light = den.lights[0];
  assert.ok(lightLevel(den, light.x, light.z) > 0.9);
  assert.ok(Math.abs(lightLevel(den, -24, 8) - den.ambient) < 1e-9);
  assert.equal(surfaceAt(den, den.coins[0].x, den.coins[0].z), "coins");
  assert.equal(surfaceAt(den, -24, 8), "stone");
  assert.ok(floorHeight(den, den.hoard.x, den.hoard.z) === den.hoard.height && floorHeight(den, 0, 20) === 0);
});

test("a sleeping dragon ignores a snore-timed sneak but wakes to running feet", () => {
  const def = den.dragons[0];
  const head = dragonHead(createDragonState(def));
  const near = { x: head.x + 2.5, z: head.z + 1 };
  // Sneaking footsteps right beside the head, every 0.35 s, only during loud snores.
  const sneaky = runDragon(def, createDragonState(def), (state, i) => quiet(near, { noises: i % 21 === 0 && isSnoring(state) ? [{ ...near, radius: footstepRadius("sneak", 0, "stone"), kind: "step" }] : [] }), den, 12);
  assert.equal(sneaky.state.mode, "asleep");
  const runner = runDragon(def, createDragonState(def), (_, i) => quiet(near, { noises: i % 12 === 0 ? [{ ...near, radius: footstepRadius("sprint", 2, "coins"), kind: "step" }] : [] }), den, 2);
  assert.ok(runner.events.includes("wake") || runner.events.includes("stir"));
  assert.notEqual(runner.state.mode, "asleep");
});

test("snoring masks noise, and light sleepers hear more", () => {
  const def = den.dragons[0];
  const base = createDragonState(def);
  const head = dragonHead(base);
  const noise = { x: head.x + 3, z: head.z, radius: 8, kind: "step" };
  const snoringState = { ...base, snore: 3.2 }, breathing = { ...base, snore: 0.4 };
  assert.equal(isSnoring(snoringState), true);
  assert.equal(isSnoring(breathing), false);
  const masked = stepLairDragon(def, snoringState, quiet({ x: 20, z: 20 }, { noises: [noise] }), den, 1 / 60).state.suspicion;
  const clear = stepLairDragon(def, breathing, quiet({ x: 20, z: 20 }, { noises: [noise] }), den, 1 / 60).state.suspicion;
  assert.ok(clear > masked);
  const light = stepLairDragon({ ...def, lightSleeper: true }, breathing, quiet({ x: 20, z: 20 }, { noises: [noise] }), den, 1 / 60).state.suspicion;
  assert.ok(light > clear);
});

test("a patrol spots you in the light, but not behind a pillar or behind its back", () => {
  const def = vault.dragons[1];
  // The guard heads for its first waypoint; the player stands in its path.
  const yaw = Math.atan2(def.route[0].x, def.route[0].z);
  const guard = { ...createDragonState(def), x: 0, z: 0, yaw, mode: "patrol" };
  const head = dragonHead(guard);
  const along = distance => ({ x: head.x + Math.sin(yaw) * distance, z: head.z + Math.cos(yaw) * distance });
  const context = { player: along(8), sneaking: false, light: 1, noises: [], pillars: [] };
  assert.equal(canSee(def, guard, context).visible, true);
  assert.equal(canSee(def, guard, { ...context, pillars: [{ ...along(4), r: 1 }] }).visible, false);
  assert.equal(canSee(def, guard, { ...context, player: along(-9) }).visible, false);
  assert.equal(canSee(def, guard, { ...context, light: 0.15, sneaking: true, player: along(14) }).visible, false, "shadows and sneaking shorten sight");
  const spotted = runDragon(def, guard, { ...context, pillars: [] }, { ...vault, pillars: [] }, 1.5);
  assert.ok(spotted.events.includes("spot"));
  assert.equal(spotted.state.mode, "chase");
});

test("a chase catches a player who stands still, and loses one who hides", () => {
  const def = vault.dragons[1];
  const lair = { ...vault, pillars: [] };
  const chaser = { ...createDragonState(def), x: 0, z: 0, yaw: 0, mode: "chase", suspicion: 100 };
  const caught = runDragon(def, chaser, { player: { x: 0, z: 12 }, sneaking: false, light: 0.6, noises: [], pillars: [] }, lair, 4);
  assert.ok(caught.events.includes("caught"));
  const hidden = { x: 0, z: 14 };
  const wall = [{ x: 0, z: 9, r: 2.5 }];
  const lost = runDragon(def, { ...chaser, lastSeen: { x: 6, z: 4 } }, { player: hidden, sneaking: true, light: 0.2, noises: [], pillars: wall }, { ...vault, pillars: wall }, 12);
  assert.ok(lost.events.includes("lost"));
  assert.ok(!lost.events.includes("caught"));
  assert.ok(["search", "returning", "patrol"].includes(lost.state.mode));
});

test("a thrown pebble stops at pillars and lures a guard to investigate", () => {
  const pillar = den.pillars[0];
  const landing = pebbleLanding(den, { x: pillar.x, z: pillar.z + 6 }, Math.PI, 12);
  assert.ok(landing.z > pillar.z + pillar.r, "pebble lands before the pillar");
  const open = pebbleLanding(den, { x: 0, z: 0 }, Math.PI / 2, 8);
  assert.ok(Math.abs(open.x - 8) < 0.3);
  const def = vault.dragons[1];
  const guard = { ...createDragonState(def), x: 0, z: 0, yaw: 0, mode: "patrol" };
  const plink = { x: -6, z: 0, radius: 11, kind: "pebble" };
  const lured = runDragon(def, guard, (_, i) => ({ player: { x: 20, z: 20 }, sneaking: true, light: 0.2, noises: i === 0 ? [plink] : [], pillars: [] }), { ...vault, pillars: [] }, 4);
  assert.equal(lured.state.mode, "investigate");
  assert.ok(Math.hypot(lured.state.x - plink.x, lured.state.z - plink.z) < Math.hypot(guard.x - plink.x, guard.z - plink.z));
});

test("guard patrols are similar at 30, 60, and 120 Hz", () => {
  const def = vault.dragons[1];
  const results = [30, 60, 120].map(fps => runDragon(def, createDragonState(def), quiet({ x: 0, z: 25 }, { pillars: vault.pillars }), vault, 10, fps).state);
  for (const state of results) {
    assert.equal(state.mode, "patrol");
    assert.ok(Math.hypot(state.x - results[1].x, state.z - results[1].z) < 1.5);
  }
});

test("grabbing picks the closest loot in reach, and prizes clink loudly", () => {
  const item = den.loot[0];
  assert.equal(nearestLoot(den, new Set(), { x: item.x + 0.5, z: item.z })?.id, item.id);
  assert.equal(nearestLoot(den, new Set([item.id]), { x: item.x + 0.5, z: item.z }), null);
  assert.equal(nearestLoot(den, new Set(), { x: item.x + 5, z: item.z }), null);
  const prize = den.loot.find(loot => loot.prize);
  assert.ok(lootNoise(prize) > lootNoise(den.loot[0]));
});

test("raid records keep the best result and ignore empty or failed raids", () => {
  let progress = recordRaid(emptyScavengerProgress(), den, { escaped: true, value: 250, ghost: false, prize: true });
  assert.deepEqual(progress.lairs[den.id], { stars: 2, bestLoot: 250, escapes: 1, ghost: false, prize: true });
  progress = recordRaid(progress, den, { escaped: true, value: 70, ghost: true, prize: false });
  assert.deepEqual(progress.lairs[den.id], { stars: 2, bestLoot: 250, escapes: 2, ghost: true, prize: true });
  for (const bad of [{ escaped: false, value: 900, ghost: true, prize: true }, { escaped: true, value: 0, ghost: true, prize: false }, { escaped: true, value: NaN, ghost: true, prize: false }]) {
    assert.equal(recordRaid(progress, den, bad), progress);
  }
  assert.equal(raidStars(den, 1000), 3);
  assert.equal(raidStars(den, 10), 0);
  assert.deepEqual(parseScavengerProgress(JSON.stringify(progress)), progress);
  for (const raw of [null, "{", '{"version":2}', '{"version":1,"lairs":{"mudwallow_den":{"stars":9}}}']) assert.deepEqual(parseScavengerProgress(raw), emptyScavengerProgress());
});

test("each prize is a timing puzzle: silent during a loud snore, heard between snores", () => {
  for (const lair of LAIRS) {
    const prize = lair.loot.find(item => item.prize);
    const sleeper = lair.dragons.find(dragon => dragon.role === "sleeper");
    const state = createDragonState(sleeper);
    const head = dragonHead(state);
    const distance = Math.hypot(prize.x - head.x, prize.z - head.z);
    assert.ok(distance > 3.5 && distance < 6.5, `${lair.id} prize sits near the snout (${distance.toFixed(2)})`);
    const clink = { x: prize.x, z: prize.z, radius: lootNoise(prize), kind: "loot" };
    const context = { player: { x: prize.x, z: prize.z + 1.5 }, sneaking: true, light: 0.2, noises: [clink], pillars: lair.pillars };
    const snoring = stepLairDragon(sleeper, { ...state, snore: 3.2 }, context, lair, 1 / 60).state;
    const breathing = stepLairDragon(sleeper, { ...state, snore: 0.4 }, context, lair, 1 / 60).state;
    if (sleeper.lightSleeper) assert.ok(snoring.suspicion > 0, "light sleepers hear the prize even mid-snore");
    else assert.equal(snoring.suspicion, 0, `${lair.id}: a snore covers the prize`);
    assert.ok(breathing.suspicion >= 30, `${lair.id}: grabbing between snores stirs the dragon`);
  }
});
