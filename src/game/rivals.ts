import type { Vector3Like } from "./flight.ts";
import { SEA_LEVEL } from "./coast.ts";
import { KINGDOM_BY_ID } from "./world.ts";
import type { KingdomId } from "./world.ts";
import { ROYAL_HOARDS } from "./worldSites.ts";

/**
 * Rival dragons patrol their kingdoms. Your own tribe's kingdom treats you as kin; everywhere
 * else they warn you off, then chase, breathe fire, and try to snatch treasure from your talons.
 */
export type RivalKingdom = Exclude<KingdomId, "pyrrhia">;
export interface RivalDef {
  id: string;
  name: string;
  /** Dragon roster id (colors, model, breath). */
  tribe: string;
  kingdom: RivalKingdom;
  champion: boolean;
  /** Patrol loop around this point. */
  home: { x: number; z: number };
  radius: number;
  /** Patrol height above the ground. */
  altitude: number;
  /** Starting angle on the loop; the loop direction is +1 or -1. */
  phase: number;
  direction: 1 | -1;
}

export const RIVAL = {
  sight: 110,
  championSight: 140,
  warnDistance: 30,
  warnTime: 4.5,
  championWarnTime: 3,
  closeIn: 16,
  fireRange: 38,
  windup: 0.7,
  cooldown: 2.6,
  championCooldown: 1.8,
  snatchRange: 7.5,
  snatchTime: 0.7,
  /** Seconds out of sight before a chaser gives up. */
  forget: 9,
  /** How far a provoked or alerted chaser follows you from its patrol. */
  leash: 520,
  speed: { patrol: 12, chase: 21, champion: 23, carry: 17, retreat: 24, return: 15 },
  hp: 100,
  championHp: 260,
  downedTime: 25,
  angerTime: 20,
  shotSpeed: 34,
  damage: 10,
  championDamage: 14,
  minClearance: 4,
  /** Treasure-carrying rivals drop it when hit; downed ones drop everything. */
};

const rival = (id: string, name: string, tribe: string, kingdom: RivalKingdom, home: [number, number], radius: number, altitude: number, phase: number, direction: 1 | -1 = 1, champion = false): RivalDef =>
  ({ id, name, tribe, kingdom, champion, home: { x: home[0], z: home[1] }, radius, altitude, phase, direction });
/** Champions circle their royal hoard, high enough to clear the towers around it. */
const guard = (id: string, name: string, tribe: string, kingdom: RivalKingdom, altitude: number, radius = 26) =>
  rival(id, name, tribe, kingdom, [ROYAL_HOARDS[kingdom].x, ROYAL_HOARDS[kingdom].z], radius, altitude, 0, 1, true);

