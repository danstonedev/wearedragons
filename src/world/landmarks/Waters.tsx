import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { terrainHeight } from "../../game/landscape";
import { GREAT_FALLS, MUD_LEVEL, MUD_POOLS, OASIS } from "../../game/world";
import Distant from "./Distant";
import { createFallsMaterial, createWaterMaterial } from "./shaders";

/** All the marsh's mud pools in one mesh, with lazy bubbles popping on top. */
export function MudPools() {
  const material = useMemo(() => createWaterMaterial("#6b5434", "#3b2b18", 0.6), []);
  const geometry = useMemo(() => {
    const parts = MUD_POOLS.map(pool => {
      const disc = new THREE.CircleGeometry(pool.r * 0.78, 28);
      disc.rotateX(-Math.PI / 2);
      disc.translate(pool.x, MUD_LEVEL, pool.z);
      return disc;
    });
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (const part of parts) {
      const base = positions.length / 3;
      positions.push(...part.attributes.position.array);
      uvs.push(...part.attributes.uv.array);
      for (let i = 0; i < part.index!.count; i++) indices.push(base + part.index!.getX(i));
      part.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    merged.setIndex(indices);
    merged.computeVertexNormals();
    merged.computeBoundingSphere();
    return merged;
  }, []);
  const bubbles = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => MUD_POOLS.flatMap((pool, p) => [0, 1, 2, 3].map(k => ({
    x: pool.x + Math.cos(p * 3.1 + k * 1.9) * pool.r * 0.4 * (0.3 + k * 0.2),
    z: pool.z + Math.sin(p * 3.1 + k * 1.9) * pool.r * 0.4 * (0.3 + k * 0.2),
    phase: p * 0.37 + k * 0.23,
  }))), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => () => { material.dispose(); geometry.dispose(); }, [material, geometry]);
  useFrame(state => {
    const mesh = bubbles.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    spots.forEach((spot, i) => {
      const cycle = (t * 0.45 + spot.phase) % 1;
      dummy.position.set(spot.x, MUD_LEVEL, spot.z);
      dummy.scale.setScalar(cycle < 0.8 ? 0.25 + cycle * 1.1 : 0.0001);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <Distant x={-600} z={-260} range={720}>
    <mesh geometry={geometry} material={material} receiveShadow />
    <instancedMesh ref={bubbles} args={[undefined, undefined, spots.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#7a6040" roughness={0.3} />
    </instancedMesh>
  </Distant>;
}

/** The Sand Kingdom's oasis. */
export function Oasis() {
  const material = useMemo(() => createWaterMaterial("#4fd0dc", "#1f7f99", 1.2), []);
  useEffect(() => () => material.dispose(), [material]);
  return <Distant x={OASIS.x} z={OASIS.z} range={760}>
    <mesh position={[OASIS.x, OASIS.level, OASIS.z]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <circleGeometry args={[OASIS.shore - 2, 48]} />
    </mesh>
  </Distant>;
}

const MIST = 16;

/**
 * The Great Falls: a river crosses the rainforest plateau and pours off its southern
 * cliff into a misty pool, under a faint rainbow.
 */
export function GreatFalls() {
  const fallsMaterial = useMemo(() => createFallsMaterial(), []);
  const waterMaterial = useMemo(() => createWaterMaterial("#7cc6d6", "#2f7f95", 1.6), []);
  const { sheet, river } = useMemo(() => {
    const x = GREAT_FALLS.lip.x;
    // Find the lip: the last point where the river still runs on the plateau.
    let lipZ = GREAT_FALLS.z + GREAT_FALLS.radius - 6;
    const plateau = terrainHeight(x, GREAT_FALLS.z + 40, "open");
    for (let z = GREAT_FALLS.z + 60; z < GREAT_FALLS.pool.z; z += 0.5) {
      if (terrainHeight(x, z, "open") < plateau - 4) { lipZ = z - 1; break; }
    }
    const lipY = terrainHeight(x, lipZ, "open") + 0.6;
    const bottomY = 4.8, bottomZ = GREAT_FALLS.pool.z - 6;
    // The sheet arcs out from the lip and falls into the pool.
    const rows = 18, width = 18;
    const sheetPositions: number[] = [], sheetUvs: number[] = [], sheetIndices: number[] = [];
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      const z = lipZ + (bottomZ - lipZ) * Math.sqrt(t);
      const y = lipY + (bottomY - lipY) * t * t * 0.35 + (bottomY - lipY) * t * 0.65;
      const spread = 1 + t * 0.35;
      for (const side of [-1, 1]) {
        sheetPositions.push(x + side * width / 2 * spread, y, z);
        sheetUvs.push(side < 0 ? 0 : 1, t);
      }
      if (r > 0) {
        const a = (r - 1) * 2, b = a + 1, c = r * 2, d = c + 1;
        sheetIndices.push(a, c, b, b, c, d);
      }
    }
    const sheet = new THREE.BufferGeometry();
    sheet.setAttribute("position", new THREE.Float32BufferAttribute(sheetPositions, 3));
    sheet.setAttribute("uv", new THREE.Float32BufferAttribute(sheetUvs, 2));
    sheet.setIndex(sheetIndices);
    sheet.computeVertexNormals();
    // The river follows its channel across the plateau.
    const riverPositions: number[] = [], riverUvs: number[] = [], riverIndices: number[] = [];
    const start = GREAT_FALLS.z - 10, steps = 40;
    for (let s = 0; s <= steps; s++) {
      const z = start + (lipZ - start) * s / steps;
      const y = Math.max(terrainHeight(x, z, "open"), terrainHeight(x - 4, z, "open"), terrainHeight(x + 4, z, "open")) + 0.35;
      riverPositions.push(x - 7, y, z, x + 7, y, z);
      riverUvs.push(0, s / steps, 1, s / steps);
      if (s > 0) {
        const a = (s - 1) * 2, b = a + 1, c = s * 2, d = c + 1;
        riverIndices.push(a, c, b, b, c, d);
      }
    }
    const river = new THREE.BufferGeometry();
    river.setAttribute("position", new THREE.Float32BufferAttribute(riverPositions, 3));
    river.setAttribute("uv", new THREE.Float32BufferAttribute(riverUvs, 2));
    river.setIndex(riverIndices);
    river.computeVertexNormals();
    return { sheet, river };
  }, []);
  const mist = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => () => { fallsMaterial.dispose(); waterMaterial.dispose(); sheet.dispose(); river.dispose(); }, [fallsMaterial, waterMaterial, sheet, river]);
  useFrame(state => {
    const mesh = mist.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < MIST; i++) {
      const phase = (t * 0.12 + i / MIST) % 1;
      dummy.position.set(GREAT_FALLS.pool.x + Math.sin(i * 2.4) * 9 * (0.5 + phase), 5 + phase * 16, GREAT_FALLS.pool.z - 8 + Math.cos(i * 1.7) * 6 + phase * 6);
      dummy.scale.setScalar((3 + phase * 7) * (phase > 0.8 ? (1 - phase) / 0.2 : 1));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  const pool = GREAT_FALLS.pool;
  return <Distant x={GREAT_FALLS.x} z={GREAT_FALLS.z} range={820}>
    <mesh geometry={sheet} material={fallsMaterial} renderOrder={3} />
    <mesh geometry={river} material={waterMaterial} />
    <mesh position={[pool.x, 4.6, pool.z]} rotation={[-Math.PI / 2, 0, 0]} material={waterMaterial}>
      <circleGeometry args={[pool.radius - 2, 40]} />
    </mesh>
    <instancedMesh ref={mist} args={[undefined, undefined, MIST]} frustumCulled={false} renderOrder={4}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial color="#f2fbff" transparent opacity={0.22} depthWrite={false} />
    </instancedMesh>
    {/* A faint rainbow hangs in the spray. */}
    <group position={[pool.x, 6, pool.z + 4]}>
      {["#ff5a5a", "#ffb04a", "#fff36a", "#6aff8a", "#5ab0ff", "#a36aff"].map((color, i) => <mesh key={color}>
        <torusGeometry args={[22 - i * 0.9, 0.4, 4, 40, Math.PI]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>)}
    </group>
  </Distant>;
}
