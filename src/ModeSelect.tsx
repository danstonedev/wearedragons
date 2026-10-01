import type { CSSProperties } from "react";
import type { DragonType } from "./dragons";

export default function ModeSelect({
  dragon,
  onMissions,
  onOpenWorld,
  onScavengers,
  onBack,
}: {
  dragon: DragonType;
  onMissions: () => void;
  onOpenWorld: () => void;
  onScavengers: () => void;
  onBack: () => void;
}) {
  const accent =
    dragon.colors.eye === "#1A1A1A" ? dragon.colors.body : dragon.colors.eye;

  return (
    <div className="brief-screen">
      <div className="mode-select-shell">
        <div className="mode-select-header">
          <div className="mission-select-flying">
            Flying as{" "}
            <span style={{ color: accent }}>{dragon.name.toUpperCase()}</span>
          </div>
          <h1 className="mode-select-title">Choose Your Path</h1>
        </div>

        <div className="mode-select-cards">
          <button
            type="button"
            className="mode-card"
            onClick={onMissions}
            style={{ "--mode-accent": "#ff6644" } as CSSProperties}
          >
            <div className="mode-card-icon">⚔</div>
            <div className="mode-card-label">MISSIONS</div>
            <div className="mode-card-desc">
              Structured objectives across three regions. Earn stars, challenge
              your dragon's strengths, and push back the raider threat.
            </div>
            <div className="mode-card-tag">4 MISSIONS AVAILABLE</div>
          </button>

          <button
            type="button"
            className="mode-card"
            onClick={onOpenWorld}
            style={{ "--mode-accent": "#44bbff" } as CSSProperties}
          >
            <div className="mode-card-icon">◈</div>
            <div className="mode-card-label">OPEN WORLD</div>
            <div className="mode-card-desc">
              Fly freely across Pyrrhia, Pantala, and Glaeryus. Swoop low to
              snatch treasure in your talons, from treetops, rock spires, and
              drifting sky lanterns, and carry it home to grow your hoard.
            </div>
            <div className="mode-card-tag">24 TREASURES · YOUR HOARD</div>
          </button>

          <button
            type="button"
            className="mode-card"
            onClick={onScavengers}
            style={{ "--mode-accent": "#e7b26a" } as CSSProperties}
          >
            <div className="mode-card-icon">☾</div>
            <div className="mode-card-label">SCAVENGERS</div>
            <div className="mode-card-desc">
              Switch sides. Play as a human from the underground Burrows,
              sneak into a dragon's lair, steal from its hoard, and escape
              before it wakes up and catches you.
            </div>
            <div className="mode-card-tag">3 LAIRS · STEALTH</div>
          </button>
        </div>

        <div className="mode-select-actions">
          <button
            type="button"
            className="brief-btn brief-btn-back"
            onClick={onBack}
          >
            CHANGE DRAGON
          </button>
        </div>
      </div>
    </div>
  );
}
