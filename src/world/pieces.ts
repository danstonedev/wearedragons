import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Small helpers for building low-poly models out of colored primitive pieces. */
export type Vec3 = [number, number, number];
/** Position, rotation (Euler, in `o` order, XYZ by default), and scale. */
export interface Placement { p?: Vec3; r?: Vec3; s?: Vec3; o?: THREE.EulerOrder }

const _matrix = new THREE.Matrix4();
const _quaternion = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _color = new THREE.Color();

/** One colored, transformed, non-indexed piece of a merged model. A color function sees the placed vertex. */
export function piece(geometry: THREE.BufferGeometry, color: string | ((x: number, y: number, z: number) => string), place: Placement = {}) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  _quaternion.setFromEuler(_euler.set(...(place.r ?? [0, 0, 0]), place.o ?? "XYZ"));
  _matrix.compose(new THREE.Vector3(...(place.p ?? [0, 0, 0])), _quaternion, new THREE.Vector3(...(place.s ?? [1, 1, 1])));
  flat.applyMatrix4(_matrix);
  const positions = flat.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    _color.set(typeof color === "string" ? color : color(positions.getX(i), positions.getY(i), positions.getZ(i)));
    colors[i * 3] = _color.r; colors[i * 3 + 1] = _color.g; colors[i * 3 + 2] = _color.b;
  }
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return flat;
}

/** Merge pieces into one geometry (and free the pieces). */
export function mergePieces(pieces: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(pieces);
  pieces.forEach(item => item.dispose());
  if (!merged) throw new Error("Model pieces must share attributes");
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}