export const RIVALS: readonly RivalDef[] = [
  guard("cinder", "Captain Cinder", "skywing", "sky", 46),
  rival("sunstrike", "Sunstrike", "skywing", "sky", [-40, -560], 90, 38, 0),
  rival("flamewing", "Flamewing", "skywing", "sky", [120, -620], 110, 46, 2, -1),
  rival("hawkfire", "Hawkfire", "skywing", "sky", [-260, -760], 80, 40, 4),

  guard("frostfang", "Commander Frostfang", "icewing", "ice", 30),
  rival("glacier", "Glacier", "icewing", "ice", [-520, -650], 85, 30, 1),
  rival("snowdrift", "Snowdrift", "icewing", "ice", [-680, -580], 70, 34, 3, -1),
  rival("polaris", "Polaris", "icewing", "ice", [-420, -820], 90, 42, 5),

  guard("boulder", "Big Brother Boulder", "mudwing", "mud", 20),
  rival("sedge", "Sedge", "mudwing", "mud", [-600, -280], 75, 20, 0),
  rival("marsh", "Marsh", "mudwing", "mud", [-600, -280], 75, 24, 2.1),
  rival("reed", "Reed", "mudwing", "mud", [-680, -400], 60, 22, 4.2, -1),

  guard("mango", "Royal Guard Mango", "rainwing", "rainforest", 20),
  rival("tamarin", "Tamarin", "rainwing", "rainforest", [470, -640], 70, 34, 1),
  rival("orchid", "Orchid", "rainwing", "rainforest", [640, -560], 80, 30, 3, -1),
  rival("duskclaw", "Duskclaw", "nightwing", "rainforest", [560, -820], 90, 48, 5),

  guard("sirocco", "Champion Sirocco", "sandwing", "sand", 24),
  rival("mirage", "Mirage", "sandwing", "sand", [620, -220], 100, 32, 0.5),
  rival("dune", "Dune", "sandwing", "sand", [520, -420], 80, 28, 2.5, -1),
  rival("sandstorm", "Sandstorm", "sandwing", "sand", [700, -320], 70, 40, 4.5),

  guard("wasp", "Hive Warden Wasp", "hivewing", "pantala", 30, 40),
  rival("silkdancer", "Silkdancer", "silkwing", "pantala", [460, 70], 90, 30, 1),
  rival("mantis", "Mantis", "hivewing", "pantala", [600, 30], 70, 34, 3, -1),
  rival("sequoia", "Sequoia", "leafwing", "pantala", [380, -40], 60, 26, 5),

  guard("obsidian", "Warlord Obsidian", "bladewing", "glaeryus", 42),
  rival("paddy", "Paddy", "ricewing", "glaeryus", [-460, 70], 90, 28, 0),
  rival("ace", "Ace", "acewing", "glaeryus", [-600, 40], 80, 36, 2, -1),
  rival("rattlebone", "Rattlebone", "bonewing", "glaeryus", [-300, -40], 60, 30, 4),
  rival("gloom", "Gloom", "hivewing2", "glaeryus", [-520, -60], 70, 32, 5),

  guard("riptide", "Admiral Riptide", "seawing", "sea", 14),
  rival("coral", "Coral", "seawing", "sea", [-300, 210], 110, 18, 1),
  rival("squall", "Squall", "seawing", "sea", [300, 215], 120, 22, 3, -1),
];
export const RIVAL_BY_ID: ReadonlyMap<string, RivalDef> = new Map(RIVALS.map(def => [def.id, def]));

/** The ground a rival must clear: the land, or the sea's surface (nobody flies underwater). */
export const rivalGround = (terrain: (x: number, z: number) => number) => (x: number, z: number) => Math.max(terrain(x, z), SEA_LEVEL + 1);

export type RivalMode = "patrol" | "warn" | "chase" | "windup" | "evade" | "carry" | "retreat" | "downed" | "return";
export interface RivalState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  heading: number;
  mode: RivalMode;
  timer: number;
  cooldown: number;
  hp: number;
  angle: number;
  orbit: 1 | -1;
  /** Treasure in its claws (a loot id), if any. */
  carrying: string | null;
  /** Seconds of grudge left after being attacked. */
  anger: number;
  /** Seconds since it last saw you. */
  lost: number;
  snatch: number;
}

export type RivalEvent = "warn" | "engage" | "fire" | "snatch" | "stash" | "drop" | "downed" | "recover" | "retreat" | "calm";

export interface RivalWorld {
  player: Vector3Like;
  playerVelocity: Vector3Like;
  playerTribe: string;
  playerKingdom: KingdomId;
  /** You have treasure in your talons. */
  carrying: boolean;
  cloaked: boolean;
  /** This rival's kingdom is on alert (its royal hoard was robbed). */
  alarm: boolean;
  /** The rival can see you (no terrain in between); the caller decides this. */
  sees: boolean;
  ground: (x: number, z: number) => number;
}

export interface RivalShot { position: [number, number, number]; velocity: [number, number, number]; damage: number }

export const maxHp = (def: RivalDef) => def.champion ? RIVAL.championHp : RIVAL.hp;
/** Dragons of the kingdom's own tribes are kin: they never attack each other. */
export const isKin = (def: RivalDef, tribe: string) => KINGDOM_BY_ID.get(def.kingdom)!.tribes.includes(tribe);

function patrolPoint(def: RivalDef, angle: number) {
  return { x: def.home.x + Math.cos(angle) * def.radius, z: def.home.z + Math.sin(angle) * def.radius };
}

