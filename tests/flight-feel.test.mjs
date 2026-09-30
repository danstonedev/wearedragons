import test from "node:test";
import assert from "node:assert/strict";
import { flightVelocity } from "../src/game/flight.ts";
import { readXRControls } from "../src/controls/xrControls.ts";
import { joy, xrInput, resetInput } from "../src/game/runtime.ts";

const feel = { glide: false, brake: false, agility: 1, grounded: false };
function simulate(input, options = feel, heading = 0, initial = { x: 0, y: 0, z: -20 }, fps = 60, seconds = 1) {
  let velocity = initial;
  for (let i = 0; i < fps * seconds; i++) velocity = flightVelocity(velocity, input, heading, 20, 0.5, 100, 1 / fps, undefined, options);
  return velocity;
}

test("dives gain horizontal speed and climbs trade speed for altitude", () => {
  const level = simulate({ forward: -1, climb: 0 });
  const dive = simulate({ forward: -1, climb: -1 });
  const climb = simulate({ forward: -1, climb: 1 });
  assert.ok(Math.abs(dive.z) > Math.abs(level.z) + 5);
  assert.ok(Math.abs(climb.z) < Math.abs(level.z) - 3);
  assert.ok(climb.y > 0 && dive.y < 0);
});

test("glide carries momentum and descends; airbrake gives a fast recovery", () => {
  const glide = simulate({ forward: 0, climb: 0 }, { ...feel, glide: true });
  const coast = simulate({ forward: 0, climb: 0 });
  const brake = simulate({ forward: -1, climb: 0 }, { ...feel, glide: true, brake: true });
  assert.ok(Math.abs(glide.z) > 15 && glide.y < -1);
  assert.ok(Math.abs(coast.z) < 1);
  assert.ok(Math.abs(brake.z) < 0.01);
});

test("agile dragons redirect faster while heavy dragons retain turn momentum", () => {
  const heavy = simulate({ forward: -1, climb: 0 }, { ...feel, agility: 0.7 }, Math.PI / 2, undefined, 60, 0.2);
  const agile = simulate({ forward: -1, climb: 0 }, { ...feel, agility: 1.4 }, Math.PI / 2, undefined, 60, 0.2);
  assert.ok(Math.abs(agile.x) > Math.abs(heavy.x));
  assert.ok(Math.abs(heavy.z) > Math.abs(agile.z));
});

test("gliding turns gently, remains grounded-safe, and respects the headset dive cap", () => {
  const glide = simulate({ forward: 0, climb: 0 }, { ...feel, glide: true }, Math.PI / 2);
  assert.ok(glide.x < -5 && glide.z < -3);
  const ground = simulate({ forward: 0, climb: 0 }, { ...feel, grounded: true, glide: true });
  assert.ok(Math.abs(ground.z) < 0.01);
  assert.equal(ground.y, 0);
  const capped = simulate({ forward: -1, climb: -1 }, { ...feel, speedCeiling: 12 }, 0, { x: 0, y: 0, z: -12 });
  assert.ok(Math.abs(capped.z) <= 12.00001);
  const nearGround = flightVelocity({ x: 0, y: -8, z: -20 }, { forward: 0, climb: 0 }, 0, 20, 0.5, 1.21, 1 / 30, undefined, { ...feel, glide: true });
  assert.ok(1.21 + nearGround.y / 30 >= 1.2 - 1e-9);
});

test("flight feel converges across refresh rates and abilities retain vertical priority", () => {
  for (const glide of [false, true]) {
    const velocities = [30, 60, 90, 120].map(fps => simulate({ forward: -1, climb: -0.5 }, { ...feel, glide }, Math.PI / 4, undefined, fps, 2));
    for (const velocity of velocities) {
      assert.ok(Math.abs(velocity.x - velocities[0].x) < 0.15);
      assert.ok(Math.abs(velocity.y - velocities[0].y) < 0.01);
      assert.ok(Math.abs(velocity.z - velocities[0].z) < 0.15);
    }
  }
  const updraft = flightVelocity({ x: 0, y: 0, z: -20 }, { forward: 0, climb: 0 }, 0, 20, 1, 100, 1 / 60, 40, { ...feel, glide: true });
  assert.equal(updraft.y, 40);
});

test("Quest grips control glide/brake independently and session exit clears held modes", () => {
  const pad = { mapping: "xr-standard", axes: [0, 0, 0, -1], buttons: [{ pressed: false }, { pressed: true }] };
  const input = readXRControls([{ handedness: "left", gamepad: pad }, { handedness: "right", gamepad: pad }]);
  assert.equal(input.glide, true);
  assert.equal(input.brake, true);
  assert.equal(input.throttle, 0);
  joy.glide = joy.brake = xrInput.glide = xrInput.brake = true;
  resetInput();
  assert.equal(joy.glide || joy.brake || xrInput.glide || xrInput.brake, false);
});
