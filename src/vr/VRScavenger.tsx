import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { XROrigin, useXR } from "@react-three/xr";
import * as THREE from "three";
import { deadzone } from "../controls/xrControls";
import { gameSession, missionEmitter } from "../game/runtime";
import { DRAGON_BODY_RADIUS, SCAVENGER, floorHeight, resolveCollisions } from "../game/scavenger";
import type { LairLoot } from "../game/scavenger";
import { treasureCenter } from "../world/treasureModels";
import { raidCamera, raidEmitter, raidHud, raidTouch, resetRaidInput } from "../scavenger/raidState";
import type { RaidCue, RaidState } from "../scavenger/raidState";
import { dropLoot, grabLoot, throwPebble } from "../scavenger/raidActions";

type ClawSide = "left" | "right";
type HapticPad = Gamepad & { hapticActuators?: readonly { pulse?: (value: number, duration: number) => unknown }[] };

function pulse(session: XRSession, side: ClawSide | "both", intensity: number, milliseconds: number) {
  for (const source of session.inputSources) {
    if (side !== "both" && source.handedness !== side) continue;
    try {
      const result = (source.gamepad as HapticPad | null)?.hapticActuators?.[0]?.pulse?.(intensity, milliseconds);
      if (result instanceof Promise) result.catch(() => {});
    } catch { /* Haptics are optional. */ }
  }
}

const STATUS_COLORS = { hidden: "#8fe3a8", exposed: "#ffd27a", seen: "#ffa040", hunted: "#ff5a46" } as const;
const MODE_TEXT: Record<string, string> = { asleep: "Zz", stirring: "?", patrol: "watching", investigate: "?!", chase: "CHASING", search: "searching", returning: "settling" };

/**
 * First-person raid at human scale. The stick walks where you look, real crouching sneaks,
 * your hands grab loot, and the trigger throws a pebble where your hand points.
 */
