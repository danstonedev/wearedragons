import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { lootHud } from "../game/lootRuntime";
import type { CarriedSummary } from "../game/lootRuntime";
import { gameSession, lootInput, missionEmitter } from "../game/runtime";
import { ALL_TREASURES, TREASURES, TRIBE_TASTES, hoardRank } from "../game/loot";
import type { HoardProgress, LootRegion, TreasureDef, TreasureRarity } from "../game/loot";
import { KINGDOMS, SCAVENGER_CAMPS } from "../game/world";
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
  const found = ALL_TREASURES.filter(def => hoard.banked[def.id]).length;
  return <div className="hoard-chip">✦ HOARD {hoard.gold.toLocaleString()} · {hoardRank(hoard.gold).title.toUpperCase()} · {found}/{ALL_TREASURES.length} TREASURES</div>;
}

/** The home valley's three corners, named for the lands they border. */
const HOME_COLUMNS: readonly [LootRegion, string][] = [["pyrrhia", "Pyrrhia woods"], ["pantala", "Pantala border"], ["glaeryus", "Glaeryus border"]];
const RARITY_LABEL: Record<TreasureRarity, string> = { junk: "Scavenger junk", common: "Find", rare: "Rare", legendary: "Legendary" };

function hintFor(def: TreasureDef) {
  if (def.perch === "royal") return "Crowns its kingdom's royal hoard, under a champion's eye.";
  if (def.perch === "sky") return "Drifts beneath a sky lantern.";
  if (def.perch === "treetop") return "Glints from a treetop.";
  if (def.perch === "spire") return "Rests atop a rock spire.";
  if (def.perch === "ledge") return "Balanced high on a landmark.";
  return def.weight >= 3 ? "Too heavy for one talon." : "Hidden somewhere on the ground.";
}

function LedgerItem({ def, hoard, names }: { def: TreasureDef; hoard: HoardProgress; names: ReadonlyMap<string, string> }) {
  const record = hoard.banked[def.id];
  return <div className={`ledger-item${record ? " found" : ""}`} style={{ "--rarity": RARITY_COLORS[def.rarity] } as CSSProperties}>
    <div className="ledger-item-top">
      <b>{record ? def.name : "???"}</b>
      <span>{record ? `${record.value}` : def.royal ? "Crown treasure" : RARITY_LABEL[def.rarity]}</span>
    </div>
    <p>{record ? def.lore : hintFor(def)}</p>
    {record && <small>Brought home by {names.get(record.by) ?? record.by}</small>}
  </div>;
}

/** The collection screen: every unique treasure, who brought it home, and what your tribe loves. */
export function HoardLedger({ hoard, dragon, onClose, saveUnavailable }: { hoard: HoardProgress; dragon: DragonType; onClose: () => void; saveUnavailable: boolean }) {
  const rank = hoardRank(hoard.gold);
  const taste = TRIBE_TASTES[dragon.id];
  const names = new Map(DRAGON_TYPES.map(item => [item.id, item.name]));
  const found = ALL_TREASURES.filter(def => hoard.banked[def.id]).length;
  const owed = Object.entries(hoard.stolen ?? {}).filter(([, gold]) => gold > 0);
  return <div className="ow-map-overlay" onClick={onClose}>
    <div className="ledger-panel" onClick={event => event.stopPropagation()} role="dialog" aria-label="Hoard ledger">
      <div className="ow-map-header">
        <span className="ow-map-title-text">HOARD LEDGER</span>
        <button type="button" className="ow-map-close" onClick={onClose}>CLOSE [H]</button>
      </div>
      <div className="ledger-summary">
        <strong>{hoard.gold.toLocaleString()} gold · {rank.title}</strong>
        <span>{found}/{ALL_TREASURES.length} treasures · {hoard.deliveries} deliveries{rank.next ? ` · next title at ${rank.next.toLocaleString()} gold` : ""}</span>
        {taste && <span className="ledger-taste">{taste.blurb} Favorites are worth ×{taste.multiplier} when {dragon.name} brings them home.</span>}
        {owed.length > 0 && <span className="ledger-owed">Scavengers are hiding your gold: {owed.map(([id, gold]) => `${gold} at ${SCAVENGER_CAMPS.find(camp => camp.id === id)?.name ?? id}`).join(" · ")}. Raid their stashes to win it back.</span>}
        <span className="ledger-tip">Fly low to snatch treasure in your talons. Carry it into the glowing ring around your hoard, or drop it in from high above for a dunk bonus. Lit beacons reveal treasure on the map.</span>
        {saveUnavailable && <span role="status">Browser storage is unavailable; this hoard lasts for this session.</span>}
      </div>
      <h2 className="ledger-heading">The home valley</h2>
      <div className="ledger-columns">
        {HOME_COLUMNS.map(([region, label]) => <section key={region}>
          <h3>{label}</h3>
          {TREASURES.filter(def => def.region === region).map(def => <LedgerItem key={def.id} def={def} hoard={hoard} names={names} />)}
        </section>)}
      </div>
      <h2 className="ledger-heading">The kingdoms</h2>
      <div className="ledger-columns ledger-kingdoms">
        {KINGDOMS.filter(kingdom => kingdom.id !== "pyrrhia").map(kingdom => <section key={kingdom.id}>
          <h3 style={{ color: kingdom.textColor }}>{kingdom.name}</h3>
          {ALL_TREASURES.filter(def => (def.royal ?? def.kingdom) === kingdom.id).map(def => <LedgerItem key={def.id} def={def} hoard={hoard} names={names} />)}
        </section>)}
      </div>
    </div>
  </div>;
}
