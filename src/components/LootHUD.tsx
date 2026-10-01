import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { lootHud } from "../game/lootRuntime";
import type { CarriedSummary } from "../game/lootRuntime";
import { gameSession, lootInput, missionEmitter } from "../game/runtime";
import { TREASURES, TRIBE_TASTES, hoardRank } from "../game/loot";
import type { HoardProgress, LootRegion, TreasureRarity } from "../game/loot";
import { DRAGON_TYPES } from "../dragons";
import type { DragonType } from "../dragons";
import { RARITY_COLORS } from "../world/treasureModels";
import "./Loot.css";

function Arrow({ bearing }: { bearing: number }) {
  return <span className="loot-arrow" style={{ transform: `rotate(${-bearing}rad)` }} aria-hidden="true">▲</span>;
}

function TalonSlot({ label, item }: { label: string; item: CarriedSummary | null }) {
  return <div className={`loot-talon${item ? " full" : ""}`} style={item ? { "--rarity": RARITY_COLORS[item.rarity] } as CSSProperties : undefined}>
    <b>{label}</b>
    <span>{item ? item.name : "empty"}</span>
    {item && <em>{item.value}{item.favored ? " ♥" : ""}</em>}
  </div>;
}

/** Talon contents, the way home, and a drop button for touch players. */
export function TalonPanel({ vr }: { vr?: boolean }) {
  const [state, setState] = useState(() => ({ ...lootHud }));
  useEffect(() => {
    const timer = window.setInterval(() => setState({ ...lootHud }), 150);
    return () => window.clearInterval(timer);
  }, []);
  const carrying = Boolean(state.left || state.right);
  return <div className={`loot-panel${carrying ? " carrying" : ""}`}>
    <div className="loot-panel-head"><span>TALONS</span>{state.weight > 0 && <span>LOAD {state.weight}</span>}</div>
    {state.both && state.left ? <TalonSlot label="L+R" item={state.left} /> : <>
      <TalonSlot label="L" item={state.left} />
      <TalonSlot label="R" item={state.right} />
    </>}
    {carrying ? <div className="loot-panel-foot">
      <span><Arrow bearing={state.hoardBearing} /> HOARD {Math.round(state.hoardDistance)} m</span>
      <button type="button" onPointerDown={event => { event.stopPropagation(); lootInput.drop = true; }} onClick={event => event.stopPropagation()}>DROP{vr ? "" : " · E"}</button>
    </div> : <div className="loot-panel-foot hint">
      {state.nearest ? <span style={{ color: RARITY_COLORS[state.nearest.rarity] }}><Arrow bearing={state.nearest.bearing} /> GLINT {Math.round(state.nearest.distance)} m</span> : <span>The skies are picked clean!</span>}
      <span>Swoop low to snatch</span>
    </div>}
  </div>;
}

interface Toast { id: number; text: string; tone: string }
let toastId = 0;

/** Short-lived treasure news: snatches, deliveries, dunks, and helpful nudges. */
export function LootToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const timers = new Set<number>();
    const handle = (event: Event) => {
      const { text, tone } = (event as CustomEvent<{ text: string; tone: string }>).detail;
      if (gameSession.paused) return;
      const id = ++toastId;
      setToasts(previous => [...previous.slice(-2), { id, text, tone }]);
      const timer = window.setTimeout(() => { timers.delete(timer); setToasts(previous => previous.filter(toast => toast.id !== id)); }, 2800);
      timers.add(timer);
    };
    missionEmitter.addEventListener("loot_toast", handle);
    return () => { missionEmitter.removeEventListener("loot_toast", handle); timers.forEach(timer => window.clearTimeout(timer)); };
  }, []);
  return <div className="loot-toasts" aria-live="polite">{toasts.map(toast => <div key={toast.id} className={`loot-toast ${toast.tone}`}>{toast.text}</div>)}</div>;
}

/** Compact hoard summary beside the region name. */
export function HoardChip({ hoard }: { hoard: HoardProgress }) {
  const found = TREASURES.filter(def => hoard.banked[def.id]).length;
  return <div className="hoard-chip">✦ HOARD {hoard.gold.toLocaleString()} · {hoardRank(hoard.gold).title.toUpperCase()} · {found}/{TREASURES.length} TREASURES</div>;
}

const REGION_LABEL: Record<LootRegion, string> = { pyrrhia: "Pyrrhia", pantala: "Pantala", glaeryus: "Glaeryus" };
const RARITY_LABEL: Record<TreasureRarity, string> = { junk: "Scavenger junk", common: "Find", rare: "Rare", legendary: "Legendary" };

/** The collection screen: every unique treasure, who brought it home, and what your tribe loves. */
export function HoardLedger({ hoard, dragon, onClose, saveUnavailable }: { hoard: HoardProgress; dragon: DragonType; onClose: () => void; saveUnavailable: boolean }) {
  const rank = hoardRank(hoard.gold);
  const taste = TRIBE_TASTES[dragon.id];
  const names = new Map(DRAGON_TYPES.map(item => [item.id, item.name]));
  const found = TREASURES.filter(def => hoard.banked[def.id]).length;
  return <div className="ow-map-overlay" onClick={onClose}>
    <div className="ledger-panel" onClick={event => event.stopPropagation()} role="dialog" aria-label="Hoard ledger">
      <div className="ow-map-header">
        <span className="ow-map-title-text">HOARD LEDGER</span>
        <button type="button" className="ow-map-close" onClick={onClose}>CLOSE [H]</button>
      </div>
      <div className="ledger-summary">
        <strong>{hoard.gold.toLocaleString()} gold · {rank.title}</strong>
        <span>{found}/{TREASURES.length} treasures · {hoard.deliveries} deliveries{rank.next ? ` · next title at ${rank.next.toLocaleString()} gold` : ""}</span>
        {taste && <span className="ledger-taste">{taste.blurb} Favorites are worth ×{taste.multiplier} when {dragon.name} brings them home.</span>}
        <span className="ledger-tip">Fly low to snatch treasure in your talons. Carry it into the glowing ring around your hoard, or drop it in from high above for a dunk bonus. Lit beacons reveal treasure on the map.</span>
        {saveUnavailable && <span role="status">Browser storage is unavailable; this hoard lasts for this session.</span>}
      </div>
      <div className="ledger-columns">
        {(["pyrrhia", "pantala", "glaeryus"] as const).map(region => <section key={region}>
          <h3>{REGION_LABEL[region]}</h3>
          {TREASURES.filter(def => def.region === region).map(def => {
            const record = hoard.banked[def.id];
            return <div key={def.id} className={`ledger-item${record ? " found" : ""}`} style={{ "--rarity": RARITY_COLORS[def.rarity] } as CSSProperties}>
              <div className="ledger-item-top">
                <b>{record ? def.name : "???"}</b>
                <span>{record ? `${record.value}` : RARITY_LABEL[def.rarity]}</span>
              </div>
              <p>{record ? def.lore : def.perch === "sky" ? "Drifts beneath a sky lantern." : def.perch === "treetop" ? "Glints from a treetop." : def.perch === "spire" ? "Rests atop a rock spire." : def.weight >= 3 ? "Too heavy for one talon." : "Hidden somewhere on the ground."}</p>
              {record && <small>Brought home by {names.get(record.by) ?? record.by}</small>}
            </div>;
          })}
        </section>)}
      </div>
    </div>
  </div>;
}
