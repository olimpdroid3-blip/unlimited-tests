import {
  isValidMobLevel,
  isValidMobName,
  type Mob,
  type MobCatalogRepository,
  type MobNameInput,
  type MobLevelsRepository,
  type PlayerMobLevel,
  type PlayerMobLevelInput,
} from "./mob-levels.ts";

export type MobRow = {
  id: string;
  name: string;
  image_url: string | null;
};

export type PlayerMobLevelRow = {
  player_id: string;
  mob_id: string;
  level: number;
  updated_at: string;
};

type MobNameRowInput = {
  id: string;
  name: string;
};

type PlayerMobLevelRowInput = Omit<PlayerMobLevelRow, "updated_at">;

export interface MobLevelsGateway {
  listMobs(): Promise<MobRow[]>;
  updateMobNames(inputs: MobNameRowInput[]): Promise<MobRow[]>;
  listPlayerLevels(playerId: string): Promise<PlayerMobLevelRow[]>;
  upsertPlayerLevels(inputs: PlayerMobLevelRowInput[]): Promise<PlayerMobLevelRow[]>;
  deletePlayerLevel(playerId: string, mobId: string): Promise<void>;
}

export function createSupabaseMobCatalogRepository(
  gateway: MobLevelsGateway,
): MobCatalogRepository {
  return {
    async getAll() {
      return (await gateway.listMobs()).map(mapMobRow);
    },

    async updateNames(inputs) {
      const normalizedInputs = inputs.map(normalizeMobNameInput);
      normalizedInputs.forEach(validateMobNameInput);
      if (normalizedInputs.length === 0) return [];

      return (await gateway.updateMobNames(normalizedInputs)).map(mapMobRow);
    },
  };
}

export function createSupabaseMobLevelsRepository(gateway: MobLevelsGateway): MobLevelsRepository {
  return {
    async getByPlayer(playerId) {
      if (!playerId.trim()) return [];
      return (await gateway.listPlayerLevels(playerId)).map(mapPlayerMobLevelRow);
    },

    async upsertMany(inputs) {
      inputs.forEach(validatePlayerMobLevelInput);
      if (inputs.length === 0) return [];

      return (
        await gateway.upsertPlayerLevels(
          inputs.map(({ playerId, mobId, level }) => ({
            player_id: playerId,
            mob_id: mobId,
            level,
          })),
        )
      ).map(mapPlayerMobLevelRow);
    },

    async remove(playerId, mobId) {
      if (!playerId.trim() || !mobId.trim()) {
        throw new Error("Гравець і моб мають бути вибрані");
      }
      await gateway.deletePlayerLevel(playerId, mobId);
    },
  };
}

function mapMobRow(row: MobRow): Mob {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.image_url,
  };
}

function mapPlayerMobLevelRow(row: PlayerMobLevelRow): PlayerMobLevel {
  return {
    playerId: row.player_id,
    mobId: row.mob_id,
    level: row.level,
    updatedAt: row.updated_at,
  };
}

function normalizeMobNameInput({ id, name }: MobNameInput): MobNameRowInput {
  return { id: id.trim(), name: name.trim() };
}

function validateMobNameInput({ id, name }: MobNameRowInput): void {
  if (!id) throw new Error("Моб має бути вибраний");
  if (!isValidMobName(name)) throw new Error("Назва моба не може бути порожньою");
}

function validatePlayerMobLevelInput(input: PlayerMobLevelInput): void {
  if (!input.playerId.trim() || !input.mobId.trim()) {
    throw new Error("Гравець і моб мають бути вибрані");
  }
  if (!isValidMobLevel(input.level)) {
    throw new Error("Рівень моба має бути цілим числом від 1 до 30");
  }
}
