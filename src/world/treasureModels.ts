import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { TreasureKind } from "../game/loot";

type Vec3 = [number, number, number];
interface Placement { p?: Vec3; r?: Vec3; s?: Vec3 }

const _matrix = new THREE.Matrix4();
const _quaternion = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _color = new THREE.Color();

/** One colored, transformed, non-indexed piece of a merged treasure model. */
function piece(geometry: THREE.BufferGeometry, color: string | ((x: number, y: number, z: number) => string), place: Placement = {}) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  _quaternion.setFromEuler(_euler.set(...(place.r ?? [0, 0, 0])));
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

function merge(pieces: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(pieces);
  pieces.forEach(item => item.dispose());
  if (!merged) throw new Error("Treasure pieces must share attributes");
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

const GOLD = "#f4c34a", GOLD_DARK = "#d39a2a", SILVER = "#dfe7ef", WOOD = "#6b4423", WOOD_LIGHT = "#86592f", IRON = "#5f6266";

function ringAround(count: number, radius: number, make: (angle: number, x: number, z: number, i: number) => THREE.BufferGeometry) {
  return Array.from({ length: count }, (_, i) => {
    const angle = i / count * Math.PI * 2;
    return make(angle, Math.cos(angle) * radius, Math.sin(angle) * radius, i);
  });
}

function coins() {
  const coin = (p: Vec3, r: Vec3 = [0, 0, 0], color = GOLD) => piece(new THREE.CylinderGeometry(0.15, 0.15, 0.045, 14), color, { p, r });
  const stacks: THREE.BufferGeometry[] = [];
  for (const [x, z, count] of [[0, 0, 5], [0.3, 0.12, 3], [-0.24, 0.2, 4]] as const) {
    for (let i = 0; i < count; i++) stacks.push(coin([x + Math.sin(i * 2.1) * 0.02, 0.0225 + i * 0.047, z + Math.cos(i * 1.7) * 0.02], [0, 0, 0], i % 2 ? GOLD_DARK : GOLD));
  }
  return merge([
    ...stacks,
    coin([0.18, 0.08, -0.28], [0.25, 0, 0.4]), coin([-0.36, 0.07, -0.1], [-0.3, 0, 0.2], GOLD_DARK), coin([0.45, 0.06, 0.36], [0.2, 0, -0.3]),
    piece(new THREE.SphereGeometry(0.22, 12, 9), "#7a4b2a", { p: [-0.12, 0.2, -0.26], s: [1, 0.85, 1] }),
    piece(new THREE.CylinderGeometry(0.06, 0.09, 0.1, 10), "#6a3f22", { p: [-0.12, 0.4, -0.26] }),
    piece(new THREE.TorusGeometry(0.075, 0.018, 6, 14), "#c9a35c", { p: [-0.12, 0.38, -0.26], r: [Math.PI / 2, 0, 0] }),
  ]);
}

function goblet() {
  const profile = [[0, 0], [0.2, 0], [0.21, 0.03], [0.07, 0.07], [0.045, 0.13], [0.045, 0.32], [0.09, 0.37], [0.18, 0.44], [0.22, 0.58], [0.23, 0.7], [0.205, 0.7], [0.19, 0.6], [0.15, 0.5], [0, 0.46]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  return merge([
    piece(new THREE.LatheGeometry(profile, 20), SILVER),
    piece(new THREE.TorusGeometry(0.218, 0.018, 6, 24), GOLD, { p: [0, 0.6, 0], r: [Math.PI / 2, 0, 0] }),
    ...ringAround(4, 0.205, (angle, x, z) => piece(new THREE.OctahedronGeometry(0.04, 0), angle < 3 ? "#e0304a" : "#3a7bff", { p: [x, 0.5, z] })),
  ]);
}

function crown() {
  const band = [[0.25, 0], [0.31, 0], [0.32, 0.17], [0.26, 0.17], [0.25, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  return merge([
    piece(new THREE.LatheGeometry(band, 24), GOLD),
    piece(new THREE.SphereGeometry(0.255, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), "#8e1b2e", { p: [0, 0.05, 0], s: [1, 0.7, 1] }),
    ...ringAround(7, 0.29, (angle, x, z) => piece(new THREE.ConeGeometry(0.055, 0.2, 6), GOLD, { p: [x, 0.26, z], r: [0, -angle, 0] })),
    ...ringAround(7, 0.29, (_, x, z) => piece(new THREE.SphereGeometry(0.032, 8, 6), GOLD_DARK, { p: [x, 0.37, z] })),
    ...ringAround(7, 0.318, (_, x, z, i) => piece(new THREE.OctahedronGeometry(0.04, 0), i % 2 ? "#3a7bff" : "#e0304a", { p: [x, 0.085, z] })),
  ]);
}

function gem() {
  return merge([
    piece(new THREE.OctahedronGeometry(0.3, 0), "#ffffff", { p: [0, 0.42, 0], s: [0.78, 1.38, 0.78] }),
    piece(new THREE.OctahedronGeometry(0.15, 0), "#f2f2f2", { p: [0.22, 0.17, 0.05], r: [0, 0.4, -0.55], s: [0.7, 1.4, 0.7] }),
    piece(new THREE.OctahedronGeometry(0.13, 0), "#e8e8e8", { p: [-0.18, 0.15, -0.1], r: [0.3, 0, 0.6], s: [0.7, 1.4, 0.7] }),
  ]);
}

function chest() {
  const bands = [-0.38, 0, 0.38].flatMap(x => [
    piece(new THREE.BoxGeometry(0.07, 0.52, 0.645), GOLD_DARK, { p: [x, 0.26, 0] }),
    piece(new THREE.CylinderGeometry(0.325, 0.325, 0.07, 14, 1, false, 0, Math.PI), GOLD_DARK, { p: [x, 0.52, 0], r: [0, 0, Math.PI / 2] }),
  ]);
  return merge([
    piece(new THREE.BoxGeometry(1, 0.52, 0.62), WOOD, { p: [0, 0.26, 0] }),
    piece(new THREE.CylinderGeometry(0.31, 0.31, 1, 14, 1, false, 0, Math.PI), WOOD_LIGHT, { p: [0, 0.52, 0], r: [0, 0, Math.PI / 2] }),
    ...bands,
    piece(new THREE.BoxGeometry(0.14, 0.17, 0.05), GOLD, { p: [0, 0.48, 0.33] }),
    piece(new THREE.CylinderGeometry(0.15, 0.15, 0.045, 12), GOLD, { p: [0.62, 0.025, 0.2] }),
    piece(new THREE.CylinderGeometry(0.15, 0.15, 0.045, 12), GOLD, { p: [-0.6, 0.07, 0.3], r: [0.3, 0, 0.2] }),
  ]);
}

function scroll() {
  return merge([
    piece(new THREE.CylinderGeometry(0.1, 0.1, 0.68, 14), "#ecdcae", { p: [0, 0.11, 0], r: [0, 0, Math.PI / 2] }),
    piece(new THREE.CylinderGeometry(0.03, 0.03, 0.86, 8), "#4a2c17", { p: [0, 0.11, 0], r: [0, 0, Math.PI / 2] }),
    piece(new THREE.SphereGeometry(0.052, 10, 8), GOLD, { p: [0.44, 0.11, 0] }),
    piece(new THREE.SphereGeometry(0.052, 10, 8), GOLD, { p: [-0.44, 0.11, 0] }),
    piece(new THREE.TorusGeometry(0.105, 0.02, 6, 16), "#b3283a", { p: [0, 0.11, 0], r: [0, Math.PI / 2, 0] }),
    piece(new THREE.CylinderGeometry(0.05, 0.05, 0.025, 10), "#8f1f2c", { p: [0, 0.11, 0.105], r: [Math.PI / 2, 0, 0] }),
    piece(new THREE.BoxGeometry(0.5, 0.006, 0.26), "#e4d09c", { p: [0.02, 0.006, 0.2], r: [0, 0.08, 0] }),
  ]);
}

function orb() {
  return merge([
    piece(new THREE.SphereGeometry(0.28, 18, 14), "#ffffff", { p: [0, 0.43, 0] }),
    piece(new THREE.SphereGeometry(0.1, 10, 8), "#d8f6ff", { p: [0.08, 0.5, 0.17] }),
    piece(new THREE.CylinderGeometry(0.13, 0.21, 0.13, 14), "#f0d890", { p: [0, 0.065, 0] }),
    piece(new THREE.TorusGeometry(0.15, 0.025, 6, 18), "#f0d890", { p: [0, 0.17, 0], r: [Math.PI / 2, 0, 0] }),
  ]);
}

function idol() {
  return merge([
    piece(new THREE.BoxGeometry(0.36, 0.08, 0.32), "#cfc6b4", { p: [0, 0.04, 0] }),
    piece(new THREE.SphereGeometry(0.17, 14, 10), "#f2ead8", { p: [0, 0.27, 0], s: [1, 1.3, 0.9] }),
    piece(new THREE.SphereGeometry(0.105, 12, 9), "#f2ead8", { p: [0, 0.52, 0.02] }),
    piece(new THREE.BoxGeometry(0.3, 0.17, 0.03), "#e6dcc6", { p: [-0.2, 0.33, -0.04], r: [0, 0.4, 0.35] }),
    piece(new THREE.BoxGeometry(0.3, 0.17, 0.03), "#e6dcc6", { p: [0.2, 0.33, -0.04], r: [0, -0.4, -0.35] }),
    piece(new THREE.SphereGeometry(0.024, 6, 5), "#1b1b1b", { p: [-0.04, 0.54, 0.11] }),
    piece(new THREE.SphereGeometry(0.024, 6, 5), "#1b1b1b", { p: [0.04, 0.54, 0.11] }),
    piece(new THREE.ConeGeometry(0.03, 0.12, 6), "#e6dcc6", { p: [-0.05, 0.64, 0], r: [0, 0, 0.4] }),
    piece(new THREE.ConeGeometry(0.03, 0.12, 6), "#e6dcc6", { p: [0.05, 0.64, 0], r: [0, 0, -0.4] }),
  ]);
}

function pearl() {
  const shell = (y: number) => y > 0.18 ? "#f3d2cc" : "#e2b2ad";
  return merge([
    piece(new THREE.SphereGeometry(0.34, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), shell, { p: [0, 0.13, 0], s: [1, 0.38, 0.86] }),
    piece(new THREE.SphereGeometry(0.34, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), shell, { p: [0, 0.25, -0.25], r: [-1.05, 0, 0], s: [1, 0.38, 0.86] }),
    piece(new THREE.SphereGeometry(0.135, 16, 12), "#fbf8ff", { p: [0, 0.2, 0.03] }),
  ]);
}

function fruit() {
  const mango = (_x: number, y: number, z: number) => y + z * 0.35 > 0.24 ? "#e2452b" : y + z * 0.35 > 0.14 ? "#f28c28" : "#d6c534";
  return merge([
    piece(new THREE.SphereGeometry(0.2, 16, 12), mango, { p: [0, 0.18, 0], s: [0.95, 0.85, 1.25] }),
    piece(new THREE.CylinderGeometry(0.012, 0.016, 0.08, 6), "#5b3a1e", { p: [0, 0.36, -0.08], r: [0.35, 0, 0] }),
    piece(new THREE.ConeGeometry(0.075, 0.26, 4), "#3f8f3a", { p: [0.06, 0.38, -0.16], r: [1.2, 0.3, -0.4], s: [1, 1, 0.22] }),
  ]);
}

function spool() {
  const thread = (_x: number, y: number) => Math.sin(y * 70) > 0 ? "#ffb347" : "#ff7b2e";
  return merge([
    piece(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 18), "#8a5a2b", { p: [0, 0.025, 0] }),
    piece(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 18), "#8a5a2b", { p: [0, 0.505, 0] }),
    piece(new THREE.CylinderGeometry(0.165, 0.165, 0.43, 18, 6), thread, { p: [0, 0.265, 0] }),
    piece(new THREE.TorusGeometry(0.2, 0.01, 4, 20, Math.PI * 0.8), "#ffc35c", { p: [0.05, 0.12, 0.05], r: [1.3, 0.2, 0] }),
  ]);
}

function kettle() {
  const rust = (x: number, y: number, z: number) => Math.sin(x * 31 + z * 17) + Math.cos(y * 23) > 0.9 ? "#5c2f1b" : "#8a4b2a";
  return merge([
    piece(new THREE.SphereGeometry(0.22, 16, 12), rust, { p: [0, 0.2, 0], s: [1, 0.82, 1] }),
    piece(new THREE.SphereGeometry(0.11, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), "#7a3f22", { p: [0, 0.35, 0], s: [1, 0.5, 1] }),
    piece(new THREE.SphereGeometry(0.03, 8, 6), "#4a2614", { p: [0, 0.4, 0] }),
    piece(new THREE.CylinderGeometry(0.028, 0.055, 0.26, 8), rust, { p: [0.25, 0.25, 0], r: [0, 0, -0.95] }),
    piece(new THREE.TorusGeometry(0.15, 0.02, 6, 14, Math.PI), "#4a2614", { p: [0, 0.34, 0], r: [0, Math.PI / 2, 0] }),
  ]);
}

function boot() {
  return merge([
    piece(new THREE.BoxGeometry(0.17, 0.32, 0.19), "#5b3a22", { p: [0, 0.22, -0.06] }),
    piece(new THREE.BoxGeometry(0.18, 0.11, 0.3), "#5b3a22", { p: [0, 0.07, 0.07] }),
    piece(new THREE.SphereGeometry(0.095, 10, 8), "#5b3a22", { p: [0, 0.07, 0.22], s: [0.95, 0.65, 0.8] }),
    piece(new THREE.BoxGeometry(0.19, 0.025, 0.42), "#2e1d12", { p: [0, 0.012, 0.05] }),
    piece(new THREE.BoxGeometry(0.175, 0.04, 0.2), "#c9b38a", { p: [0, 0.39, -0.06] }),
    piece(new THREE.BoxGeometry(0.11, 0.08, 0.012), "#d8c6a0", { p: [0, 0.18, 0.035] }),
  ]);
}

function trinket() {
  return merge([
    piece(new THREE.SphereGeometry(0.2, 12, 9), "#a08460", { p: [0, 0.15, 0], s: [1, 0.75, 1] }),
    piece(new THREE.SphereGeometry(0.07, 8, 6), "#8a6e4c", { p: [0, 0.3, 0] }),
    piece(new THREE.ConeGeometry(0.05, 0.12, 6), "#a08460", { p: [-0.06, 0.36, 0], r: [0, 0, 0.6] }),
    piece(new THREE.ConeGeometry(0.05, 0.12, 6), "#a08460", { p: [0.06, 0.36, 0], r: [0, 0, -0.6] }),
    piece(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), SILVER, { p: [0.1, 0.3, 0.08], r: [0.3, 0, -0.5] }),
    piece(new THREE.SphereGeometry(0.045, 8, 6), SILVER, { p: [0.18, 0.44, 0.13], s: [1, 0.35, 1.4] }),
  ]);
}

function hourglass() {
  return merge([
    piece(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14), GOLD, { p: [0, 0.025, 0] }),
    piece(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14), GOLD, { p: [0, 0.625, 0] }),
    ...ringAround(3, 0.16, (_, x, z) => piece(new THREE.CylinderGeometry(0.018, 0.018, 0.56, 6), GOLD_DARK, { p: [x, 0.325, z] })),
    piece(new THREE.ConeGeometry(0.14, 0.27, 14), "#f4d58d", { p: [0, 0.185, 0] }),
    piece(new THREE.ConeGeometry(0.14, 0.27, 14), "#fbe7b5", { p: [0, 0.465, 0], r: [Math.PI, 0, 0] }),
  ]);
}

