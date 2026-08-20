import assert from "node:assert/strict";
import test from "node:test";

import {
  createSupabaseMobCatalogRepository,
  createSupabaseMobLevelsRepository,
  type MobLevelsGateway,
  type MobRow,
  type PlayerMobLevelRow,
} from "./mob-levels-supabase.ts";

function createMemoryGateway(): MobLevelsGateway {
  let mobs: MobRow[] = [{ id: "mob-01", name: "Моб 01", image_url: "/mobs/image10.jpg" }];
  let levels: PlayerMobLevelRow[] = [
    {
      player_id: "player-01",
      mob_id: "mob-01",
      level: 7,
      updated_at: "2026-08-20T00:00:00.000Z",
    },
  ];

  return {
    async listMobs() {
      return [...mobs];
    },
    async updateMobNames(inputs) {
      mobs = mobs.map((mob) => {
        const input = inputs.find(({ id }) => id === mob.id);
        return input ? { ...mob, name: input.name } : mob;
      });
      return mobs.filter((mob) => inputs.some(({ id }) => id === mob.id));
    },
    async listPlayerLevels(playerId) {
      return levels.filter(({ player_id }) => player_id === playerId);
    },
    async upsertPlayerLevels(inputs) {
      inputs.forEach((input) => {
        levels = levels.filter(
          ({ player_id, mob_id }) => player_id !== input.player_id || mob_id !== input.mob_id,
        );
        levels = [...levels, { ...input, updated_at: "2026-08-20T01:00:00.000Z" }];
      });
      return levels.filter((level) =>
        inputs.some(
          ({ player_id, mob_id }) => player_id === level.player_id && mob_id === level.mob_id,
        ),
      );
    },
    async deletePlayerLevel(playerId, mobId) {
      levels = levels.filter(({ player_id, mob_id }) => player_id !== playerId || mob_id !== mobId);
    },
  };
}

test("maps database mob rows and persists globally edited names", async () => {
  const repository = createSupabaseMobCatalogRepository(createMemoryGateway());

  assert.deepEqual(await repository.getAll(), [
    { id: "mob-01", name: "Моб 01", imageUrl: "/mobs/image10.jpg" },
  ]);

  assert.deepEqual(await repository.updateNames([{ id: "mob-01", name: "  Вовк  " }]), [
    { id: "mob-01", name: "Вовк", imageUrl: "/mobs/image10.jpg" },
  ]);
});

test("maps player levels and upserts the selected player and mob pair", async () => {
  const repository = createSupabaseMobLevelsRepository(createMemoryGateway());

  assert.deepEqual(await repository.getByPlayer("player-01"), [
    {
      playerId: "player-01",
      mobId: "mob-01",
      level: 7,
      updatedAt: "2026-08-20T00:00:00.000Z",
    },
  ]);

  assert.deepEqual(
    await repository.upsertMany([{ playerId: "player-01", mobId: "mob-01", level: 12 }]),
    [
      {
        playerId: "player-01",
        mobId: "mob-01",
        level: 12,
        updatedAt: "2026-08-20T01:00:00.000Z",
      },
    ],
  );
});

test("removes only the requested database player and mob pair", async () => {
  const repository = createSupabaseMobLevelsRepository(createMemoryGateway());

  await repository.remove("player-01", "mob-01");

  assert.deepEqual(await repository.getByPlayer("player-01"), []);
});

test("rejects an invalid level before writing to the gateway", async () => {
  const repository = createSupabaseMobLevelsRepository(createMemoryGateway());

  await assert.rejects(
    repository.upsertMany([{ playerId: "player-01", mobId: "mob-01", level: 31 }]),
    /Рівень моба має бути цілим числом від 1 до 30/,
  );
});
