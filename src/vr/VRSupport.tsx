import { useEffect, useState } from "react";
import type { VRSceneProps } from "./VRFlight";

type VRRuntime = typeof import("./VRFlight");
let runtimePromise: Promise<VRRuntime | null> | undefined;

function loadRuntime() {
  // Desktop browsers do not need to download the immersive runtime.
  runtimePromise ??= (async () => {
    if (!navigator.xr || !await navigator.xr.isSessionSupported("immersive-vr")) return null;
    return import("./VRFlight");
  })().catch(() => null);
  return runtimePromise;
}

function useVRRuntime() {
  const [runtime, setRuntime] = useState<VRRuntime | null>(null);
  useEffect(() => {
    let active = true;
    void loadRuntime().then(value => { if (active) setRuntime(value); });
    return () => { active = false; };
  }, []);
  return runtime;
}

export function VRLaunch({ mode = "flight" }: { mode?: "flight" | "scavenger" }) {
  const runtime = useVRRuntime();
  return runtime ? <runtime.VRLaunch mode={mode} /> : null;
}

export function VRScene(props: VRSceneProps) {
  const runtime = useVRRuntime();
  // This sibling mounts independently; loading XR cannot reset an active world.
  return runtime ? <runtime.VRScene {...props} /> : null;
}
