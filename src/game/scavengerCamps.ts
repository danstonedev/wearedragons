import type { Vector3Like } from "./flight.ts";
import { terrainHeight } from "./landscape.ts";
import { shorelineZ } from "./coast.ts";
import { GREAT_FALLS, MUD_POOLS, OASIS, SCAVENGER_CAMPS } from "./world.ts";
import type { CampSite } from "./world.ts";
import { inlandWater } from "./worldSites.ts";
import { HOARD_SITE, raidHaul } from "./loot.ts";

/**
 * Scavengers live in burrows between the dragon kingdoms. Foragers sneak out for loose treasure
 * and haul it home on their backs; raiding parties creep to your hoard while you are away and
 * scoop up gold. Swoop low over them, or breathe fire close by, and they drop everything and run.
 * Fortified camps keep a ballista, manned by a gunner who bolts underground if you get too close.
 */
export const SCAV = {
  /** Walking, hauling, hurrying, and panicked running speeds (m/s). */
  walk: 3.2, haul: 2.5, hurry: 5.2, sprint: 7,
  /** Seconds spent working a treasure loose, and scooping gold out of your hoard. */
  grabTime: 2.4, scoopTime: 4.5,
  forageRange: 220,
  /** Seconds underground between outings, and after a fright. */
  rest: [22, 55] as const,
  scaredRest: 75,
  /** A dragon this close makes them hurry; this close and this low, they panic. */
  alert: 55, panicRadius: 17, panicHeight: 20, cloakedPanic: 5, impactPanic: 15,
  /** Nobody comes out of a burrow while a dragon is this close to it. */
  lurk: 80,
  /** Loose treasure this close to a camp counts as already stashed. */
  stashCapacity: 8,
  /** Foragers out at once from one camp. */
  maxOut: 2,
  /** Camps this close to you send foragers out (so you get to see it happen). */
  activeRange: 520,
  raid: { first: 110, every: 200, away: 280, minGold: 40, party: 2 },
  ballista: { range: 95, min: 12, reload: 3.4, speed: 58, damage: 8, hp: 70, rebuild: 120, height: 2.3 },
  /** The steepest climb a scavenger will make, in meters up per meter walked. */
  climb: 1.2,
};

export interface CampSpot { x: number; y: number; z: number }
export interface CampLayout {
  center: CampSpot;
  /** The burrow mouth, in the front of a turf mound. */
  mouth: CampSpot;
  moundRadius: number;
  fire: CampSpot;
  stash: CampSpot;
  tents: (CampSpot & { rotation: number; size: number })[];
  ballista: CampSpot | null;
  flag: CampSpot;
}

const ground = (x: number, z: number) => terrainHeight(x, z, "open");

/** Where everything in a camp stands, turned by the camp's facing. */
export function campLayout(camp: CampSite): CampLayout {
  const at = (angle: number, r: number): CampSpot => {
    const a = camp.facing + angle;
    const x = camp.x + Math.sin(a) * r, z = camp.z + Math.cos(a) * r;
    return { x, y: ground(x, z), z };
  };
  const tentCount = Math.min(4, camp.crew);
  const tents = Array.from({ length: tentCount }, (_, i) => {
    const angle = (i - (tentCount - 1) / 2) * 0.62;
    return { ...at(angle, 16 + (i % 2) * 2), rotation: camp.facing + angle + Math.PI, size: 1 + ((i * 7 + camp.x) % 3) * 0.12 };
  });
  return {
    center: at(0, 0),
    mouth: at(0, 5.6),
    moundRadius: 5.5,
    fire: at(0, 10.5),
    stash: at(1.75, 9),
    tents,
    ballista: camp.ballista ? at(-1.8, 12) : null,
    flag: at(Math.PI, 4),
  };
}

let layouts: CampLayout[] | null = null;
export function campLayouts() {
  layouts ??= SCAVENGER_CAMPS.map(campLayout);
  return layouts;
}

