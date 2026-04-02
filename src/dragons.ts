import * as THREE from "three";

export type AttackStyle =
  | "fireball" // standard fireball
  | "frostbreath" // slow, large, icy
  | "venom" // arcing green globs
  | "flamesilk" // fast, thin, bright trails
  | "decay" // slow, large, dark with lingering AOE
  | "shards" // triple-shot ice/bone shards
  | "stinger" // fast, tiny, rapid-fire darts
  | "sonic" // invisible shockwave (large, fast, transparent)
  | "thorns"; // arcing thorny projectiles

export type AbilityType =
  | "boost" // burst of forward speed
  | "barrel_roll" // spinning dodge (brief invulnerability visual)
  | "ground_slam" // dive bomb — impulse downward + shockwave on land
  | "cloak" // semi-transparent for a few seconds
  | "heal" // flash green, placeholder for future HP
  | "scatter_shot" // fires 8 projectiles in a ring around the dragon
  | "updraft"; // instant altitude gain

export interface AttackConfig {
  style: AttackStyle;
  color1: string; // primary projectile color
  color2: string; // emissive / secondary color
  projectileSize: number; // radius multiplier (1.0 = default 0.6)
  projectileSpeed: number; // velocity multiplier (1.0 = default 50)
  spread: number; // 0 = single shot, >0 = multi-shot cone angle in radians
  count: number; // projectiles per shot (1 = single, 3 = triple, etc.)
  gravity: number; // 0 = no gravity, 1 = full gravity on projectile
  lifetime: number; // seconds before despawn
}

export interface AbilityConfig {
  type: AbilityType;
  cooldown: number; // seconds between uses
  duration: number; // seconds the effect lasts (0 = instant)
  label: string; // button label
}

export interface DragonType {
  id: string;
  name: string;
  tribe: "pyrrhia" | "pantala" | "glaeryus";
  description: string;
  colors: {
    body: string;
    bodyDark: string;
    belly: string;
    wing: string;
    eye: string;
    horn: string;
    spike: string;
  };
  effects?: {
    bodyEmissive?: string; // subtle glow on main body
    bodyEmissiveIntensity?: number;
    bodyMetalness?: number; // icy/metallic sheen
    bodyRoughness?: number;
    bellyEmissive?: string; // bioluminescent underbelly
    bellyEmissiveIntensity?: number;
    wingEmissive?: string; // glowing wing membranes
    wingEmissiveIntensity?: number;
    wingOpacity?: number; // 0.3 = ghostly, 1.0 = opaque
    clawMetalness?: number; // razor-sharp metallic claws
    eyeEmissiveIntensity?: number; // override eye glow strength
  };
  stats: {
    speed: number;
    firepower: number;
    agility: number;
    armor: number;
  };
  ability: string;
  attack: AttackConfig;
  special: AbilityConfig;
}

