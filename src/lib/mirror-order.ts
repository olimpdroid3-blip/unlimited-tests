// Shared helpers for the "Замовити Дзеркало" flow.
// Mirror orders are stored as marker rows in `towers` with an "M:" prefix,
// so the real tower record keeps its own data untouched.

export const MIRROR_PREFIX = "M:";

export const VALID_TOWER_IDS: readonly string[] = (() => {
  const ids: string[] = [];
  for (let c = 1; c <= 4; c++) {
    for (let r = 1; r <= 6; r++) {
      for (let s = 1; s <= 2; s++) ids.push(`${c}.${r}.${s}`);
    }
  }
  return ids;
})();

export function isMirrorRow(towerId: string): boolean {
  return towerId.startsWith(MIRROR_PREFIX);
}

export function mirrorRowId(towerId: string): string {
  return `${MIRROR_PREFIX}${towerId}`;
}

/** Accepts "1.1.1", "111", "1-1-1", "1 1 1" and returns a canonical id or null. */
export function normalizeTowerId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length !== 3) return null;
  const candidate = `${digits[0]}.${digits[1]}.${digits[2]}`;
  return VALID_TOWER_IDS.includes(candidate) ? candidate : null;
}
