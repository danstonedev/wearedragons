import * as THREE from "three";

/** A tileable stone-and-grain bump texture for the ground. */
export function groundRelief(repeat = 1) {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const stone = Math.sin(x * 0.51) * Math.cos(y * 0.43) * 14;
    const grain = Math.sin(x * 2.73 + y * 1.91) * 9;
    const value = Math.max(0, Math.min(255, 145 + stone + grain));
    const at = (y * size + x) * 4;
    data[at] = data[at + 1] = data[at + 2] = value;
    data[at + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
