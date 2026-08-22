export const MOB_LEVELS_STORAGE_KEY = "gvg.mob-levels.v1";
export const MOB_LEVEL_REMOVALS_STORAGE_KEY = "gvg.mob-level-removals.v1";
export const MOB_NAME_OVERRIDES_STORAGE_KEY = "gvg.mob-name-overrides.v1";
export const MOB_CLASSIFICATION_OVERRIDES_STORAGE_KEY = "gvg.mob-classification-overrides.v1";

export const MOB_TYPES = ["demon", "demon-captain"] as const;
export const MOB_RARITIES = ["epic", "legendary"] as const;
export const MOB_SORT_MODES = ["default", "rarity", "name"] as const;

export type MobType = (typeof MOB_TYPES)[number];
export type MobRarity = (typeof MOB_RARITIES)[number];
export type MobSortMode = (typeof MOB_SORT_MODES)[number];

export const MOB_TYPE_LABELS: Record<MobType, string> = {
  demon: "Демон",
  "demon-captain": "Демон-капітан",
};

export const MOB_RARITY_LABELS: Record<MobRarity, string> = {
  epic: "Епічний",
  legendary: "Легендарний",
};

export const MOB_SORT_LABELS: Record<MobSortMode, string> = {
  default: "За замовчуванням",
  rarity: "За рідкістю",
  name: "За іменем",
};

export type Mob = {
  id: string;
  name: string;
  imageUrl: string | null;
  mobType: MobType;
  rarity: MobRarity | null;
};

export type PlayerMobLevel = {
  playerId: string;
  mobId: string;
  level: number;
  updatedAt: string;
};

export type PlayerMobLevelInput = Omit<PlayerMobLevel, "updatedAt">;
export type MobNameInput = Pick<Mob, "id" | "name">;
export type MobClassificationInput = Pick<Mob, "id" | "mobType" | "rarity">;

export type ResolvedPlayerMob = PlayerMobLevel & { mob: Mob };

export type PlayerOption = {
  id: string;
  nickname: string;
};

export type MobLevelDraft = {
  mobId: string;
  level: number | null;
};

export type MobNameDraft = {
  mobId: string;
  name: string;
};

