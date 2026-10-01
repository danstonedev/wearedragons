import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BallCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { SCAVENGER_CAMPS, kingdomAt } from "../../game/world";
import type { CampSite, LandKingdomId } from "../../game/world";
import { campLayouts } from "../../game/scavengerCamps";
import type { CampLayout } from "../../game/scavengerCamps";
import { mergePieces, piece } from "../pieces";
import Distant from "./Distant";

/** Turf on the burrow mound takes on the land around it. */
const TURF: Record<LandKingdomId, string> = {
  pyrrhia: "#5f6f3a", sky: "#7a5a44", ice: "#dfe8ee", mud: "#5a4a32", rainforest: "#3f6b34", sand: "#c9a46a", pantala: "#a88a52", glaeryus: "#4f5a4a",
};
const CLOTH = ["#a3784a", "#8a5a3c", "#6f7a4a", "#9a8a6a", "#7a4a3a"];
const WOOD = "#5a3f26", WOOD_LIGHT = "#7a5530", STONE = "#7d776b", EARTH = "#6b5a3e", BURLAP = "#9c7d55";

/** Turn a local offset (x across, z out from the burrow) into world space. */
function placer(camp: CampSite, origin: { x: number; y: number; z: number }) {
  const sin = Math.sin(camp.facing), cos = Math.cos(camp.facing);
  return (across: number, up: number, out: number): [number, number, number] => [origin.x + cos * across + sin * out, origin.y + up, origin.z - sin * across + cos * out];
}

