import { useCallback, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import * as THREE from "three";
import SceneBoundary from "../components/SceneBoundary";
import RenderQuality from "../components/RenderQuality";
import FlightHUD from "../components/FlightHUD";
import DragonSwitcher from "../components/DragonSwitcher";
import { TalonPanel, LootToasts, HoardChip, HoardLedger } from "../components/LootHUD";
import TouchControls from "../controls/TouchControls";
import DPadControls from "../controls/DPadControls";
import { settings } from "../controls/ControlSettings";
import SettingsPanel from "../SettingsPanel";
import { DRAGON_TYPES } from "../dragons";
import type { DragonType } from "../dragons";
import { abilityState, joy, missionEmitter, pan } from "../game/runtime";
import { renderingBudget } from "../game/rendering";
import { useWorldSession } from "../game/useWorldSession";
import { useWorldSave } from "../game/worldSave";
import { KINGDOMS, attitudeOf } from "../game/world";
import type { Kingdom } from "../game/world";
import type { HoardProgress, TreasureDef } from "../game/loot";
import { lootToast } from "../game/lootRuntime";
import { device, isTouchDevice, preset } from "../utils/device";
import { VRLaunch, VRScene } from "../vr/VRSupport";
import Atmosphere from "../world/Atmosphere";
import CombatFeedback from "../world/CombatFeedback";
import LootSystem from "../world/LootSystem";
import MissionTimer from "../world/MissionTimer";
import PlayerDragon from "../world/PlayerDragon";
import Projectiles, { EnemyProjectiles } from "../world/Projectiles";
import RivalDragons from "../world/RivalDragons";
import Scavengers from "../world/Scavengers";
import Vegetation from "../world/Vegetation";
import WorldDetails from "../world/WorldDetails";
import WorldTerrain from "../world/WorldTerrain";
import WorldScenery from "../world/WorldScenery";
import Landmarks from "../world/landmarks/Landmarks";
import Windways from "../world/Windways";
import KingdomTracker from "./KingdomTracker";
import WorldBeacon from "./WorldBeacon";
import WorldMap from "./WorldMap";
import CombatHUD from "./CombatHUD";
import { useVitality } from "./useVitality";
import { sharedMapPainter } from "./worldMapImage";

/** "SkyWings", "HiveWings, SilkWings and LeafWings": the tribes that guard a kingdom. */
function tribeNames(kingdom: Kingdom) {
  const names = [...new Set(kingdom.tribes.map(id => (DRAGON_TYPES.find(type => type.id === id)?.name ?? id).replace(/ II$/, "") + "s"))];
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "";
}

const ATTITUDE_TEXT = {
  home: () => "Your tribe's home · its dragons are friends",
  rival: (kingdom: Kingdom) => `Rival territory · ${tribeNames(kingdom)} guard it`,
  neutral: () => "Neutral ground · your hoard is here",
} as const;

function OpenWorldHUD({ kingdom, tribe, discovered, hoard }: { kingdom: Kingdom; tribe: string; discovered: ReadonlySet<string>; hoard: HoardProgress }) {
  const attitude = attitudeOf(kingdom, tribe);
  return (
    <div className="ow-hud">
      <div className="ow-region-label">CURRENT KINGDOM</div>
      <div className="ow-region-name" style={{ color: kingdom.textColor }}>{kingdom.name.toUpperCase()}</div>
      <div className={`ow-attitude ${attitude}`}>{ATTITUDE_TEXT[attitude](kingdom)}</div>
      <div className={`ow-beacons${discovered.size === KINGDOMS.length ? " complete" : ""}`}>
        <span className="ow-beacon-pips">
          {KINGDOMS.map(item => <span key={item.id} style={{ color: discovered.has(item.id) ? item.beaconColor : "rgba(255,255,255,0.2)" }}>{discovered.has(item.id) ? "✦" : "○"}</span>)}
        </span>
        {discovered.size}/{KINGDOMS.length} BEACONS
      </div>
      <HoardChip hoard={hoard} />
    </div>
  );
}

/** Paint the world map in idle moments, so it is ready the first time it opens. */
function useMapPreload() {
  useEffect(() => {
    const painter = sharedMapPainter();
    let handle = 0;
    const idle = (callback: () => void) => window.setTimeout(callback, 50);
    const work = () => {
      if (painter.step(4)) return;
      handle = idle(work);
    };
    handle = idle(work);
    return () => window.clearTimeout(handle);
  }, []);
}

/** Full open-world free flight across the dragon kingdoms. */
export default function OpenWorldView({ dragon, onSwap, onBack, hoard, onBank, onSteal, hoardSaveUnavailable }: {
  dragon: DragonType;
  onSwap: (d: DragonType) => void;
  onBack: () => void;
  hoard: HoardProgress;
  onBank: (def: TreasureDef, dragonId: string, value: number) => void;
  /** Scavengers scoop gold out of your hoard; returns how much they got. */
  onSteal: (campId: string, amount: number) => number;
  hoardSaveUnavailable: boolean;
}) {
  const [kingdom, setKingdom] = useState<Kingdom>(KINGDOMS[0]);
  const { save: worldSave, light: lightBeacon } = useWorldSave();
  const discovered = useMemo<ReadonlySet<string>>(() => new Set(worldSave.beacons), [worldSave]);
  const [banner, setBanner] = useState<{ kingdom: Kingdom; key: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [controlScheme, setControlScheme] = useState(settings.scheme);
  const [showLedger, setShowLedger] = useState(false);
  const { paused, manualPause, togglePause } = useWorldSession(showSettings || showMap || showLedger);
  const budget = renderingBudget(device);
  const { vitality, hurt, knockedOut } = useVitality(dragon);
  useMapPreload();

  // Deliveries are decided in the frame loop and persisted here.
  useEffect(() => {
    const banked = (event: Event) => {
      const { def, value, dragonId } = (event as CustomEvent<{ def: TreasureDef; value: number; dragonId: string }>).detail;
      onBank(def, dragonId, value);
    };
    missionEmitter.addEventListener("loot_banked", banked);
    return () => missionEmitter.removeEventListener("loot_banked", banked);
  }, [onBank]);

  // H toggles the hoard ledger, M the map.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "h") setShowLedger(previous => !previous);
      if (key === "m") setShowMap(previous => !previous);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleKingdom = useCallback((next: Kingdom) => {
    setKingdom(next);
    setBanner(previous => ({ kingdom: next, key: (previous?.key ?? 0) + 1 }));
  }, []);

  return (
    <div tabIndex={0} style={{ width: "100vw", height: "100vh", overflow: "hidden", outline: "none", touchAction: "none" }}>
      <SceneBoundary>
        <Canvas
          shadows={budget.shadows ? { type: THREE.PCFShadowMap } : false}
          camera={{ position: [0, 5, 10], fov: 60, far: 1800 }}
          dpr={[budget.minDpr, budget.maxDpr]}
        >
          <RenderQuality />
          <Atmosphere mist={kingdom.fog} sun={kingdom.sun} fogRange={budget.worldFog} followClouds />
          <MissionTimer />
          <Physics debug={false} paused={paused}>
            <WorldTerrain />
            <WorldScenery />
            <Landmarks />
            <Windways />
            <WorldDetails kind="open" />
            <Vegetation kind="open" />
            {KINGDOMS.map(item => <WorldBeacon key={item.id} kingdom={item} discovered={discovered.has(item.id)} onDiscovered={() => {
              lightBeacon(item.id);
              lootToast(`✦ The ${item.name} beacon is lit! Its treasure now shows on your map (M).`, "legend");
            }} />)}
            <PlayerDragon dragon={dragon} />
            <LootSystem dragon={dragon} hoard={hoard} />
            <Projectiles />
            <EnemyProjectiles />
            <RivalDragons dragon={dragon} />
            <Scavengers gold={hoard.gold} onSteal={onSteal} knockedOut={knockedOut} />
            <CombatFeedback />
          </Physics>
          <KingdomTracker onChange={handleKingdom} />
          <VRScene claws={{ color: dragon.colors.horn, glow: dragon.colors.eye === "#1A1A1A" ? "#ffd27a" : dragon.colors.eye }} />
        </Canvas>
      </SceneBoundary>

      {/* Camera pan overlay */}
      <div
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0, touchAction: "none" }}
        onPointerDown={event => {
          if (event.target instanceof Element) event.target.setPointerCapture(event.pointerId);
          pan.active = event.pointerId;
          pan.lastX = event.clientX;
          pan.lastY = event.clientY;
        }}
        onPointerMove={event => {
          if (pan.active !== event.pointerId) return;
          pan.yaw += (event.clientX - pan.lastX) * -0.005;
          pan.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pan.pitch + (event.clientY - pan.lastY) * -0.005));
          pan.lastX = event.clientX;
          pan.lastY = event.clientY;
        }}
        onPointerUp={event => {
          if (event.target instanceof Element && event.target.hasPointerCapture(event.pointerId)) event.target.releasePointerCapture(event.pointerId);
          if (pan.active === event.pointerId) pan.active = 0;
        }}
        onPointerCancel={event => {
          if (event.target instanceof Element && event.target.hasPointerCapture(event.pointerId)) event.target.releasePointerCapture(event.pointerId);
          if (pan.active === event.pointerId) pan.active = 0;
        }}
      />

      <VRLaunch />
      <FlightHUD dragon={dragon} paused={paused} onPause={togglePause} hint="Fly low to snatch treasure · E: drop · H: hoard · M: map" />
      {manualPause && <div className="flight-pause-overlay"><h2>Flight paused</h2><button type="button" onClick={togglePause}>Resume flight</button></div>}
      <OpenWorldHUD kingdom={kingdom} tribe={dragon.id} discovered={discovered} hoard={hoard} />
      <CombatHUD vitality={vitality} hurt={hurt} knockedOut={knockedOut} />
      <TalonPanel />
      <LootToasts />

      {banner && (
        <div key={banner.key} className="ow-entry-banner">
          <div className="ow-entry-banner-name" style={{ color: banner.kingdom.textColor }}>{banner.kingdom.name.toUpperCase()}</div>
          <div className="ow-entry-banner-lore">{banner.kingdom.lore}</div>
          <div className={`ow-entry-banner-attitude ${attitudeOf(banner.kingdom, dragon.id)}`}>{ATTITUDE_TEXT[attitudeOf(banner.kingdom, dragon.id)](banner.kingdom)}</div>
        </div>
      )}

      {!paused && isTouchDevice && (controlScheme === "buttons"
        ? <DPadControls joy={joy} abilityState={abilityState} />
        : <TouchControls dragon={dragon} joy={joy} abilityState={abilityState} maxDist={preset.joystickMaxDist} />)}

      <DragonSwitcher current={dragon} onSwap={onSwap} />
      <button type="button" className="ow-back-btn" onClick={onBack}>← MODES</button>
      <button type="button" className="ow-map-btn" onClick={() => setShowMap(true)}>MAP [M]</button>
      <button type="button" className="ow-map-btn ow-ledger-btn" onClick={() => setShowLedger(true)}>HOARD [H]</button>
      <button type="button" className="hud-settings-btn" title="Settings" aria-label="Settings" onClick={() => setShowSettings(true)}>
        <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
          <path d="M11.5 2.1l.9 2a6.1 6.1 0 011.4.8l2-.6a8 8 0 011.4 2.4l-1.2 1.7c.1.5.1 1 0 1.6l1.2 1.7a8 8 0 01-1.4 2.4l-2-.6c-.4.3-.9.6-1.4.8l-.9 2a8 8 0 01-3 0l-.9-2a6.1 6.1 0 01-1.4-.8l-2 .6a8 8 0 01-1.4-2.4l1.2-1.7a6 6 0 010-1.6L2.8 7.5a8 8 0 011.4-2.4l2 .6c.4-.3.9-.6 1.4-.8l.9-2a8 8 0 013 0zM10 7.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" />
        </svg>
      </button>

      {showSettings && <SettingsPanel onClose={() => { setShowSettings(false); setControlScheme(settings.scheme); }} />}
      {showLedger && <HoardLedger hoard={hoard} dragon={dragon} saveUnavailable={hoardSaveUnavailable} onClose={() => setShowLedger(false)} />}
      {showMap && <WorldMap discovered={discovered} onClose={() => setShowMap(false)} />}
    </div>
  );
}
