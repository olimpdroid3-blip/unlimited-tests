export type TowerParticipant = { nickname: string; comment: string };
type ParticipantTower = {
  tower_id?: string;
  nickname?: string | null;
  previous_nickname?: string | null;
  notes?: string | null;
  participants?: unknown;
  placed?: boolean | null;
  removed?: boolean | null;
  destroyed?: boolean | null;
};
type Variant = { tower_id: string; variant: number };

export function normalizeParticipants(entries: readonly TowerParticipant[]): TowerParticipant[] {
  const grouped = new Map<string, Set<string>>();
  for (const entry of entries) {
    const nickname = entry.nickname.trim();
    if (!nickname) continue;
    const comments = grouped.get(nickname) ?? new Set<string>();
    // Splitting merged paragraphs makes repeated group merges idempotent.
    for (const comment of entry.comment.trim().split("\n\n")) {
      if (comment) comments.add(comment);
    }
    grouped.set(nickname, comments);
  }
  return [...grouped].map(([nickname, comments]) => ({
    nickname,
    comment: [...comments].join("\n\n"),
  }));
}

export function readTowerParticipants(tower: ParticipantTower | undefined): TowerParticipant[] {
  if (Array.isArray(tower?.participants)) {
    return normalizeParticipants(
      tower.participants.filter(
        (entry): entry is TowerParticipant =>
          entry !== null &&
          typeof entry === "object" &&
          typeof entry.nickname === "string" &&
          typeof entry.comment === "string",
      ),
    );
  }
  const nickname = tower?.nickname || tower?.previous_nickname;
  return nickname ? [{ nickname, comment: tower?.notes ?? "" }] : [];
}

export function getTowerGroup(
  towerId: string,
  towers: readonly ParticipantTower[],
  variants: readonly Variant[],
) {
  const variant = variants.find((entry) => entry.tower_id === towerId)?.variant;
  const towerIds =
    variant == null
      ? [towerId]
      : variants
          .filter((entry) => entry.variant === variant)
          .map((entry) => entry.tower_id)
          .sort();
  const groupTowers = towerIds.flatMap((id) => towers.filter((tower) => tower.tower_id === id));
  const activeTowers = groupTowers.filter((tower) => tower.placed && !tower.removed);
  const participants = normalizeParticipants(groupTowers.flatMap(readTowerParticipants));
  // The shared participant list contains history, not the current owner of each cell.
  const activeParticipants = normalizeParticipants(
    activeTowers.flatMap((tower) => {
      const nickname = tower.nickname?.trim();
      if (!nickname) return [];
      const participant = readTowerParticipants(tower).find((entry) => entry.nickname === nickname);
      return [{ nickname, comment: participant?.comment ?? tower.notes ?? "" }];
    }),
  );
  const activeNames = new Set(activeParticipants.map((entry) => entry.nickname));
  const previousParticipants = normalizeParticipants([
    ...participants,
    ...groupTowers.flatMap((tower) => {
      const nickname =
        tower.previous_nickname || (!activeTowers.includes(tower) ? tower.nickname : null);
      return nickname ? [{ nickname, comment: tower.notes ?? "" }] : [];
    }),
  ]).filter((entry) => !activeNames.has(entry.nickname));
  return {
    towerIds,
    placedTowerIds: activeTowers.map((tower) => tower.tower_id!),
    participants,
    activeParticipants,
    previousParticipants,
  };
}

export type TowerGroup = ReturnType<typeof getTowerGroup>;

export function getTowerOwnerIndex(
  participants: readonly TowerParticipant[],
  tower: ParticipantTower | undefined,
): number {
  const nickname = tower?.nickname?.trim() || tower?.previous_nickname?.trim();
  return Math.max(
    0,
    participants.findIndex((entry) => entry.nickname.trim() === nickname),
  );
}
