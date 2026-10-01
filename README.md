# We Are Dragons

A browser-based dragon flight and action prototype built with React, TypeScript, Three.js, React Three Fiber, and Rapier physics. It includes 15 dragons, four missions, a free-flight world spanning three regions with a treasure hunt and a growing dragon hoard, a **Scavengers** stealth mode where you play a human raiding dragon lairs, and touch controls.

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
| Snatch treasure | Fly low over it (talons grab automatically) | Reach out with a hand to move that talon, squeeze its grip on treasure |
| Drop or throw treasure | E or the DROP button | Let go of the grip (moving your hand throws it) |
| Hoard ledger | H in free flight | Available outside immersive VR |
| Show VR controls again | — | Click the left stick |

For Quest, open an HTTPS build in a WebXR-capable browser, choose a dragon and a mission or free flight, then select **Enter VR**. The button appears only when immersive VR is supported and its runtime has loaded; the **?** beside it expands the controls. Inside the headset a controls card shows for about ten seconds (and whenever you pause), then fades so it never blocks the view; a small status panel sits low and to the left. Mission selection and results currently use the browser page outside VR. Hand tracking is not supported.

In free flight, VR grips do double duty. With a relaxed hand, the left grip brakes and the right grip glides. Reaching out turns that hand's grip into a claw: squeeze on treasure, or sweep a closed, outstretched claw through it, and the dragon's talon grabs it while the sticks keep flying. Two-talon chests need both claws. A held grip never brakes or glides, and the left stick keeps its speed. Only opening your hand drops treasure; a brief loss of controller tracking does not. The relaxed hand pose follows the way your body faces, so turning in the room does not count as reaching.

### Scavengers controls

| Action | Desktop | Touch | Quest controllers (experimental) |
| --- | --- | --- | --- |
| Move | WASD (relative to the camera) | Left stick | Left stick walks where you look; click it to run |
| Look | Drag the scene, ← / → | Drag the scene | Head tracking; right stick snap turns |
| Sneak | C toggles | SNEAK | Crouch for real (or B) |
| Run | Hold Shift | Hold RUN | Click the left stick |
| Steal nearby loot | E | GRAB | Grip with a hand near the loot (or reach low) |
| Throw a pebble | Q (where the camera faces) | PEBBLE | Right trigger (where your hand points) |
| Drop the last item | X | DROP | A |
| Raid again after a result | RAID AGAIN | RAID AGAIN | A |
| Pause / exit VR | Escape | Pause button | X / Y |

The headset camera follows position and yaw without copying the dragon's pitch or bank. Initial settings cap flight speed in VR and favor a 72 Hz session where available; these are starting values, not a verified comfort or performance rating.

## Current scope

- **Beacon Ridge:** destroy three towers, dodge or defeat the flying Raider Scout, then activate the beacon.
- **Sky Circuit:** pass eight checkpoints within 90 seconds.
- **Ridge Defense:** clear three waves of towers.
- **Jade Citadel Strike:** displace 40 of 64 castle blocks within 120 seconds.
- **Free flight:** explore Pyrrhia, Pantala, and Glaeryus, discover their beacons, and hunt treasure for your hoard.
- **Scavengers:** raid Mudwallow Den, Sunscorch Vault, and Frostfang Hollow as a human from the underground Burrows.

Flight now accelerates and brakes smoothly, with capsule sweeps against physical terrain, towers, and castle blocks, slower ground movement, and visible grounded/takeoff/landing/dive/cruise/hover states. Aiming guidance, enemy health bars, impact bursts, and hit confirmations improve combat readability. The Raider Scout in Beacon Ridge patrols and intercepts, telegraphs a shot, evades, and retreats at close range. Cloak breaks its targeting; defeating it removes the airborne threat, while the three towers remain the mission objective. The rebuilt environment uses one height source for rendering, collision, paths, vegetation, and landmarks. Forest trunks and larger boulders have colliders; grass and small stones remain decorative. Distant mountains, moving clouds, terrain relief, varied ground color, paths, animated water, biome formations, layered trees, rounded castle masonry, rebuilt towers/beacons, and depth-tuned lighting establish the new visual direction. The roster now has six composite silhouette families with armor, barbs, fins, spines, frills, or swept horns. These details bind to the shared dragon skeleton and follow its flight, attack, death, and hit animation clips. Shared scale relief adds surface detail. Fully authored replacement dragon meshes and animation/audio remain future work. Player projectiles use continuous Rapier collision detection; enemy shots use swept hit tests. Mission progress uses functional updates and unique event identities. Armor, healing, cloak, and barrel-roll protection affect combat. Settings, the world map, tab visibility, and manual pause stop the simulation.

