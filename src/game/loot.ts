import { createPlantings, formationTop, regionalFormations, terrainHeight } from "./landscape.ts";
import { SEA_LEVEL, shorelineZ } from "./coast.ts";
import { seededRandom } from "./noise.ts";
import {
  CAMP_RADIUS, FROZEN_LAKE, GREAT_ARCH, GREAT_FALLS, HOME_LAKE, MUD_LEVEL, MUD_POOLS, OASIS, PADS, RAINFOREST_GIANTS, SCAVENGER_CAMPS, SEA_STACKS,
  VOLCANO, WORLD_BOUNDS,
} from "./world.ts";
import type { KingdomId } from "./world.ts";
import { inlandWater, ROYAL_HOARDS } from "./worldSites.ts";
import type { RoyalKingdom } from "./worldSites.ts";
import type { Vector3Like } from "./flight.ts";

export type TreasureKind =
  | "coins" | "goblet" | "crown" | "gem" | "chest" | "scroll" | "orb" | "idol" | "pearl"
  | "fruit" | "spool" | "kettle" | "boot" | "trinket" | "hourglass" | "harp" | "shield" | "sack";
export const TREASURE_KINDS: readonly TreasureKind[] = [
  "coins", "goblet", "crown", "gem", "chest", "scroll", "orb", "idol", "pearl",
  "fruit", "spool", "kettle", "boot", "trinket", "hourglass", "harp", "shield", "sack",
];
export type TreasureRarity = "junk" | "common" | "rare" | "legendary";
/** Ledges sit at a fixed height (`altitude`) on a landmark: an arch, a sea stack, a canopy platform. */
export type TreasurePerch = "ground" | "treetop" | "spire" | "sky" | "royal" | "ledge";
export type LootRegion = "pyrrhia" | "pantala" | "glaeryus";

export interface TreasureDef {
  id: string;
  name: string;
  kind: TreasureKind;
  region: LootRegion;
  value: number;
  /** 1 light, 2 heavy, 3 needs both talons. */
  weight: number;
  rarity: TreasureRarity;
  tags: readonly string[];
  /** Multiplies the model's own colors; white keeps them. */
  tint: string;
  lore: string;
  /** Unique treasures stay in the hoard once banked; common finds return every flight. */
  unique: boolean;
  perch: TreasurePerch;
  /** Requested x/z. Treetop and spire perches snap to the nearest real tree or formation. */
  at: readonly [number, number];
  /** Height above terrain for sky lanterns; the absolute height of a ledge. */
  altitude?: number;
  /** Crown treasure of a kingdom's royal hoard (`at` is then an offset from the hoard). Taking it alerts the kingdom. */
  royal?: RoyalKingdom;
  /** The kingdom it is found in, for treasure out beyond the home valley. */
  kingdom?: KingdomId;
  /** A sack of your own gold, carried off to this scavenger camp. Banking it wins the gold back. */
  stolenFrom?: string;
}

const unique = (
  id: string, name: string, kind: TreasureKind, region: LootRegion, value: number, weight: number,
  rarity: TreasureRarity, tags: string[], perch: TreasurePerch, at: [number, number], lore: string,
  tint = "#ffffff", altitude?: number,
): TreasureDef => ({ id, name, kind, region, value, weight, rarity, tags, tint, lore, unique: true, perch, at, altitude });

