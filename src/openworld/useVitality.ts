import { useEffect, useRef, useState } from "react";
import type { DragonType } from "../dragons";
import { HOARD_SITE } from "../game/loot";
import { lootToast } from "../game/lootRuntime";
import { gameSession, missionEmitter, playerStatus } from "../game/runtime";
import { createVitality, damageVitality, regenerateVitality, reviveVitality } from "../game/vitality";

/** How long the screen stays dark before you wake up beside your hoard. */
const KNOCKOUT_SECONDS = 1.8;

/**
 * Free-flight health: rival fire wears it down, quiet skies refill it, and a knockout
 * shakes your treasure loose and sends you home.
 */
export function useVitality(dragon: DragonType) {
  const [state, setState] = useState(createVitality);
  // The event handlers read the latest values through refs (updated in effects, never in render).
  const vitality = useRef(state);
  const armor = useRef(dragon.stats.armor);
  const [hurt, setHurt] = useState(0);
  const [knockedOut, setKnockedOut] = useState(false);
  useEffect(() => { armor.current = dragon.stats.armor; }, [dragon.stats.armor]);

  useEffect(() => {
    let wake = 0;
    const onHit = (event: Event) => {
      const { damage } = (event as CustomEvent<{ damage: number }>).detail;
      const result = damageVitality(vitality.current, damage, armor.current, gameSession.elapsed, playerStatus.invulnerable);
      if (result.vitality === vitality.current) return;
      vitality.current = result.vitality;
      setState(result.vitality);
      setHurt(count => count + 1);
      if (!result.knockedOut) return;
      missionEmitter.dispatchEvent(new Event("player_knockout"));
      setKnockedOut(true);
      lootToast("Knocked out of the sky! Your treasure tumbles away.", "warn");
      wake = window.setTimeout(() => {
        missionEmitter.dispatchEvent(new CustomEvent("player_teleport", { detail: { x: HOARD_SITE.x, y: 9, z: HOARD_SITE.z + 16, heading: 0 } }));
        vitality.current = reviveVitality(vitality.current);
        setState(vitality.current);
        setKnockedOut(false);
      }, KNOCKOUT_SECONDS * 1000);
    };
    missionEmitter.addEventListener("player_hit", onHit);
    const regen = window.setInterval(() => {
      const next = regenerateVitality(vitality.current, gameSession.elapsed, 0.25);
      if (next === vitality.current) return;
      vitality.current = next;
      setState(next);
    }, 250);
    return () => {
      missionEmitter.removeEventListener("player_hit", onHit);
      window.clearInterval(regen);
      window.clearTimeout(wake);
    };
  }, []);
  return { vitality: state, hurt, knockedOut };
}
