import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { XR, XROrigin, useXR } from "@react-three/xr";
import * as THREE from "three";
import { xrStore } from "./xrStore";
import { readXRControls, controllerEdges } from "../controls/xrControls";
import { gameSession, missionEmitter, playerPos, playerStatus, xrInput, abilityState, resetInput, clawInput } from "../game/runtime";
import { damping } from "../game/flight";
import type { MissionRuntimeState, MissionDefinition } from "../game/missions";
import { clawReach, talonAnchor } from "../game/claws";
import type { ClawSide } from "../game/claws";
import { lootHud } from "../game/lootRuntime";
import DragonClaw from "../world/DragonClaw";
import { VRScavengerRig } from "./VRScavenger";
import type { RaidState } from "../scavenger/raidState";

export interface VRClawStyle { color: string; glow: string }
export interface VRSceneProps { mission?: MissionDefinition; missionState?: MissionRuntimeState; claws?: VRClawStyle; scavenger?: RaidState }

export function VRScene(props: VRSceneProps) {
  return <XR store={xrStore}>{props.scavenger ? <VRScavengerRig raid={props.scavenger} /> : <VRFlightRig {...props} />}</XR>;
}

export function VRLaunch({ mode = "flight" }: { mode?: "flight" | "scavenger" }) {
  const [supported, setSupported] = useState(false);
  const [inSession, setInSession] = useState(() => Boolean(xrStore.getState().session));
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    navigator.xr?.isSessionSupported("immersive-vr").then(value => { if (active) setSupported(value); }).catch(() => {});
    const unsubscribe = xrStore.subscribe(state => setInSession(Boolean(state.session)));
    return () => {
      active = false;
      unsubscribe();
      void xrStore.getState().session?.end().catch(() => {});
    };
  }, []);
  if (!supported || inSession) return null;
  // Instructions stay folded away so they never cover the game; the headset shows its own intro card.
  return <div className="vr-launch">
    <button type="button" onClick={() => {
      setError("");
      resetInput();
      void xrStore.enterVR().catch(() => setError("VR could not start. Check headset permissions and try again."));
    }}>ENTER VR · EXPERIMENTAL</button>
    <details className="vr-help">
      <summary aria-label="VR controls" title="VR controls">?</summary>
      <div className="vr-help-body">
        {mode === "scavenger" ? <span>Left stick: walk where you look (click to run) · Right stick: snap turn · Crouch for real to sneak (or B) · Grip: steal loot near your hand · Right trigger: throw a pebble · A: drop · X: pause · Y: exit</span> : <>
          <span>Left stick: speed · Right stick: climb / snap turn · Right trigger: fire · Left trigger: special · Left grip: brake · Right grip: glide · X: pause · Y: exit</span>
          <span>Free flight: reach with your hands to move your dragon's talons, squeeze a grip on treasure to grab it, and let go to drop or throw.</span>
        </>}
      </div>
    </details>
    {error && <span role="alert">{error}</span>}
  </div>;
}

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

