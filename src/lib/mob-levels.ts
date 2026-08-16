export const MOB_LEVELS_STORAGE_KEY = "gvg.mob-levels.v1";

export type Mob = {
  id: string;
  name: string;
  imageUrl: string | null;
};

export type PlayerMobLevel = {
  playerId: string;
  mobId: string;
  level: number;
  updatedAt: string;
};

export type PlayerMobLevelInput = Omit<PlayerMobLevel, "updatedAt">;

export type ResolvedPlayerMob = PlayerMobLevel & { mob: Mob };

export type PlayerOption = {
  id: string;
  nickname: string;
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface MobLevelsRepository {
  getByPlayer(playerId: string): Promise<PlayerMobLevel[]>;
  upsertMany(levels: PlayerMobLevelInput[]): Promise<PlayerMobLevel[]>;
  remove(playerId: string, mobId: string): Promise<void>;
}

export interface MobCatalogRepository {
  getAll(): Promise<Mob[]>;
}

export function isValidMobLevel(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 30;
}

export function createLocalStorageMobLevelsRepository(storage?: StorageLike): MobLevelsRepository {
  function getStorage(): StorageLike | null {
    if (storage) return storage;
    return typeof window === "undefined" ? null : window.localStorage;
  }

  function readAll(): PlayerMobLevel[] {
    const activeStorage = getStorage();
    if (!activeStorage) return [];

    const rawValue = activeStorage.getItem(MOB_LEVELS_STORAGE_KEY);
    if (!rawValue) return [];

    try {
      const parsedValue: unknown = JSON.parse(rawValue);
      if (!Array.isArray(parsedValue)) return [];
      return parsedValue.filter(isPlayerMobLevel).sort(comparePlayerMobLevels);
    } catch {
      return [];
    }
  }

  function writeAll(levels: PlayerMobLevel[]): void {
    const activeStorage = getStorage();
    if (!activeStorage) {
      throw new Error("Локальне сховище недоступне на сервері");
    }
    activeStorage.setItem(
      MOB_LEVELS_STORAGE_KEY,
      JSON.stringify([...levels].sort(comparePlayerMobLevels)),
    );
  }

  return {
    async getByPlayer(playerId) {
      return readAll().filter((level) => level.playerId === playerId);
    },

    async upsertMany(inputs) {
      inputs.forEach(validateInput);
      if (inputs.length === 0) return [];

      const updatedAt = new Date().toISOString();
      const inputRecords = inputs.map((input) => ({ ...input, updatedAt }));
      const recordsByKey = new Map(
        readAll().map((level) => [levelKey(level.playerId, level.mobId), level]),
      );
      inputRecords.forEach((level) => {
        recordsByKey.set(levelKey(level.playerId, level.mobId), level);
      });
      writeAll([...recordsByKey.values()]);
      return inputRecords.sort(comparePlayerMobLevels);
    },

    async remove(playerId, mobId) {
      writeAll(readAll().filter((level) => level.playerId !== playerId || level.mobId !== mobId));
    },
  };
}

export const emptyMobCatalogRepository: MobCatalogRepository = {
  async getAll() {
    return [];
  },
};

export function resolvePlayerMobs(levels: PlayerMobLevel[], mobs: Mob[]): ResolvedPlayerMob[] {
  const mobsById = new Map(mobs.map((mob) => [mob.id, mob]));
  return levels
    .flatMap((level) => {
      const mob = mobsById.get(level.mobId);
      return mob ? [{ ...level, mob }] : [];
    })
    .sort((left, right) =>
      left.mob.name.localeCompare(right.mob.name, "uk", {
        sensitivity: "base",
      }),
    );
}

export function sortPlayerOptions(players: PlayerOption[]): PlayerOption[] {
  return [...players].sort((left, right) => {
    const leftIsLatin = /^[A-Za-z]/.test(left.nickname.trim());
    const rightIsLatin = /^[A-Za-z]/.test(right.nickname.trim());
    if (leftIsLatin !== rightIsLatin) return leftIsLatin ? -1 : 1;
    return left.nickname.localeCompare(right.nickname, leftIsLatin ? "en" : "uk", {
      sensitivity: "base",
    });
  });
}

function isPlayerMobLevel(value: unknown): value is PlayerMobLevel {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PlayerMobLevel>;
  return (
    isNonEmptyString(candidate.playerId) &&
    isNonEmptyString(candidate.mobId) &&
    isValidMobLevel(candidate.level) &&
    typeof candidate.updatedAt === "string" &&
    !Number.isNaN(Date.parse(candidate.updatedAt))
  );
}

function validateInput(input: PlayerMobLevelInput): void {
  if (!isNonEmptyString(input.playerId) || !isNonEmptyString(input.mobId)) {
    throw new Error("Гравець і моб мають бути вибрані");
  }
  if (!isValidMobLevel(input.level)) {
    throw new Error("Рівень моба має бути цілим числом від 1 до 30");
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function levelKey(playerId: string, mobId: string): string {
  return `${playerId}\u0000${mobId}`;
}

function comparePlayerMobLevels(left: PlayerMobLevel, right: PlayerMobLevel): number {
  return left.playerId.localeCompare(right.playerId) || left.mobId.localeCompare(right.mobId);
}
