# We Are Dragons

A browser-based dragon flight and action prototype built with React, TypeScript, Three.js, React Three Fiber, and Rapier physics. It includes 15 dragons, four missions, a free-flight world spanning three regions, and touch controls.

The modernization work fixes core simulation and mission issues and adds **experimental Quest browser VR**. The current graphics branch rebuilds the environment as a continuous mountain landscape with collision-matched terrain, distant ridgelines, moving clouds, an animated lake, paths, biome rock formations, organic forests, grass, and new mission architecture. Rendered gameplay, headset comfort, and device performance still need hardware validation before release.

## Run locally

Use Node.js 24 or later.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, including `/wearedragons/`.

```sh
npm test         # Mission, flight, input, real Rapier collision, and GLB animation checks
npm run lint
npm run build   # Type-check and produce dist/
npm run preview
```

The GitHub Pages workflow runs these checks before publishing a push to `main`.

## Controls

| Action | Desktop | Quest controllers (experimental) |
| --- | --- | --- |
| Forward / reverse | W / S or Up / Down | Left stick forward / back |
| Turn | A / D or Left / Right | Right stick left / right: 45° snap turn |
| Climb / descend | Space / Shift | Right stick up / down |
| Brake | Release movement keys | Release left stick or hold left grip |
| Fire | Hold F | Hold right trigger |
| Special ability | Press Q | Press left trigger |
| Pause / resume | Escape or Pause button | X |
| Exit immersive VR | — | Y |
| Look around | Drag the scene | Head tracking |
| World map | M in free flight | Available outside immersive VR |

For Quest, open an HTTPS build in a WebXR-capable browser, choose a dragon and a mission or free flight, then select **Enter VR**. The button appears only when immersive VR is supported and its runtime has loaded. Mission selection and results currently use the browser page outside VR. Hand tracking is not supported.

The headset camera follows position and yaw without copying the dragon's pitch or bank. Initial settings cap flight speed in VR and favor a 72 Hz session where available; these are starting values, not a verified comfort or performance rating.

## Current scope

- **Beacon Ridge:** destroy three towers, dodge or defeat the flying Raider Scout, then activate the beacon.
- **Sky Circuit:** pass eight checkpoints within 90 seconds.
- **Ridge Defense:** clear three waves of towers.
- **Jade Citadel Strike:** displace 40 of 64 castle blocks within 120 seconds.
- **Free flight:** explore Pyrrhia, Pantala, and Glaeryus and discover their beacons.

Flight now accelerates and brakes smoothly, with capsule sweeps against physical terrain, towers, and castle blocks, slower ground movement, and visible grounded/takeoff/landing/dive/cruise/hover states. Aiming guidance, enemy health bars, impact bursts, and hit confirmations improve combat readability. The Raider Scout in Beacon Ridge patrols and intercepts, telegraphs a shot, evades, and retreats at close range. Cloak breaks its targeting; defeating it removes the airborne threat, while the three towers remain the mission objective. The rebuilt environment uses one height source for rendering, collision, paths, vegetation, and landmarks. Forest trunks and larger boulders have colliders; grass and small stones remain decorative. Distant mountains, moving clouds, terrain relief, varied ground color, paths, animated water, biome formations, layered trees, rounded castle masonry, rebuilt towers/beacons, and depth-tuned lighting establish the new visual direction. The roster now has six silhouette families with armor, barbs, fins, spines, frills, or swept horns, plus shared scale relief. Authored replacement dragon meshes, bone-bound adornments, and animation/audio remain future work. Player projectiles use continuous Rapier collision detection; enemy shots use swept hit tests. Mission progress uses functional updates and unique event identities. Armor, healing, cloak, and barrel-roll protection affect combat. Settings, the world map, tab visibility, and manual pause stop the simulation.

## Development guide

Start with [the modernization audit and prioritized plan](docs/modernization-audit.md). It distinguishes code-confirmed fixes from unverified graphics and VR work, and describes the next playable slice.

| Area | Location |
| --- | --- |
| Screens, world assembly, mission integration | `src/App.tsx` |
| Flight, abilities, mission state, session lifecycle | `src/game/` |
| Player, projectiles, towers, flying scout, atmosphere | `src/world/` |
| Desktop / touch / XR inputs and settings | `src/controls/` |
| Optional immersive runtime and headset HUD | `src/vr/` |
| Dragon data, materials, selection | `src/dragons.ts`, `src/DragonSelect.tsx` |
| Regression checks | `tests/` |

The [original gameplay roadmap](docs/gameplay-roadmap.md) remains available as historical narrative and design planning. Several of its initial milestones have already been implemented.
