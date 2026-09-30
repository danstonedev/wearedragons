import { useEffect } from "react";
import * as THREE from "three";
import type { DragonType } from "../dragons";
import { dragonAttachmentPlan } from "../game/dragonVisuals";

/** Adds owned geometry directly to named bones, so each cue follows every animation clip. */
export default function DragonAdornments({ dragon, scene }: { dragon: DragonType; scene: THREE.Object3D }) {
  useEffect(() => {
    const geometries = {
      cone: new THREE.ConeGeometry(0.5, 1.4, 12, 2),
      plate: new THREE.OctahedronGeometry(0.6, 1),
      fin: new THREE.ConeGeometry(0.65, 1.5, 12, 2),
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
