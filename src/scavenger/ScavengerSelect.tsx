import type { CSSProperties } from "react";
import { DRAGON_TYPES } from "../dragons";
import { LAIRS } from "../game/scavenger";
import type { LairDef, ScavengerProgress } from "../game/scavenger";
import "./Scavenger.css";

const REGION_COLORS: Record<LairDef["region"], string> = { pyrrhia: "#c99a4e", pantala: "#e6b45c", glaeryus: "#7fc6e8" };
const DIFFICULTY = ["Sleepy", "Guarded", "Treacherous"];

/** The Burrows: pick which dragon's lair to raid. */
export default function ScavengerSelect({ progress, onRaid, onBack, saveUnavailable }: {
  progress: ScavengerProgress;
  onRaid: (lair: LairDef) => void;
  onBack: () => void;
  saveUnavailable: boolean;
}) {
  const next = LAIRS.find(lair => !progress.lairs[lair.id]);
  const stars = LAIRS.reduce((sum, lair) => sum + (progress.lairs[lair.id]?.stars ?? 0), 0);
  return <div className="brief-screen scavenger-select">
    <div className="mission-select-shell">
      <div className="mission-select-header">
        <div className="mission-select-flying">Playing as a <span style={{ color: "#e7b26a" }}>SCAVENGER</span></div>
        <h1 className="mission-select-title">The Burrows</h1>
        <p className="scavenger-lore">Dragons call us scavengers. We live in tunnels beneath the hills, where no dragon can follow, because up there everything is bigger, hotter, and hungrier than we are. But dragons hoard everything that shines, and down here we need it more. Pick a lair. Sneak in. Steal what you can carry. Get home.</p>
        <div className="guardian-summary scavenger-summary">
          <strong>{stars} / {LAIRS.length * 3} raid stars</strong>
          <span>Sneak (C) while dragons snore. Shadows hide you; braziers and sunlight give you away. Coins jingle underfoot, heavy loot rattles, and a thrown pebble (Q) sends a dragon to look somewhere else.</span>
          {saveUnavailable && <p role="status">Browser storage is unavailable; records last for this session.</p>}
        </div>
      </div>
      <div className="mission-select-list">
        {LAIRS.map((lair, index) => {
          const record = progress.lairs[lair.id];
          const color = REGION_COLORS[lair.region];
          return <button key={lair.id} type="button" onClick={() => onRaid(lair)} className={`mission-select-card${lair.id === next?.id ? " campaign-next" : ""}`}
            style={{ "--mission-type-color": color, "--mission-accent-color": color } as CSSProperties}>
            <div className="mission-select-type">{DIFFICULTY[index] ?? "Lair"}</div>
            <div className="mission-select-info">
              <div className="mission-select-name">{lair.name}</div>
              <div className="mission-select-description">{lair.tagline}</div>
              <div className="lair-dragons">
                {lair.dragons.map(dragon => {
                  const type = DRAGON_TYPES.find(item => item.id === dragon.tribe);
                  return <span key={dragon.id} style={{ borderColor: type?.colors.body }}>{dragon.role === "sleeper" ? "Zz" : "◉"} {dragon.name} · {type?.name ?? dragon.tribe}</span>;
                })}
              </div>
              <div className="mission-record">
                <span aria-label={`${record?.stars ?? 0} of 3 stars`}>{"★".repeat(record?.stars ?? 0)}{"☆".repeat(3 - (record?.stars ?? 0))}</span>
                {record ? ` · Best haul ${record.bestLoot} gold · ${record.escapes} escapes${record.prize ? " · prize stolen" : ""}${record.ghost ? " · ghost" : ""}` : " · Unraided"}
                {lair.id === next?.id && <b> · NEXT LAIR</b>}
              </div>
            </div>
            <div className="mission-select-region">{lair.region}</div>
          </button>;
        })}
      </div>
      <div className="mission-select-actions">
        <button type="button" className="brief-btn brief-btn-back" onClick={onBack}>BACK TO MODES</button>
      </div>
    </div>
  </div>;
}
