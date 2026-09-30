# We Are Dragons — game design and upgrade plan

## Direction

**Become a sky guardian: master your dragon, reclaim dangerous routes, and restore the beacon network.**

The first release should deliver a satisfying 15–30 minute campaign with short missions worth replaying. Flight is the central toy. Combat, exploration, scenery, and rewards should make players want to fly again.

### Design pillars

1. **Expressive flight.** Turning, altitude, approaches, and dragon choice produce visible consequences. Beginners can recover from mistakes; experts chase cleaner routes.
2. **Readable threats and goals.** A player can identify the next objective and enemy tell while moving. VR uses cues in the world as well as a comfortable HUD.
3. **Distinct dragon roles.** Speed, armor, attack pattern, and special ability support different tactics. All roster choices remain viable.
4. **A world worth restoring.** Beacons and settlements visibly respond to progress. Environmental composition provides routes, shelter, and recognizable destinations.
5. **Reward mastery.** Records, personal improvement, and earned cosmetic identity motivate replay. Avoid grinding for basic controls or mandatory stat upgrades.

## Current evidence

The game has fifteen dragons, four missions, three free-flight regions, tower combat, a flying scout, destructible masonry, special abilities, results and star ratings. Flight uses collision sweeps and bounded acceleration. The environment has shared render/collision terrain, instanced vegetation, mountain silhouettes, cloud/water motion, and rebuilt architecture. Composite dragon details follow the shared skeleton.

The asset set remains a prototype. Automated physics and animation tests are useful, but rendered desktop and headset playtesting has not yet established visual quality, comfort, accessibility, or sustained performance. The current environments are not photorealistic.

## Player experience

### First session

1. Choose an appealing dragon and see its role in plain language.
2. Learn forward flight, altitude control, braking, firing, and the special in a forgiving space.
3. Clear Beacon Ridge: read tower fire, deal with the scout, and activate the beacon.
4. Receive stars, a saved record, and a clear next chapter.
5. Fly Sky Circuit to learn clean approaches, then defend the ridge and break the citadel.
6. Return with another dragon or improve a record.

### Repeat session

Choose a highlighted unfinished mission, improve a two-star result, or build mastery with another dragon. Free flight provides an unhurried alternative. A short session should still leave a lasting achievement.

## Playable slice delivered in this revision

### Guardian log

- Save successful mission records on the current browser/device.
- Preserve best stars, fastest clear, highest remaining HP, and clear count independently.
- Track best stars for each mission/dragon combination; mastery is the sum, capped at twelve stars per dragon.
- Mastery titles: New bond (0), Wing Scout (1–5), Pathfinder (6–11), Sky Guardian (12).
- Highlight the first uncleared chapter in the existing mission order; never lock practice behind progress.
- Offer the next chapter from the victory screen and show an actionable three-star target.
- Handle damaged saves and unavailable storage without blocking play. Saves are local, not account/cloud sync.

### Sky Circuit

- Orient each ring perpendicular to its incoming route; do not rotate the crossing plane.
- Emphasize the active gate with a cyan ring, pulsing outer halo, and approach lights.
- Register a crossing through the gate plane using the swept movement segment, including fast flight between frames.
- Allow recovery by crossing from either side. Flying near a ring without crossing its plane does not count.
- Preserve the eight-gate route, ninety-second limit, and existing star goals until playtests justify retuning.

## Flight feel pass delivered

Tutorial production is deferred while flight and sensory quality improve. Powered turns retain momentum with agility-dependent response; dives gain speed and climbs trade speed for altitude. Holding glide preserves momentum, descends gently, and allows slow redirection. Airbrake overrides glide and powered thrust horizontally for recovery. Ground clearance and collision sweeps remain authoritative. Quest horizontal motion stays capped at twelve units per second.

Visual banking now depends on movement speed and is suppressed on the ground. Glide reduces flap playback speed. Desktop/touch view widens from 60 to at most 67 degrees with speed; headset camera tracking is unchanged. Synthesized wind, wing whooshes, launch sounds, and impacts can be enabled with a user gesture. Sound defaults off and responds to pause. This is prototype audio, not authored spatial sound or a new glide animation.

Test a heavy and an agile dragon on the same route; compare powered turns, dives, climbs, gliding, braking, slope approaches, and boost/special recovery. Listen at normal headset volume and verify no sound persists after leaving play. Measure Quest comfort and performance before tuning the speed cap or adding camera effects.

## Prioritized production backlog

