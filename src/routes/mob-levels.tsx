import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { PlayerSelectField } from "@/components/PlayerSelectField";
import { Input } from "@/components/ui/input";
import { resolvePlayerMobs } from "@/lib/mob-levels";
import {
  loadMobLevelPlayers,
  mobCatalogRepository,
  mobLevelsRepository,
} from "@/lib/mob-levels-ui";

type MobLevelsSearch = {
  playerId?: string;
};

export const Route = createFileRoute("/mob-levels")({
  validateSearch: (search: Record<string, unknown>): MobLevelsSearch => ({
    playerId: typeof search.playerId === "string" ? search.playerId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Рівні мобів — Ukraine Unlimited" },
      {
        name: "description",
        content: "Перегляд рівнів мобів учасників гільдії.",
      },
    ],
  }),
  component: MobLevelsPage,
});

function MobLevelsPage() {
  const { playerId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [filter, setFilter] = useState("");

  const playersQuery = useQuery({
    queryKey: ["mob-level-players"],
    queryFn: loadMobLevelPlayers,
  });
  const catalogQuery = useQuery({
    queryKey: ["mob-catalog"],
    queryFn: () => mobCatalogRepository.getAll(),
  });
  const players = playersQuery.data ?? [];
  const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const selectedPlayerId = players.some((player) => player.id === playerId) ? playerId : undefined;
  const levelsQuery = useQuery({
    queryKey: ["mob-levels", selectedPlayerId],
    queryFn: () => mobLevelsRepository.getByPlayer(selectedPlayerId!),
    enabled: Boolean(selectedPlayerId && catalog.length > 0),
  });

  const visibleMobs = useMemo(() => {
    const normalizedFilter = filter.trim().toLocaleLowerCase("uk");
    return resolvePlayerMobs(levelsQuery.data ?? [], catalog).filter(({ mob }) =>
      mob.name.toLocaleLowerCase("uk").includes(normalizedFilter),
    );
  }, [catalog, filter, levelsQuery.data]);

  const queryError = playersQuery.error ?? catalogQuery.error ?? levelsQuery.error;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-12 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/" className="text-xs text-muted-foreground hover:text-primary">
              ← На головну
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">👾 Рівні мобів</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Перегляд мобів і рівнів кожного учасника.
            </p>
          </div>
          <Link
            to="/mob-levels/edit"
            search={{ playerId: selectedPlayerId }}
            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
          >
            ✏️ Редагувати рівні
          </Link>
        </div>

        <section className="mt-5 rounded-2xl border border-border bg-card/60 p-4">
          <PlayerSelectField
            id="mob-level-player"
            value={selectedPlayerId}
            players={players}
            disabled={playersQuery.isLoading || players.length === 0}
            onValueChange={(nextPlayerId) => {
              setFilter("");
              void navigate({
                search: {
                  playerId: nextPlayerId,
                },
              });
            }}
          />
        </section>

        {queryError && (
          <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Не вдалося завантажити дані. Оновіть сторінку й спробуйте ще раз.
          </p>
        )}

        {!queryError && playersQuery.isLoading && (
          <p className="mt-5 text-sm text-muted-foreground">Завантаження гравців…</p>
        )}

        {!queryError && !playersQuery.isLoading && players.length === 0 && (
          <EmptyState
            title="Немає гравців із заповненим БС"
            description="Спочатку додайте учасника на сторінці бойової сили."
          />
        )}

        {!queryError && players.length > 0 && !catalogQuery.isLoading && catalog.length === 0 && (
          <EmptyState
            title="Каталог мобів ще не завантажений"
            description="Назви та зображення мобів з’являться тут після імпорту CSV."
          />
        )}

        {!queryError && catalog.length > 0 && !selectedPlayerId && (
          <EmptyState
            title="Оберіть гравця"
            description="Після вибору ніку тут з’являться його моби та рівні."
          />
        )}

        {!queryError && catalog.length > 0 && selectedPlayerId && (
          <section className="mt-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Пошук моба…"
                className="pl-9"
              />
            </div>

            {levelsQuery.isLoading && (
              <p className="mt-4 text-sm text-muted-foreground">Завантаження рівнів…</p>
            )}

            {!levelsQuery.isLoading && visibleMobs.length === 0 && (
              <EmptyState
                title={filter ? "Мобів не знайдено" : "Для цього гравця рівні ще не внесені"}
                description={
                  filter
                    ? "Змініть пошуковий запит."
                    : "Перейдіть до редактора та додайте мобів гравця."
                }
              />
            )}

            {visibleMobs.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visibleMobs.map(({ mob, level }) => (
                  <article
                    key={mob.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3"
                  >
                    {mob.imageUrl ? (
                      <img
                        src={mob.imageUrl}
                        alt=""
                        className="h-14 w-14 rounded-xl border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-secondary text-2xl">
                        👾
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold">{mob.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Рівень {level}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-border bg-card/30 px-5 py-10 text-center">
      <div className="text-3xl">👾</div>
      <h2 className="mt-3 font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
