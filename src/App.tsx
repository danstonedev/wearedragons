import { VRLaunch, VRScene } from "./vr/VRSupport";
import SceneBoundary from "./components/SceneBoundary";
import Atmosphere from "./world/Atmosphere";
import Landscape from "./world/Landscape";
import Vegetation from "./world/Vegetation";
import WorldDetails from "./world/WorldDetails";
import FlightHUD from "./components/FlightHUD";
import HealthBar from "./components/HealthBar";
import DragonSwitcher from "./components/DragonSwitcher";
import MissionTimer from "./world/MissionTimer";
import OpenWorldView from "./openworld/OpenWorldView";
import RenderQuality from "./components/RenderQuality";
import { renderingBudget } from "./game/rendering";
import { useWorldSession } from "./game/useWorldSession";
import type { Dispatch, SetStateAction } from "react";
import PlayerDragon from "./world/PlayerDragon";
import Projectiles, { EnemyProjectiles } from "./world/Projectiles";
import Watchtower from "./world/Watchtower";
import FlyingRaider from "./world/FlyingRaider";
import RaceCheckpoints from "./world/RaceCheckpoints";
import CombatFeedback from "./world/CombatFeedback";
import { joy, pan, playerPos, playerStatus, abilityState, gameSession, missionEmitter } from "./game/runtime";
import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Physics,
  RigidBody,
  RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { DragonType } from "./dragons";
import DragonSelect from "./DragonSelect";
import MissionSelect from "./MissionSelect";
import MissionBrief from "./MissionBrief";
import MissionResult from "./MissionResult";
import {
  MISSIONS,
  createMissionState,
  advanceObjective,
  applyDamage,
  applyHeal,
  updateMissionTime,
  completeWave,
} from "./game/missions";
import type {
  AppScreen,
  MissionDefinition,
  MissionRuntimeState,
} from "./game/missions";
import "./App.css";
import "./OpenWorld.css";
import TouchControls from "./controls/TouchControls";
import DPadControls from "./controls/DPadControls";
import SettingsPanel from "./SettingsPanel";
import { settings } from "./controls/ControlSettings";
import ModeSelect from "./ModeSelect";
import { useGuardianProgress } from "./game/useGuardianProgress";
import { nextCampaignMission } from "./game/progression";
import { device, preset, isTouchDevice } from "./utils/device";
import { useHoard } from "./game/useHoard";
import { useScavengerProgress } from "./game/useScavengerProgress";
import { LAIRS } from "./game/scavenger";
import type { LairDef } from "./game/scavenger";
import ScavengerSelect from "./scavenger/ScavengerSelect";
import ScavengerMode from "./scavenger/ScavengerMode";


function Forest() { return <Vegetation kind="ridge" />; }

// Per-layer colors: dark stone at base, ivory marble at top (RiceWing architecture)
const CASTLE_BLOCK_COLORS = ["#b0a084", "#bcae94", "#c8bca0", "#d8cba8"];

