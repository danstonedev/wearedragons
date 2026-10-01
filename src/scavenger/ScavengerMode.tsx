import { useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import SceneBoundary from "../components/SceneBoundary";
import RenderQuality from "../components/RenderQuality";
import { renderingBudget } from "../game/rendering";
import { device, isTouchDevice } from "../utils/device";
import { useWorldSession } from "../game/useWorldSession";
import { raidStars, SCAVENGER } from "../game/scavenger";
import type { DragonMode, LairDef, RaidResult, ScavengerProgress } from "../game/scavenger";
import { LootToasts } from "../components/LootHUD";
import { createRaid, raidActions, raidCamera, raidHud, raidKeys, raidTouch, resetRaidInput } from "./raidState";
import type { RaidOutcome, StealthStatus } from "./raidState";
import RaidWorld from "./RaidWorld";
import RaidAudio from "./RaidAudio";
import RaidTouchControls from "./RaidTouchControls";
import { VRLaunch, VRScene } from "../vr/VRSupport";
import "./Scavenger.css";

const STATUS: Record<StealthStatus, { label: string; hint: string }> = {
  hidden: { label: "HIDDEN", hint: "In the shadows" },
  exposed: { label: "EXPOSED", hint: "You're in the light" },
  seen: { label: "SEEN", hint: "A dragon is watching you!" },
  hunted: { label: "HUNTED", hint: "RUN! Break line of sight!" },
};
const MODE_ICON: Record<DragonMode, string> = { asleep: "Zz", stirring: "?", patrol: "◉", investigate: "?", chase: "!", search: "?", returning: "…" };
const MODE_LABEL: Record<DragonMode, string> = { asleep: "asleep", stirring: "stirring", patrol: "patrolling", investigate: "investigating", chase: "CHASING", search: "searching", returning: "settling" };
const MOVE_KEYS = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"];

function Stars({ count }: { count: number }) {
  return <div className="raid-stars">{[1, 2, 3].map(i => <span key={i} className={i <= count ? "lit" : ""}>★</span>)}</div>;
}

export default function ScavengerMode({ lair, progress, onRecord, onLeave, saveUnavailable }: {
  lair: LairDef;
  progress: ScavengerProgress;
  onRecord: (lair: LairDef, result: RaidResult) => void;
  onLeave: () => void;
  saveUnavailable: boolean;
}) {
  const [raid, setRaid] = useState(() => createRaid(lair));
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<RaidOutcome | null>(null);
  const [hud, setHud] = useState(() => ({ ...raidHud }));
  const { paused, manualPause, togglePause } = useWorldSession(Boolean(outcome));

  const begin = useCallback(() => {
    resetRaidInput();
    raidTouch.sneak = false;
    Object.assign(raidCamera, { yaw: lair.start.yaw, pitch: 0.38 });
    Object.assign(raidHud, { status: "hidden", value: 0, weight: 0, sack: [], pebbles: lair.pebbles, nearLoot: null, atExit: true, dragons: [] });
  }, [lair]);
  useEffect(() => { begin(); return resetRaidInput; }, [begin]);
  useEffect(() => { if (paused) resetRaidInput(); }, [paused]);
  useEffect(() => {
    const timer = window.setInterval(() => setHud({ ...raidHud }), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      const key = event.key.toLowerCase();
      if (MOVE_KEYS.includes(key)) { event.preventDefault(); raidKeys[key] = true; }
      if (event.repeat || outcome) return;
      if (key === "c") raidTouch.sneak = !raidTouch.sneak;
      if (key === "e") raidActions.grab = true;
      if (key === "q") raidActions.pebble = true;
      if (key === "x") raidActions.drop = true;
    };
    const up = (event: KeyboardEvent) => { raidKeys[event.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [outcome]);

  const handleEnd = useCallback((result: RaidOutcome) => {
    setOutcome(result);
    if (result.escaped) onRecord(lair, { escaped: true, value: result.value, ghost: result.ghost, prize: result.prize });
  }, [lair, onRecord]);
  const retry = () => { begin(); setRaid(createRaid(lair)); setOutcome(null); setAttempt(value => value + 1); };

  const prize = lair.loot.find(item => item.prize);
  const carrying = hud.sack.length > 0;
  const objective = carrying ? (hud.atExit ? "Step into the burrow to escape!" : "Escape back down the burrow with your loot") : `Steal from the hoard · Prize: ${prize?.name ?? "treasure"}`;
  const record = progress.lairs[lair.id];
  const stars = outcome?.escaped ? raidStars(lair, outcome.value) : 0;
  const caughtBy = outcome?.caughtBy ? lair.dragons.find(dragon => dragon.id === outcome.caughtBy)?.name : null;

  return <div className="raid-screen" tabIndex={0}>
    <SceneBoundary>
      <Canvas shadows={false} camera={{ position: [lair.start.x, 3, lair.start.z + 5], fov: 62, near: 0.1, far: 140 }}
        dpr={[renderingBudget(device).minDpr, renderingBudget(device).maxDpr]} gl={{ toneMapping: THREE.ACESFilmicToneMapping }}>
        <RenderQuality />
        <RaidWorld key={attempt} raid={raid} onEnd={handleEnd} />
        <VRScene scavenger={raid} />
      </Canvas>
    </SceneBoundary>

    {/* Drag anywhere to look around. */}
    <div className="raid-look"
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); raidCamera.pointer = event.pointerId; raidCamera.lastX = event.clientX; raidCamera.lastY = event.clientY; }}
      onPointerMove={event => {
        if (raidCamera.pointer !== event.pointerId) return;
        raidCamera.yaw -= (event.clientX - raidCamera.lastX) * 0.006;
        raidCamera.pitch += (event.clientY - raidCamera.lastY) * 0.004;
        raidCamera.lastX = event.clientX; raidCamera.lastY = event.clientY;
      }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); raidCamera.pointer = 0; }}
      onPointerCancel={() => { raidCamera.pointer = 0; }}
    />

    <div className={`raid-vignette ${hud.status}`} />
    <div className="raid-top">
      <div className="raid-lair-name">{lair.name}</div>
      <div className={`raid-status ${hud.status}`}>{STATUS[hud.status].label}<span>{STATUS[hud.status].hint}</span></div>
      <div className="raid-objective">{objective}</div>
    </div>

    <div className="raid-dragons" aria-label="Dragons">
      {hud.dragons.map(dragon => <div key={dragon.id} className={`raid-dragon ${dragon.mode}`}>
        <span className="raid-dragon-icon">{MODE_ICON[dragon.mode]}</span>
        <div><b>{dragon.name}</b><small>{MODE_LABEL[dragon.mode]}</small><i><em style={{ width: `${dragon.suspicion}%` }} /></i></div>
      </div>)}
    </div>

    <div className="raid-sack">
      <div className="raid-sack-head"><span>LOOT SACK</span><span>{hud.value} gold</span></div>
      <div className="raid-weight"><i style={{ width: `${hud.weight / SCAVENGER.capacity * 100}%` }} /><span>WEIGHT {hud.weight}/{SCAVENGER.capacity}</span></div>
      {hud.sack.length ? hud.sack.map((item, i) => <div key={i} className={`raid-sack-item${item.prize ? " prize" : ""}`}>{item.prize ? "★ " : ""}{item.name}<em>{item.value}</em></div>) : <div className="raid-sack-empty">Empty. Sneak to the hoard!</div>}
      <div className="raid-pebbles">PEBBLES {"●".repeat(hud.pebbles)}{"○".repeat(Math.max(0, lair.pebbles - hud.pebbles))}{hud.sneaking ? " · SNEAKING" : ""}</div>
    </div>

    {!outcome && hud.nearLoot && <div className={`raid-prompt${hud.nearLoot.fits ? "" : " full"}`}>{isTouchDevice ? "GRAB" : "E"} · {hud.nearLoot.fits ? "Steal" : "Too heavy:"} {hud.nearLoot.name} ({hud.nearLoot.value} gold, weight {hud.nearLoot.weight})</div>}

    <button type="button" className="flight-pause" onClick={togglePause}>{paused ? "RESUME" : "PAUSE"} [ESC]</button>
    <RaidAudio />
    <VRLaunch mode="scavenger" />
    <button type="button" className="ow-back-btn raid-leave" onClick={onLeave}>← LAIRS</button>
    {!isTouchDevice && <div className="flight-controls-hint raid-hint">WASD: move · Drag / ← →: look · C: sneak · Shift: run · E: steal · Q: throw pebble · X: drop · Esc: pause</div>}
    {isTouchDevice && !paused && <RaidTouchControls />}
    <LootToasts />

    {manualPause && !outcome && <div className="flight-pause-overlay"><h2>Raid paused</h2><button type="button" onClick={togglePause}>Resume</button></div>}

    {outcome && <div className="result-overlay">
      <div className="result-card">
        <div className="result-badge" style={{ color: outcome.escaped ? "#ffd27a" : "#ff6655" }}>{outcome.escaped ? "ESCAPED!" : "CAUGHT!"}</div>
        <h2 className="result-mission-name">{lair.name}</h2>
        {outcome.escaped ? <>
          <Stars count={stars} />
          <p className="result-text">You slipped back into the Burrows with <b>{outcome.value} gold</b> of dragon treasure.</p>
          <div className="raid-badges">
            {outcome.prize && <span className="prize">★ PRIZE STOLEN</span>}
            {outcome.ghost && <span className="ghost">GHOST · never spotted</span>}
          </div>
          {stars < 3 && <p className="raid-goal">{["One", "Two", "Three"][stars]} star{stars ? "s" : ""}: escape with {lair.stars[Math.min(stars, 2) as 0 | 1 | 2]} gold.</p>}
        </> : <p className="result-text">{caughtBy ?? "A dragon"} caught you and flung you back down the burrow. Everything in your sack is lost. Try sneaking during the snores and keeping to the shadows.</p>}
        {record && <p className="raid-record">Best: {"★".repeat(record.stars)}{"☆".repeat(3 - record.stars)} · {record.bestLoot} gold · {record.escapes} escapes{record.ghost ? " · ghost" : ""}</p>}
        {saveUnavailable && <p className="raid-record">Browser storage is unavailable; records last for this session.</p>}
        <div className="brief-actions">
          <button type="button" className="brief-btn brief-btn-back" onClick={onLeave}>LAIRS</button>
          <button type="button" className="brief-btn brief-btn-start raid-again" onClick={retry}>{outcome.escaped ? "RAID AGAIN" : "TRY AGAIN"}</button>
        </div>
      </div>
    </div>}
  </div>;
}