/** Hand-placed treasure: eight per region, from treetops and spires to drifting sky lanterns. */
export const TREASURES: readonly TreasureDef[] = [
  unique("moonglass_goblet", "Moonglass Goblet", "goblet", "pyrrhia", 120, 1, "rare", ["silver", "relic"], "sky", [62, -82], "Catches moonlight and refuses to give it back.", "#cfe6ff", 16),
  unique("mossy_crown", "Mossy Queen's Crown", "crown", "pyrrhia", 260, 1, "rare", ["gold", "crown"], "treetop", [-62, -38], "Lost by a queen who swore she'd never take it off. She took it off."),
  unique("perfect_mango", "The Perfect Mango", "fruit", "pyrrhia", 40, 1, "rare", ["fruit"], "treetop", [34, -132], "RainWings would trade a kingdom for it. Possibly two."),
  unique("lakeshore_pearl", "Lakeshore Pearl", "pearl", "pyrrhia", 150, 1, "rare", ["pearl"], "ground", [62, -52], "Big as an egg and twice as smug."),
  unique("scavenger_shield", "Dented Scavenger Shield", "shield", "pyrrhia", 90, 2, "common", ["relic", "scavenger"], "ground", [-22, -62], "Tiny, dented, and smells faintly of scavenger."),
  unique("ember_opal", "Ember Opal", "gem", "pyrrhia", 180, 1, "rare", ["gem", "fire"], "ground", [-140, -150], "Warm to the touch. Warmer if you're a SkyWing.", "#ff7a3d"),
  unique("unreadable_prophecy", "Unreadable Prophecy", "scroll", "pyrrhia", 140, 1, "rare", ["scroll"], "ground", [-24, -94], "Nobody can read it. Everybody wants it."),
  unique("hollow_oak_chest", "Hollow-Oak Chest", "chest", "pyrrhia", 420, 3, "legendary", ["gold", "chest", "relic"], "ground", [150, -40], "So heavy it takes both talons and a strong back."),

  unique("sunburst_scarab", "Sunburst Scarab", "idol", "pantala", 220, 1, "rare", ["gold", "relic"], "spire", [70, 95], "A golden beetle that never stops staring.", "#ffd56b"),
  unique("hive_amber", "Hive Amber", "gem", "pantala", 160, 1, "rare", ["gem", "amber"], "ground", [40, 62], "There's a very surprised bug inside.", "#ffb238"),
  unique("flamesilk_spool", "Flamesilk Spool", "spool", "pantala", 200, 1, "rare", ["silk", "fire"], "sky", [100, 150], "Glows like a sunset someone wound up and saved for later.", "#ffffff", 22),
  unique("dune_sapphire", "Dune Sapphire", "gem", "pantala", 190, 1, "rare", ["gem"], "ground", [172, 123], "Found where the dunes sing at night.", "#3f7bff"),
  unique("desert_sun_crown", "Desert Sun Crown", "crown", "pantala", 300, 1, "rare", ["gold", "crown"], "spire", [150, 60], "Seven points, one for each very hot day of the week.", "#ffe08a"),
  unique("rusty_kettle", "The Rusty Kettle", "kettle", "pantala", 5, 1, "junk", ["junk", "scavenger"], "ground", [22, 118], "Priceless, to exactly one scavenger."),
  unique("golden_hourglass", "Golden Hourglass", "hourglass", "pantala", 240, 2, "rare", ["gold", "relic"], "ground", [137, 97], "The sand flows upward when nobody's looking."),
  unique("sand_queen_strongbox", "Sand Queen's Strongbox", "chest", "pantala", 460, 3, "legendary", ["gold", "chest"], "ground", [60, 134], "Locked, heavy, and absolutely somebody else's.", "#ffe2b0"),

  unique("frost_sapphire", "Frost Sapphire", "gem", "glaeryus", 210, 1, "rare", ["gem", "ice"], "spire", [-60, 80], "Leaves frost on your claws. Worth it.", "#a8e6ff"),
  unique("basalt_idol", "Basalt Idol", "idol", "glaeryus", 170, 2, "rare", ["relic", "stone"], "ground", [-42, 107], "Carved by dragons who really liked carving themselves.", "#8d969c"),
  unique("glacier_orb", "Glacier Glass Orb", "orb", "glaeryus", 230, 1, "rare", ["ice", "orb"], "sky", [-100, 160], "Look inside and you'll see snow falling. Indoors.", "#bdf3ff", 24),
  unique("starlight_chart", "Starlight Chart", "scroll", "glaeryus", 160, 1, "rare", ["scroll", "sky"], "ground", [-123, 97], "A map of every star. Two are marked 'mine'.", "#c7d4ff"),
  unique("skyfire_shard", "Skyfire Shard", "gem", "glaeryus", 340, 1, "legendary", ["gem", "sky", "fire"], "sky", [-170, 60], "A piece of a falling star. It hums when you hold it.", "#c77dff", 32),
  unique("whistling_bone_harp", "Whistling Bone Harp", "harp", "glaeryus", 130, 1, "rare", ["bone", "relic"], "spire", [-150, 130], "Plays a tune whenever the wind is sad."),
  unique("lucky_boot", "Scavenger's Lucky Boot", "boot", "glaeryus", 3, 1, "junk", ["junk", "scavenger"], "ground", [-22, 62], "Just the left one. The lucky one, presumably."),
  unique("frozen_king_vault", "Frozen King's Vault", "chest", "glaeryus", 520, 3, "legendary", ["gold", "chest", "ice"], "ground", [-168, 133], "Iced shut for a thousand years. Bring both talons.", "#d8f1ff"),
];

/** Royal treasures lie on each kingdom's royal hoard, guarded by its champion. */
const royal = (id: string, name: string, kind: TreasureKind, region: LootRegion, value: number, weight: number, tags: string[], kingdom: RoyalKingdom, lore: string, tint: string): TreasureDef =>
  ({ id, name, kind, region, value, weight, rarity: "legendary", tags, tint, lore, unique: true, perch: "royal", at: [0.6, -0.4], royal: kingdom });

export const ROYAL_TREASURES: readonly TreasureDef[] = [
  royal("sky_ruby_crown", "The Queen's Ruby Crown", "crown", "pyrrhia", 560, 1, ["gold", "crown", "fire"], "sky", "The SkyWing queen's favourite. She has seventeen others, and she will still want this one back.", "#ff5a4a"),
  royal("ice_diadem", "Diadem of Endless Winter", "crown", "pyrrhia", 540, 1, ["crown", "ice", "gem"], "ice", "Cold enough to frost your claws through a glove you are not wearing.", "#bff0ff"),
  royal("mud_golden_idol", "The Golden Sibling", "idol", "pyrrhia", 480, 2, ["gold", "relic", "stone"], "mud", "A golden statue of the first MudWing big brother. Heavy. Loved. Guarded.", "#e0a83a"),
  royal("rain_sunlight_fruit", "The Sunlight Fruit", "fruit", "pyrrhia", 260, 1, ["fruit"], "rainforest", "It glows. RainWings say one bite feels like a whole afternoon of sunbathing.", "#ffd34a"),
  royal("sand_eye_of_dunes", "Eye of the Dunes", "orb", "pyrrhia", 600, 1, ["gold", "orb", "relic"], "sand", "Whoever holds it can see across the whole desert. Or so the Scorpion Den sells it.", "#ffcc66"),
  royal("pantala_hive_book", "Book of the Hive", "scroll", "pantala", 500, 1, ["scroll", "amber"], "pantala", "Every page is a map of the hives. Some of the maps are of hives that do not exist yet.", "#e8b84a"),
  royal("glaeryus_war_helm", "Obsidian War Shield", "shield", "glaeryus", 520, 2, ["relic", "stone"], "glaeryus", "Forged from volcanic glass by dragons who never lost a battle. They lost the war.", "#4a4a5e"),
  royal("sea_deep_pearl", "Pearl of the Deep Tide", "pearl", "glaeryus", 560, 1, ["pearl"], "sea", "The SeaWing admiral swears it hums with the tide. It does, a little.", "#bff6ff"),
];

