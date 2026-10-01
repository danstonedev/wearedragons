import test from "node:test";
import assert from "node:assert/strict";
import {
  SCAV, campLayouts, createScavengerWorld, stepScavengers, chooseForageTarget, walkable, wet, raidSpot, hitBallista, threatTo,
} from "../src/game/scavengerCamps.ts";
import { SCAVENGER_CAMPS, CAMP_RADIUS, PADS, LAND_KINGDOMS, kingdomAt } from "../src/game/world.ts";
import { HOARD_SITE, raidHaul, stealGold, bankLoot, emptyHoard, parseHoard, appraise } from "../src/game/loot.ts";
import { terrainHeight } from "../src/game/landscape.ts";
import { ROYAL_HOARDS } from "../src/game/worldSites.ts";
import { LANDMARK_FOOTPRINTS, chunkScenery } from "../src/game/scenery.ts";
import { chunkOf } from "../src/game/terrainChunks.ts";

const ground = (x, z) => terrainHeight(x, z, "open");
const campIndex = id => SCAVENGER_CAMPS.findIndex(camp => camp.id === id);

/** A loose treasure `distance` meters out from a camp's burrow, on a walkable line. */
function treasureNear(c, distance, id = "test_gem") {
  const { mouth } = campLayouts()[c];
  for (let a = 0; a < 32; a++) {
    const angle = a / 32 * Math.PI * 2;
    const x = mouth.x + Math.sin(angle) * distance, z = mouth.z + Math.cos(angle) * distance;
    if (!wet(x, z) && walkable(mouth.x, mouth.z, x, z) && Math.hypot(x - SCAVENGER_CAMPS[c].x, z - SCAVENGER_CAMPS[c].z) > 26) {
      return { id, x, y: ground(x, z), z, grounded: true };
    }
  }
  throw new Error("no walkable spot");
}

/** Senses for a test flight: loose treasure can be claimed once; stealing makes numbered sacks. */
function makeSenses(dragon, loose, extra = {}) {
  const stolen = [];
  const senses = {
    dragon: { vx: 0, vy: 0, vz: 0, cloaked: false, down: false, ...dragon },
    impacts: [],
    loose,
    gold: 0,
    claim: (agent, itemId) => {
      const index = senses.loose.findIndex(item => item.id === itemId);
      if (index < 0) return false;
      senses.loose = senses.loose.filter(item => item.id !== itemId);
      return true;
    },
    steal: (agent, campId, amount) => {
      if (!(amount > 0)) return null;
      stolen.push({ agent: agent.id, campId, amount });
      return `gold_sack_${stolen.length - 1}`;
    },
    stolen,
    ...extra,
  };
  return senses;
}

function run(world, senses, seconds, fps = 20, each) {
  const events = [];
  for (let i = 0; i < seconds * fps; i++) {
    each?.(world, senses, i / fps);
    const step = stepScavengers(world, senses, 1 / fps);
    events.push(...step);
    senses.impacts = [];
  }
  return events;
}

test("scavenger camps sit on dry, open ground in the wilds, clear of every kingdom's landmarks", () => {
  assert.equal(new Set(SCAVENGER_CAMPS.map(camp => camp.id)).size, SCAVENGER_CAMPS.length);
  assert.ok(SCAVENGER_CAMPS.length >= 8);
  const kingdoms = new Set();
  SCAVENGER_CAMPS.forEach((camp, c) => {
    const layout = campLayouts()[c];
    kingdoms.add(kingdomAt(camp.x, camp.z).id);
    assert.ok(LAND_KINGDOMS.includes(kingdomAt(camp.x, camp.z).id), camp.id);
    assert.ok(!(Math.abs(camp.x) < 200 && camp.z > -200 && camp.z < 20), `${camp.id} keeps out of the home forest`);
    for (const spot of [layout.mouth, layout.fire, layout.stash, ...layout.tents, layout.ballista].filter(Boolean)) {
      assert.ok(!wet(spot.x, spot.z), `${camp.id} stays dry`);
      assert.ok(Math.abs(spot.y - layout.center.y) < 4, `${camp.id} is laid out on gentle ground`);
    }
    for (const pad of PADS) assert.ok(Math.hypot(camp.x - pad.x, camp.z - pad.z) > pad.r + pad.blend + CAMP_RADIUS * 0.5, `${camp.id} clears a pad`);
    for (const hoard of Object.values(ROYAL_HOARDS)) assert.ok(Math.hypot(camp.x - hoard.x, camp.z - hoard.z) > 90, `${camp.id} keeps away from a royal hoard`);
    for (const other of SCAVENGER_CAMPS.slice(c + 1)) assert.ok(Math.hypot(camp.x - other.x, camp.z - other.z) > 150, `${camp.id} and ${other.id} are spread out`);
    assert.ok(LANDMARK_FOOTPRINTS.some(site => site.x === camp.x && site.z === camp.z && site.r >= CAMP_RADIUS));
    const { cx, cz } = chunkOf(camp.x, camp.z);
    for (const item of chunkScenery(cx, cz, 200)) assert.ok(Math.hypot(item.x - camp.x, item.z - camp.z) >= CAMP_RADIUS, `${camp.id} is cleared of trees`);
  });
  assert.ok(kingdoms.size >= 6, [...kingdoms].join());
  // Raiding camps have a dry walk all the way to your hoard.
  const raiders = SCAVENGER_CAMPS.map((camp, c) => ({ camp, c })).filter(({ camp }) => camp.raids);
  assert.ok(raiders.length >= 2);
  for (const { camp, c } of raiders) {
    const { mouth } = campLayouts()[c];
    for (const n of [0, 1]) {
      const spot = raidSpot(c, n);
      assert.ok(Math.hypot(spot.x - HOARD_SITE.x, spot.z - HOARD_SITE.z) < HOARD_SITE.radius, "raiders stand on the hoard's rim");
      assert.ok(walkable(mouth.x, mouth.z, spot.x, spot.z), `${camp.id} can walk to your hoard`);
    }
  }
});

