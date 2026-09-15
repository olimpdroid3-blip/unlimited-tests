export type TowerParticipant = { nickname: string; comment: string };
type ParticipantTower = {
  tower_id?: string;
  nickname?: string | null;
  previous_nickname?: string | null;
  notes?: string | null;
  participants?: unknown;
  placed?: boolean | null;
  removed?: boolean | null;
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
  return {
    towerIds,
    placedTowerIds: towerIds.filter((id) =>
      towers.some((tower) => tower.tower_id === id && tower.placed && !tower.removed),
    ),
    participants: normalizeParticipants(
      towerIds.flatMap((id) =>
        readTowerParticipants(towers.find((tower) => tower.tower_id === id)),
      ),
    ),
  };
}