/** Every static piece of one camp, merged into a single vertex-colored mesh. */
function campGeometry(camp: CampSite, layout: CampLayout) {
  const turf = TURF[kingdomAt(camp.x, camp.z).id as LandKingdomId] ?? TURF.pyrrhia;
  const parts: THREE.BufferGeometry[] = [];
  const { center, mouth, moundRadius: r } = layout;
  // The turf mound over the burrow, earthy around its skirt.
  parts.push(piece(new THREE.SphereGeometry(1, 20, 9, 0, Math.PI * 2, 0, Math.PI / 2), (_x, y) => (y > center.y + 0.6 ? turf : EARTH), { p: [center.x, center.y - 0.7, center.z], s: [r, r * 0.62, r] }));
  // The mouth: a dark hole framed in timber, set into the front of the mound.
  const at = placer(camp, center);
  parts.push(piece(new THREE.CircleGeometry(1.45, 18, 0, Math.PI), "#120d08", { p: at(0, 0.02, r * 0.95), r: [0, camp.facing, 0] }));
  for (const side of [-1, 1]) parts.push(piece(new THREE.BoxGeometry(0.24, 2.1, 0.24), WOOD, { p: at(side * 1.55, 1.0, r * 0.97) }));
  parts.push(piece(new THREE.BoxGeometry(3.5, 0.26, 0.28), WOOD, { p: at(0, 2.05, r * 0.97), r: [0, camp.facing, 0] }));
  parts.push(piece(new THREE.BoxGeometry(2.6, 0.12, 0.9), WOOD_LIGHT, { p: [mouth.x, mouth.y + 0.06, mouth.z], r: [0, camp.facing, 0] }));
  // A patched flag on a pole above the burrow.
  const flag = layout.flag;
  parts.push(piece(new THREE.CylinderGeometry(0.07, 0.09, 7.5, 6), WOOD, { p: [flag.x, flag.y + 3.75, flag.z] }));
  parts.push(piece(new THREE.BoxGeometry(1.5, 0.95, 0.05), "#a33a2c", { p: [flag.x + Math.cos(camp.facing) * 0.78, flag.y + 6.9, flag.z - Math.sin(camp.facing) * 0.78], r: [0, camp.facing, 0] }));
  // Tents around the fire.
  layout.tents.forEach((tent, i) => {
    const size = tent.size;
    const cloth = CLOTH[(i + Math.round(camp.x)) % CLOTH.length];
    parts.push(piece(new THREE.ConeGeometry(2.2 * size, 3.1 * size, 7), (x, y) => (Math.sin(x * 2.1 + y * 3.3) > 0.82 ? "#c9b48a" : cloth), { p: [tent.x, tent.y + 1.5 * size, tent.z], r: [0, tent.rotation, 0] }));
    parts.push(piece(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 5), WOOD, { p: [tent.x, tent.y + 3.4 * size, tent.z] }));
    // The flap, facing the fire.
    const toFire = Math.atan2(layout.fire.x - tent.x, layout.fire.z - tent.z);
    parts.push(piece(new THREE.CircleGeometry(0.85 * size, 3), "#2a1d12", { p: [tent.x + Math.sin(toFire) * 1.25 * size, tent.y + 0.75 * size, tent.z + Math.cos(toFire) * 1.25 * size], r: [-0.6, toFire, Math.PI / 2], o: "YXZ" }));
  });
  // The campfire: a stone ring, crossed logs, and a pot on a tripod.
  const fire = layout.fire;
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    parts.push(piece(new THREE.DodecahedronGeometry(0.32, 0), STONE, { p: [fire.x + Math.cos(a) * 1.15, fire.y + 0.12, fire.z + Math.sin(a) * 1.15], r: [a, a * 2, 0] }));
  }
  parts.push(piece(new THREE.CircleGeometry(1.0, 12), "#2d2722", { p: [fire.x, fire.y + 0.03, fire.z], r: [-Math.PI / 2, 0, 0] }));
  for (let i = 0; i < 3; i++) parts.push(piece(new THREE.CylinderGeometry(0.11, 0.13, 1.6, 6), "#3d2a1a", { p: [fire.x, fire.y + 0.22, fire.z], r: [Math.PI / 2 - 0.2, i * 1.05, 0], o: "YXZ" }));
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + 0.4;
    parts.push(piece(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 4), WOOD, { p: [fire.x + Math.cos(a) * 0.55, fire.y + 1.05, fire.z + Math.sin(a) * 0.55], r: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3] }));
  }
  parts.push(piece(new THREE.SphereGeometry(0.34, 10, 8), "#33302c", { p: [fire.x, fire.y + 1.0, fire.z], s: [1, 0.8, 1] }));
  // Benches: logs to sit on.
  for (const side of [-1, 1]) parts.push(piece(new THREE.CylinderGeometry(0.22, 0.24, 2.4, 7), "#4e3826", { p: placer(camp, fire)(side * 2.6, 0.2, 0), r: [0, camp.facing, Math.PI / 2] }));
  // The stash: crates, barrels, and sacks around a patch where stolen treasure is piled.
  const stash = layout.stash;
  const around = (angle: number, radius: number, lift: number): [number, number, number] => [stash.x + Math.sin(angle) * radius, stash.y + lift, stash.z + Math.cos(angle) * radius];
  parts.push(piece(new THREE.BoxGeometry(1.1, 0.9, 1.0), WOOD_LIGHT, { p: around(camp.facing + 1.2, 2.9, 0.45), r: [0, 0.3, 0] }));
  parts.push(piece(new THREE.BoxGeometry(0.8, 0.7, 0.8), WOOD_LIGHT, { p: around(camp.facing + 1.2, 2.9, 1.25), r: [0, 0.9, 0] }));
  parts.push(piece(new THREE.CylinderGeometry(0.42, 0.46, 1.05, 10), WOOD, { p: around(camp.facing + 2.1, 3.0, 0.52) }));
  parts.push(piece(new THREE.CylinderGeometry(0.42, 0.46, 1.05, 10), WOOD, { p: around(camp.facing + 2.6, 3.1, 0.52) }));
  for (let i = 0; i < 3; i++) parts.push(piece(new THREE.SphereGeometry(0.45, 9, 7), BURLAP, { p: around(camp.facing - 1.4 + i * 0.5, 3.0, 0.32), s: [1, 0.75, 1] }));
  // A palisade of sharpened stakes behind the burrow, pointed at the sky.
  for (let i = 0; i < 11; i++) {
    const a = camp.facing + Math.PI + (i - 5) * 0.2;
    const x = center.x + Math.sin(a) * 11, z = center.z + Math.cos(a) * 11;
    parts.push(piece(new THREE.ConeGeometry(0.2, 3.4, 5), WOOD_LIGHT, { p: [x, center.y + 1.2, z], r: [Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45] }));
  }
  return mergePieces(parts);
}

