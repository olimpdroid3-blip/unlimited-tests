import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { MOB_RARITY_LABELS, MOB_TYPE_LABELS } from "@/lib/mob-levels";
import { mobCatalogRepository } from "@/lib/mob-levels-ui";

export const Route = createFileRoute("/mobs")({
  head: () => ({
    meta: [
      { title: "Всі моби — NoNameClan" },
      {
        name: "description",
        content: "Повний каталог мобів: зображення, id, назва та image_url.",
      },
      { property: "og:title", content: "Всі моби — NoNameClan" },
      {
        property: "og:description",
        content: "Повний каталог мобів: зображення, id, назва та image_url.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MobsPage,
});

function MobsPage() {
  const [filter, setFilter] = useState("");

  const catalogQuery = useQuery({
    queryKey: ["mob-catalog"],
    queryFn: () => mobCatalogRepository.getAll(),
  });

  const mobs = useMemo(() => {
    const normalized = filter.trim().toLocaleLowerCase("uk");
    return (catalogQuery.data ?? []).filter(
      (mob) =>
        mob.name.toLocaleLowerCase("uk").includes(normalized) ||
        mob.id.toLocaleLowerCase("uk").includes(normalized),
    );
  }, [catalogQuery.data, filter]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12 pt-6">
        <Link
          to="/mob-levels"
          search={{ playerId: undefined }}
          className="inline-flex rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition hover:bg-accent"
        >
          ← Рівні мобів
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">🗂 Всі моби</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Повний перелік мобів у базі: зображення, <code>id</code>, <code>name</code> та{" "}
          <code>image_url</code>. Кожна картка — це один запис БД, тож зображення однозначно
          пов’язане зі своїм ідентифікатором.
        </p>

        <div className="relative mt-5">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Пошук за назвою або id…"
            className="pl-9"
          />
        </div>

        {catalogQuery.isLoading && (
          <p className="mt-5 text-sm text-muted-foreground">Завантаження каталогу…</p>
        )}

        {catalogQuery.error && (
          <p className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Не вдалося завантажити каталог мобів.
          </p>
        )}

        {!catalogQuery.isLoading && !catalogQuery.error && (
          <>
            <p className="mt-4 text-xs text-muted-foreground">Знайдено записів: {mobs.length}</p>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {mobs.map((mob) => (
                <article
                  key={mob.id}
                  data-mob-id={mob.id}
                  className="flex gap-3 rounded-2xl border border-border bg-card/60 p-3"
                >
                  {mob.imageUrl ? (
                    <img
                      src={mob.imageUrl}
                      alt={`Зображення моба ${mob.name}`}
                      loading="lazy"
                      className="h-20 w-20 shrink-0 rounded-xl border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-3xl">
                      👾
                    </div>
                  )}
                  <dl className="min-w-0 flex-1 space-y-1 text-xs">
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-muted-foreground">name</dt>
                      <dd className="min-w-0 break-words font-semibold text-sm">{mob.name}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-muted-foreground">id</dt>
                      <dd className="min-w-0 break-all font-mono">{mob.id}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-muted-foreground">image_url</dt>
                      <dd className="min-w-0 break-all font-mono">{mob.imageUrl ?? "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-muted-foreground">тип</dt>
                      <dd className="min-w-0">
                        {MOB_TYPE_LABELS[mob.mobType]}
                        {mob.rarity ? ` • ${MOB_RARITY_LABELS[mob.rarity]}` : ""}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            {mobs.length > 0 && (
              <details className="mt-6 rounded-2xl border border-border bg-card/40 p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  JSON для аналізу (id ↔ image_url)
                </summary>
                <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-secondary p-3 text-[11px] leading-relaxed">
                  {JSON.stringify(
                    mobs.map((mob) => ({
                      id: mob.id,
                      name: mob.name,
                      image_url: mob.imageUrl,
                      mob_type: mob.mobType,
                      rarity: mob.rarity,
                    })),
                    null,
                    2,
                  )}
                </pre>
              </details>
            )}
          </>
        )}
      </main>
    </div>
  );
}