/** The Sky, Ice, Mud, Rain, Sand, and Sea kingdoms all belong to Pyrrhia; the rest are their own continents. */
const regionFor = (kingdom: KingdomId): LootRegion => kingdom === "pantala" ? "pantala" : kingdom === "glaeryus" ? "glaeryus" : "pyrrhia";
const found = (
  kingdom: KingdomId, id: string, name: string, kind: TreasureKind, value: number, weight: number, rarity: TreasureRarity,
  tags: string[], perch: TreasurePerch, at: [number, number], lore: string, tint = "#ffffff", altitude?: number,
): TreasureDef => ({ id, name, kind, region: regionFor(kingdom), value, weight, rarity, tags, tint, lore, unique: true, perch, at, altitude, kingdom });

/** The top of the Great Arch, where the curve of the stone is flattest. */
function archTop() {
  const radius = GREAT_ARCH.span / 2;
  const ground = Math.min(terrainHeight(GREAT_ARCH.x - radius, GREAT_ARCH.z, "open"), terrainHeight(GREAT_ARCH.x + radius, GREAT_ARCH.z, "open"));
  return ground + GREAT_ARCH.height + 0.35;
}
/** The upper platform of the tallest canopy giant (see Landmarks), a few steps out from the trunk. */
function canopyPlatform() {
  const tree = RAINFOREST_GIANTS[1];
  return { x: tree.x + 4.5, z: tree.z, y: terrainHeight(tree.x, tree.z, "open") + tree.height * 0.66 + 0.3 };
}
const CANOPY = canopyPlatform();
const CORAL_STACK = SEA_STACKS[3], GALLEON_STACK = SEA_STACKS[6];

