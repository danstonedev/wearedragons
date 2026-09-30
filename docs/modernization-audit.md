# We Are Dragons: modernization audit and development plan

## Recommendation

Keep the browser engine and make **Beacon Ridge a polished 5–10 minute dragon action slice for desktop and Quest browser**. Stabilize simulation and combat, make flight satisfying, add one capable flying enemy, then improve terrain, sound, and the dragon presentation. Expand the campaign only after that slice is fun and meets its device budgets.

AI coding can accelerate implementation, refactoring, test coverage, profiling tools, and content authoring. The project still needs playtesting, animation and art direction, sound, and actual headset measurements. More generated code alone will not establish good flight feel or a comfortable VR experience.

## Evidence and limits

- Baseline examined: `main` at `93b74481760adbda31578ab5406e7b09273c4d61` (June 27, 2026), plus the repository's deployed GitHub Pages menu flow.
- Work included source review of the player, controls, materials, animation, mission reducers, tower combat, projectile simulation, world assembly, castle destruction, settings, packaging, and deployment configuration.
- The baseline production build succeeded. Baseline lint reported 33 errors and one warning, and the repository had no automated game tests.
- The cloud browser could navigate the deployed selection and mission menus, but its GPU/WebGL was disabled. Local preview URLs were also blocked by that browser. **Rendered flight, the new atmosphere, real controller sessions, frame rates, and VR comfort were not validated.**
- The graphics review branch passes 43 automated tests, lint, and a production build. Tests include real Rapier WASM collisions, matching terrain render/collision buffers, six complete dragon silhouette families, and parsing/animating the actual dragon GLB. They do not substitute for an end-to-end rendered playtest.

## Second-pass implementation update

The merged foundation added collision-aware flight, flight-mode/speed feedback, world-space aim guidance, enemy health bars, bounded instanced impact/destruction bursts, and desktop hit confirmations. Muzzle origins are clipped to the player side of walls so the visual dragon neck cannot let shots spawn behind blocking geometry. Aim guidance indicates the initial shot direction including inherited flight velocity; it is not a ballistic prediction for gravity/spread attacks.

Rapier is now an explicit dependency pinned to `0.19.2`, matching React Three Rapier. Earlier test resolution picked up an older `0.12.0` package from Three's type dependencies. A regression test checks that the test suite and runtime resolve the same package, and the existing projectile checks were rerun on the correct engine. New real-world tests cover thin walls across 30/60/72/120 Hz, wall sliding, corner escape, floor landing/takeoff, ceilings, sensor/friendly-shot filtering, blocked/unblocked muzzle origins, and a moving flying-enemy collider. The suite has 39 tests. Rendered and headset validation remain outstanding.

The environment overhaul replaces both flat region planes and the old cone/cylinder/box scenery. A single sampled height function creates hills, valley walls, an open-world lake basin, color variation, and level clearings for every existing mission/checkpoint/beacon; the render mesh's exact vertex/index buffers also feed a static Rapier trimesh. Distant ridgelines close the horizon, dirt paths guide players to Beacon Ridge objectives, grass and rock fields break up the ground, and eastern/western formations give the free-flight regions distinct geology. Trees use irregular layered crowns and branches, with grouped fixed trunk colliders; larger rocks also block movement. Towers and beacons use cylindrical stone assemblies, the castle reuses a rounded block mesh/materials, and generated relief breaks up terrain and dragon surfaces. A moving instanced cloud layer and animated lake ripples add motion without per-object updates. Six root-level adornment families give the roster armor, barbs, fins, spines, frills, or swept horns in selection and gameplay. Quest/mobile get fewer plantings/clouds/grass blades and an 80-division terrain mesh; desktop uses 112–120 divisions. Those are design budgets, not measured FPS. This branch has 43 tests. Adornments do not yet deform with the skeleton; authored dragon anatomy/animations and a rendered desktop/Quest comparison remain outstanding.

Beacon Ridge now has a single Raider Scout with patrol/intercept/windup/evade/retreat phases, a 0.75-second orange firing tell, world-obstructed sight, cloak response, health, and an airborne destruction burst. It reuses the dragon GLB with an owned recolored material set and uses the same shot and hit-feedback paths as towers. Killing it is optional; tower and beacon progression is unchanged. AI tests cover concealment, fire timing, retreat, and 30/60/120 Hz movement. The model's scale, firing cue, line-of-sight geometry, balance, and motion still need visual and device playtesting.

## What already exists

The README's PlayCanvas description and the old roadmap's claim that there are no missions are outdated. The actual stack is React 19, Three.js, React Three Fiber, Drei, Rapier, TypeScript, and Vite. It is an appropriate starting point for the requested desktop and Quest browser direction; there is no demonstrated need to port engines now.

