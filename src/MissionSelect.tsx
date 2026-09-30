import type { CSSProperties } from "react";
import { MISSIONS } from "./game/missions";
import type { MissionDefinition } from "./game/missions";
import type { DragonType } from "./dragons";
import { dragonMastery, nextCampaignMission } from "./game/progression";
import type { GuardianProgress } from "./game/progression";

const TYPE_LABELS: Record<string, string> = {
  fortress_raid: "ASSAULT",
  beacon_run: "RACE",
  hunter_ambush: "SURVIVAL",
  jade_citadel: "SIEGE",
};

const TYPE_COLORS: Record<string, string> = {
  fortress_raid: "#ff6644",
  beacon_run: "#44bbff",
  hunter_ambush: "#ff44aa",
  jade_citadel: "#d2b878",
};

export default function MissionSelect({
  dragon,
  onSelect,
  onBack,
  progress,
  saveUnavailable,
}: {
  dragon: DragonType;
  onSelect: (m: MissionDefinition) => void;
  onBack: () => void;
  progress: GuardianProgress;
  saveUnavailable: boolean;
}) {
  const accent =
    dragon.colors.eye === "#1A1A1A" ? dragon.colors.body : dragon.colors.eye;
  const next = nextCampaignMission(progress);
  const mastery = dragonMastery(progress, dragon.id);
  const stars = MISSIONS.reduce((sum, mission) => sum + (progress.missions[mission.id]?.stars ?? 0), 0);

  return (
    <div className="brief-screen">
      <div className="mission-select-shell">
        <div className="mission-select-header">
          <div className="mission-select-flying">
            Flying as{" "}
            <span style={{ color: accent }}>{dragon.name.toUpperCase()}</span>
          </div>
          <h1 className="mission-select-title">Guardian Log</h1>
          <div className="guardian-summary">
            <strong>{stars} / {MISSIONS.length * 3} campaign stars</strong>
            <span>{mastery.rank} · {mastery.stars}/{mastery.maxStars} stars with {dragon.name}</span>
            <progress aria-label="Campaign stars" value={stars} max={MISSIONS.length * 3} />
            <p>{next ? `Next chapter: ${next.name}. All missions are available to practice.` : "The route is secure. Earn three stars with your favorite dragons."}</p>
            {saveUnavailable && <p role="status">Progress is available this session; browser storage is unavailable.</p>}
          </div>
        </div>

        <div className="mission-select-list">
          {MISSIONS.map((m) => {
            const typeColor = TYPE_COLORS[m.type] ?? "#888";
            const isRecommended = m.recommendedDragons?.includes(dragon.id);
            const record = progress.missions[m.id];
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m)}
                className={`mission-select-card${m.id === next?.id ? " campaign-next" : ""}`}
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
                  <div className="mission-record">
                    <span aria-label={`${record?.stars ?? 0} of 3 stars`}>{"★".repeat(record?.stars ?? 0)}{"☆".repeat(3 - (record?.stars ?? 0))}</span>
                    {record ? ` · ${record.clears} clears · Best ${m.starMetric === "time" ? `${record.bestTime.toFixed(1)}s` : `${Math.ceil(record.bestHp)} HP`}` : " · First flight awaits"}
                    {m.id === next?.id && <b> · NEXT CHAPTER</b>}
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
            BACK TO MODES
          </button>
        </div>
      </div>
    </div>
  );
}
