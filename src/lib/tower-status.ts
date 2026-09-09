export const TOWER_STATUS_LABELS = {
  placed: "Виставлений",
  breached: "Пробитий",
  testing: "Тестується",
  destroyed: "Знищений",
  removed: "Знятий",
} as const;

export type TowerStatus = Exclude<keyof typeof TOWER_STATUS_LABELS, "placed">;
export type TowerDisplayStatus = keyof typeof TOWER_STATUS_LABELS;
export type TowerStatusFlags = Record<TowerDisplayStatus, boolean>;
type TowerStatusRecord = Partial<Record<TowerDisplayStatus, boolean | null>> & {
  nickname?: string | null;
  previous_nickname?: string | null;
};

export function getTowerStatusFlags(tower: TowerStatusRecord | undefined): TowerStatusFlags {
  return {
    placed: Boolean(tower?.placed && !tower?.removed),
    breached: Boolean(tower?.breached || tower?.destroyed),
    testing: Boolean(tower?.testing),
    destroyed: Boolean(tower?.destroyed),
    removed: Boolean(tower?.removed),
  };
}

export function getTowerStatuses(tower: TowerStatusRecord | undefined): TowerDisplayStatus[] {
  const flags = getTowerStatusFlags(tower);
  return (Object.keys(TOWER_STATUS_LABELS) as TowerDisplayStatus[]).filter(
    (status) => flags[status],
  );
}

export function getTowerStatusUpdate(
  existing: TowerStatusRecord | undefined,
  status: TowerStatus,
  checked: boolean,
  nickname: string,
) {
  const flags = { ...getTowerStatusFlags(existing), [status]: checked };
  if (status === "removed" && checked) flags.placed = false;
  if (status === "destroyed" && checked) flags.breached = true;
  if (status === "breached" && !checked) flags.destroyed = false;
  return {
    ...flags,
    nickname: flags.removed || !flags.placed ? null : nickname.trim() || null,
    previous_nickname: flags.removed
      ? existing?.nickname?.trim() || existing?.previous_nickname || null
      : (existing?.previous_nickname ?? null),
  };
}

export function getTowerSaveUpdate(
  existing: TowerStatusRecord | undefined,
  nickname: string,
  { placeAgain = false }: { placeAgain?: boolean } = {},
) {
  const removed = Boolean(existing?.removed && !placeAgain);
  return {
    ...getTowerStatusFlags(existing),
    placed: !removed,
    removed,
    nickname: removed ? null : nickname.trim() || null,
    previous_nickname: removed
      ? existing?.nickname?.trim() || existing?.previous_nickname || null
      : (existing?.previous_nickname ?? null),
  };
}
