export interface Vector3Like { x: number; y: number; z: number }

/** Exact exponential response: the same response at 30, 60, or 120 Hz. */
export function damping(response: number, delta: number) {
  return 1 - Math.exp(-response * Math.max(0, delta));
}

export function damp(value: number, target: number, response: number, delta: number) {
  return value + (target - value) * damping(response, delta);
}

export function clampInput(value: number) {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

export function flightVelocity(
  previous: Vector3Like,
  input: { forward: number; climb: number },
  heading: number,
  maxSpeed: number,
  climbSensitivity: number,
  altitude: number,
  delta: number,
  verticalOverride?: number,
  feel?: { glide: boolean; brake: boolean; agility: number; grounded: boolean; speedCeiling?: number },
): Vector3Like {
  const climb = clampInput(input.climb);
  const gliding = Boolean(feel?.glide && !feel.grounded && !feel.brake && verticalOverride === undefined);
  const energy = feel && !feel.grounded ? 1 + Math.max(0, -climb) * 0.35 - Math.max(0, climb) * 0.22 : 1;
  const speed = clampInput(input.forward) * Math.min(maxSpeed * energy, feel?.speedCeiling ?? Infinity);
  const response = feel ? feel.brake ? 12 : feel.grounded ? 9 : 2.5 + Math.max(0.5, Math.min(1.5, feel.agility)) : 7;
  const glideDecay = Math.exp(-0.22 * delta);
  const glideSpeed = Math.min(Math.hypot(previous.x, previous.z), feel?.speedCeiling ?? Infinity) * glideDecay;
  const glideTurn = Math.max(0.5, feel?.agility ?? 1) * 0.8;
  const y = verticalOverride ?? (gliding ? -1.8 + climb * maxSpeed * 0.22 * climbSensitivity : climb * maxSpeed * 0.75 * climbSensitivity);
  return {
    x: gliding ? damp(previous.x * glideDecay, -Math.sin(heading) * glideSpeed, glideTurn, delta) : damp(previous.x, feel?.brake ? 0 : Math.sin(heading) * speed, response, delta),
    // Predict the next step, so a dive cannot overshoot the ground clearance.
    y: Math.max(
      verticalOverride === undefined ? damp(previous.y, y, 8, delta) : y,
      (1.2 - altitude) / Math.max(delta, 1 / 120),
    ),
    z: gliding ? damp(previous.z * glideDecay, -Math.cos(heading) * glideSpeed, glideTurn, delta) : damp(previous.z, feel?.brake ? 0 : Math.cos(heading) * speed, response, delta),
  };
}

/** Continuous collision test. Returns the first hit along a segment, or null. */
export function segmentSphereHit(
  start: Vector3Like,
  end: Vector3Like,
  center: Vector3Like,
  radius: number,
): number | null {
  const x = start.x - center.x, y = start.y - center.y, z = start.z - center.z;
  const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
  const c = x * x + y * y + z * z - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-12) return null;
  const b = x * dx + y * dy + z * dz;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : null;
}
