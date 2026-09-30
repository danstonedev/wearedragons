import { MISSIONS, calculateStars } from "./missions.ts";
import type { MissionDefinition, MissionRuntimeState } from "./missions";

export const PROGRESS_KEY = "wearedragons.guardian.v1";
export interface MissionRecord {
  stars: number;
  bestTime: number;
  bestHp: number;
  clears: number;
  dragonStars: Record<string, number>;
}
export interface GuardianProgress {
  version: 1;
  missions: Record<string, MissionRecord>;
}
export const emptyProgress = (): GuardianProgress => ({ version: 1, missions: {} });

/** Read only the known schema; damaged or future saves cannot break mission selection. */
export function parseProgress(raw: string | null): GuardianProgress {
  const result = emptyProgress();
  try {
    const input = JSON.parse(raw ?? "null");
    if (input?.version !== 1 || !input.missions || typeof input.missions !== "object") return result;
    for (const mission of MISSIONS) {
      const record = input.missions[mission.id];
      if (!record || !Number.isInteger(record.stars) || record.stars < 1 || record.stars > 3 ||
          !Number.isFinite(record.bestTime) || record.bestTime < 0 ||
          !Number.isFinite(record.bestHp) || record.bestHp < 0 || record.bestHp > 100 ||
          !Number.isSafeInteger(record.clears) || record.clears < 1) continue;
      const dragonStars: Record<string, number> = {};
      if (record.dragonStars && typeof record.dragonStars === "object") {
        for (const [id, stars] of Object.entries(record.dragonStars)) {
          if (/^[a-z0-9_]+$/.test(id) && id !== "__proto__" && Number.isInteger(stars) && Number(stars) >= 1 && Number(stars) <= 3) dragonStars[id] = Number(stars);
        }
      }
      result.missions[mission.id] = { stars: record.stars, bestTime: record.bestTime, bestHp: record.bestHp, clears: record.clears, dragonStars };
    }
  } catch { /* Start fresh if JSON is damaged. */ }
  return result;
}

export function recordVictory(progress: GuardianProgress, mission: MissionDefinition, state: MissionRuntimeState, dragonId: string): GuardianProgress {
  if (!state.succeeded || state.failed || state.missionId !== mission.id || !Number.isFinite(state.elapsedTime) || state.elapsedTime < 0 || !Number.isFinite(state.playerHp)) return progress;
  const previous = progress.missions[mission.id];
  const stars = calculateStars(state, mission);
  return { version: 1, missions: { ...progress.missions, [mission.id]: {
    stars: Math.max(previous?.stars ?? 0, stars),
    bestTime: Math.min(previous?.bestTime ?? Infinity, state.elapsedTime),
    bestHp: Math.max(previous?.bestHp ?? 0, Math.max(0, Math.min(100, state.playerHp))),
    clears: Math.min(Number.MAX_SAFE_INTEGER, (previous?.clears ?? 0) + 1),
    dragonStars: { ...previous?.dragonStars, [dragonId]: Math.max(previous?.dragonStars[dragonId] ?? 0, stars) },
  } } };
}

export function nextCampaignMission(progress: GuardianProgress): MissionDefinition | undefined {
  return MISSIONS.find(mission => !progress.missions[mission.id]);
}

export function dragonMastery(progress: GuardianProgress, dragonId: string) {
  const stars = MISSIONS.reduce((sum, mission) => sum + (progress.missions[mission.id]?.dragonStars[dragonId] ?? 0), 0);
  return { stars, maxStars: MISSIONS.length * 3, rank: stars >= 12 ? "Sky Guardian" : stars >= 6 ? "Pathfinder" : stars >= 1 ? "Wing Scout" : "New bond" };
}
