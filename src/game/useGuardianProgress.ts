import { useCallback, useState } from "react";
import { emptyProgress, parseProgress, PROGRESS_KEY, recordVictory } from "./progression";
import type { MissionDefinition, MissionRuntimeState } from "./missions";

export function useGuardianProgress() {
  const [progress, setProgress] = useState(() => {
    try { return parseProgress(localStorage.getItem(PROGRESS_KEY)); }
    catch { return emptyProgress(); }
  });
  const [saveUnavailable, setSaveUnavailable] = useState(false);
  const saveVictory = useCallback((mission: MissionDefinition, state: MissionRuntimeState, dragonId: string) => {
    const next = recordVictory(progress, mission, state, dragonId);
    if (next === progress) return;
    setProgress(next);
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); setSaveUnavailable(false); }
    catch { setSaveUnavailable(true); }
  }, [progress]);
  return { progress, saveVictory, saveUnavailable };
}