function harp() {
  return merge([
    piece(new THREE.BoxGeometry(0.42, 0.06, 0.14), "#d9cfb3", { p: [0, 0.03, 0] }),
    piece(new THREE.TorusGeometry(0.27, 0.035, 6, 18, Math.PI * 1.15), "#e9e1c9", { p: [0, 0.3, 0], r: [0, 0, -0.08] }),
    piece(new THREE.CylinderGeometry(0.03, 0.035, 0.32, 8), "#e9e1c9", { p: [-0.2, 0.18, 0], r: [0, 0, -0.25] }),
    ...[-0.12, -0.04, 0.04, 0.12].map(x => piece(new THREE.CylinderGeometry(0.005, 0.005, 0.42 - Math.abs(x) * 1.2, 4), "#fff6dd", { p: [x, 0.27 - Math.abs(x) * 0.5, 0] })),
    piece(new THREE.SphereGeometry(0.05, 8, 6), "#e9e1c9", { p: [0.26, 0.42, 0] }),
  ]);
}

function shield() {
  const face = (x: number, y: number) => Math.abs(x) < 0.07 || Math.abs(y - 0.33) < 0.05 ? "#b33a2e" : "#8a6239";
  return merge([
    piece(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 20), face, { p: [0, 0.33, 0], r: [Math.PI / 2 - 0.35, 0, 0] }),
    piece(new THREE.TorusGeometry(0.32, 0.026, 6, 22), IRON, { p: [0, 0.33, 0], r: [-0.35, 0, 0] }),
    piece(new THREE.SphereGeometry(0.085, 10, 8), IRON, { p: [0, 0.34, 0.035], s: [1, 1, 0.6] }),
  ]);
}

const BUILDERS: Record<TreasureKind, () => THREE.BufferGeometry> = {
  coins, goblet, crown, gem, chest, scroll, orb, idol, pearl, fruit, spool, kettle, boot, trinket, hourglass, harp, shield,
};

let cache: Map<TreasureKind, THREE.BufferGeometry> | undefined;

/** Geometry is built once per page and shared by the open world and every lair. */
export function treasureGeometry(kind: TreasureKind) {
  cache ??= new Map();
  let geometry = cache.get(kind);
  if (!geometry) {
    geometry = BUILDERS[kind]();
    cache.set(kind, geometry);
  }
  return geometry;
}

/** Visual center height of a model, used for dangling and pickup checks. */
export function treasureCenter(kind: TreasureKind) {
  const box = treasureGeometry(kind).boundingBox!;
  return (box.min.y + box.max.y) / 2;
}

/** Vertex/instance colors drive a little self-glow so loot reads in shade and at distance. */
export function createTreasureMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.18 });
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * 0.24;",
    );
  };
  material.customProgramCacheKey = () => "treasure-glow";
  return material;
}

export const RARITY_COLORS = { junk: "#b49a7a", common: "#ffe9a8", rare: "#7fe7ff", legendary: "#e59bff" } as const;
