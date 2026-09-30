import test from "node:test";
import assert from "node:assert/strict";
import { MISSIONS, createMissionState, advanceObjective, applyDamage, applyHeal, updateMissionTime, completeWave, calculateStars } from "../src/game/missions.ts";
import { damp, flightVelocity, segmentSphereHit, clampInput } from "../src/game/flight.ts";
import { createAbilityState, activateAbility, stepAbility } from "../src/game/abilities.ts";
import { readXRControls, controllerEdges, deadzone } from "../src/controls/xrControls.ts";
import { validateSettings } from "../src/controls/validateSettings.ts";
import { keys, joy, resetInput, xrInput } from "../src/game/runtime.ts";

const raid = MISSIONS.find(m => m.type === "fortress_raid");
const race = MISSIONS.find(m => m.type === "beacon_run");
const siege = MISSIONS.find(m => m.type === "jade_citadel");
const survival = MISSIONS.find(m => m.type === "hunter_ambush");

test("40 simultaneous block events retain all progress and complete the siege", () => {
  const initial = createMissionState(siege);
  const queuedUpdates = Array.from({ length: 40 }, (_, i) => previous => advanceObjective(previous, siege, "smash_blocks", 1, `block_${i}`));
  const result = queuedUpdates.reduce((previous, update) => update(previous), initial);
  assert.equal(result.progress.smash_blocks, 40);
  assert.equal(result.succeeded, true);
  assert.equal(initial.progress.smash_blocks, 0);
});

test("duplicate tower destruction is counted once and the beacon is sequential", () => {
  let state = createMissionState(raid);
  assert.equal(advanceObjective(state, raid, "activate_beacon", 1, "beacon"), state);
  state = advanceObjective(state, raid, "destroy_towers", 1, "tower_0");
  assert.equal(advanceObjective(state, raid, "destroy_towers", 1, "tower_0"), state);
  state = advanceObjective(state, raid, "destroy_towers", 1, "tower_1");
  state = advanceObjective(state, raid, "destroy_towers", 1, "tower_2");
  assert.equal(state.activeObjectiveIndex, 1);
  assert.equal(state.succeeded, false);
  state = advanceObjective(state, raid, "activate_beacon", 1, "beacon");
  assert.equal(state.succeeded, true);
});

test("survival waves cannot advance twice from a duplicate or stale callback", () => {
  let state = createMissionState(survival);
  state = completeWave(state, survival, 0);
  assert.equal(completeWave(state, survival, 0), state);
  state = completeWave(state, survival, 1);
  state = completeWave(state, survival, 2);
  assert.equal(state.waveIndex, 3);
  assert.equal(state.succeeded, true);
});

test("terminal results are frozen against late progress, damage, healing and ticks", () => {
  const failed = applyDamage(createMissionState(raid), 1000);
  assert.equal(applyHeal(failed, 100), failed);
  assert.equal(advanceObjective(failed, raid, "destroy_towers", 3), failed);
  assert.equal(updateMissionTime(failed, raid, 100), failed);
  const won = advanceObjective(createMissionState(race), race, "checkpoints", 8);
  assert.equal(applyDamage(won, 1000), won);
  assert.equal(updateMissionTime(won, race, 200), won);
});

test("timed missions fail at the deadline and reject invalid/backwards time", () => {
  const state = updateMissionTime(createMissionState(race), race, 50);
  assert.equal(updateMissionTime(state, race, NaN), state);
  assert.equal(updateMissionTime(state, race, 40), state);
  assert.equal(updateMissionTime(state, race, 90).failed, true);
});

test("healing is bounded and malformed combat events cannot poison HP", () => {
  const state = applyDamage(createMissionState(raid), 25);
  assert.equal(applyHeal(state, 35).playerHp, 100);
  for (const bad of [NaN, Infinity, -10]) {
    assert.equal(applyDamage(state, bad), state);
    assert.equal(applyHeal(state, bad), state);
  }
});

test("retry starts with fresh progress, health, time and event identities", () => {
  const old = advanceObjective(applyDamage(createMissionState(siege), 30), siege, "smash_blocks", 1, "block_0");
  const retry = createMissionState(siege);
  assert.equal(retry.playerHp, 100);
  assert.equal(retry.elapsedTime, 0);
  assert.equal(retry.progress.smash_blocks, 0);
  assert.deepEqual(retry.processedEventIds, []);
  assert.equal(old.playerHp, 70);
});

test("star ratings honor both time and health thresholds", () => {
  assert.equal(calculateStars({ ...createMissionState(race), elapsedTime: 45 }, race), 3);
  assert.equal(calculateStars({ ...createMissionState(race), elapsedTime: 65 }, race), 2);
  assert.equal(calculateStars({ ...createMissionState(raid), playerHp: 70 }, raid), 3);
  assert.equal(calculateStars({ ...createMissionState(raid), playerHp: 39 }, raid), 1);
});

test("camera/movement damping converges identically at 30, 60, 90 and 120 Hz", () => {
  const results = [30, 60, 90, 120].map(fps => {
    let value = 0;
    for (let frame = 0; frame < fps; frame++) value = damp(value, 20, 7, 1 / fps);
    return value;
  });
  for (const value of results) assert.ok(Math.abs(value - results[0]) < 1e-10);
  assert.equal(damp(0, 20, 7, -1), 0);
});

