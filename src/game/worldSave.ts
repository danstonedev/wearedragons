import { useCallback, useRef, useState } from "react";
import { KINGDOMS } from "./world.ts";
import type { KingdomId } from "./world.ts";

/** What the open world remembers between flights: the beacons you have lit. */
export const WORLD_KEY = "wearedragons.world.v1";
export interface WorldSave { version: 1; beacons: KingdomId[] }
export const emptyWorldSave = (): WorldSave => ({ version: 1, beacons: [] });

const KINGDOM_IDS: ReadonlySet<string> = new Set(KINGDOMS.map(kingdom => kingdom.id));

/** Damaged, foreign, or future saves start a fresh map rather than breaking free flight. */
export function parseWorldSave(raw: string | null): WorldSave {
  const result = emptyWorldSave();
  try {
    const input = JSON.parse(raw ?? "null");
    if (input?.version !== 1 || !Array.isArray(input.beacons)) return result;
    result.beacons = KINGDOMS.map(kingdom => kingdom.id).filter(id => input.beacons.includes(id));
  } catch { /* Start fresh. */ }
  return result;
}

/** Light a beacon; lighting one twice (or an unknown one) changes nothing. */
export function lightBeacon(save: WorldSave, id: string): WorldSave {
  if (!KINGDOM_IDS.has(id) || save.beacons.includes(id as KingdomId)) return save;
  return { ...save, beacons: KINGDOMS.map(kingdom => kingdom.id).filter(kingdom => kingdom === id || save.beacons.includes(kingdom)) };
}

/** Lit beacons persist on this browser; storage failures never block play. */
export function useWorldSave() {
  const [save, setSave] = useState<WorldSave>(() => {
    try { return parseWorldSave(localStorage.getItem(WORLD_KEY)); }
    catch { return emptyWorldSave(); }
  });
  const latest = useRef(save);
  const light = useCallback((id: string) => {
    const next = lightBeacon(latest.current, id);
    if (next === latest.current) return;
    latest.current = next;
    setSave(next);
    try { localStorage.setItem(WORLD_KEY, JSON.stringify(next)); }
    catch { /* This flight still remembers it. */ }
  }, []);
  return { save, light };
}
