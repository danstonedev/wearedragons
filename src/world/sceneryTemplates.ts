import * as THREE from "three";
import type { SceneryItem, SceneryStyle } from "../game/scenery";

/** A template is plain arrays: positions, normals, colors, a sway weight per vertex, and indices. */
interface Template { positions: Float32Array; normals: Float32Array; colors: Float32Array; sway: Float32Array; indices: Uint32Array }

const color = new THREE.Color();
const matrix = new THREE.Matrix4();
const euler = new THREE.Euler();
const quaternion = new THREE.Quaternion();

interface Part { geometry: THREE.BufferGeometry; color: string; at?: [number, number, number]; rotate?: [number, number, number]; scale?: [number, number, number] }

/** Bake parts (each a primitive with a color and transform) into one template. */
function template(parts: Part[], height: number): Template {
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], sway: number[] = [], indices: number[] = [];
  const normal = new THREE.Matrix3();
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (const part of parts) {
    const geometry = part.geometry.index ? part.geometry : part.geometry.toNonIndexed();
    euler.set(...(part.rotate ?? [0, 0, 0]));
    matrix.compose(new THREE.Vector3(...(part.at ?? [0, 0, 0])), quaternion.setFromEuler(euler), new THREE.Vector3(...(part.scale ?? [1, 1, 1])));
    normal.getNormalMatrix(matrix);
    color.set(part.color);
    const base = positions.length / 3;
    const p = geometry.attributes.position, q = geometry.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      n.fromBufferAttribute(q, i).applyMatrix3(normal).normalize();
      positions.push(v.x, v.y, v.z);
      normals.push(n.x, n.y, n.z);
      colors.push(color.r, color.g, color.b);
      // Foliage high up sways more; trunks barely move.
      sway.push(Math.max(0, Math.min(1, v.y / height)) ** 2);
    }
    if (geometry.index) for (let i = 0; i < geometry.index.count; i++) indices.push(base + geometry.index.getX(i));
    else for (let i = 0; i < p.count; i++) indices.push(base + i);
    geometry.dispose();
    if (geometry !== part.geometry) part.geometry.dispose();
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors), sway: new Float32Array(sway), indices: new Uint32Array(indices) };
}

const cylinder = (top: number, bottom: number, height: number, sides: number) => new THREE.CylinderGeometry(top, bottom, height, sides);
const cone = (radius: number, height: number, sides: number) => new THREE.ConeGeometry(radius, height, sides);
const blob = (detail = 1) => new THREE.IcosahedronGeometry(1, detail);
const shard = () => new THREE.OctahedronGeometry(1, 0);

type Builder = { near: () => Template; far: (() => Template) | null };