export function VRFlightRig({ mission, missionState, claws }: VRSceneProps) {
  const session = useXR(state => state.session);
  const referenceSpace = useXR(state => state.originReferenceSpace);
  const origin = useRef<THREE.Group>(null);
  const previous = useRef({ special: false, snap: false, pause: false, exit: false });
  const displayElapsed = useRef(-1);
  // The controls card shows briefly when VR starts (and on request), then gets out of the way.
  const helpUntil = useRef(0);
  const helpPressed = useRef(false);
  const headPosition = useRef(new THREE.Vector3(0, 1.4, 0));
  const helpMesh = useRef<THREE.Mesh>(null);
  const statusMesh = useRef<THREE.Mesh>(null);
  const hands = useRef({
    left: { position: new THREE.Vector3(), orientation: new THREE.Quaternion(), reach: { x: 0, y: 0, z: 0 }, near: false },
    right: { position: new THREE.Vector3(), orientation: new THREE.Quaternion(), reach: { x: 0, y: 0, z: 0 }, near: false },
  });
  const handGroups = { left: useRef<THREE.Group>(null), right: useRef<THREE.Group>(null) };
  const panels = useMemo(() => {
    const make = (width: number, height: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return { canvas, texture, context: canvas.getContext("2d")! };
    };
    return { help: make(1024, 320), status: make(1024, 256) };
  }, []);
  useEffect(() => () => { panels.help.texture.dispose(); panels.status.texture.dispose(); }, [panels]);
  useEffect(() => {
    if (!session) return;
    previous.current = { special: false, snap: false, pause: false, exit: false };
    helpUntil.current = performance.now() / 1000 + 10;
    resetInput();
    const visibility = () => {
      resetInput();
      if (session.visibilityState !== "visible" && !gameSession.paused) missionEmitter.dispatchEvent(new Event("pause_toggle"));
    };
    // Feel the treasure: a firm pulse on a grab, a cascade when it reaches the hoard.
    const snatched = (event: Event) => pulse(session, (event as CustomEvent<{ side: ClawSide | "both" }>).detail.side ?? "both", 0.75, 70);
    const banked = () => pulse(session, "both", 0.45, 110);
    session.addEventListener("visibilitychange", visibility);
    missionEmitter.addEventListener("loot_snatched", snatched);
    missionEmitter.addEventListener("loot_banked", banked);
    return () => {
      resetInput();
      clawInput.active = clawInput.left.tracked = clawInput.right.tracked = false;
      session.removeEventListener("visibilitychange", visibility);
      missionEmitter.removeEventListener("loot_snatched", snatched);
      missionEmitter.removeEventListener("loot_banked", banked);
    };
  }, [session]);

  // Read controllers before the loot system and the dragon controller sample them.
  useFrame((_, delta, frame?: XRFrame) => {
    if (!session) return;
    const sources = Array.from(session.inputSources);
    const controls = readXRControls(sources);
    const edges = controllerEdges(previous.current, controls);
    if (edges.pause) missionEmitter.dispatchEvent(new Event("pause_toggle"));
    if (edges.exit) void session.end().catch(() => {});
    const enabled = session.visibilityState === "visible" && !gameSession.paused;
    xrInput.throttle = enabled ? controls.throttle : 0;
    xrInput.climb = enabled ? controls.climb : 0;
    xrInput.fire = enabled && controls.fire;
    xrInput.glide = enabled && controls.glide;
    xrInput.brake = enabled && controls.brake;
    xrInput.special = enabled && edges.special;
    xrInput.snapYaw = enabled && edges.snap ? -Math.sign(controls.snap) * Math.PI / 4 : 0;
    previous.current = edges.next;

    const helpButton = sources.some(source => source.handedness === "left" && source.gamepad?.buttons[3]?.pressed);
    if (helpButton && !helpPressed.current) helpUntil.current = performance.now() / 1000 + 8;
    helpPressed.current = helpButton;

    // Each hand steers one hind talon; the sticks keep flying the dragon.
    const viewer = frame && referenceSpace ? frame.getViewerPose(referenceSpace) : undefined;
    if (viewer) headPosition.current.set(viewer.transform.position.x, viewer.transform.position.y, viewer.transform.position.z);
    const head = claws && enabled ? viewer?.transform.position : undefined;
    let tracked = false;
    for (const side of ["left", "right"] as const) {
      const hand = clawInput[side];
      const state = hands.current[side];
      const source = sources.find(item => item.handedness === side && item.gripSpace);
      const pose = head && source?.gripSpace && referenceSpace ? frame?.getPose(source.gripSpace, referenceSpace) : undefined;
      hand.tracked = Boolean(pose);
      hand.grip = hand.tracked && Boolean(source?.gamepad?.buttons[1]?.pressed);
      if (!pose || !head) { Object.assign(hand.velocity, { x: 0, y: 0, z: 0 }); continue; }
      tracked = true;
      const { position, orientation } = pose.transform;
      state.position.set(position.x, position.y, position.z);
      state.orientation.set(orientation.x, orientation.y, orientation.z, orientation.w);
      const reach = clawReach(side, position, head, playerStatus.heading);
      // Throw velocity is the claw's motion relative to the dragon; the dragon's own velocity is added on release.
      const k = damping(20, delta);
      const dt = Math.max(delta, 1 / 120);
      hand.velocity.x += ((reach.x - state.reach.x) / dt - hand.velocity.x) * k;
      hand.velocity.y += ((reach.y - state.reach.y) / dt - hand.velocity.y) * k;
      hand.velocity.z += ((reach.z - state.reach.z) / dt - hand.velocity.z) * k;
      state.reach = reach;
      const anchor = talonAnchor(side, playerPos, playerStatus.heading);
      Object.assign(hand.target, { x: anchor.x + reach.x, y: anchor.y + reach.y, z: anchor.z + reach.z });
      if (hand.near && !state.near) pulse(session, side, 0.15, 25);
      state.near = hand.near;
    }
    clawInput.active = Boolean(claws) && enabled && tracked;
  }, -2);

  useFrame((state) => {
    if (!session || !origin.current) return;
    // Follow position and yaw only. Head tracking owns view rotation; never copy the dragon's bank/roll.
    const yaw = playerStatus.heading;
    origin.current.position.set(playerPos.x + Math.sin(yaw) * 6, playerPos.y + 0.8, playerPos.z + Math.cos(yaw) * 6);
    origin.current.rotation.set(0, yaw, 0);
    for (const side of ["left", "right"] as const) {
      const group = handGroups[side].current;
      if (!group) continue;
      group.visible = clawInput.active && clawInput[side].tracked;
      group.position.copy(hands.current[side].position);
      group.quaternion.copy(hands.current[side].orientation);
    }
    // Place both panels from the head: help just below the line of sight, status low and to the left.
    const headY = headPosition.current.y, headX = headPosition.current.x, headZ = headPosition.current.z;
    const now = performance.now() / 1000;
    const helpVisible = gameSession.paused || now < helpUntil.current;
    const helpFade = gameSession.paused ? 1 : Math.max(0, Math.min(1, helpUntil.current - now));
    if (helpMesh.current) {
      helpMesh.current.visible = helpVisible;
      helpMesh.current.position.set(headX, headY - 0.55, headZ - 2);
      helpMesh.current.rotation.set(-0.25, 0, 0);
      (helpMesh.current.material as THREE.MeshBasicMaterial).opacity = helpFade;
    }
    if (statusMesh.current) {
      statusMesh.current.position.set(headX - 0.62, headY - 0.68, headZ - 1.15);
      statusMesh.current.rotation.set(-0.5, 0.45, 0, "YXZ");
    }
    if (state.clock.elapsedTime - displayElapsed.current < 0.1) return;
    displayElapsed.current = state.clock.elapsedTime;

    const status = panels.status.context;
    status.clearRect(0, 0, 1024, 256);
    status.fillStyle = "rgba(9, 20, 29, .8)";
    status.beginPath(); status.roundRect(0, 0, 1024, 256, 36); status.fill();
    status.textAlign = "left";
    status.fillStyle = "#f0deaa";
    status.font = "bold 46px sans-serif";
    status.fillText(`${mission?.name ?? "FREE FLIGHT"} · ${playerStatus.flightMode.toUpperCase()} · ${playerStatus.speed.toFixed(0)}`, 40, 68, 944);
    const objective = mission?.objectives[missionState?.activeObjectiveIndex ?? 0];
    status.fillStyle = "#ffffff";
    status.font = "38px sans-serif";
    const talons = lootHud.both && lootHud.left ? `Both talons: ${lootHud.left.name}` : `L: ${lootHud.left?.name ?? "empty"} · R: ${lootHud.right?.name ?? "empty"}`;
    status.fillText(objective ? `${objective.label} · ${missionState?.progress[objective.id] ?? 0}/${objective.requiredCount ?? 1}` : claws ? `${talons}${lootHud.left || lootHud.right ? ` · hoard ${Math.round(lootHud.hoardDistance)}m` : ""}` : "Explore and discover beacons", 40, 138, 944);
    status.fillStyle = "#8ee7c9";
    status.fillText(`${missionState ? `HP ${Math.ceil(missionState.playerHp)} · ` : ""}${abilityState.label}: ${abilityState.cooldownLeft > 0 ? `${abilityState.cooldownLeft.toFixed(1)}s` : "READY"}${mission?.timeLimitSeconds ? ` · ${Math.ceil(Math.max(0, mission.timeLimitSeconds - (missionState?.elapsedTime ?? 0)))}s left` : ""}`, 40, 204, 944);
    panels.status.texture.needsUpdate = true;

    if (!helpVisible) return;
    const help = panels.help.context;
    help.clearRect(0, 0, 1024, 320);
    help.fillStyle = "rgba(9, 20, 29, .88)";
    help.beginPath(); help.roundRect(0, 0, 1024, 320, 40); help.fill();
    help.textAlign = "center";
    help.fillStyle = "#f0deaa";
    help.font = "bold 46px sans-serif";
    help.fillText(gameSession.paused ? "PAUSED · X: RESUME · Y: EXIT VR" : "VR CONTROLS", 512, 66);
    help.fillStyle = "#ffffff";
    help.font = "31px sans-serif";
    help.fillText("Left stick: speed · Right stick: climb / snap turn", 512, 124);
    help.fillText("Right trigger: fire · Left trigger: special · Grips: brake / glide", 512, 172);
    help.fillStyle = "#ffd98a";
    help.fillText(claws ? "Reach out to move your talons · squeeze a grip on treasure · let go to throw" : "X: pause · Y: exit VR", 512, 222);
    help.fillStyle = "#9fb3c0";
    help.font = "26px sans-serif";
    help.fillText("Click the left stick to show these controls again", 512, 280);
    panels.help.texture.needsUpdate = true;
  });
  if (!session) return null;
  return <XROrigin ref={origin}>
    <mesh ref={helpMesh} renderOrder={20}>
      <planeGeometry args={[1.5, 0.47]} />
      <meshBasicMaterial map={panels.help.texture} transparent depthTest={false} toneMapped={false} />
    </mesh>
    <mesh ref={statusMesh} renderOrder={19}>
      <planeGeometry args={[0.72, 0.18]} />
      <meshBasicMaterial map={panels.status.texture} transparent toneMapped={false} />
    </mesh>
    {claws && (["left", "right"] as const).map(side => <group key={side} ref={handGroups[side]} visible={false}>
      {/* Your own hands become small dragon claws, pointing forward like the talons they steer. */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <DragonClaw color={claws.color} glowColor={claws.glow} scale={0.32} grip={() => clawInput[side].grip ? 1 : 0} glow={() => clawInput[side].near} />
      </group>
    </group>)}
  </XROrigin>;
}
