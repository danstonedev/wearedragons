/** Polled by the DOM HUD and the map; written by the scavengers' frame loop. */
export const scavengerHud = {
  /** A raiding party after your hoard. */
  raid: null as null | { camp: string; stage: "creeping" | "looting" | "escaping"; distance: number; bearing: number },
  /** The nearest scavenger carrying treasure off, when it is close enough to catch. */
  hauler: null as null | { item: string; camp: string; distance: number; bearing: number },
};

export type ScavengerMarker = "raider" | "hauler" | "forager" | "gunner";
export const scavengerMap = { agents: [] as { x: number; z: number; kind: ScavengerMarker }[] };

export function resetScavengerHud() {
  scavengerHud.raid = null;
  scavengerHud.hauler = null;
  scavengerMap.agents = [];
}
