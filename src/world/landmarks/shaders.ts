import * as THREE from "three";

/** One clock for every landmark shader, advanced by the Landmarks root. */
export const landmarkTime = { value: 0 };

function fogShader(parameters: { uniforms?: Record<string, THREE.IUniform>; vertex: string; fragment: string; transparent?: boolean; additive?: boolean; side?: THREE.Side; fog?: boolean }) {
  const fog = parameters.fog ?? true;
  // merge() clones uniforms, so the shared clock is attached afterwards.
  const uniforms = THREE.UniformsUtils.merge([fog ? THREE.UniformsLib.fog : {}, parameters.uniforms ?? {}]);
  uniforms.time = landmarkTime;
  return new THREE.ShaderMaterial({
    fog,
    transparent: parameters.transparent ?? false,
    depthWrite: !parameters.transparent,
    side: parameters.side ?? THREE.FrontSide,
    blending: parameters.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms,
    vertexShader: `
      uniform float time;
      varying vec3 vWorld;
      varying vec2 vUv;
      ${fog ? "#include <fog_pars_vertex>" : ""}
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        ${parameters.vertex}
        ${fog ? "#include <fog_vertex>" : ""}
      }`,
    fragmentShader: `
      uniform float time;
      varying vec3 vWorld;
      varying vec2 vUv;
      ${fog ? "#include <fog_pars_fragment>" : ""}
      ${parameters.fragment}
    `,
  });
}

const fragmentTail = `
        #include <tonemapping_fragment>
        #include <colorspace_fragment>`;

/** Still water with soft moving ripples (lakes, the oasis, the falls' pool). */
export function createWaterMaterial(shallow: string, deep: string, rippleScale = 1) {
  const material = fogShader({
    uniforms: { shallow: { value: new THREE.Color(shallow) }, deep: { value: new THREE.Color(deep) }, rippleScale: { value: rippleScale } },
    vertex: "",
    fragment: `
      uniform vec3 shallow;
      uniform vec3 deep;
      uniform float rippleScale;
      void main() {
        vec2 p = vWorld.xz * 0.25 * rippleScale;
        float ripple = sin(p.x * 1.3 + time * 0.9) * sin(p.y * 1.1 - time * 0.7) + sin((p.x + p.y) * 0.7 + time * 0.5) * 0.5;
        vec3 color = mix(deep, shallow, 0.55 + 0.25 * ripple);
        color += smoothstep(0.75, 1.2, ripple) * 0.12;
        gl_FragColor = vec4(color, 1.0);
        ${fragmentTail}
        #include <fog_fragment>
      }`,
  });
  return material;
}

/** Glowing, churning lava with dark crust drifting over it. */
export function createLavaMaterial() {
  return fogShader({
    vertex: "",
    fragment: `
      float wave(vec2 p) { return sin(p.x) * sin(p.y); }
      void main() {
        vec2 p = vWorld.xz * 0.18;
        float crust = wave(p + vec2(time * 0.21, time * 0.13)) + wave(p * 1.9 - vec2(time * 0.11, -time * 0.17)) * 0.6;
        float heat = smoothstep(-0.2, 0.9, -crust);
        vec3 color = mix(vec3(0.25, 0.04, 0.02), vec3(1.0, 0.45, 0.08), heat);
        color = mix(color, vec3(1.0, 0.85, 0.35), smoothstep(0.85, 1.0, heat) * 0.7);
        gl_FragColor = vec4(color * 1.6, 1.0);
        ${fragmentTail}
        #include <fog_fragment>
      }`,
  });
}

/** Falling water: bright streaks racing down the sheet (uv.y runs top to bottom). */
export function createFallsMaterial() {
  return fogShader({
    transparent: true,
    side: THREE.DoubleSide,
    vertex: "",
    fragment: `
      void main() {
        float streak = sin(vUv.x * 70.0 + sin(vUv.x * 13.0) * 3.0) * 0.5 + 0.5;
        float flow = fract(vUv.y * 3.0 - time * 1.4 + streak * 0.35);
        vec3 color = mix(vec3(0.55, 0.75, 0.85), vec3(0.95, 0.98, 1.0), smoothstep(0.3, 1.0, flow) * streak);
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        gl_FragColor = vec4(color, (0.7 + 0.25 * streak) * edge);
        ${fragmentTail}
        #include <fog_fragment>
      }`,
  });
}

/**
 * Northern lights: soft curtains of green and violet that ripple slowly. Never fogged,
 * and blended normally rather than added, so they still show against a bright day sky.
 */
export function createAuroraMaterial() {
  return fogShader({
    fog: false,
    transparent: true,
    side: THREE.DoubleSide,
    vertex: "",
    fragment: `
      void main() {
        float bands = sin(vUv.x * 40.0 + time * 0.4 + sin(vUv.x * 9.0 + time * 0.2) * 2.0) * 0.5 + 0.5;
        float fall = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        vec3 color = mix(vec3(0.1, 0.85, 0.5), vec3(0.5, 0.3, 0.95), smoothstep(0.4, 1.0, vUv.y));
        float edges = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        gl_FragColor = vec4(color, (0.12 + 0.4 * bands) * fall * edges);
        ${fragmentTail}
      }`,
  });
}

/** A windway's visible core: pale streaks racing along the current (uv.x runs along it). */
export function createWindMaterial(streaks: number) {
  return fogShader({
    transparent: true,
    additive: true,
    side: THREE.DoubleSide,
    uniforms: { streaks: { value: streaks } },
    vertex: "",
    fragment: `
      uniform float streaks;
      void main() {
        float lane = sin(vUv.y * 6.2832 * 3.0) * 0.5 + 0.5;
        float flow = fract(vUv.x * streaks - time * 0.9 + lane * 0.37);
        float streak = smoothstep(0.7, 0.98, flow) * (0.55 + 0.45 * lane);
        vec3 color = mix(vec3(0.75, 0.92, 1.0), vec3(1.0), streak);
        // Fade out around the camera so riding inside a current never whites out the view.
        float near = smoothstep(5.0, 22.0, distance(vWorld, cameraPosition));
        gl_FragColor = vec4(color * (0.025 + streak * 0.32) * near, 1.0);
        ${fragmentTail}
        #include <fog_fragment>
      }`,
  });
}
