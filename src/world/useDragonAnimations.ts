import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface DragonAnimationRig {
  mixer: THREE.AnimationMixer | null;
  actions: Record<string, THREE.AnimationAction>;
}

/** Create a mixer and its actions together, then uncache the whole skeleton on cleanup. */
export function createAnimationRig(root: THREE.Object3D, clips: readonly THREE.AnimationClip[], initial = "Dragon_Flying") {
  const mixer = new THREE.AnimationMixer(root);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const clip of clips) actions[clip.name] = mixer.clipAction(clip);
  (actions[initial] ?? Object.values(actions)[0])?.reset().fadeIn(0.5).play();
  const dispose = () => { mixer.stopAllAction(); mixer.uncacheRoot(root); };
  return { mixer, actions, dispose };
}

/**
 * One mixer per owned skeleton. Actions are created inside the effect, so a dragon swap or
 * React StrictMode's simulated unmount never replays an action whose bindings were uncached
 * (which crashes three's AnimationMixer).
 */
export function useDragonAnimations(root: THREE.Object3D, clips: readonly THREE.AnimationClip[], initial = "Dragon_Flying") {
  const rig = useRef<DragonAnimationRig>({ mixer: null, actions: {} });
  useEffect(() => {
    const created = createAnimationRig(root, clips, initial);
    rig.current = { mixer: created.mixer, actions: created.actions };
    return () => {
      created.dispose();
      if (rig.current.mixer === created.mixer) rig.current = { mixer: null, actions: {} };
    };
  }, [root, clips, initial]);
  useFrame((_, delta) => rig.current.mixer?.update(delta));
  return rig;
}
