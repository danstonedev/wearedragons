import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { playerPos } from "../game/runtime";
import { preset } from "../utils/device";
import { device } from "../utils/device";

function CloudLayer() {
  const count = device === "quest" || device === "mobile" ? 24 : 48;
  const cloud = useRef<THREE.InstancedMesh>(null);
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: ((i * 47) % 240) - 120,
    y: 32 + (i * 19 % 28),
    z: ((i * 83) % 260) - 130,
    scale: 5 + (i * 31 % 9),
  })), [count]);
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 10, 7), []);
  const object = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, delta) => {
    if (!cloud.current) return;
    cloud.current.position.x += delta * 0.7;
    if (cloud.current.position.x > 45) cloud.current.position.x = -45;
  });
  useEffect(() => {
    particles.forEach((particle, i) => {
      object.position.set(particle.x, particle.y, particle.z);
      object.scale.set(particle.scale * 1.8, particle.scale * 0.38, particle.scale);
      object.updateMatrix(); cloud.current?.setMatrixAt(i, object.matrix);
    });
    if (cloud.current) cloud.current.instanceMatrix.needsUpdate = true;
  }, [particles, object]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <instancedMesh ref={cloud} args={[geometry, undefined, count]} frustumCulled={false} renderOrder={-1}>
    <meshBasicMaterial color="#e8edf0" transparent opacity={0.18} depthWrite={false} fog />
  </instancedMesh>;
}

/** Local lighting avoids an external HDR download blocking the entire game scene. */
export default function Atmosphere({ region = "pyrrhia" }: { region?: string }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const mist = region === "pantala" ? "#ddbf91" : region === "glaeryus" ? "#8ba8bf" : "#bacdd0";
  useFrame(() => {
    if (!sun.current) return;
    target.position.set(playerPos.x, 0, playerPos.z);
    target.updateMatrixWorld();
    sun.current.position.set(playerPos.x + 35, 55, playerPos.z + 20);
  });
  return <>
    <color attach="background" args={[mist]} />
    <fog attach="fog" args={[mist, 95, 255]} />
    <Sky sunPosition={[100, 80, 55]} turbidity={5} rayleigh={1.35} />
    <CloudLayer />
    <hemisphereLight args={["#d6ecff", "#544d41", 0.82]} />
    <directionalLight
      ref={sun} target={target} castShadow position={[35, 55, 20]} intensity={2.15}
      color={region === "glaeryus" ? "#dae6ff" : "#ffe0b8"}
      shadow-mapSize={[preset.shadowMapSize, preset.shadowMapSize]}
      shadow-camera-left={-45} shadow-camera-right={45}
      shadow-camera-top={45} shadow-camera-bottom={-45}
      shadow-camera-far={150} shadow-normalBias={0.04}
    />
    <primitive object={target} />
  </>;
}