/** Water a scavenger will not wade into: lakes, the oasis, mud, the plunge pool, and the sea. */
export function wet(x: number, z: number) {
  if (inlandWater(x, z) || z > shorelineZ(x) - 3) return true;
  if (Math.hypot(x - OASIS.x, z - OASIS.z) < OASIS.shore - 2) return true;
  if (Math.hypot(x - GREAT_FALLS.pool.x, z - GREAT_FALLS.pool.z) < GREAT_FALLS.pool.radius) return true;
  return MUD_POOLS.some(pool => Math.hypot(x - pool.x, z - pool.z) < pool.r * 0.8);
}

/** A straight walk with dry feet and nothing steeper than a scavenger can scramble up. */
export function walkable(ax: number, az: number, bx: number, bz: number, heightAt = ground) {
  const length = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(length / 5));
  const stride = length / steps;
  let previous = heightAt(ax, az);
  for (let i = 1; i <= steps; i++) {
    const x = ax + (bx - ax) * i / steps, z = az + (bz - az) * i / steps;
    if (wet(x, z)) return false;
    const y = heightAt(x, z);
    if (Math.abs(y - previous) > SCAV.climb * stride + 0.3) return false;
    previous = y;
  }
  return true;
}

export type ScavengerMode = "home" | "post" | "gunner" | "sneak" | "grab" | "haul" | "return" | "flee" | "raid" | "scoop" | "escape";
export interface Scavenger {
  id: string;
  camp: number;
  role: "forager" | "gunner";
  x: number; y: number; z: number;
  /** Walking direction, as a yaw: 0 faces +z. */
  facing: number;
  mode: ScavengerMode;
  timer: number;
  /** Where it is walking to. */
  tx: number; tz: number;
  /** The treasure it is after, or carrying on its back (a loot id). */
  item: string | null;
  carrying: boolean;
  /** A dragon is near: hurrying, glancing up. */
  hurry: boolean;
  /** Current ground speed, for the walk cycle. */
  speed: number;
  outings: number;
}

export interface CampState {
  /** Treasure hauled home this flight. */
  stashed: number;
  ballistaHp: number;
  rebuild: number;
  reload: number;
  aimYaw: number;
  aimPitch: number;
}

export interface RaidState { camp: number; stage: "creeping" | "looting" | "escaping"; raiders: string[]; escaped: number }

export interface ScavengerWorld {
  agents: Scavenger[];
  camps: CampState[];
  raidTimer: number;
  raid: RaidState | null;
}

/** Deterministic 0..1 noise for rest times, so a flight replays the same way. */
const jitter = (a: number, b: number) => {
  const n = Math.sin(a * 91.7 + b * 47.3) * 43758.5453;
  return n - Math.floor(n);
};

export function createScavengerWorld(): ScavengerWorld {
  const agents: Scavenger[] = [];
  SCAVENGER_CAMPS.forEach((camp, c) => {
    const { mouth, ballista } = campLayouts()[c];
    for (let i = 0; i < camp.crew; i++) {
      // Gunners start at their posts; foragers drift out of the burrow over the first half minute.
      const post = camp.ballista && i === 0 ? ballista : null;
      const at = post ?? mouth;
      agents.push({
        id: `scav:${camp.id}:${i}`, camp: c, role: post ? "gunner" : "forager",
        x: at.x, y: at.y, z: at.z, facing: camp.facing, mode: post ? "gunner" : "home",
        timer: post ? 0 : 4 + jitter(c, i) * 26, tx: at.x, tz: at.z,
        item: null, carrying: false, hurry: false, speed: 0, outings: 0,
      });
    }
  });
  return {
    agents,
    camps: SCAVENGER_CAMPS.map(camp => ({ stashed: 0, ballistaHp: camp.ballista ? SCAV.ballista.hp : 0, rebuild: 0, reload: 0, aimYaw: camp.facing, aimPitch: 0 })),
    raidTimer: SCAV.raid.first,
    raid: null,
  };
}

