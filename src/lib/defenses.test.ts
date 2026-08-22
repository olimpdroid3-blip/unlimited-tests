import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefenseMobSelection,
  isValidDefenseMobSelection,
  resolveDefenseMobs,
  type DefenseMobLink,
} from "./defenses.ts";
import type { Mob, PlayerMobLevel } from "./mob-levels.ts";

const mobs: Mob[] = [
  {
    id: "mob-1",
    name: "Валкірія",
    imageUrl: "/mobs/valkyrie.png",
    mobType: "demon",
    rarity: "legendary",
  },
  {
    id: "mob-2",
    name: "Дракон",
    imageUrl: "/mobs/dragon.png",
    mobType: "demon-captain",
    rarity: null,
  },
];

test("accepts only 2 to 5 unique selected mobs", () => {
  assert.equal(isValidDefenseMobSelection(["mob-1", "mob-2"]), true);
  assert.equal(isValidDefenseMobSelection(["1", "2", "3", "4", "5"]), true);
  assert.equal(isValidDefenseMobSelection(["mob-1"]), false);
  assert.equal(isValidDefenseMobSelection(["1", "2", "3", "4", "5", "6"]), false);
  assert.equal(isValidDefenseMobSelection(["mob-1", "mob-1"]), false);
  assert.equal(isValidDefenseMobSelection(["mob-1", " "]), false);
});

test("accepts only a contiguous mob slot selection starting from the first slot", () => {
  assert.deepEqual(getDefenseMobSelection(["mob-1", "mob-2", null, null, null]), [
    "mob-1",
    "mob-2",
  ]);
  assert.equal(getDefenseMobSelection(["mob-1", null, "mob-3", null, null]), null);
  assert.equal(getDefenseMobSelection([null, null, "mob-3", "mob-4", null]), null);
  assert.equal(getDefenseMobSelection(["mob-1", null, null, null, null]), null);
});

test("resolves selected mobs in position order with levels from the defense player only", () => {
  const links: DefenseMobLink[] = [
    { mobId: "mob-2", position: 2 },
    { mobId: "mob-1", position: 1 },
  ];
  const levels: PlayerMobLevel[] = [
    {
      playerId: "player-2",
      mobId: "mob-1",
      level: 30,
      updatedAt: "2026-08-22T00:00:00.000Z",
    },
    {
      playerId: "player-1",
      mobId: "mob-1",
      level: 12,
      updatedAt: "2026-08-22T00:00:00.000Z",
    },
  ];

  assert.deepEqual(resolveDefenseMobs("player-1", links, mobs, levels), [
    { mob: mobs[0], level: 12, position: 1 },
    { mob: mobs[1], level: null, position: 2 },
  ]);
});

test("omits a deleted catalog mob instead of breaking the result card", () => {
  const links: DefenseMobLink[] = [{ mobId: "missing", position: 1 }];

  assert.deepEqual(resolveDefenseMobs("player-1", links, mobs, []), []);
});