| Priority | Upgrade | Player benefit | Completion evidence |
| --- | --- | --- | --- |
| Later | First-flight tutorial with contextual prompts and practice targets | Learn controls and recover without reading a wall of text | A new player flies, brakes, fires, and uses a special unaided within three minutes on desktop and Quest |
| 1 | Flight feel: glide, banking, dive energy, landing response | Flying is enjoyable between encounters | Five-minute route feels controllable; tuning tested with fast/heavy/agile dragons; camera comfort retained |
| 2 | Combat encounters: cover, scout variants, readable shot lanes | Tactical movement instead of circling stationary targets | Two viable approaches per encounter; each threat has a visible tell and counterplay |
| 4 | Beacon restoration effects and saved exploration discoveries | Success changes the world | Return visits show restored landmarks; discovery remains after reload |
| 3 | Hero environment and creature art | A coherent, convincing place and dragon | One authored valley and hero dragon inspected at player-camera distance, in motion, on desktop and headset |
| 6 | Pantala rescue mission | A new verb and regional purpose | Locate survivor, clear threat, escort to safety; legible failure/retry conditions |
| 7 | Regional finale with elite aerial enemy | A satisfying campaign culmination | Multi-phase encounter with clear tells, recovery windows, and dragon-role viability |
| 8 | Cosmetic mastery rewards and optional route modifiers | Long-term personal goals | Earned rewards displayed on selection and in play; no required damage grind |

Priorities 1–4 can iterate together after flight playtests. A feature is not complete merely because it compiles.

## Flight and physics design

Preserve forgiving arcade control while adding intentional decisions. Introduce glide as reduced propulsion with gradual altitude loss; dives trade altitude for speed and climbs spend that speed. Banking should communicate a turn before introducing any mechanical bonus. Landings should settle reliably on slopes, with a brief visual response and no headset camera roll.

Prototype energy and glide with one dragon first. Avoid adding a stamina bar until depletion creates an enjoyable choice in playtests. Keep control mappings consistent across keyboard, touch, and Quest. Surface controls in the relevant mode. Fix camera obstruction and spawn safety before tightening obstacle difficulty.

## Combat and mission design

Each encounter needs an entry view, primary threat, alternate approach, safe recovery space, and climax. Towers constrain lanes; scouts force repositioning; structures reward heavy attacks. Avoid opaque hits, instant damage, and multiplying enemies solely to increase difficulty.

Beacon Ridge teaches combat. Sky Circuit teaches route control. Ridge Defense teaches threat prioritization. Jade Citadel teaches attack positioning and destructive payoff. Add story debriefs that explain how each success reconnects the network. Use three-star goals to encourage expertise; do not require three stars to advance.

## Art overhaul plan

Choose grounded fantasy realism with strong silhouettes and restrained color. Start with one hero valley rather than spreading asset effort across an enormous world. Compose a visible beacon, a readable route, sheltered clearings, layered cliffs, and distant ridgelines. Match scale across trees, towers, terrain, and dragons.

Production sequence:

1. Gather approved visual references and establish a palette, scale sheet, material list, and camera-distance targets.
2. Build a hero dragon with authored anatomy, wing membranes, facial detail, scale normals, and controlled roughness. Preserve a tested skeleton/animation pipeline.
3. Build a modular cliff/rock set and richer ground materials; terrain collision must still agree with the rendered surface.
4. Replace foliage clusters with authored foliage, distance LOD, and subtle wind appropriate for headset budgets.
5. Add beacon restoration lighting, curated sky/fog, spatial wingbeat/wind/combat audio, and restrained effects.
6. Derive a Quest tier from measured frame timing, draw calls, memory, and transparency cost. Keep the same readable objectives.

Bone-attached primitives are interim silhouette differentiation. Bump relief does not replace authored topology or textures. Any external asset must have a recorded source and license. Do not promise photorealism from extra polygon counts alone.

## Playtest gates

| Test | Observe | Pass condition |
| --- | --- | --- |
| Fresh player, desktop | First objective, controls, failure reason | Understands objective within ten seconds; can retry without help |
| Quest first session | Controller discovery, HUD readability, orientation | Player can launch, fly, fire, pause, and exit comfortably |
| Sky Circuit | Gate approaches, missed-gate recovery, fast crossing | Crossing matches visible gate; player understands where to go next |
| Replay and reload | Records, next chapter, different dragon | Best results survive reload and worse replays never erase them |
| Busy combat scene | Threat tells, collision, rendering | No unexplained hits or tunneling; frame budget measured on target hardware |
| Five-minute free flight | Camera, comfort, landmarks | No forced camera pitch/roll; navigation remains understandable |

Track completion rate, time to first shot, missed gates, retry choice, dragon changes, and reported comfort in a small opt-in test sheet before adding analytics infrastructure. Balance numbers from observed attempts rather than guessed precision.

## Deferred scope

Multiplayer, giant procedural worlds, branching dialogue campaigns, monetized progression, and deep skill trees remain outside the first release. Finish the short campaign and its sensory quality before multiplying systems.
