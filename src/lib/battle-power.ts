import type { StorageLike } from "./mob-levels";

export const TEST_BATTLE_POWER_OVERRIDES_KEY = "gvg.test-battle-power-overrides.v1";
export const TEST_BATTLE_POWER_REMOVALS_KEY = "gvg.test-battle-power-removals.v1";

const TEST_PLAYER_ID_PREFIX = "test-player-";

export type BattlePowerRow = {
  id: string;
  nickname: string;
  power1: number | null;
  power2: number | null;
  power3: number | null;
  power4: number | null;
  power5: number | null;
};

export type BattlePowerInput = Omit<BattlePowerRow, "id">;

export interface BattlePowerRemoteSource {
  getAll(): Promise<BattlePowerRow[]>;
  create(input: BattlePowerInput): Promise<BattlePowerRow>;
  update(id: string, input: BattlePowerInput): Promise<BattlePowerRow>;
  remove(id: string): Promise<void>;
}

export type BattlePowerRepository = BattlePowerRemoteSource;

export function createBattlePowerRepository(
  remoteSource: BattlePowerRemoteSource,
  seedRows: readonly BattlePowerRow[],
  storage?: StorageLike,
): BattlePowerRepository {
  function getStorage(): StorageLike | null {
    if (storage) return storage;
    return typeof window === "undefined" ? null : window.localStorage;
  }

  function readOverrides(): BattlePowerRow[] {
    const rawValue = getStorage()?.getItem(TEST_BATTLE_POWER_OVERRIDES_KEY);
    if (!rawValue) return [];

    try {
      const parsedValue: unknown = JSON.parse(rawValue);
      if (!Array.isArray(parsedValue)) return [];
      return parsedValue.filter(isBattlePowerRow);
    } catch {
      return [];
    }
  }

  function readRemovedIds(): Set<string> {
    const rawValue = getStorage()?.getItem(TEST_BATTLE_POWER_REMOVALS_KEY);
    if (!rawValue) return new Set();

    try {
      const parsedValue: unknown = JSON.parse(rawValue);
      if (!Array.isArray(parsedValue)) return new Set();
      return new Set(parsedValue.filter((value): value is string => typeof value === "string"));
    } catch {
      return new Set();
    }
  }

  function writeOverrides(rows: BattlePowerRow[]): void {
    const activeStorage = getStorage();
    if (!activeStorage) throw new Error("Локальне сховище недоступне на сервері");
    activeStorage.setItem(TEST_BATTLE_POWER_OVERRIDES_KEY, JSON.stringify(rows));
  }

  function writeRemovedIds(ids: Set<string>): void {
    const activeStorage = getStorage();
    if (!activeStorage) throw new Error("Локальне сховище недоступне на сервері");
    activeStorage.setItem(TEST_BATTLE_POWER_REMOVALS_KEY, JSON.stringify([...ids].sort()));
  }

  function getLocalRows(): BattlePowerRow[] {
    const removedIds = readRemovedIds();
    const rowsById = new Map(seedRows.map((row) => [row.id, normalizeRow(row)]));
    readOverrides().forEach((row) => rowsById.set(row.id, row));
    removedIds.forEach((id) => rowsById.delete(id));
    return [...rowsById.values()];
  }

  return {
    async getAll() {
      const remoteRows = await remoteSource.getAll();
      const rowsByNickname = new Map(
        remoteRows.map((row) => [normalizeNickname(row.nickname), normalizeRow(row)]),
      );
      getLocalRows().forEach((row) => {
        const nicknameKey = normalizeNickname(row.nickname);
        if (!rowsByNickname.has(nicknameKey)) rowsByNickname.set(nicknameKey, row);
      });
      return [...rowsByNickname.values()].sort(compareBattlePowerRows);
    },

    async create(input) {
      return remoteSource.create(input);
    },

    async update(id, input) {
      if (!isTestPlayerId(id)) return remoteSource.update(id, input);
      if (!seedRows.some((row) => row.id === id) && !readOverrides().some((row) => row.id === id)) {
        throw new Error("Тестового гравця не знайдено");
      }

      const updatedRow = { id, ...input };
      const overridesById = new Map(readOverrides().map((row) => [row.id, row]));
      overridesById.set(id, updatedRow);
      writeOverrides([...overridesById.values()]);
      const removedIds = readRemovedIds();
      removedIds.delete(id);
      writeRemovedIds(removedIds);
      return updatedRow;
    },

    async remove(id) {
      if (!isTestPlayerId(id)) return remoteSource.remove(id);
      writeOverrides(readOverrides().filter((row) => row.id !== id));
      const removedIds = readRemovedIds();
      removedIds.add(id);
      writeRemovedIds(removedIds);
    },
  };
}

function isTestPlayerId(id: string): boolean {
  return id.startsWith(TEST_PLAYER_ID_PREFIX);
}

function normalizeNickname(nickname: string): string {
  return nickname.trim().toLocaleLowerCase();
}

function normalizeRow(row: BattlePowerRow): BattlePowerRow {
  return {
    id: row.id,
    nickname: row.nickname,
    power1: row.power1,
    power2: row.power2,
    power3: row.power3,
    power4: row.power4,
    power5: row.power5,
  };
}

function compareBattlePowerRows(left: BattlePowerRow, right: BattlePowerRow): number {
  const leftIsLatin = /^[A-Za-z]/.test(left.nickname.trim());
  const rightIsLatin = /^[A-Za-z]/.test(right.nickname.trim());
  if (leftIsLatin !== rightIsLatin) return leftIsLatin ? -1 : 1;
  return left.nickname.localeCompare(right.nickname, leftIsLatin ? "en" : "uk", {
    sensitivity: "base",
  });
}

function isBattlePowerRow(value: unknown): value is BattlePowerRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<BattlePowerRow>;
  return (
    typeof row.id === "string" &&
    typeof row.nickname === "string" &&
    isNullableNumber(row.power1) &&
    isNullableNumber(row.power2) &&
    isNullableNumber(row.power3) &&
    isNullableNumber(row.power4) &&
    isNullableNumber(row.power5)
  );
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}