const FLAME_COUNT = SCAVENGER_CAMPS.length * 2;
const PUFFS = 12;

/**
 * Scavenger camps: a turf burrow, tents, a campfire whose smoke you can spot from across the
 * kingdoms, and a stash where stolen treasure is piled up.
 */
export default function ScavengerCamps() {
  const layouts = campLayouts();
  const geometries = useMemo(() => SCAVENGER_CAMPS.map((camp, i) => campGeometry(camp, layouts[i])), [layouts]);
  useEffect(() => () => geometries.forEach(geometry => geometry.dispose()), [geometries]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), []);
  useEffect(() => () => material.dispose(), [material]);
  const flames = useRef<THREE.InstancedMesh>(null);
  const smoke = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(state => {
    const t = state.clock.elapsedTime;
    if (flames.current) {
      layouts.forEach((layout, c) => {
        for (let k = 0; k < 2; k++) {
          const flicker = 1 + Math.sin(t * (9 + k * 4) + c * 3) * 0.12 + Math.sin(t * 23 + c) * 0.06;
          dummy.position.set(layout.fire.x, layout.fire.y + 0.55 + k * 0.1, layout.fire.z);
          dummy.rotation.set(0, t * (k ? -1.3 : 1.1), Math.sin(t * 5 + c) * 0.06);
          dummy.scale.set((k ? 0.55 : 1) * (2 - flicker), (k ? 0.75 : 1) * flicker, (k ? 0.55 : 1) * (2 - flicker));
          dummy.updateMatrix();
          flames.current!.setMatrixAt(c * 2 + k, dummy.matrix);
        }
      });
      flames.current.instanceMatrix.needsUpdate = true;
    }
    if (smoke.current) {
      layouts.forEach((layout, c) => {
        for (let i = 0; i < PUFFS; i++) {
          const phase = ((t * 0.07 + i / PUFFS + c * 0.31) % 1);
          const height = phase * 46;
          dummy.position.set(layout.fire.x + Math.sin(t * 0.3 + i + c) * 1.5 + phase * 9, layout.fire.y + 2.5 + height, layout.fire.z + Math.cos(t * 0.25 + i * 1.7) * 1.5 + phase * 4);
          dummy.rotation.set(i, i * 2, 0);
          dummy.scale.setScalar((0.9 + phase * 4.2) * Math.min(1, (1 - phase) * 3));
          dummy.updateMatrix();
          smoke.current!.setMatrixAt(c * PUFFS + i, dummy.matrix);
        }
      });
      smoke.current.instanceMatrix.needsUpdate = true;
    }
  });

  return <>
    {SCAVENGER_CAMPS.map((camp, i) => <Distant key={camp.id} x={camp.x} z={camp.z} range={620}>
      <mesh geometry={geometries[i]} material={material} castShadow receiveShadow />
    </Distant>)}
    <RigidBody type="fixed" colliders={false}>
      {layouts.map((layout, i) => <BallCollider key={`mound${i}`} args={[layout.moundRadius * 0.82]} position={[layout.center.x, layout.center.y - 1.6, layout.center.z]} />)}
      {layouts.flatMap((layout, i) => layout.tents.map((tent, k) => <CylinderCollider key={`tent${i}-${k}`} args={[1.5 * tent.size, 1.3 * tent.size]} position={[tent.x, tent.y + 1.5 * tent.size, tent.z]} />))}
    </RigidBody>
    <instancedMesh ref={flames} args={[undefined, undefined, FLAME_COUNT]} frustumCulled={false}>
      <coneGeometry args={[0.55, 1.5, 7]} />
      <meshBasicMaterial color="#ffae42" transparent opacity={0.92} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
    {/* Smoke from every campfire, drifting downwind: the surest way to find a camp. */}
    <instancedMesh ref={smoke} args={[undefined, undefined, SCAVENGER_CAMPS.length * PUFFS]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial color="#c9c3ba" transparent opacity={0.3} depthWrite={false} />
    </instancedMesh>
  </>;
}