export interface LooseTreasure { id: string; x: number; y: number; z: number; grounded: boolean }
export interface ScavengerSenses {
  dragon: { x: number; y: number; z: number; vx: number; vy: number; vz: number; cloaked: boolean; down: boolean };
  /** Where fire burst since the last step. */
  impacts: readonly Vector3Like[];
  /** Treasure lying loose in the world. */
  loose: readonly LooseTreasure[];
  /** Gold in your hoard. */
  gold: number;
  /** Lift a loose treasure onto this scavenger's back; false if someone got there first. */
  claim: (agent: Scavenger, itemId: string) => boolean;
  /** Scoop gold out of your hoard into a sack; returns the sack's loot id, or null. */
  steal: (agent: Scavenger, campId: string, amount: number) => string | null;
  ground?: (x: number, z: number) => number;
}

export type ScavengerEvent =
  | { type: "outing"; agent: Scavenger; item: string }
  | { type: "claimed"; agent: Scavenger; item: string }
  | { type: "panic"; agent: Scavenger; dropped: string | null }
  | { type: "stashed"; agent: Scavenger; item: string; camp: number }
  | { type: "raid"; camp: number }
  | { type: "stole"; agent: Scavenger; item: string }
  | { type: "raid_over"; camp: number; escaped: boolean }
  | { type: "fire"; camp: number; from: Vector3Like; velocity: Vector3Like }
  | { type: "ballista_broken"; camp: number }
  | { type: "ballista_rebuilt"; camp: number };

/** Loose treasure inside a camp is already somebody's stash. */
function inAnyCamp(x: number, z: number) {
  return SCAVENGER_CAMPS.some(camp => Math.hypot(x - camp.x, z - camp.z) < 22);
}

/** The nearest loose treasure a forager from this camp could walk to and carry home. */
export function chooseForageTarget(campIndex: number, loose: readonly LooseTreasure[], taken: ReadonlySet<string>, heightAt = ground): LooseTreasure | null {
  const { mouth } = campLayouts()[campIndex];
  const candidates = loose
    .filter(item => item.grounded && !taken.has(item.id) && !inAnyCamp(item.x, item.z)
      && Math.hypot(item.x - HOARD_SITE.x, item.z - HOARD_SITE.z) > HOARD_SITE.radius + 2)
    .map(item => ({ item, distance: Math.hypot(item.x - mouth.x, item.z - mouth.z) }))
    .filter(entry => entry.distance < SCAV.forageRange)
    .sort((a, b) => a.distance - b.distance);
  for (const { item } of candidates.slice(0, 6)) if (walkable(mouth.x, mouth.z, item.x, item.z, heightAt)) return item;
  return null;
}

/** Where each raider stands to scoop gold: on the near rim of your hoard. */
export function raidSpot(campIndex: number, n: number) {
  const { mouth } = campLayouts()[campIndex];
  const angle = Math.atan2(mouth.x - HOARD_SITE.x, mouth.z - HOARD_SITE.z) + (n - 0.5) * 0.5;
  const r = HOARD_SITE.radius - 2.4;
  return { x: HOARD_SITE.x + Math.sin(angle) * r, z: HOARD_SITE.z + Math.cos(angle) * r };
}

/** 0: calm; 1: a dragon is near, hurry; 2: panic. */
export function threatTo(agent: Scavenger, senses: ScavengerSenses): 0 | 1 | 2 {
  const dragon = senses.dragon;
  if (dragon.down) return 0;
  for (const impact of senses.impacts) {
    if (Math.hypot(impact.x - agent.x, impact.y - agent.y, impact.z - agent.z) < SCAV.impactPanic) return 2;
  }
  const horizontal = Math.hypot(dragon.x - agent.x, dragon.z - agent.z);
  const above = dragon.y - agent.y;
  if (horizontal < (dragon.cloaked ? SCAV.cloakedPanic : SCAV.panicRadius) && above < SCAV.panicHeight) return 2;
  if (!dragon.cloaked && Math.hypot(horizontal, above) < SCAV.alert) return 1;
  return 0;
}