| Existing system | Actual scope |
| --- | --- |
| Dragon roster | 15 data-defined dragons across three tribes, with speed, agility, firepower, armor, attacks, specials, and material effects |
| Beacon Ridge | Three fixed tower targets, one optional flying Raider Scout, then a beacon objective |
| Sky Circuit | Eight sequential rings; 90-second limit |
| Ridge Defense | Three waves of two, three, then four towers |
| Jade Citadel Strike | 64 dynamic castle blocks; 40 displacements required within 120 seconds |
| Free flight | A sculpted 400 × 400 terrain with three color regions, instanced vegetation/props, a map, and three discoverable beacons |
| Dragon asset | One 318,032-byte low-detail GLB reused by the roster, with procedural scale relief on body/belly materials and five animation clips |
| Presentation | A styled bestiary, briefings, objective and health HUDs, results, and touch controls |

The existing roster and menu art direction are useful foundations. However, all dragons share the same silhouette, the regions mostly differ by color and props, and only Beacon Ridge has a flying enemy so far. There is no saved campaign progression or developed audio loop. These constrain variety and perceived production quality more than polygon count alone.

## Code-confirmed problems and first-pass changes

| Problem at the baseline | Change in this branch | Remaining limit |
| --- | --- | --- |
| F set the touch fire flag without clearing it on key release | Fire samples the current keyboard/touch state; blur, pause, and world exit clear inputs | Verify release and refocus in rendered play |
| Held Q could repeatedly activate specials after cooldown | Keyboard and controller specials trigger on a press edge | Touch control behavior also needs device playtesting |
| Updraft and slam velocities were immediately overwritten by ordinary movement | Explicit ability state preserves movement overrides; a slam bursts once on landing | These remain arcade abilities, not a lift/drag model |
| LeafWing healing was a placeholder; armor did not reduce incoming damage | Healing restores up to 35 HP and clamps at maximum; armor scales damage | Combat values need balance testing |
| Cloak/roll lacked meaningful defensive behavior | Cloak stops tower targeting and prevents hits; barrel roll grants protection during its active period | Add readable duration and hit feedback in a later pass |
| Tower hit checks sampled a separate analytic trajectory on intervals | Real tower colliders and CCD player projectiles resolve impacts from Rapier; shot lifetime honors configuration | Damage is still 35 per impact; firepower currently affects firing rate |
| Enemy shots used wall time and discrete proximity checks | Bounded instanced shots use simulation time, relative swept player hits, and world occlusion | Player hit volume is an approximation, not a body collider |
| Concurrent mission events could overwrite progress with stale state | Functional state updates, event IDs, sequential objective guards, and frozen terminal results | No persistent campaign save yet |
| Wave spawning scheduled timeouts inside a state update | Wave completion uses one simulation-time callback per wave | Waves still consist of towers |
| Timers, cooldowns, and shots continued during overlays or loss of focus | Shared simulation clock and pause lifecycle; input reset; Rapier pauses | Some decorative animations remain cosmetic while paused |
| Cached GLB ownership and animation rebinding could affect swapped dragons | Player owns a cloned skeleton/material set, rebinds animation clips, and releases materials; previews release owned materials too | Preview cards still use separate WebGL canvases |
| Linear camera response could overshoot on a slow frame; projectile spin depended on refresh rate | Exponential movement/camera response and delta-based spin | Controller and camera feel still needs human playtesting |
| External environment HDR could block scene startup | Local sky, hemisphere/sun lighting, regional fog, and a shadow region that follows the player | Appearance has not been visually approved; reflective surfaces lose the old HDR environment contribution |
| There was no immersive WebXR session implementation | Optional Quest runtime, native controller mapping, 45° snap turns, headset HUD, pause/exit, and session cleanup | Experimental; no headset hardware test, no in-VR selection/results or hand tracking |
| Lint was failing and there were no regression checks | Focused simulation/physics/model tests, lint cleanup, Node 24 toolchain, checks before Pages deployment | The existing workflow runs on `main`, not on draft PRs |

The large player/projectile/tower code blocks were extracted from `App.tsx` into dedicated modules so the next pass can change mechanics without continually rewriting the screen controller. This is an incremental refactor rather than a full game architecture rewrite.

## Gameplay: what to improve next

### 1. Flight that rewards mastery

Build explicit grounded, takeoff, cruise, glide, dive, and landing states. Keep forgiving arcade controls, but make speed, altitude, turning radius, and stamina interact. Banking should help a turn; a dive should build speed; flapping should spend a resource; a clean landing should feel intentional. Tune desktop and VR camera behavior separately.