test("foragers pick the nearest treasure they can walk to, never a stash, a perch, or across water", () => {
  const c = campIndex("rootcellar");
  const near = treasureNear(c, 40, "near"), farther = treasureNear(c, 90, "farther");
  const perched = { ...treasureNear(c, 32, "perched"), grounded: false };
  const camp = SCAVENGER_CAMPS[c];
  const stashed = { id: "stashed", x: camp.x + 3, y: ground(camp.x + 3, camp.z), z: camp.z, grounded: true };
  assert.equal(chooseForageTarget(c, [farther, near, perched, stashed], new Set())?.id, "near");
  assert.equal(chooseForageTarget(c, [farther, near], new Set(["near"]))?.id, "farther");
  assert.equal(chooseForageTarget(c, [{ ...near, x: near.x + 900 }], new Set()), null, "too far from home");
  assert.equal(chooseForageTarget(c, [perched, stashed], new Set()), null);
  // Lakes and the sea are in the way.
  assert.ok(!walkable(0, -140, 62, -82), "the home lake");
  assert.ok(!walkable(0, 100, 0, 220), "the sea");
});

test("a forager sneaks out, works a treasure loose, and hauls it home to the camp stash", () => {
  const c = campIndex("rootcellar");
  const { mouth } = campLayouts()[c];
  const gem = treasureNear(c, 45);
  // You circle far enough off that nobody notices you.
  const away = Math.atan2(mouth.x - gem.x, mouth.z - gem.z);
  const dragon = { x: mouth.x + Math.sin(away) * 220, y: 120, z: mouth.z + Math.cos(away) * 220 };
  const world = createScavengerWorld();
  const senses = makeSenses(dragon, [gem]);
  const events = run(world, senses, 120);
  const mine = events.filter(event => event.agent?.camp === c || event.camp === c).map(event => event.type);
  assert.deepEqual(mine.filter(type => type !== "fire"), ["outing", "claimed", "stashed"]);
  const stash = events.find(event => event.type === "stashed");
  assert.equal(stash.item, gem.id);
  assert.equal(world.camps[c].stashed, 1);
  assert.equal(stash.agent.mode, "home");
  assert.equal(senses.loose.length, 0);
});