function walkTo(agent: Scavenger, speed: number, delta: number, heightAt: (x: number, z: number) => number) {
  const dx = agent.tx - agent.x, dz = agent.tz - agent.z;
  const distance = Math.hypot(dx, dz);
  const step = speed * delta;
  let arrived = false;
  if (distance <= Math.max(step, 0.5)) {
    agent.x = agent.tx;
    agent.z = agent.tz;
    agent.speed = 0;
    arrived = true;
  } else {
    agent.x += dx / distance * step;
    agent.z += dz / distance * step;
    agent.facing = Math.atan2(dx, dz);
    agent.speed = speed;
  }
  agent.y = heightAt(agent.x, agent.z);
  return arrived;
}

function goHome(agent: Scavenger, mode: "return" | "flee" | "haul" | "escape") {
  const { mouth } = campLayouts()[agent.camp];
  agent.mode = mode;
  agent.tx = mouth.x;
  agent.tz = mouth.z;
}

function rest(agent: Scavenger, scared = false) {
  agent.mode = "home";
  agent.speed = 0;
  agent.hurry = false;
  agent.item = null;
  agent.carrying = false;
  agent.timer = scared ? SCAV.scaredRest : SCAV.rest[0] + jitter(agent.camp * 13 + agent.outings, agent.id.length) * (SCAV.rest[1] - SCAV.rest[0]);
}

function panic(agent: Scavenger, events: ScavengerEvent[]) {
  events.push({ type: "panic", agent, dropped: agent.carrying ? agent.item : null });
  agent.item = null;
  agent.carrying = false;
  goHome(agent, "flee");
}

/** Fire or claws broke a camp's ballista. Its gunner runs for the burrow. */
export function hitBallista(world: ScavengerWorld, campIndex: number, damage: number): ScavengerEvent[] {
  const state = world.camps[campIndex];
  if (!state || state.ballistaHp <= 0 || !(damage > 0)) return [];
  state.ballistaHp = Math.max(0, state.ballistaHp - damage);
  if (state.ballistaHp > 0) return [];
  state.rebuild = SCAV.ballista.rebuild;
  const events: ScavengerEvent[] = [{ type: "ballista_broken", camp: campIndex }];
  for (const agent of world.agents) if (agent.camp === campIndex && agent.role === "gunner" && agent.mode !== "home") panic(agent, events);
  return events;
}

function startRaid(world: ScavengerWorld, senses: ScavengerSenses, events: ScavengerEvent[]) {
  const dragon = senses.dragon;
  // The raiding camp farthest from you sets out, so you have to race home.
  const order = SCAVENGER_CAMPS.map((camp, i) => ({ camp, i }))
    .filter(({ camp }) => camp.raids)
    .sort((a, b) => Math.hypot(dragon.x - b.camp.x, dragon.z - b.camp.z) - Math.hypot(dragon.x - a.camp.x, dragon.z - a.camp.z));
  for (const { i } of order) {
    const party = world.agents.filter(agent => agent.camp === i && agent.role === "forager" && agent.mode === "home").slice(0, SCAV.raid.party);
    if (!party.length) continue;
    world.raid = { camp: i, stage: "creeping", raiders: party.map(agent => agent.id), escaped: 0 };
    party.forEach((agent, n) => {
      const spot = raidSpot(i, n);
      agent.mode = "raid";
      agent.item = null;
      agent.carrying = false;
      agent.tx = spot.x;
      agent.tz = spot.z;
    });
    world.raidTimer = SCAV.raid.every;
    events.push({ type: "raid", camp: i });
    return;
  }
  // Every raider is out foraging; try again a little later.
  world.raidTimer = 20;
}