export function createRivalState(def: RivalDef, ground: (x: number, z: number) => number): RivalState {
  const p = patrolPoint(def, def.phase);
  return {
    x: p.x, y: ground(p.x, p.z) + def.altitude, z: p.z, vx: 0, vy: 0, vz: 0, heading: 0,
    mode: "patrol", timer: 0, cooldown: 1.5, hp: maxHp(def), angle: def.phase, orbit: def.direction,
    carrying: null, anger: 0, lost: 0, snatch: 0,
  };
}

/** Terrain between two points: false if the ground rises across the line. */
export function lineOfSight(a: Vector3Like, b: Vector3Like, ground: (x: number, z: number) => number, step = 12) {
  const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const steps = Math.ceil(length / step);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
    if (y < ground(x, z) + 1) return false;
  }
  return true;
}

/** A rival takes a hit: it drops what it carries, and either fights, flees, or goes down. */
export function hitRival(def: RivalDef, previous: RivalState, damage: number): { state: RivalState; events: RivalEvent[] } {
  const state = { ...previous };
  const events: RivalEvent[] = [];
  if (state.mode === "downed" || !(damage > 0)) return { state, events };
  state.hp = Math.max(0, state.hp - damage);
  state.anger = RIVAL.angerTime;
  if (state.carrying) { events.push("drop"); state.carrying = null; }
  if (state.hp <= 0) {
    state.mode = "downed"; state.timer = 0; events.push("downed");
  } else if (!def.champion && state.hp < maxHp(def) * 0.3) {
    if (state.mode !== "retreat") { state.mode = "retreat"; state.timer = 0; events.push("retreat"); }
  } else if (state.mode === "patrol" || state.mode === "warn" || state.mode === "return") {
    state.mode = "chase"; state.timer = 0; events.push("engage");
  }
  return { state, events };
}

/** The rival's flight: steer toward a target at a speed, never below the ground's clearance. */
function fly(state: RivalState, target: Vector3Like, speed: number, response: number, dt: number, ground: (x: number, z: number) => number, clearance = RIVAL.minClearance) {
  const dx = target.x - state.x, dy = target.y - state.y, dz = target.z - state.z;
  const distance = Math.hypot(dx, dy, dz);
  const pace = distance > 1e-6 ? Math.min(speed, distance * 1.6) / distance : 0;
  const k = 1 - Math.exp(-response * dt);
  state.vx += (dx * pace - state.vx) * k;
  state.vy += (dy * pace - state.vy) * k;
  state.vz += (dz * pace - state.vz) * k;
  state.x += state.vx * dt;
  state.y += state.vy * dt;
  state.z += state.vz * dt;
  const floor = ground(state.x, state.z) + clearance;
  if (state.y < floor) { state.y = floor; state.vy = Math.max(0, state.vy); }
  if (Math.hypot(state.vx, state.vz) > 0.5) state.heading = Math.atan2(-state.vx, -state.vz);
}

/**
 * One deterministic step of a rival's mind and wings. Returns its new state, what happened,
 * and a breath shot when it fires.
 */
