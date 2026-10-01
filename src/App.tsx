import { VRLaunch, VRScene } from "./vr/VRSupport";
import SceneBoundary from "./components/SceneBoundary";
import Atmosphere from "./world/Atmosphere";
import Landscape from "./world/Landscape";
import Vegetation from "./world/Vegetation";
import WorldDetails from "./world/WorldDetails";
import FlightHUD from "./components/FlightHUD";
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
import {
  DRAGON_TYPES,
  TRIBES,
} from "./dragons";
import { MAX_STAT } from "./constants";
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
import { WORLD_REGIONS, getRegionAtPos } from "./game/worlds";
import type { WorldRegion } from "./game/worlds";
import { device, preset, isTouchDevice } from "./utils/device";
import LootSystem from "./world/LootSystem";
import { lootMap } from "./game/lootRuntime";
import { TalonPanel, LootToasts, HoardChip, HoardLedger } from "./components/LootHUD";
import { useHoard } from "./game/useHoard";
import { useScavengerProgress } from "./game/useScavengerProgress";
import { LAIRS } from "./game/scavenger";
import type { LairDef } from "./game/scavenger";
import ScavengerSelect from "./scavenger/ScavengerSelect";
import ScavengerMode from "./scavenger/ScavengerMode";
import { HOARD_SITE } from "./game/loot";
import type { HoardProgress, TreasureDef } from "./game/loot";
import { RARITY_COLORS } from "./world/treasureModels";


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

// ---- Mission Timer ----

function MissionTimer({ onTick }: { onTick?: (elapsed: number) => void }) {
  const pending = useRef(0);
  useFrame((_, delta) => {
    if (gameSession.paused || !gameSession.ready) return;
    const dt = Math.min(delta, 1 / 15);
    gameSession.elapsed += dt;
    pending.current += dt;
    if (pending.current >= 0.2) {
      pending.current = 0;
      onTick?.(gameSession.elapsed);
    }
  }, -3);
  return null;
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

function HealthBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const color = pct > 50 ? "#44ff88" : pct > 25 ? "#ffc107" : "#ff4444";
  return (
    <div className="health-bar-container">
      <div className="health-bar-track">
        <div
          className="health-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="health-bar-label" style={{ color }}>
        HP {Math.ceil(hp)}/{maxHp}
      </div>
    </div>
  );
}

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

function DragonSwitcher({
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

// ============================================================
// Open World — helper functions, components, and main view
// ============================================================

/** Large physics + visual terrain split into three region color zones */
function OpenWorldTerrain() { return <Landscape kind="open" />; }

/** Wider Pyrrhia forest spread across the northern zone */
function OpenWorldForest() { return <Vegetation kind="open" />; }

/** Discoverable world beacon — glows and fires onDiscovered when player flies through */
function WorldBeacon({
  region,
  discovered,
  onDiscovered,
}: {
  region: WorldRegion;
  discovered: boolean;
  onDiscovered: () => void;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const triggeredRef = useRef(false);
  const pos = region.beaconPosition;

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * 0.5;
      ringRef.current.rotation.z += delta * 0.28;
    }
    // Proximity detection — fires once
    if (!gameSession.paused && !triggeredRef.current) {
      const dx = playerPos.x - pos[0];
      const dy = playerPos.y - (pos[1] + 10);
      const dz = playerPos.z - pos[2];
      if (dx * dx + dy * dy + dz * dz < 81) {
        triggeredRef.current = true;
        onDiscovered();
      }
    }
  });

  return (
    <group position={pos}>
      <mesh castShadow receiveShadow position={[0, 0.65, 0]}>
        <cylinderGeometry args={[2.4, 3, 1.3, 16]} />
        <meshStandardMaterial color="#686b67" roughness={0.95} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 3.8, 0]}>
        <cylinderGeometry args={[0.68, 1.35, 6.3, 16, 4]} />
        <meshStandardMaterial color="#858982" roughness={0.9} />
      </mesh>
      <mesh ref={ringRef} position={[0, 10, 0]}>
        <torusGeometry args={[3, 0.22, 12, 48]} />
        <meshStandardMaterial
          color={discovered ? region.beaconColor : "#333"}
          emissive={discovered ? region.beaconColor : "#000"}
          emissiveIntensity={discovered ? 1.8 : 0}
          metalness={0.5}
        />
      </mesh>
      {/* Wide guide halo */}
      <mesh position={[0, 10, 0]}>
        <torusGeometry args={[5.5, 0.1, 6, 36]} />
        <meshStandardMaterial
          color={region.color}
          emissive={region.color}
          emissiveIntensity={discovered ? 0.5 : 0.12}
          transparent
          opacity={0.55}
        />
      </mesh>

    </group>
  );
}

