import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DRAGON_BODY_RADIUS, SCAVENGER, floorHeight, isSnoring, lightLevel, stepLairDragon, stepScavenger } from "../game/scavenger";
import type { Circle, LairLoot } from "../game/scavenger";
import { TREASURE_KINDS } from "../game/loot";
import type { TreasureKind } from "../game/loot";
import { gameSession } from "../game/runtime";
import { damping } from "../game/flight";
import { createTreasureMaterial, treasureCenter, treasureGeometry } from "../world/treasureModels";
import LairScene from "./LairScene";
import LairDragon from "./LairDragon";
import ScavengerAvatar from "./ScavengerAvatar";
import { raidActions, raidCamera, raidCue, raidHud, raidKeys, raidTouch } from "./raidState";
import { dropLoot, grabLoot, reachableLoot, sackValue, sackWeight, throwPebble } from "./raidActions";
import type { RaidOutcome, RaidState } from "./raidState";

const TREASURE_SCALE = 1.25;

function RaidLoot({ raid }: { raid: RaidState }) {
  const batches = useMemo(() => {
    const material = createTreasureMaterial();
    const color = new THREE.Color();
    const list: { mesh: THREE.InstancedMesh; members: LairLoot[] }[] = [];
    for (const kind of TREASURE_KINDS) {
      const members = raid.lair.loot.filter(item => item.kind === kind);
      if (!members.length) continue;
      const mesh = new THREE.InstancedMesh(treasureGeometry(kind as TreasureKind), material, members.length);
      mesh.frustumCulled = false;
      members.forEach((item, i) => mesh.setColorAt(i, color.set(item.tint ?? "#ffffff")));
      list.push({ mesh, members });
    }
    return { material, list };
  }, [raid.lair]);
  useEffect(() => () => { batches.list.forEach(batch => batch.mesh.dispose()); batches.material.dispose(); }, [batches]);
  const ring = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(() => ({ dummy: new THREE.Object3D(), zero: new THREE.Matrix4().makeScale(0, 0, 0) }), []);

  useFrame(state => {
    const t = state.clock.elapsedTime;
    const { dummy, zero } = scratch;
    let glowIndex = 0;
    for (const batch of batches.list) {
      batch.members.forEach((item, i) => {
        const spot = raid.floor.get(item.id);
        if (!spot) { batch.mesh.setMatrixAt(i, zero); return; }
        dummy.position.set(spot.x, floorHeight(raid.lair, spot.x, spot.z) + 0.04 + Math.sin(t * 1.8 + i) * 0.03, spot.z);
        dummy.rotation.set(0, t * 0.5 + i * 1.3, 0);
        dummy.scale.setScalar(TREASURE_SCALE * (item.prize ? 1.35 : 1));
        dummy.updateMatrix();
        batch.mesh.setMatrixAt(i, dummy.matrix);
        if (glow.current) {
          dummy.position.y += treasureCenter(item.kind) * TREASURE_SCALE;
          dummy.scale.setScalar((item.prize ? 1.3 : 0.75) * (1 + Math.sin(t * 3 + i) * 0.12));
          dummy.updateMatrix();
          glow.current.setMatrixAt(glowIndex++, dummy.matrix);
        }
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
    if (glow.current) {
      glow.current.count = glowIndex;
      glow.current.instanceMatrix.needsUpdate = true;
    }
    // A pulsing ring marks loot you can grab right now.
    const near = raid.ended ? null : (raidHud.nearLoot ? raid.lair.loot.find(item => item.name === raidHud.nearLoot?.name) : null);
    const spot = near ? raid.floor.get(near.id) : undefined;
    if (ring.current) {
      ring.current.visible = Boolean(spot);
      if (spot) {
        ring.current.position.set(spot.x, floorHeight(raid.lair, spot.x, spot.z) + 0.06, spot.z);
        ring.current.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
        (ring.current.material as THREE.MeshBasicMaterial).color.set(raidHud.nearLoot?.fits ? "#ffe08a" : "#ff7a5c");
      }
    }
  });

  return <>
    {batches.list.map(batch => <primitive key={batch.mesh.uuid} object={batch.mesh} />)}
    <instancedMesh ref={glow} args={[undefined, undefined, raid.lair.loot.length]} count={0} frustumCulled={false}>
      <sphereGeometry args={[0.6, 12, 8]} />
      <meshBasicMaterial color="#ffd27a" transparent opacity={0.13} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </instancedMesh>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.75, 0.92, 32]} />
      <meshBasicMaterial color="#ffe08a" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
    </mesh>
  </>;
}

function Pebbles({ raid }: { raid: RaidState }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!mesh.current) return;
    raid.flying.forEach((pebble, i) => {
      const t = Math.min(1, pebble.age / pebble.duration);
      dummy.position.set(pebble.from.x + (pebble.to.x - pebble.from.x) * t, 1.4 + Math.sin(t * Math.PI) * 2.2 - t * 1.3, pebble.from.z + (pebble.to.z - pebble.from.z) * t);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.count = raid.flying.length;
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, 8]} count={0} frustumCulled={false}>
    <dodecahedronGeometry args={[0.09, 0]} />
    <meshStandardMaterial color="#8d8478" roughness={1} />
  </instancedMesh>;
}

