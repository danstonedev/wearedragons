import test from "node:test";
import assert from "node:assert/strict";
import {
  RIVALS, RIVAL, createRivalState, stepRival, hitRival, stepDormantRival, lineOfSight, isKin, maxHp, rivalGround,
} from "../src/game/rivals.ts";
import { ROYAL_HOARDS } from "../src/game/worldSites.ts";
import { KINGDOMS, WORLD_BOUNDS, kingdomAt } from "../src/game/world.ts";
import { terrainHeight } from "../src/game/landscape.ts";
import { createVitality, damageVitality, regenerateVitality, reviveVitality, VITALITY } from "../src/game/vitality.ts";

const ground = rivalGround((x, z) => terrainHeight(x, z, "open"));
const byId = id => RIVALS.find(def => def.id === id);

function world(def, player, extra = {}) {
  return {
    player, playerVelocity: { x: 0, y: 0, z: 0 }, playerTribe: "skywing", playerKingdom: kingdomAt(player.x, player.z).id,
    carrying: false, cloaked: false, alarm: false, sees: true, ground, ...extra,
  };
}

function run(def, state, context, seconds, fps = 60) {
  const events = [], shots = [];
  for (let i = 0; i < seconds * fps; i++) {
    const next = stepRival(def, state, typeof context === "function" ? context(state, i) : context, 1 / fps);
    state = next.state;
    events.push(...next.events);
    if (next.shot) shots.push(next.shot);
  }
  return { state, events, shots };
}

test("every kingdom but the home valley has a champion guarding its royal hoard and a patrol", () => {
  assert.equal(new Set(RIVALS.map(def => def.id)).size, RIVALS.length);
  for (const kingdom of KINGDOMS.filter(item => item.id !== "pyrrhia")) {
    const here = RIVALS.filter(def => def.kingdom === kingdom.id);
    const champions = here.filter(def => def.champion);
    assert.equal(champions.length, 1, `${kingdom.id} champion`);
    assert.ok(here.length >= 3, `${kingdom.id} patrol`);
    const hoard = ROYAL_HOARDS[kingdom.id];
    assert.deepEqual(champions[0].home, { x: hoard.x, z: hoard.z });
    for (const def of here) {
      assert.ok(kingdom.tribes.includes(def.tribe), `${def.id} is a ${def.tribe} of ${kingdom.id}`);
      assert.ok(def.home.x - def.radius > WORLD_BOUNDS.minX && def.home.x + def.radius < WORLD_BOUNDS.maxX && def.home.z - def.radius > WORLD_BOUNDS.minZ, def.id);
    }
  }
  assert.ok(isKin(byId("cinder"), "skywing") && !isKin(byId("cinder"), "mudwing"));
  assert.equal(maxHp(byId("cinder")), RIVAL.championHp);
});

test("a rival warns a trespasser, then gives chase; kin and the departed are left alone", () => {
  const def = byId("sedge");
  const start = createRivalState(def, ground);
  const intruder = { x: start.x + 45, y: start.y, z: start.z };
  const warned = run(def, start, world(def, intruder), RIVAL.warnTime + 1.5);
  assert.deepEqual(warned.events.slice(0, 2), ["warn", "engage"]);
  assert.ok(["chase", "windup", "evade"].includes(warned.state.mode));
  const kin = run(def, start, world(def, intruder, { playerTribe: "mudwing" }), 6);
  assert.deepEqual(kin.events, []);
  assert.equal(kin.state.mode, "patrol");
  // Turning back while warned calms it down.
  const once = run(def, start, world(def, intruder), 1).state;
  const left = run(def, once, world(def, { x: -150, y: 40, z: -150 }, { playerKingdom: "pyrrhia", sees: false }), 3);
  assert.ok(left.events.includes("calm"));
  // Unseen (behind a hill, or cloaked), nothing happens.
  assert.deepEqual(run(def, start, world(def, intruder, { cloaked: true }), 3).events, []);
});

test("chasers lead their shots, dodge after firing, and snatch carried treasure up close", () => {
  const def = byId("mirage");
  let state = { ...createRivalState(def, ground), mode: "chase", cooldown: 0 };
  const player = { x: state.x + 20, y: state.y + 2, z: state.z };
  const fired = run(def, state, world(def, player, { playerVelocity: { x: 0, y: 0, z: -10 } }), 1.2);
  assert.ok(fired.events.includes("fire"));
  const [shot] = fired.shots;
  assert.ok(shot.velocity[2] < -2, "aims ahead of a dragon flying north");
  assert.equal(shot.damage, RIVAL.damage);
  assert.ok(fired.events.indexOf("fire") >= 0 && ["evade", "chase"].includes(fired.state.mode));
  state = { ...createRivalState(def, ground), mode: "chase", cooldown: 5 };
  const near = { x: state.x + 3, y: state.y, z: state.z };
  const snatched = run(def, state, s => world(def, { x: s.x + 3, y: s.y, z: s.z }, { carrying: true }), 1);
  assert.ok(snatched.events.includes("snatch"));
  assert.ok(near);
});