export const DRAGON_TYPES: DragonType[] = [
  // ===== PYRRHIA =====
  {
    id: "mudwing",
    name: "MudWing",
    tribe: "pyrrhia",
    description:
      "Tough and resilient, MudWings are armored swamp dragons with fire-resistant scales.",
    colors: {
      body: "#7A5C12",
      bodyDark: "#5A4008",
      belly: "#C8A850",
      wing: "#8B6B20",
      eye: "#E0B830",
      horn: "#3D2808",
      spike: "#3D2808",
    },
    effects: {
      bodyRoughness: 0.9, // rough, armored hide
      bodyMetalness: 0.0,
      clawMetalness: 0.3, // hardened mud-caked claws
      wingOpacity: 0.95, // thick, leathery wings
    },
    stats: { speed: 0.8, firepower: 0.9, agility: 0.7, armor: 1.4 },
    ability: "Fire Resistance",
    attack: {
      style: "fireball",
      color1: "#cc4400",
      color2: "#ff8800",
      projectileSize: 1.4,
      projectileSpeed: 0.8,
      spread: 0,
      count: 1,
      gravity: 0.3,
      lifetime: 4,
    },
    special: { type: "ground_slam", cooldown: 6, duration: 0, label: "SLAM" },
  },
  {
    id: "sandwing",
    name: "SandWing",
    tribe: "pyrrhia",
    description:
      "Desert-dwelling dragons with a venomous tail barb and heat resistance.",
    colors: {
      body: "#E8D5A0",
      bodyDark: "#C4B07A",
      belly: "#FFF0D0",
      wing: "#D4C48E",
      eye: "#1A1A1A",
      horn: "#8B7040",
      spike: "#8B7040",
    },
    effects: {
      bodyRoughness: 0.5, // smooth sun-baked scales
      bodyMetalness: 0.08, // faint sandy shimmer
      wingOpacity: 0.82, // thin desert membrane
      clawMetalness: 0.4, // sharp venomous barb
    },
    stats: { speed: 1.1, firepower: 0.8, agility: 1.0, armor: 0.9 },
    ability: "Venomous Barb",
    attack: {
      style: "stinger",
      color1: "#cccc00",
      color2: "#aaff00",
      projectileSize: 0.4,
      projectileSpeed: 1.5,
      spread: 0,
      count: 1,
      gravity: 0,
      lifetime: 2,
    },
    special: { type: "boost", cooldown: 4, duration: 1.5, label: "DASH" },
  },
  {
    id: "skywing",
    name: "SkyWing",
    tribe: "pyrrhia",
    description:
      "The fastest fliers, SkyWings dominate the skies with blazing speed and fire.",
    colors: {
      body: "#CC3300",
      bodyDark: "#991A00",
      belly: "#FF8C00",
      wing: "#E04010",
      eye: "#FFD700",
      horn: "#5C2800",
      spike: "#5C2800",
    },
    effects: {
      bodyEmissive: "#FF2200", // smoldering heat radiating from scales
      bodyEmissiveIntensity: 0.08,
      wingEmissive: "#FF4400", // veins of fire visible through wing membrane
      wingEmissiveIntensity: 0.15,
      wingOpacity: 0.75, // thin, translucent fiery wings
      eyeEmissiveIntensity: 1.2, // piercing golden eyes
    },
    stats: { speed: 1.4, firepower: 1.2, agility: 1.1, armor: 0.6 },
    ability: "Blazing Speed",
    attack: {
      style: "fireball",
      color1: "#ff3300",
      color2: "#ffaa00",
      projectileSize: 1.0,
      projectileSpeed: 1.3,
      spread: 0,
      count: 1,
      gravity: 0,
      lifetime: 3,
    },
    special: { type: "boost", cooldown: 3, duration: 2.0, label: "BLAZE" },
  },
  {
    id: "seawing",
    name: "SeaWing",
    tribe: "pyrrhia",
    description:
      "Aquatic dragons with bioluminescent scales and powerful underwater abilities.",
    colors: {
      body: "#0E7070",
      bodyDark: "#0A5050",
      belly: "#30B898",
      wing: "#18A0A0",
      eye: "#00FF88",
      horn: "#084040",
      spike: "#40E0D0",
    },
    effects: {
      bodyEmissive: "#00AA66", // bioluminescent stripe glow
      bodyEmissiveIntensity: 0.12,
      bellyEmissive: "#00FFAA", // bright bioluminescent underbelly
      bellyEmissiveIntensity: 0.25,
      wingEmissive: "#00DDAA", // glowing aqua veins in wings
      wingEmissiveIntensity: 0.2,
      wingOpacity: 0.7, // semi-transparent aquatic membrane
      eyeEmissiveIntensity: 1.5, // bright bioluminescent eyes
    },
    stats: { speed: 1.0, firepower: 0.7, agility: 1.2, armor: 1.0 },
    ability: "Bioluminescence",
    attack: {
      style: "sonic",
      color1: "#00ffaa",
      color2: "#00ff88",
      projectileSize: 2.0,
      projectileSpeed: 1.0,
      spread: 0,
      count: 1,
      gravity: 0,
      lifetime: 1.5,
    },
    special: { type: "scatter_shot", cooldown: 5, duration: 0, label: "PULSE" },
  },
  {
    id: "icewing",
    name: "IceWing",
    tribe: "pyrrhia",
    description:
      "Arctic predators that breathe deadly frostbreath instead of fire.",
    colors: {
      body: "#C8E0F0",
      bodyDark: "#A0C0D8",
      belly: "#E8F4FF",
      wing: "#B0D0E8",
      eye: "#3355CC",
      horn: "#D0E8F8",
      spike: "#E0F0FF",
    },
    effects: {
      bodyMetalness: 0.35, // icy crystalline sheen
      bodyRoughness: 0.25, // smooth polished ice scales
      bodyEmissive: "#AADDFF", // subtle cold glow
      bodyEmissiveIntensity: 0.05,
      wingOpacity: 0.6, // thin, icy transparent wings
      wingEmissive: "#CCEEFF",
      wingEmissiveIntensity: 0.1,
      clawMetalness: 0.6, // razor-sharp ice talons
      eyeEmissiveIntensity: 0.8,
    },
    stats: { speed: 1.0, firepower: 1.1, agility: 0.9, armor: 1.1 },
    ability: "Frostbreath",
    attack: {
      style: "frostbreath",
      color1: "#aaddff",
      color2: "#eeffff",
      projectileSize: 1.6,
      projectileSpeed: 0.7,
      spread: 0.3,
      count: 3,
      gravity: 0,
      lifetime: 2.5,
    },
    special: { type: "updraft", cooldown: 4, duration: 0, label: "GUST" },
  },
  {
    id: "rainwing",
    name: "RainWing",
    tribe: "pyrrhia",
    description: "Color-shifting jungle dragons that spit corrosive venom.",
    colors: {
      body: "#28B828",
      bodyDark: "#1A8B1A",
      belly: "#FFD700",
      wing: "#FF44AA",
      eye: "#FF6600",
      horn: "#2E8B57",
      spike: "#AA44FF",
    },
    effects: {
      bodyEmissive: "#44FF44", // color-shifting iridescence
      bodyEmissiveIntensity: 0.1,
      bellyEmissive: "#FFCC00", // bright tropical underbelly
      bellyEmissiveIntensity: 0.15,
      wingEmissive: "#FF66CC", // vivid rainbow wing glow
      wingEmissiveIntensity: 0.2,
      wingOpacity: 0.65, // delicate rainforest membrane
      eyeEmissiveIntensity: 1.0,
    },
    stats: { speed: 0.9, firepower: 1.0, agility: 1.4, armor: 0.6 },
    ability: "Venom Spit",
    attack: {
      style: "venom",
      color1: "#33cc00",
      color2: "#aaff00",
      projectileSize: 0.8,
      projectileSpeed: 0.9,
      spread: 0.15,
      count: 2,
      gravity: 0.6,
      lifetime: 3,
    },
    special: { type: "cloak", cooldown: 8, duration: 3.0, label: "CLOAK" },
  },
  {
    id: "nightwing",
    name: "NightWing",
    tribe: "pyrrhia",
    description:
      "Mysterious dark-scaled dragons said to possess mind-reading powers.",
    colors: {
      body: "#1A1A28",
      bodyDark: "#101018",
      belly: "#252540",
      wing: "#202038",
      eye: "#AA55FF",
      horn: "#404058",
      spike: "#C0C0E0",
    },
    effects: {
      bodyEmissive: "#220044", // deep cosmic purple undertone
      bodyEmissiveIntensity: 0.06,
      wingEmissive: "#6633AA", // scattered silver-star wing membrane
      wingEmissiveIntensity: 0.18,
      wingOpacity: 0.55, // near-invisible dark wings
      bodyMetalness: 0.12, // faint starlight on scales
      eyeEmissiveIntensity: 1.8, // piercing prophetic gaze
    },
    stats: { speed: 1.0, firepower: 1.0, agility: 1.0, armor: 1.0 },
    ability: "Mind Reading",
    attack: {
      style: "fireball",
      color1: "#6600cc",
      color2: "#aa44ff",
      projectileSize: 1.0,
      projectileSpeed: 1.0,
      spread: 0,
      count: 1,
      gravity: 0,
      lifetime: 3,
    },
    special: { type: "cloak", cooldown: 6, duration: 2.5, label: "VANISH" },
  },

  // ===== PANTALA =====
  {
    id: "hivewing",
    name: "HiveWing",
    tribe: "pantala",
    description:
      "Insectoid warriors with venomous stingers and razor-sharp claws.",
    colors: {
      body: "#CC8800",
      bodyDark: "#AA6600",
      belly: "#FFD700",
      wing: "#DDB020",
      eye: "#FF0000",
      horn: "#1A1A1A",
      spike: "#1A1A1A",
    },
    effects: {
      bodyEmissive: "#AA6600", // warm amber chitin glow
      bodyEmissiveIntensity: 0.06,
      wingOpacity: 0.78, // thin insect wings
      wingEmissive: "#FFAA00",
      wingEmissiveIntensity: 0.08,
      clawMetalness: 0.5, // sharp black chitin stingers
      eyeEmissiveIntensity: 1.4, // menacing red compound eyes
    },
    stats: { speed: 1.1, firepower: 0.8, agility: 1.1, armor: 1.0 },
    ability: "Nerve Toxin",
    attack: {
      style: "stinger",
      color1: "#ff4400",
      color2: "#ffaa00",
      projectileSize: 0.3,
      projectileSpeed: 1.8,
      spread: 0.1,
      count: 3,
      gravity: 0,
      lifetime: 1.5,
    },
    special: { type: "scatter_shot", cooldown: 5, duration: 0, label: "SWARM" },
  },
  {
    id: "silkwing",
    name: "SilkWing",
    tribe: "pantala",
    description:
      "Graceful dragons that spin flamesilk threads of burning light.",
    colors: {
      body: "#9B7BB8",
      bodyDark: "#7B5B98",
      belly: "#D8C0F0",
      wing: "#C8A0E8",
      eye: "#5030A0",
      horn: "#E0D0F0",
      spike: "#E0D0F0",
    },
    effects: {
      bodyEmissive: "#8866CC", // soft lavender silk sheen
      bodyEmissiveIntensity: 0.05,
      wingEmissive: "#FF8800", // flamesilk burning through wings
      wingEmissiveIntensity: 0.25,
      wingOpacity: 0.5, // gossamer butterfly-thin wings
      bodyMetalness: 0.15, // iridescent silk-like scales
      bodyRoughness: 0.35,
    },
    stats: { speed: 0.9, firepower: 1.3, agility: 1.2, armor: 0.6 },
    ability: "Flamesilk",
    attack: {
      style: "flamesilk",
      color1: "#ff6600",
      color2: "#ffdd00",
      projectileSize: 0.5,
      projectileSpeed: 1.4,
      spread: 0,
      count: 1,
      gravity: 0,
      lifetime: 4,
    },
    special: { type: "barrel_roll", cooldown: 3, duration: 0.6, label: "SPIN" },
  },
  {
    id: "leafwing",
    name: "LeafWing",
    tribe: "pantala",
    description: "Plant-controlling forest guardians with leaf-shaped wings.",
    colors: {
      body: "#2D6B2D",
      bodyDark: "#1D4B1D",
      belly: "#7DB85D",
      wing: "#3D7B3D",
      eye: "#C8E020",
      horn: "#5D4A1A",
      spike: "#6D9A4D",
    },
    effects: {
      bodyEmissive: "#225522", // living chlorophyll in scales
      bodyEmissiveIntensity: 0.08,
      bellyEmissive: "#66AA33", // photosynthetic underbelly
      bellyEmissiveIntensity: 0.1,
      wingEmissive: "#338833", // leaf-vein patterns in wings
      wingEmissiveIntensity: 0.12,
      wingOpacity: 0.72, // leaf-like translucency
      bodyRoughness: 0.85, // bark-like texture
    },
    stats: { speed: 0.8, firepower: 0.7, agility: 1.0, armor: 1.3 },
    ability: "Leafspeak",
    attack: {
      style: "thorns",
      color1: "#336600",
      color2: "#66aa00",
      projectileSize: 0.6,
      projectileSpeed: 1.0,
      spread: 0.2,
      count: 3,
      gravity: 0.4,
      lifetime: 3,
    },
    special: { type: "heal", cooldown: 10, duration: 0, label: "HEAL" },
  },

  // ===== GLAERYUS =====
  {
    id: "ricewing",
    name: "RiceWing",
    tribe: "glaeryus",
    description:
      "Elegant pale dragons with jade-tipped wings and swift strikes.",
    colors: {
      body: "#F0EBD8",
      bodyDark: "#D8D0B8",
      belly: "#FFF8E8",
      wing: "#88B878",
      eye: "#4A8040",
      horn: "#C8B898",
      spike: "#A0C890",
    },
    effects: {
      bodyMetalness: 0.1, // smooth porcelain scales
      bodyRoughness: 0.3,
      wingOpacity: 0.6, // delicate jade-tipped membranes
      wingEmissive: "#88CC88",
      wingEmissiveIntensity: 0.08,
    },
    stats: { speed: 1.2, firepower: 0.7, agility: 1.3, armor: 0.7 },
    ability: "Wind Dash",
    attack: {
      style: "sonic",
      color1: "#ccddaa",
      color2: "#eeffcc",
      projectileSize: 1.5,
      projectileSpeed: 1.6,
      spread: 0,
      count: 1,
      gravity: 0,
      lifetime: 1.0,
    },
    special: { type: "boost", cooldown: 2.5, duration: 1.0, label: "WIND" },
  },
  {
    id: "acewing",
    name: "AceWing",
    tribe: "glaeryus",
    description: "Sky-blue aerial acrobats known for impossible maneuvers.",
    colors: {
      body: "#5BA0C8",
      bodyDark: "#4080A8",
      belly: "#90D0F0",
      wing: "#70B8E0",
      eye: "#00FF66",
      horn: "#3A7898",
      spike: "#40C8A0",
    },
    effects: {
      bodyMetalness: 0.2, // sky-chrome aerodynamic scales
      bodyRoughness: 0.3,
      wingOpacity: 0.55, // ultra-thin speed wings
      wingEmissive: "#66CCFF",
      wingEmissiveIntensity: 0.12,
      eyeEmissiveIntensity: 1.2, // vivid targeting HUD eyes
    },
    stats: { speed: 1.3, firepower: 0.6, agility: 1.4, armor: 0.6 },
    ability: "Barrel Roll",
    attack: {
      style: "shards",
      color1: "#44bbee",
      color2: "#88eeff",
      projectileSize: 0.4,
      projectileSpeed: 1.5,
      spread: 0.25,
      count: 3,
      gravity: 0,
      lifetime: 2,
    },
    special: { type: "barrel_roll", cooldown: 2, duration: 0.5, label: "ROLL" },
  },
  {
    id: "bladewing",
    name: "BladeWing",
    tribe: "glaeryus",
    description:
      "Armored dragons with razor-edged scales that slice through anything.",
    colors: {
      body: "#7A7A38",
      bodyDark: "#5A5A28",
      belly: "#A09850",
      wing: "#909030",
      eye: "#DDDD30",
      horn: "#505020",
      spike: "#909040",
    },
    effects: {
      bodyMetalness: 0.45, // razor blade-like metallic scales
      bodyRoughness: 0.4,
      clawMetalness: 0.7, // brutally sharp metal talons
      wingOpacity: 0.85, // armored thick wings
      bodyEmissive: "#888830",
      bodyEmissiveIntensity: 0.04,
    },
    stats: { speed: 0.9, firepower: 0.8, agility: 0.8, armor: 1.5 },
    ability: "Razor Scales",
    attack: {
      style: "shards",
      color1: "#aaaa44",
      color2: "#dddd66",
      projectileSize: 0.5,
      projectileSpeed: 1.3,
      spread: 0.15,
      count: 3,
      gravity: 0,
      lifetime: 2.5,
    },
    special: { type: "scatter_shot", cooldown: 5, duration: 0, label: "SHRED" },
  },
  {
    id: "bonewing",
    name: "BoneWing",
    tribe: "glaeryus",
    description:
      "Skeletal-looking dragons that exhale a withering decay breath.",
    colors: {
      body: "#6A5B40",
      bodyDark: "#4A3B20",
      belly: "#8A7850",
      wing: "#7B6B50",
      eye: "#FF2020",
      horn: "#3A2B10",
      spike: "#5A4B30",
    },
    effects: {
      bodyEmissive: "#442200", // necrotic energy seeping through cracks
      bodyEmissiveIntensity: 0.1,
      wingEmissive: "#663300", // decaying membrane with sickly glow
      wingEmissiveIntensity: 0.15,
      wingOpacity: 0.6, // tattered, translucent wings
      bodyRoughness: 0.95, // cracked bone-like texture
      eyeEmissiveIntensity: 2.0, // burning undead eyes
    },
    stats: { speed: 0.8, firepower: 1.4, agility: 0.7, armor: 1.2 },
    ability: "Decay Breath",
    attack: {
      style: "decay",
      color1: "#443322",
      color2: "#886644",
      projectileSize: 1.8,
      projectileSpeed: 0.6,
      spread: 0.2,
      count: 2,
      gravity: 0.2,
      lifetime: 5,
    },
    special: { type: "ground_slam", cooldown: 7, duration: 0, label: "WITHER" },
  },
  {
    id: "hivewing2",
    name: "HiveWing II",
    tribe: "glaeryus",
    description:
      "A darker evolution of the HiveWing, with enhanced venom and stealth.",
    colors: {
      body: "#1A1A1A",
      bodyDark: "#0A0A0A",
      belly: "#282820",
      wing: "#252520",
      eye: "#FFD700",
      horn: "#0A0A0A",
      spike: "#DAA520",
    },
    effects: {
      bodyEmissive: "#110011", // void-like darkness
      bodyEmissiveIntensity: 0.03,
      wingEmissive: "#AA00FF", // toxic purple venom veins in wings
      wingEmissiveIntensity: 0.2,
      wingOpacity: 0.45, // near-invisible shadow wings
      bodyMetalness: 0.08,
      eyeEmissiveIntensity: 2.0, // glowing predator eyes
    },
    stats: { speed: 1.1, firepower: 1.1, agility: 1.0, armor: 0.9 },
    ability: "Shadow Venom",
    attack: {
      style: "venom",
      color1: "#220044",
      color2: "#aa00ff",
      projectileSize: 0.7,
      projectileSpeed: 1.2,
      spread: 0.1,
      count: 2,
      gravity: 0.3,
      lifetime: 3,
    },
    special: { type: "cloak", cooldown: 6, duration: 3.0, label: "SHADOW" },
  },
];

