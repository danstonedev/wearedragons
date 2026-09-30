import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { finalizeInstances, renderingBudget, nextPixelRatio } from "../src/game/rendering.ts";

test("moved instanced scenery remains visible after cached bounds are refreshed", () => {
  const geometry = new THREE.BoxGeometry(2, 2, 2), material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, 1);
  const transform = new THREE.Matrix4();
  mesh.setMatrixAt(0, transform.identity());
  mesh.computeBoundingSphere(); // Renderer may cache this before the placement effect.
  mesh.setMatrixAt(0, transform.makeTranslation(100, 0, 0));
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(100, 0, 10); camera.lookAt(100, 0, 0); camera.updateMatrixWorld(true);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  assert.equal(frustum.intersectsObject(mesh), false);
  finalizeInstances(mesh);
  assert.equal(frustum.intersectsObject(mesh), true);
  assert.ok(mesh.boundingBox.containsPoint(new THREE.Vector3(100, 0, 0)));
  // Move again: refreshed bounds must replace the previous cached location.
  mesh.setMatrixAt(0, transform.makeTranslation(-100, 0, 0)); finalizeInstances(mesh);
  assert.equal(frustum.intersectsObject(mesh), false);
  geometry.dispose(); material.dispose(); mesh.dispose();
});

test("all touch devices and Quest use the constrained budget", () => {
  const desktop = renderingBudget("desktop");
  for (const device of ["iphone", "ipad", "mobile", "quest"]) {
    const budget = renderingBudget(device);
    assert.equal(budget.shadows, false);
    assert.ok(budget.maxDpr <= 1.25);
    assert.ok(budget.terrainDivisions < desktop.terrainDivisions);
    assert.ok(budget.clouds < desktop.clouds && budget.grass < desktop.grass);
  }
  assert.equal(renderingBudget("quest").maxDpr, 1);
});

test("adaptive resolution has hysteresis and cannot cross its rendering budget", () => {
  assert.equal(nextPixelRatio(1.5, 30, 1, 1.5), 1.25);
  assert.equal(nextPixelRatio(1, 30, 1, 1.5), 1);
  assert.equal(nextPixelRatio(1.25, 17, 1, 1.5), 1.25);
  assert.equal(nextPixelRatio(1.25, 12, 1, 1.5), 1.5);
  assert.equal(nextPixelRatio(1.5, 12, 1, 1.5), 1.5);
});