function SmashableCastle() {
  const blockGeometry = useMemo(() => new RoundedBoxGeometry(1.9, 1.9, 1.9, 2, 0.12), []);
  const blockMaterials = useMemo(() => CASTLE_BLOCK_COLORS.map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.04 })), []);
  useEffect(() => () => { blockGeometry.dispose(); blockMaterials.forEach(material => material.dispose()); }, [blockGeometry, blockMaterials]);
  const blockDefs = useMemo(() => {
    const arr: { key: string; lx: number; ly: number; lz: number }[] = [];
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++)
        for (let z = 0; z < 4; z++)
          arr.push({
            key: `${x}-${y}-${z}`,
            lx: x * 2 - 3,
            ly: y * 2 + 1,
            lz: z * 2 - 3,
          });
    return arr;
  }, []);

  const rbRefs = useRef<(RapierRigidBody | null)[]>(
    Array(blockDefs.length).fill(null),
  );
  const settledPositions = useRef<
    ({ x: number; y: number; z: number } | null)[]
  >(Array(blockDefs.length).fill(null));
  const settledRef = useRef(false);
  const smashedRef = useRef(new Set<number>());

  // Detect blocks displaced > 1.5 units from settled position
  useFrame(() => {
    if (gameSession.paused) return;
    if (!settledRef.current) {
      if (gameSession.elapsed < 1.5) return;
      rbRefs.current.forEach((body, index) => { if (body) settledPositions.current[index] = { ...body.translation() }; });
      settledRef.current = true;
      return;
    }
    for (let i = 0; i < blockDefs.length; i++) {
      if (smashedRef.current.has(i)) continue;
      const rb = rbRefs.current[i];
      const sp = settledPositions.current[i];
      if (!rb || !sp) continue;
      const t = rb.translation();
      const dx = t.x - sp.x;
      const dy = t.y - sp.y;
      const dz = t.z - sp.z;
      if (dx * dx + dy * dy + dz * dz > 2.25) {
        smashedRef.current.add(i);
        missionEmitter.dispatchEvent(new CustomEvent("castle_block_smashed", { detail: { id: `block_${i}` } }));
      }
    }
  });

  return (
    <group position={[0, 0.5, -25]}>
      {blockDefs.map((b, i) => (
        <RigidBody
          key={b.key}
          ref={(r: RapierRigidBody | null) => {
            rbRefs.current[i] = r;
          }}
          position={[b.lx, b.ly, b.lz]}
          mass={0.5}
        >
          <mesh castShadow receiveShadow geometry={blockGeometry} material={blockMaterials[Math.floor((b.ly - 1) / 2)]} />
        </RigidBody>
      ))}
    </group>
  );
}

function Terrain() { return <Landscape kind="ridge" />; }

const TOWER_POSITIONS: [number, number, number][] = [
  [-30, 0, -30],
  [25, 0, -40],
  [0, 0, -55],
];

const BEACON_POSITION: [number, number, number] = [0, 0, -42];


function BeaconObj({
  position,
  active,
}: {
  position: [number, number, number];
  active: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const [reached, setReached] = useState(false);

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * 0.5;
      ringRef.current.rotation.z += delta * 0.3;
    }
    if (!gameSession.paused && active && !reached) {
      const dx = playerPos.x - position[0];
      const dy = playerPos.y - (position[1] + 10);
      const dz = playerPos.z - position[2];
      if (dx * dx + dy * dy + dz * dz < 36) {
        setReached(true);
        missionEmitter.dispatchEvent(new CustomEvent("beacon_reached"));
      }
    }
  });

  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.65, 0]}>
        <cylinderGeometry args={[2.5, 3.1, 1.3, 16]} />
        <meshStandardMaterial color="#67675f" roughness={0.95} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 3.7, 0]}>
        <cylinderGeometry args={[0.72, 1.45, 6.2, 16, 4]} />
        <meshStandardMaterial color="#86877e" roughness={0.9} />
      </mesh>
      {Array.from({ length: 3 }, (_, i) => {
        const angle = i / 3 * Math.PI * 2;
        return <mesh key={i} castShadow position={[Math.sin(angle) * 1.55, 7.25, Math.cos(angle) * 1.55]} rotation={[Math.sin(angle) * 0.28, angle, -Math.cos(angle) * 0.28]}>
          <cylinderGeometry args={[0.17, 0.3, 5.2, 10]} />
          <meshStandardMaterial color="#797b73" roughness={0.88} />
        </mesh>;
      })}
      <mesh ref={ringRef} position={[0, 10, 0]}>
        <torusGeometry args={[3, 0.22, 12, 48]} />
        <meshStandardMaterial
          color={active ? "#ffd700" : "#333"}
          emissive={active ? "#ffd700" : "#000"}
          emissiveIntensity={active ? 1.5 : 0}
          metalness={0.5}
        />
      </mesh>

      <mesh position={[0, 10, 0]}>
        <dodecahedronGeometry args={[0.68, 1]} />
        <meshStandardMaterial color={active ? "#fff0a6" : "#292c2b"} emissive={active ? "#ffd700" : "#000"} emissiveIntensity={active ? 2 : 0} roughness={0.35} />
      </mesh>
    </group>
  );
}
// ---- Wave Spawner (Survival Mission) ----

const WAVE_TOWER_POSITIONS: [number, number, number][][] = [
  // Wave 1: 2 towers
  [
    [-25, 0, -25],
    [25, 0, -25],
  ],
  // Wave 2: 3 towers, closer
  [
    [-20, 0, -20],
    [20, 0, -20],
    [0, 0, -35],
  ],
  // Wave 3: 4 towers, aggressive placement
  [
    [-30, 0, -15],
    [30, 0, -15],
    [-15, 0, -40],
    [15, 0, -40],
  ],
];

