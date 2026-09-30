import { useEffect, useState } from "react";
import { abilityState, playerStatus, combatFeedback, gameSession } from "../game/runtime";
import type { DragonType } from "../dragons";

export default function FlightHUD({ dragon, paused, onPause }: { dragon: DragonType; paused: boolean; onPause: () => void }) {
  const [status, setStatus] = useState({ cooldown: 0, speed: 0, mode: "hover", message: "" });
  useEffect(() => {
    const timer = window.setInterval(() => setStatus({ cooldown: abilityState.cooldownLeft, speed: playerStatus.speed, mode: playerStatus.flightMode, message: gameSession.elapsed - combatFeedback.destroyedAt < 0.7 ? "TARGET DESTROYED" : gameSession.elapsed - combatFeedback.hitAt < 0.4 ? "HIT CONFIRMED" : "" }), 100);
    return () => window.clearInterval(timer);
  }, []);
  return <>
    <div className="flight-controls-hint">
      WASD / arrows: fly · Space / Shift: climb / dive · F: fire · Q: {dragon.special.label.toLowerCase()}
    </div>
    <button type="button" className="flight-pause" onClick={onPause}>{paused ? "RESUME" : "PAUSE"} [ESC]</button>
    <div className="flight-ability" aria-live="off">{status.mode.toUpperCase()} · SPEED {status.speed.toFixed(0)}<br />{dragon.special.label} · {status.cooldown > 0 ? `${status.cooldown.toFixed(1)}s` : "READY"}</div>
    {status.message && <div className="combat-confirmation">{status.message}</div>}
  </>;
}
