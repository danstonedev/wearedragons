import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { AIM_TARGETS } from "../src/game/aim.ts";

await RAPIER.init();
const projectileGroup = (2 << 16) | 1;

test("actual Rapier CCD catches fast projectiles against a watchtower at different step rates", () => {
  for (const fps of [60, 72, 120]) {
    for (const speed of [50, 120, 500, 1000]) {
      const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
      try {
        world.timestep = 1 / fps;
        const tower = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 4, 0));
        world.createCollider(RAPIER.ColliderDesc.cuboid(1.6, 4, 1.6), tower);
        const shot = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 4, 10).setLinvel(0, 0, -speed).setCcdEnabled(true));
        world.createCollider(RAPIER.ColliderDesc.ball(0.3).setCollisionGroups(projectileGroup).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), shot);
        const queue = new RAPIER.EventQueue(true);
        let hit = false;
        for (let step = 0; step < fps; step++) {
          world.step(queue);
          queue.drainCollisionEvents((_, __, started) => { if (started) hit = true; });
        }
        assert.equal(hit, true, `${speed} units/s at ${fps} Hz must hit the tower`);
        queue.free();
      } finally { world.free(); }
    }
  }
});

test("overlapping multi-shot projectiles do not collide with each other", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    const colliders = [0, 1].map(() => {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setLinvel(0, 0, -50));
      return world.createCollider(RAPIER.ColliderDesc.ball(0.5).setCollisionGroups(projectileGroup), body);
    });
    world.step();
    let contact = false;
    world.contactPair(colliders[0], colliders[1], () => { contact = true; });
    assert.equal(contact, false);
  } finally { world.free(); }
});

test("a moving scout is hit by a CCD player shot but never blocks world-only enemy fire", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    world.timestep = 1 / 60;
    const scout = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 18, -30));
    const scoutCollider = world.createCollider(RAPIER.ColliderDesc.ball(1.6).setCollisionGroups((1 << 16) | 2).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), scout);
    const shot = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-8, 18, -30).setLinvel(500, 0, 0).setCcdEnabled(true));
    world.createCollider(RAPIER.ColliderDesc.ball(0.3).setCollisionGroups(projectileGroup).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), shot);
    const queue = new RAPIER.EventQueue(true);
    let hit = false;
    for (let i = 0; i < 4; i++) {
      scout.setNextKinematicTranslation({ x: i * 0.2, y: 18, z: -30 });
      world.step(queue);
      queue.drainCollisionEvents((_, __, started) => { if (started) hit = true; });
    }
    assert.equal(hit, true);
    const ray = new RAPIER.Ray({ x: -6, y: 18, z: -30 }, { x: 1, y: 0, z: 0 });
    assert.equal(world.castRay(ray, 20, true, undefined, (1 << 16) | 1)?.collider.handle, undefined);
    assert.equal(world.castRay(ray, 20, true, undefined, AIM_TARGETS)?.collider.parent()?.bodyType(), RAPIER.RigidBodyType.KinematicPositionBased);
    assert.ok(scoutCollider.isValid());
    queue.free();
  } finally { world.free(); }
});