function WaveTowers({ waveIndex, onWaveCleared }: { waveIndex: number; onWaveCleared: (wave: number) => void }) {
  const positions = useMemo(() => WAVE_TOWER_POSITIONS[waveIndex] ?? [], [waveIndex]);
  const [destroyedIds, setDestroyedIds] = useState<Set<string>>(new Set());
  const clearedAt = useRef<number | null>(null);
  const emitted = useRef(false);
  useEffect(() => {
    const handler = (event: Event) => {
      const id = (event as CustomEvent<{ id: string }>).detail.id;
      if (!positions.some((_, i) => id === `wave_${waveIndex}_tower_${i}`)) return;
      setDestroyedIds(previous => new Set(previous).add(id));
    };
    missionEmitter.addEventListener("tower_destroyed", handler);
    return () => missionEmitter.removeEventListener("tower_destroyed", handler);
  }, [waveIndex, positions]);
  useFrame(() => {
    if (gameSession.paused || emitted.current || destroyedIds.size < positions.length) return;
    clearedAt.current ??= gameSession.elapsed + 0.5;
    if (gameSession.elapsed >= clearedAt.current) { emitted.current = true; onWaveCleared(waveIndex); }
  });
  return <group>{positions.map((position, i) => {
    const id = `wave_${waveIndex}_tower_${i}`;
    return destroyedIds.has(id) ? null : <Watchtower key={id} position={position} id={id} />;
  })}</group>;
}

// ---- HUD ----

function MissionHUD({ missionState }: { missionState: MissionRuntimeState }) {
  const mission = MISSIONS.find((m) => m.id === missionState.missionId);
  if (!mission) return null;
  const obj = mission.objectives[missionState.activeObjectiveIndex];
  const allDone =
    missionState.activeObjectiveIndex >= mission.objectives.length;

  const timeLeft = mission.timeLimitSeconds
    ? Math.max(0, mission.timeLimitSeconds - missionState.elapsedTime)
    : null;
  const timeUrgent = timeLeft !== null && timeLeft < 15;

  return (
    <div className="mission-hud">
      <div className="mission-hud-name">{mission.name}</div>
      {!allDone && obj && (
        <>
          <div className="mission-hud-objective">{obj.label}</div>
          {obj.requiredCount && obj.requiredCount > 1 && (
            <div className="mission-hud-progress">
              {missionState.progress[obj.id] ?? 0} / {obj.requiredCount}
            </div>
          )}
        </>
      )}
      {allDone && (
        <div className="mission-hud-objective" style={{ color: "#44ff88" }}>
          All objectives complete!
        </div>
      )}
      {timeLeft !== null && (
        <div
          className="mission-hud-progress"
          style={{
            color: timeUrgent ? "#ff4444" : "#aaa",
            fontSize: 18,
            fontWeight: 800,
            marginTop: 4,
          }}
        >
          {Math.ceil(timeLeft)}s
        </div>
      )}
      {mission.type === "hunter_ambush" && (
        <div className="mission-hud-progress" style={{ marginTop: 2 }}>
          Wave {Math.min(missionState.waveIndex + 1, 3)} / 3
        </div>
      )}
    </div>
  );
}

