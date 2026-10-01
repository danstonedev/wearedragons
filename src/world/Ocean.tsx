import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SEA_LEVEL, shorelineZ } from "../game/coast";
import { gameSession } from "../game/runtime";

/** One opaque draw, with shader waves rather than reflective render passes. */
export default function Ocean() {
  const geometry = useMemo(() => {
    const positions: number[] = [], indices: number[] = [];
    const columns = 160, rows = 24;
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const x = column / columns * 2400 - 1200;
      const start = shorelineZ(x) - 3;
      positions.push(x, SEA_LEVEL, start + row / rows * (900 - start));
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
    const mesh = new THREE.BufferGeometry();
    mesh.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); mesh.setIndex(indices);
    mesh.computeBoundingSphere();
    // Account for shader displacement when culling.
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 1;
    return mesh;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 } }]),
    vertexShader: `
      uniform float time;
      varying vec3 waterPosition;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        float shore = 140.0 + sin(p.x * 0.035) * 12.0 + cos(p.x * 0.079) * 5.0;
        float fade = smoothstep(0.0, 12.0, p.z - shore);
        p.y += (sin(p.x * 0.075 + p.z * 0.11 - time * 0.9) * 0.12 + sin(p.z * 0.17 + time * 0.7) * 0.06) * fade;
        waterPosition = p;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float time;
      varying vec3 waterPosition;
      #include <fog_pars_fragment>
      void main() {
        vec3 p = waterPosition;
        float shore = 140.0 + sin(p.x * 0.035) * 12.0 + cos(p.x * 0.079) * 5.0;
        float distance = p.z - shore;
        float ripple = sin(p.x * 0.22 + p.z * 0.33 - time * 1.3) * sin(p.z * 0.19 + time * 0.6);
        vec3 color = mix(vec3(0.13, 0.48, 0.48), vec3(0.035, 0.17, 0.29), smoothstep(0.0, 90.0, distance));
        color += max(0.0, ripple) * 0.065;
        float foam = (1.0 - smoothstep(0.0, 5.0, distance)) * (0.55 + 0.3 * sin(p.x * 0.3 - time));
        color = mix(color, vec3(0.75, 0.88, 0.83), foam);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  }), []);
  useFrame(() => { material.uniforms.time.value = gameSession.elapsed; });
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <mesh geometry={geometry} material={material} />;
}