export default function RaidWorld({ raid, onEnd }: { raid: RaidState; onEnd: (outcome: RaidOutcome) => void }) {
  const camera = useThree(state => state.camera);
  const endTimer = useRef(-1);
  const hudTimer = useRef(0);
  const reported = useRef(false);
  const lastSnore = useRef<boolean[]>([]);
  const scratch = useMemo(() => ({ target: new THREE.Vector3(), desired: new THREE.Vector3(), look: new THREE.Vector3() }), []);

  const finish = (outcome: RaidOutcome, delay: number) => {
    if (raid.ended) return;
    raid.ended = outcome;
    endTimer.current = delay;
  };

  // Simulation runs before rendering so the avatar, dragons and camera share one state.
  useFrame((state, frameDelta) => {
    const delta = Math.min(frameDelta, 1 / 15);
    // In VR the headset is the scavenger's head: no orbit camera, no keyboard turning.
    const firstPerson = state.gl.xr.isPresenting;
    if (raid.ended) {
      if (endTimer.current >= 0) {
        endTimer.current -= delta;
        if (endTimer.current < 0 && !reported.current) {
          reported.current = true;
          // Leave the render loop before updating the page's React tree.
          const outcome = raid.ended;
          window.setTimeout(() => onEnd(outcome), 0);
        }
      }
      return;
    }
    if (gameSession.paused) return;
    const lair = raid.lair;
    // Noises queued since the last step (VR grabs, drops, and real footsteps) are heard now, with this step's.

    // Camera-relative movement from keys, arrows, or the touch stick.
    const turn = (raidKeys.arrowleft ? 1 : 0) - (raidKeys.arrowright ? 1 : 0);
    if (!firstPerson) raidCamera.yaw += turn * 2.2 * delta;
    const forward = (raidKeys.w || raidKeys.arrowup ? 1 : 0) - (raidKeys.s || raidKeys.arrowdown ? 1 : 0) - raidTouch.y;
    const strafe = (raidKeys.d ? 1 : 0) - (raidKeys.a ? 1 : 0) + raidTouch.x;
    const yaw = raidCamera.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    raid.sneaking = raidTouch.sneak;
    const input = { x: fx * forward + rx * strafe, z: fz * forward + rz * strafe, sneak: raid.sneaking, sprint: Boolean(raidKeys.shift) || raidTouch.sprint };
    const solids: Circle[] = [...lair.pillars, ...raid.dragons.map(dragon => ({ x: dragon.x, z: dragon.z, r: DRAGON_BODY_RADIUS }))];
    const weight = sackWeight(raid);
    const moved = stepScavenger(raid.player, input, lair, weight, solids, delta);
    raid.player = moved.state;
    raid.gait = moved.gait;
    raid.feet = floorHeight(lair, raid.player.x, raid.player.z);
    if (moved.step) {
      raid.noises.push(moved.step);
      raidCue("step", { gait: moved.gait, radius: moved.step.radius });
    }

    if (raidActions.grab) { raidActions.grab = false; grabLoot(raid); }
    if (raidActions.drop) { raidActions.drop = false; dropLoot(raid); }
    if (raidActions.pebble) { raidActions.pebble = false; throwPebble(raid, firstPerson ? raid.player.facing : yaw); }

    raid.flying = raid.flying.filter(pebble => {
      pebble.age += delta;
      if (pebble.age < pebble.duration) return true;
      raid.noises.push({ ...pebble.to, radius: 11, kind: "pebble" });
      raidCue("plink", { x: pebble.to.x, z: pebble.to.z });
      return false;
    });

    const light = lightLevel(lair, raid.player.x, raid.player.z);
    const context = { player: { x: raid.player.x, z: raid.player.z }, sneaking: raid.sneaking, light, noises: raid.noises, pillars: lair.pillars };
    let caughtBy: string | null = null;
    raid.dragons = raid.dragons.map((dragon, i) => {
      const def = lair.dragons[i];
      const next = stepLairDragon(def, dragon, context, lair, delta);
      for (const event of next.events) {
        if (event === "spot") raid.everSeen = true;
        if (event === "caught") caughtBy ??= def.id;
        else raidCue(event, { name: def.name });
      }
      const snoring = isSnoring(next.state);
      if (snoring && !lastSnore.current[i]) raidCue("snore", { x: next.state.x, z: next.state.z });
      lastSnore.current[i] = snoring;
      return next.state;
    });
    raid.noises = [];

    if (caughtBy) {
      raid.catcher = caughtBy;
      raidCue("caught", { name: lair.dragons.find(dragon => dragon.id === caughtBy)?.name });
      finish({ escaped: false, value: 0, prize: false, ghost: false, caughtBy }, 1.6);
    } else if (Math.hypot(raid.player.x - lair.exit.x, raid.player.z - lair.exit.z) < lair.exit.r * 0.85 && raid.sack.length) {
      raidCue("escape");
      finish({ escaped: true, value: sackValue(raid), prize: raid.sack.some(id => lair.loot.find(item => item.id === id)?.prize), ghost: !raid.everSeen, caughtBy: null }, 0.6);
    }

    hudTimer.current -= delta;
    if (hudTimer.current <= 0) {
      hudTimer.current = 0.1;
      const hunted = raid.dragons.some(dragon => dragon.mode === "chase");
      const seen = raid.dragons.some(dragon => dragon.sees);
      raidHud.status = hunted ? "hunted" : seen ? "seen" : light > 0.38 ? "exposed" : "hidden";
      raidHud.light = light;
      raidHud.px = raid.player.x;
      raidHud.pz = raid.player.z;
      raidHud.value = sackValue(raid);
      raidHud.weight = weight;
      raidHud.sack = raid.sack.map(id => lair.loot.find(item => item.id === id)!).map(item => ({ name: item.name, value: item.value, prize: Boolean(item.prize) }));
      raidHud.pebbles = raid.pebbles;
      raidHud.sneaking = raid.sneaking;
      const near = reachableLoot(raid);
      raidHud.nearLoot = near ? { name: near.name, value: near.value, weight: near.weight, fits: weight + near.weight <= SCAVENGER.capacity } : null;
      raidHud.atExit = Math.hypot(raid.player.x - lair.exit.x, raid.player.z - lair.exit.z) < lair.exit.r * 1.6;
      raidHud.dragons = raid.dragons.map((dragon, i) => ({ id: dragon.id, name: lair.dragons[i].name, tribe: lair.dragons[i].tribe, mode: dragon.mode, suspicion: dragon.suspicion }));
    }
  }, -1);

  // Third-person camera orbiting behind the scavenger, pulled in front of pillars and walls.
  useFrame((state, frameDelta) => {
    if (state.gl.xr.isPresenting) return;
    const delta = Math.min(frameDelta, 1 / 15);
    const { target, desired, look } = scratch;
    const crouch = raid.sneaking ? 0.35 : 0;
    target.set(raid.player.x, raid.feet + 1.45 - crouch, raid.player.z);
    raidCamera.pitch = Math.max(0.05, Math.min(1.15, raidCamera.pitch));
    const yaw = raidCamera.yaw, pitch = raidCamera.pitch;
    let distance = 5.4;
    const lair = raid.lair;
    for (let d = 0.8; d <= distance; d += 0.2) {
      const x = target.x - Math.sin(yaw) * Math.cos(pitch) * d, z = target.z - Math.cos(yaw) * Math.cos(pitch) * d;
      if (Math.hypot(x, z) > lair.radius - 0.8 || lair.pillars.some(pillar => Math.hypot(x - pillar.x, z - pillar.z) < pillar.r + 0.35)) { distance = Math.max(0.8, d - 0.25); break; }
    }
    desired.set(target.x - Math.sin(yaw) * Math.cos(pitch) * distance, target.y + Math.sin(pitch) * distance, target.z - Math.cos(yaw) * Math.cos(pitch) * distance);
    camera.position.lerp(desired, damping(raidCamera.pointer ? 18 : 9, delta));
    look.set(target.x + Math.sin(yaw) * 1.2, target.y - 0.2, target.z + Math.cos(yaw) * 1.2);
    camera.lookAt(look);
  });

  return <>
    <LairScene lair={raid.lair} />
    <ScavengerAvatar raid={raid} />
    {raid.lair.dragons.map((dragon, i) => <LairDragon key={dragon.id} raid={raid} index={i} />)}
    <RaidLoot raid={raid} />
    <Pebbles raid={raid} />
  </>;
}
