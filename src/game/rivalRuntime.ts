import type { KingdomId } from "./world.ts";

export interface ThreatSummary { name: string; tribe: string; mode: string; distance: number; bearing: number; hp: number; maxHp: number; champion: boolean }

/** Polled by the DOM HUD; written by the rival dragons' frame loop. */
export const rivalHud = {
  /** Rivals actively after you (chasing, winding up, dodging, or warning). */
  chasing: 0,
  warning: 0,
  nearest: null as ThreatSummary | null,
  alarm: null as { kingdom: KingdomId; name: string; remaining: number } | null,
};

export function resetRivalHud() {
  Object.assign(rivalHud, { chasing: 0, warning: 0, nearest: null, alarm: null });
}
