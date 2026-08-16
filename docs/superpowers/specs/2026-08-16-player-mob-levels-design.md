# Player mob levels frontend design

## Goal

Add a working frontend for viewing and editing the level of each hero owned by a player. Levels are temporarily persisted in browser `localStorage`. The pages must depend on a repository interface so the persistence implementation can later be replaced with Supabase without rewriting page components.

## Scope

This change adds:

- `/mob-levels` for selecting a player and viewing that player's saved heroes and levels;
- `/mob-levels/edit` for adding heroes, changing levels, removing heroes, and saving changes;
- navigation entries for the new functionality;
- a versioned local-storage adapter with validation and deterministic serialization;
- tests for persistence and the level validation boundary.

This change does not create or alter Supabase tables. It does not yet modify the walkthrough form. A future walkthrough integration will call the same repository interface to update levels entered for the selected player.

## Data model

Each level belongs to a stable player record and a hero:

```ts
type PlayerMobLevel = {
  playerId: string;
  heroId: string;
  level: number;
  updatedAt: string;
};
```

`playerId` uses the existing `battle_power.id`. The nickname is display data fetched from `battle_power`, not the persistence key. `heroId` uses the existing `heroes.id`. Valid levels are integers from 1 through 30 inclusive.

The local-storage key is `gvg.mob-levels.v1`. Stored input is treated as untrusted: malformed records and records outside the valid level range are ignored when read.

## Repository boundary

Pages consume a small asynchronous repository contract:

```ts
interface MobLevelsRepository {
  getByPlayer(playerId: string): Promise<PlayerMobLevel[]>;
  upsertMany(levels: PlayerMobLevelInput[]): Promise<PlayerMobLevel[]>;
  remove(playerId: string, heroId: string): Promise<void>;
}
```

The initial implementation uses `localStorage`. Methods remain asynchronous so a later Supabase implementation can replace it without changing page behavior. The adapter is client-safe and does not access `window` during server rendering.

`upsertMany` validates the complete batch before writing, assigns a common `updatedAt`, replaces matching `(playerId, heroId)` pairs, preserves unrelated players, and writes the normalized collection once.

## Data sources

- Player choices come from the existing `battle_power` table and include `id` plus `nickname`.
- Hero names and icons come from the existing `heroes` table.
- Only player-to-hero levels come from the adapter.

Loading or query failures are shown as a clear error state. Local-storage failures show a toast and keep unsaved form state intact.

## `/mob-levels` viewer

The viewer contains:

- a nickname selector populated from `battle_power`;
- an optional hero-name filter;
- a responsive list of the selected player's saved heroes;
- each hero's icon, Ukrainian name, and level;
- an empty state when the player has no saved heroes;
- a link to `/mob-levels/edit` that preserves the selected `playerId` in the search parameters.

The list is sorted by Ukrainian hero name. Records whose hero no longer exists are omitted from the visual list without deleting local data.

## `/mob-levels/edit` editor

The editor contains:

- a player selector;
- the selected player's current draft list;
- level inputs constrained to integer values from 1 through 30;
- removal controls for draft rows;
- a searchable hero picker for adding a hero not already in the draft;
- one `Save changes` action for the full draft.

Removing a row affects the draft first. Saving computes the difference from the originally loaded rows, upserts present rows, and removes deleted rows. Switching players with unsaved changes asks for confirmation before discarding the draft.

Duplicate heroes cannot be added. Invalid or incomplete rows disable saving and display an inline validation message. Successful saving shows a toast and refreshes the stored baseline.

## Navigation

The home page gains a card for mob levels. The application header gains a compact link when consistent with the existing responsive navigation. Viewer and editor link to one another and provide a path back to the home page.

## Future Supabase adapter

The future table should have a unique `(player_id, hero_id)` pair and a level check constraint:

```text
player_mob_levels
  player_id uuid
  hero_id uuid
  level smallint check (level between 1 and 30)
  updated_at timestamptz
```

When that table is available, a Supabase-backed implementation will satisfy the same repository contract. The route components, validation, and walkthrough integration contract will remain unchanged.

## Verification

- Unit tests cover empty storage, valid reads, malformed data filtering, upserts, removals, player isolation, and the 1/30 boundaries.
- Type checking and the production build verify route generation and server-render safety.
- Manual smoke testing covers adding, editing, removing, refreshing, switching nicknames, empty states, and mobile layout.