/** Runs inside Canvas; fires onRegionChange whenever the player crosses a region boundary */
function RegionTracker({
  onRegionChange,
}: {
  onRegionChange: (r: WorldRegion) => void;
}) {
  const lastIdRef = useRef<string>("");
  useFrame(() => {
    const r = getRegionAtPos(playerPos.x, playerPos.z);
    if (r.id !== lastIdRef.current) {
      lastIdRef.current = r.id;
      onRegionChange(r);
    }
  });
  return null;
}

/** Top-center HUD showing current region and beacon discovery count */
function OpenWorldHUD({
  region,
  discoveredBeacons,
  hoard,
}: {
  region: WorldRegion;
  discoveredBeacons: Set<string>;
  hoard: HoardProgress;
}) {
  const discoveredCount = discoveredBeacons.size;
  const allFound = discoveredCount === WORLD_REGIONS.length;
  return (
    <div className="ow-hud">
      <div className="ow-region-label">CURRENT REGION</div>
      <div className="ow-region-name" style={{ color: region.textColor }}>
        {region.name.toUpperCase()}
      </div>
      <div className={`ow-beacons${allFound ? " complete" : ""}`}>
        <span className="ow-beacon-pips">
          {WORLD_REGIONS.map((r) => (
            <span
              key={r.id}
              style={{
                color: discoveredBeacons.has(r.id) ? "#ffd700" : "rgba(255,255,255,0.2)",
              }}
            >
              {discoveredBeacons.has(r.id) ? "✦" : "○"}
            </span>
          ))}
        </span>
        {discoveredCount}/{WORLD_REGIONS.length} BEACONS
      </div>
      <HoardChip hoard={hoard} />
    </div>
  );
}

