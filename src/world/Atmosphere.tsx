import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { playerPos } from "../game/runtime";
import { finalizeInstances, renderingBudget } from "../game/rendering";
import { damping } from "../game/flight";
import { device } from "../utils/device";

/** Clouds wrap around the dragon within this square, so they cover a world of any size. */
const CLOUD_SPAN = 640;

function CloudLayer({ follow }: { follow: boolean }) {
  const count = renderingBudget(device).clouds;
  const cloud = useRef<THREE.InstancedMesh>(null);
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => follow ? {
    x: ((i * 263) % CLOUD_SPAN) - CLOUD_SPAN / 2,
    y: 58 + (i * 19 % 46),
    z: ((i * 397) % CLOUD_SPAN) - CLOUD_SPAN / 2,
    scale: 6 + (i * 31 % 11),
  } : {
    x: ((i * 47) % 240) - 120,
    y: 32 + (i * 19 % 28),
    z: ((i * 83) % 260) - 130,
    scale: 5 + (i * 31 % 9),
  }), [count, follow]);
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 10, 7), []);
  const object = useMemo(() => new THREE.Object3D(), []);
  const drift = useRef(0);
  useFrame((_, delta) => {
    if (!cloud.current) return;
    if (!follow) {
      cloud.current.position.x += delta * 0.7;
      if (cloud.current.position.x > 45) cloud.current.position.x = -45;
      return;
    }
    drift.current += delta * 1.2;
    const wrap = (value: number) => ((value % CLOUD_SPAN) + CLOUD_SPAN * 1.5) % CLOUD_SPAN - CLOUD_SPAN / 2;
    particles.forEach((particle, i) => {
      object.position.set(playerPos.x + wrap(particle.x + drift.current - playerPos.x), particle.y, playerPos.z + wrap(particle.z - playerPos.z));
      object.scale.set(particle.scale * 1.8, particle.scale * 0.38, particle.scale);
      object.updateMatrix(); cloud.current?.setMatrixAt(i, object.matrix);
    });
    cloud.current.instanceMatrix.needsUpdate = true;
  });
  useEffect(() => {
    particles.forEach((particle, i) => {
      object.position.set(particle.x, particle.y, particle.z);
      object.scale.set(particle.scale * 1.8, particle.scale * 0.38, particle.scale);
      object.updateMatrix(); cloud.current?.setMatrixAt(i, object.matrix);
    });
    finalizeInstances(cloud.current);
  }, [particles, object]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <instancedMesh ref={cloud} args={[geometry, undefined, count]} frustumCulled={false} renderOrder={-1}>
    <meshBasicMaterial color="#e8edf0" transparent opacity={0.18} depthWrite={false} fog />
  </instancedMesh>;
}

/**
 * Local lighting avoids an external HDR download blocking the entire game scene.
 * Open-world callers pass the current kingdom's mist and sunlight; the change eases in.
 */
export default function Atmosphere({ region = "pyrrhia", mist: mistOverride, sun: sunOverride, fogRange, followClouds = false }: {
  region?: string;
  mist?: string;
  sun?: string;
  fogRange?: readonly [number, number];
  followClouds?: boolean;
}) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const scene = useThree(state => state.scene);
  const mist = mistOverride ?? (region === "pantala" ? "#ddbf91" : region === "glaeryus" ? "#8ba8bf" : "#bacdd0");
  const sunColor = sunOverride ?? (region === "glaeryus" ? "#dae6ff" : "#ffe0b8");
  const [near, far] = fogRange ?? [95, 255];
  // The first color is set directly; later kingdoms fade in over a couple of seconds.
  const [initial] = useState(() => ({ mist, sunColor }));
  const goal = useMemo(() => ({ mist: new THREE.Color(), sun: new THREE.Color() }), []);
  useFrame((_, delta) => {
    goal.mist.set(mist);
    goal.sun.set(sunColor);
    const k = damping(1.4, delta);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.lerp(goal.mist, k);
    if (scene.background instanceof THREE.Color) scene.background.lerp(goal.mist, k);
    if (!sun.current) return;
    sun.current.color.lerp(goal.sun, k);
    // Snap the follow-light to shadow texels rather than shimmer on every tiny move.
    const texel = 90 / renderingBudget(device).shadowMapSize;
    const x = Math.round(playerPos.x / texel) * texel;
    const z = Math.round(playerPos.z / texel) * texel;
    // Follow the dragon's altitude too, so mountain-top shadows stay in the shadow camera.
    const y = Math.round(Math.max(0, playerPos.y - 8) / texel) * texel;
    target.position.set(x, y, z);
    target.updateMatrixWorld();
    sun.current.position.set(x + 35, y + 55, z + 20);
  });
  return <>
    <color attach="background" args={[initial.mist]} />
    <fog attach="fog" args={[initial.mist, near, far]} />
    <Sky sunPosition={[100, 80, 55]} turbidity={5} rayleigh={1.35} />
    <CloudLayer follow={followClouds} />
    <hemisphereLight args={["#d6ecff", "#544d41", 0.82]} />
    <directionalLight
      ref={sun} target={target} castShadow={renderingBudget(device).shadows} position={[35, 55, 20]} intensity={2.15}
      color={initial.sunColor}
      shadow-mapSize={[renderingBudget(device).shadowMapSize, renderingBudget(device).shadowMapSize]}
      shadow-camera-left={-45} shadow-camera-right={45}
      shadow-camera-top={45} shadow-camera-bottom={-45}
      shadow-camera-far={150} shadow-normalBias={0.04}
    />
    <primitive object={target} />
  </>;
}