export const TRIBES: { id: string; name: string; color: string }[] = [
  { id: "pyrrhia", name: "Pyrrhia", color: "#E8B0B0" },
  { id: "pantala", name: "Pantala", color: "#D0E8B0" },
  { id: "glaeryus", name: "Glaeryus", color: "#B0C8E8" },
];

// Cached THREE.Color to avoid per-frame allocations
const _tmpColor = new THREE.Color();
const _tmpHSL = { h: 0, s: 0, l: 0 };

/**
 * Animate per-dragon material effects each frame.
 * Call from useFrame with the cached mesh list, elapsed time, and dragon effects.
 * Only modifies properties that have animated values — skips entirely if no effects.
 */
export function animateDragonEffects(
  meshes: THREE.Mesh[],
  effects: DragonType["effects"] | undefined,
  dragonId: string,
  elapsed: number,
) {
  if (!effects) return;

  // Pulse frequency varies by dragon personality
  const slow = Math.sin(elapsed * 1.5) * 0.5 + 0.5; // 0–1, ~1.5 Hz
  const med = Math.sin(elapsed * 2.5) * 0.5 + 0.5; // 0–1, ~2.5 Hz
  const fast = Math.sin(elapsed * 4.0) * 0.5 + 0.5; // 0–1, ~4 Hz

  for (const mesh of meshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mat?.isMeshStandardMaterial) continue;
    const matName = mat.name;

    switch (matName) {
      case "Main": {
        if (!effects.bodyEmissive) break;
        const base = effects.bodyEmissiveIntensity ?? 0.3;
        // RainWing: cycle hue over time
        if (dragonId === "rainwing") {
          _tmpColor.setHSL((elapsed * 0.1) % 1, 0.7, 0.45);
          mat.emissive.copy(_tmpColor);
          mat.emissiveIntensity = base + slow * 0.15;
        } else {
          mat.emissiveIntensity = base + slow * base * 0.5;
        }
        break;
      }
      case "Wings": {
        if (!effects.wingEmissive) break;
        const base = effects.wingEmissiveIntensity ?? 0.3;
        if (dragonId === "rainwing") {
          _tmpColor.setHSL((elapsed * 0.1 + 0.33) % 1, 0.8, 0.5);
          mat.emissive.copy(_tmpColor);
          mat.emissiveIntensity = base + med * 0.2;
        } else if (dragonId === "nightwing" || dragonId === "hivewing2") {
          // Twinkling star / venom pulse
          mat.emissiveIntensity = base + fast * base * 0.6;
        } else if (dragonId === "silkwing") {
          // Flickering flamesilk
          mat.emissiveIntensity = base + Math.random() * 0.1 + fast * 0.15;
        } else {
          mat.emissiveIntensity = base + med * base * 0.4;
        }
        break;
      }
      case "Belly": {
        if (!effects.bellyEmissive) break;
        const base = effects.bellyEmissiveIntensity ?? 0.3;
        if (dragonId === "seawing") {
          // Bioluminescent pulse — slower, deeper
          mat.emissiveIntensity = base + slow * base * 0.8;
        } else if (dragonId === "rainwing") {
          _tmpColor.set(effects.bellyEmissive!);
          _tmpColor.getHSL(_tmpHSL);
          _tmpColor.setHSL(
            (_tmpHSL.h + elapsed * 0.05) % 1,
            _tmpHSL.s,
            _tmpHSL.l,
          );
          mat.emissive.copy(_tmpColor);
          mat.emissiveIntensity = base + slow * 0.1;
        } else {
          mat.emissiveIntensity = base + med * base * 0.3;
        }
        break;
      }
      case "Eyes": {
        const base = effects.eyeEmissiveIntensity ?? 0.6;
        // All eyes with custom intensity get a subtle pulse
        if (effects.eyeEmissiveIntensity) {
          mat.emissiveIntensity = base + fast * 0.2;
        }
        break;
      }
    }
  }
}

