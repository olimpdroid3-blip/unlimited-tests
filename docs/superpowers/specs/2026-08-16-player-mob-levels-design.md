# Player mob levels frontend design

## Goal

Add a frontend for viewing and editing the level of each mob owned by a player. Mobs are a separate domain from the existing `heroes` table. Levels are temporarily persisted in browser `localStorage`. The pages depend on repository interfaces so the persistence implementations can later be replaced with Supabase without rewriting page components.

## Scope

This change adds:

- `/mob-levels` for selecting a player and viewing that player's saved mobs and levels;
- `/mob-levels/edit` for adding mobs, changing levels, removing mobs, and saving changes;
- navigation entries for the new functionality;
- a versioned local-storage adapter with validation and deterministic serialization;
- an empty mob-catalog adapter until the separate mob CSV is supplied;
- tests for persistence and the level validation boundary.

This change does not create or alter Supabase tables. It does not yet modify the walkthrough form. A future walkthrough integration will call the same repository interface to update levels entered for the selected player.

## Data model

Mobs have their own catalog and are not records from `heroes`:

```ts
type Mob = {
  id: string;
  name: string;
  imageUrl: string | null;
};
```

Each level belongs to a stable player record and a mob:

```ts
type PlayerMobLevel = {
  playerId: string;
  mobId: string;
  level: number;
  updatedAt: string;
};
```

`playerId` uses the existing `battle_power.id`. The nickname is display data fetched from `battle_power`, not the persistence key. `mobId` will use the stable identifier from the future mob catalog. Valid levels are integers from 1 through 30 inclusive.

Names and images exist once in the mob catalog. Per-player records store only `playerId`, `mobId`, and the value that varies by player. Repeated player-to-mob associations therefore do not duplicate mob names or image URLs.

The local-storage key is `gvg.mob-levels.v1`. Stored input is treated as untrusted: malformed records and records outside the valid level range are ignored when read.

## Repository boundary

Pages consume a small asynchronous repository contract:

```ts
interface MobLevelsRepository {
  getByPlayer(playerId: string): Promise<PlayerMobLevel[]>;
  upsertMany(levels: PlayerMobLevelInput[]): Promise<PlayerMobLevel[]>;
  remove(playerId: string, mobId: string): Promise<void>;
}

interface MobCatalogRepository {
  getAll(): Promise<Mob[]>;
}
```

The initial level implementation uses `localStorage`. The initial catalog implementation returns an empty collection because the mob CSV has not been supplied. Methods remain asynchronous so later Supabase implementations can replace both adapters without changing page behavior. The adapters are client-safe and do not access `window` during server rendering.

`upsertMany` validates the complete batch before writing, assigns a common `updatedAt`, replaces matching `(playerId, mobId)` pairs, preserves unrelated players, and writes the normalized collection once.

## Data sources

- Player choices come from the existing `battle_power` table and include `id` plus `nickname`.
- Mob names and images will come from a separate catalog populated from the future CSV. They never come from `heroes`.
- Until that catalog exists, its adapter deliberately returns no mobs.
- Player-to-mob levels come from the local-storage adapter.

Loading or query failures are shown as a clear error state. Local-storage failures show a toast and keep unsaved form state intact.

## `/mob-levels` viewer

The viewer contains:

- a nickname selector populated from `battle_power`;
- an optional mob-name filter when the catalog contains data;
- a responsive list of the selected player's saved mobs;
- each mob's image, name, and level;
- a dedicated `Каталог мобів ще не завантажений` state while the catalog is empty;
- a separate empty state when the catalog exists but the player has no saved mob levels;
- a link to `/mob-levels/edit` that preserves the selected `playerId` in the search parameters.

The list is sorted by mob name. Records whose mob no longer exists in the catalog are omitted from the visual list without deleting local data.

## `/mob-levels/edit` editor

The editor contains:

- a player selector;
- the selected player's current draft list;
- level inputs constrained to integer values from 1 through 30;
- removal controls for draft rows;
- a searchable mob picker for adding a mob not already in the draft;
- one `Save changes` action for the full draft.

While the mob catalog is empty, the editor shows `Каталог мобів ще не завантажений` and disables adding or saving rows. No fake catalog records are seeded into local storage.

Removing a row affects the draft first. Saving computes the difference from the originally loaded rows, upserts present rows, and removes deleted rows. Switching players with unsaved changes asks for confirmation before discarding the draft.

Duplicate mobs cannot be added. Invalid or incomplete rows disable saving and display an inline validation message. Successful saving shows a toast and refreshes the stored baseline.

## Navigation

The home page gains a card for mob levels. The application header gains a compact link when consistent with the existing responsive navigation. Viewer and editor link to one another and provide a path back to the home page.

## Future Supabase adapter

The future schema contains a separate mob catalog plus a unique `(player_id, mob_id)` level relation:

```text
mobs
  id uuid primary key
  name text
  image_url text

player_mob_levels
  player_id uuid
  mob_id uuid references mobs(id)
  level smallint check (level between 1 and 30)
  updated_at timestamptz
  unique (player_id, mob_id)
```

When those tables are available, Supabase-backed implementations will satisfy the same repository contracts. The route components, validation, and walkthrough integration contract will remain unchanged.

## Verification

- Unit tests cover the empty catalog, empty level storage, valid reads, malformed data filtering, upserts, removals, player isolation, and the 1/30 boundaries.
- Type checking and the production build verify route generation and server-render safety.
- Manual smoke testing covers adding, editing, removing, refreshing, switching nicknames, empty states, and mobile layout.
