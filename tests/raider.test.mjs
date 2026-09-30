import test from "node:test";
import assert from "node:assert/strict";
import { advanceRaider, createRaiderState, RAIDER_SPAWN } from "../src/game/raider.ts";

const player = { x: -10, y: 8, z: -30 };
const step = (state, seconds, visible = true, fps = 60) => {
  let shots = 0;
  for (let i = 0; i < seconds * fps; i++) {
    const next = advanceRaider(state, player, 1 / fps, visible);
    state = next.state;
    shots += Number(next.fire);
  }
  return { state, shots };
};

test("scout patrols until detection and never drops below clearance", () => {
  const initial = createRaiderState();
  assert.deepEqual(initial.position, RAIDER_SPAWN);
  const far = step(initial, 4, false);
  assert.equal(far.state.phase, "patrol");
  assert.equal(far.shots, 0);
  assert.ok(far.state.position.y >= 12);
  assert.equal(advanceRaider(far.state, player, 1 / 60, true).state.phase, "intercept");
});

test("shot follows a readable windup, then evade and a bounded cooldown", () => {
  let state = { ...createRaiderState(), cooldown: 0, phase: "intercept" };
  ({ state } = advanceRaider(state, player, 1 / 60, true));
  assert.equal(state.phase, "windup");
  const early = step(state, 0.7);
  assert.equal(early.shots, 0);
  assert.equal(early.state.phase, "windup");
  const fired = step(early.state, 0.1);
  assert.equal(fired.shots, 1);
  assert.equal(fired.state.phase, "evade");
  assert.ok(fired.state.cooldown > 1);
  assert.equal(step(fired.state, 1).shots, 0);
});

test("breaking sight during windup cancels fire, including cloak", () => {
  const windup = { ...createRaiderState(), phase: "windup", phaseTime: 0.7, cooldown: 0 };
  const hidden = step(windup, 1, false);
  assert.equal(hidden.shots, 0);
  assert.equal(hidden.state.phase, "patrol");
});

test("close pursuit retreats and combat remains similar at 30/60/120 Hz", () => {
  const close = { ...createRaiderState(), phase: "intercept", position: { x: player.x + 2, y: 14, z: player.z + 2 }, cooldown: 1 };
  assert.equal(advanceRaider(close, player, 1 / 60, true).state.phase, "retreat");
  const samples = [30, 60, 120].map(fps => step(createRaiderState(), 5, true, fps));
  for (const sample of samples) {
    assert.equal(sample.shots, 1);
    assert.ok(sample.state.position.y >= 12);
    assert.ok(Math.hypot(sample.state.position.x - samples[1].state.position.x, sample.state.position.z - samples[1].state.position.z) < 1);
  }
});
