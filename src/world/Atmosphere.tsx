import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { playerPos } from "../game/runtime";
import { preset } from "../utils/device";

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