test("swoop low over a hauler and it drops its loot and runs for the burrow", () => {
  const c = campIndex("rootcellar");
  const { mouth } = campLayouts()[c];
  const gem = treasureNear(c, 60);
  const away = Math.atan2(mouth.x - gem.x, mouth.z - gem.z);
  const world = createScavengerWorld();
  const senses = makeSenses({ x: mouth.x + Math.sin(away) * 220, y: 120, z: mouth.z + Math.cos(away) * 220 }, [gem]);
  let swooped = false, sheltered = null;
  const events = run(world, senses, 120, 20, current => {
    const hauler = current.agents.find(agent => agent.mode === "haul");
    if (hauler && !swooped) {
      swooped = true;
      Object.assign(senses.dragon, { x: hauler.x + 4, y: hauler.y + 6, z: hauler.z });
    }
    // Once it bolts, you fly off again.
    const fleeing = current.agents.find(agent => agent.mode === "flee");
    if (swooped && fleeing) Object.assign(senses.dragon, { x: mouth.x + 300, y: 140 });
    const panicked = swooped && !sheltered && current.agents.find(agent => agent.mode === "home" && agent.timer > SCAV.rest[1]);
    if (panicked) sheltered = { timer: panicked.timer };
  });
  const panic = events.find(event => event.type === "panic");
  assert.ok(panic, "the hauler panicked");
  assert.equal(panic.dropped, gem.id, "and dropped the treasure");
  assert.ok(!events.some(event => event.type === "stashed"));
  assert.ok(sheltered, "it made it underground");
  assert.ok(sheltered.timer > SCAV.scaredRest - 1, "and stays down a while");
});

test("dragons are frightening: near and low means panic, a cloak gets you closer, fire scares from afar", () => {
  const agent = { x: 0, y: 0, z: 0 };
  const dragon = extra => ({ dragon: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, cloaked: false, down: false, ...extra }, impacts: [] });
  assert.equal(threatTo(agent, dragon({ x: 10, y: 8 })), 2);
  assert.equal(threatTo(agent, dragon({ x: 10, y: 30 })), 1, "high overhead only hurries them");
  assert.equal(threatTo(agent, dragon({ x: 100, y: 30 })), 0);
  assert.equal(threatTo(agent, dragon({ x: 10, y: 8, cloaked: true })), 0, "a cloaked dragon is not noticed");
  assert.equal(threatTo(agent, dragon({ x: 3, y: 2, cloaked: true })), 2);
  assert.equal(threatTo(agent, dragon({ x: 10, y: 8, down: true })), 0, "a knocked-out dragon scares nobody");
  assert.equal(threatTo(agent, { ...dragon({ x: 200, y: 50 }), impacts: [{ x: 6, y: 1, z: 3 }] }), 2, "fire nearby");
});

test("while you are away, scavengers raid your hoard; if they get home, the gold is in their stash", () => {
  const world = createScavengerWorld();
  const senses = makeSenses({ x: 640, y: 80, z: -820 }, []);
  senses.gold = 500;
  const events = run(world, senses, 520, 10);
  const raid = events.find(event => event.type === "raid");
  assert.ok(raid, "a raid set out");
  const camp = SCAVENGER_CAMPS[raid.camp];
  assert.ok(camp.raids);
  assert.equal(raid.camp, campIndex("saltburrow"), "from the raiding camp farthest from you");
  const stole = events.filter(event => event.type === "stole");
  assert.equal(stole.length, SCAV.raid.party);
  assert.deepEqual(senses.stolen.map(entry => entry.amount), [raidHaul(500), raidHaul(500)]);
  assert.ok(senses.stolen.every(entry => entry.campId === camp.id));
  const stashed = events.filter(event => event.type === "stashed").map(event => event.item);
  assert.deepEqual(stashed.sort(), stole.map(event => event.item).sort(), "both sacks reached the burrow");
  const over = events.find(event => event.type === "raid_over");
  assert.deepEqual({ camp: over.camp, escaped: over.escaped }, { camp: raid.camp, escaped: true });
  assert.equal(world.raid, null);
  // Raiders only set out once you have been away a while.
  const early = createScavengerWorld();
  assert.ok(!run(early, makeSenses({ x: 640, y: 80, z: -820 }, [], { gold: 500 }), SCAV.raid.first - 5, 10).some(event => event.type === "raid"));
});

test("guard your hoard and raiders turn tail before they can take a coin", () => {
  const world = createScavengerWorld();
  const senses = makeSenses({ x: 640, y: 80, z: -820 }, []);
  senses.gold = 500;
  let rushed = false;
  const events = run(world, senses, 400, 10, current => {
    const raider = current.raid && current.agents.find(agent => agent.mode === "raid" && Math.hypot(agent.x - HOARD_SITE.x, agent.z - HOARD_SITE.z) < 120);
    if (raider && !rushed) {
      rushed = true;
      Object.assign(senses.dragon, { x: HOARD_SITE.x, y: 20, z: HOARD_SITE.z });
    }
  });
  assert.ok(rushed, "the raiders got close");
  assert.ok(!events.some(event => event.type === "stole"));
  const over = events.find(event => event.type === "raid_over");
  assert.ok(over && !over.escaped, "the raid was routed");
  // And no raids at all with nothing worth taking, or while you sit on your hoard.
  assert.ok(!run(createScavengerWorld(), makeSenses({ x: 640, y: 80, z: -820 }, [], { gold: 10 }), 300, 5).some(event => event.type === "raid"));
  assert.ok(!run(createScavengerWorld(), makeSenses({ x: HOARD_SITE.x + 60, y: 20, z: HOARD_SITE.z }, [], { gold: 900 }), 300, 5).some(event => event.type === "raid"));
});

