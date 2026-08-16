# Local Test Player Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the supplied Excel players, battle power, mobs, images, and mob levels into the frontend as editable local test data without modifying Supabase.

**Architecture:** A generated immutable fixture supplies shared player and mob records. Existing local-storage adapters layer edits and deletion tombstones over fixture defaults, while a composite battle-power repository merges local test players with live Supabase rows and routes mutations according to the row ID prefix.

**Tech Stack:** TypeScript, React 19, TanStack Router/Query, Supabase client, browser `localStorage`, Node test runner.

## Global Constraints

- Do not write imported test data to Supabase.
- Mob levels must remain integers from 1 through 30.
- Mob names and images are shared by every player.
- Exact case-insensitive nickname duplicates prefer the live Supabase row.
- Clearing local-storage override keys restores workbook seed values.
- Keep the sixth lord battle-power value in the fixture without adding it to the current five-column UI.

---

### Task 1: Generate and validate the workbook fixture

**Files:**
- Create: `src/lib/test-player-data.ts`
- Create: `src/lib/test-player-data.test.ts`
- Create: `public/mobs/image1.png` through the referenced workbook image names

**Interfaces:**
- Produces: `TestBattlePowerRow`, `testBattlePowerRows`, `testMobCatalog`, and `testPlayerMobLevels`.
- Consumes: normalized workbook rows and referenced media from `BD-BS.xlsx`.

- [ ] **Step 1: Write the failing fixture-integrity test**

```ts
test("contains the complete normalized workbook fixture", () => {
  assert.equal(testBattlePowerRows.length, 17);
  assert.equal(testMobCatalog.length, 44);
  assert.equal(testPlayerMobLevels.length, 606);
  assert.equal(new Set(testBattlePowerRows.map(({ id }) => id)).size, 17);
  assert.equal(new Set(testMobCatalog.map(({ id }) => id)).size, 44);
  assert.equal(testPlayerMobLevels.every(({ level }) => level >= 1 && level <= 30), true);
  assert.equal(testMobCatalog.filter(({ imageUrl }) => imageUrl === null).length, 2);
});
```

- [ ] **Step 2: Run the test and confirm the module is missing**

Run: `node --test src/lib/test-player-data.test.ts`

Expected: FAIL because `./test-player-data.ts` does not exist.

- [ ] **Step 3: Generate typed immutable fixture exports and copy only referenced images**

```ts
export type TestBattlePowerRow = {
  id: string;
  nickname: string;
  power1: number | null;
  power2: number | null;
  power3: number | null;
  power4: number | null;
  power5: number | null;
  lordPower: number | null;
};
```

Export the generated literal arrays as `testBattlePowerRows: readonly TestBattlePowerRow[]`, `testMobCatalog: readonly Mob[]`, and `testPlayerMobLevels: readonly PlayerMobLevel[]`. Use stable IDs `test-player-01` through `test-player-17`, mob IDs `mob-01` through `mob-44`, and `/mobs/<workbook-media-name>` URLs. Use `2026-08-16T00:00:00.000Z` as the deterministic seed timestamp.

- [ ] **Step 4: Run the fixture test**

Run: `node --test src/lib/test-player-data.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the fixture and assets**

```bash
git add src/lib/test-player-data.ts src/lib/test-player-data.test.ts public/mobs
git commit -m "data: add local workbook test fixtures"
```

### Task 2: Layer local mob edits over seeded defaults

**Files:**
- Modify: `src/lib/mob-levels.ts`
- Modify: `src/lib/mob-levels.test.ts`

**Interfaces:**
- Consumes: `createLocalStorageMobLevelsRepository(storage?, seedLevels?)`.
- Produces: seeded reads, persisted overrides, and persisted deletion tombstones.

- [ ] **Step 1: Write failing tests for seed fallback, overrides, and tombstones**

```ts
test("returns seeded levels when local storage has no overrides", async () => {
  const seed = [{ playerId: "p1", mobId: "m1", level: 7, updatedAt: "seed" }];
  const repository = createLocalStorageMobLevelsRepository(createMemoryStorage(), seed);
  assert.deepEqual(await repository.getByPlayer("p1"), seed);
});

test("local values override seeded player and mob pairs", async () => {
  const seed = [{ playerId: "p1", mobId: "m1", level: 7, updatedAt: "seed" }];
  const repository = createLocalStorageMobLevelsRepository(createMemoryStorage(), seed);
  await repository.upsertMany([{ playerId: "p1", mobId: "m1", level: 12 }]);
  assert.equal((await repository.getByPlayer("p1"))[0].level, 12);
});

test("removing a seeded level persists a tombstone", async () => {
  const storage = createMemoryStorage();
  const seed = [{ playerId: "p1", mobId: "m1", level: 7, updatedAt: "seed" }];
  await createLocalStorageMobLevelsRepository(storage, seed).remove("p1", "m1");
  assert.deepEqual(
    await createLocalStorageMobLevelsRepository(storage, seed).getByPlayer("p1"),
    [],
  );
});
```

- [ ] **Step 2: Run the focused tests and confirm the current repository ignores seed data**

Run: `node --test src/lib/mob-levels.test.ts`

Expected: FAIL in the three new seed tests.

- [ ] **Step 3: Implement merging and tombstones**

Add `MOB_LEVEL_REMOVALS_STORAGE_KEY = "gvg.mob-level-removals.v1"`. Read validated local override records, merge them over validated seed records by `playerId + mobId`, and filter keys listed in the removal storage. Upsert removes matching tombstones; remove adds a tombstone without copying the full 606-row seed into storage.

- [ ] **Step 4: Run all mob-level tests**

Run: `node --test src/lib/mob-levels.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the seeded adapter**

