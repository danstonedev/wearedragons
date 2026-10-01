import { useEffect, useState } from "react";
import { rivalHud } from "../game/rivalRuntime";
import type { Vitality } from "../game/vitality";

function useRivalHud() {
  const read = () => ({ ...rivalHud, nearest: rivalHud.nearest && { ...rivalHud.nearest }, alarm: rivalHud.alarm && { ...rivalHud.alarm } });
  const [hud, setHud] = useState(read);
  useEffect(() => {
    const timer = window.setInterval(() => setHud(read()), 200);
    return () => window.clearInterval(timer);
  }, []);
  return hud;
}

/** Health (when hurt), who is after you and where, kingdom alerts, and the knockout screen. */
export default function CombatHUD({ vitality, hurt, knockedOut }: { vitality: Vitality; hurt: number; knockedOut: boolean }) {
  const hud = useRivalHud();
  const fraction = Math.max(0, vitality.hp / vitality.max);
  const showHealth = fraction < 1 || hud.chasing > 0;
  const threat = hud.nearest;
  return <>
    <div className="ow-vitals">
      {hud.alarm && <div className="ow-alarm">⚑ {hud.alarm.name.toUpperCase()} ON ALERT · {Math.ceil(hud.alarm.remaining)}s</div>}
      {threat && <div className={`ow-threat ${threat.mode === "warn" ? "warn" : "chase"}`}>
        <span className="loot-arrow" style={{ transform: `rotate(${-threat.bearing}rad)` }} aria-hidden="true">▲</span>
        {threat.champion ? "★ " : ""}{threat.name} the {threat.tribe} {threat.mode === "warn" ? "warns you off" : "is after you"}
        {hud.chasing > 1 ? ` · ${hud.chasing} chasing` : ""} · {Math.round(threat.distance)} m
      </div>}
      {showHealth && <div className="ow-health" aria-label="Health">
        <i style={{ width: `${fraction * 100}%`, background: fraction > 0.5 ? "#5fe08a" : fraction > 0.25 ? "#ffc14a" : "#ff5a46" }} />
        <span>HP {Math.ceil(vitality.hp)}/{vitality.max}</span>
      </div>}
    </div>
    {hurt > 0 && <div key={hurt} className="ow-hurt" aria-hidden="true" />}
    {knockedOut && <div className="ow-knockout"><h2>Knocked out of the sky!</h2><p>You'll wake beside your hoard…</p></div>}
  </>;
}
