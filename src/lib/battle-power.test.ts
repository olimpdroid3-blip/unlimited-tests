import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAwakenedBattlePower,
  calculateAverageBattlePower,
  createBattlePowerRepository,
  findBattlePowerRowByNickname,
  getBattlePowerFormPresentation,
  getBattlePowerValueTone,
  sortBattlePowerRows,
  type BattlePowerInput,
  type BattlePowerRemoteSource,
  type BattlePowerRow,
} from "./battle-power.ts";

function createRow(overrides: Partial<BattlePowerRow> = {}): BattlePowerRow {
  return {
    id: "test-player-01",
    nickname: "Alex",
    power1: 1,
    power2: 2,
    power3: 3,
    power4: 4,
    power5: 5,
    power1_crowned: false,
    power2_crowned: false,
    power3_crowned: false,
    power4_crowned: false,
    power5_crowned: false,
    ...overrides,
  };
}

test("calculates awakened battle power for A0 through A5 and rounds to one decimal", () => {
  assert.equal(calculateAwakenedBattlePower(100, "A0"), 110);
  assert.equal(calculateAwakenedBattlePower(100, "A3"), 113);
  assert.equal(calculateAwakenedBattlePower(139.1, "A5"), 160);
});

test("rejects an empty or invalid base battle power in the awakening calculator", () => {
  assert.equal(calculateAwakenedBattlePower(null, "A0"), null);
  assert.equal(calculateAwakenedBattlePower(Number.NaN, "A5"), null);
  assert.equal(calculateAwakenedBattlePower(-1, "A2"), null);
});

function createRemoteSource(initialRows: BattlePowerRow[]): BattlePowerRemoteSource {
  let rows = [...initialRows];
  return {
    async getAll() {
      return [...rows];
    },
    async create(input) {
      const row = { id: `remote-${rows.length + 1}`, ...input };
      rows = [...rows, row];
      return row;
    },
    async update(id, input) {
      rows = rows.map((row) => (row.id === id ? { id, ...input } : row));
      return { id, ...input };
    },
    async remove(id) {
      rows = rows.filter((row) => row.id !== id);
    },
  };
}

test("shows additions inline and edits in a dialog", () => {
  assert.equal(getBattlePowerFormPresentation(false, null), "hidden");
  assert.equal(getBattlePowerFormPresentation(true, null), "inline");
  assert.equal(getBattlePowerFormPresentation(true, "player-01"), "dialog");
});

test("finds the saved battle-power row without case or surrounding-space sensitivity", () => {
  const alex = createRow({ id: "player-alex", nickname: "Alex" });
  const skye = createRow({ id: "player-skye", nickname: "Skye" });

  assert.equal(findBattlePowerRowByNickname([alex, skye], "  aLeX  "), alex);
});

test("returns no battle-power row when the saved nickname is empty or unknown", () => {
  const rows = [createRow({ nickname: "Alex" })];

  assert.equal(findBattlePowerRowByNickname(rows, "   "), undefined);
  assert.equal(findBattlePowerRowByNickname(rows, "Unknown"), undefined);
});

test("highlights battle-power values starting at 150", () => {
  assert.equal(getBattlePowerValueTone(149.9), "standard");
  assert.equal(getBattlePowerValueTone(150), "high");
  assert.equal(getBattlePowerValueTone(155.6), "high");
  assert.equal(getBattlePowerValueTone(null), "standard");
});

test("calculates average battle power from filled values only", () => {
  assert.equal(
    calculateAverageBattlePower(
      createRow({ power1: 100, power2: null, power3: 150, power4: null, power5: 200 }),
    ),
    150,
  );
  assert.equal(
    calculateAverageBattlePower(
      createRow({ power1: null, power2: null, power3: null, power4: null, power5: null }),
    ),
    null,
  );
});

test("sorts battle-power rows by nickname in either direction without mutating the input", () => {
  const skye = createRow({ id: "skye", nickname: "Skye" });
  const alex = createRow({ id: "alex", nickname: "Alex" });
  const rows = [skye, alex];

  assert.deepEqual(
    sortBattlePowerRows(rows, "nickname", "asc").map(({ id }) => id),
    ["alex", "skye"],
  );
  assert.deepEqual(
    sortBattlePowerRows(rows, "nickname", "desc").map(({ id }) => id),
    ["skye", "alex"],
  );
  assert.deepEqual(rows, [skye, alex]);
});

test("sorts by an individual or average battle power and keeps empty values last", () => {
  const empty = createRow({
    id: "empty",
    power1: null,
    power2: null,
    power3: null,
    power4: null,
    power5: null,
  });
  const lower = createRow({
    id: "lower",
    power1: 140,
    power2: 140,
    power3: 140,
    power4: 140,
    power5: 140,
  });
  const higher = createRow({
    id: "higher",
    power1: 150,
    power2: 160,
    power3: 150,
    power4: 150,
    power5: 140,
  });
  const rows = [empty, lower, higher];

  assert.deepEqual(
    sortBattlePowerRows(rows, "power2", "asc").map(({ id }) => id),
    ["lower", "higher", "empty"],
  );
  assert.deepEqual(
    sortBattlePowerRows(rows, "average", "desc").map(({ id }) => id),
    ["higher", "lower", "empty"],
  );
});

test("returns no battle-power rows when the remote source is empty", async () => {
  const repository = createBattlePowerRepository(createRemoteSource([]));

  assert.deepEqual(await repository.getAll(), []);
});

test("delegates every mutation to the remote source, including legacy test-player ids", async () => {
  const remote = createRemoteSource([]);
  const repository = createBattlePowerRepository(remote);
  const input: BattlePowerInput = {
    nickname: "Remote Player",
    power1: 10,
    power2: null,
    power3: null,
    power4: null,
    power5: null,
    power1_crowned: true,
    power2_crowned: false,
    power3_crowned: false,
    power4_crowned: false,
    power5_crowned: false,
  };

  const created = await repository.create(input);
  const updated = await repository.update("test-player-01", {
    ...input,
    nickname: "Updated Remote",
  });

  assert.equal(created.nickname, "Remote Player");
  assert.equal(updated.id, "test-player-01");
  assert.equal(updated.nickname, "Updated Remote");

  await repository.remove(created.id);
  assert.deepEqual(await remote.getAll(), []);
});
