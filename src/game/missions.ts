// ---- Types ----

export type AppScreen =
  | "dragon_select"
  | "mode_select"
  | "mission_select"
  | "mission_brief"
  | "in_mission"
  | "mission_success"
  | "mission_fail"
  | "open_world";

export type MissionObjectiveType =
  | "destroy_targets"
  | "reach_beacon"
  | "survive"
  | "race_checkpoint"
  | "smash_blocks";

export interface MissionObjectiveDefinition {
  id: string;
  type: MissionObjectiveType;
  label: string;
  requiredCount?: number;
}

export interface MissionDefinition {
  id: string;
  name: string;
  description: string;
  briefing: string;
  region: "pyrrhia" | "pantala" | "glaeryus";
  type: "fortress_raid" | "beacon_run" | "hunter_ambush" | "jade_citadel";
  timeLimitSeconds?: number;
  objectives: MissionObjectiveDefinition[];
  recommendedDragons?: string[];
  starThresholds: {
    three: number; // e.g. complete in <60s, or HP > 80
    two: number;
    one: number;
  };
  starMetric: "time" | "hp";
}

export interface MissionRuntimeState {
  missionId: string;
  activeObjectiveIndex: number;
  progress: Record<string, number>;
  completedObjectiveIds: string[];
  failed: boolean;
  succeeded: boolean;
  playerHp: number;
  maxHp: number;
  elapsedTime: number;
  waveIndex: number;
}

// ---- Missions ----

export const MISSIONS: MissionDefinition[] = [
  {
    id: "beacon_ridge",
    name: "Beacon Ridge",
    description: "Destroy the raider watchtowers and reactivate the sky-beacon.",
    briefing:
      "Raiders have seized the ridge beacon and built watchtowers to guard it. Destroy all three towers, then fly through the beacon to restore the signal. Watch for return fire.",
    region: "pyrrhia",
    type: "fortress_raid",
    objectives: [
      {
        id: "destroy_towers",
        type: "destroy_targets",
        label: "Destroy watchtowers",
        requiredCount: 3,
      },
      {
        id: "activate_beacon",
        type: "reach_beacon",
        label: "Activate the beacon",
        requiredCount: 1,
      },
    ],
    recommendedDragons: ["mudwing", "bonewing", "skywing"],
    starThresholds: { three: 70, two: 40, one: 0 },
    starMetric: "hp",
  },
  {
    id: "sky_circuit",
    name: "Sky Circuit",
    description: "Race through aerial checkpoints before the storm closes in.",
    briefing:
      "A storm front is approaching fast. Fly through all 8 checkpoint rings scattered across the valley before the skies go dark. Speed and pathing are everything.",
    region: "pyrrhia",
    type: "beacon_run",
    timeLimitSeconds: 90,
    objectives: [
      {
        id: "checkpoints",
        type: "race_checkpoint",
        label: "Fly through checkpoints",
        requiredCount: 8,
      },
    ],
    recommendedDragons: ["skywing", "sandwing", "ricewing", "acewing"],
    starThresholds: { three: 45, two: 65, one: 90 },
    starMetric: "time",
  },
  {
    id: "ridge_defense",
    name: "Ridge Defense",
    description: "Survive waves of raider attacks while protecting the beacon.",
    briefing:
      "The restored beacon is drawing raider attention. Survive three waves of increasingly aggressive tower attacks. Stay airborne, dodge fire, and destroy threats as they appear.",
    region: "pyrrhia",
    type: "hunter_ambush",
    objectives: [
      {
        id: "survive_waves",
        type: "survive",
        label: "Survive wave",
        requiredCount: 3,
      },
    ],
    recommendedDragons: ["nightwing", "icewing", "bladewing", "hivewing"],
    starThresholds: { three: 80, two: 50, one: 0 },
    starMetric: "hp",
  },
  {
    id: "jade_citadel",
    name: "Jade Citadel Strike",
    description:
      "An ancient RiceWing citadel guards the Glaeryus valley mouth. Tear it down before reinforcements arrive.",
    briefing:
      "The Jade Citadel has stood for a thousand years, blocking safe passage through the Glaeryus valley. Its ivory walls are thick — but nothing survives a dragon in full fury. Smash at least 40 of the 64 stone blocks before the garrison can rebuild. Hit fast, hit hard.",
    region: "glaeryus",
    type: "jade_citadel",
    timeLimitSeconds: 120,
    objectives: [
      {
        id: "smash_blocks",
        type: "smash_blocks",
        label: "Smash the citadel walls",
        requiredCount: 40,
      },
    ],
    recommendedDragons: ["mudwing", "bonewing", "bladewing", "skywing"],
    starThresholds: { three: 50, two: 85, one: 120 },
    starMetric: "time",
  },
];

// ---- Runtime helpers ----

export function createMissionState(
  mission: MissionDefinition,
): MissionRuntimeState {
  const progress: Record<string, number> = {};
  for (const obj of mission.objectives) {
    progress[obj.id] = 0;
  }
  return {
    missionId: mission.id,
    activeObjectiveIndex: 0,
    progress,
    completedObjectiveIds: [],
    failed: false,
    succeeded: false,
    playerHp: 100,
    maxHp: 100,
    elapsedTime: 0,
    waveIndex: 0,
  };
}

export function advanceObjective(
  state: MissionRuntimeState,
  mission: MissionDefinition,
  objectiveId: string,
  amount = 1,
): MissionRuntimeState {
  const next = { ...state, progress: { ...state.progress } };
  next.progress[objectiveId] = (next.progress[objectiveId] ?? 0) + amount;

  const objDef = mission.objectives.find((o) => o.id === objectiveId);
  if (objDef && next.progress[objectiveId] >= (objDef.requiredCount ?? 1)) {
    if (!next.completedObjectiveIds.includes(objectiveId)) {
      next.completedObjectiveIds = [...next.completedObjectiveIds, objectiveId];
    }
    const nextIdx = mission.objectives.findIndex(
      (o) => !next.completedObjectiveIds.includes(o.id),
    );
    next.activeObjectiveIndex =
      nextIdx === -1 ? mission.objectives.length : nextIdx;
  }

  if (next.completedObjectiveIds.length === mission.objectives.length) {
    next.succeeded = true;
  }

  return next;
}

export function applyDamage(
  state: MissionRuntimeState,
  amount: number,
): MissionRuntimeState {
  const next = { ...state };
  next.playerHp = Math.max(0, next.playerHp - amount);
  if (next.playerHp <= 0) {
    next.failed = true;
  }
  return next;
}

export function applyHeal(
  state: MissionRuntimeState,
  amount: number,
): MissionRuntimeState {
  const next = { ...state };
  next.playerHp = Math.min(next.maxHp, next.playerHp + amount);
  return next;
}

export function calculateStars(
  state: MissionRuntimeState,
  mission: MissionDefinition,
): number {
  const val =
    mission.starMetric === "time" ? state.elapsedTime : state.playerHp;
  const { three, two } = mission.starThresholds;

  if (mission.starMetric === "time") {
    // Lower time = better
    if (val <= three) return 3;
    if (val <= two) return 2;
    return 1;
  }
  // Higher HP = better
  if (val >= three) return 3;
  if (val >= two) return 2;
  return 1;
}
