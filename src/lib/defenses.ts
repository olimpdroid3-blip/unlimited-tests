import type { Mob, PlayerMobLevel } from "./mob-levels";

export type DefenseMobLink = {
  mobId: string;
  position: number;
};

export type ResolvedDefenseMob = {
  mob: Mob;
  level: number | null;
  position: number;
};

export function isValidDefenseMobSelection(mobIds: readonly string[]): boolean {
  if (mobIds.length < 2 || mobIds.length > 5) return false;
  const normalizedIds = mobIds.map((mobId) => mobId.trim());
  return normalizedIds.every(Boolean) && new Set(normalizedIds).size === normalizedIds.length;
}

export function getDefenseMobSelection(slots: readonly (string | null)[]): string[] | null {
  const firstEmptySlot = slots.findIndex((mobId) => !mobId?.trim());
  const selectionEnd = firstEmptySlot === -1 ? slots.length : firstEmptySlot;
  if (slots.slice(selectionEnd).some((mobId) => Boolean(mobId?.trim()))) return null;

  const mobIds = slots.slice(0, selectionEnd).map((mobId) => mobId!.trim());
  return isValidDefenseMobSelection(mobIds) ? mobIds : null;
}

export function resolveDefenseMobs(
  playerId: string | null,
  links: readonly DefenseMobLink[],
  mobs: readonly Mob[],
  levels: readonly PlayerMobLevel[],
): ResolvedDefenseMob[] {
  const mobsById = new Map(mobs.map((mob) => [mob.id, mob]));
  const levelsByMobId = new Map(
    levels
      .filter((level) => level.playerId === playerId)
      .map((level) => [level.mobId, level.level]),
  );

  return [...links]
    .sort((left, right) => left.position - right.position)
    .flatMap(({ mobId, position }) => {
      const mob = mobsById.get(mobId);
      return mob ? [{ mob, level: levelsByMobId.get(mobId) ?? null, position }] : [];
    });
}
