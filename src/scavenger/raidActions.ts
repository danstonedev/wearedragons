import { SCAVENGER, lootNoise, pebbleLanding } from "../game/scavenger";
import type { LairLoot } from "../game/scavenger";
import { lootToast } from "../game/lootRuntime";
import { raidCue } from "./raidState";
import type { RaidState } from "./raidState";

export function sackWeight(raid: RaidState) {
  return raid.sack.reduce((sum, id) => sum + (raid.lair.loot.find(item => item.id === id)?.weight ?? 0), 0);
}
export function sackValue(raid: RaidState) {
  return raid.sack.reduce((sum, id) => sum + (raid.lair.loot.find(item => item.id === id)?.value ?? 0), 0);
}

/** The closest loot on the floor within reach, measured from where it lies now. */
export function reachableLoot(raid: RaidState, radius: number = SCAVENGER.grabRadius): LairLoot | null {
  let best: LairLoot | null = null, bestDistance = radius;
  for (const item of raid.lair.loot) {
    const spot = raid.floor.get(item.id);
    if (!spot) continue;
    const distance = Math.hypot(spot.x - raid.player.x, spot.z - raid.player.z);
    if (distance < bestDistance) { best = item; bestDistance = distance; }
  }
  return best;
}

/** Shared by desktop, touch and VR: put the nearest loot in the sack if it fits. */
export function grabLoot(raid: RaidState, item: LairLoot | null = reachableLoot(raid)) {
  if (!item || raid.ended) return false;
  if (sackWeight(raid) + item.weight > SCAVENGER.capacity) {
    lootToast(`The ${item.name} won't fit! Drop something (X) first.`, "warn");
    raidCue("denied");
    return false;
  }
  const spot = raid.floor.get(item.id)!;
  raid.floor.delete(item.id);
  raid.sack.push(item.id);
  raid.noises.push({ x: spot.x, z: spot.z, radius: lootNoise(item), kind: "loot" });
  lootToast(`${item.prize ? "★ " : ""}STOLE ${item.name.toUpperCase()} · ${item.value} gold`, item.prize ? "legend" : "gold");
  raidCue("grab", { prize: Boolean(item.prize) });
  return true;
}

export function dropLoot(raid: RaidState) {
  if (raid.ended) return false;
  const id = raid.sack.pop();
  if (!id) return false;
  const item = raid.lair.loot.find(loot => loot.id === id)!;
  const angle = raid.player.facing;
  const spot = { x: raid.player.x + Math.sin(angle) * 0.7, z: raid.player.z + Math.cos(angle) * 0.7 };
  raid.floor.set(id, spot);
  raid.noises.push({ ...spot, radius: 3 + item.weight * 1.2, kind: "drop" });
  lootToast(`Dropped the ${item.name}.`, "info");
  raidCue("drop");
  return true;
}

export function throwPebble(raid: RaidState, yaw: number) {
  if (raid.pebbles <= 0 || raid.ended) { lootToast("Out of pebbles!", "warn"); return false; }
  raid.pebbles--;
  const from = { x: raid.player.x, z: raid.player.z };
  const to = pebbleLanding(raid.lair, from, yaw, 10);
  raid.flying.push({ from, to, age: 0, duration: 0.25 + Math.hypot(to.x - from.x, to.z - from.z) * 0.06 });
  raidCue("throw");
  return true;
}

