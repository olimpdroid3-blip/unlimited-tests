import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { MobPicker } from "@/components/MobPicker";
import { resolveMobPlayers, type Mob, type PlayerOption } from "@/lib/mob-levels";
import { mobLevelsRepository } from "@/lib/mob-levels-ui";

export function MobPlayersView({
  catalog,
  players,
}: {
  catalog: readonly Mob[];
  players: readonly PlayerOption[];
}) {
  const [mobId, setMobId] = useState<string | null>(null);
  const selectedMob = catalog.find((mob) => mob.id === mobId);
  const levelsQuery = useQuery({
    queryKey: ["mob-levels", "by-mob", mobId],
    queryFn: () => mobLevelsRepository.getByMob(mobId!),
    enabled: Boolean(selectedMob),
  });
  const rankedPlayers = useMemo(
    () => resolveMobPlayers(players, levelsQuery.data ?? [], mobId ?? ""),
    [players, levelsQuery.data, mobId],
  );

  return (
    <section className="mt-5">
      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <h2 className="mb-2 text-xs font-medium uppercase text-muted-foreground">Моб</h2>
        <MobPicker mobs={catalog} value={mobId} onChange={setMobId} />
      </div>

      {!selectedMob && (
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Оберіть моба, щоб побачити його рівень у кожного гравця.
        </p>
      )}

      {selectedMob && (
        <div className="mt-5" aria-live="polite">
          <h2 className="text-lg font-semibold">{selectedMob.name} — рівні гравців</h2>
          <p className="mt-1 text-sm text-muted-foreground">Від найвищого рівня до найнижчого.</p>

          {levelsQuery.isPending && (
            <p className="mt-4 text-sm text-muted-foreground">Завантаження рівнів…</p>
          )}
          {levelsQuery.isError && (
            <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Не вдалося завантажити рівні.
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => void levelsQuery.refetch()}
              >
                Спробувати ще раз
              </button>
            </p>
          )}
          {levelsQuery.isSuccess && (
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rankedPlayers.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-4"
                >
                  <span className="min-w-0 break-words font-semibold">{player.nickname}</span>
                  <span
                    className={
                      player.level === null
                        ? "shrink-0 text-xs text-muted-foreground"
                        : "shrink-0 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                    }
                  >
                    {player.level === null ? "Рівень не вказано" : `Рівень ${player.level}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