```bash
git add src/lib/mob-levels.ts src/lib/mob-levels.test.ts
git commit -m "feat: seed local mob level adapter"
```

### Task 3: Add a composite battle-power repository

**Files:**
- Create: `src/lib/battle-power.ts`
- Create: `src/lib/battle-power.test.ts`

**Interfaces:**
- Produces: `BattlePowerRow`, `BattlePowerInput`, `BattlePowerRemoteSource`, and `createBattlePowerRepository(remote, seedRows, storage?)`.
- Consumes: test rows whose IDs start with `test-player-` and a Supabase-backed remote source.

- [ ] **Step 1: Write failing behavioral tests**

```ts
test("merges test and remote players while preferring an exact nickname match from remote", async () => {
  const repository = createBattlePowerRepository(remoteRows([{ id: "live", nickname: "Alex" }]), [
    testRow({ id: "test-player-01", nickname: "Alex" }),
    testRow({ id: "test-player-02", nickname: "Skye" }),
  ], createMemoryStorage());
  assert.deepEqual((await repository.getAll()).map(({ id }) => id), ["live", "test-player-02"]);
});

test("updates a test row locally without calling the remote source", async () => {
  const remote = remoteRows([]);
  const repository = createBattlePowerRepository(remote, [testRow()], createMemoryStorage());
  await repository.update("test-player-01", { nickname: "Local", power1: 10, power2: null, power3: null, power4: null, power5: null });
  assert.equal((await repository.getAll())[0].nickname, "Local");
});

test("hides a deleted test row locally", async () => {
  const storage = createMemoryStorage();
  await createBattlePowerRepository(remoteRows([]), [testRow()], storage).remove("test-player-01");
  assert.deepEqual(await createBattlePowerRepository(remoteRows([]), [testRow()], storage).getAll(), []);
});
```

- [ ] **Step 2: Run the tests and confirm the repository module is missing**

Run: `node --test src/lib/battle-power.test.ts`

Expected: FAIL because `./battle-power.ts` does not exist.

- [ ] **Step 3: Implement the repository**

Use `gvg.test-battle-power-overrides.v1` and `gvg.test-battle-power-removals.v1`. `getAll()` merges remote rows, locally edited seed rows, and unedited seed rows, deduplicates by `nickname.trim().toLocaleLowerCase()`, then applies the existing Latin-before-Cyrillic ordering. `create()` always delegates to remote; `update()` and `remove()` use local storage only for `test-player-*` IDs and delegate all other IDs.

- [ ] **Step 4: Run the repository tests**

Run: `node --test src/lib/battle-power.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the repository**

```bash
git add src/lib/battle-power.ts src/lib/battle-power.test.ts
git commit -m "feat: merge local test battle power data"
```

### Task 4: Wire fixtures into the mob and battle-power screens

**Files:**
- Modify: `src/lib/mob-levels-ui.ts`
- Modify: `src/routes/battle-power.tsx`

**Interfaces:**
- Consumes: fixture exports, seeded mob adapter, and composite battle-power repository.
- Produces: the existing route behavior with local test rows visible and editable.

- [ ] **Step 1: Add fixture-backed mob repositories**

```ts
const fixtureCatalog = {
  async getAll() {
    return [...testMobCatalog];
  },
};

export const mobLevelsRepository = createLocalStorageMobLevelsRepository(
  undefined,
  testPlayerMobLevels,
);
export const mobCatalogRepository = createLocalStorageMobCatalogRepository(fixtureCatalog);
```

Merge `testBattlePowerRows` into `loadMobLevelPlayers()` using the same exact-nickname deduplication rule, so the mob routes remain usable even when Supabase is empty.

- [ ] **Step 2: Replace direct battle-power route mutations with repository calls**

Create a Supabase remote source inside `battle-power.tsx`, instantiate the composite repository with `testBattlePowerRows`, and call `getAll`, `create`, `update`, and `remove` from the existing query and handlers. Change the delete dialog description to “Запис буде видалено.” because test rows are hidden locally rather than deleted from the database.

- [ ] **Step 3: Run unit tests and lint**

Run: `node --test src/lib/mob-levels.test.ts src/lib/test-player-data.test.ts src/lib/battle-power.test.ts`

Run: `npm run lint`

Expected: all tests pass and ESLint reports no new error.

- [ ] **Step 4: Build the application**

Run: `npm run build`

Expected: production build succeeds.

- [ ] **Step 5: Commit route wiring**

```bash
git add src/lib/mob-levels-ui.ts src/routes/battle-power.tsx
git commit -m "feat: show workbook players in test views"
```

### Task 5: Browser smoke test

**Files:**
- Modify only if the smoke test exposes a defect; each defect requires a failing regression test first.

**Interfaces:**
- Consumes: built application routes `/battle-power`, `/mob-levels`, and `/mob-levels/edit`.
- Produces: verified user-visible behavior.

- [ ] **Step 1: Start the development server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite reports a local URL.

- [ ] **Step 2: Verify battle-power test rows**

Open `/battle-power`; confirm workbook nicknames such as `Alex`, `Skye`, and `Zahart` are visible. Edit one test value, reload, and confirm it persists locally.

- [ ] **Step 3: Verify mob catalog and levels**

Open `/mob-levels`; select a workbook player and confirm mob cards, images, and levels render. Open `/mob-levels/edit`, change a level and shared mob name, reload both routes, and confirm both edits persist.

- [ ] **Step 4: Verify reset behavior and final status**

Clear only the `gvg.*` local-storage keys, reload, and confirm workbook defaults return. Run `git status --short` and confirm no uncommitted generated runtime files remain.
