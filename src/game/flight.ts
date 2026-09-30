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
): Vector3Like {
  const speed = clampInput(input.forward) * maxSpeed;
  const y = verticalOverride ?? clampInput(input.climb) * maxSpeed * 0.75 * climbSensitivity;
  return {
    x: damp(previous.x, Math.sin(heading) * speed, 7, delta),
    // Predict the next step, so a dive cannot overshoot the ground clearance.
    y: Math.max(
      verticalOverride === undefined ? damp(previous.y, y, 8, delta) : y,
      (1.2 - altitude) / Math.max(delta, 1 / 120),
    ),
    z: damp(previous.z, Math.cos(heading) * speed, 7, delta),
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