const BUILDERS: Record<SceneryStyle, Builder> = {
  broadleaf: {
    near: () => template([
      { geometry: cylinder(0.15, 0.34, 3, 6), color: "#715240", at: [0, 1.5, 0] },
      { geometry: blob(1), color: "#547343", at: [-0.23, 3.25, 0], scale: [1.25, 1.32, 1.05] },
      { geometry: blob(1), color: "#69884e", at: [0.18, 4.2, -0.14], scale: [1.07, 1.18, 0.95] },
      { geometry: blob(1), color: "#5c7946", at: [0.7, 3.55, 0.36], scale: [0.92, 1.05, 0.94] },
    ], 5),
    far: () => template([
      { geometry: cylinder(0.15, 0.34, 3, 4), color: "#715240", at: [0, 1.5, 0] },
      { geometry: blob(0), color: "#5c7946", at: [0.1, 3.7, 0], scale: [1.5, 1.6, 1.4] },
    ], 5),
  },
  pine: {
    near: () => template([
      { geometry: cylinder(0.12, 0.26, 1.8, 5), color: "#5b4030", at: [0, 0.9, 0] },
      { geometry: cone(1.7, 2.6, 7), color: "#2f5a3a", at: [0, 2.4, 0] },
      { geometry: cone(1.35, 2.3, 7), color: "#36653f", at: [0, 3.7, 0] },
      { geometry: cone(0.95, 2.0, 7), color: "#3d7046", at: [0, 4.9, 0] },
    ], 6),
    far: () => template([{ geometry: cone(1.6, 5.4, 5), color: "#33613d", at: [0, 3.1, 0] }], 6),
  },
  snowpine: {
    near: () => template([
      { geometry: cylinder(0.12, 0.26, 1.8, 5), color: "#5b4030", at: [0, 0.9, 0] },
      { geometry: cone(1.7, 2.6, 7), color: "#4c6f63", at: [0, 2.4, 0] },
      { geometry: cone(1.35, 2.3, 7), color: "#9cb8b0", at: [0, 3.7, 0] },
      { geometry: cone(0.95, 2.0, 7), color: "#eef4f6", at: [0, 4.9, 0] },
    ], 6),
    far: () => template([{ geometry: cone(1.6, 5.4, 5), color: "#a9c2bc", at: [0, 3.1, 0] }], 6),
  },
  darkpine: {
    near: () => template([
      { geometry: cylinder(0.12, 0.26, 1.8, 5), color: "#3f3229", at: [0, 0.9, 0] },
      { geometry: cone(1.5, 3.0, 6), color: "#22392f", at: [0, 2.6, 0] },
      { geometry: cone(1.1, 2.6, 6), color: "#294436", at: [0, 4.1, 0] },
      { geometry: cone(0.7, 2.2, 6), color: "#2f4d3c", at: [0, 5.4, 0] },
    ], 6.5),
    far: () => template([{ geometry: cone(1.4, 6, 5), color: "#27412f", at: [0, 3.3, 0] }], 6.5),
  },
  palm: {
    near: () => {
      const parts: Part[] = [];
      for (let i = 0; i < 5; i++) parts.push({ geometry: cylinder(0.2, 0.26, 1.25, 6), color: i % 2 ? "#8b6a45" : "#7a5c3c", at: [i * i * 0.05, 0.6 + i * 1.18, 0], rotate: [0, 0, -0.05 * i] });
      for (let i = 0; i < 7; i++) {
        const angle = i / 7 * Math.PI * 2;
        parts.push({ geometry: cone(0.42, 2.8, 4), color: i % 2 ? "#4f8f3a" : "#5fa043", at: [0.8 + Math.cos(angle) * 1.2, 5.9, Math.sin(angle) * 1.2], rotate: [Math.sin(angle) * 1.25, 0, -Math.cos(angle) * 1.25], scale: [1, 1, 0.35] });
      }
      return template(parts, 6.5);
    },
    far: () => template([
      { geometry: cylinder(0.2, 0.26, 6, 4), color: "#7a5c3c", at: [0.3, 3, 0], rotate: [0, 0, -0.08] },
      { geometry: blob(0), color: "#529339", at: [0.8, 6, 0], scale: [2.2, 0.7, 2.2] },
    ], 6.5),
  },
  jungle: {
    near: () => template([
      { geometry: cylinder(0.45, 0.8, 11, 7), color: "#5a4632", at: [0, 5.5, 0] },
      { geometry: new THREE.BoxGeometry(0.25, 2.4, 1.6), color: "#5a4632", at: [0.75, 1.1, 0], rotate: [0, 0, 0] },
      { geometry: new THREE.BoxGeometry(1.6, 2.4, 0.25), color: "#5a4632", at: [0, 1.1, 0.75] },
      { geometry: new THREE.BoxGeometry(0.25, 2.2, 1.5), color: "#5a4632", at: [-0.7, 1.0, -0.2] },
      { geometry: blob(1), color: "#2e6b2e", at: [0, 11, 0], scale: [4.4, 1.6, 4.0] },
      { geometry: blob(1), color: "#3a7d34", at: [1.6, 12.2, -1], scale: [2.8, 1.3, 2.6] },
      { geometry: blob(1), color: "#357530", at: [-1.8, 11.8, 1.2], scale: [2.6, 1.2, 2.8] },
    ], 13),
    far: () => template([
      { geometry: cylinder(0.45, 0.8, 11, 5), color: "#5a4632", at: [0, 5.5, 0] },
      { geometry: blob(0), color: "#327331", at: [0, 11.4, 0], scale: [4.6, 1.8, 4.3] },
    ], 13),
  },
  deadtree: {
    near: () => template([
      { geometry: cylinder(0.12, 0.3, 4, 5), color: "#6b5a48", at: [0, 2, 0] },
      { geometry: cylinder(0.05, 0.1, 1.8, 4), color: "#6b5a48", at: [0.55, 3.1, 0], rotate: [0, 0, -0.9] },
      { geometry: cylinder(0.05, 0.1, 1.6, 4), color: "#5e4f40", at: [-0.45, 3.5, 0.2], rotate: [0.3, 0, 0.85] },
      { geometry: cylinder(0.04, 0.08, 1.2, 4), color: "#6b5a48", at: [0.1, 3.9, -0.45], rotate: [-0.8, 0, 0] },
    ], 4.5),
    far: () => template([{ geometry: cylinder(0.12, 0.3, 4, 4), color: "#6b5a48", at: [0, 2, 0] }], 4.5),
  },
  cactus: {
    near: () => template([
      { geometry: cylinder(0.36, 0.42, 3, 8), color: "#4f7a3a", at: [0, 1.5, 0] },
      { geometry: blob(1), color: "#4f7a3a", at: [0, 3, 0], scale: [0.36, 0.3, 0.36] },
      { geometry: cylinder(0.2, 0.22, 0.8, 6), color: "#567f3e", at: [0.55, 1.4, 0], rotate: [0, 0, Math.PI / 2] },
      { geometry: cylinder(0.2, 0.22, 1.1, 6), color: "#567f3e", at: [0.9, 1.9, 0] },
      { geometry: cylinder(0.18, 0.2, 0.7, 6), color: "#567f3e", at: [-0.5, 1.9, 0], rotate: [0, 0, Math.PI / 2] },
      { geometry: cylinder(0.18, 0.2, 0.9, 6), color: "#567f3e", at: [-0.8, 2.3, 0] },
    ], 3.2),
    far: () => template([{ geometry: cylinder(0.36, 0.42, 3, 5), color: "#4f7a3a", at: [0, 1.5, 0] }], 3.2),
  },
  acacia: {
    near: () => template([
      { geometry: cylinder(0.12, 0.25, 3.4, 5), color: "#6a5238", at: [0.2, 1.7, 0], rotate: [0, 0, -0.12] },
      { geometry: cylinder(0.06, 0.12, 1.4, 4), color: "#6a5238", at: [-0.2, 3.1, 0.2], rotate: [0.4, 0, 0.6] },
      { geometry: blob(1), color: "#6f7f3a", at: [0.4, 3.75, 0], scale: [3.0, 0.55, 2.7] },
    ], 4.2),
    far: () => template([
      { geometry: cylinder(0.12, 0.25, 3.4, 4), color: "#6a5238", at: [0.2, 1.7, 0] },
      { geometry: blob(0), color: "#6f7f3a", at: [0.4, 3.75, 0], scale: [3.0, 0.6, 2.7] },
    ], 4.2),
  },
  reeds: {
    near: () => {
      const parts: Part[] = [];
      for (let i = 0; i < 7; i++) {
        const angle = i * 2.4;
        parts.push({ geometry: cone(0.06, 1.7, 3), color: i % 3 ? "#8a8a4a" : "#6f7a3c", at: [Math.cos(angle) * 0.35, 0.8, Math.sin(angle) * 0.35], rotate: [Math.sin(angle) * 0.18, 0, Math.cos(angle) * 0.18] });
      }
      parts.push({ geometry: cylinder(0.07, 0.07, 0.4, 5), color: "#5b3f23", at: [0.1, 1.55, 0.05] });
      return template(parts, 1.7);
    },
    far: null,
  },
  rock: {
    near: () => template([{ geometry: blob(0), color: "#8b8172", at: [0, 0.25, 0], scale: [1, 0.6, 0.85] }], 10),
    far: null,
  },
  boulder: {
    near: () => template([{ geometry: blob(1), color: "#7d776c", at: [0, 0.6, 0], scale: [1.6, 1.15, 1.4] }], 10),
    far: () => template([{ geometry: blob(0), color: "#7d776c", at: [0, 0.6, 0], scale: [1.6, 1.15, 1.4] }], 10),
  },
  crystal: {
    near: () => template([
      { geometry: shard(), color: "#bfe8ff", at: [0, 1.9, 0], scale: [0.42, 2.2, 0.42], rotate: [0.08, 0, 0.05] },
      { geometry: shard(), color: "#9fd8f7", at: [0.6, 1.2, 0.2], scale: [0.3, 1.4, 0.3], rotate: [0, 0, -0.35] },
      { geometry: shard(), color: "#d8f3ff", at: [-0.5, 1.0, -0.3], scale: [0.28, 1.15, 0.28], rotate: [0.25, 0, 0.3] },
      { geometry: shard(), color: "#a8def8", at: [0.1, 0.6, 0.6], scale: [0.22, 0.75, 0.22], rotate: [-0.4, 0, 0] },
    ], 10),
    far: () => template([{ geometry: shard(), color: "#bfe8ff", at: [0, 1.9, 0], scale: [0.5, 2.2, 0.5] }], 10),
  },
  basalt: {
    near: () => template([
      { geometry: cylinder(0.55, 0.55, 4.6, 6), color: "#3f474c", at: [0, 2.3, 0] },
      { geometry: cylinder(0.5, 0.5, 3.4, 6), color: "#465056", at: [0.95, 1.7, 0.2] },
      { geometry: cylinder(0.5, 0.5, 2.5, 6), color: "#394146", at: [-0.5, 1.25, 0.85] },
      { geometry: cylinder(0.45, 0.45, 1.6, 6), color: "#4b555b", at: [0.3, 0.8, -0.9] },
    ], 10),
    far: () => template([{ geometry: cylinder(0.9, 1.0, 4.4, 6), color: "#40494e", at: [0.2, 2.2, 0.1] }], 10),
  },
  grass: {
    near: () => {
      const parts: Part[] = [];
      for (let i = 0; i < 4; i++) {
        const angle = i * 1.7;
        parts.push({ geometry: cone(0.09, 0.75, 3), color: i % 2 ? "#6e8b4d" : "#7f9a55", at: [Math.cos(angle) * 0.2, 0.36, Math.sin(angle) * 0.2], rotate: [Math.sin(angle) * 0.3, 0, Math.cos(angle) * 0.3] });
      }
      return template(parts, 0.8);
    },
    far: null,
  },
  bush: {
    near: () => template([
      { geometry: blob(1), color: "#4e6b3a", at: [0, 0.5, 0], scale: [1.0, 0.75, 1.0] },
      { geometry: blob(0), color: "#5b7a42", at: [0.5, 0.45, 0.3], scale: [0.6, 0.5, 0.6] },
    ], 1.4),
    far: null,
  },
  drybush: {
    near: () => template([
      { geometry: blob(0), color: "#7d7444", at: [0, 0.35, 0], scale: [0.8, 0.5, 0.8] },
      { geometry: blob(0), color: "#8a7a4c", at: [0.35, 0.3, -0.2], scale: [0.5, 0.35, 0.5] },
    ], 1),
    far: null,
  },
};

