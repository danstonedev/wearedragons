import test from "node:test";
import assert from "node:assert/strict";
import { CLAW_REACH, FOOT_REST, clawReach, rotateY, talonAnchor } from "../src/game/claws.ts";
import { clawInput, resetInput } from "../src/game/runtime.ts";

const head = { x: 0.1, y: 1.6, z: 0.05 };
const neutral = side => ({ x: head.x + (side === "left" ? -1 : 1) * CLAW_REACH.neutral.side, y: head.y - CLAW_REACH.neutral.down, z: head.z - CLAW_REACH.neutral.forward });
const close = (a, b, epsilon = 1e-9) => Math.abs(a - b) < epsilon;

test("relaxed hands leave both talons at rest, whether seated or standing", () => {
  for (const side of ["left", "right"]) {
    assert.deepEqual(clawReach(side, neutral(side), head, 0.7), { x: 0, y: 0, z: 0 });
    const seatedHead = { ...head, y: 1.1 };
    const seatedHand = { ...neutral(side), y: neutral(side).y - 0.5 };
    assert.deepEqual(clawReach(side, { ...seatedHand, x: seatedHand.x + 0.01 }, seatedHead, 0), clawReach(side, { ...neutral(side), x: neutral(side).x + 0.01 }, head, 0));
  }
});

test("reaching forward and down moves the talon forward and down along the dragon's heading", () => {
  const hand = neutral("right");
  const forward = clawReach("right", { ...hand, z: hand.z - 0.3 }, head, 0);
  assert.ok(forward.z < -0.7 && close(forward.x, 0) && close(forward.y, 0));
  const down = clawReach("right", { ...hand, y: hand.y - 0.3 }, head, 0);
  assert.ok(down.y < -0.7);
  // Turned 90 degrees left (heading +pi/2), the dragon's forward is world -X.
  const turned = clawReach("right", { ...hand, z: hand.z - 0.3 }, head, Math.PI / 2);
  assert.ok(turned.x < -0.7 && close(turned.z, 0));
});

test("talon travel is magnified but capped, and bad tracking data is ignored", () => {
  const hand = neutral("left");
  const far = clawReach("left", { x: hand.x - 3, y: hand.y - 3, z: hand.z - 3 }, head, 1.2);
  assert.ok(close(Math.hypot(far.x, far.y, far.z), CLAW_REACH.maxReach, 1e-6));
  const small = clawReach("left", { ...hand, z: hand.z - 0.2 }, head, 0);
  assert.ok(close(Math.hypot(small.x, small.y, small.z), (0.2 - CLAW_REACH.deadzone) * CLAW_REACH.gain, 1e-6));
  assert.deepEqual(clawReach("left", { x: NaN, y: 0, z: 0 }, head, 0), { x: 0, y: 0, z: 0 });
});

test("talon anchors follow the body and heading on the correct sides", () => {
  const body = { x: 10, y: 5, z: -4 };
  const left = talonAnchor("left", body, 0), right = talonAnchor("right", body, 0);
  assert.ok(left.x < body.x && right.x > body.x);
  assert.ok(close(left.y, body.y + FOOT_REST.left.y));
  const turned = talonAnchor("left", body, Math.PI);
  assert.ok(turned.x > body.x, "facing +Z, the left foot is on +X");
  assert.ok(close(rotateY({ x: 0, y: 0, z: -1 }, Math.PI / 2).x, -1));
});

test("leaving VR or pausing releases both claw grips", () => {
  clawInput.left.grip = clawInput.right.grip = true;
  resetInput();
  assert.equal(clawInput.left.grip || clawInput.right.grip, false);
});