/** Three treasures in each kingdom, out where rival patrols and scavengers make them harder to win. */
export const KINGDOM_TREASURES: readonly TreasureDef[] = [
  found("sky", "sky_phoenix_goblet", "Phoenix-Feather Goblet", "goblet", 330, 1, "rare", ["gold", "fire"], "sky", [VOLCANO.x, VOLCANO.z], "Drifts on the volcano's heat. Some say it refills itself with fire.", "#ff8a3d", 62),
  found("sky", "sky_arena_shield", "Arena Victor's Shield", "shield", 260, 2, "rare", ["relic", "fire"], "ground", [20, -560], "Won by the last dragon standing in the SkyWing arena. It still has teeth marks.", "#ff6a4a"),
  found("sky", "sky_ember_egg", "Ember Egg", "orb", 300, 1, "rare", ["gem", "fire"], "ground", [150, -700], "Warm as a fresh hatchling. Hopefully it is not one.", "#ff5a1f"),

  found("ice", "ice_aurora_orb", "Aurora Orb", "orb", 320, 1, "rare", ["ice", "orb", "sky"], "sky", [-520, -650], "Holds a scrap of the northern lights. It flickers when IceWings sing.", "#7dffcf", 24),
  found("ice", "ice_icicle_harp", "Icicle Harp", "harp", 240, 1, "rare", ["ice", "relic"], "ground", [-430, -610], "Its strings are frozen music. Play gently.", "#cfefff"),
  found("ice", "ice_tundra_vault", "Tundra Strongbox", "chest", 580, 3, "legendary", ["ice", "chest", "gold"], "ground", [-660, -860], "Buried by an IceWing queen who forgot where. Both talons, and quickly.", "#d8f1ff"),

  found("mud", "mud_bog_pearl", "Bog Pearl", "pearl", 220, 1, "rare", ["pearl", "stone"], "ground", [-600, -250], "Muddy on the outside, perfect on the inside.", "#d8c49a"),
  found("mud", "mud_battle_shield", "Big Brother's Battle Shield", "shield", 280, 2, "rare", ["relic", "stone"], "ground", [-505, -165], "Carried by a MudWing who stood in front of his siblings in every fight.", "#b0794a"),
  found("mud", "mud_marsh_idol", "Marsh-Light Idol", "idol", 260, 1, "rare", ["relic", "stone"], "sky", [-640, -320], "Floats over the marsh at night. MudWings swear it is just a very bright frog.", "#9fe08a", 18),

  found("rainforest", "rain_golden_bananas", "Golden Banana Bunch", "fruit", 70, 1, "rare", ["fruit", "gold"], "ledge", [CANOPY.x, CANOPY.z], "Seven perfect bananas, gilded by a RainWing with too much free time.", "#ffe14a", CANOPY.y),
  found("rainforest", "rain_waterfall_opal", "Waterfall Opal", "gem", 280, 1, "rare", ["gem"], "ground", [560, -540], "Polished by a thousand years of falling water.", "#7de0ff"),
  found("rainforest", "rain_star_scroll", "NightWing Star Scroll", "scroll", 300, 1, "rare", ["scroll", "sky"], "sky", [GREAT_FALLS.pool.x, GREAT_FALLS.pool.z - 13], "Maps every star over the rainforest. A NightWing wrote DO NOT TOUCH on it. Twice.", "#b8a8ff", 44),

  found("sand", "sand_mirage_hourglass", "Mirage Hourglass", "hourglass", 340, 2, "rare", ["gold", "relic"], "ledge", [GREAT_ARCH.x, GREAT_ARCH.z], "Balanced on top of the arch, where nobody can reach it. Nobody but you.", "#ffd27a", archTop()),
  found("sand", "sand_oasis_sapphire", "Oasis Sapphire", "gem", 260, 1, "rare", ["gem"], "ground", [621, -102], "Dropped by a SandWing who stopped for a drink and forgot everything else.", "#3fa0ff"),
  found("sand", "sand_giant_fang", "Fang of the Fallen Giant", "idol", 300, 2, "rare", ["bone", "relic"], "ground", [600, -60], "One tooth from the biggest dragon that ever lived. It lies among its ribs.", "#f2e6c8"),

  found("pantala", "pantala_silkmoth_spool", "Silkmoth Spool", "spool", 280, 1, "rare", ["silk"], "sky", [520, 80], "Spun by a SilkWing who hums lullabies while she weaves.", "#ffd6f0", 22),
  found("pantala", "pantala_treehive_amber", "Treehive Amber", "gem", 260, 1, "rare", ["gem", "amber"], "ground", [420, 110], "A whole beetle family, frozen in the middle of an argument.", "#ffa62b"),
  found("pantala", "pantala_seed_vault", "LeafWing Seed Vault", "chest", 560, 3, "legendary", ["chest", "relic"], "ground", [560, -20], "Seeds of every tree that ever grew in Pantala. Heavy with forests.", "#9fd67a"),

  found("glaeryus", "glaeryus_rattle_harp", "BoneWing Rattle-Harp", "harp", 280, 1, "rare", ["bone", "relic"], "ground", [-560, 20], "Rattles when you fly. BoneWings call that music.", "#efe6d2"),
  found("glaeryus", "glaeryus_silver_teapot", "RiceWing Silver Teapot", "kettle", 240, 1, "rare", ["silver", "relic"], "ground", [-400, 100], "Polished so often you can see your own snout in it.", "#e6eef5"),
  found("glaeryus", "glaeryus_sky_compass", "AceWing Sky Compass", "orb", 300, 1, "rare", ["sky", "orb"], "sky", [-480, -60], "Always points to the nearest thermal. AceWings never fly without one.", "#9fc8ff", 24),

  found("sea", "sea_coral_crown", "Coral Crown", "crown", 340, 1, "rare", ["crown", "pearl"], "ledge", [CORAL_STACK.x, CORAL_STACK.z], "Grown, not forged. It is still growing.", "#ff8f8f", CORAL_STACK.top + 0.05),
  found("sea", "sea_galleon_chest", "Galleon Strongbox", "chest", 620, 3, "legendary", ["gold", "chest"], "ledge", [GALLEON_STACK.x, GALLEON_STACK.z], "A storm left it on top of a sea stack. How? Nobody knows. Whose? Yours now.", "#c9a46a", GALLEON_STACK.top + 0.05),
  found("sea", "sea_tide_pearl", "Tidecaller Pearl", "pearl", 300, 1, "rare", ["pearl"], "sky", [-80, 240], "Hums when the tide turns. SeaWings tune their songs to it.", "#bff6ff", 16),
];

/** Every unique treasure in the world: the home valley's, the royal hoards', then the kingdoms'. */
export const ALL_TREASURES: readonly TreasureDef[] = [...TREASURES, ...ROYAL_TREASURES, ...KINGDOM_TREASURES];
export const TREASURE_BY_ID: ReadonlyMap<string, TreasureDef> = new Map(ALL_TREASURES.map(def => [def.id, def]));

export function regionOf(x: number, z: number): LootRegion {
  if (z <= 30) return "pyrrhia";
  return x >= 0 ? "pantala" : "glaeryus";
}

export const HOARD_SITE = { x: 0, z: -13, radius: 7.5, height: 16 } as const;
export const LAKE = HOME_LAKE;
const BEACONS: readonly (readonly [number, number])[] = [[-30, -100], [130, 90], [-130, 90]];

const GEM_TINTS = ["#ff4f6d", "#4fd38a", "#ffcf4f", "#b77dff", "#5fb8ff"];
const TRINKETS = ["Bent Scavenger Spoon", "Odd Scavenger Sock", "Button Jar", "Cracked Teacup", "Tangle of String"];

