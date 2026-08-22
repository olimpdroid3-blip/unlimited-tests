# Global Mob Name Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared mob-name editor whose saved values apply to every player while player levels remain independent.

**Architecture:** Decorate the base mob catalog repository with a localStorage-backed name-override adapter keyed only by `mobId`. The editor keeps catalog-name drafts separate from player-level drafts, saves both from the existing button, and refreshes the shared catalog query so all player views resolve the same names.

**Tech Stack:** TypeScript, React 19, TanStack Router, TanStack Query, browser localStorage, Node test runner, ESLint, Vite.

## Global Constraints

- Mob names belong to the shared catalog and must never be stored in `PlayerMobLevel`.
- Name overrides use a localStorage adapter until the Supabase catalog is connected.
- Mob names are trimmed and must contain at least one non-whitespace character.
- The existing save button persists both level changes and name changes.
- The empty catalog state remains unchanged until mob catalog data is added.
- Mob image editing, catalog insertion/deletion, Excel import, and Supabase connection are out of scope.

---

### Task 1: Shared catalog override adapter

**Files:**
- Modify: `src/lib/mob-levels.test.ts`
- Modify: `src/lib/mob-levels.ts`

**Interfaces:**
- Consumes: `StorageLike`, `Mob`, and a base `MobCatalogRepository`.
- Produces: `MOB_NAME_OVERRIDES_STORAGE_KEY`, `MobNameInput`, `MobCatalogRepository.updateNames(inputs: MobNameInput[]): Promise<Mob[]>`, and `createLocalStorageMobCatalogRepository(baseRepository, storage?)`.

- [ ] **Step 1: Write failing repository tests**

Add tests that call the desired API:

```ts
const repository = createLocalStorageMobCatalogRepository(
  createStaticMobCatalog([
    { id: "mob-1", name: "Стара назва", imageUrl: "/mob-1.webp" },
    { id: "mob-2", name: "Інший моб", imageUrl: null },
  ]),
  storage,
);

await repository.updateNames([{ id: "mob-1", name: "  Нова назва  " }]);

assert.deepEqual(await repository.getAll(), [
  { id: "mob-1", name: "Нова назва", imageUrl: "/mob-1.webp" },
  { id: "mob-2", name: "Інший моб", imageUrl: null },
]);
```

Add separate assertions that a second repository instance reads the same override, unrelated mobs remain unchanged, and a batch containing a blank name rejects without altering storage.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test src/lib/mob-levels.test.ts
```

Expected: FAIL because `createLocalStorageMobCatalogRepository` and the writable catalog interface do not exist.

- [ ] **Step 3: Implement the minimal adapter**

Add the shared storage key and interfaces:

```ts
export const MOB_NAME_OVERRIDES_STORAGE_KEY = "gvg.mob-name-overrides.v1";

export type MobNameInput = Pick<Mob, "id" | "name">;

export interface MobCatalogRepository {
  getAll(): Promise<Mob[]>;
  updateNames(inputs: MobNameInput[]): Promise<Mob[]>;
}
```

Implement `createLocalStorageMobCatalogRepository` so it validates the complete input batch first, writes a single JSON object keyed by `mobId`, trims saved names, and merges overrides only for IDs returned by the base repository. Keep `emptyMobCatalogRepository.updateNames([])` valid and reject non-empty updates because no catalog mob exists.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
node --test src/lib/mob-levels.test.ts
```

Expected: all mob-level tests pass with no warnings.

- [ ] **Step 5: Commit the adapter**

```bash
git add src/lib/mob-levels.ts src/lib/mob-levels.test.ts
git commit -m "feat: add shared mob name overrides"
```

### Task 2: Name draft helpers

**Files:**
- Modify: `src/lib/mob-levels.test.ts`
- Modify: `src/lib/mob-levels.ts`

**Interfaces:**
- Consumes: `MobNameDraft = { mobId: string; name: string }`.
- Produces: `isValidMobName(name: unknown): name is string`, `haveSameMobNameDraft(left, right): boolean`, and `getChangedMobNames(baseline, draft): MobNameInput[]`.

- [ ] **Step 1: Write failing helper tests**

Cover these behaviors:

```ts
assert.equal(isValidMobName("  "), false);
assert.equal(isValidMobName("Бос павуків"), true);
assert.equal(
  haveSameMobNameDraft(
    [{ mobId: "mob-1", name: "Альфа" }],
    [{ mobId: "mob-1", name: " Альфа " }],
  ),
  true,
);
assert.deepEqual(
  getChangedMobNames(
    [{ mobId: "mob-1", name: "Альфа" }, { mobId: "mob-2", name: "Бета" }],
    [{ mobId: "mob-2", name: "Нова Бета" }, { mobId: "mob-1", name: "Альфа" }],
  ),
  [{ id: "mob-2", name: "Нова Бета" }],
);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test src/lib/mob-levels.test.ts
```

