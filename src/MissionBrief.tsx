import type { MissionDefinition } from "./game/missions";
import type { DragonType } from "./dragons";

export default function MissionBrief({
  mission,
  dragon,
  onStart,
  onBack,
}: {
  mission: MissionDefinition;
  dragon: DragonType;
  onStart: () => void;
  onBack: () => void;
}) {
  const accent =
    dragon.colors.eye === "#1A1A1A" ? dragon.colors.body : dragon.colors.eye;

  return (
    <div className="brief-screen">
      <div className="brief-card">
        <div className="brief-region">{mission.region.toUpperCase()}</div>
        <h1 className="brief-title">{mission.name}</h1>
        <p className="brief-text">{mission.briefing}</p>

        <div className="brief-objectives">
          <h3 className="brief-objectives-title">OBJECTIVES</h3>
          {mission.objectives.map((obj) => (
            <div key={obj.id} className="brief-objective-row">
              <span className="brief-objective-icon">&#9671;</span>
              <span>
                {obj.label}
                {obj.requiredCount && obj.requiredCount > 1
                  ? ` (${obj.requiredCount})`
                  : ""}
              </span>
            </div>
          ))}
        </div>

        {mission.recommendedDragons && mission.recommendedDragons.length > 0 && (
          <div className="brief-recommended">
            <span className="brief-recommended-label">RECOMMENDED: </span>
            {mission.recommendedDragons
              .map((id) => id.charAt(0).toUpperCase() + id.slice(1))
              .join(", ")}
          </div>
        )}

        <div className="brief-dragon-info">
          <span>Flying as </span>
          <strong style={{ color: accent }}>{dragon.name}</strong>
        </div>

        <div className="brief-actions">
          <button type="button" className="brief-btn brief-btn-back" onClick={onBack}>
            CHANGE DRAGON
          </button>
          <button
            type="button"
            className="brief-btn brief-btn-start"
            onClick={onStart}
            style={{
              background: `linear-gradient(135deg, ${dragon.colors.body}, ${dragon.colors.bodyDark})`,
              boxShadow: `0 4px 20px ${dragon.colors.body}44`,
            }}
          >
            LAUNCH MISSION
          </button>
        </div>
      </div>
    </div>
  );
}