## Development guide

### Treasure, talons, and the hoard

Free flight hides 24 unique treasures, eight per region: on the ground, on treetops, on top of rock spires, and beneath drifting sky lanterns. Thirty common finds return on every flight. Light shafts mark everything still glinting; lit beacons also reveal their region's treasure on the map. Fly low and the hind talons snatch whatever passes under them. Each talon holds one item, and chests take both. Carried loot hangs on a short tether, swings as you turn, and its weight slows flight and climbing (armored dragons haul better). Carry it into the glowing ring around **your hoard** beside the spawn point, or drop it from high above for a ×1.25–1.5 dunk bonus. Loot dropped in the lake returns to where you found it. Each tribe values different loot (RainWings love fruit, SeaWings pearls, NightWings scrolls). The gold mound, coins, displayed treasures, rank, and the **hoard ledger** (H) are saved on this browser.

To check this revision: fly low over a glint to snatch it, watch it dangle, then press E to drop it and snatch it again. Carry it into the hoard ring and confirm the toast, the label above the mound, and the ledger after a reload. Try a two-talon chest while holding something (you'll get a hint), then with empty talons. In VR, reach toward treasure under the dragon and squeeze; let go while swinging your hand to throw.

### Scavengers mode

You are a human from the Burrows. Three lairs add one rule at a time: a heavy sleeper (Mudwallow Den), a guard that patrols past sunlit pillars (Sunscorch Vault), then a light sleeper with two sentries (Frostfang Hollow). The stealth simulation in `src/game/scavenger.ts` is deterministic and covered by tests:
- **Hearing:** footsteps carry further when walking or running, with a full sack, and on coin piles or bones.
- **Snores:** a loud snore masks quiet steps. Each prize sits near a sleeping snout, so stealing it silently means grabbing during a snore. Light sleepers hear it anyway.
- **Sight:** vision cones (drawn on the floor) reach much further into braziers and sunlight, and pillars block line of sight.
- **Pebbles:** a thrown pebble always sends an awake dragon to look where it landed.
- **Dragon states:** dragons stir (eyes open, head turns), investigate, chase, search, and return. A chase ends when you break line of sight long enough, or when the dragon catches you. A dragon that cannot reach a spot past the pillars gives up after a couple of seconds and searches from where it is.
- **VR footsteps:** walking in your room moves the scavenger and makes footsteps too. Crouch-walk to keep them quiet.

Escape down the burrow with loot to score stars; records, prize steals, and "ghost" raids (never spotted) are saved.

To check this revision: sneak to the nearest loot and escape; then sprint across a coin pile beside a sleeping dragon and confirm it wakes. In Sunscorch Vault, throw a pebble behind the patrolling guard and slip past while it investigates. In VR, crouch to sneak, reach down to grab, and throw with the trigger. After the raid, the result card appears in the headset; press A to raid again.

### Testing VR without a headset

The WebXR flows were exercised with Meta's IWER emulator (an emulated Quest 3 driven from Playwright): flying with the thumbsticks, grabbing a gem with a reached claw, banking it, and a full first-person scavenger raid. That proves the input wiring and game logic, not comfort, frame rate, or how the claws feel on real hardware.

### Graphics and render stability

Instanced forests, rocks, grass, and mountains now refresh their bounding volumes after placement; cached bounds near the origin could otherwise cull an entire distant batch. Skinned dragon meshes remain visible through wing animations. Wings use a single transparent pass without writing depth, with shared membrane folds; body scales also vary roughness. Curved horns, shaped fins, rounded armor, and eroded ridgelines replace sharper primitive profiles. These are procedural improvements to the existing asset set, not replacement authored character models.

Gameplay uses a stable sun/hemisphere light set with emissive markers instead of adding and removing point lights during objectives. All phones, tablets, and Quest use fewer plants, clouds, grass, and terrain divisions; dynamic shadows are reserved for desktop at 1024 resolution. Water uses an opaque standard material to reduce transparency cost. Desktop/touch pixel density adapts after sustained five-second timing windows. Quest uses fixed resolution plus maximum WebXR foveation where supported; adaptive pixel density does not change an active XR session.

Render checks: fly away from the spawn and rotate through a full circle near forests and mountains; repeat at altitude and during dragon animations. Destroy towers and pass race gates while checking for stalls. Repeat for at least five minutes on the affected device. The culling bug is reproduced in automated tests, but the reported scene cutouts and actual FPS still require on-device confirmation.

### Flight feel

Powered flight now carries momentum through turns. Agile dragons redirect faster; heavier dragons take wider approaches. Diving increases forward speed, while climbing reduces it. Hold **G** to glide or **B** to airbrake; touch players have matching hold buttons. Quest uses **right grip for glide** and **left grip for brake**. Glide gradually loses speed and altitude, with gentle steering and existing collision/ground clearance protection. Desktop/touch cameras widen their view slightly at speed; headset view and the twelve-unit horizontal speed cap remain steady.

Press **Enable Sound** before entering VR or during browser play for synthesized wind, wingbeat whooshes, shots, and impacts. Sound starts muted, follows flight speed, quiets wingbeats during glide, and fades during pause. This is a first sensory pass using generated audio, not a finished recorded sound set. Hardware listening and flight-comfort tests remain necessary.

### Guardian log and replay goals

Mission victories now save best stars, fastest time, highest HP, clear count, and stars for the dragon that finishes the mission. The Guardian Log recommends the first unfinished chapter, and the result screen offers a direct continuation plus the three-star target. Dragon mastery totals best stars across the four missions; replays cannot inflate it. Saves stay on the current browser/device and do not sync between a computer and headset. If storage is blocked, play continues with session progress.

Sky Circuit gates face their approach routes, use cyan approach lights, and count swept crossings through the ring plane. If you miss one, turn back and cross it from either side.

To check this revision: win Beacon Ridge, continue to Sky Circuit, return to the Guardian Log, and reload. Confirm the best record remains, then replay with a different dragon. Try a worse result to confirm it does not lower the saved stars. In Sky Circuit, cross the lit ring quickly, miss one on purpose, and return through it. Repeat on Quest to check visibility and approach comfort. See [the updated design plan](docs/gameplay-roadmap.md) for the next production priorities and playtest gates.

Start with [the modernization audit and prioritized plan](docs/modernization-audit.md). It distinguishes code-confirmed fixes from unverified graphics and VR work, and describes the next playable slice.

| Area | Location |
| --- | --- |
| Screens, world assembly, mission integration | `src/App.tsx` |
| Flight, abilities, mission state, session lifecycle | `src/game/` |
| Player, projectiles, towers, flying scout, atmosphere, treasure and hoard | `src/world/` |
| Treasure, claws, and stealth simulation (pure, tested) | `src/game/loot.ts`, `src/game/claws.ts`, `src/game/scavenger.ts` |
| Scavengers screens, lairs, dragons, and raid loop | `src/scavenger/` |
| Desktop / touch / XR inputs and settings | `src/controls/` |
| Optional immersive runtime, headset HUD, claws, and VR raids | `src/vr/` |
| Dragon data, materials, selection | `src/dragons.ts`, `src/DragonSelect.tsx` |
| Regression checks | `tests/` |

The [original gameplay roadmap](docs/gameplay-roadmap.md) remains available as historical narrative and design planning. Several of its initial milestones have already been implemented.
