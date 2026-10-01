import { useEffect } from "react";
import type { RefObject } from "react";
import type * as THREE from "three";
import { finalizeInstances } from "../../game/rendering";

/** Write fixed instance transforms (and optional colors) once, then refresh culling bounds. */
export function useStaticInstances(mesh: RefObject<THREE.InstancedMesh | null>, matrices: readonly THREE.Matrix4[], colors?: readonly THREE.Color[]) {
  useEffect(() => {
    const target = mesh.current;
    if (!target) return;
    matrices.forEach((matrix, i) => target.setMatrixAt(i, matrix));
    colors?.forEach((color, i) => target.setColorAt(i, color));
    finalizeInstances(target);
  }, [mesh, matrices, colors]);
}