/** Common finds return every flight from the same seeded spots. */
export function createCommonLoot(count = 30): TreasureDef[] {
  let seed = 90210;
  const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  const result: TreasureDef[] = [];
  for (let attempt = 0; attempt < count * 40 && result.length < count; attempt++) {
    const x = (random() - 0.5) * 360;
    const z = (random() - 0.5) * 360;
    const roll = random();
    const variant = random();
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius + 5) continue;
    // Keep clear of the surf: the southern sea would swallow anything on the wet sand.
    if (z > shorelineZ(x) - 14) continue;
    if (Math.hypot(x - HOARD_SITE.x, z - HOARD_SITE.z) < HOARD_SITE.radius + 8) continue;
    if (BEACONS.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 9)) continue;
    if (TREASURES.some(def => Math.hypot(x - def.at[0], z - def.at[1]) < 10)) continue;
    if (result.some(def => Math.hypot(x - def.at[0], z - def.at[1]) < 18)) continue;
    const id = `common_${result.length}`;
    const region = regionOf(x, z);
    if (roll < 0.55) {
      result.push({ id, name: variant < 0.5 ? "Coin Pouch" : "Scattered Coins", kind: "coins", region, value: 15 + Math.round(variant * 15), weight: 1, rarity: "common", tags: ["gold", "coins"], tint: "#ffffff", lore: "Shiny. Countable. Yours.", unique: false, perch: "ground", at: [x, z] });
    } else if (roll < 0.82) {
      result.push({ id, name: "Gem Shard", kind: "gem", region, value: 25, weight: 1, rarity: "common", tags: ["gem"], tint: GEM_TINTS[Math.floor(variant * GEM_TINTS.length) % GEM_TINTS.length], lore: "A sliver of something much bigger.", unique: false, perch: "ground", at: [x, z] });
    } else {
      result.push({ id, name: TRINKETS[Math.floor(variant * TRINKETS.length) % TRINKETS.length], kind: "trinket", region, value: 2, weight: 1, rarity: "junk", tags: ["junk", "scavenger"], tint: "#ffffff", lore: "Scavengers leave the strangest things lying around.", unique: false, perch: "ground", at: [x, z] });
    }
  }
  return result;
}

/** The home valley's common finds are scattered inside this box; the wild loot keeps out of it. */
const HOME_LOOT_BOX = { x: 215, minZ: -215, maxZ: 170 } as const;

/** Common finds scattered across the kingdoms, from the same seeded spots every flight. */
export function createWildLoot(count = 56): TreasureDef[] {
  const random = seededRandom(424242);
  const result: TreasureDef[] = [];
  const ground = (x: number, z: number) => terrainHeight(x, z, "open");
  for (let attempt = 0; attempt < count * 80 && result.length < count; attempt++) {
    const x = WORLD_BOUNDS.minX + 70 + random() * (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX - 140);
    const z = WORLD_BOUNDS.minZ + 70 + random() * (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ - 140);
    const roll = random();
    const variant = random();
    if (Math.abs(x) < HOME_LOOT_BOX.x && z > HOME_LOOT_BOX.minZ && z < HOME_LOOT_BOX.maxZ) continue;
    if (z > shorelineZ(x) - 16 || inlandWater(x, z)) continue;
    if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < VOLCANO.crater + 40) continue;
    const y = ground(x, z);
    if (inlandSplash({ x, y, z })) continue;
    // Lying on a cliff face it would roll away, and nobody on foot could reach it.
    if (Math.abs(ground(x + 2, z) - ground(x - 2, z)) > 3.2 || Math.abs(ground(x, z + 2) - ground(x, z - 2)) > 3.2) continue;
    if (PADS.some(pad => Math.hypot(x - pad.x, z - pad.z) < pad.r + 4)) continue;
    if (Object.values(ROYAL_HOARDS).some(hoard => Math.hypot(x - hoard.x, z - hoard.z) < 30)) continue;
    if (SCAVENGER_CAMPS.some(camp => Math.hypot(x - camp.x, z - camp.z) < CAMP_RADIUS + 6)) continue;
    if (KINGDOM_TREASURES.some(def => Math.hypot(x - def.at[0], z - def.at[1]) < 20)) continue;
    if (result.some(def => Math.hypot(x - def.at[0], z - def.at[1]) < 36)) continue;
    const id = `wild_${result.length}`;
    const region = regionFor(x < -220 && z > -260 ? "glaeryus" : x > 220 && z > -160 ? "pantala" : "pyrrhia");
    if (y < SEA_LEVEL + 0.5 && z > shorelineZ(x) - 40) continue;
    if (roll < 0.5) {
      result.push({ id, name: variant < 0.5 ? "Traveler's Coin Pouch" : "Spilled Tribute", kind: "coins", region, value: 22 + Math.round(variant * 20), weight: 1, rarity: "common", tags: ["gold", "coins"], tint: "#ffffff", lore: "Dropped by a dragon in too much of a hurry.", unique: false, perch: "ground", at: [x, z] });
    } else if (roll < 0.8) {
      result.push({ id, name: "Wild Gem", kind: "gem", region, value: 34, weight: 1, rarity: "common", tags: ["gem"], tint: GEM_TINTS[Math.floor(variant * GEM_TINTS.length) % GEM_TINTS.length], lore: "Weathered out of the rock by a thousand storms.", unique: false, perch: "ground", at: [x, z] });
    } else {
      result.push({ id, name: TRINKETS[Math.floor(variant * TRINKETS.length) % TRINKETS.length], kind: "trinket", region, value: 3, weight: 1, rarity: "junk", tags: ["junk", "scavenger"], tint: "#ffffff", lore: "Scavengers leave the strangest things lying around.", unique: false, perch: "ground", at: [x, z] });
    }
  }
  return result;
}

let treeCache: ReturnType<typeof createPlantings> | undefined;
/** The first 120 open-world trees exist on every device budget. */
function perchTrees() {
  treeCache ??= createPlantings("open", "tree", 120);
  return treeCache;
}

export interface TreasureSpot { x: number; y: number; z: number }

