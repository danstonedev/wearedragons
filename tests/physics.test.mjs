import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";

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
