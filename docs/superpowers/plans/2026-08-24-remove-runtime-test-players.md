# Remove Runtime Test Players Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the battle-power table contains only records returned by Supabase.

**Architecture:** Keep `BattlePowerRemoteSource` as the single repository contract and turn `createBattlePowerRepository` into a remote-only adapter that normalizes and sorts fetched rows while delegating all mutations. Remove the production import of bundled player fixtures; retain mob catalog fixtures because they are outside this change.

**Tech Stack:** TypeScript, Node test runner, React/TanStack Start, Supabase

**Spec:** `docs/superpowers/specs/2026-08-24-remove-runtime-test-players.md`

## Global Constraints

- Do not modify or delete real Supabase rows.
- Preserve the mob catalog and battle-power calculator/crown behavior.
- Do not rewrite published Git history.

---

### Task 1: Make the battle-power repository remote-only

**Files:**
- Modify: `src/lib/battle-power.test.ts`
- Modify: `src/lib/battle-power.ts`
- Modify: `src/lib/battle-power-ui.ts`

**Interfaces:**
- Consumes: `BattlePowerRemoteSource`
- Produces: `createBattlePowerRepository(remoteSource: BattlePowerRemoteSource): BattlePowerRepository`

- [x] **Step 1: Write the failing test**

Replace seed/local-storage repository tests with a regression test that creates an empty remote source and asserts `getAll()` is empty, plus a delegation test proving every mutation—including an ID prefixed with `test-player-`—uses the remote source.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/battle-power.test.ts`

Expected: FAIL because the current repository requires seed rows and treats `test-player-` IDs as local fixtures.

- [x] **Step 3: Write minimal implementation**

Remove seed and storage parameters, local override/tombstone constants and helpers, and test-player branching. Normalize and sort remote `getAll()` rows, then delegate `create`, `update`, and `remove` directly to `remoteSource`. Instantiate the UI repository with only `supabaseBattlePowerSource` and remove the `test-player-data` import.

- [x] **Step 4: Run focused tests to verify they pass**

Run: `npm test -- src/lib/battle-power.test.ts`

Expected: PASS.

- [x] **Step 5: Verify the project**

Run: `npm test`, `npm run lint`, and `npm run build`.

Expected: all commands exit successfully.
