// ---- World Region Definitions ----

export interface WorldRegion {
  id: "pyrrhia" | "pantala" | "glaeryus";
  name: string;
  description: string;
  lore: string;
  color: string;
  groundColor: string;
  textColor: string;
  beaconColor: string;
  beaconPosition: [number, number, number];
}

export const WORLD_REGIONS: WorldRegion[] = [
  {
    id: "pyrrhia",
    name: "Pyrrhia",
    description: "Ancient forested highlands.",
    lore: "The oldest dragon territories stretch across Pyrrhia's green valleys. Beacon networks here have burned since before recorded memory.",
    color: "#4caf50",
    groundColor: "#3f8a4b",
    textColor: "#b2ffb7",
    beaconColor: "#ffd700",
    beaconPosition: [-30, 0, -100],
  },
  {
    id: "pantala",
    name: "Pantala",
    description: "Sun-scorched eastlands where trade routes crossed for millennia.",
    lore: "Pantala's burning winds carry sand from a hundred collapsed civilizations. The eastern beacon towers still glow despite centuries of neglect.",
    color: "#ffa726",
    groundColor: "#b88c3a",
    textColor: "#ffe0a0",
    beaconColor: "#ff8c00",
    beaconPosition: [130, 0, 90],
  },
  {
    id: "glaeryus",
    name: "Glaeryus",
    description: "Fractured stone highlands of the northern tribes.",
    lore: "Glaeryus dragons carved their cities into solid basalt. The skies here are always overcast, yet the beacons burn cold blue for a hundred miles.",
    color: "#78909c",
    groundColor: "#3e4b52",
    textColor: "#b0d0e0",
    beaconColor: "#44bbff",
    beaconPosition: [-130, 0, 90],
  },
];

/**
 * Returns which region the player is in based on world X/Z coordinates.
 *
 * Layout (top-down, Z increases southward):
 *   Pyrrhia  — z ≤ 30  (wide northern strip across the full world)
 *   Pantala  — z > 30, x ≥ 0  (southeastern sector)
 *   Glaeryus — z > 30, x < 0  (southwestern sector)
 */
export function getRegionAtPos(x: number, z: number): WorldRegion {
  if (z <= 30) return WORLD_REGIONS[0]; // Pyrrhia
  if (x >= 0) return WORLD_REGIONS[1];  // Pantala
  return WORLD_REGIONS[2];              // Glaeryus
}
