export interface SavedControlSettings {
  scheme: "joystick" | "buttons";
  turnSensitivity: number;
  climbSensitivity: number;
  speedSensitivity: number;
}

export function validateSettings(value: unknown, defaults: SavedControlSettings): SavedControlSettings {
  const next = { ...defaults };
  if (!value || typeof value !== "object" || Array.isArray(value)) return next;
  const input = value as Record<string, unknown>;
  if (input.scheme === "joystick" || input.scheme === "buttons") next.scheme = input.scheme;
  for (const name of ["turnSensitivity", "climbSensitivity", "speedSensitivity"] as const) {
    const setting = input[name];
    if (typeof setting === "number" && Number.isFinite(setting)) next[name] = Math.max(0.2, Math.min(2, setting));
  }
  return next;
}
