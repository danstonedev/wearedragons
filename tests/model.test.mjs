import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { DRAGON_TYPES, colorDragonModel } from "../src/dragons.ts";

const bytes = await readFile(new URL("../public/dragon.glb", import.meta.url));
const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "", resolve, reject));

function meshes(scene) {
  const result = [];
  scene.traverse(object => { if (object.isMesh) result.push(object); });
  return result;
}

test("dragon instances own their recolored materials and leave the GLTF cache intact", () => {
  const a = clone(gltf.scene), b = clone(gltf.scene);
  const originalMaterials = meshes(gltf.scene).map(mesh => mesh.material);
  colorDragonModel(a, DRAGON_TYPES[0].colors, DRAGON_TYPES[0].effects);
  colorDragonModel(b, DRAGON_TYPES[4].colors, DRAGON_TYPES[4].effects);
  const am = meshes(a), bm = meshes(b);
  am.forEach((mesh, i) => {
    assert.notEqual(mesh.material, bm[i].material);
    assert.notEqual(mesh.material, originalMaterials[i]);
    assert.equal(mesh.geometry, bm[i].geometry);
  });
  assert.deepEqual(meshes(gltf.scene).map(mesh => mesh.material), originalMaterials);
});

test("owned skeletons animate independently without binding to another dragon's bones", () => {
  const a = clone(gltf.scene), b = clone(gltf.scene);
  const mixer = new THREE.AnimationMixer(a);
  const flying = gltf.animations.find(clip => clip.name === "Dragon_Flying");
  assert.ok(flying);
  mixer.clipAction(flying).play();
  mixer.update(0.2);
  let changed = false;
  a.traverse(object => {
    if (object.isBone) {
      const other = b.getObjectByName(object.name);
      if (other && !object.quaternion.equals(other.quaternion)) changed = true;
    }
  });
  assert.equal(changed, true);
  mixer.uncacheRoot(a);
});
