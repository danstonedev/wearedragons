export interface TouchInputState {
  left: { x: number; y: number };
  throttle: number;
  fire: boolean;
  special: boolean;
}

/** Adapter to the mutable simulation input store. This is external state, not React props/state. */
export function updateTouchInput(state: TouchInputState, changes: Partial<{ turn: number; climb: number; throttle: number; fire: boolean; special: boolean }>) {
  if (changes.turn !== undefined) state.left.x = changes.turn;
  if (changes.climb !== undefined) state.left.y = changes.climb;
  if (changes.throttle !== undefined) state.throttle = changes.throttle;
  if (changes.fire !== undefined) state.fire = changes.fire;
  if (changes.special !== undefined) state.special = changes.special;
}
