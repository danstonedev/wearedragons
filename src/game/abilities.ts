import type { AbilityConfig, AbilityType } from "../dragons";

export interface AbilityRuntime {
  type: AbilityType | null;
  remaining: number;
  cooldown: number;
}

export const createAbilityState = (): AbilityRuntime => ({ type: null, remaining: 0, cooldown: 0 });

export function activateAbility(state: AbilityRuntime, config: AbilityConfig): boolean {
  if (state.cooldown > 0) return false;
  state.type = config.type;
  // Impulses need to survive the movement update; slam lasts until landing.
  state.remaining = config.type === "updraft" ? 0.65 : config.type === "ground_slam" ? 4 : Math.max(0.15, config.duration);
  state.cooldown = config.cooldown;
  return true;
}

export function stepAbility(state: AbilityRuntime, delta: number, grounded: boolean) {
  state.cooldown = Math.max(0, state.cooldown - delta);
  const impact = state.type === "ground_slam" && grounded && state.remaining > 0;
  state.remaining = impact ? 0 : Math.max(0, state.remaining - delta);
  if (state.remaining === 0) state.type = null;
  return impact;
}
