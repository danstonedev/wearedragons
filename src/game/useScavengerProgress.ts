import { useCallback, useRef, useState } from "react";
import { emptyScavengerProgress, parseScavengerProgress, recordRaid, SCAVENGER_KEY } from "./scavenger";
import type { LairDef, RaidResult, ScavengerProgress } from "./scavenger";

/** Raid records persist on this browser; storage failures never block play. */
export function useScavengerProgress() {
  const [progress, setProgress] = useState<ScavengerProgress>(() => {
    try { return parseScavengerProgress(localStorage.getItem(SCAVENGER_KEY)); }
    catch { return emptyScavengerProgress(); }
  });
  const [saveUnavailable, setSaveUnavailable] = useState(false);
  const latest = useRef(progress);
  const record = useCallback((lair: LairDef, result: RaidResult) => {
    const next = recordRaid(latest.current, lair, result);
    if (next === latest.current) return;
    latest.current = next;
    setProgress(next);
    try { localStorage.setItem(SCAVENGER_KEY, JSON.stringify(next)); setSaveUnavailable(false); }
    catch { setSaveUnavailable(true); }
  }, []);
  return { progress, record, saveUnavailable };
}