/** Where a treasure rests in the world (the base of the item). */
export function resolveTreasureSpot(def: TreasureDef): TreasureSpot {
  const [x, z] = def.at;
  if (def.perch === "treetop") {
    let best = perchTrees()[0];
    for (const tree of perchTrees()) if (Math.hypot(tree.x - x, tree.z - z) < Math.hypot(best.x - x, best.z - z)) best = tree;
    return { x: best.x, y: best.y + 5.25 * best.scale, z: best.z };
  }
  if (def.perch === "spire") {
    const formations = regionalFormations();
    let best = formations[0];
    for (const formation of formations) if (Math.hypot(formation.x - x, formation.z - z) < Math.hypot(best.x - x, best.z - z)) best = formation;
    return { x: best.x, y: formationTop(best) - 0.25, z: best.z };
  }
  if (def.perch === "royal" && def.royal) {
    const hoard = ROYAL_HOARDS[def.royal];
    return { x: hoard.x + x, y: hoard.y + 0.55, z: hoard.z + z };
  }
  if (def.perch === "ledge") return { x, y: def.altitude ?? terrainHeight(x, z, "open"), z };
  const ground = terrainHeight(x, z, "open");
  if (def.perch === "sky") return { x, y: Math.max(ground, LAKE.surface) + (def.altitude ?? 20), z };
  return { x, y: ground, z };
}

/** Sky lanterns drift on a slow loop; snatch checks and rendering share this path. */
export function skyDrift(def: TreasureDef, time: number): Vector3Like {
  if (def.perch !== "sky") return { x: 0, y: 0, z: 0 };
  const phase = def.at[0] * 0.13 + def.at[1] * 0.07;
  const angle = time * 0.16 + phase;
  return { x: Math.cos(angle) * 6, y: Math.sin(time * 0.5 + phase) * 0.8, z: Math.sin(angle) * 6 };
}

// ---- Tribe tastes ----

export interface TribeTaste { tags: readonly string[]; multiplier: number; blurb: string }

export const TRIBE_TASTES: Readonly<Record<string, TribeTaste>> = {
  mudwing: { tags: ["relic", "stone", "chest"], multiplier: 1.5, blurb: "MudWings love sturdy old things." },
  sandwing: { tags: ["gold"], multiplier: 1.5, blurb: "SandWings crave gold." },
  skywing: { tags: ["crown", "fire"], multiplier: 1.75, blurb: "SkyWings covet crowns and fire." },
  seawing: { tags: ["pearl"], multiplier: 3, blurb: "SeaWings treasure pearls above all." },
  icewing: { tags: ["ice", "gem"], multiplier: 1.5, blurb: "IceWings prize cold, flawless gems." },
  rainwing: { tags: ["fruit"], multiplier: 6, blurb: "RainWings value fruit more than gold." },
  nightwing: { tags: ["scroll", "sky"], multiplier: 2, blurb: "NightWings hoard knowledge and starlight." },
  hivewing: { tags: ["amber", "gold"], multiplier: 1.5, blurb: "HiveWings adore amber." },
  silkwing: { tags: ["silk"], multiplier: 3, blurb: "SilkWings treasure flamesilk." },
  leafwing: { tags: ["fruit"], multiplier: 4, blurb: "LeafWings guard every growing thing." },
  ricewing: { tags: ["silver", "relic"], multiplier: 1.5, blurb: "RiceWings collect fine silver." },
  acewing: { tags: ["sky", "orb"], multiplier: 2, blurb: "AceWings chase sky-treasure." },
  bladewing: { tags: ["silver", "gem"], multiplier: 1.5, blurb: "BladeWings prize anything that gleams like a blade." },
  bonewing: { tags: ["bone"], multiplier: 4, blurb: "BoneWings collect... bones. Obviously." },
  hivewing2: { tags: ["amber", "silk"], multiplier: 1.5, blurb: "Shadow HiveWings hoard amber and silk." },
};

export function appraise(def: TreasureDef, dragonId: string) {
  // Your own stolen gold comes back at exactly what it was worth.
  if (def.stolenFrom) return { value: def.value, multiplier: 1, favored: false };
  const taste = TRIBE_TASTES[dragonId];
  const favored = Boolean(taste && def.tags.some(tag => taste.tags.includes(tag)));
  const multiplier = favored ? taste!.multiplier : 1;
  return { value: Math.round(def.value * multiplier), multiplier, favored };
}

// ---- Talons ----

export type TalonSide = "left" | "right";
export interface Talons { left: string | null; right: string | null }
export const emptyTalons = (): Talons => ({ left: null, right: null });

export const talonsNeeded = (weight: number) => weight >= 3 ? 2 : 1;

export function carriedIds(talons: Talons): string[] {
  const ids: string[] = [];
  if (talons.left) ids.push(talons.left);
  if (talons.right && talons.right !== talons.left) ids.push(talons.right);
  return ids;
}

/** Puts an item in a free talon (or both, for heavy chests). Returns null when the talons are full. */
export function grabWith(talons: Talons, itemId: string, weight: number, side?: TalonSide): { talons: Talons; side: TalonSide | "both" } | null {
  if (carriedIds(talons).includes(itemId)) return null;
  if (talonsNeeded(weight) === 2) {
    if (talons.left || talons.right) return null;
    return { talons: { left: itemId, right: itemId }, side: "both" };
  }
  const order: TalonSide[] = side ? [side] : ["right", "left"];
  for (const candidate of order) {
    if (!talons[candidate]) return { talons: { ...talons, [candidate]: itemId }, side: candidate };
  }
  return null;
}