export type MobClassificationDraft = {
  mobId: string;
  mobType: MobType;
  rarity: MobRarity | null;
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

export interface MobCatalogSource {
  getAll(): Promise<Mob[]>;
}

export interface MobCatalogRepository extends MobCatalogSource {
  updateNames(inputs: MobNameInput[]): Promise<Mob[]>;
  updateClassifications(inputs: MobClassificationInput[]): Promise<Mob[]>;
}

export function isValidMobLevel(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 30;
}

export function isValidMobName(value: unknown): value is string {
  return isNonEmptyString(value);
}

export function isValidMobType(value: unknown): value is MobType {
  return typeof value === "string" && MOB_TYPES.includes(value as MobType);
}

export function isValidMobRarity(value: unknown): value is MobRarity {
  return typeof value === "string" && MOB_RARITIES.includes(value as MobRarity);
}

export function isValidMobClassification(mobType: unknown, rarity: unknown): mobType is MobType {
  return (
    (mobType === "demon" && isValidMobRarity(rarity)) ||
    (mobType === "demon-captain" && rarity === null)
  );
}

export function createLocalStorageMobLevelsRepository(
  storage?: StorageLike,
  seedLevels: readonly PlayerMobLevel[] = [],
): MobLevelsRepository {
  function getStorage(): StorageLike | null {
    if (storage) return storage;
    return typeof window === "undefined" ? null : window.localStorage;
  }

  function readStoredLevels(): PlayerMobLevel[] {
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

  function readRemovedLevelKeys(): Set<string> {
    const rawValue = getStorage()?.getItem(MOB_LEVEL_REMOVALS_STORAGE_KEY);
    if (!rawValue) return new Set();

    try {
      const parsedValue: unknown = JSON.parse(rawValue);
      if (!Array.isArray(parsedValue)) return new Set();
      return new Set(parsedValue.filter(isNonEmptyString));
    } catch {
      return new Set();
    }
  }

  function readAll(): PlayerMobLevel[] {
    const removedLevelKeys = readRemovedLevelKeys();
    const recordsByKey = new Map(
      seedLevels
        .filter(isPlayerMobLevel)
        .map((level) => [levelKey(level.playerId, level.mobId), level] as const),
    );
    readStoredLevels().forEach((level) => {
      recordsByKey.set(levelKey(level.playerId, level.mobId), level);
    });
    removedLevelKeys.forEach((key) => recordsByKey.delete(key));
    return [...recordsByKey.values()].sort(comparePlayerMobLevels);
  }

  function writeStoredLevels(levels: PlayerMobLevel[]): void {
    const activeStorage = getStorage();
    if (!activeStorage) {
      throw new Error("Локальне сховище недоступне на сервері");
    }
    activeStorage.setItem(
      MOB_LEVELS_STORAGE_KEY,
      JSON.stringify([...levels].sort(comparePlayerMobLevels)),
    );
  }

  function writeRemovedLevelKeys(keys: Set<string>): void {
    const activeStorage = getStorage();
    if (!activeStorage) {
      throw new Error("Локальне сховище недоступне на сервері");
    }
    activeStorage.setItem(MOB_LEVEL_REMOVALS_STORAGE_KEY, JSON.stringify([...keys].sort()));
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
        readStoredLevels().map((level) => [levelKey(level.playerId, level.mobId), level]),
      );
      const removedLevelKeys = readRemovedLevelKeys();
      inputRecords.forEach((level) => {
        const key = levelKey(level.playerId, level.mobId);
        recordsByKey.set(key, level);
        removedLevelKeys.delete(key);
      });
      writeStoredLevels([...recordsByKey.values()]);
      writeRemovedLevelKeys(removedLevelKeys);
      return inputRecords.sort(comparePlayerMobLevels);
    },

    async remove(playerId, mobId) {
      const key = levelKey(playerId, mobId);
      writeStoredLevels(
        readStoredLevels().filter((level) => levelKey(level.playerId, level.mobId) !== key),
      );
      const removedLevelKeys = readRemovedLevelKeys();
      if (seedLevels.some((level) => levelKey(level.playerId, level.mobId) === key)) {
        removedLevelKeys.add(key);
      } else {
        removedLevelKeys.delete(key);
      }
      writeRemovedLevelKeys(removedLevelKeys);
    },
  };
}

