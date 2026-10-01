import { useCallback, useRef, useState } from "react";
import { bankLoot, emptyHoard, HOARD_KEY, parseHoard } from "./loot";
import type { HoardProgress, TreasureDef } from "./loot";

/** The dragon hoard persists on this browser; storage failures never block play. */
export function useHoard() {
  const [hoard, setHoard] = useState<HoardProgress>(() => {
    try { return parseHoard(localStorage.getItem(HOARD_KEY)); }
    catch { return emptyHoard(); }
  });
  const [saveUnavailable, setSaveUnavailable] = useState(false);
  const latest = useRef(hoard);
  const bank = useCallback((def: TreasureDef, dragonId: string, value: number) => {
    const next = bankLoot(latest.current, def, dragonId, value);
    if (next === latest.current) return;
    latest.current = next;
    setHoard(next);
    try { localStorage.setItem(HOARD_KEY, JSON.stringify(next)); setSaveUnavailable(false); }
    catch { setSaveUnavailable(true); }
  }, []);
  return { hoard, bank, saveUnavailable };
}
