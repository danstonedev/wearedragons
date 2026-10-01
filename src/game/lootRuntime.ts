import { missionEmitter } from "./runtime.ts";
import type { LootRegion, TreasureRarity } from "./loot.ts";

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

/** Treasure still glinting in the world, for the map. */
export const lootMap = { items: [] as { x: number; z: number; rarity: TreasureRarity; unique: boolean; region: LootRegion }[] };

export function lootToast(text: string, tone: "gold" | "info" | "warn" | "legend" = "info") {
  missionEmitter.dispatchEvent(new CustomEvent("loot_toast", { detail: { text, tone } }));
}
