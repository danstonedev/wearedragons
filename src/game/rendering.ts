import * as THREE from "three";

/** Refresh cached culling volumes after writing instance transforms. */
export function finalizeInstances(mesh: THREE.InstancedMesh | null) {
  if (!mesh) return;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
}

export function renderingBudget(device: string) {
  const constrained = device !== "desktop";
  return {
    constrained,
    shadows: !constrained,
    maxDpr: constrained ? device === "quest" ? 1 : 1.25 : 1.5,
    minDpr: constrained ? 0.75 : 1,
    terrainDivisions: constrained ? 72 : 112,
    clouds: constrained ? 8 : 24,
    grass: constrained ? 280 : 750,
    shadowMapSize: 1024,
  };
}

/** A sustained slow window lowers resolution; recovery needs a separate fast window. */
export function nextPixelRatio(current: number, averageMs: number, min: number, max: number) {
  if (averageMs > 24) return Math.max(min, Math.round((current - 0.25) * 100) / 100);
  if (averageMs < 15) return Math.min(max, Math.round((current + 0.25) * 100) / 100);
  return current;
}
