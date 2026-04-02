import type { CSSProperties } from "react";
import { MISSIONS } from "./game/missions";
import type { MissionDefinition } from "./game/missions";
import type { DragonType } from "./dragons";

const TYPE_LABELS: Record<string, string> = {
  fortress_raid: "ASSAULT",
  beacon_run: "RACE",
  hunter_ambush: "SURVIVAL",
};

const TYPE_COLORS: Record<string, string> = {
  fortress_raid: "#ff6644",
  beacon_run: "#44bbff",
  hunter_ambush: "#ff44aa",
};

export default function MissionSelect({
  dragon,
  onSelect,
  onBack,
}: {
  dragon: DragonType;
  onSelect: (m: MissionDefinition) => void;
  onBack: () => void;
}) {
  const accent =
    dragon.colors.eye === "#1A1A1A" ? dragon.colors.body : dragon.colors.eye;

  return (
    <div className="brief-screen">
      <div className="mission-select-shell">
        <div className="mission-select-header">
          <div className="mission-select-flying">
            Flying as{" "}
            <span style={{ color: accent }}>{dragon.name.toUpperCase()}</span>
          </div>
          <h1 className="mission-select-title">Select Mission</h1>
        </div>

        <div className="mission-select-list">
          {MISSIONS.map((m) => {
            const typeColor = TYPE_COLORS[m.type] ?? "#888";
            const isRecommended = m.recommendedDragons?.includes(dragon.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m)}
                className="mission-select-card"
                style={{
                  "--mission-type-color": typeColor,
                  "--mission-accent-color": accent,
                } as CSSProperties}
              >
                <div className="mission-select-type">
                  {TYPE_LABELS[m.type] ?? m.type.toUpperCase()}
                </div>

                <div className="mission-select-info">
                  <div className="mission-select-name">{m.name}</div>
                  <div className="mission-select-description">
                    {m.description}
                  </div>
                </div>

                {isRecommended && (
                  <div className="mission-select-recommended">RECOMMENDED</div>
                )}

                {m.timeLimitSeconds && (
                  <div className="mission-select-timer">
                    {m.timeLimitSeconds}s
                  </div>
                )}

                <div className="mission-select-region">{m.region}</div>
              </button>
            );
          })}
        </div>

        <div className="mission-select-actions">
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
