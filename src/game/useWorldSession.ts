import { useCallback, useEffect, useState } from "react";
import { gameSession, missionEmitter, resetInput } from "./runtime";

export function useWorldSession(blockingOverlay: boolean) {
  const [manualPause, setManualPause] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const paused = blockingOverlay || manualPause || hidden;
  const togglePause = useCallback(() => setManualPause(previous => !previous), []);
  useEffect(() => {
    gameSession.elapsed = 0;
    resetInput();
    return () => { gameSession.ready = false; gameSession.paused = true; resetInput(); };
  }, []);
  useEffect(() => {
    gameSession.paused = paused;
    if (paused) resetInput();
  }, [paused]);
  useEffect(() => {
    const blur = () => { resetInput(); setManualPause(true); };
    const visibility = () => { resetInput(); setHidden(document.hidden); };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.repeat && !blockingOverlay) togglePause();
    };
    window.addEventListener("blur", blur);
    window.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", visibility);
    missionEmitter.addEventListener("pause_toggle", togglePause);
    return () => {
      window.removeEventListener("blur", blur);
      window.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", visibility);
      missionEmitter.removeEventListener("pause_toggle", togglePause);
    };
  }, [blockingOverlay, togglePause]);
  return { paused, manualPause, togglePause };
}
