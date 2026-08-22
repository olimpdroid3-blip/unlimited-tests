# Local Test Player Data Design

## Goal

Make the players, battle-power values, mobs, images, and player mob levels from `BD-BS.xlsx` available in the existing frontend for testing without writing any imported data to Supabase.

## Source data

The local seed is generated from the supplied workbook and contains:

- 17 test players;
- five battle-power values per player, with the lord value retained for a future migration;
- 44 shared mob definitions;
- 42 referenced mob images and placeholders for the two mobs without an image;
- 606 player-to-mob level records;
- empty catalog entries for new mobs that do not have player levels yet.

## Data model

Test players use stable IDs prefixed with `test-player-`. Mob definitions are shared across every player and use stable IDs prefixed with `mob-`. Player mob levels reference those two IDs, so the catalog and image metadata are not duplicated per player.

The generated fixture is immutable application data. Browser edits are stored separately as local overrides.

## Runtime behavior

### Battle power

The battle-power page reads live Supabase rows and local seeded rows through a composite repository. Exact nickname matches are deduplicated case-insensitively, preferring the live Supabase row. Imported test rows can be edited or hidden locally without calling Supabase. Existing Supabase rows keep their current create, edit, and delete behavior.

The current screen continues to display `power1` through `power5`. The lord value remains in the fixture for the later database migration.

### Mob catalog and levels

The mob catalog uses the generated mob fixture as its base source. Existing local name overrides continue to apply globally to the shared mob definition.

The mob-level repository uses the generated player levels as defaults. Reads merge defaults with local overrides. Edits and removals are persisted in `localStorage`. A removed seeded level remains removed through a local tombstone rather than reappearing on the next read.

### Reset semantics

Clearing the application's local-storage keys removes all test edits and restores the workbook values on the next page load. Supabase data is never changed by resetting local test data.

## Images

Only images referenced by the 44 mob columns are copied into `public/mobs`. Unreferenced workbook media is excluded. Mobs without an attached image render the existing placeholder state.

## Testing

Unit tests cover fixture integrity, seed fallback, overrides, removals, composite player merging, and routing mutations to local or Supabase storage. A production build and browser smoke test verify that both battle-power and mob-level pages display the imported players and mobs.
