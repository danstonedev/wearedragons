import { useRef, useState, useCallback, useEffect } from "react";
import type { DragonType } from "../dragons";
import "./TouchControls.css";

/* ---- Shared global input state (same object as App.tsx) ---- */
// These are imported by reference from the module-level globals in App.tsx.
// We receive them as props to avoid tight coupling.
interface JoyState {
  left: { x: number; y: number };
  throttle: number;
  fire: boolean;
  special: boolean;
}

interface AbilityHUDState {
  cooldownLeft: number;
  active: boolean;
  label: string;
}

/* ============================================================
   Steering Stick
   ============================================================ */

function SteeringStick({
  joy,
  maxDist = 48,
}: {
  joy: JoyState;
  maxDist?: number;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [thumbPos, setThumbPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const deadzone = 0.15;

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!baseRef.current) return;
      const rect = baseRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
      }
      setThumbPos({ x: dx, y: dy });

      const normX = dx / maxDist;
      const normY = dy / maxDist;

      // Apply deadzone
      joy.left.x = Math.abs(normX) > deadzone ? normX : 0;
      // Y axis: stick up = climb (positive altitude), stick down = dive
      joy.left.y = Math.abs(normY) > deadzone ? -normY : 0;

      // Auto-throttle: engaged when stick is active
      const displacement = dist / maxDist;
      joy.throttle = displacement > deadzone ? 0.85 : 0.7;
    },
    [joy, maxDist],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.target instanceof Element) {
        e.target.setPointerCapture(e.pointerId);
      }
      setActive(true);
      updateFromPointer(e.clientX, e.clientY);
    },
    [updateFromPointer],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (
        e.target instanceof Element &&
        e.target.hasPointerCapture(e.pointerId)
      ) {
        updateFromPointer(e.clientX, e.clientY);
      }
    },
    [updateFromPointer],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.target instanceof Element) {
        e.target.releasePointerCapture(e.pointerId);
      }
      setActive(false);
      setThumbPos({ x: 0, y: 0 });
      joy.left.x = 0;
      joy.left.y = 0;
      joy.throttle = 0;
    },
    [joy],
  );

  return (
    <div
      className="touch-stick-zone"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        ref={baseRef}
        className={`touch-stick-base ${active ? "active" : ""}`}
      >
        <span className="touch-stick-hint up">Climb</span>
        <span className="touch-stick-hint down">Dive</span>
        <span className="touch-stick-hint left">&#9664;</span>
        <span className="touch-stick-hint right">&#9654;</span>

        <div
          className="touch-stick-thumb"
          style={{
            transform: `translate(calc(-50% + ${thumbPos.x}px), calc(-50% + ${thumbPos.y}px))`,
          }}
        />
      </div>
    </div>
  );
}

/* ============================================================
   Speed Gauge
   ============================================================ */

function SpeedGauge({ joy }: { joy: JoyState }) {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 120);
    return () => clearInterval(interval);
  }, []);

  const pct = Math.round((joy.throttle / 1.0) * 100);

  return (
    <div className="touch-speed-gauge">
      <div className="touch-speed-track">
        <div className="touch-speed-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="touch-speed-label">Speed</div>
    </div>
  );
}

/* ============================================================
   Fire Button
   ============================================================ */

function FireButton({ joy }: { joy: JoyState }) {
  const [active, setActive] = useState(false);

  const handleDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.target instanceof Element) {
        e.target.setPointerCapture(e.pointerId);
      }
      setActive(true);
      joy.fire = true;
    },
    [joy],
  );

  const handleUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.target instanceof Element) {
        e.target.releasePointerCapture(e.pointerId);
      }
      setActive(false);
      joy.fire = false;
    },
    [joy],
  );

  return (
    <div
      className={`touch-btn touch-btn-fire ${active ? "active" : ""}`}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      <span className="touch-btn-label">FIRE</span>
    </div>
  );
}

/* ============================================================
   Special Ability Button (with cooldown overlay)
   ============================================================ */

function SpecialButton({
  joy,
  abilityState,
}: {
  joy: JoyState;
  abilityState: AbilityHUDState;
}) {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 100);
    return () => clearInterval(interval);
  }, []);

  const cd = abilityState.cooldownLeft;
  const ready = cd <= 0;

  const handleDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      joy.special = true;
    },
    [joy],
  );

  // Cooldown radial wipe: conic-gradient from 0 to remaining fraction
  const cooldownFraction = ready ? 0 : Math.min(1, cd / 8); // 8s is roughly max cooldown
  const cooldownBg = ready
    ? "transparent"
    : `conic-gradient(rgba(0,0,0,0.5) ${cooldownFraction * 360}deg, transparent ${cooldownFraction * 360}deg)`;

  return (
    <div
      className={`touch-btn touch-btn-special ${ready ? "ready" : "on-cooldown"}`}
      onPointerDown={handleDown}
    >
      <div
        className="touch-btn-cooldown-ring"
        style={{ background: cooldownBg }}
      />
      <span className="touch-btn-label">{abilityState.label}</span>
      {!ready && (
        <span className="touch-btn-cooldown-text">{cd.toFixed(1)}s</span>
      )}
    </div>
  );
}

/* ============================================================
   Composed Touch Controls
   ============================================================ */

export default function TouchControls({
  joy,
  abilityState,
}: {
  dragon: DragonType;
  joy: JoyState;
  abilityState: AbilityHUDState;
}) {
  return (
    <div className="touch-controls">
      <SteeringStick joy={joy} />
      <SpeedGauge joy={joy} />
      <FireButton joy={joy} />
      <SpecialButton joy={joy} abilityState={abilityState} />
    </div>
  );
}