/** World map overlay rendered when player presses M or taps the MAP button */
function WorldMapOverlay({
  discoveredBeacons,
  playerX,
  playerZ,
  onClose,
}: {
  discoveredBeacons: Set<string>;
  playerX: number;
  playerZ: number;
  onClose: () => void;
}) {
  // World bounds: x/z each span -200 to 200 (400 units)
  const toMapPct = (wx: number, wz: number) => ({
    left: `${((wx + 200) / 400) * 100}%`,
    top:  `${((wz + 200) / 400) * 100}%`,
  });

  const playerDot = toMapPct(playerX, playerZ);

  return (
    <div className="ow-map-overlay" onClick={onClose}>
      <div className="ow-map-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ow-map-header">
          <span className="ow-map-title-text">WORLD MAP</span>
          <button type="button" className="ow-map-close" onClick={onClose}>
            CLOSE [M]
          </button>
        </div>

        <div className="ow-map-grid">
          {/* Pyrrhia — north strip (z: -200 to 30 = 230/400 = 57.5% height from top) */}
          <div
            className="ow-map-region-block"
            style={{
              left: 0, top: 0, width: "100%", height: "57.5%",
              background: "rgba(63, 138, 75, 0.28)",
              borderBottom: "1px dashed rgba(76,175,80,0.25)",
            }}
          />
          {/* Pantala — southeast (x: 0–200, z: 30–200) */}
          <div
            className="ow-map-region-block"
            style={{
              left: "50%", top: "57.5%", width: "50%", height: "42.5%",
              background: "rgba(184, 140, 58, 0.28)",
              borderLeft: "1px dashed rgba(255,167,38,0.22)",
            }}
          />
          {/* Glaeryus — southwest (x: -200–0, z: 30–200) */}
          <div
            className="ow-map-region-block"
            style={{
              left: 0, top: "57.5%", width: "50%", height: "42.5%",
              background: "rgba(62, 75, 82, 0.44)",
            }}
          />

          {/* Region name labels */}
          <span className="ow-map-region-label" style={{ left: "6%", top: "24%", color: "rgba(178,255,183,0.6)" }}>PYRRHIA</span>
          <span className="ow-map-region-label" style={{ left: "55%", top: "65%", color: "rgba(255,224,160,0.6)" }}>PANTALA</span>
          <span className="ow-map-region-label" style={{ left: "3%",  top: "72%", color: "rgba(176,208,224,0.6)" }}>GLAERYUS</span>

          {/* Compass */}
          <span className="ow-map-compass" style={{ top: 5, left: "50%", transform: "translateX(-50%)" }}>N</span>
          <span className="ow-map-compass" style={{ bottom: 5, left: "50%", transform: "translateX(-50%)" }}>S</span>
          <span className="ow-map-compass" style={{ top: "50%", left: 5, transform: "translateY(-50%)" }}>W</span>
          <span className="ow-map-compass" style={{ top: "50%", right: 5, transform: "translateY(-50%)" }}>E</span>

          {/* Beacon markers */}
          {WORLD_REGIONS.map((r) => {
            const p = toMapPct(r.beaconPosition[0], r.beaconPosition[2]);
            const found = discoveredBeacons.has(r.id);
            return (
              <div
                key={r.id}
                className="ow-map-beacon-dot"
                style={{
                  left: p.left,
                  top: p.top,
                  color: found ? r.beaconColor : "rgba(255,255,255,0.18)",
                  fontSize: found ? 15 : 11,
                }}
              >
                {found ? "✦" : "○"}
              </div>
            );
          })}

          {/* Lit beacons reveal the treasure still glinting in their region */}
          {lootMap.items.filter(item => discoveredBeacons.has(item.region)).map((item, i) => {
            const p = toMapPct(item.x, item.z);
            return <div key={i} className="ow-map-treasure-dot" style={{ left: p.left, top: p.top, color: RARITY_COLORS[item.rarity], background: RARITY_COLORS[item.rarity], width: item.unique ? 7 : 4, height: item.unique ? 7 : 4 }} />;
          })}
          <div className="ow-map-hoard-dot" style={toMapPct(HOARD_SITE.x, HOARD_SITE.z)}>◆</div>

          {/* Player position dot */}
          <div
            className="ow-map-player-dot"
            style={{ left: playerDot.left, top: playerDot.top }}
          />
        </div>

        <div className="ow-map-legend">
          <div className="ow-map-legend-item">
            <span style={{ color: "#ffd700" }}>✦</span> Beacon discovered
          </div>
          <div className="ow-map-legend-item">
            <span style={{ color: "rgba(255,255,255,0.25)" }}>○</span> Undiscovered
          </div>
          <div className="ow-map-legend-item">
            <span style={{ color: "#fff", fontSize: 8 }}>●</span> Your position
          </div>
          <div className="ow-map-legend-item">
            <span style={{ color: "#ffd27a" }}>◆</span> Your hoard · lit beacons reveal treasure
          </div>
          <div className="ow-map-legend-item right">
            {discoveredBeacons.size} / {WORLD_REGIONS.length} beacons
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full open-world free-flight experience across all three regions */
function OpenWorldView({
  dragon,
  onSwap,
  onBack,
  hoard,
  onBank,
  hoardSaveUnavailable,
}: {
  dragon: DragonType;
  onSwap: (d: DragonType) => void;
  onBack: () => void;
  hoard: HoardProgress;
  onBank: (def: TreasureDef, dragonId: string, value: number) => void;
  hoardSaveUnavailable: boolean;
}) {
  const [currentRegion, setCurrentRegion] = useState<WorldRegion>(
    WORLD_REGIONS[0],
  );
  const [discoveredBeacons, setDiscoveredBeacons] = useState<Set<string>>(
    new Set(),
  );
  const [entryBanner, setEntryBanner] = useState<WorldRegion | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [mapPlayerPos, setMapPlayerPos] = useState({ x: 0, z: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [controlScheme, setControlScheme] = useState(settings.scheme);
  const [bannerKey, setBannerKey] = useState(0);
  const [showLedger, setShowLedger] = useState(false);
  const { paused, manualPause, togglePause } = useWorldSession(showSettings || showMap || showLedger);

  // Deliveries are decided in the frame loop and persisted here.
  useEffect(() => {
    const banked = (event: Event) => {
      const { def, value, dragonId } = (event as CustomEvent<{ def: TreasureDef; value: number; dragonId: string }>).detail;
      onBank(def, dragonId, value);
    };
    missionEmitter.addEventListener("loot_banked", banked);
    return () => missionEmitter.removeEventListener("loot_banked", banked);
  }, [onBank]);

  // H toggles the hoard ledger
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "h" && !event.repeat) setShowLedger(previous => !previous);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleRegionChange = useCallback((r: WorldRegion) => {
    setCurrentRegion(r);
    setBannerKey(previous => previous + 1);
    setEntryBanner(r);
  }, []);

  const handleBeaconDiscovered = useCallback((regionId: string) => {
    setDiscoveredBeacons((prev) => {
      if (prev.has(regionId)) return prev;
      const next = new Set(prev);
      next.add(regionId);
      return next;
    });
  }, []);

  const handleOpenMap = useCallback(() => {
    setMapPlayerPos({ x: playerPos.x, z: playerPos.z });
    setShowMap(true);
  }, []);

  // Keep map player dot live while open
  useEffect(() => {
    if (!showMap) return;
    const id = setInterval(() => {
      setMapPlayerPos({ x: playerPos.x, z: playerPos.z });
    }, 300);
    return () => clearInterval(id);
  }, [showMap]);

  // M key toggles map
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "m") {
        setShowMap((prev) => {
          if (!prev) setMapPlayerPos({ x: playerPos.x, z: playerPos.z });
          return !prev;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        <Atmosphere region={currentRegion.id} />
        <MissionTimer />
        <Physics debug={false} paused={paused}>
          <OpenWorldTerrain />
          <WorldDetails kind="open" />
          <OpenWorldForest />
          {WORLD_REGIONS.map((r) => (
            <WorldBeacon
              key={r.id}
              region={r}
              discovered={discoveredBeacons.has(r.id)}
              onDiscovered={() => handleBeaconDiscovered(r.id)}
            />
          ))}
          <PlayerDragon dragon={dragon} />
          <LootSystem dragon={dragon} hoard={hoard} />
          <Projectiles />
          <CombatFeedback />
        </Physics>
        <RegionTracker onRegionChange={handleRegionChange} />
        <VRScene claws={{ color: dragon.colors.horn, glow: dragon.colors.eye === "#1A1A1A" ? "#ffd27a" : dragon.colors.eye }} />
      </Canvas>
      </SceneBoundary>

      {/* Camera pan overlay */}
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
      <FlightHUD dragon={dragon} paused={paused} onPause={togglePause} hint="Fly low to snatch treasure · E: drop · H: hoard" />
      {manualPause && <div className="flight-pause-overlay"><h2>Flight paused</h2><button type="button" onClick={togglePause}>Resume flight</button></div>}
      <OpenWorldHUD
        region={currentRegion}
        discoveredBeacons={discoveredBeacons}
        hoard={hoard}
      />
      <TalonPanel />
      <LootToasts />

      {entryBanner && (
        <div key={bannerKey} className="ow-entry-banner">
          <div
            className="ow-entry-banner-name"
            style={{ color: entryBanner.textColor }}
          >
            {entryBanner.name.toUpperCase()}
          </div>
          <div className="ow-entry-banner-lore">{entryBanner.lore}</div>
        </div>
      )}

      {!paused && isTouchDevice && (controlScheme === "buttons" ? (
        <DPadControls joy={joy} abilityState={abilityState} />
      ) : (
        <TouchControls dragon={dragon} joy={joy} abilityState={abilityState} maxDist={preset.joystickMaxDist} />
      ))}

      <DragonSwitcher current={dragon} onSwap={onSwap} />

      <button type="button" className="ow-back-btn" onClick={onBack}>
        ← MODES
      </button>

      <button type="button" className="ow-map-btn" onClick={handleOpenMap}>
        MAP [M]
      </button>

      <button type="button" className="ow-map-btn ow-ledger-btn" onClick={() => setShowLedger(true)}>
        HOARD [H]
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

      {showLedger && (
        <HoardLedger hoard={hoard} dragon={dragon} saveUnavailable={hoardSaveUnavailable} onClose={() => setShowLedger(false)} />
      )}

      {showMap && (
        <WorldMapOverlay
          discoveredBeacons={discoveredBeacons}
          playerX={mapPlayerPos.x}
          playerZ={mapPlayerPos.z}
          onClose={() => setShowMap(false)}
        />
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
  const { hoard, bank: bankHoard, saveUnavailable: hoardSaveUnavailable } = useHoard();
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
