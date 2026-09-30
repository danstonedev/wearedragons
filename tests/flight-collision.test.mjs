import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { configureFlightController, moveFlightCharacter, PLAYER_GROUPS, PLAYER_CAPSULE, flightMode } from "../src/game/characterMovement.ts";
import { safeMuzzle } from "../src/game/aim.ts";
import { createRequire } from "node:module";
import { dirname } from "node:path";

await RAPIER.init();
test("physics tests resolve the exact Rapier package used by the game", () => {
  const require = createRequire(import.meta.url);
  const gameRequire = createRequire(require.resolve("@react-three/rapier"));
  assert.equal(dirname(require.resolve("@dimforge/rapier3d-compat")), dirname(gameRequire.resolve("@dimforge/rapier3d-compat")));
});
function arena(position = { x: 0, y: 5, z: 10 }) {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(PLAYER_CAPSULE.halfHeight, PLAYER_CAPSULE.radius).setCollisionGroups(PLAYER_GROUPS), body);
  const controller = world.createCharacterController(PLAYER_CAPSULE.offset);
  configureFlightController(controller);
  const obstacle = (x, y, z, hx, hy, hz) => world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z));
  const step = (velocity, fps = 60) => {
    world.timestep = 1 / fps;
    const result = moveFlightCharacter(controller, body, collider, velocity, world.timestep, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    world.step();
    return result;
  };
  return { world, body, controller, obstacle, step };
}

test("flight capsule cannot tunnel through a thin wall even at boosted/extreme speeds", () => {
  for (const fps of [30, 60, 72, 120]) for (const speed of [40, 120, 1000]) {
    const a = arena();
    try {
      a.obstacle(0, 5, 0, 20, 10, 0.1);
      a.world.step();
      for (let i = 0; i < fps; i++) a.step({ x: 0, y: 0, z: -speed }, fps);
      assert.ok(a.body.translation().z >= 0.74, `${speed} at ${fps} Hz crossed the wall`);
      assert.ok(a.body.translation().z < 1);
    } finally { a.world.free(); }
  }
});

test("diagonal flight slides along a wall instead of sticking or crossing it", () => {
  const a = arena({ x: 0, y: 5, z: 1 });
  try {
    a.obstacle(0, 5, 0, 100, 10, 0.1);
    a.world.step();
    for (let i = 0; i < 60; i++) a.step({ x: 10, y: 0, z: -20 });
    assert.ok(a.body.translation().x > 9);
    assert.ok(a.body.translation().z >= 0.74);
  } finally { a.world.free(); }
});

test("landing stops above the floor and positive climb takes off without ground snap", () => {
  const a = arena({ x: 0, y: 5, z: 0 });
  try {
    a.obstacle(0, -0.5, 0, 20, 0.5, 20);
    a.world.step();
    let landed;
    for (let i = 0; i < 60; i++) landed = a.step({ x: 0, y: -60, z: 0 });
    assert.ok(a.body.translation().y >= 1.19);
    assert.ok(a.body.translation().y < 1.25);
    assert.equal(landed.grounded, true);
    for (let i = 0; i < 30; i++) a.step({ x: 0, y: 8, z: 0 });
    assert.ok(a.body.translation().y > 5);
  } finally { a.world.free(); }
});

test("updraft hits a ceiling without crossing it", () => {
  const a = arena({ x: 0, y: 3, z: 0 });
  try {
    a.obstacle(0, 8, 0, 20, 0.2, 20);
    a.world.step();
    for (let i = 0; i < 60; i++) a.step({ x: 0, y: 40, z: 0 });
    assert.ok(a.body.translation().y < 6.66);
    assert.ok(a.body.translation().y > 6.4);
  } finally { a.world.free(); }
});

test("flight ignores sensors and friendly shots while colliding with the world", () => {
  const a = arena();
  try {
    a.obstacle(0, 5, 0, 20, 10, 0.1).setSensor(true);
    const shot = a.world.createCollider(RAPIER.ColliderDesc.ball(2).setTranslation(0, 5, 4).setCollisionGroups((2 << 16) | 1));
    assert.ok(shot);
    a.world.step();
    for (let i = 0; i < 60; i++) a.step({ x: 0, y: 0, z: -20 });
    assert.ok(a.body.translation().z < -9);
  } finally { a.world.free(); }
});

test("flight mode reports grounded, takeoff, landing, dive, cruise and hover", () => {
  assert.equal(flightMode(true, 1.2, { x: 0, y: 0, z: 0 }), "grounded");
  assert.equal(flightMode(true, 1.3, { x: 0, y: 8, z: 0 }), "takeoff");
  assert.equal(flightMode(false, 3, { x: 0, y: -8, z: 0 }), "landing");
  assert.equal(flightMode(false, 20, { x: 0, y: -8, z: 0 }), "dive");
  assert.equal(flightMode(false, 20, { x: 0, y: 0, z: -10 }), "cruise");
  assert.equal(flightMode(false, 20, { x: 0, y: 0, z: 0 }), "hover");
});

test("a corner stops both axes without trapping the dragon when it turns away", () => {
  const a = arena({ x: 5, y: 5, z: 5 });
  try {
    a.obstacle(0, 5, 0, 20, 10, 0.1);
    a.obstacle(0, 5, 0, 0.1, 10, 20);
    a.world.step();
    for (let i = 0; i < 60; i++) a.step({ x: -40, y: 0, z: -40 });
    assert.ok(a.body.translation().x >= 0.74 && a.body.translation().z >= 0.74);
    for (let i = 0; i < 30; i++) a.step({ x: 10, y: 0, z: 10 });
    assert.ok(a.body.translation().x > 5 && a.body.translation().z > 5);
  } finally { a.world.free(); }
});

test("a wall clips the muzzle origin so shots cannot spawn on its far side", () => {
  const a = arena({ x: 0, y: 5, z: 1 });
  try {
    a.obstacle(0, 5, 0, 20, 10, 0.1);
    a.world.step();
    const from = { x: 0, y: 5.4, z: 1 }, desired = { x: 0, y: 6.2, z: -2 };
    const muzzle = safeMuzzle(a.world, new RAPIER.Ray(from, { x: 0, y: 0, z: -1 }), from, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    assert.ok(muzzle.z > 0.1 && muzzle.z < from.z);
  } finally { a.world.free(); }
});

test("unblocked muzzle guidance ignores the player, friendly shots and sensors", () => {
  const a = arena({ x: 0, y: 5, z: 1 });
  try {
    a.obstacle(0, 5, 0, 20, 10, 0.1).setSensor(true);
    a.world.createCollider(RAPIER.ColliderDesc.ball(0.5).setTranslation(0, 5.8, -0.5).setCollisionGroups((2 << 16) | 1));
    a.world.step();
    const from = { x: 0, y: 5.4, z: 1 }, desired = { x: 0, y: 6.2, z: -2 };
    const result = safeMuzzle(a.world, new RAPIER.Ray(from, { x: 0, y: 0, z: -1 }), from, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    assert.ok(Math.abs(result.z - desired.z) < 1e-6);
    assert.ok(Math.abs(result.y - desired.y) < 1e-6);
  } finally { a.world.free(); }
});
