import { useEffect, useState } from "react";
import { abilityState } from "../game/runtime";
import type { DragonType } from "../dragons";

export default function FlightHUD({ dragon, paused, onPause }: { dragon: DragonType; paused: boolean; onPause: () => void }) {
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setCooldown(abilityState.cooldownLeft), 100);
    return () => window.clearInterval(timer);
  }, []);
  return <>
    <div className="flight-controls-hint">
      WASD / arrows: fly · Space / Shift: climb / dive · F: fire · Q: {dragon.special.label.toLowerCase()}
    </div>
    <button type="button" className="flight-pause" onClick={onPause}>{paused ? "RESUME" : "PAUSE"} [ESC]</button>
    <div className="flight-ability" aria-live="off">{dragon.special.label} · {cooldown > 0 ? `${cooldown.toFixed(1)}s` : "READY"}</div>
  </>;
}