test("a manned ballista leads its shots at you; break it or scare its gunner and it falls silent", () => {
  const c = campIndex("rootcellar");
  const { ballista } = campLayouts()[c];
  assert.ok(ballista);
  const world = createScavengerWorld();
  const dragon = { x: ballista.x + 50, y: ballista.y + 30, z: ballista.z + 10, vx: 0, vy: 0, vz: 12 };
  const senses = makeSenses(dragon, []);
  const events = run(world, senses, 12);
  const shots = events.filter(event => event.type === "fire" && event.camp === c);
  assert.ok(shots.length >= 2, `fired ${shots.length}`);
  const shot = shots[0];
  assert.ok(Math.abs(Math.hypot(shot.velocity.x, shot.velocity.y, shot.velocity.z) - SCAV.ballista.speed) < 1e-6);
  assert.ok(shot.velocity.x > 0 && shot.velocity.y > 0, "aimed up at you");
  assert.ok(shot.velocity.z > 0, "leading your flight");
  // Breaking it sends the gunner underground until it is rebuilt.
  const broken = hitBallista(world, c, SCAV.ballista.hp);
  assert.deepEqual(broken.map(event => event.type), ["ballista_broken", "panic"]);
  const after = run(world, senses, SCAV.ballista.rebuild - 5);
  assert.ok(!after.some(event => event.type === "fire" && event.camp === c));
  const rebuilt = run(world, senses, 10);
  assert.ok(rebuilt.some(event => event.type === "ballista_rebuilt" && event.camp === c));
  // Swooping onto the gunner silences it too.
  const fresh = createScavengerWorld();
  run(fresh, makeSenses(dragon, []), 6);
  const gunner = fresh.agents.find(agent => agent.camp === c && agent.role === "gunner");
  assert.equal(gunner.mode, "gunner");
  const swoop = run(fresh, makeSenses({ x: gunner.x + 3, y: gunner.y + 5, z: gunner.z }, []), 3);
  assert.ok(swoop.some(event => event.type === "panic" && event.agent === gunner));
  assert.ok(!swoop.some(event => event.type === "fire" && event.camp === c && swoop.indexOf(event) > swoop.findIndex(item => item.type === "panic")));
});

test("stolen gold is owed by its camp until you win it back, at face value", () => {
  let hoard = { ...emptyHoard(), gold: 300 };
  const theft = stealGold(hoard, "rootcellar", 50);
  assert.equal(theft.taken, 50);
  hoard = theft.hoard;
  assert.equal(hoard.gold, 250);
  assert.deepEqual(hoard.stolen, { rootcellar: 50 });
  assert.equal(stealGold(hoard, "nowhere", 10).taken, 0, "only real camps");
  assert.equal(stealGold({ ...hoard, gold: 7 }, "rootcellar", 50).taken, 7, "never more than you have");
  const sack = { id: "gold_sack_0", name: "Sack of Your Gold", kind: "sack", region: "pyrrhia", value: 50, weight: 1, rarity: "rare", tags: ["gold"], tint: "#ffffff", lore: "", unique: false, perch: "ground", at: [0, 0], stolenFrom: "rootcellar" };
  assert.deepEqual(appraise(sack, "sandwing"), { value: 50, multiplier: 1, favored: false }, "no tribe taste on your own gold");
  assert.deepEqual(parseHoard(JSON.stringify(hoard)), hoard, "the debt survives a reload");
  const won = bankLoot(hoard, sack, "sandwing", 50);
  assert.equal(won.gold, 300);
  assert.deepEqual(won.stolen, {});
  assert.equal(bankLoot(won, sack, "sandwing", 50), won, "a sack cannot be cashed twice");
  assert.deepEqual(parseHoard(JSON.stringify({ ...won, stolen: { rootcellar: 12, nowhere: 5, ashpit: -3, tinkers: "lots" } })).stolen, { rootcellar: 12 });
  assert.equal(raidHaul(0), 0);
  assert.equal(raidHaul(30), 5);
  assert.equal(raidHaul(500), 30);
  assert.equal(raidHaul(1e6), 60);
});
