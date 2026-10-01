import { useCallback, useRef, useState } from "react";
import { bankLoot, emptyHoard, HOARD_KEY, parseHoard, stealGold } from "./loot";
import type { HoardProgress, TreasureDef } from "./loot";

/** The dragon hoard persists on this browser; storage failures never block play. */
export function useHoard() {
  const [hoard, setHoard] = useState<HoardProgress>(() => {
    try { return parseHoard(localStorage.getItem(HOARD_KEY)); }
    catch { return emptyHoard(); }
  });
  const [saveUnavailable, setSaveUnavailable] = useState(false);
  const latest = useRef(hoard);
  const commit = useCallback((next: HoardProgress) => {
    latest.current = next;
    setHoard(next);
    try { localStorage.setItem(HOARD_KEY, JSON.stringify(next)); setSaveUnavailable(false); }
    catch { setSaveUnavailable(true); }
  }, []);
  const bank = useCallback((def: TreasureDef, dragonId: string, value: number) => {
    const next = bankLoot(latest.current, def, dragonId, value);
    if (next !== latest.current) commit(next);
  }, [commit]);
  /** Scavengers scoop gold out of the hoard; it is owed by their camp until you win it back. Returns the gold taken. */
  const steal = useCallback((campId: string, amount: number) => {
    const { hoard: next, taken } = stealGold(latest.current, campId, amount);
    if (taken) commit(next);
    return taken;
  }, [commit]);
  return { hoard, bank, steal, saveUnavailable };
}