export function VRScavengerRig({ raid }: { raid: RaidState }) {
  const session = useXR(state => state.session);
  const referenceSpace = useXR(state => state.originReferenceSpace);
  const origin = useRef<THREE.Group>(null);
  // The headset looks down its local -Z, so a forward-facing head faces origin yaw + PI.
  const yaw = useRef(raid.lair.start.yaw + Math.PI);
  const lastHead = useRef<{ x: number; z: number } | null>(null);
  const standing = useRef(1.5);
  const manualSneak = useRef(false);
  const previous = useRef({ snap: false, pause: false, exit: false, trigger: false, drop: false, sneak: false, left: false, right: false });
  const hands = useRef({
    left: { position: new THREE.Vector3(), orientation: new THREE.Quaternion(), tracked: false, grip: false },
    right: { position: new THREE.Vector3(), orientation: new THREE.Quaternion(), tracked: false, grip: false },
  });
  const leftHand = useRef<THREE.Group>(null);
  const rightHand = useRef<THREE.Group>(null);
  const scratch = useMemo(() => ({ world: new THREE.Vector3(), forward: new THREE.Vector3(), quat: new THREE.Quaternion() }), []);
  const panel = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 320;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { canvas, texture, context: canvas.getContext("2d")! };
  }, []);
  const panelTimer = useRef(0);
  useEffect(() => () => panel.texture.dispose(), [panel]);

  useEffect(() => {
    if (!session) return;
    resetRaidInput();
    lastHead.current = null;
    yaw.current = raid.player.facing + Math.PI;
    const visibility = () => {
      resetRaidInput();
      if (session.visibilityState !== "visible" && !gameSession.paused) missionEmitter.dispatchEvent(new Event("pause_toggle"));
    };
    const cue = (event: Event) => {
      const { cue: name } = (event as CustomEvent<{ cue: RaidCue }>).detail;
      if (name === "grab") pulse(session, "both", 0.5, 60);
      if (name === "stir" || name === "wake") pulse(session, "both", 0.35, 120);
      if (name === "spot") pulse(session, "both", 0.9, 220);
      if (name === "caught") pulse(session, "both", 1, 450);
    };
    session.addEventListener("visibilitychange", visibility);
    raidEmitter.addEventListener("cue", cue);
    return () => {
      resetRaidInput();
      // A crouch in the headset should not leave the desktop raid stuck sneaking.
      raidTouch.sneak = false;
      session.removeEventListener("visibilitychange", visibility);
      raidEmitter.removeEventListener("cue", cue);
    };
  }, [session, raid]);

  /** Loot closest to a hand (3D), or, reaching low, the closest within arm's length of the body. */
  const lootForHand = (hand: THREE.Vector3): LairLoot | null => {
    let best: LairLoot | null = null, bestDistance = 0.85;
    for (const item of raid.lair.loot) {
      const spot = raid.floor.get(item.id);
      if (!spot) continue;
      const y = floorHeight(raid.lair, spot.x, spot.z) + treasureCenter(item.kind) * 1.25;
      const distance = Math.hypot(hand.x - spot.x, hand.y - y, hand.z - spot.z);
      if (distance < bestDistance) { best = item; bestDistance = distance; }
    }
    if (best || hand.y - raid.feet > 1.05) return best;
    // Reach-down assist for seated players: a lowered hand grabs loot at your feet.
    for (const item of raid.lair.loot) {
      const spot = raid.floor.get(item.id);
      if (!spot) continue;
      const distance = Math.hypot(spot.x - raid.player.x, spot.z - raid.player.z);
      if (distance < SCAVENGER.grabRadius && (!best || distance < bestDistance)) { best = item; bestDistance = distance; }
    }
    return best;
  };

  useFrame((_, delta, frame?: XRFrame) => {
    if (!session || !origin.current) return;
    const sources = Array.from(session.inputSources);
    const left = sources.find(source => source.handedness === "left")?.gamepad;
    const right = sources.find(source => source.handedness === "right")?.gamepad;
    const pressed = (pad: Gamepad | null | undefined, index: number) => Boolean(pad?.buttons[index]?.pressed);
    const now = {
      snap: Math.abs(deadzone(right?.axes[2] ?? 0, 0.6)) > 0, pause: pressed(left, 4), exit: pressed(left, 5),
      trigger: pressed(right, 0), drop: pressed(right, 4), sneak: pressed(right, 5), left: pressed(left, 1), right: pressed(right, 1),
    };
    const edge = (key: keyof typeof now) => now[key] && !previous.current[key];
    if (edge("pause")) missionEmitter.dispatchEvent(new Event("pause_toggle"));
    if (edge("exit")) void session.end().catch(() => {});
    const active = session.visibilityState === "visible" && !gameSession.paused && !raid.ended;

    const viewer = frame && referenceSpace ? frame.getViewerPose(referenceSpace) : undefined;
    const head = viewer?.transform.position;
    const view = viewer?.transform.orientation;
    if (head && view) {
      standing.current = Math.max(standing.current * (1 - 0.02 * delta), head.y, 1.1);
      // Real-world steps move the scavenger too, but never through pillars or dragons.
      if (lastHead.current && active) {
        const dx = head.x - lastHead.current.x, dz = head.z - lastHead.current.z;
        const cos = Math.cos(yaw.current), sin = Math.sin(yaw.current);
        const solids = [...raid.lair.pillars, ...raid.dragons.map(dragon => ({ x: dragon.x, z: dragon.z, r: DRAGON_BODY_RADIUS }))];
        const moved = resolveCollisions(raid.player.x + dx * cos + dz * sin, raid.player.z - dx * sin + dz * cos, SCAVENGER.radius, solids, raid.lair.radius);
        raid.player = { ...raid.player, x: moved.x, z: moved.z };
      }
      lastHead.current = { x: head.x, z: head.z };
      scratch.forward.set(0, 0, -1).applyQuaternion(scratch.quat.set(view.x, view.y, view.z, view.w));
      raidCamera.yaw = yaw.current + Math.atan2(scratch.forward.x, scratch.forward.z);
    }

    if (edge("snap") && active) yaw.current -= Math.sign(right?.axes[2] ?? 0) * Math.PI / 4;
    if (edge("sneak")) manualSneak.current = !manualSneak.current;
    const crouched = Boolean(head && head.y < standing.current * 0.72);
    raidTouch.sneak = crouched || manualSneak.current;
    raidTouch.x = active ? deadzone(left?.axes[2] ?? 0) : 0;
    raidTouch.y = active ? deadzone(left?.axes[3] ?? 0) : 0;
    raidTouch.sprint = active && pressed(left, 3);

    // Keep the head over the simulated scavenger, standing on the floor (or the hoard mound).
    const cos = Math.cos(yaw.current), sin = Math.sin(yaw.current);
    const hx = head?.x ?? 0, hz = head?.z ?? 0;
    origin.current.position.set(raid.player.x - (hx * cos + hz * sin), raid.feet, raid.player.z - (-hx * sin + hz * cos));
    origin.current.rotation.set(0, yaw.current, 0);
    origin.current.updateMatrixWorld();

    for (const side of ["left", "right"] as const) {
      const state = hands.current[side];
      const source = sources.find(item => item.handedness === side && item.gripSpace);
      const pose = source?.gripSpace && referenceSpace ? frame?.getPose(source.gripSpace, referenceSpace) : undefined;
      state.tracked = Boolean(pose);
      state.grip = now[side];
      if (!pose) continue;
      state.position.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
      state.orientation.set(pose.transform.orientation.x, pose.transform.orientation.y, pose.transform.orientation.z, pose.transform.orientation.w);
      if (active && edge(side)) {
        const item = lootForHand(scratch.world.copy(state.position).applyMatrix4(origin.current.matrixWorld));
        if (item && grabLoot(raid, item)) pulse(session, side, 0.7, 70);
      }
    }
    if (active && edge("trigger") && hands.current.right.tracked) {
      // Throw where the right hand points.
      scratch.forward.set(0, 0, -1).applyQuaternion(scratch.quat.copy(hands.current.right.orientation));
      throwPebble(raid, yaw.current + Math.atan2(scratch.forward.x, scratch.forward.z));
    }
    if (active && edge("drop")) dropLoot(raid);
    previous.current = now;

    for (const [group, state] of [[leftHand.current, hands.current.left], [rightHand.current, hands.current.right]] as const) {
      if (!group) continue;
      group.visible = state.tracked;
      group.position.copy(state.position);
      group.quaternion.copy(state.orientation);
      group.scale.set(1, state.grip ? 0.75 : 1, 1);
    }

    panelTimer.current -= delta;
    if (panelTimer.current > 0) return;
    panelTimer.current = 0.15;
    const ctx = panel.context;
    ctx.clearRect(0, 0, 512, 320);
    ctx.fillStyle = "rgba(14, 10, 5, 0.9)";
    ctx.fillRect(0, 0, 512, 320);
    ctx.textAlign = "center";
    ctx.fillStyle = STATUS_COLORS[raidHud.status];
    ctx.font = "bold 58px sans-serif";
    ctx.fillText(gameSession.paused ? "PAUSED" : raidHud.status.toUpperCase(), 256, 70);
    ctx.fillStyle = "#ffd98a";
    ctx.font = "bold 34px sans-serif";
    ctx.fillText(`${raidHud.value} gold · weight ${raidHud.weight}/${SCAVENGER.capacity}`, 256, 130);
    ctx.fillStyle = "#e9dcc4";
    ctx.font = "28px sans-serif";
    ctx.fillText(`Pebbles ${raidHud.pebbles}${raidTouch.sneak ? " · sneaking" : ""}`, 256, 180);
    ctx.font = "26px sans-serif";
    ctx.fillText(raidHud.dragons.map(dragon => `${dragon.name}: ${MODE_TEXT[dragon.mode] ?? dragon.mode}`).join(" · "), 256, 232, 490);
    ctx.fillStyle = "#b7a98f";
    ctx.font = "22px sans-serif";
    ctx.fillText(raidHud.sack.length ? "Escape down the glowing burrow!" : "Crouch to sneak · grip to steal · trigger: pebble", 256, 288, 490);
    panel.texture.needsUpdate = true;
  }, -2);

  if (!session) return null;
  return <XROrigin ref={origin}>
    {/* Eyes adjusted to the dark: a soft fill around you that dragons cannot see. */}
    <pointLight position={[0, 2.2, -0.6]} color="#9fb0d0" intensity={2.6} distance={8} decay={1.4} />
    <group ref={leftHand} visible={false}>
      <mesh position={[0, 0, 0.02]}><sphereGeometry args={[0.045, 12, 10]} /><meshStandardMaterial color="#6b4a2b" roughness={0.9} /></mesh>
      <mesh position={[0, -0.01, -0.05]}><boxGeometry args={[0.07, 0.025, 0.08]} /><meshStandardMaterial color="#6b4a2b" roughness={0.9} /></mesh>
      {/* Wrist panel: glance at your left hand to check how well hidden you are. */}
      <mesh position={[0, 0.06, 0.06]} rotation={[-1.1, 0, 0]}>
        <planeGeometry args={[0.2, 0.125]} />
        <meshBasicMaterial map={panel.texture} toneMapped={false} />
      </mesh>
    </group>
    <group ref={rightHand} visible={false}>
      <mesh position={[0, 0, 0.02]}><sphereGeometry args={[0.045, 12, 10]} /><meshStandardMaterial color="#6b4a2b" roughness={0.9} /></mesh>
      <mesh position={[0, -0.01, -0.05]}><boxGeometry args={[0.07, 0.025, 0.08]} /><meshStandardMaterial color="#6b4a2b" roughness={0.9} /></mesh>
    </group>
  </XROrigin>;
}