export function stepRival(def: RivalDef, previous: RivalState, world: RivalWorld, delta: number): { state: RivalState; events: RivalEvent[]; shot: RivalShot | null } {
  const dt = Math.max(0, Math.min(delta, 1 / 15));
  const state: RivalState = { ...previous };
  const events: RivalEvent[] = [];
  let shot: RivalShot | null = null;
  state.timer += dt;
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.anger = Math.max(0, state.anger - dt);
  const player = world.player;
  const dx = player.x - state.x, dy = player.y - state.y, dz = player.z - state.z;
  const distance = Math.hypot(dx, dy, dz);
  const kin = isKin(def, world.playerTribe);
  const sight = def.champion ? RIVAL.championSight : RIVAL.sight;
  const sees = !kin && world.sees && !world.cloaked && distance < sight;
  state.lost = sees ? 0 : state.lost + dt;
  const homeDistance = Math.hypot(player.x - def.home.x, player.z - def.home.z);
  const trespassing = world.playerKingdom === def.kingdom || homeDistance < def.radius + 70;
  const provoked = !kin && (state.anger > 0 || world.alarm);
  const facePlayer = () => { if (distance > 0.5) state.heading = Math.atan2(-dx, -dz); };

  if (state.mode === "downed") {
    // Yielded: glide down and sit it out, then fly home with full strength.
    fly(state, { x: state.x, y: world.ground(state.x, state.z), z: state.z }, 8, 1.5, dt, world.ground, 1.2);
    if (state.timer >= RIVAL.downedTime) { state.hp = maxHp(def); state.mode = "return"; state.timer = 0; events.push("recover"); }
    return { state, events, shot };
  }

  // ---- Decide ----
  switch (state.mode) {
    case "patrol":
    case "return":
      if (sees && (trespassing || provoked)) {
        state.mode = provoked ? "chase" : "warn"; state.timer = 0;
        events.push(provoked ? "engage" : "warn");
      }
      break;
    case "warn":
      if (kin || (!trespassing && !provoked && distance > 60)) { state.mode = "return"; state.timer = 0; events.push("calm"); }
      else if (provoked || distance < RIVAL.closeIn || state.timer > (def.champion ? RIVAL.championWarnTime : RIVAL.warnTime)) {
        state.mode = "chase"; state.timer = 0; events.push("engage");
      }
      break;
    case "chase":
    case "windup":
    case "evade": {
      const leashed = homeDistance > RIVAL.leash;
      if (kin || state.lost > RIVAL.forget || leashed || (!trespassing && !provoked && distance > 90)) {
        state.mode = "return"; state.timer = 0; state.snatch = 0; events.push("calm");
        break;
      }
      if (state.mode === "chase") {
        if (world.carrying && distance < RIVAL.snatchRange) {
          state.snatch += dt;
          if (state.snatch >= RIVAL.snatchTime) { state.snatch = 0; events.push("snatch"); }
        } else state.snatch = Math.max(0, state.snatch - dt);
        if (sees && distance < RIVAL.fireRange && state.cooldown <= 0) { state.mode = "windup"; state.timer = 0; }
      } else if (state.mode === "windup" && state.timer >= RIVAL.windup) {
        // Lead the shot: aim where you will be when the fire arrives.
        const travel = distance / RIVAL.shotSpeed;
        const aim = { x: player.x + world.playerVelocity.x * travel - state.x, y: player.y + world.playerVelocity.y * travel - state.y, z: player.z + world.playerVelocity.z * travel - state.z };
        const length = Math.max(0.01, Math.hypot(aim.x, aim.y, aim.z));
        const ux = aim.x / length, uy = aim.y / length, uz = aim.z / length;
        shot = {
          position: [state.x + ux * 3, state.y + uy * 3, state.z + uz * 3],
          velocity: [ux * RIVAL.shotSpeed, uy * RIVAL.shotSpeed, uz * RIVAL.shotSpeed],
          damage: def.champion ? RIVAL.championDamage : RIVAL.damage,
        };
        events.push("fire");
        state.cooldown = def.champion ? RIVAL.championCooldown : RIVAL.cooldown;
        state.orbit = state.orbit === 1 ? -1 : 1;
        state.mode = "evade"; state.timer = 0;
      } else if (state.mode === "evade" && state.timer >= 0.9) {
        state.mode = "chase"; state.timer = 0;
      }
      break;
    }
    case "carry":
      if (!state.carrying) { state.mode = "return"; state.timer = 0; break; }
      if (Math.hypot(ROYAL_HOARDS[def.kingdom].x - state.x, ROYAL_HOARDS[def.kingdom].z - state.z) < 8) {
        events.push("stash"); state.carrying = null; state.mode = "return"; state.timer = 0;
      }
      break;
    case "retreat":
      if (state.timer > 6) { state.mode = "return"; state.timer = 0; }
      break;
  }

  // ---- Fly ----
  const ground = world.ground;
  switch (state.mode) {
    case "patrol": {
      state.angle += def.direction * RIVAL.speed.patrol / def.radius * dt;
      const p = patrolPoint(def, state.angle);
      fly(state, { x: p.x, y: ground(p.x, p.z) + def.altitude, z: p.z }, RIVAL.speed.patrol, 2, dt, ground);
      break;
    }
    case "return": {
      const p = patrolPoint(def, state.angle);
      fly(state, { x: p.x, y: ground(p.x, p.z) + def.altitude, z: p.z }, RIVAL.speed.return, 2, dt, ground);
      if (Math.hypot(p.x - state.x, p.z - state.z) < 18) { state.mode = "patrol"; state.timer = 0; }
      break;
    }
    case "warn": {
      // Hover in your way, between you and its home, and glare.
      const away = Math.max(0.01, Math.hypot(state.x - player.x, state.z - player.z));
      const target = { x: player.x + (state.x - player.x) / away * RIVAL.warnDistance, y: Math.max(player.y + 3, ground(state.x, state.z) + 8), z: player.z + (state.z - player.z) / away * RIVAL.warnDistance };
      fly(state, target, RIVAL.speed.chase, 2.5, dt, ground);
      facePlayer();
      break;
    }
    case "chase": {
      // Come in from behind and to one side, a little above you; if you carry treasure,
      // dive in under your talons to grab it.
      const horizontal = Math.max(0.01, Math.hypot(dx, dz));
      const nx = dx / horizontal, nz = dz / horizontal;
      const lead = 0.6;
      const back = world.carrying ? 2 : 12, side = world.carrying ? 1.5 : 6;
      const target = {
        x: player.x + world.playerVelocity.x * lead - nx * back + nz * state.orbit * side,
        y: player.y + (world.carrying ? -1.5 : 4),
        z: player.z + world.playerVelocity.z * lead - nz * back - nx * state.orbit * side,
      };
      fly(state, target, def.champion ? RIVAL.speed.champion : RIVAL.speed.chase, 3, dt, ground);
      break;
    }
    case "windup":
      fly(state, { x: state.x, y: state.y, z: state.z }, 4, 3, dt, ground);
      facePlayer();
      break;
    case "evade": {
      const horizontal = Math.max(0.01, Math.hypot(dx, dz));
      fly(state, { x: state.x + dz / horizontal * state.orbit * 14, y: state.y + 2, z: state.z - dx / horizontal * state.orbit * 14 }, RIVAL.speed.chase, 3, dt, ground);
      break;
    }
    case "carry": {
      const hoard = ROYAL_HOARDS[def.kingdom];
      fly(state, { x: hoard.x, y: hoard.y + 12, z: hoard.z }, RIVAL.speed.carry, 2.2, dt, ground);
      break;
    }
    case "retreat": {
      const away = Math.max(0.01, Math.hypot(state.x - player.x, state.z - player.z));
      const target = { x: state.x + (state.x - player.x) / away * 40, y: ground(state.x, state.z) + def.altitude + 10, z: state.z + (state.z - player.z) / away * 40 };
      fly(state, target, RIVAL.speed.retreat, 2.5, dt, ground);
      break;
    }
  }
  return { state, events, shot };
}

/**
 * Far from the dragon, a patrolling (or returning, or downed) rival just keeps circling its
 * loop: no senses, no steering. Busy rivals keep their full step wherever they are.
 */
export function stepDormantRival(def: RivalDef, previous: RivalState, delta: number, ground: (x: number, z: number) => number): RivalState {
  const angle = previous.angle + def.direction * RIVAL.speed.patrol / def.radius * Math.min(delta, 0.5);
  const p = patrolPoint(def, angle);
  const heading = Math.atan2(def.direction * Math.sin(angle), -def.direction * Math.cos(angle));
  const stillDown = previous.mode === "downed" && previous.timer + delta < RIVAL.downedTime;
  if (stillDown) return { ...previous, timer: previous.timer + delta };
  return {
    ...previous, mode: "patrol", angle, x: p.x, y: ground(p.x, p.z) + def.altitude, z: p.z, vx: 0, vy: 0, vz: 0, heading,
    hp: previous.mode === "downed" ? maxHp(def) : previous.hp, timer: 0, snatch: 0,
  };
}
