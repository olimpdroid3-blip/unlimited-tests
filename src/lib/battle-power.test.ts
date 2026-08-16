import assert from "node:assert/strict";
import test from "node:test";

import {
  createBattlePowerRepository,
  type BattlePowerInput,
  type BattlePowerRemoteSource,
  type BattlePowerRow,
} from "./battle-power.ts";
import type { StorageLike } from "./mob-levels.ts";

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function createRow(overrides: Partial<BattlePowerRow> = {}): BattlePowerRow {
  return {
    id: "test-player-01",
    nickname: "Alex",
    power1: 1,
    power2: 2,
    power3: 3,
    power4: 4,
    power5: 5,
    ...overrides,
  };
}

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

test("merges test and remote players while preferring an exact nickname match from remote", async () => {
  const repository = createBattlePowerRepository(
    createRemoteSource([createRow({ id: "live", nickname: "alex" })]),
    [
      createRow({ id: "test-player-01", nickname: "Alex" }),
      createRow({ id: "test-player-02", nickname: "Skye" }),
    ],
    createMemoryStorage(),
  );

  assert.deepEqual(
    (await repository.getAll()).map(({ id }) => id),
    ["live", "test-player-02"],
  );
});

test("updates a test row locally", async () => {
  const remote = createRemoteSource([]);
  const repository = createBattlePowerRepository(remote, [createRow()], createMemoryStorage());
  const input: BattlePowerInput = {
    nickname: "Local Alex",
    power1: 10,
    power2: null,
    power3: null,
    power4: null,
    power5: null,
  };

  await repository.update("test-player-01", input);

  assert.deepEqual(await repository.getAll(), [{ id: "test-player-01", ...input }]);
  assert.deepEqual(await remote.getAll(), []);
});

test("hides a deleted test row across repository instances", async () => {
  const storage = createMemoryStorage();
  const remote = createRemoteSource([]);

  await createBattlePowerRepository(remote, [createRow()], storage).remove("test-player-01");

  assert.deepEqual(await createBattlePowerRepository(remote, [createRow()], storage).getAll(), []);
});

test("delegates create and live-row mutations to the remote source", async () => {
  const remote = createRemoteSource([]);
  const repository = createBattlePowerRepository(remote, [createRow()], createMemoryStorage());
  const input = createRow({ id: "ignored", nickname: "Remote Player" });

  const created = await repository.create(input);
  await repository.update(created.id, { ...input, nickname: "Updated Remote" });
  await repository.remove(created.id);

  assert.deepEqual(await remote.getAll(), []);
  assert.equal((await repository.getAll())[0].id, "test-player-01");
});
