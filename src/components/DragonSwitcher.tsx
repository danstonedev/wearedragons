import { useEffect, useRef, useState } from "react";
import type { DragonType } from "../dragons";
import { DRAGON_TYPES, TRIBES } from "../dragons";
import { MAX_STAT } from "../constants";

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const value = Number.parseInt(fullHex, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function getReadableAccent(dragon: DragonType) {
  const preferred =
    dragon.colors.eye === "#1A1A1A" ? dragon.colors.body : dragon.colors.eye;
  return relativeLuminance(preferred) < 0.14 ? dragon.colors.wing : preferred;
}

function getReadableTextColor(backgroundHex: string) {
  return relativeLuminance(backgroundHex) > 0.58 ? "#140f0b" : "#fff7ed";
}

export default function DragonSwitcher({
  current,
  onSwap,
}: {
  current: DragonType;
  onSwap: (d: DragonType) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tribe, setTribe] = useState<string>(current.tribe);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const tribeDragons = DRAGON_TYPES.filter((d) => d.tribe === tribe);
  const currentAccent = getReadableAccent(current);


  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        shellRef.current &&
        event.target instanceof Node &&
        !shellRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`switcher-shell ${open ? "open" : ""}`} ref={shellRef}>
      <button
        type="button"
        className="switcher-summary"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="dragon-switcher-panel"
        style={{
          borderColor: rgba(currentAccent, open ? 0.55 : 0.26),
          boxShadow: `0 18px 48px rgba(0, 0, 0, 0.36), 0 0 0 1px ${rgba(currentAccent, open ? 0.26 : 0.14)} inset`,
        }}
      >
        <div
          className="switcher-summary-swatch"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${current.colors.wing}, ${current.colors.body}, ${current.colors.bodyDark})`,
            boxShadow: `0 0 0 1px ${rgba(currentAccent, 0.28)} inset, 0 0 18px ${rgba(currentAccent, 0.18)}`,
          }}
        />
        <span
          className="switcher-summary-name"
          style={{ color: open ? "#fff7ed" : currentAccent }}
        >
          {current.name}
        </span>
        <span className="switcher-summary-chevron" aria-hidden="true">
          v
        </span>
      </button>

      <div
        id="dragon-switcher-panel"
        className="switcher-panel"
        style={{
          borderColor: rgba(currentAccent, 0.18),
          boxShadow: `0 24px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px ${rgba(currentAccent, 0.08)} inset`,
        }}
      >
        <div className="switcher-panel-top">
          <p className="switcher-title">Switch Dragon</p>
          <p className="switcher-subtitle">
            Swap mid-flight whenever you need a different edge.
          </p>
        </div>

        <div className="switcher-tribe-row">
          {TRIBES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`switcher-tribe-btn ${tribe === t.id ? "active" : ""}`}
              onClick={() => setTribe(t.id)}
              style={
                tribe === t.id
                  ? {
                      background: `linear-gradient(180deg, ${rgba(t.color, 0.34)}, ${rgba(t.color, 0.16)})`,
                      borderColor: rgba(t.color, 0.64),
                      boxShadow: `0 0 0 1px ${rgba(t.color, 0.14)} inset`,
                    }
                  : undefined
              }
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="switcher-list">
          {tribeDragons.map((d) => {
            const isCurrent = d.id === current.id;
            const accent = getReadableAccent(d);
            return (
              <button
                key={d.id}
                type="button"
                className={`switcher-item ${isCurrent ? "active" : ""}`}
                onClick={() => {
                  onSwap(d);
                  setOpen(false);
                }}
                style={{
                  borderColor: isCurrent
                    ? rgba(accent, 0.9)
                    : rgba(accent, 0.12),
                  background: isCurrent ? rgba(accent, 0.12) : undefined,
                  boxShadow: isCurrent
                    ? `0 0 0 1px ${rgba(accent, 0.2)} inset`
                    : undefined,
                }}
              >
                <div
                  className="switcher-swatch"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${d.colors.wing}, ${d.colors.body}, ${d.colors.bodyDark})`,
                    boxShadow: `0 0 0 1px ${rgba(accent, 0.22)} inset`,
                  }}
                />
                <div className="switcher-item-info">
                  <div className="switcher-item-head">
                    <p
                      className="switcher-item-name"
                      style={isCurrent ? { color: accent } : undefined}
                    >
                      {d.name}
                    </p>
                    {isCurrent && (
                      <span
                        className="switcher-current-badge"
                        style={{
                          background: accent,
                          color: getReadableTextColor(accent),
                        }}
                      >
                        Current
                      </span>
                    )}
                  </div>
                  <p className="switcher-item-ability">{d.ability}</p>
                </div>
                <div className="switcher-item-stats">
                  {[
                    d.stats.speed,
                    d.stats.firepower,
                    d.stats.agility,
                    d.stats.armor,
                  ].map((v, i) => {
                    const pct = Math.round((v / MAX_STAT) * 100);
                    const col =
                      v >= 1.2 ? "#4caf50" : v >= 0.9 ? "#ffc107" : "#ff5722";
                    return (
                      <div key={i} className="switcher-mini-bar">
                        <div
                          className="switcher-mini-fill"
                          style={{ height: `${pct}%`, background: col }}
                        />
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
