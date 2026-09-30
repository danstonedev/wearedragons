import { useEffect } from "react";
import * as THREE from "three";
import type { DragonType } from "../dragons";
import { dragonAttachmentPlan } from "../game/dragonVisuals";

/** Adds owned geometry directly to named bones, so each cue follows every animation clip. */
export default function DragonAdornments({ dragon, scene }: { dragon: DragonType; scene: THREE.Object3D }) {
  useEffect(() => {
    const horn = new THREE.ConeGeometry(0.5, 1.4, 14, 5);
    const positions = horn.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const t = (positions.getY(i) + 0.7) / 1.4;
      positions.setZ(i, positions.getZ(i) + t * t * 0.45);
    }
    horn.computeVertexNormals();
    const membrane = new THREE.Shape();
    membrane.moveTo(-0.5, -0.65);
    membrane.quadraticCurveTo(-0.25, 0.3, 0, 0.8);
    membrane.quadraticCurveTo(0.12, 0.2, 0.55, -0.65);
    membrane.quadraticCurveTo(0, -0.45, -0.5, -0.65);
    const fin = new THREE.ExtrudeGeometry(membrane, { depth: 0.04, bevelEnabled: false, curveSegments: 8, steps: 1 });
    fin.rotateY(Math.PI / 2);
    const geometries = {
      cone: horn,
      plate: new THREE.SphereGeometry(0.6, 12, 8),
      fin,
    };
    const materials = {
      spike: new THREE.MeshStandardMaterial({ color: dragon.colors.spike, roughness: 0.62, metalness: dragon.effects?.clawMetalness ?? 0.08 }),
      horn: new THREE.MeshStandardMaterial({ color: dragon.colors.horn, roughness: 0.58, metalness: dragon.effects?.clawMetalness ?? 0.12 }),
    };
    const attached: THREE.Mesh[] = [];
    for (const part of dragonAttachmentPlan(dragon.id)) {
      const bone = scene.getObjectByName(part.bone);
      if (!bone) continue;
      const mesh = new THREE.Mesh(geometries[part.shape], materials[part.material]);
      mesh.name = `Adornment_${part.bone}_${attached.length}`;
      mesh.position.set(...part.position);
      mesh.rotation.set(...part.rotation);
      mesh.scale.set(...part.scale);
      mesh.castShadow = true;
      bone.add(mesh);
      attached.push(mesh);
    }
    return () => {
      for (const mesh of attached) mesh.removeFromParent();
      Object.values(geometries).forEach(geometry => geometry.dispose());
      Object.values(materials).forEach(material => material.dispose());
    };
  }, [dragon, scene]);
  return null;
}
