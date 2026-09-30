import test from "node:test";
import assert from "node:assert/strict";
import { MISSIONS, createMissionState } from "../src/game/missions.ts";
import { emptyProgress, parseProgress, recordVictory, nextCampaignMission, dragonMastery } from "../src/game/progression.ts";
import { RACE_ROUTE, gateNormal, crossedRaceGate } from "../src/game/race.ts";

const victory = (mission, hp = 90, time = 35) => ({ ...createMissionState(mission), succeeded: true, playerHp: hp, elapsedTime: time });

test("victories persist independently improving star, health, and time records", () => {
  const mission = MISSIONS[0];
  const initial = recordVictory(emptyProgress(), mission, victory(mission), "skywing");
  const replay = recordVictory(initial, mission, victory(mission, 45, 20), "mudwing");
  assert.equal(initial.missions[mission.id].clears, 1);
  assert.deepEqual(replay.missions[mission.id], {
    stars: 3, bestTime: 20, bestHp: 90, clears: 2, dragonStars: { skywing: 3, mudwing: 2 },
  });
  assert.deepEqual(parseProgress(JSON.stringify(replay)), replay);
});

test("failed, mismatched, or invalid results cannot grant campaign progress", () => {
  const progress = emptyProgress(), mission = MISSIONS[0];
  for (const state of [createMissionState(mission), { ...victory(mission), failed: true }, { ...victory(mission), missionId: "wrong" }, { ...victory(mission), elapsedTime: NaN }]) {
    assert.equal(recordVictory(progress, mission, state, "skywing"), progress);
  }
});

test("campaign chooses the first unfinished chapter and mastery cannot be farmed by replay", () => {
  let progress = emptyProgress();
  assert.equal(nextCampaignMission(progress).id, MISSIONS[0].id);
  // Clearing a later mission does not skip the unfinished earlier chapter.
  progress = recordVictory(progress, MISSIONS[2], victory(MISSIONS[2]), "skywing");
  assert.equal(nextCampaignMission(progress).id, MISSIONS[0].id);
  for (const mission of MISSIONS) {
    progress = recordVictory(progress, mission, victory(mission), "skywing");
    progress = recordVictory(progress, mission, victory(mission), "skywing");
  }
  assert.equal(nextCampaignMission(progress), undefined);
  assert.deepEqual(dragonMastery(progress, "skywing"), { stars: 12, maxStars: 12, rank: "Sky Guardian" });
  assert.equal(dragonMastery(progress, "mudwing").stars, 0);
});

test("damaged saves preserve valid records but reject corrupt records and unknown versions", () => {
  for (const raw of [null, "broken", "null", '{"version":2}', '{"version":1,"missions":[]}']) assert.deepEqual(parseProgress(raw), emptyProgress());
  const good = recordVictory(emptyProgress(), MISSIONS[0], victory(MISSIONS[0]), "skywing");
  const raw = JSON.stringify({ ...good, missions: { ...good.missions, sky_circuit: { stars: 4, clears: -1, bestTime: -2, bestHp: 200 }, unknown: good.missions.beacon_ridge } });
  assert.deepEqual(parseProgress(raw), good);
});

test("fast flight crosses a gate even when both samples lie outside its old trigger sphere", () => {
  const center = { x: 0, y: 8, z: -20 }, normal = gateNormal(0);
  const start = { x: center.x - normal.x * 15, y: center.y - normal.y * 15, z: center.z - normal.z * 15 };
  const end = { x: center.x + normal.x * 15, y: center.y + normal.y * 15, z: center.z + normal.z * 15 };
  assert.equal(crossedRaceGate(start, end, center, normal), true);
  assert.equal(crossedRaceGate(end, start, center, normal), true);
  assert.equal(crossedRaceGate({ ...start, x: 6 }, { ...end, x: 6 }, center, normal), false);
  assert.equal(crossedRaceGate(start, { ...start, x: 1 }, center, normal), false);
});

test("all route gates face their approach, and parallel or stationary motion does not score", () => {
  RACE_ROUTE.forEach((position, index) => {
    const normal = gateNormal(index), center = { x: position[0], y: position[1], z: position[2] };
    assert.ok(Math.abs(Math.hypot(normal.x, normal.y, normal.z) - 1) < 1e-9);
    const before = { x: center.x - normal.x * 2, y: center.y - normal.y * 2, z: center.z - normal.z * 2 };
    const after = { x: center.x + normal.x * 2, y: center.y + normal.y * 2, z: center.z + normal.z * 2 };
    assert.equal(crossedRaceGate(before, after, center, normal), true);
    assert.equal(crossedRaceGate(center, center, center, normal), false);
  });
});
