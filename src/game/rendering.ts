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
    /** Open-world terrain levels of detail: cells per chunk side, and how far each level reaches. */
    worldLods: constrained
      ? [{ divisions: 20, distance: 120 }, { divisions: 10, distance: 250 }, { divisions: 5, distance: 450 }]
      : [{ divisions: 32, distance: 170 }, { divisions: 16, distance: 360 }, { divisions: 8, distance: 580 }, { divisions: 4, distance: 780 }],
    /** Fog start and end in the open world; the terrain ends just past the fog. */
    worldFog: constrained ? [110, 440] as const : [170, 720] as const,
    /** Terrain colliders stream in around the player within this radius. */
    colliderRadius: constrained ? 100 : 130,
  };
}

/** A sustained slow window lowers resolution; recovery needs a separate fast window. */
export function nextPixelRatio(current: number, averageMs: number, min: number, max: number) {
  if (averageMs > 24) return Math.max(min, Math.round((current - 0.25) * 100) / 100);
  if (averageMs < 15) return Math.min(max, Math.round((current + 0.25) * 100) / 100);
  return current;
}
