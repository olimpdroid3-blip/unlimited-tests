import assert from "node:assert/strict";
import test from "node:test";
import {
  getTowerGroup,
  normalizeParticipants,
  readTowerParticipants,
} from "./tower-participants.ts";

test("copies share owners and their comments, including an empty cell", () => {
  const towers = [
    { tower_id: "1.1.1", nickname: "Alice", notes: "First strategy" },
    { tower_id: "2.1.1", nickname: "Bob", notes: "Second strategy" },
    { tower_id: "3.1.1", nickname: "Other", notes: "Unrelated" },
  ];
  const variants = [
    { tower_id: "1.1.1", variant: 2 },
    { tower_id: "2.1.1", variant: 2 },
    { tower_id: "4.1.1", variant: 2 },
    { tower_id: "3.1.1", variant: 3 },
  ];
  const group = getTowerGroup("4.1.1", towers, variants);
  assert.deepEqual(group.towerIds, ["1.1.1", "2.1.1", "4.1.1"]);
  assert.deepEqual(group.participants, [
    { nickname: "Alice", comment: "First strategy" },
    { nickname: "Bob", comment: "Second strategy" },
  ]);
  assert.deepEqual(getTowerGroup("1.1.1", towers, variants).participants, group.participants);
});

test("unmarked towers stay independent", () => {
  const towers = [
    { tower_id: "1.1.1", nickname: "Alice", notes: null },
    { tower_id: "2.1.1", nickname: "Bob", notes: null },
  ];
  assert.deepEqual(getTowerGroup("1.1.1", towers, []).participants, [
    { nickname: "Alice", comment: "" },
  ]);
});

test("deduplicates nicknames without losing different comments", () => {
  assert.deepEqual(
    normalizeParticipants([
      { nickname: " Alice ", comment: "First" },
      { nickname: "Alice", comment: "Second" },
      { nickname: "Alice", comment: "First" },
      { nickname: " ", comment: "" },
    ]),
    [{ nickname: "Alice", comment: "First\n\nSecond" }],
  );
});

test("explicitly deleting all names does not restore the old nickname", () => {
  assert.deepEqual(
    readTowerParticipants({ nickname: "Old", notes: "Old comment", participants: [] }),
    [],
  );
});

test("legacy removed towers retain the previous owner's comment", () => {
  assert.deepEqual(
    readTowerParticipants({ nickname: null, previous_nickname: "Old", notes: "Strategy" }),
    [{ nickname: "Old", comment: "Strategy" }],
  );
});

test("an empty copy reports where the defense is placed without inheriting status", () => {
  const group = getTowerGroup(
    "4.1.1",
    [
      { tower_id: "1.1.1", placed: true, removed: false },
      { tower_id: "2.1.1", placed: true, removed: true },
    ],
    [
      { tower_id: "1.1.1", variant: 2 },
      { tower_id: "2.1.1", variant: 2 },
      { tower_id: "4.1.1", variant: 2 },
    ],
  );
  assert.deepEqual(group.placedTowerIds, ["1.1.1"]);
});
