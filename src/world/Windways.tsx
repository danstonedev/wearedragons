import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { gameSession, playerPos, windState } from "../game/runtime";
import { lootToast } from "../game/lootRuntime";
import { WINDWAYS, windAt, windwaySamples } from "../game/windways";
import { createWindMaterial } from "./landmarks/shaders";

/** VR flight is gentler: the currents push less hard in the headset. */
const VR_WIND = 0.6;

/** The windways' streaming air, and the wind system that pushes the dragon each frame. */
export default function Windways() {
  const tubes = useMemo(() => windwaySamples().map(samples => {
    const curve = new THREE.CatmullRomCurve3(samples.map(sample => new THREE.Vector3(sample.x, sample.y, sample.z)), true);
    const geometry = new THREE.TubeGeometry(curve, samples.length, 3.2, 6, true);
    const material = createWindMaterial(Math.round(curve.getLength() / 14));
    return { geometry, material };
  }), []);
  useEffect(() => () => tubes.forEach(tube => { tube.geometry.dispose(); tube.material.dispose(); }), [tubes]);
  const riding = useRef(-1);

  // Before the dragon moves: what does the air do here?
  useFrame(state => {
    if (gameSession.paused) {
      Object.assign(windState, { x: 0, y: 0, z: 0, windway: -1, strength: 0 });
      return;
    }
    windAt(playerPos.x, playerPos.y, playerPos.z, windState);
    if (state.gl.xr.isPresenting) { windState.x *= VR_WIND; windState.y *= VR_WIND; windState.z *= VR_WIND; }
    // Announce a current once on entry; leaving its edge and drifting back in is not news.
    if (riding.current >= 0 && windState.windway < 0) riding.current = -1;
    if (windState.windway >= 0 && windState.windway !== riding.current && windState.strength > 8) {
      riding.current = windState.windway;
      lootToast(`Riding ${WINDWAYS[windState.windway].name}!`, "info");
    }
  }, -1);
  useEffect(() => () => { Object.assign(windState, { x: 0, y: 0, z: 0, windway: -1, strength: 0 }); }, []);

  return <>
    {tubes.map((tube, i) => <mesh key={i} geometry={tube.geometry} material={tube.material} renderOrder={5} frustumCulled />)}
  </>;
}
