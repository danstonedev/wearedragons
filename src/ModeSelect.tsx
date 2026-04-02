import type { CSSProperties } from "react";
import type { DragonType } from "./dragons";

export default function ModeSelect({
  dragon,
  onMissions,
  onOpenWorld,
  onBack,
}: {
  dragon: DragonType;
  onMissions: () => void;
  onOpenWorld: () => void;
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
              Fly freely across Pyrrhia, Pantala, and Glaeryus. Discover
              hidden beacons, explore each region's terrain, and roam without
              objectives or fail states.
            </div>
            <div className="mode-card-tag">3 REGIONS · 3 BEACONS</div>
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
