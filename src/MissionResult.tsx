import type { MissionDefinition, MissionRuntimeState } from "./game/missions";
import { calculateStars } from "./game/missions";
import type { DragonType } from "./dragons";
import { useEffect, useRef } from "react";
import { dragonMastery } from "./game/progression";
import type { GuardianProgress } from "./game/progression";

function Stars({ count }: { count: number }) {
  return (
    <div style={{ fontSize: 36, letterSpacing: 8, margin: "12px 0 8px" }}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            color: i <= count ? "#ffd700" : "rgba(180,160,120,0.15)",
            textShadow: i <= count ? "0 0 12px #ffd70066" : "none",
            transition: "color 0.3s ease",
          }}
        >
          &#9733;
        </span>
      ))}
    </div>
  );
}

export default function MissionResult({
  mission,
  dragon,
  success,
  missionState,
  onRetry,
  onBack,
  onVictory,
  progress,
  nextMission,
  onContinue,
  saveUnavailable,
}: {
  mission: MissionDefinition;
  dragon: DragonType;
  success: boolean;
  missionState: MissionRuntimeState;
  onRetry: () => void;
  onBack: () => void;
  onVictory: (mission: MissionDefinition, state: MissionRuntimeState, dragonId: string) => void;
  progress: GuardianProgress;
  nextMission?: MissionDefinition;
  onContinue: (mission: MissionDefinition) => void;
  saveUnavailable: boolean;
}) {
  const recorded = useRef(false);
  useEffect(() => {
    if (!success || recorded.current) return;
    recorded.current = true;
    onVictory(mission, missionState, dragon.id);
  }, [success, onVictory, mission, missionState, dragon.id]);
  const accent = success ? "#44ff88" : "#ff6655";
  const stars = success ? calculateStars(missionState, mission) : 0;
  const mastery = dragonMastery(progress, dragon.id);

  const statLabel =
    mission.starMetric === "time"
      ? `Time: ${missionState.elapsedTime.toFixed(1)}s`
      : `HP remaining: ${Math.ceil(missionState.playerHp)}/${missionState.maxHp}`;

  return (
    <div className="result-overlay">
      <div className="result-card">
        <div className="result-badge" style={{ color: accent }}>
          {success ? "MISSION COMPLETE" : "MISSION FAILED"}
        </div>
        <h2 className="result-mission-name">{mission.name}</h2>

        {success && <Stars count={stars} />}

        {success && (
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              color: "rgba(180,160,120,0.6)",
              marginBottom: 16,
            }}
          >
            {statLabel}
          </div>
        )}

        {success ? (
          <p className="result-text">
            The skies above{" "}
            {mission.region.charAt(0).toUpperCase() + mission.region.slice(1)}{" "}
            grow safer. Your guardian bond strengthens.
          </p>
        ) : (
          <p className="result-text">
            {mission.timeLimitSeconds && missionState.elapsedTime >= mission.timeLimitSeconds
              ? "Time ran out. Try a tighter route or a faster approach."
              : "Your dragon was overwhelmed. Regroup and try again."}
          </p>
        )}
        <div className="result-dragon">
          <span style={{ color: dragon.colors.body }}>{dragon.name}</span>
        </div>
        {success && <div className="guardian-summary">
          <strong>{mastery.rank} · {mastery.stars}/{mastery.maxStars} dragon mastery stars</strong>
          <span>Mission best: {progress.missions[mission.id]?.stars ?? stars}/3 stars</span>
          <p>{saveUnavailable ? "Browser storage is unavailable. Progress lasts for this session." : "Guardian log saved on this browser."}</p>
          {stars < 3 && <p>Three-star goal: {mission.starMetric === "time" ? `finish in ${mission.starThresholds.three}s or less` : `finish with at least ${mission.starThresholds.three} HP`}.</p>}
        </div>}
        <div className="brief-actions">
          <button
            type="button"
            className="brief-btn brief-btn-back"
            onClick={onBack}
          >
            MISSIONS
          </button>
          <button
            type="button"
            className="brief-btn brief-btn-start"
            onClick={onRetry}
            style={{
              background: success
                ? "linear-gradient(135deg, #44ff88, #22aa55)"
                : "linear-gradient(135deg, #ff6644, #cc3322)",
            }}
          >
            {success ? "REPLAY" : "RETRY"}
          </button>
        </div>
        {success && nextMission && <button type="button" className="brief-btn brief-btn-start campaign-continue" onClick={() => onContinue(nextMission)}>NEXT CHAPTER · {nextMission.name}</button>}
      </div>
    </div>
  );
}