The second pass replaces velocity-only movement with an explicit capsule and a position-based Rapier character controller. Each physics step sweeps the requested movement before applying it, with wall sliding, ground/ceiling blocking, no ground snap during takeoff, and a four-unit per-step travel bound for extreme commands. Grounded motion is slower and flight modes are shown in the desktop/headset HUD. The graphics pass replaces floor rectangles with collision-matched terrain and adds forest trunk/larger-rock colliders. Small decorative stones, some regional props, camera obstruction, slope tuning, glide/stamina mechanics, and full flight-state transitions remain future work.

Completion criteria: a five-minute route feels controllable at 30/60/120 Hz desktop and the chosen headset rate; the dragon cannot tunnel through a tower or mountain; takeoff and landing are readable; flight still works with keyboard, touch, and Quest controllers.

### 2. Combat with readable choices

Add aim guidance, a reticle or predicted impact marker, enemy health cues, hit sparks, a clear destruction event, damage direction, sound, and stronger objective guidance. Balance range, rate, projectile speed, and damage rather than relying on firing rate alone. Introduce three eventual enemy roles: a telegraphed turret, an intercepting flyer, and a heavy defender. The first flyer is in Beacon Ridge; tune its attacks and build a second role after playtesting.

Use deterministic AI states such as patrol, detect, approach, attack, evade, and retreat, with cooldowns and bounded steering. AI coding assistance is useful for building these systems; a networked language model in the frame loop is unnecessary for this combat.

Completion criteria: enemy attacks have visible anticipation; the player can tell why they were hit; dodging and positioning beat continuous firing; at least two dragon choices change the strategy; completing a mission and immediately retrying cannot retain old projectiles, inputs, or progress.

### 3. A repeatable reward loop

Save best stars, discovered beacons, unlocked missions, selected dragon, and settings in a versioned local save. Present a small region recovery map and a clear next objective. Keep unlocks focused: one ability improvement or cosmetic reward per milestone, with a reason to replay using a different dragon.

Completion criteria: progress survives reload; old or corrupt saves recover safely; reset is deliberate; rewards do not force repetitive grinding; a new player understands the next mission without reading a separate document.

## Physics and performance

Retain Rapier for collision, projectiles, and constrained destruction. Use a stable physics timestep with controlled catch-up, and explicitly define what happens when a frame stalls. The current shared game clock caps a frame at 1/15 second; that protects large gameplay jumps but is not a complete policy for synchronizing a long physics backlog. Profile and test that synchronization in the movement pass.

Give projectiles explicit collision groups and bounded counts; this pass does both. Pool player projectile render actors only if measured allocation or draw-call costs justify it. Separate cosmetic debris from important physical blocks. The castle's 64 dynamic blocks should be profiled on Quest before increasing destruction scope; use sleeping bodies, a debris cap, and cheaper aftermath representations.

| Target | Initial budget / evidence | Meaning |
| --- | --- | --- |
| Desktop | 60 Hz → 16.7 ms per frame | Design target, not a measured result |
| Quest browser | 72 Hz → 13.9 ms per frame | Initial target when the headset supports it; verify sustained performance after warming the device |
| Quest renderer in this pass | DPR 1, 1024 shadow map, requested framebuffer scaling 0.8 and maximum foveation | Conservative initial settings; actual device behavior varies |
| Selection previews | DPR capped at 1.25, or the lower device limit | Reduce rendering cost; replace multiple active canvases with one shared renderer or static thumbnails in a later pass |
| Bundle | Production app entry about 97 KB before compression in this build; large Three/Drei/Rapier shared chunks remain | File size evidence only; no FPS claim |
| Optional XR | About 72 KB entry plus dependencies; loaded only after positive immersive support detection | The library also emits emulator/room chunks; emulation is disabled, so those rooms are not intended runtime downloads |

Inspect Chrome/Quest performance traces and Three renderer counts during flight, firing, tower combat, and destruction. Record CPU time, GPU time where available, draw calls, triangles, active physics bodies, heap growth, load time, and long frames. Choose budgets from those measurements. Avoid hiding performance problems by only lowering resolution.

## Graphics, animation, and sound

Choose a coherent stylized art direction rather than aiming for photorealism. The current untextured dragon can remain a low-detail prototype/LOD asset. Build one excellent hero dragon first: a recognizable silhouette, wing membranes, readable eyes and facial shapes, controlled material roughness, and authored takeoff/glide/landing/hit animations. Reuse rigs where appropriate but give tribes distinct anatomy and motion.

