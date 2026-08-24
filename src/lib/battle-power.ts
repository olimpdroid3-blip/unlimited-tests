export type BattlePowerRow = {
  id: string;
  nickname: string;
  power1: number | null;
  power2: number | null;
  power3: number | null;
  power4: number | null;
  power5: number | null;
  power1_crowned: boolean;
  power2_crowned: boolean;
  power3_crowned: boolean;
  power4_crowned: boolean;
  power5_crowned: boolean;
};

export type BattlePowerInput = Omit<BattlePowerRow, "id">;

export type BattlePowerSortKey =
  "nickname" | "power1" | "power2" | "power3" | "power4" | "power5" | "average";

export type BattlePowerSortDirection = "asc" | "desc";

export interface BattlePowerRemoteSource {
  getAll(): Promise<BattlePowerRow[]>;
  create(input: BattlePowerInput): Promise<BattlePowerRow>;
  update(id: string, input: BattlePowerInput): Promise<BattlePowerRow>;
  remove(id: string): Promise<void>;
}

export type BattlePowerRepository = BattlePowerRemoteSource;

export type BattlePowerFormPresentation = "hidden" | "inline" | "dialog";

export type AwakeningLevel = "A0" | "A1" | "A2" | "A3" | "A4" | "A5";

const AWAKENING_MULTIPLIERS: Record<AwakeningLevel, number> = {
  A0: 1.1,
  A1: 1.11,
  A2: 1.12,
  A3: 1.13,
  A4: 1.14,
  A5: 1.15,
};

export function calculateAwakenedBattlePower(
  baseBattlePower: number | null,
  awakeningLevel: AwakeningLevel,
): number | null {
  if (baseBattlePower === null || !Number.isFinite(baseBattlePower) || baseBattlePower < 0) {
    return null;
  }

  return Math.round(baseBattlePower * AWAKENING_MULTIPLIERS[awakeningLevel] * 10) / 10;
}

export function getBattlePowerFormPresentation(
  isOpen: boolean,
  editingId: string | null,
): BattlePowerFormPresentation {
  if (!isOpen) return "hidden";
  return editingId ? "dialog" : "inline";
}

export function findBattlePowerRowByNickname(
  rows: readonly BattlePowerRow[],
  nickname: string,
): BattlePowerRow | undefined {
  const nicknameKey = normalizeNickname(nickname);
  if (!nicknameKey) return undefined;
  return rows.find((row) => normalizeNickname(row.nickname) === nicknameKey);
}

export function getBattlePowerValueTone(value: number | null): "standard" | "high" {
  return value !== null && value >= 150 ? "high" : "standard";
}

export function calculateAverageBattlePower(row: BattlePowerRow): number | null {
  const values = [row.power1, row.power2, row.power3, row.power4, row.power5].filter(
    (value): value is number => value !== null,
  );
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function sortBattlePowerRows(
  rows: readonly BattlePowerRow[],
  sortKey: BattlePowerSortKey,
  direction: BattlePowerSortDirection,
): BattlePowerRow[] {
  return [...rows].sort((left, right) => {
    if (sortKey === "nickname") {
      const comparison = compareBattlePowerRows(left, right);
      return direction === "asc" ? comparison : -comparison;
    }

    const leftValue = getBattlePowerSortValue(left, sortKey);
    const rightValue = getBattlePowerSortValue(right, sortKey);
    if (leftValue === null && rightValue === null) return compareBattlePowerRows(left, right);
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;

    const comparison = leftValue - rightValue;
    if (comparison === 0) return compareBattlePowerRows(left, right);
    return direction === "asc" ? comparison : -comparison;
  });
}

export function createBattlePowerRepository(
  remoteSource: BattlePowerRemoteSource,
): BattlePowerRepository {
  return {
    async getAll() {
      const remoteRows = await remoteSource.getAll();
      return remoteRows.map(normalizeRow).sort(compareBattlePowerRows);
    },

    async create(input) {
      return remoteSource.create(input);
    },

    async update(id, input) {
      return remoteSource.update(id, input);
    },

    async remove(id) {
      return remoteSource.remove(id);
    },
  };
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
    power1_crowned: row.power1_crowned ?? false,
    power2_crowned: row.power2_crowned ?? false,
    power3_crowned: row.power3_crowned ?? false,
    power4_crowned: row.power4_crowned ?? false,
    power5_crowned: row.power5_crowned ?? false,
  };
}

function getBattlePowerSortValue(
  row: BattlePowerRow,
  sortKey: Exclude<BattlePowerSortKey, "nickname">,
): number | null {
  return sortKey === "average" ? calculateAverageBattlePower(row) : row[sortKey];
}

function compareBattlePowerRows(left: BattlePowerRow, right: BattlePowerRow): number {
  const leftIsLatin = /^[A-Za-z]/.test(left.nickname.trim());
  const rightIsLatin = /^[A-Za-z]/.test(right.nickname.trim());
  if (leftIsLatin !== rightIsLatin) return leftIsLatin ? -1 : 1;
  return left.nickname.localeCompare(right.nickname, leftIsLatin ? "en" : "uk", {
    sensitivity: "base",
  });
}
