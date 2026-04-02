# We Are Dragons Gameplay Roadmap

## Purpose

This document turns the current prototype into an implementation plan.

It is written for the game that exists today:
- dragon selection with strong tribe identity
- free-flight sandbox
- ranged attacks and specials
- destructible castle toy target
- no mission structure, enemies, progression, or story state yet

The goal is to build a small, fun dragon action game in phases without overcommitting too early.

## Product Direction

### High-Level Pitch

`We Are Dragons` is a mission-based aerial action game where the player chooses a dragon, masters its tribe-specific strengths, and restores failing sky-beacons across three regions before the skies collapse into conflict.

### Design Pillars

1. Flight is the main fantasy.
2. Dragon choice should change how missions feel.
3. Missions should be short, readable, and replayable.
4. Story should support action, not slow it down.

### What The Current Prototype Does Well

- Immediate dragon fantasy
- Distinct dragon roster
- Strong selection screen presentation
- Good sandbox feel for movement and attacks

### Current Gaps

- No objective
- No failure state
- No enemy pressure
- No reward loop
- No campaign structure
- No story framing after selection

## Target Game Shape

The project should become a mission-driven action game, not a giant open-world game.

Target session loop:

1. Choose a dragon.
2. Read a short mission brief.
3. Enter a compact combat/traversal arena.
4. Complete a goal using movement, attacks, and dragon-specific strengths.
5. Earn progress toward region recovery, unlocks, or tribe favor.
6. Advance the story to the next mission.

## Narrative Frame

### Premise

The ancient sky-beacons that maintain safe routes between dragon territories are failing. Storms are spreading, raiders are emboldened, and long-buried relics are reactivating. The player is a newly chosen sky guardian able to bond with dragons from multiple tribes and travel between regions to restore the beacon network.

### Why This Premise Works

- Justifies multiple tribes and dragon swapping
- Gives the player a reason to travel and fight
- Creates natural mission objectives
- Supports progression from local problems to a larger threat

### Story Arc

#### Act 1: First Flight

- Choose a dragon
- Learn movement and combat
- Restore the first beacon
- Discover the failures are coordinated

#### Act 2: Fractured Skies

- Travel to new regions
- Earn trust from different tribes
- Solve region-specific problems
- Uncover the force behind the beacon collapse

#### Act 3: The Final Beacon

- Choose alliances
- Restore the final network
- Defeat an elite dragon, warlord, or awakened sky-engine

## First Playable Campaign Slice

This is the first slice the team should build before expanding content.

### Player Experience: First 30 Minutes

1. Opening text or lightweight cutscene explains the beacon crisis.
2. Player selects a dragon from the current dragon select screen.
3. Tutorial mission teaches flight, firing, and special ability use.
4. First combat mission tasks the player with destroying raider watchtowers near a damaged beacon.
5. Debrief reveals the raid was intentional, not random.
6. Second mission shifts tone with either a rescue or race/traversal challenge.
7. Player unlocks the next mission set, dragon, or region.

### First Vertical Slice Goal

Build one polished mission:

`Destroy 3 raider watchtowers, survive return fire, then fly through the beacon to reactivate it.`

This single mission should answer:
- Is the flight fun under pressure?
- Are attacks readable against real targets?
- Is the HUD understandable?
- Does dragon choice create interesting advantages?
- Does success feel meaningful?

## Core Gameplay Loops

### Moment-To-Moment Loop

1. Fly
2. Aim
3. Dodge
4. Fire
5. Use special
6. Avoid hazards or enemy attacks

### Mission Loop

1. Receive objective
2. Reach encounter area
3. Complete primary objective
4. Handle escalation
5. Escape, survive, or activate beacon
6. Receive rewards and story update

### Campaign Loop

1. Clear missions in a region
2. Restore beacon strength
3. Improve tribe reputation
4. Unlock new dragons, missions, or modifiers
5. Advance the story to the next region

## Dragon Identity Plan

The dragon roster in `src/dragons.ts` should remain the base of gameplay identity.

### Design Rule

Every dragon should be:
- generally viable in all core content
- clearly better at certain mission patterns
- different because of playstyle, not just numbers

### Intended Gameplay Niches

| Dragon Type | Best At | Notes |
| --- | --- | --- |
| MudWing | Siege, defense, tanking | High armor, good for turret-heavy missions |
| SandWing | Burst movement, hit-and-run | Great for timed objectives |
| SkyWing | Chases, speed trials, interception | Best high-speed traversal pick |
| SeaWing | area control, pulse utility | Good for beacon resonance and crowd control |
| IceWing | precision combat, control | Good against airborne targets and narrow routes |
| RainWing | stealth, ambush, infiltration | Cloak should matter in mission scripting |
| NightWing | stealth plus balanced combat | Flexible all-rounder |
| HiveWing | swarm attacks, pressure | Good anti-group pick |
| SilkWing | mobility tricks, evasion | Barrel roll should reward skillful play |
| LeafWing | support, sustain, defense | Heal becomes relevant once HP exists |
| RiceWing | speed and finesse | Strong race option |
| AceWing | acrobatics, challenge runs | High skill ceiling movement pick |
| BladeWing | armored offense | Durable close-approach attacker |
| BoneWing | heavy destruction | Great against structures and bosses |
| HiveWing II | stealth venom hybrid | Exists as `hivewing2` in Glaeryus tribe, cloak + venom kit |

