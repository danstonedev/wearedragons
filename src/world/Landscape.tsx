import { useEffect, useMemo } from "react";
import { RigidBody, TrimeshCollider } from "@react-three/rapier";
import * as THREE from "three";
import { createTerrainSurface, terrainHeight } from "../game/landscape";
import type { LandscapeKind } from "../game/landscape";
import { renderingBudget } from "../game/rendering";
import { shorelineZ } from "../game/coast";
import { device } from "../utils/device";
import { groundRelief } from "./groundRelief";

const terrainRelief = groundRelief(28);

function groundColor(x: number, z: number, y: number, kind: LandscapeKind, slope: number) {
  const green = new THREE.Color("#526e42");
  const dry = new THREE.Color("#ad8459");
  const basalt = new THREE.Color("#555f65");
  const earth = new THREE.Color("#6f644d");
  const rock = new THREE.Color("#8a8374");
  const regionMix = THREE.MathUtils.smoothstep(z, 23, 38);
  const color = kind === "open"
    ? green.clone().lerp(x >= 0 ? dry : basalt, regionMix)
    : green.clone();
  color.lerp(earth, THREE.MathUtils.clamp((y - 4) / 19, 0, 0.55));
  color.lerp(rock, THREE.MathUtils.clamp((slope - 0.35) * 0.75, 0, 0.75));
  if (kind === "open") color.lerp(new THREE.Color("#cfb986"), THREE.MathUtils.smoothstep(z - shorelineZ(x), -36, -12));
  const variation = Math.sin(x * 0.57 + z * 0.36) * Math.sin(z * 0.41 - x * 0.2) * 0.04;
  return color.multiplyScalar(1 + variation);
}

export default function Landscape({ kind }: { kind: LandscapeKind }) {
  const size = kind === "ridge" ? 250 : 400;
  const divisions = renderingBudget(device).terrainDivisions;
  const { surface, geometry } = useMemo(() => {
    const surface = createTerrainSurface(kind, size, divisions);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(surface.vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(surface.indices, 1));
    const uvs = new Float32Array(surface.vertices.length / 3 * 2);
    for (let i = 0; i < surface.vertices.length / 3; i++) {
      uvs[i * 2] = surface.vertices[i * 3] / size + 0.5;
      uvs[i * 2 + 1] = surface.vertices[i * 3 + 2] / size + 0.5;
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    const colors = new Float32Array(surface.vertices.length);
    for (let i = 0; i < colors.length; i += 3) {
      const x = surface.vertices[i], y = surface.vertices[i + 1], z = surface.vertices[i + 2];
      const slope = Math.hypot(terrainHeight(x + 1, z, kind) - terrainHeight(x - 1, z, kind), terrainHeight(x, z + 1, kind) - terrainHeight(x, z - 1, kind)) * 0.5;
      const color = groundColor(x, z, y, kind, slope);
      colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return { surface, geometry };
  }, [kind, size, divisions]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <RigidBody type="fixed" colliders={false} friction={1}>
      <TrimeshCollider args={[surface.vertices, surface.indices]} friction={1} />
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.96} metalness={0} bumpMap={terrainRelief} bumpScale={0.22} />
      </mesh>
    </RigidBody>
  );
}
