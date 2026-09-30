import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { XR, XROrigin, useXR } from "@react-three/xr";
import * as THREE from "three";
import { xrStore } from "./xrStore";
import { readXRControls, controllerEdges } from "../controls/xrControls";
import { gameSession, missionEmitter, playerPos, playerStatus, xrInput, abilityState, resetInput } from "../game/runtime";
import type { MissionRuntimeState, MissionDefinition } from "../game/missions";

export function VRScene(props: { mission?: MissionDefinition; missionState?: MissionRuntimeState }) {
  return <XR store={xrStore}><VRFlightRig {...props} /></XR>;
}

export function VRLaunch() {
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    navigator.xr?.isSessionSupported("immersive-vr").then(value => { if (active) setSupported(value); }).catch(() => {});
    return () => {
      active = false;
      void xrStore.getState().session?.end().catch(() => {});
    };
  }, []);
  if (!supported) return null;
  return <div className="vr-launch">
    <button type="button" onClick={() => {
      setError("");
      resetInput();
      void xrStore.enterVR().catch(() => setError("VR could not start. Check headset permissions and try again."));
    }}>ENTER VR · EXPERIMENTAL</button>
    <span>Left stick: speed · Right stick: climb / snap turn · Right trigger: fire · Left trigger: special · Left grip: brake · Right grip: glide · X: pause · Y: exit</span>
    {error && <span role="alert">{error}</span>}
  </div>;
}

export function VRFlightRig({ mission, missionState }: { mission?: MissionDefinition; missionState?: MissionRuntimeState }) {
  const session = useXR(state => state.session);
  const origin = useRef<THREE.Group>(null);
  const previous = useRef({ special: false, snap: false, pause: false, exit: false });
  const displayElapsed = useRef(-1);
  const panel = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { canvas, texture, context: canvas.getContext("2d")! };
  }, []);
  useEffect(() => () => panel.texture.dispose(), [panel]);
  useEffect(() => {
    if (!session) return;
    previous.current = { special: false, snap: false, pause: false, exit: false };
    resetInput();
    const visibility = () => {
      resetInput();
      if (session.visibilityState !== "visible" && !gameSession.paused) missionEmitter.dispatchEvent(new Event("pause_toggle"));
    };
    session.addEventListener("visibilitychange", visibility);
    return () => { resetInput(); session.removeEventListener("visibilitychange", visibility); };
  }, [session]);

  // Read controllers before the dragon controller samples them.
  useFrame(() => {
    if (!session) return;
    const controls = readXRControls(Array.from(session.inputSources));
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
  }, -2);

  useFrame((state) => {
    if (!session || !origin.current) return;
    // Follow position and yaw only. Head tracking owns view rotation; never copy the dragon's bank/roll.
    const yaw = playerStatus.heading;
    origin.current.position.set(playerPos.x + Math.sin(yaw) * 6, playerPos.y + 0.8, playerPos.z + Math.cos(yaw) * 6);
    origin.current.rotation.set(0, yaw, 0);
    if (state.clock.elapsedTime - displayElapsed.current < 0.1) return;
    displayElapsed.current = state.clock.elapsedTime;
    const ctx = panel.context;
    ctx.clearRect(0, 0, 1024, 256);
    ctx.fillStyle = "rgba(9, 20, 29, .86)";
    ctx.fillRect(0, 0, 1024, 256);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f0deaa";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText(gameSession.paused ? "PAUSED · X: RESUME · Y: EXIT" : `${mission?.name ?? "FREE FLIGHT"} · ${playerStatus.flightMode.toUpperCase()}`, 512, 55);
    const objective = mission?.objectives[missionState?.activeObjectiveIndex ?? 0];
    ctx.fillStyle = "#ffffff";
    ctx.font = "28px sans-serif";
    ctx.fillText(objective ? `${objective.label} · ${missionState?.progress[objective.id] ?? 0}/${objective.requiredCount ?? 1}` : "Explore the regions and discover beacons", 512, 112);
    ctx.fillStyle = "#8ee7c9";
    ctx.fillText(`${missionState ? `HP ${Math.ceil(missionState.playerHp)} · ` : ""}${abilityState.label}: ${abilityState.cooldownLeft > 0 ? `${abilityState.cooldownLeft.toFixed(1)}s` : "READY"}${mission?.timeLimitSeconds ? ` · ${Math.ceil(Math.max(0, mission.timeLimitSeconds - (missionState?.elapsedTime ?? 0)))}s left` : ""}`, 512, 168);
    ctx.fillStyle = "#b7c6d1";
    ctx.font = "23px sans-serif";
    ctx.fillText("Sticks: speed / climb · Triggers: special / fire · Grips: brake / glide", 512, 221);
    panel.texture.needsUpdate = true;
  });
  if (!session) return null;
  return <XROrigin ref={origin}>
    <mesh position={[0, 1.2, -2.6]}>
      <planeGeometry args={[2.7, 0.675]} />
      <meshBasicMaterial map={panel.texture} transparent depthTest={false} toneMapped={false} />
    </mesh>
  </XROrigin>;
}
