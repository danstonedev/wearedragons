import { useEffect, useRef, useState } from "react";
import { playerPos, playerStatus } from "../game/runtime";
import { lootMap } from "../game/lootRuntime";
import { HOARD_SITE } from "../game/loot";
import { KINGDOMS } from "../game/world";
import type { KingdomId } from "../game/world";
import { beaconBase } from "../game/worldSites";
import { RARITY_COLORS } from "../world/treasureModels";
import { windwaySamples } from "../game/windways";
import { SCAVENGER_CAMPS, WORLD_BOUNDS } from "../game/world";
import { scavengerMap } from "../game/scavengerRuntime";
import { mapPercent, sharedMapPainter } from "./worldMapImage";

/** Where each kingdom's name is lettered on the map. */
const LABELS: Record<KingdomId, [number, number]> = {
  pyrrhia: [0, -250], pantala: [420, 40], glaeryus: [-430, 40], sky: [10, -820], ice: [-560, -860],
  mud: [-620, -360], rainforest: [560, -860], sand: [580, -380], sea: [0, 300],
};

const WINDWAY_PATHS = windwaySamples().map(samples => samples.filter((_, i) => i % 6 === 0).map((sample, i) => {
  const x = (sample.x - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) * 100;
  const y = (sample.z - WORLD_BOUNDS.minZ) / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) * 100;
  return `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
}).join(" ") + " Z");

function useLivePlayer() {
  const [player, setPlayer] = useState(() => ({ x: playerPos.x, z: playerPos.z, heading: playerStatus.heading }));
  useEffect(() => {
    const timer = window.setInterval(() => setPlayer({ x: playerPos.x, z: playerPos.z, heading: playerStatus.heading }), 250);
    return () => window.clearInterval(timer);
  }, []);
  return player;
}

/** Shaded relief map of the continent with beacons, your hoard, revealed treasure, and you. */
export default function WorldMap({ discovered, onClose }: { discovered: ReadonlySet<string>; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [painting, setPainting] = useState(() => !sharedMapPainter().done);
  const player = useLivePlayer();

  useEffect(() => {
    const painter = sharedMapPainter();
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    let frame = 0;
    const draw = () => context.putImageData(new ImageData(painter.pixels, painter.width, painter.height), 0, 0);
    const tick = () => {
      const done = painter.step(10);
      draw();
      if (done) setPainting(false);
      else frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, []);

  const painter = sharedMapPainter();
  return (
    <div className="ow-map-overlay" onClick={onClose}>
      <div className="ow-map-panel ow-map-panel-wide" onClick={event => event.stopPropagation()}>
        <div className="ow-map-header">
          <span className="ow-map-title-text">WORLD MAP</span>
          <button type="button" className="ow-map-close" onClick={onClose}>CLOSE [M]</button>
        </div>
        <div className="ow-map-grid ow-map-world" style={{ aspectRatio: `${painter.width} / ${painter.height}` }}>
          <canvas ref={canvas} width={painter.width} height={painter.height} className="ow-map-canvas" />
          {painting && <span className="ow-map-painting">Charting the continent…</span>}
          {/* Windways: ride them to cross the continent fast. */}
          <svg className="ow-map-windways" viewBox="0 0 100 100" preserveAspectRatio="none">
            {WINDWAY_PATHS.map((path, i) => <path key={i} d={path} />)}
          </svg>
          {KINGDOMS.map(kingdom => <span key={kingdom.id} className="ow-map-region-label" style={{ ...mapPercent(...LABELS[kingdom.id]), color: kingdom.textColor }}>{kingdom.name.toUpperCase()}</span>)}
          {KINGDOMS.map(kingdom => {
            const base = beaconBase(kingdom);
            const found = discovered.has(kingdom.id);
            return <div key={kingdom.id} className="ow-map-beacon-dot" title={`${kingdom.name} beacon`} style={{ ...mapPercent(base.x, base.z), color: found ? kingdom.beaconColor : "rgba(255,255,255,0.45)", fontSize: found ? 15 : 11 }}>{found ? "✦" : "○"}</div>;
          })}
          {/* Lit beacons reveal the treasure still glinting in their kingdom. */}
          {lootMap.items.filter(item => discovered.has(item.kingdom)).map((item, i) => (
            <div key={i} className="ow-map-treasure-dot" style={{ ...mapPercent(item.x, item.z), color: RARITY_COLORS[item.rarity], background: RARITY_COLORS[item.rarity], width: item.unique ? 7 : 4, height: item.unique ? 7 : 4 }} />
          ))}
          {/* Scavenger warrens, and anyone out of them: raiders red, thieves hauling loot orange. */}
          {SCAVENGER_CAMPS.map(camp => <div key={camp.id} className="ow-map-camp" title={camp.name} style={mapPercent(camp.x, camp.z)}>⛺</div>)}
          {scavengerMap.agents.filter(agent => agent.kind === "raider" || agent.kind === "hauler").map((agent, i) => (
            <div key={i} className={`ow-map-scavenger ${agent.kind}`} style={mapPercent(agent.x, agent.z)} />
          ))}
          <div className="ow-map-hoard-dot" style={mapPercent(HOARD_SITE.x, HOARD_SITE.z)}>◆</div>
          <div className="ow-map-player-arrow" style={{ ...mapPercent(player.x, player.z), transform: `translate(-50%, -50%) rotate(${-player.heading}rad)` }}>▲</div>
          <span className="ow-map-compass" style={{ top: 5, left: "50%", transform: "translateX(-50%)" }}>N</span>
          <span className="ow-map-compass" style={{ bottom: 5, left: "50%", transform: "translateX(-50%)" }}>S</span>
          <span className="ow-map-compass" style={{ top: "50%", left: 5, transform: "translateY(-50%)" }}>W</span>
          <span className="ow-map-compass" style={{ top: "50%", right: 5, transform: "translateY(-50%)" }}>E</span>
        </div>
        <div className="ow-map-legend">
          <div className="ow-map-legend-item"><span style={{ color: "#ffd700" }}>✦</span> Lit beacon · ○ unlit (follow the light pillars)</div>
          <div className="ow-map-legend-item"><span style={{ color: "#ffd27a" }}>◆</span> Your hoard · lit beacons reveal treasure</div>
          <div className="ow-map-legend-item"><span style={{ color: "#bfefff" }}>⤳</span> Windways carry you fast</div>
          <div className="ow-map-legend-item"><span style={{ color: "#e8c89a" }}>⛺</span> Scavenger warrens · <span style={{ color: "#ff4a3a" }}>●</span> raiders</div>
          <div className="ow-map-legend-item right">{discovered.size} / {KINGDOMS.length} beacons</div>
        </div>
      </div>
    </div>
  );
}
