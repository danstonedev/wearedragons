import { useEffect, useMemo, useRef } from "react";
import { BallCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { createPlantings } from "../game/landscape";
import type { LandscapeKind } from "../game/landscape";
import { device } from "../utils/device";

/** Connected crowns, smooth branches and shared instancing replace the old cone forest. */
export default function Vegetation({ kind }: { kind: LandscapeKind }) {
  const quest = device === "quest" || device === "mobile";
  const trees = useMemo(() => createPlantings(kind, "tree", kind === "ridge" ? (quest ? 65 : 105) : (quest ? 120 : 210)), [kind, quest]);
  const rocks = useMemo(() => createPlantings(kind, "rock", kind === "ridge" ? (quest ? 65 : 130) : (quest ? 100 : 165)), [kind, quest]);
  const trunk = useRef<THREE.InstancedMesh>(null);
  const branches = useRef<THREE.InstancedMesh>(null);
  const lower = useRef<THREE.InstancedMesh>(null);
  const upper = useRef<THREE.InstancedMesh>(null);
  const side = useRef<THREE.InstancedMesh>(null);
  const stones = useRef<THREE.InstancedMesh>(null);
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.15, 0.34, 3, 8, 2), []);
  const branchGeo = useMemo(() => new THREE.CylinderGeometry(0.06, 0.18, 2.1, 7), []);
  const crownGeo = useMemo(() => {
    const geometry = new THREE.SphereGeometry(1, 10, 8);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const ripple = 1 + 0.08 * Math.sin(x * 8 + y * 5) * Math.cos(z * 7 - y * 4);
      pos.setXYZ(i, x * ripple, y * ripple, z * ripple);
    }
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  const rockGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  useEffect(() => () => { trunkGeo.dispose(); branchGeo.dispose(); crownGeo.dispose(); rockGeo.dispose(); }, [trunkGeo, branchGeo, crownGeo, rockGeo]);

  useEffect(() => {
    const object = new THREE.Object3D();
    const color = new THREE.Color();
    trees.forEach((tree, i) => {
      const { x, y, z, scale, tint } = tree;
      object.rotation.set(0, tint * Math.PI * 2, 0);
      object.position.set(x, y + 1.5 * scale, z);
      object.scale.setScalar(scale);
      object.updateMatrix(); trunk.current?.setMatrixAt(i, object.matrix);
      trunk.current?.setColorAt(i, color.set("#715240").multiplyScalar(0.8 + tint * 0.35));
      for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
        const sign = sideIndex === 0 ? -1 : 1;
        object.rotation.set(0, tint * Math.PI * 2, sign * 0.64);
        object.position.set(x + sign * 0.55 * scale, y + (2.65 + sideIndex * 0.4) * scale, z);
        object.scale.setScalar(scale);
        object.updateMatrix(); branches.current?.setMatrixAt(i * 2 + sideIndex, object.matrix);
        branches.current?.setColorAt(i * 2 + sideIndex, color.set("#715240").multiplyScalar(0.82 + tint * 0.3));
      }
      object.rotation.set(0, tint * Math.PI * 2, 0);
      object.position.set(x - 0.23 * scale, y + 3.25 * scale, z);
      object.scale.set(1.25 * scale, 1.32 * scale, 1.05 * scale);
      object.updateMatrix(); lower.current?.setMatrixAt(i, object.matrix);
      lower.current?.setColorAt(i, color.set("#547343").multiplyScalar(0.7 + tint * 0.38));
      object.position.set(x + 0.18 * scale, y + 4.2 * scale, z - 0.14 * scale);
      object.scale.set(1.07 * scale, 1.18 * scale, 0.95 * scale);
      object.updateMatrix(); upper.current?.setMatrixAt(i, object.matrix);
      upper.current?.setColorAt(i, color.set("#69884e").multiplyScalar(0.75 + tint * 0.35));
      object.position.set(x + 0.7 * scale, y + 3.55 * scale, z + 0.36 * scale);
      object.scale.set(0.92 * scale, 1.05 * scale, 0.94 * scale);
      object.updateMatrix(); side.current?.setMatrixAt(i, object.matrix);
      side.current?.setColorAt(i, color.set("#5c7946").multiplyScalar(0.72 + tint * 0.38));
    });
    rocks.forEach((rock, i) => {
      const { x, y, z, scale, tint } = rock;
      object.rotation.set(tint * 0.24, tint * 6.28, tint * 0.18);
      object.position.set(x, y + scale * 0.43, z);
      object.scale.set(scale * 1.2, scale * 0.65, scale * 0.92);
      object.updateMatrix(); stones.current?.setMatrixAt(i, object.matrix);
      stones.current?.setColorAt(i, color.set("#8b8172").multiplyScalar(0.75 + tint * 0.35));
    });
    for (const mesh of [trunk.current, branches.current, lower.current, upper.current, side.current, stones.current]) {
      if (mesh) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    }
  }, [trees, rocks]);

  return <>
    <RigidBody type="fixed" colliders={false}>
      {trees.map((tree, i) => <CylinderCollider key={`t${i}`} args={[1.5 * tree.scale, 0.24 * tree.scale]} position={[tree.x, tree.y + 1.5 * tree.scale, tree.z]} />)}
      {rocks.filter(rock => rock.scale > 0.65).map((rock, i) => <BallCollider key={`r${i}`} args={[rock.scale * 0.57]} position={[rock.x, rock.y + rock.scale * 0.43, rock.z]} />)}
    </RigidBody>
    <instancedMesh ref={trunk} args={[trunkGeo, undefined, trees.length]} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.96} />
    </instancedMesh>
    <instancedMesh ref={branches} args={[branchGeo, undefined, trees.length * 2]} castShadow>
      <meshStandardMaterial roughness={0.96} />
    </instancedMesh>
    <instancedMesh ref={lower} args={[crownGeo, undefined, trees.length]} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.92} />
    </instancedMesh>
    <instancedMesh ref={upper} args={[crownGeo, undefined, trees.length]} castShadow>
      <meshStandardMaterial roughness={0.9} />
    </instancedMesh>
    <instancedMesh ref={side} args={[crownGeo, undefined, trees.length]} castShadow>
      <meshStandardMaterial roughness={0.93} />
    </instancedMesh>
    <instancedMesh ref={stones} args={[rockGeo, undefined, rocks.length]} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.95} />
    </instancedMesh>
  </>;
}