/**
 * Color a dragon.glb scene's meshes based on a DragonType color palette.
 *
 * littleDragon.glb mesh layout (matched by material name):
 *   Main   — body mesh & eye socket  → body color
 *   Wings  — wing membrane           → wing color (translucent)
 *   Belly  — underbelly              → belly color
 *   Claws  — claws/horns             → horn color
 *   Eyes   — eye primitives          → eye color (emissive)
 */
export function colorDragonModel(
  scene: THREE.Object3D,
  colors: DragonType["colors"],
  effects?: DragonType["effects"],
) {
  const fx = effects ?? {};
  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    mesh.castShadow = true;

    const matName = (mesh.material as THREE.MeshStandardMaterial)?.name ?? "";

    switch (matName) {
      case "Main": // body & eye socket
        mesh.material = new THREE.MeshStandardMaterial({
          name: "Main",
          color: colors.body,
          roughness: fx.bodyRoughness ?? 0.7,
          metalness: fx.bodyMetalness ?? 0.05,
          ...(fx.bodyEmissive && {
            emissive: fx.bodyEmissive,
            emissiveIntensity: fx.bodyEmissiveIntensity ?? 0.3,
          }),
        });
        break;

      case "Wings": // wing membrane
        mesh.material = new THREE.MeshStandardMaterial({
          name: "Wings",
          color: colors.wing,
          roughness: 0.6,
          metalness: 0.0,
          transparent: true,
          opacity: fx.wingOpacity ?? 0.88,
          side: THREE.DoubleSide,
          ...(fx.wingEmissive && {
            emissive: fx.wingEmissive,
            emissiveIntensity: fx.wingEmissiveIntensity ?? 0.3,
          }),
        });
        break;

      case "Belly": // underbelly
        mesh.material = new THREE.MeshStandardMaterial({
          name: "Belly",
          color: colors.belly,
          roughness: 0.65,
          metalness: 0.02,
          ...(fx.bellyEmissive && {
            emissive: fx.bellyEmissive,
            emissiveIntensity: fx.bellyEmissiveIntensity ?? 0.3,
          }),
        });
        break;

      case "Claws": // claws and horns
        mesh.material = new THREE.MeshStandardMaterial({
          name: "Claws",
          color: colors.horn,
          roughness: 0.5,
          metalness: fx.clawMetalness ?? 0.15,
        });
        break;

      case "Eyes": // eyes
        mesh.material = new THREE.MeshStandardMaterial({
          name: "Eyes",
          color: colors.eye,
          emissive: colors.eye,
          emissiveIntensity: fx.eyeEmissiveIntensity ?? 0.6,
          roughness: 0.2,
          metalness: 0.3,
        });
        break;

      default: // fallback
        mesh.material = new THREE.MeshStandardMaterial({
          color: colors.body,
          roughness: 0.8,
        });
        break;
    }
  });
}
