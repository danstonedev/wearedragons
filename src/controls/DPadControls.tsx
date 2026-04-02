import { useRef, useCallback, useEffect } from "react";
import "./DPadControls.css";

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
   Single D-Pad arrow button
   ============================================================ */

function ArrowBtn({
  dir,
  label,
  onDown,
  onUp,
}: {
  dir: "up" | "down" | "left" | "right";
  label: string;
  onDown: () => void;
  onUp: () => void;
}) {
  const handleDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.target instanceof Element) e.target.setPointerCapture(e.pointerId);
      onDown();
    },
    [onDown],
  );
  const handleUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.target instanceof Element)
        e.target.releasePointerCapture(e.pointerId);
      onUp();
    },
    [onUp],
  );

  const arrows: Record<string, string> = {
    up: "\u25B2",
    down: "\u25BC",
    left: "\u25C0",
    right: "\u25B6",
  };

  return (
    <div
      className={`dpad-btn dpad-btn-${dir}`}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      <span className="dpad-arrow">{arrows[dir]}</span>
      <span className="dpad-label">{label}</span>
    </div>
  );
}

/* ============================================================
   D-Pad — 4 big directional buttons
   ============================================================ */

function DPad({ joy }: { joy: JoyState }) {
  // Track which directions are currently held
  const held = useRef({ up: false, down: false, left: false, right: false });

  const sync = useCallback(() => {
    const h = held.current;
    joy.left.x = (h.right ? 1 : 0) - (h.left ? 1 : 0);
    joy.left.y = (h.up ? 1 : 0) - (h.down ? 1 : 0);
    // Auto-throttle: cruise forward whenever any direction is pressed
    joy.throttle = h.up || h.down || h.left || h.right ? 0.75 : 0;
  }, [joy]);

  // Clear inputs on unmount
  useEffect(() => {
    return () => {
      joy.left.x = 0;
      joy.left.y = 0;
      joy.throttle = 0;
    };
  }, [joy]);

  return (
    <div className="dpad-zone">
      <ArrowBtn
        dir="up"
        label="Climb"
        onDown={() => {
          held.current.up = true;
          sync();
        }}
        onUp={() => {
          held.current.up = false;
          sync();
        }}
      />
      <ArrowBtn
        dir="down"
        label="Dive"
        onDown={() => {
          held.current.down = true;
          sync();
        }}
        onUp={() => {
          held.current.down = false;
          sync();
        }}
      />
      <ArrowBtn
        dir="left"
        label="Left"
        onDown={() => {
          held.current.left = true;
          sync();
        }}
        onUp={() => {
          held.current.left = false;
          sync();
        }}
      />
      <ArrowBtn
        dir="right"
        label="Right"
        onDown={() => {
          held.current.right = true;
          sync();
        }}
        onUp={() => {
          held.current.right = false;
          sync();
        }}
      />
    </div>
  );
}

/* ============================================================
   Fire Button (identical behaviour to TouchControls version)
   ============================================================ */

function DPadFireButton({ joy }: { joy: JoyState }) {
  const handleDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.target instanceof Element) e.target.setPointerCapture(e.pointerId);
      joy.fire = true;
    },
    [joy],
  );
  const handleUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.target instanceof Element)
        e.target.releasePointerCapture(e.pointerId);
      joy.fire = false;
    },
    [joy],
  );

  return (
    <div
      className="dpad-fire-btn"
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      <span className="dpad-fire-label">FIRE</span>
    </div>
  );
}

/* ============================================================
   Special / Ability Button
   ============================================================ */

function DPadSpecialButton({
  joy,
  abilityState,
}: {
  joy: JoyState;
  abilityState: AbilityHUDState;
}) {
  const ready = abilityState.cooldownLeft <= 0;

  const handleDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      joy.special = true;
    },
    [joy],
  );

  return (
    <div
      className={`dpad-special-btn ${ready ? "ready" : "on-cooldown"}`}
      onPointerDown={handleDown}
    >
      <span className="dpad-special-label">{abilityState.label}</span>
    </div>
  );
}

/* ============================================================
   Composed D-Pad Controls
   ============================================================ */

export default function DPadControls({
  joy,
  abilityState,
}: {
  joy: JoyState;
  abilityState: AbilityHUDState;
}) {
  return (
    <div className="dpad-controls">
      <DPad joy={joy} />
      <DPadFireButton joy={joy} />
      <DPadSpecialButton joy={joy} abilityState={abilityState} />
    </div>
  );
}