/** Opening one talon drops whatever it holds; a two-talon chest falls when either lets go. */
export function releaseFrom(talons: Talons, side: TalonSide): { talons: Talons; itemId: string | null } {
  const itemId = talons[side];
  if (!itemId) return { talons, itemId: null };
  return {
    talons: { left: talons.left === itemId ? null : talons.left, right: talons.right === itemId ? null : talons.right },
    itemId,
  };
}

/** Heavier loads slow flight and climbing; armored dragons haul better. */
export function carryLoad(totalWeight: number, armor: number) {
  const strength = 0.6 + 0.4 * Math.max(0.5, Math.min(1.6, Number.isFinite(armor) ? armor : 1));
  const load = Math.max(0, Number.isFinite(totalWeight) ? totalWeight : 0) / strength;
  return {
    speedFactor: Math.max(0.55, 1 - 0.07 * load),
    climbFactor: Math.max(0.35, 1 - 0.13 * load),
  };
}

// ---- Loose loot physics ----

export interface LooseLoot { position: Vector3Like; velocity: Vector3Like; resting: boolean }

const GRAVITY = 22;

/** Dropped or thrown treasure falls, bounces once or twice, then settles on the terrain. */
export function stepLooseLoot(item: LooseLoot, delta: number, groundAt: (x: number, z: number) => number): LooseLoot {
  if (item.resting) return item;
  const dt = Math.max(0, Math.min(delta, 1 / 15));
  const drag = Math.exp(-0.25 * dt);
  const velocity = { x: item.velocity.x * drag, y: item.velocity.y - GRAVITY * dt, z: item.velocity.z * drag };
  const position = { x: item.position.x + velocity.x * dt, y: item.position.y + velocity.y * dt, z: item.position.z + velocity.z * dt };
  const ground = groundAt(position.x, position.z);
  if (position.y > ground) return { position, velocity, resting: false };
  position.y = ground;
  if (Math.abs(velocity.y) < 3.5 && Math.hypot(velocity.x, velocity.z) < 2.5) {
    return { position, velocity: { x: 0, y: 0, z: 0 }, resting: true };
  }
  return { position, velocity: { x: velocity.x * 0.5, y: Math.abs(velocity.y) * 0.3, z: velocity.z * 0.5 }, resting: false };
}

export function inLake(position: Vector3Like) {
  return Math.hypot(position.x - LAKE.x, position.z - LAKE.z) < LAKE.radius && position.y <= LAKE.surface + 0.05;
}

/** Loot that falls past the waterline into the southern sea (the water starts just above the shoreline). */
export function inSea(position: Vector3Like) {
  return position.z > shorelineZ(position.x) - 3 && position.y <= SEA_LEVEL + 0.05;
}

/** Water a dropped treasure sinks into out in the kingdoms (see Waters for the surfaces). */
export function inlandSplash(position: Vector3Like): "oasis" | "pool" | "mud" | null {
  if (Math.hypot(position.x - OASIS.x, position.z - OASIS.z) < OASIS.shore - 2 && position.y <= OASIS.level + 0.05) return "oasis";
  const pool = GREAT_FALLS.pool;
  if (Math.hypot(position.x - pool.x, position.z - pool.z) < pool.radius - 2 && position.y <= pool.level + 0.05) return "pool";
  for (const mud of MUD_POOLS) if (Math.hypot(position.x - mud.x, position.z - mud.z) < mud.r * 0.78 && position.y <= MUD_LEVEL + 0.05) return "mud";
  return null;
}

/** What a falling treasure comes to rest on: the land, or the frozen lake's ice. */
export function restingSurface(x: number, z: number) {
  const ground = terrainHeight(x, z, "open");
  return Math.hypot(x - FROZEN_LAKE.x, z - FROZEN_LAKE.z) < FROZEN_LAKE.radius + 3 ? Math.max(ground, FROZEN_LAKE.level) : ground;
}

/** Loot that drops into the volcano's crater sinks into the lava lake. */
export function inLava(position: Vector3Like) {
  return Math.hypot(position.x - VOLCANO.x, position.z - VOLCANO.z) < VOLCANO.crater + 6 && position.y <= VOLCANO.lava + 0.3;
}

export function hoardFloor() {
  return terrainHeight(HOARD_SITE.x, HOARD_SITE.z, "open");
}

/** Carried loot banks inside this column above the nest. */
export function inHoardZone(position: Vector3Like, floor = hoardFloor()) {
  return Math.hypot(position.x - HOARD_SITE.x, position.z - HOARD_SITE.z) <= HOARD_SITE.radius
    && position.y >= floor - 2 && position.y <= floor + HOARD_SITE.height;
}

/** A treasure dropped from high above that lands in the nest earns a "dunk" bonus. */
export function dunkBonus(releaseHeightAboveHoard: number) {
  if (!Number.isFinite(releaseHeightAboveHoard) || releaseHeightAboveHoard < 10) return 1;
  return releaseHeightAboveHoard >= 22 ? 1.5 : 1.25;
}

// ---- Persistent hoard ----

export const HOARD_KEY = "wearedragons.hoard.v1";
export interface HoardRecord { by: string; value: number }
export interface HoardProgress {
  version: 1;
  gold: number;
  deliveries: number;
  banked: Record<string, HoardRecord>;
  byDragon: Record<string, number>;
  /** Gold scavengers carried off, by camp id, until you win it back. */
  stolen: Record<string, number>;
}
export const emptyHoard = (): HoardProgress => ({ version: 1, gold: 0, deliveries: 0, banked: {}, byDragon: {}, stolen: {} });
const CAMP_IDS: ReadonlySet<string> = new Set(SCAVENGER_CAMPS.map(camp => camp.id));