The graphics pass adds a sculpted terrain mesh with matching static collision and shared instanced trees/rocks. This is a more grounded prototype environment, not an authored realistic valley. Next, build cliffs and distinctive landmarks from real art references, richer foliage/ground materials, one replacement hero dragon with a stronger silhouette and authored animations, and audio. Profile whether distance LOD and foliage shaders are needed on Quest. Desktop can receive extra shadows and effects while Quest keeps the same objectives and scene readability with simpler materials and effects.

Add a small audio set early: wingbeats, wind increasing with speed, projectile launch/impact, tower break, damage, beacon activation, and victory/failure. Add spatial cues and a volume control. Sound and hit feedback are likely to improve perceived quality faster than adding thousands of props.

This pass's lighting is a source-level implementation, not a finished visual upgrade. Review screenshots and motion on real GPUs before accepting sun/fog values. In VR, prioritize stable horizon, readable silhouettes, restrained flashes, and comfortable motion over dramatic camera shake.

## Quest implementation and release gate

The optional runtime requests an immersive session from a user-pressed button. The native `xr-standard` controller mapping uses left stick for speed, left grip to brake, right stick for climb/descend and snap yaw, right trigger to fire, left trigger for special, X for pause, and Y to end VR. Unsupported controller layouts produce neutral inputs.

The XR origin follows position and yaw with a trailing view. Head tracking controls view rotation; the dragon's bank and barrel roll do not roll the viewer. A headset panel shows objective progress, health, ability cooldown, and time. The VR flight speed cap is a conservative starting point. Trailing motion and snap turns still need comfort tests; this is not a verified accessible VR locomotion system.

Before merging/releasing the VR changes:

1. Run the production build over HTTPS on an actual Quest browser. Enter and end VR in both missions and free flight; confirm the desktop camera and controls recover.
2. Check each controller mapping, left-grip braking, snap rearming, and special/fire release. Disconnect/reconnect a controller and verify neutral inputs.
3. Open the headset system menu, remove the headset, and change visibility. Confirm simulation and timers pause and X resumes safely.
4. Complete, fail, quit, and retry all four missions. Confirm session cleanup and browser results navigation. Menus/results currently require leaving immersive VR.
5. Check seated/standing view height, yaw direction, origin placement, headset recentering, HUD readability, and motion comfort in short sessions before longer ones.
6. Capture sustained frame timing in Beacon Ridge, free flight, and the castle destruction scene. Check memory after repeated dragon swaps and retries. Confirm no unused emulator rooms are downloaded.

Desktop release testing should include tower impacts at different heights, held-F release, every special, armor differences, rapid simultaneous castle hits, settings/map pause, tab blur, resizing, and WebGL/asset failure recovery. The automated suite covers the pure logic and important physics/model behavior, not the rendered integration of all these features.

## Phased implementation order

| Phase | Deliverable | Finish when |
| --- | --- | --- |
| 1 — This branch | Simulation/mission fixes, owned model resources, local atmosphere, test suite, optional Quest foundation, updated documentation | Automated checks pass; rendered desktop and headset gates still require completion before release |
| 2 — Flight and Beacon Ridge | Collision-aware flight states, tuned camera/aim, one flying enemy, hit/destruction feedback, tutorial cues | A new player can learn, win, lose, and retry a satisfying 5–10 minute mission; desktop and Quest timing/comfort are measured |
| 3 — Presentation | One hero dragon, one authored valley, collision-matched terrain, tribe material variations, audio and restrained VFX | The slice has a consistent visual/sound direction and holds performance during combat |
| 4 — Replay and expansion | Versioned saves, region recovery/unlocks, meaningful dragon builds, more mission/enemy variants | Progress survives reload; new content reuses tested systems; the slice is already fun before the world grows |

Avoid a giant open-world rewrite, multiplayer, procedural quest generation, and a full custom engine during these phases. Each would widen the testing and content burden before the core flight/combat loop is proven.

## Automated validation in this branch

`npm test` runs 43 tests covering concurrent mission progress, duplicate events, sequential objectives, survival waves, timeout/terminal state, retries, healing and invalid damage, stars, refresh-independent damping, acceleration/braking, ground clearance, ability persistence, swept projectile hits, corrupt settings, controller mappings/deadzones/press edges, input reset, real Rapier CCD at multiple speeds/timesteps, tower/planting collision groups, seeded terrain/clearings, render/physics mesh agreement, all roster silhouette families, moving-scout collision, Raider Scout states/sight/timing, GLB material ownership, and independent bone animation.

`npm run lint` passes. The immutability rule is scoped off only for R3F components that mutate owned Three/Rapier objects; the remaining hooks, dependency, purity, and state rules remain enabled. `npm run build` passes TypeScript and produces the deployable Vite bundle. No new rendered-browser or headset test has been claimed.