export function createLocalStorageMobCatalogRepository(
  baseRepository: MobCatalogSource,
  storage?: StorageLike,
): MobCatalogRepository {
  function getStorage(): StorageLike | null {
    if (storage) return storage;
    return typeof window === "undefined" ? null : window.localStorage;
  }

  function readOverrides(): Record<string, string> {
    const rawValue = getStorage()?.getItem(MOB_NAME_OVERRIDES_STORAGE_KEY);
    if (!rawValue) return {};

    try {
      const parsedValue: unknown = JSON.parse(rawValue);
      if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) return {};
      return Object.fromEntries(
        Object.entries(parsedValue).filter(
          ([mobId, name]) => isNonEmptyString(mobId) && isNonEmptyString(name),
        ),
      );
    } catch {
      return {};
    }
  }

  function readClassificationOverrides(): Record<string, Pick<Mob, "mobType" | "rarity">> {
    const rawValue = getStorage()?.getItem(MOB_CLASSIFICATION_OVERRIDES_STORAGE_KEY);
    if (!rawValue) return {};

    try {
      const parsedValue: unknown = JSON.parse(rawValue);
      if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) return {};
      return Object.fromEntries(
        Object.entries(parsedValue).filter(
          (entry): entry is [string, Pick<Mob, "mobType" | "rarity">] => {
            const [mobId, classification] = entry;
            return (
              isNonEmptyString(mobId) &&
              Boolean(classification) &&
              typeof classification === "object" &&
              isValidMobClassification(
                (classification as Partial<Mob>).mobType,
                (classification as Partial<Mob>).rarity,
              )
            );
          },
        ),
      );
    } catch {
      return {};
    }
  }

  return {
    async getAll() {
      const overrides = readOverrides();
      const classificationOverrides = readClassificationOverrides();
      return (await baseRepository.getAll()).map((mob) => ({
        ...mob,
        name: overrides[mob.id]?.trim() || mob.name,
        ...classificationOverrides[mob.id],
      }));
    },

    async updateNames(inputs) {
      const normalizedInputs = inputs.map(({ id, name }) => ({ id: id.trim(), name: name.trim() }));
      normalizedInputs.forEach(validateMobNameInput);
      if (normalizedInputs.length === 0) return [];

      const catalog = await baseRepository.getAll();
      const mobsById = new Map(catalog.map((mob) => [mob.id, mob]));
      normalizedInputs.forEach(({ id }) => {
        if (!mobsById.has(id)) throw new Error("Моба не знайдено в каталозі");
      });

      const activeStorage = getStorage();
      if (!activeStorage) throw new Error("Локальне сховище недоступне на сервері");

      const overrides = { ...readOverrides() };
      normalizedInputs.forEach(({ id, name }) => {
        overrides[id] = name;
      });
      activeStorage.setItem(MOB_NAME_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));

      return normalizedInputs.map(({ id, name }) => ({ ...mobsById.get(id)!, name }));
    },

    async updateClassifications(inputs) {
      inputs.forEach(validateMobClassificationInput);
      if (inputs.length === 0) return [];

      const catalog = await baseRepository.getAll();
      const mobsById = new Map(catalog.map((mob) => [mob.id, mob]));
      inputs.forEach(({ id }) => {
        if (!mobsById.has(id)) throw new Error("Моба не знайдено в каталозі");
      });

      const activeStorage = getStorage();
      if (!activeStorage) throw new Error("Локальне сховище недоступне на сервері");

      const overrides = { ...readClassificationOverrides() };
      inputs.forEach(({ id, mobType, rarity }) => {
        overrides[id] = { mobType, rarity };
      });
      activeStorage.setItem(MOB_CLASSIFICATION_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));

      return inputs.map(({ id, mobType, rarity }) => ({
        ...mobsById.get(id)!,
        mobType,
        rarity,
      }));
    },
  };
}

export const emptyMobCatalogRepository: MobCatalogRepository = {
  async getAll() {
    return [];
  },
  async updateNames(inputs) {
    if (inputs.length > 0) throw new Error("Моба не знайдено в каталозі");
    return [];
  },
  async updateClassifications(inputs) {
    if (inputs.length > 0) throw new Error("Моба не знайдено в каталозі");
    return [];
  },
};

export function resolvePlayerMobs(
  levels: PlayerMobLevel[],
  mobs: Mob[],
  sortMode: MobSortMode = "default",
): ResolvedPlayerMob[] {
  const mobsById = new Map(mobs.map((mob) => [mob.id, mob]));
  return levels
    .flatMap((level) => {
      const mob = mobsById.get(level.mobId);
      return mob ? [{ ...level, mob }] : [];
    })
    .sort((left, right) => compareMobs(left.mob, right.mob, sortMode));
}

