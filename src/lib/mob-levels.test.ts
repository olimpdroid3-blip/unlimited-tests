import assert from "node:assert/strict";
import test from "node:test";

import {
  MOB_LEVELS_STORAGE_KEY,
  MOB_NAME_OVERRIDES_STORAGE_KEY,
  createLocalStorageMobLevelsRepository,
  createLocalStorageMobCatalogRepository,
  emptyMobCatalogRepository,
  getChangedMobNames,
  getRemovedMobIds,
  haveSameMobNameDraft,
  haveSameMobLevelDraft,
  isValidMobName,
  isValidMobLevel,
  resolvePlayerMobs,
  sortPlayerOptions,
  type Mob,
  type StorageLike,
} from "./mob-levels.ts";

function createMemoryStorage(initialValue?: string): StorageLike {
  const values = new Map<string, string>();
  if (initialValue !== undefined) {
    values.set(MOB_LEVELS_STORAGE_KEY, initialValue);
  }

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

function createStaticMobCatalog(mobs: Mob[]) {
  return {
    async getAll() {
      return mobs;
    },
  };
}

test("accepts only integer mob levels from 1 through 30", () => {
  assert.equal(isValidMobLevel(1), true);
  assert.equal(isValidMobLevel(30), true);
  assert.equal(isValidMobLevel(0), false);
  assert.equal(isValidMobLevel(31), false);
  assert.equal(isValidMobLevel(2.5), false);
  assert.equal(isValidMobLevel(Number.NaN), false);
});

test("returns an empty list for malformed stored JSON", async () => {
  const repository = createLocalStorageMobLevelsRepository(createMemoryStorage("not-json"));

  assert.deepEqual(await repository.getByPlayer("player-1"), []);
});

test("filters malformed and out-of-range stored records", async () => {
  const repository = createLocalStorageMobLevelsRepository(
    createMemoryStorage(
      JSON.stringify([
        {
          playerId: "player-1",
          mobId: "mob-1",
          level: 30,
          updatedAt: "2026-08-16T10:00:00.000Z",
        },
        {
          playerId: "player-1",
          mobId: "mob-2",
          level: 31,
          updatedAt: "2026-08-16T10:00:00.000Z",
        },
        {
          playerId: "",
          mobId: "mob-3",
          level: 10,
          updatedAt: "2026-08-16T10:00:00.000Z",
        },
      ]),
    ),
  );

  assert.deepEqual(await repository.getByPlayer("player-1"), [
    {
      playerId: "player-1",
      mobId: "mob-1",
      level: 30,
      updatedAt: "2026-08-16T10:00:00.000Z",
    },
  ]);
});

test("upserts matching player and mob pairs without changing other players", async () => {
  const storage = createMemoryStorage();
  const repository = createLocalStorageMobLevelsRepository(storage);

  await repository.upsertMany([
    { playerId: "player-2", mobId: "mob-1", level: 9 },
    { playerId: "player-1", mobId: "mob-2", level: 12 },
  ]);
  await repository.upsertMany([
    { playerId: "player-1", mobId: "mob-2", level: 18 },
    { playerId: "player-1", mobId: "mob-1", level: 30 },
  ]);

  assert.deepEqual(
    (await repository.getByPlayer("player-1")).map(({ mobId, level }) => ({
      mobId,
      level,
    })),
    [
      { mobId: "mob-1", level: 30 },
      { mobId: "mob-2", level: 18 },
    ],
  );
  assert.deepEqual(
    (await repository.getByPlayer("player-2")).map(({ mobId, level }) => ({
      mobId,
      level,
    })),
    [{ mobId: "mob-1", level: 9 }],
  );
});

test("rejects an invalid upsert batch without changing storage", async () => {
  const storage = createMemoryStorage();
  const repository = createLocalStorageMobLevelsRepository(storage);
  await repository.upsertMany([{ playerId: "player-1", mobId: "mob-1", level: 10 }]);
  const before = storage.getItem(MOB_LEVELS_STORAGE_KEY);

  await assert.rejects(
    repository.upsertMany([
      { playerId: "player-1", mobId: "mob-1", level: 20 },
      { playerId: "player-1", mobId: "mob-2", level: 31 },
    ]),
    /від 1 до 30/,
  );

  assert.equal(storage.getItem(MOB_LEVELS_STORAGE_KEY), before);
});

test("removes only the selected player and mob relation", async () => {
  const repository = createLocalStorageMobLevelsRepository(createMemoryStorage());
  await repository.upsertMany([
    { playerId: "player-1", mobId: "mob-1", level: 10 },
    { playerId: "player-1", mobId: "mob-2", level: 20 },
    { playerId: "player-2", mobId: "mob-1", level: 30 },
  ]);

  await repository.remove("player-1", "mob-1");

  assert.deepEqual(
    (await repository.getByPlayer("player-1")).map(({ mobId }) => mobId),
    ["mob-2"],
  );
  assert.equal((await repository.getByPlayer("player-2")).length, 1);
});

test("empty catalog deliberately returns no fake mobs", async () => {
  assert.deepEqual(await emptyMobCatalogRepository.getAll(), []);
});

test("stores a shared mob name override and merges it into every catalog read", async () => {
  const storage = createMemoryStorage();
  const baseCatalog = createStaticMobCatalog([
    { id: "mob-1", name: "Стара назва", imageUrl: "/mob-1.webp" },
    { id: "mob-2", name: "Інший моб", imageUrl: null },
  ]);
  const repository = createLocalStorageMobCatalogRepository(baseCatalog, storage);

  await repository.updateNames([{ id: "mob-1", name: "  Нова назва  " }]);

  assert.deepEqual(await repository.getAll(), [
    { id: "mob-1", name: "Нова назва", imageUrl: "/mob-1.webp" },
    { id: "mob-2", name: "Інший моб", imageUrl: null },
  ]);
  assert.deepEqual(
    await createLocalStorageMobCatalogRepository(baseCatalog, storage).getAll(),
    [
      { id: "mob-1", name: "Нова назва", imageUrl: "/mob-1.webp" },
      { id: "mob-2", name: "Інший моб", imageUrl: null },
    ],
  );
});

test("rejects an invalid mob name batch without changing catalog or level storage", async () => {
  const storage = createMemoryStorage();
  const repository = createLocalStorageMobCatalogRepository(
    createStaticMobCatalog([
      { id: "mob-1", name: "Перший", imageUrl: null },
      { id: "mob-2", name: "Другий", imageUrl: null },
    ]),
    storage,
  );
  await createLocalStorageMobLevelsRepository(storage).upsertMany([
    { playerId: "player-1", mobId: "mob-1", level: 12 },
  ]);
  await repository.updateNames([{ id: "mob-1", name: "Збережена назва" }]);
  const namesBefore = storage.getItem(MOB_NAME_OVERRIDES_STORAGE_KEY);
  const levelsBefore = storage.getItem(MOB_LEVELS_STORAGE_KEY);

  await assert.rejects(
    repository.updateNames([
      { id: "mob-1", name: "Нова назва" },
      { id: "mob-2", name: "   " },
    ]),
    /Назва моба/,
  );

  assert.equal(storage.getItem(MOB_NAME_OVERRIDES_STORAGE_KEY), namesBefore);
  assert.equal(storage.getItem(MOB_LEVELS_STORAGE_KEY), levelsBefore);
  assert.deepEqual(
    (await repository.getAll()).map(({ id, name }) => ({ id, name })),
    [
      { id: "mob-1", name: "Збережена назва" },
      { id: "mob-2", name: "Другий" },
    ],
  );
});

test("joins levels to catalog mobs, omits missing mobs, and sorts by name", () => {
  const resolved = resolvePlayerMobs(
    [
      {
        playerId: "player-1",
        mobId: "mob-2",
        level: 10,
        updatedAt: "2026-08-16T10:00:00.000Z",
      },
      {
        playerId: "player-1",
        mobId: "missing",
        level: 20,
        updatedAt: "2026-08-16T10:00:00.000Z",
      },
      {
        playerId: "player-1",
        mobId: "mob-1",
        level: 30,
        updatedAt: "2026-08-16T10:00:00.000Z",
      },
    ],
    [
      { id: "mob-1", name: "Альфа", imageUrl: null },
      { id: "mob-2", name: "Бета", imageUrl: "/beta.webp" },
    ],
  );

  assert.deepEqual(
    resolved.map(({ mob, level }) => ({ name: mob.name, level })),
    [
      { name: "Альфа", level: 30 },
      { name: "Бета", level: 10 },
    ],
  );
});

test("sorts Latin player nicknames before Cyrillic nicknames", () => {
  assert.deepEqual(
    sortPlayerOptions([
      { id: "3", nickname: "Ярина" },
      { id: "2", nickname: "Bravo" },
      { id: "1", nickname: "alpha" },
      { id: "4", nickname: "Анна" },
    ]).map(({ nickname }) => nickname),
    ["alpha", "Bravo", "Анна", "Ярина"],
  );
});

test("compares mob level drafts independently of row order", () => {
  assert.equal(
    haveSameMobLevelDraft(
      [
        { mobId: "mob-1", level: 10 },
        { mobId: "mob-2", level: 20 },
      ],
      [
        { mobId: "mob-2", level: 20 },
        { mobId: "mob-1", level: 10 },
      ],
    ),
    true,
  );
  assert.equal(
    haveSameMobLevelDraft([{ mobId: "mob-1", level: 10 }], [{ mobId: "mob-1", level: 11 }]),
    false,
  );
});

test("finds mobs removed from an editor draft", () => {
  assert.deepEqual(
    getRemovedMobIds(
      [
        { mobId: "mob-1", level: 10 },
        { mobId: "mob-2", level: 20 },
      ],
      [{ mobId: "mob-2", level: 20 }],
    ),
    ["mob-1"],
  );
});

test("accepts a non-empty mob name and rejects whitespace", () => {
  assert.equal(isValidMobName("Бос павуків"), true);
  assert.equal(isValidMobName("  Бос павуків  "), true);
  assert.equal(isValidMobName("   "), false);
  assert.equal(isValidMobName(null), false);
});

test("compares mob name drafts by mob id after trimming names", () => {
  assert.equal(
    haveSameMobNameDraft(
      [
        { mobId: "mob-1", name: "Альфа" },
        { mobId: "mob-2", name: "Бета" },
      ],
      [
        { mobId: "mob-2", name: " Бета " },
        { mobId: "mob-1", name: "Альфа" },
      ],
    ),
    true,
  );
  assert.equal(
    haveSameMobNameDraft(
      [{ mobId: "mob-1", name: "Альфа" }],
      [{ mobId: "mob-1", name: "Інша назва" }],
    ),
    false,
  );
});

test("returns only changed mob names with normalized values", () => {
  assert.deepEqual(
    getChangedMobNames(
      [
        { mobId: "mob-1", name: "Альфа" },
        { mobId: "mob-2", name: "Бета" },
      ],
      [
        { mobId: "mob-2", name: "  Нова Бета  " },
        { mobId: "mob-1", name: " Альфа " },
      ],
    ),
    [{ id: "mob-2", name: "Нова Бета" }],
  );
});