const cache = new Map<string, Template | null>();
function templateFor(style: SceneryStyle, far: boolean) {
  const key = `${style}:${far}`;
  if (!cache.has(key)) {
    const builder = BUILDERS[style];
    cache.set(key, far ? builder.far?.() ?? null : builder.near());
  }
  return cache.get(key)!;
}

const up = new THREE.Vector3(0, 1, 0);
/**
 * Bake a chunk's scenery into one geometry (one draw call). Each item is scaled,
 * turned, tinted, and placed on the ground in world space.
 */
export function mergeScenery(items: readonly SceneryItem[], far: boolean): THREE.BufferGeometry | null {
  let vertexCount = 0, indexCount = 0;
  for (const item of items) {
    const t = templateFor(item.style, far);
    if (!t) continue;
    vertexCount += t.positions.length / 3;
    indexCount += t.indices.length;
  }
  if (!vertexCount) return null;
  const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), colors = new Float32Array(vertexCount * 3);
  const sway = new Float32Array(vertexCount), indices = new Uint32Array(indexCount);
  const transform = new THREE.Matrix4(), normal = new THREE.Matrix3(), v = new THREE.Vector3(), n = new THREE.Vector3();
  const scale = new THREE.Vector3(), place = new THREE.Vector3();
  let vertex = 0, index = 0;
  for (const item of items) {
    const t = templateFor(item.style, far);
    if (!t) continue;
    transform.compose(place.set(item.x, item.y, item.z), quaternion.setFromAxisAngle(up, item.rotation), scale.setScalar(item.scale));
    normal.getNormalMatrix(transform);
    const shade = 0.82 + item.tint * 0.36;
    const count = t.positions.length / 3;
    for (let i = 0; i < count; i++) {
      v.set(t.positions[i * 3], t.positions[i * 3 + 1], t.positions[i * 3 + 2]).applyMatrix4(transform);
      n.set(t.normals[i * 3], t.normals[i * 3 + 1], t.normals[i * 3 + 2]).applyMatrix3(normal).normalize();
      const at = (vertex + i) * 3;
      positions[at] = v.x; positions[at + 1] = v.y; positions[at + 2] = v.z;
      normals[at] = n.x; normals[at + 1] = n.y; normals[at + 2] = n.z;
      colors[at] = t.colors[i * 3] * shade; colors[at + 1] = t.colors[i * 3 + 1] * shade; colors[at + 2] = t.colors[i * 3 + 2] * shade;
      sway[vertex + i] = t.sway[i] * item.scale;
    }
    for (let i = 0; i < t.indices.length; i++) indices[index++] = vertex + t.indices[i];
    vertex += count;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSway", new THREE.BufferAttribute(sway, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** One shared material for all scenery: vertex colors and a gentle wind sway. */
export function createSceneryMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const time = { value: 0 };
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSway;\nuniform float uTime;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        float gust = sin(uTime * 1.3 + position.x * 0.05) * 0.5 + 0.5;
        transformed.x += sin(uTime * 1.7 + position.x * 0.21 + position.z * 0.17) * aSway * (0.08 + gust * 0.1);
        transformed.z += cos(uTime * 1.4 + position.z * 0.19 + position.x * 0.07) * aSway * 0.07;`);
  };
  material.customProgramCacheKey = () => "scenery-sway";
  return { material, time };
}