function stepAgent(world: ScavengerWorld, agent: Scavenger, senses: ScavengerSenses, looseById: ReadonlyMap<string, LooseTreasure>, taken: Set<string>, events: ScavengerEvent[], delta: number, heightAt: (x: number, z: number) => number) {
  const layout = campLayouts()[agent.camp];
  const camp = SCAVENGER_CAMPS[agent.camp];
  const state = world.camps[agent.camp];
  const dragon = senses.dragon;
  agent.timer -= delta;

  if (agent.mode !== "home") {
    const threat = threatTo(agent, senses);
    if (threat === 2 && agent.mode !== "flee") panic(agent, events);
    agent.hurry = threat > 0;
  }

  switch (agent.mode) {
    case "home": {
      agent.x = layout.mouth.x; agent.y = layout.mouth.y; agent.z = layout.mouth.z;
      agent.speed = 0;
      if (agent.timer > 0) break;
      const fromDragon = Math.hypot(dragon.x - layout.mouth.x, dragon.z - layout.mouth.z);
      // Gunners are the brave ones: a dragon nearby is exactly when the ballista needs them.
      if (fromDragon < SCAV.lurk && !dragon.down && agent.role !== "gunner") { agent.timer = 4; break; }
      if (agent.role === "gunner") {
        if (state.ballistaHp > 0 && layout.ballista && fromDragon < SCAV.activeRange) {
          agent.mode = "post";
          agent.tx = layout.ballista.x;
          agent.tz = layout.ballista.z - 0.01;
        } else agent.timer = 8;
        break;
      }
      const out = world.agents.filter(other => other.camp === agent.camp && other.role === "forager" && other.mode !== "home").length;
      if (fromDragon > SCAV.activeRange || out >= SCAV.maxOut || state.stashed >= SCAV.stashCapacity) { agent.timer = 6 + jitter(agent.outings, agent.camp) * 6; break; }
      const target = chooseForageTarget(agent.camp, senses.loose, taken, heightAt);
      if (!target) { agent.timer = 15; break; }
      taken.add(target.id);
      agent.outings++;
      agent.item = target.id;
      agent.mode = "sneak";
      agent.tx = target.x;
      agent.tz = target.z;
      events.push({ type: "outing", agent, item: target.id });
      break;
    }
    case "post":
      if (state.ballistaHp <= 0) { goHome(agent, "return"); break; }
      if (walkTo(agent, SCAV.walk, delta, heightAt)) agent.mode = "gunner";
      break;
    case "gunner": {
      agent.speed = 0;
      if (state.ballistaHp <= 0) goHome(agent, "return");
      // Face where the ballista points.
      else agent.facing = state.aimYaw;
      break;
    }
    case "sneak": {
      const item = agent.item ? looseById.get(agent.item) : undefined;
      // Gone, carried off, or up a tree now; or a dragon is too close for comfort.
      if (!item || !item.grounded || agent.hurry) { agent.item = null; goHome(agent, "return"); break; }
      agent.tx = item.x;
      agent.tz = item.z;
      if (walkTo(agent, SCAV.walk, delta, heightAt)) { agent.mode = "grab"; agent.timer = SCAV.grabTime; }
      break;
    }
    case "grab": {
      agent.speed = 0;
      const item = agent.item ? looseById.get(agent.item) : undefined;
      if (!item || !item.grounded || Math.hypot(item.x - agent.x, item.z - agent.z) > 2.5) { agent.item = null; goHome(agent, "return"); break; }
      if (agent.timer > 0) break;
      if (senses.claim(agent, item.id)) {
        agent.carrying = true;
        events.push({ type: "claimed", agent, item: item.id });
        goHome(agent, "haul");
      } else {
        agent.item = null;
        goHome(agent, "return");
      }
      break;
    }
    case "haul":
    case "escape": {
      if (!walkTo(agent, agent.hurry ? SCAV.hurry * 0.85 : SCAV.haul, delta, heightAt)) break;
      if (agent.carrying && agent.item) {
        events.push({ type: "stashed", agent, item: agent.item, camp: agent.camp });
        state.stashed++;
        if (agent.mode === "escape" && world.raid) world.raid.escaped++;
      }
      rest(agent);
      break;
    }
    case "return":
      if (walkTo(agent, agent.hurry ? SCAV.hurry : SCAV.walk, delta, heightAt)) rest(agent);
      break;
    case "flee":
      if (walkTo(agent, SCAV.sprint, delta, heightAt)) rest(agent, true);
      break;
    case "raid":
      // Raiders are bold only while no dragon is around.
      if (agent.hurry) { goHome(agent, "flee"); break; }
      if (walkTo(agent, SCAV.walk, delta, heightAt)) { agent.mode = "scoop"; agent.timer = SCAV.scoopTime; }
      break;
    case "scoop": {
      agent.speed = 0;
      if (agent.hurry) { goHome(agent, "flee"); break; }
      if (agent.timer > 0) break;
      const sack = senses.steal(agent, camp.id, raidHaul(senses.gold));
      if (sack) {
        agent.item = sack;
        agent.carrying = true;
        events.push({ type: "stole", agent, item: sack });
      }
      goHome(agent, "escape");
      break;
    }
  }
}