## Mission Types

The game should ship early with a small set of repeatable mission structures.

### Mission Type 1: Fortress Raid

Objective:
- destroy structures, towers, crystals, gates, or artillery

Player verbs emphasized:
- firing
- target prioritization
- strafing
- health management

Good dragon fits:
- MudWing
- BoneWing
- SkyWing

### Mission Type 2: Beacon Run

Objective:
- race through airborne markers under a timer and activate a beacon

Player verbs emphasized:
- speed
- pathing
- altitude control
- boost timing

Good dragon fits:
- SkyWing
- SandWing
- RiceWing
- AceWing

### Mission Type 3: Rescue Mission

Objective:
- find trapped dragons, destroy blockers, escort survivors, or defend a route

Player verbs emphasized:
- scanning
- quick repositioning
- wave defense
- survivability

Good dragon fits:
- LeafWing
- MudWing
- RainWing

### Mission Type 4: Hunter Ambush

Objective:
- survive waves of enemies or defeat an elite target

Player verbs emphasized:
- combat mastery
- dodging
- cooldown timing
- target focus

Good dragon fits:

- NightWing
- IceWing
- HiveWing
- BladeWing

### Mission Type 5: Storm Trial

Objective:

- cross dangerous weather zones, turbulence rings, or lightning corridors

Player verbs emphasized:

- movement mastery
- reading space
- precise control

Good dragon fits:

- AceWing
- SilkWing
- SkyWing
- RiceWing

## Phased Implementation Plan

## Phase 1: Vertical Slice

### Goal

Turn the sandbox into a complete, replayable mission.

### Required Features

- player health
- mission state machine
- destructible mission targets
- simple enemy threat
- objective HUD
- success and failure screens
- mission reset
- story intro and debrief text

### Scope

Build exactly one mission on the existing map:
- 3 watchtowers
- 1 beacon activation finish
- 1 mission success flow
- 1 mission fail flow

### Out Of Scope

- region map
- long dialog scenes
- multiple environments
- progression trees
- save system

### Acceptance Criteria

- Player can take damage and fail.
- Watchtowers can be destroyed and tracked.
- Mission objective updates on screen.
- Completing all towers unlocks the beacon end goal.
- Reaching the beacon after tower destruction triggers mission complete.
- Death or health depletion triggers mission fail.
- Player can retry without reloading the app.

## Phase 2: Combat And Mission Variety

### Goal

Prove that the game stays fun beyond a single mission.

### Required Features

- at least 3 mission templates
- enemy waves or turret variants
- mission timer support
- dragon-specific strengths reflected in mission tuning
- basic rewards or stars system

### Acceptance Criteria

- There are at least 3 distinct mission types.
- At least 2 dragon choices feel meaningfully different in the same mission.
- Mission completion grants a visible reward or rating.

## Phase 3: Campaign Structure

### Goal

Connect missions into a progression arc.

### Required Features

- region selection or campaign map
- mission unlock flow
- story brief/debrief system
- tribe reputation or region recovery meter
- dragon unlocks or mastery unlocks

### Acceptance Criteria

- Player can complete missions in sequence.
- Story context changes after mission completion.
- Some new content unlocks from progress.

## Phase 4: Expansion

### Goal

Increase depth after the core loop is proven.

### Candidate Features

- bosses
- elite enemy dragons
- biome-specific hazards
- branching story choices
- region-specific mission modifiers
- deeper progression

## Systems Spec

These systems should be implemented in a lightweight way first.

### 1. Game State Flow

Add an app-level flow:

- `dragon_select`
- `mission_brief`
- `in_mission`
- `mission_success`
- `mission_fail`

This replaces the current immediate jump from selection to sandbox play.

### 2. Mission State

Add a mission definition object and runtime mission progress state.

Suggested structure:

```ts
type AppScreen =
  | "dragon_select"
  | "mission_brief"
  | "in_mission"
  | "mission_success"
  | "mission_fail";

type MissionObjectiveType =
  | "destroy_targets"
  | "reach_beacon"
  | "survive"
  | "race_checkpoint";

interface MissionDefinition {
  id: string;
  name: string;
  description: string;
  region: "pyrrhia" | "pantala" | "glaeryus";
  objectives: MissionObjectiveDefinition[];
  recommendedDragons?: string[];
}

interface MissionObjectiveDefinition {
  id: string;
  type: MissionObjectiveType;
  label: string;
  requiredCount?: number;
}

interface MissionRuntimeState {
  activeObjectiveId: string;
  progress: Record<string, number>;
  completedObjectiveIds: string[];
  failed: boolean;
  succeeded: boolean;
}
```