Expected: FAIL because the draft helper exports are missing.

- [ ] **Step 3: Implement minimal pure helpers**

Normalize names with `trim()`, compare drafts after sorting by `mobId`, and return only valid changed names as `{ id, name }` records. Keep all functions immutable.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same Node test command and expect all tests to pass.

- [ ] **Step 5: Commit the helpers**

```bash
git add src/lib/mob-levels.ts src/lib/mob-levels.test.ts
git commit -m "feat: add mob name draft helpers"
```

### Task 3: Editor integration

**Files:**
- Modify: `src/lib/mob-levels-ui.ts`
- Modify: `src/routes/mob-levels_.edit.tsx`

**Interfaces:**
- Consumes: `createLocalStorageMobCatalogRepository`, `MobNameDraft`, `getChangedMobNames`, `haveSameMobNameDraft`, and `isValidMobName`.
- Produces: a `mobCatalogRepository` with `getAll()` and `updateNames()`, plus inline shared-name fields on `/mob-levels/edit`.

- [ ] **Step 1: Connect the writable catalog adapter**

Wrap the existing empty base catalog:

```ts
export const mobCatalogRepository = createLocalStorageMobCatalogRepository(
  emptyMobCatalogRepository,
);
```

- [ ] **Step 2: Add independent name baseline and draft state**

When catalog data loads, derive one row per catalog mob:

```ts
const loadedNames = catalog.map(({ id, name }) => ({ mobId: id, name }));
setNameBaseline(loadedNames);
setNameDraft(loadedNames);
```

Compute `hasLevelChanges`, `hasNameChanges`, valid states, and enable saving when either draft changed. Include name changes in the existing unsaved-change confirmation.

- [ ] **Step 3: Add the inline name input**

Render a labelled text input in each selected mob row:

```tsx
<label className="mt-1 block text-xs text-muted-foreground">
  Назва моба
  <Input
    value={mobName}
    onChange={(event) => updateMobName(mob.id, event.target.value)}
    aria-invalid={!isValidMobName(mobName)}
  />
</label>
```

Show `Назва не може бути порожньою` for an invalid value. The draft is global even though the row is shown under the selected player.

- [ ] **Step 4: Save only changed global names with level changes**

Before refreshing baselines, execute:

```ts
const changedNames = getChangedMobNames(nameBaseline, nameDraft);
await mobCatalogRepository.updateNames(changedNames);
```

Then save/remove player levels using the existing flow, reload catalog and selected-player levels, update both baselines, invalidate `['mob-catalog']` and `['mob-levels', selectedPlayerId]`, and use success copy that mentions both data types when both changed.

- [ ] **Step 5: Run type-aware lint on changed files**

Run:

```bash
npx eslint src/lib/mob-levels.ts src/lib/mob-levels.test.ts src/lib/mob-levels-ui.ts src/routes/mob-levels_.edit.tsx src/routes/mob-levels.tsx
```

Expected: exit code 0 with no warnings.

- [ ] **Step 6: Commit the editor**

```bash
git add src/lib/mob-levels-ui.ts src/routes/mob-levels_.edit.tsx
git commit -m "feat: edit shared mob names"
```

### Task 4: Verification

**Files:**
- Verify only; no production files expected.

**Interfaces:**
- Consumes: the completed catalog adapter and editor.
- Produces: evidence that tests, lint, production build, and browser flow are healthy.

- [ ] **Step 1: Run all domain tests**

```bash
node --test src/lib/mob-levels.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run scoped lint**

```bash
npx eslint src/lib/mob-levels.ts src/lib/mob-levels.test.ts src/lib/mob-levels-ui.ts src/routes/mob-levels_.edit.tsx src/routes/mob-levels.tsx
```

Expected: exit code 0.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: Vite client and SSR builds finish successfully.

- [ ] **Step 4: Browser smoke test**

Run the app, open `/mob-levels/edit`, and verify the current empty catalog state still renders without console errors. When a catalog fixture is available, verify editing one name keeps the save button enabled until click, persists after reload, and appears under a second player.

- [ ] **Step 5: Review branch state**

```bash
git status --short
git log --oneline -8
```

Expected: no uncommitted implementation files and the design, plan, adapter, helpers, and editor commits are present.