test("flight accelerates and brakes smoothly instead of snapping velocity", () => {
  const first = flightVelocity({ x: 0, y: 0, z: 0 }, { forward: -1, climb: 0 }, 0, 20, 0.5, 100, 1 / 60);
  assert.ok(first.z < 0 && first.z > -20);
  const brake = flightVelocity({ x: 0, y: 0, z: -20 }, { forward: 0, climb: 0 }, 0, 20, 0.5, 100, 1 / 60);
  assert.ok(brake.z < 0 && brake.z > -20);
});

test("fast diving respects ground clearance for the next integration step", () => {
  for (const fps of [30, 60, 90, 120]) {
    const altitude = 1.25;
    const velocity = flightVelocity({ x: 0, y: -60, z: 0 }, { forward: 0, climb: -1 }, 0, 30, 1, altitude, 1 / fps, -60);
    assert.ok(altitude + velocity.y / fps >= 1.2 - 1e-10);
  }
});

test("slam and updraft override ordinary movement until their effects finish", () => {
  const state = createAbilityState();
  assert.equal(activateAbility(state, { type: "updraft", cooldown: 4, duration: 0, label: "GUST" }), true);
  stepAbility(state, 1 / 60, false);
  assert.equal(state.type, "updraft");
  const velocity = flightVelocity({ x: 0, y: 0, z: 0 }, { forward: 0, climb: 0 }, 0, 20, 1, 10, 1 / 60, 40);
  assert.equal(velocity.y, 40);
  assert.equal(activateAbility(state, { type: "updraft", cooldown: 4, duration: 0, label: "GUST" }), false);
});

test("ground slam emits a landing impact exactly once", () => {
  const state = createAbilityState();
  activateAbility(state, { type: "ground_slam", cooldown: 6, duration: 0, label: "SLAM" });
  assert.equal(stepAbility(state, 0.1, false), false);
  assert.equal(stepAbility(state, 0.1, true), true);
  assert.equal(stepAbility(state, 0.1, true), false);
  assert.equal(state.type, null);
});

test("a projectile crossing the player between sampled positions still hits", () => {
  assert.equal(segmentSphereHit({ x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 2), 0.4);
  assert.equal(segmentSphereHit({ x: -10, y: 3, z: 0 }, { x: 10, y: 3, z: 0 }, { x: 0, y: 0, z: 0 }, 2), null);
});

test("relative swept hits include a player crossing a stationary projectile", () => {
  assert.equal(segmentSphereHit({ x: 5, y: 0, z: 0 }, { x: -5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1), 0.4);
  assert.equal(segmentSphereHit({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1), 0);
});

const defaults = { scheme: "joystick", turnSensitivity: 1, climbSensitivity: 0.5, speedSensitivity: 1 };
test("corrupt settings are ignored and valid sensitivities are clamped", () => {
  assert.deepEqual(validateSettings(null, defaults), defaults);
  assert.deepEqual(validateSettings([], defaults), defaults);
  const result = validateSettings({ scheme: "broken", turnSensitivity: NaN, climbSensitivity: -500, speedSensitivity: 500, extra: true }, defaults);
  assert.deepEqual(result, { ...defaults, climbSensitivity: 0.2, speedSensitivity: 2 });
});

function controller(handedness, axes, pressed = []) {
  return { handedness, gamepad: { mapping: "xr-standard", axes, buttons: Array.from({ length: 6 }, (_, index) => ({ pressed: pressed.includes(index) })) } };
}
test("Quest sticks/triggers map to flight, snap-turn and specials", () => {
  const input = readXRControls([controller("left", [0, 0, 0, -1], [0]), controller("right", [0, 0, 1, -1], [0])]);
  assert.equal(input.throttle, 1);
  assert.equal(input.climb, 1);
  assert.equal(input.snap, 1);
  assert.equal(input.fire, true);
  assert.equal(input.special, true);
});

test("Quest grip brakes; disconnected or unsupported controllers yield neutral input", () => {
  assert.equal(readXRControls([controller("left", [0, 0, 0, -1], [1])]).throttle, 0);
  assert.equal(readXRControls([{ handedness: "left", gamepad: null }]).throttle, 0);
  const unknown = controller("left", [0, 0, 0, -1]);
  unknown.gamepad.mapping = "";
  assert.equal(readXRControls([unknown]).throttle, 0);
  assert.equal(deadzone(0.15), 0);
  assert.equal(deadzone(NaN), 0);
  assert.equal(clampInput(20), 1);
});

test("held VR special/snap/pause inputs trigger once, then rearm on release", () => {
  let previous = { special: false, snap: false, pause: false, exit: false };
  const held = readXRControls([controller("left", [0, 0, 0, 0], [0, 4]), controller("right", [0, 0, 1, 0])]);
  let edges = controllerEdges(previous, held);
  assert.equal(edges.special, true);
  assert.equal(edges.snap, true);
  assert.equal(edges.pause, true);
  edges = controllerEdges(edges.next, held);
  assert.equal(edges.special, false);
  assert.equal(edges.snap, false);
  previous = controllerEdges(edges.next, readXRControls([])).next;
  assert.equal(controllerEdges(previous, held).special, true);
});

test("session exit clears keyboard, touch and VR input", () => {
  keys.f = true; keys.w = true;
  joy.fire = true; joy.special = true; joy.throttle = 1;
  xrInput.fire = true; xrInput.snapYaw = 1;
  resetInput();
  assert.deepEqual(keys, {});
  assert.equal(joy.fire, false);
  assert.equal(joy.special, false);
  assert.equal(joy.throttle, 0);
  assert.equal(xrInput.fire, false);
  assert.equal(xrInput.snapYaw, 0);
});
