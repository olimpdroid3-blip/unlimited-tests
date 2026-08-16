import assert from "node:assert/strict";
import test from "node:test";

import { testBattlePowerRows, testMobCatalog, testPlayerMobLevels } from "./test-player-data.ts";

test("contains the complete normalized workbook fixture", () => {
  assert.equal(testBattlePowerRows.length, 17);
  assert.equal(testMobCatalog.length, 44);
  assert.equal(testPlayerMobLevels.length, 606);
  assert.equal(new Set(testBattlePowerRows.map(({ id }) => id)).size, 17);
  assert.equal(new Set(testMobCatalog.map(({ id }) => id)).size, 44);
  assert.equal(
    testPlayerMobLevels.every(({ level }) => level >= 1 && level <= 30),
    true,
  );
  assert.equal(testMobCatalog.filter(({ imageUrl }) => imageUrl === null).length, 2);
});

test("keeps player and mob references internally consistent", () => {
  const playerIds = new Set(testBattlePowerRows.map(({ id }) => id));
  const mobIds = new Set(testMobCatalog.map(({ id }) => id));

  assert.equal(
    testPlayerMobLevels.every(({ playerId }) => playerIds.has(playerId)),
    true,
  );
  assert.equal(
    testPlayerMobLevels.every(({ mobId }) => mobIds.has(mobId)),
    true,
  );
});