test("a rival carries stolen treasure to its royal hoard and stashes it", () => {
  const def = byId("glacier");
  let state = { ...createRivalState(def, ground), mode: "carry", carrying: "glacier_orb" };
  const away = world(def, { x: 0, y: 30, z: 0 }, { sees: false, playerKingdom: "pyrrhia" });
  let stashedAt = null;
  for (let i = 0; i < 60 * 40 && !stashedAt; i++) {
    const next = stepRival(def, state, away, 1 / 60);
    state = next.state;
    if (next.events.includes("stash")) stashedAt = { x: state.x, z: state.z };
  }
  assert.ok(stashedAt, "it reached the hoard");
  assert.equal(state.carrying, null);
  assert.equal(state.mode, "return");
  const hoard = ROYAL_HOARDS.ice;
  assert.ok(Math.hypot(stashedAt.x - hoard.x, stashedAt.z - hoard.z) < 8);
});

test("hits make rivals drop treasure, flee when hurt, yield at zero, and recover later", () => {
  const def = byId("sunstrike");
  const state = { ...createRivalState(def, ground), carrying: "ruby", mode: "carry" };
  let hit = hitRival(def, state, 40);
  assert.deepEqual(hit.events, ["drop"]);
  assert.equal(hit.state.carrying, null);
  assert.ok(hit.state.anger > 0);
  hit = hitRival(def, hit.state, 40);
  assert.ok(hit.events.includes("retreat"));
  hit = hitRival(def, hit.state, 40);
  assert.deepEqual(hit.events, ["downed"]);
  assert.deepEqual(hitRival(def, hit.state, 35).events, [], "a downed rival is left alone");
  const recovered = run(def, hit.state, world(def, { x: 0, y: 30, z: 0 }, { sees: false, playerKingdom: "pyrrhia" }), RIVAL.downedTime + 0.5);
  assert.ok(recovered.events.includes("recover"));
  assert.equal(recovered.state.hp, maxHp(def));
  // A champion does not flee; it fights to the end.
  const champion = byId("cinder");
  let tough = createRivalState(champion, ground);
  for (let i = 0; i < 6; i++) tough = hitRival(champion, tough, 35).state;
  assert.equal(tough.mode, "chase");
});

test("an alerted or angry chaser follows you out of its kingdom, but only so far", () => {
  const def = byId("dune");
  const state = { ...createRivalState(def, ground), mode: "chase", anger: 30 };
  const escaped = run(def, state, s => world(def, { x: def.home.x - 600, y: 60, z: def.home.z }, { playerKingdom: "pyrrhia", sees: false }), 2);
  assert.ok(escaped.events.includes("calm"), "past the leash it turns back");
  const close = run(def, state, s => world(def, { x: s.x + 30, y: s.y, z: s.z }, { playerKingdom: "pyrrhia" }), 2);
  assert.ok(!close.events.includes("calm"), "still angry and you are near: it keeps after you");
});

test("terrain blocks sight, patrols match across frame rates, and far rivals circle cheaply", () => {
  const peak = { x: -130, y: terrainHeight(-130, -560, "open"), z: -560 };
  assert.equal(lineOfSight({ x: peak.x - 120, y: peak.y - 20, z: peak.z }, { x: peak.x + 120, y: peak.y - 20, z: peak.z }, ground), false);
  assert.equal(lineOfSight({ x: 0, y: 200, z: -100 }, { x: 50, y: 200, z: -150 }, ground), true);
  const def = byId("flamewing");
  const away = world(def, { x: 0, y: 30, z: 0 }, { sees: false, playerKingdom: "pyrrhia" });
  const positions = [30, 60, 120].map(fps => run(def, createRivalState(def, ground), away, 8, fps).state);
  for (const state of positions) assert.ok(Math.hypot(state.x - positions[1].x, state.z - positions[1].z) < 3);
  let dormant = createRivalState(def, ground);
  for (let i = 0; i < 100; i++) dormant = stepDormantRival(def, dormant, 0.1, ground);
  assert.ok(Math.abs(Math.hypot(dormant.x - def.home.x, dormant.z - def.home.z) - def.radius) < 1e-6);
  assert.ok(Math.abs(dormant.y - (ground(dormant.x, dormant.z) + def.altitude)) < 1e-6);
});

test("free-flight health: armor softens hits, it refills after a pause, and zero knocks you out", () => {
  let vitality = createVitality();
  let result = damageVitality(vitality, 10, 2, 1);
  assert.equal(result.vitality.hp, VITALITY.max - 5);
  assert.equal(damageVitality(vitality, 10, 1, 1, true).vitality, vitality, "a barrel roll dodges");
  vitality = result.vitality;
  assert.equal(regenerateVitality(vitality, 3, 1), vitality, "no healing mid-fight");
  assert.ok(regenerateVitality(vitality, 7, 1).hp > vitality.hp);
  for (let i = 0; i < 20 && !result.knockedOut; i++) result = damageVitality(result.vitality, 30, 1, 2 + i);
  assert.ok(result.knockedOut && result.vitality.down);
  assert.equal(damageVitality(result.vitality, 30, 1, 40).knockedOut, false, "already down");
  assert.equal(reviveVitality(result.vitality).hp, VITALITY.max);
});
