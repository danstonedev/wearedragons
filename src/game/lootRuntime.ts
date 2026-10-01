import { missionEmitter } from "./runtime.ts";
import type { LootRegion, TreasureRarity } from "./loot.ts";
import type { KingdomId } from "./world.ts";

export interface CarriedSummary { name: string; value: number; rarity: TreasureRarity; favored: boolean }

/** Polled by the DOM HUD; written by the loot frame loop. */
export const lootHud = {
  left: null as CarriedSummary | null,
  right: null as CarriedSummary | null,
  both: false,
  weight: 0,
  hoardDistance: 0,
  hoardBearing: 0,
  remaining: 0,
  nearest: null as null | { name: string; distance: number; bearing: number; rarity: TreasureRarity },
};

/** Treasure still glinting in the world, for the map and the scavengers who covet it. */
export interface LooseLootEntry {
  id: string; name: string; x: number; y: number; z: number;
  /** On open ground, where someone on foot could pick it up. */
  grounded: boolean;
  rarity: TreasureRarity; unique: boolean; region: LootRegion; kingdom: KingdomId;
  /** A sack of your own stolen gold. */
  sack: boolean;
}
export const lootMap = { items: [] as LooseLootEntry[] };

export function lootToast(text: string, tone: "gold" | "info" | "warn" | "legend" = "info") {
  missionEmitter.dispatchEvent(new CustomEvent("loot_toast", { detail: { text, tone } }));
}

/** A rival dragon or scavenger that can hold treasure; positions are refreshed every frame. */
export interface LootHolder {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Dangling from a dragon's claws, or slung on a scavenger's back. */
  carry: "claws" | "back";
}
export const lootHolders = new Map<string, LootHolder>();
