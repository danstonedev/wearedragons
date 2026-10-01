import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorldSave, lightBeacon, parseWorldSave } from "../src/game/worldSave.ts";

test("lit beacons are remembered between flights, and junk saves start a fresh map", () => {
  let save = emptyWorldSave();
  save = lightBeacon(save, "sky");
  save = lightBeacon(save, "pyrrhia");
  assert.deepEqual(save.beacons, ["pyrrhia", "sky"], "kept in kingdom order");
  assert.equal(lightBeacon(save, "sky"), save, "lighting twice changes nothing");
  assert.equal(lightBeacon(save, "atlantis"), save, "only real kingdoms");
  assert.deepEqual(parseWorldSave(JSON.stringify(save)), save);
  for (const raw of [null, "{", "[]", '{"version":2,"beacons":["sky"]}', '{"version":1,"beacons":"sky"}']) assert.deepEqual(parseWorldSave(raw), emptyWorldSave());
  assert.deepEqual(parseWorldSave('{"version":1,"beacons":["ice","__proto__","ice",7]}').beacons, ["ice"]);
});
