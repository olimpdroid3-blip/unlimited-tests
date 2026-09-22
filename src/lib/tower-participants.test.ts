import assert from "node:assert/strict";
import test from "node:test";
import {
  getTowerGroup,
  getTowerOwnerIndex,
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

test("copies show only active owners and keep past owners in details", () => {
  const group = getTowerGroup(
    "1.2.1",
    [
      {
        tower_id: "1.2.1",
        removed: true,
        previous_nickname: "Fakra",
        participants: [
          { nickname: "Fakra", comment: "Old" },
          { nickname: "Mlue", comment: "Current" },
        ],
      },
      { tower_id: "2.2.1", placed: true, nickname: "Mlue", notes: "Current" },
      { tower_id: "3.2.1", placed: true, destroyed: true, nickname: "Destroyed owner" },
    ],
    [
      { tower_id: "1.2.1", variant: 1 },
      { tower_id: "2.2.1", variant: 1 },
      { tower_id: "3.2.1", variant: 1 },
    ],
  );
  assert.deepEqual(group.placedTowerIds, ["2.2.1", "3.2.1"]);
  assert.deepEqual(group.activeParticipants, [
    { nickname: "Mlue", comment: "Current" },
    { nickname: "Destroyed owner", comment: "" },
  ]);
  assert.deepEqual(
    group.previousParticipants.map((p) => p.nickname),
    ["Fakra"],
  );
});

test("multiple active copies deduplicate owners without mixing in shared history", () => {
  const group = getTowerGroup(
    "1.1.1",
    [
      {
        tower_id: "1.1.1",
        placed: true,
        nickname: "Alice",
        participants: [{ nickname: "Old", comment: "" }],
      },
      { tower_id: "2.1.1", placed: true, nickname: "Bob" },
      { tower_id: "3.1.1", placed: true, nickname: "Alice" },
    ],
    [1, 2, 3].map((n) => ({ tower_id: `${n}.1.1`, variant: 1 })),
  );
  assert.deepEqual(
    group.activeParticipants.map((p) => p.nickname),
    ["Alice", "Bob"],
  );
});

test("an unplaced defense has no active owner", () => {
  const group = getTowerGroup("1.1.1", [{ tower_id: "1.1.1", nickname: "Old", placed: false }], []);
  assert.deepEqual(group.activeParticipants, []);
  assert.deepEqual(
    group.previousParticipants.map((p) => p.nickname),
    ["Old"],
  );
});

test("a removed copy still shows the owner of a destroyed but not removed copy", () => {
  const variants = [
    { tower_id: "1.2.1", variant: 1 },
    { tower_id: "2.2.2", variant: 1 },
  ];
  const towers = [
    { tower_id: "1.2.1", removed: true, placed: false, previous_nickname: "Fakra" },
    { tower_id: "2.2.2", placed: true, destroyed: true, removed: false, nickname: "Mlue" },
  ];
  const group = getTowerGroup("1.2.1", towers, variants);
  assert.deepEqual(group.placedTowerIds, ["2.2.2"]);
  assert.deepEqual(group.activeParticipants, [{ nickname: "Mlue", comment: "" }]);
  assert.deepEqual(group.previousParticipants, [{ nickname: "Fakra", comment: "" }]);
  const removed = getTowerGroup(
    "1.2.1",
    towers.map((t) => ({ ...t, removed: true })),
    variants,
  );
  assert.deepEqual(removed.placedTowerIds, []);
  assert.deepEqual(removed.activeParticipants, []);
});

test("opening a copy selects its saved owner rather than the first shared participant", () => {
  const participants = [
    { nickname: "Fakra", comment: "Old" },
    { nickname: "Mlue", comment: "Current" },
  ];
  assert.equal(getTowerOwnerIndex(participants, { nickname: "Mlue" }), 1);
  assert.equal(getTowerOwnerIndex(participants, { nickname: null, previous_nickname: "Mlue" }), 1);
  assert.equal(getTowerOwnerIndex(participants, undefined), 0);
});