### 3. Player Health

Add a basic player health model.

**Collision note:** The player dragon currently uses a `kinematicVelocity` rigid body with no collider, so it passes through all objects. Damage detection should use proximity checks or a sensor collider (detects overlap without blocking movement) rather than physics collisions.

Suggested first pass:

- max HP = `100`
- enemy projectile proximity hit = `10-20` per hit
- no healing items yet
- LeafWing heal and future support abilities can restore HP later

HUD should show:
- current HP
- warning state below 30%

### 4. Targets And Enemies

Start simple. Use towers before building full enemy dragons.

First enemy types:

- `Watchtower`
  - stationary
  - has health
  - periodically shoots at player

- `Beacon`
  - inactive until towers are destroyed
  - acts as end-of-mission objective

Optional second pass:

- `HunterBallista`
  - slower rate of fire
  - heavier damage

### 5. Projectile Damage Rules

**Implementation note:** The current projectile system (`fireballEmitter`) is player-only. Enemy projectiles need a separate emitter or a generalized system that tags projectiles as `player` or `enemy`. Enemy projectile hits should be detected via proximity checks against the player position each frame, since the player has no physics collider.

Player projectile hits should:

- damage towers (proximity check against tower positions)
- possibly damage enemies later
- create readable impact feedback

Enemy projectile hits should:

- damage player (proximity check against player position)
- trigger flash or vignette feedback

### 6. HUD

First mission HUD should include:
- mission name
- current objective text
- progress counter
- player HP
- special cooldown
- mission result overlay on success/fail

### 7. Feedback

Needed for readability:

- target hit flash
- target destroyed effect
- low-health screen effect
- beacon activation effect
- mission complete overlay
- placeholder sound effects (hit, destroy, damage taken, mission complete) — not critical for Phase 1 but significantly improves readability

## Content Plan By Region

This is content direction, not immediate build scope.

### Pyrrhia

Tone:
- war-torn skies
- fortresses
- open combat

Mission examples:
- destroy raider towers
- defend caravan route
- chase down a rogue dragon

### Pantala

Tone:
- strange ecosystems
- stealth routes
- dangerous flora

Mission examples:
- rescue cocooned hatchlings
- burn through webbed canyons
- cross toxic air pockets

### Glaeryus

Tone:
- mythic ruins
- ancient machines
- precision trials

Mission examples:
- reactivate ancient sky-rings
- navigate ruin corridors
- defeat relic guardians

## Recommended Build Order In This Repo

### Step 1: Introduce Screen And Mission State

Target files:
- `src/App.tsx`
- new mission data module

Deliverable:
- player can move from dragon select to mission brief to mission play to success/fail states

### Step 2: Add Player Health And HUD

Target files:
- `src/App.tsx`
- new HUD components

Deliverable:
- visible HP and readable mission text

### Step 3: Add Watchtower Actors

Target files:

- `src/world/Watchtower.tsx` and `src/world/Beacon.tsx` (extract from App.tsx — mandatory, App.tsx is already ~1100 lines)

Deliverable:
- three destructible towers with HP and attack behavior

### Step 4: Connect Objective Progress

Deliverable:
- destroying towers updates progress
- beacon objective unlocks after all towers are destroyed

### Step 5: Add Mission End Conditions

Deliverable:
- mission success screen
- mission fail screen
- retry flow

### Step 6: Add Second And Third Mission Templates

Deliverable:
- race mission
- rescue or survival mission

## Proposed File Structure

This is a recommended direction, not a strict requirement.

```txt
src/
  App.tsx
  dragons.ts
  game/
    missions.ts
    missionTypes.ts
    gameState.ts
  components/
    hud/
      MissionHud.tsx
      HealthHud.tsx
      MissionResultOverlay.tsx
    screens/
      MissionBrief.tsx
  world/
    actors/
      PlayerDragon.tsx
      Watchtower.tsx
      Beacon.tsx
      Projectile.tsx
```

## Risks To Avoid

1. Adding too many dragons or VFX before missions exist.
2. Building a huge story before the core loop is fun.
3. Jumping to open-world structure before compact missions work.
4. Making dragons numerically different but not functionally different.
5. Adding progression systems before success/failure feedback feels good.

## Definition Of Success

The next meaningful milestone is reached when a new player can:

1. Choose a dragon.
2. Understand the mission in under 10 seconds.
3. Complete or fail a structured mission in 3-5 minutes.
4. Feel that their dragon choice influenced the experience.
5. Want to immediately retry with a different dragon.

## Immediate Build Checklist

This is the practical near-term backlog.

- Create mission definitions
- Add app screen flow
- Add mission brief screen
- Add player HP and fail state
- Add 3 destructible watchtowers
- Add tower attacks
- Add mission HUD
- Add beacon activation goal
- Add mission success/fail overlays
- Add retry loop

Once that works, build the second mission type instead of adding more dragons.
