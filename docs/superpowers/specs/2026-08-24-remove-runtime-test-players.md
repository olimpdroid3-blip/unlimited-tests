# Remove Runtime Test Players Design

## Goal

Show only real Supabase records in the battle-power table so deleted players such as BloodReaper cannot be restored from bundled test data.

## Scope

- Remove bundled battle-power players from the production data path.
- Make battle-power reads and mutations use the Supabase-backed remote source only.
- Remove test-player local overrides and tombstones, which are no longer needed.
- Preserve the mob catalog, real Supabase rows, calculator behavior, crown persistence, sorting, and form behavior.

## Verification

- A repository backed by an empty remote source returns no rows.
- A repository returns and mutates only remote rows, including IDs that begin with `test-player-`.
- The complete automated test suite, lint, and production build pass.