function stepBallistas(world: ScavengerWorld, senses: ScavengerSenses, events: ScavengerEvent[], delta: number, heightAt: (x: number, z: number) => number) {
  const dragon = senses.dragon;
  world.camps.forEach((state, i) => {
    const layout = campLayouts()[i];
    if (!layout.ballista) return;
    if (state.ballistaHp <= 0) {
      state.rebuild -= delta;
      if (state.rebuild <= 0) {
        state.ballistaHp = SCAV.ballista.hp;
        events.push({ type: "ballista_rebuilt", camp: i });
      }
      return;
    }
    state.reload = Math.max(0, state.reload - delta);
    const manned = world.agents.some(agent => agent.camp === i && agent.mode === "gunner");
    if (!manned || dragon.down || dragon.cloaked) return;
    const from = { x: layout.ballista.x, y: layout.ballista.y + SCAV.ballista.height, z: layout.ballista.z };
    const dx = dragon.x - from.x, dy = dragon.y - from.y, dz = dragon.z - from.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance > SCAV.ballista.range || distance < SCAV.ballista.min) return;
    // Lead the dragon by the bolt's flight time.
    const t = distance / SCAV.ballista.speed;
    const ax = dx + dragon.vx * t, ay = dy + dragon.vy * t, az = dz + dragon.vz * t;
    state.aimYaw = Math.atan2(ax, az);
    state.aimPitch = Math.atan2(ay, Math.hypot(ax, az));
    if (state.reload > 0) return;
    // Hills block the shot.
    for (let s = 1; s < 8; s++) {
      const f = s / 8;
      if (heightAt(from.x + dx * f, from.z + dz * f) > from.y + dy * f) return;
    }
    const length = Math.hypot(ax, ay, az) || 1;
    state.reload = SCAV.ballista.reload;
    events.push({ type: "fire", camp: i, from, velocity: { x: ax / length * SCAV.ballista.speed, y: ay / length * SCAV.ballista.speed, z: az / length * SCAV.ballista.speed } });
  });
}

/** One simulation step for every scavenger, camp, ballista, and raid. */
export function stepScavengers(world: ScavengerWorld, senses: ScavengerSenses, delta: number): ScavengerEvent[] {
  const events: ScavengerEvent[] = [];
  const heightAt = senses.ground ?? ground;
  const dragon = senses.dragon;
  const looseById = new Map(senses.loose.map(item => [item.id, item]));
  const taken = new Set<string>();
  for (const agent of world.agents) if (agent.item) taken.add(agent.item);

  // Raids wait until you are far from your hoard, and the clock only runs while you are away.
  if (!world.raid && senses.gold >= SCAV.raid.minGold && !dragon.down && Math.hypot(dragon.x - HOARD_SITE.x, dragon.z - HOARD_SITE.z) > SCAV.raid.away) {
    world.raidTimer -= delta;
    if (world.raidTimer <= 0) startRaid(world, senses, events);
  }

  for (const agent of world.agents) stepAgent(world, agent, senses, looseById, taken, events, delta, heightAt);
  stepBallistas(world, senses, events, delta, heightAt);

  const raid = world.raid;
  if (raid) {
    const raiders = world.agents.filter(agent => raid.raiders.includes(agent.id) && (agent.mode === "raid" || agent.mode === "scoop" || agent.mode === "escape"));
    if (!raiders.length) {
      events.push({ type: "raid_over", camp: raid.camp, escaped: raid.escaped > 0 });
      world.raid = null;
    } else {
      raid.stage = raiders.some(agent => agent.mode === "escape") ? "escaping" : raiders.some(agent => agent.mode === "scoop") ? "looting" : "creeping";
    }
  }
  return events;
}