function GameWorld({
  dragon,
  mission,
  onSwap,
  onHome,
  missionState,
  onMissionUpdate,
}: {
  dragon: DragonType;
  mission: MissionDefinition;
  onSwap: (d: DragonType) => void;
  onHome: () => void;
  missionState: MissionRuntimeState;
  onMissionUpdate: Dispatch<SetStateAction<MissionRuntimeState>>;
}) {
  const [damageFlash, setDamageFlash] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [controlScheme, setControlScheme] = useState(settings.scheme);
  const beaconActive =
    missionState.completedObjectiveIds.includes("destroy_towers");
  const missionType = mission.type;

  const flashTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { paused, manualPause, togglePause } = useWorldSession(showSettings);
  useEffect(() => {
    const progress = (objective: string, id: string) => {
      if (gameSession.paused) return;
      const elapsed = gameSession.elapsed;
      onMissionUpdate(previous => advanceObjective(updateMissionTime(previous, mission, elapsed), mission, objective, 1, id));
    };
    const onTowerDestroyed = (event: Event) => {
      if (missionType === "fortress_raid") progress("destroy_towers", (event as CustomEvent<{ id: string }>).detail.id);
    };
    const onBeaconReached = () => { if (missionType === "fortress_raid") progress("activate_beacon", "beacon"); };
    const onCheckpoint = (event: Event) => {
      if (missionType !== "beacon_run" || gameSession.paused) return;
      const index = (event as CustomEvent<{ index: number }>).detail.index;
      const elapsed = gameSession.elapsed;
      onMissionUpdate(previous => index === (previous.progress.checkpoints ?? 0)
        ? advanceObjective(updateMissionTime(previous, mission, elapsed), mission, "checkpoints", 1, `checkpoint_${index}`)
        : previous);
    };
    const onPlayerHit = (event: Event) => {
      if (gameSession.paused || playerStatus.cloaked || playerStatus.invulnerable) return;
      const amount = (event as CustomEvent<{ damage: number }>).detail.damage / Math.max(0.25, dragon.stats.armor);
      const elapsed = gameSession.elapsed;
      onMissionUpdate(previous => applyDamage(updateMissionTime(previous, mission, elapsed), amount));
      setDamageFlash(true);
      clearTimeout(flashTimeout.current);
      flashTimeout.current = setTimeout(() => setDamageFlash(false), 200);
    };
    const onHeal = (event: Event) => {
      const amount = (event as CustomEvent<{ amount: number }>).detail.amount;
      onMissionUpdate(previous => applyHeal(previous, amount));
    };
    const onBlockSmashed = (event: Event) => {
      if (missionType === "jade_citadel") progress("smash_blocks", (event as CustomEvent<{ id: string }>).detail.id);
    };
    missionEmitter.addEventListener("tower_destroyed", onTowerDestroyed);
    missionEmitter.addEventListener("beacon_reached", onBeaconReached);
    missionEmitter.addEventListener("checkpoint_reached", onCheckpoint);
    missionEmitter.addEventListener("player_hit", onPlayerHit);
    missionEmitter.addEventListener("player_heal", onHeal);
    missionEmitter.addEventListener("castle_block_smashed", onBlockSmashed);
    return () => {
      clearTimeout(flashTimeout.current);
      missionEmitter.removeEventListener("tower_destroyed", onTowerDestroyed);
      missionEmitter.removeEventListener("beacon_reached", onBeaconReached);
      missionEmitter.removeEventListener("checkpoint_reached", onCheckpoint);
      missionEmitter.removeEventListener("player_hit", onPlayerHit);
      missionEmitter.removeEventListener("player_heal", onHeal);
      missionEmitter.removeEventListener("castle_block_smashed", onBlockSmashed);
    };
  }, [missionType, mission, onMissionUpdate, dragon.stats.armor]);
  const handleWaveCleared = useCallback((wave: number) => {
    onMissionUpdate(previous => completeWave(previous, mission, wave));
  }, [mission, onMissionUpdate]);
  const handleTimerTick = useCallback((elapsed: number) => {
    onMissionUpdate(previous => updateMissionTime(previous, mission, elapsed));
  }, [mission, onMissionUpdate]);

  return (
    <div
      tabIndex={0}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        outline: "none",
        touchAction: "none",
      }}
    >
      <SceneBoundary>
      <Canvas
        shadows={renderingBudget(device).shadows ? { type: THREE.PCFShadowMap } : false}
        camera={{ position: [0, 5, 10], fov: 60 }}
        dpr={[renderingBudget(device).minDpr, renderingBudget(device).maxDpr]}
      >
        <RenderQuality />
        <Atmosphere region={mission.region} />
        <MissionTimer onTick={handleTimerTick} />
        <Physics debug={false} paused={paused}>
          <Terrain />
          <WorldDetails kind="ridge" />
          <Forest />

          {/* Fortress Raid: static towers + beacon */}
          {missionType === "fortress_raid" && (
            <>
              {TOWER_POSITIONS.map((pos, i) => (
                <Watchtower key={i} position={pos} id={`tower_${i}`} />
              ))}
              <FlyingRaider />
              <BeaconObj position={BEACON_POSITION} active={beaconActive} />
            </>
          )}

          {/* Beacon Run: checkpoint rings */}
          {missionType === "beacon_run" && (
            <RaceCheckpoints
              passedCount={missionState.progress["checkpoints"] ?? 0}
            />
          )}

          {/* Hunter Ambush: wave-spawned towers */}
          {missionType === "hunter_ambush" && missionState.waveIndex < 3 && (
            <WaveTowers
              key={missionState.waveIndex}
              waveIndex={missionState.waveIndex}
              onWaveCleared={handleWaveCleared}
            />
          )}

          {/* Jade Citadel Strike: smashable castle */}
          {missionType === "jade_citadel" && <SmashableCastle />}

          <PlayerDragon dragon={dragon} />
          <Projectiles />
          <CombatFeedback />
          {missionType !== "beacon_run" && missionType !== "jade_citadel" && (
            <EnemyProjectiles />
          )}
        </Physics>
        <VRScene mission={mission} missionState={missionState} />
      </Canvas>
      </SceneBoundary>


      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          if (e.target instanceof Element)
            e.target.setPointerCapture(e.pointerId);
          pan.active = e.pointerId;
          pan.lastX = e.clientX;
          pan.lastY = e.clientY;
        }}
        onPointerMove={(e) => {
          if (pan.active === e.pointerId) {
            pan.yaw += (e.clientX - pan.lastX) * -0.005;
            pan.pitch += (e.clientY - pan.lastY) * -0.005;
            pan.pitch = Math.max(
              -Math.PI / 3,
              Math.min(Math.PI / 3, pan.pitch),
            );
            pan.lastX = e.clientX;
            pan.lastY = e.clientY;
          }
        }}
        onPointerUp={(e) => {
          if (e.target instanceof Element && e.target.hasPointerCapture(e.pointerId))
            e.target.releasePointerCapture(e.pointerId);
          if (pan.active === e.pointerId) pan.active = 0;
        }}
        onPointerCancel={(e) => {
          if (e.target instanceof Element && e.target.hasPointerCapture(e.pointerId))
            e.target.releasePointerCapture(e.pointerId);
          if (pan.active === e.pointerId) pan.active = 0;
        }}
      />

      <VRLaunch />
      <FlightHUD dragon={dragon} paused={paused} onPause={togglePause} />
      {manualPause && <div className="flight-pause-overlay"><h2>Flight paused</h2><button type="button" onClick={togglePause}>Resume flight</button></div>}
      <MissionHUD missionState={missionState} />
      <HealthBar hp={missionState.playerHp} maxHp={missionState.maxHp} />
      <div className={`damage-vignette ${damageFlash ? "active" : ""}`} />

      {!paused && isTouchDevice &&
        (controlScheme === "buttons" ? (
          <DPadControls joy={joy} abilityState={abilityState} />
        ) : (
          <TouchControls
            dragon={dragon}
            joy={joy}
            abilityState={abilityState}
            maxDist={preset.joystickMaxDist}
          />
        ))}

      <DragonSwitcher current={dragon} onSwap={onSwap} />

      <button type="button" className="hud-home-btn" onClick={onHome}>
        <span className="hud-home-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path d="M10 2.5L2 9h2v8.5h5v-5h2v5h5V9h2L10 2.5z" />
          </svg>
        </span>
        <span className="hud-home-label">MISSIONS</span>
      </button>

      <button
        type="button"
        className="hud-settings-btn"
        title="Settings"
        aria-label="Settings"
        onClick={() => setShowSettings(true)}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
          <path d="M11.5 2.1l.9 2a6.1 6.1 0 011.4.8l2-.6a8 8 0 011.4 2.4l-1.2 1.7c.1.5.1 1 0 1.6l1.2 1.7a8 8 0 01-1.4 2.4l-2-.6c-.4.3-.9.6-1.4.8l-.9 2a8 8 0 01-3 0l-.9-2a6.1 6.1 0 01-1.4-.8l-2 .6a8 8 0 01-1.4-2.4l1.2-1.7a6 6 0 010-1.6L2.8 7.5a8 8 0 011.4-2.4l2 .6c.4-.3.9-.6 1.4-.8l.9-2a8 8 0 013 0zM10 7.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" />
        </svg>
      </button>

      {showSettings && (
        <SettingsPanel
          onClose={() => {
            setShowSettings(false);
            setControlScheme(settings.scheme);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  const { progress: guardianProgress, saveVictory, saveUnavailable } = useGuardianProgress();
  const { hoard, bank: bankHoard, steal: stealFromHoard, saveUnavailable: hoardSaveUnavailable } = useHoard();
  const { progress: raidProgress, record: recordRaid, saveUnavailable: raidSaveUnavailable } = useScavengerProgress();
  const [currentLair, setCurrentLair] = useState<LairDef>(LAIRS[0]);
  const [screen, setScreen] = useState<AppScreen>("dragon_select");
  const [selectedDragon, setSelectedDragon] = useState<DragonType | null>(null);
  const [currentMission, setCurrentMission] = useState<MissionDefinition>(
    MISSIONS[0],
  );
  const [missionState, setMissionState] = useState<MissionRuntimeState>(
    createMissionState(MISSIONS[0]),
  );

  if (screen === "dragon_select" || !selectedDragon) {
    return (
      <DragonSelect
        onSelect={(d) => {
          setSelectedDragon(d);
          setScreen("mode_select");
        }}
      />
    );
  }

  if (screen === "mode_select") {
    return (
      <ModeSelect
        dragon={selectedDragon}
        onMissions={() => setScreen("mission_select")}
        onOpenWorld={() => setScreen("open_world")}
        onScavengers={() => setScreen("scavenger_select")}
        onBack={() => setScreen("dragon_select")}
      />
    );
  }

  if (screen === "scavenger_select") {
    return (
      <ScavengerSelect
        progress={raidProgress}
        saveUnavailable={raidSaveUnavailable}
        onRaid={(lair) => {
          setCurrentLair(lair);
          setScreen("scavenger_raid");
        }}
        onBack={() => setScreen("mode_select")}
      />
    );
  }

  if (screen === "scavenger_raid") {
    return (
      <ScavengerMode
        key={currentLair.id}
        lair={currentLair}
        progress={raidProgress}
        onRecord={recordRaid}
        saveUnavailable={raidSaveUnavailable}
        onLeave={() => setScreen("scavenger_select")}
      />
    );
  }

  if (screen === "open_world") {
    return (
      <OpenWorldView
        dragon={selectedDragon}
        onSwap={setSelectedDragon}
        onBack={() => setScreen("mode_select")}
        hoard={hoard}
        onBank={bankHoard}
        onSteal={stealFromHoard}
        hoardSaveUnavailable={hoardSaveUnavailable}
      />
    );
  }

  if (screen === "mission_select") {
    return (
      <MissionSelect
        dragon={selectedDragon}
        progress={guardianProgress}
        saveUnavailable={saveUnavailable}
        onSelect={(m) => {
          setCurrentMission(m);
          setScreen("mission_brief");
        }}
        onBack={() => {
          setScreen("mode_select");
        }}
      />
    );
  }

  if (screen === "mission_brief") {
    return (
      <MissionBrief
        mission={currentMission}
        dragon={selectedDragon}
        onStart={() => {
          setMissionState(createMissionState(currentMission));
          setScreen("in_mission");
        }}
        onBack={() => {
          setScreen("mission_select");
        }}
      />
    );
  }

  if (screen === "in_mission" && (missionState.succeeded || missionState.failed)) {
    return (
      <MissionResult
        mission={currentMission}
        dragon={selectedDragon}
        success={missionState.succeeded}
        missionState={missionState}
        progress={guardianProgress}
        onVictory={saveVictory}
        saveUnavailable={saveUnavailable}
        nextMission={nextCampaignMission(guardianProgress)}
        onContinue={(mission) => {
          setCurrentMission(mission);
          setScreen("mission_brief");
        }}
        onRetry={() => {
          setMissionState(createMissionState(currentMission));
          setScreen("in_mission");
        }}
        onBack={() => {
          setScreen("mission_select");
        }}
      />
    );
  }

  return (
    <GameWorld
      dragon={selectedDragon}
      mission={currentMission}
      onSwap={setSelectedDragon}
      onHome={() => setScreen("mission_select")}
      missionState={missionState}
      onMissionUpdate={setMissionState}
    />
  );
}
