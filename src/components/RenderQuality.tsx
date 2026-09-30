import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { gameSession } from "../game/runtime";
import { nextPixelRatio, renderingBudget } from "../game/rendering";
import { device } from "../utils/device";

const budget = renderingBudget(device);

/** Change pixel density between sustained windows, never rebuild the scene. */
export default function RenderQuality() {
  const gl = useThree(state => state.gl);
  const setDpr = useThree(state => state.setDpr);
  const window = useRef({ elapsed: 0, total: 0, frames: 0, warmup: 3 });
  useEffect(() => { gl.xr.setFoveation(1); }, [gl]);
  useFrame((_, delta) => {
    const sample = window.current;
    if (gameSession.paused || gl.xr.isPresenting) {
      sample.elapsed = sample.total = sample.frames = 0;
      return;
    }
    if (sample.warmup > 0) { sample.warmup -= delta; return; }
    // Exclude tab resumes and debugger stalls from the rendering budget.
    if (delta > 0.2) return;
    sample.elapsed += delta; sample.total += delta * 1000; sample.frames++;
    if (sample.elapsed < 5) return;
    const current = gl.getPixelRatio();
    const next = nextPixelRatio(current, sample.total / sample.frames, budget.minDpr, budget.maxDpr);
    if (next !== current) setDpr(next);
    sample.elapsed = sample.total = sample.frames = 0;
  });
  return null;
}
