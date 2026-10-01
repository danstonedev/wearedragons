import { createDragonState, createScavenger } from "../game/scavenger";
import type { DragonMode, Gait, LairDef, LairDragonState, NoiseEvent, ScavengerState, Spot } from "../game/scavenger";

export interface FlyingPebble { from: Spot; to: Spot; age: number; duration: number }
export interface RaidOutcome { escaped: boolean; value: number; prize: boolean; ghost: boolean; caughtBy: string | null }

/** Everything one raid simulates. Created per attempt and shared by the 3D components. */
export interface RaidState {
  lair: LairDef;
  player: ScavengerState;
  /** Height of the player's feet (the hoard mound is walkable). */
  feet: number;
  gait: Gait;
  sneaking: boolean;
  dragons: LairDragonState[];
  /** Loot lying in the cave, by id; dropped loot moves to where it was dropped. */
  floor: Map<string, Spot>;
  sack: string[];
  pebbles: number;
  flying: FlyingPebble[];
  noises: NoiseEvent[];
  everSeen: boolean;
  ended: RaidOutcome | null;
  /** The dragon that caught the player lunges toward them. */
  catcher: string | null;
}

export function createRaid(lair: LairDef): RaidState {
  return {
    lair, player: createScavenger(lair), feet: 0, gait: "still", sneaking: false,
    dragons: lair.dragons.map(createDragonState),
    floor: new Map(lair.loot.map(item => [item.id, { x: item.x, z: item.z }])),
    sack: [], pebbles: lair.pebbles, flying: [], noises: [], everSeen: false, ended: null, catcher: null,
  };
}

/** Keyboard, touch, and camera input for the human player. */
export const raidKeys: Record<string, boolean> = {};
export const raidTouch = { x: 0, y: 0, sneak: false, sprint: false };
export const raidActions = { grab: false, pebble: false, drop: false };
export const raidCamera = { yaw: Math.PI, pitch: 0.38, pointer: 0, lastX: 0, lastY: 0 };

export function resetRaidInput() {
  for (const key of Object.keys(raidKeys)) delete raidKeys[key];
  Object.assign(raidTouch, { x: 0, y: 0, sprint: false });
  Object.assign(raidActions, { grab: false, pebble: false, drop: false });
  raidCamera.pointer = 0;
}

export type StealthStatus = "hidden" | "exposed" | "seen" | "hunted";
export interface DragonReadout { id: string; name: string; tribe: string; mode: DragonMode; suspicion: number }

/** Polled by the DOM HUD. */
export const raidHud = {
  status: "hidden" as StealthStatus,
  /** Player position, for audio, VR, and tooling. */
  px: 0,
  pz: 0,
  light: 0,
  value: 0,
  weight: 0,
  sack: [] as { name: string; value: number; prize: boolean }[],
  pebbles: 0,
  sneaking: false,
  nearLoot: null as null | { name: string; value: number; weight: number; fits: boolean },
  atExit: false,
  dragons: [] as DragonReadout[],
};

/** Sound and UI cues from the raid simulation. */
export const raidEmitter = new EventTarget();
export type RaidCue = "step" | "grab" | "drop" | "throw" | "plink" | "stir" | "wake" | "spot" | "lost" | "settle" | "caught" | "escape" | "snore" | "denied";
export function raidCue(cue: RaidCue, detail: Record<string, unknown> = {}) {
  raidEmitter.dispatchEvent(new CustomEvent("cue", { detail: { cue, ...detail } }));
}
