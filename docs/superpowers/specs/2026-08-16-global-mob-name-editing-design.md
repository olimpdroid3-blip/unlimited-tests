# Global Mob Name Editing Design

## Goal

Allow an editor to rename a mob on `/mob-levels/edit` and save that rename with the existing “Зберегти зміни” action. A mob name belongs to the shared catalog, so every player must see the same updated name.

## Data ownership

- `Mob.name` remains catalog data shared by all players.
- `PlayerMobLevel` remains player-specific and stores only `playerId`, `mobId`, `level`, and `updatedAt`.
- Local persistence stores name overrides separately from player levels as `mobId → name`.
- The catalog repository merges persisted overrides onto its base catalog when `getAll()` is called.
- A future Supabase catalog repository can implement the same interface by updating the single `mobs` row identified by `mobId`.

This avoids copying a mob name into every player's level record and preserves stable relationships when a name changes.

## Repository interface

Extend `MobCatalogRepository` with a batch name-update operation. The operation:

1. trims surrounding whitespace;
2. rejects an empty name;
3. validates the complete batch before writing;
4. stores one override per `mobId`;
5. preserves overrides for mobs not included in the current batch.

The localStorage adapter decorates a base catalog repository. Until a real catalog is connected, the base catalog remains empty and the existing empty state remains visible.

## Editor behavior

Each mob already present in the selected player's draft receives a text input labelled “Назва моба”. The editor maintains two independent drafts:

- player level draft;
- shared mob-name draft keyed by `mobId`.

The save button is enabled when either draft differs from its baseline and all levels and names are valid. Clicking it saves changed global names and the selected player's level changes. Names are trimmed before persistence.

After success, the editor refreshes its baselines and invalidates the shared `mob-catalog` query plus the selected player's levels query. The viewer and editor then resolve every player's display through the same updated catalog.

Changing players with unsaved level or name changes uses the existing discard confirmation.

## Validation and errors

- A mob name must contain at least one non-whitespace character.
- Invalid names show an inline message and disable saving.
- A failed save leaves the user's drafts in the form and shows the existing error presentation.
- No player-level record contains or duplicates the mob name.

## Testing

- Repository tests prove that a saved override is merged into the shared catalog.
- Repository tests prove unrelated mob names and player-level storage remain unchanged.
- Repository tests prove an invalid batch does not partially update storage.
- Pure draft helpers are tested for order-independent name comparison and changed-name extraction.
- Existing level tests remain green.
- A browser smoke test verifies the new field and save state with a temporary catalog fixture when catalog data is available.

## Non-goals

- Adding, deleting, or reordering catalog mobs.
- Editing mob images.
- Importing the Excel catalog in this change.
- Connecting the catalog to Supabase in this change.