export function compareMobs(left: Mob, right: Mob, sortMode: MobSortMode): number {
  if (sortMode === "name") return compareMobNames(left, right);

  if (sortMode === "rarity") {
    return rarityRank(left.rarity) - rarityRank(right.rarity) || compareMobNames(left, right);
  }

  const typeDifference = typeRank(left.mobType) - typeRank(right.mobType);
  if (typeDifference !== 0) return typeDifference;
  if (left.mobType === "demon" && right.mobType === "demon") {
    return rarityRank(left.rarity) - rarityRank(right.rarity) || compareMobNames(left, right);
  }
  return compareMobNames(left, right);
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

export function mergePlayerOptions(
  remotePlayers: readonly PlayerOption[],
  localPlayers: readonly PlayerOption[],
): PlayerOption[] {
  const playersByNickname = new Map(
    remotePlayers.map((player) => [normalizePlayerNickname(player.nickname), player]),
  );
  localPlayers.forEach((player) => {
    const nicknameKey = normalizePlayerNickname(player.nickname);
    if (!playersByNickname.has(nicknameKey)) playersByNickname.set(nicknameKey, player);
  });
  return sortPlayerOptions([...playersByNickname.values()]);
}

function normalizePlayerNickname(nickname: string): string {
  return nickname.trim().toLocaleLowerCase();
}

export function haveSameMobLevelDraft(left: MobLevelDraft[], right: MobLevelDraft[]): boolean {
  return serializeDraft(left) === serializeDraft(right);
}

export function haveSameMobNameDraft(left: MobNameDraft[], right: MobNameDraft[]): boolean {
  return serializeMobNameDraft(left) === serializeMobNameDraft(right);
}

export function haveSameMobClassificationDraft(
  left: MobClassificationDraft[],
  right: MobClassificationDraft[],
): boolean {
  return serializeMobClassificationDraft(left) === serializeMobClassificationDraft(right);
}

export function getChangedMobNames(
  baseline: MobNameDraft[],
  draft: MobNameDraft[],
): MobNameInput[] {
  const baselineNames = new Map(baseline.map(({ mobId, name }) => [mobId, name.trim()]));
  return draft
    .filter(({ name }) => isValidMobName(name))
    .map(({ mobId, name }) => ({ id: mobId, name: name.trim() }))
    .filter(({ id, name }) => baselineNames.get(id) !== name)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function getChangedMobClassifications(
  baseline: MobClassificationDraft[],
  draft: MobClassificationDraft[],
): MobClassificationInput[] {
  const baselineById = new Map(
    baseline.map(({ mobId, mobType, rarity }) => [mobId, `${mobType}\u0000${rarity}`]),
  );
  return draft
    .filter(({ mobType, rarity }) => isValidMobClassification(mobType, rarity))
    .map(({ mobId, mobType, rarity }) => ({ id: mobId, mobType, rarity }))
    .filter(({ id, mobType, rarity }) => baselineById.get(id) !== `${mobType}\u0000${rarity}`)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function getRemovedMobIds(baseline: MobLevelDraft[], draft: MobLevelDraft[]): string[] {
  const draftIds = new Set(draft.map(({ mobId }) => mobId));
  return baseline
    .map(({ mobId }) => mobId)
    .filter((mobId) => !draftIds.has(mobId))
    .sort((left, right) => left.localeCompare(right));
}

function serializeDraft(draft: MobLevelDraft[]): string {
  return [...draft]
    .sort((left, right) => left.mobId.localeCompare(right.mobId))
    .map(({ mobId, level }) => `${mobId}\u0000${level ?? ""}`)
    .join("\u0001");
}

function serializeMobNameDraft(draft: MobNameDraft[]): string {
  return [...draft]
    .sort((left, right) => left.mobId.localeCompare(right.mobId))
    .map(({ mobId, name }) => `${mobId}\u0000${name.trim()}`)
    .join("\u0001");
}

function serializeMobClassificationDraft(draft: MobClassificationDraft[]): string {
  return [...draft]
    .sort((left, right) => left.mobId.localeCompare(right.mobId))
    .map(({ mobId, mobType, rarity }) => `${mobId}\u0000${mobType}\u0000${rarity}`)
    .join("\u0001");
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

function validateMobNameInput(input: MobNameInput): void {
  if (!isNonEmptyString(input.id)) throw new Error("Моб має бути вибраний");
  if (!isNonEmptyString(input.name)) throw new Error("Назва моба не може бути порожньою");
}

function validateMobClassificationInput(input: MobClassificationInput): void {
  if (!isNonEmptyString(input.id)) throw new Error("Моб має бути вибраний");
  if (!isValidMobClassification(input.mobType, input.rarity)) {
    throw new Error("Некоректна комбінація типу та рідкості моба");
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

function compareMobNames(left: Mob, right: Mob): number {
  return left.name.localeCompare(right.name, "uk", { sensitivity: "base" });
}

function typeRank(mobType: MobType): number {
  return mobType === "demon-captain" ? 0 : 1;
}

function rarityRank(rarity: MobRarity | null): number {
  if (rarity === "legendary") return 0;
  if (rarity === "epic") return 1;
  return 2;
}