const DRAGON_ID = /^[a-z0-9_]{1,32}$/;
const MAX_GOLD = 1e9;

/** Damaged, foreign, or future saves cannot break free flight. */
export function parseHoard(raw: string | null): HoardProgress {
  const result = emptyHoard();
  try {
    const input = JSON.parse(raw ?? "null");
    if (input?.version !== 1) return result;
    if (Number.isFinite(input.gold) && input.gold >= 0) result.gold = Math.min(MAX_GOLD, Math.floor(input.gold));
    if (Number.isSafeInteger(input.deliveries) && input.deliveries >= 0) result.deliveries = input.deliveries;
    if (input.banked && typeof input.banked === "object") {
      for (const def of ALL_TREASURES) {
        const record = input.banked[def.id];
        if (record && typeof record.by === "string" && DRAGON_ID.test(record.by) && Number.isFinite(record.value) && record.value >= 0) {
          result.banked[def.id] = { by: record.by, value: Math.min(MAX_GOLD, Math.round(record.value)) };
        }
      }
    }
    if (input.byDragon && typeof input.byDragon === "object") {
      for (const [id, gold] of Object.entries(input.byDragon)) {
        if (DRAGON_ID.test(id) && id !== "__proto__" && Number.isFinite(gold) && Number(gold) >= 0) result.byDragon[id] = Math.min(MAX_GOLD, Math.floor(Number(gold)));
      }
    }
    if (input.stolen && typeof input.stolen === "object") {
      for (const [id, gold] of Object.entries(input.stolen)) {
        if (CAMP_IDS.has(id) && Number.isFinite(gold) && Number(gold) >= 1) result.stolen[id] = Math.min(MAX_GOLD, Math.floor(Number(gold)));
      }
    }
  } catch { /* Start a fresh hoard if JSON is damaged. */ }
  return result;
}

/** Bank one delivery. A unique treasure can only enter the hoard once. */
export function bankLoot(hoard: HoardProgress, def: TreasureDef, dragonId: string, value: number): HoardProgress {
  if (!Number.isFinite(value) || value < 0 || !DRAGON_ID.test(dragonId)) return hoard;
  if (def.unique && (hoard.banked[def.id] || !TREASURE_BY_ID.has(def.id))) return hoard;
  if (def.stolenFrom) return recoverGold(hoard, def.stolenFrom, value);
  const amount = Math.round(value);
  return {
    ...hoard,
    gold: Math.min(MAX_GOLD, hoard.gold + amount),
    deliveries: Math.min(Number.MAX_SAFE_INTEGER, hoard.deliveries + 1),
    banked: def.unique ? { ...hoard.banked, [def.id]: { by: dragonId, value: amount } } : hoard.banked,
    byDragon: { ...hoard.byDragon, [dragonId]: Math.min(MAX_GOLD, (hoard.byDragon[dragonId] ?? 0) + amount) },
  };
}

/** How much one scavenger can carry off from a hoard of this size. */
export function raidHaul(gold: number) {
  return Math.min(Math.max(0, Math.floor(gold)), Math.max(5, Math.min(60, Math.round(gold * 0.06))));
}

/** A scavenger scoops gold out of your hoard and owes it to their camp's stash. */
export function stealGold(hoard: HoardProgress, campId: string, amount: number): { hoard: HoardProgress; taken: number } {
  const taken = CAMP_IDS.has(campId) && Number.isFinite(amount) ? Math.max(0, Math.min(hoard.gold, Math.floor(amount))) : 0;
  if (!taken) return { hoard, taken: 0 };
  return {
    taken,
    hoard: { ...hoard, gold: hoard.gold - taken, stolen: { ...hoard.stolen, [campId]: Math.min(MAX_GOLD, (hoard.stolen[campId] ?? 0) + taken) } },
  };
}

/** Winning back a sack: never more than the camp still owes you. */
export function recoverGold(hoard: HoardProgress, campId: string, value: number): HoardProgress {
  const owed = hoard.stolen[campId] ?? 0;
  const amount = Math.min(owed, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
  if (!amount) return hoard;
  const stolen = { ...hoard.stolen };
  if (owed - amount > 0) stolen[campId] = owed - amount;
  else delete stolen[campId];
  return { ...hoard, gold: Math.min(MAX_GOLD, hoard.gold + amount), deliveries: Math.min(Number.MAX_SAFE_INTEGER, hoard.deliveries + 1), stolen };
}

const RANKS: readonly { gold: number; title: string }[] = [
  { gold: 0, title: "Shiny-Pebble Keeper" },
  { gold: 150, title: "Trinket Gatherer" },
  { gold: 600, title: "Hoard Holder" },
  { gold: 1500, title: "Treasure Warden" },
  { gold: 3500, title: "Gilded Hoarder" },
  { gold: 7000, title: "Legend of the Hoard" },
];

export function hoardRank(gold: number) {
  let tier = 0;
  for (let i = 0; i < RANKS.length; i++) if (gold >= RANKS[i].gold) tier = i;
  return { tier, title: RANKS[tier].title, next: RANKS[tier + 1]?.gold };
}

/** The visible gold mound grows quickly at first, then slowly. */
export function hoardMoundHeight(gold: number) {
  return 0.45 + 1.6 * Math.min(1, Math.log10(1 + Math.max(0, gold) / 50) / 2.3);
}
