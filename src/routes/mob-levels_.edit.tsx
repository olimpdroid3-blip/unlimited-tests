import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast, Toaster } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { PlayerSelectField } from "@/components/PlayerSelectField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getChangedMobNames,
  getRemovedMobIds,
  haveSameMobNameDraft,
  haveSameMobLevelDraft,
  isValidMobName,
  isValidMobLevel,
  type Mob,
  type MobLevelDraft,
  type MobNameDraft,
} from "@/lib/mob-levels";
import {
  loadMobLevelPlayers,
  mobCatalogRepository,
  mobLevelsRepository,
} from "@/lib/mob-levels-ui";

type MobLevelsEditSearch = {
  playerId?: string;
};

export const Route = createFileRoute("/mob-levels_/edit")({
  validateSearch: (search: Record<string, unknown>): MobLevelsEditSearch => ({
    playerId: typeof search.playerId === "string" ? search.playerId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Редагування рівнів мобів — Ukraine Unlimited" },
      {
        name: "description",
        content: "Редагування рівнів мобів учасників гільдії.",
      },
    ],
  }),
  component: MobLevelsEditorPage,
});

function MobLevelsEditorPage() {
  const { playerId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const [baseline, setBaseline] = useState<MobLevelDraft[]>([]);
  const [draft, setDraft] = useState<MobLevelDraft[]>([]);
  const [nameBaseline, setNameBaseline] = useState<MobNameDraft[]>([]);
  const [nameDraft, setNameDraft] = useState<MobNameDraft[]>([]);
  const [mobSearch, setMobSearch] = useState("");
  const [isLoadingLevels, setIsLoadingLevels] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

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
  const hasLevelChanges = !haveSameMobLevelDraft(baseline, draft);
  const hasNameChanges = !haveSameMobNameDraft(nameBaseline, nameDraft);
  const isDirty = hasLevelChanges || hasNameChanges;
  const isValidDraft = draft.every(({ level }) => isValidMobLevel(level));
  const areNamesValid = nameDraft.every(({ name }) => isValidMobName(name));
  const canSave = Boolean(
    selectedPlayerId && catalog.length > 0 && isDirty && isValidDraft && areNamesValid && !isSaving,
  );

  useEffect(() => {
    const loadedNames = catalog.map(({ id, name }) => ({ mobId: id, name }));
    setNameBaseline(loadedNames);
    setNameDraft(loadedNames);
  }, [catalog]);

  useEffect(() => {
    let isCancelled = false;
    setStorageError(null);
    setMobSearch("");

    if (!selectedPlayerId) {
      setBaseline([]);
      setDraft([]);
      setIsLoadingLevels(false);
      return () => {
        isCancelled = true;
      };
    }

    setIsLoadingLevels(true);
    void mobLevelsRepository
      .getByPlayer(selectedPlayerId)
      .then((levels) => {
        if (isCancelled) return;
        const loadedDraft = levels.map(({ mobId, level }) => ({ mobId, level }));
        setBaseline(loadedDraft);
        setDraft(loadedDraft);
      })
      .catch(() => {
        if (!isCancelled) setStorageError("Не вдалося прочитати локально збережені рівні.");
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingLevels(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedPlayerId]);

  const mobsById = useMemo(() => new Map(catalog.map((mob) => [mob.id, mob])), [catalog]);
  const nameDraftById = useMemo(
    () => new Map(nameDraft.map(({ mobId, name }) => [mobId, name])),
    [nameDraft],
  );
  const draftRows = useMemo(
    () =>
      draft
        .flatMap((row) => {
          const mob = mobsById.get(row.mobId);
          return mob ? [{ ...row, mob }] : [];
        })
        .sort((left, right) => left.mob.name.localeCompare(right.mob.name, "uk")),
    [draft, mobsById],
  );
  const draftMobIds = useMemo(() => new Set(draft.map(({ mobId }) => mobId)), [draft]);
  const availableMobs = useMemo(() => {
    const normalizedSearch = mobSearch.trim().toLocaleLowerCase("uk");
    return catalog
      .filter((mob) => !draftMobIds.has(mob.id))
      .filter((mob) => mob.name.toLocaleLowerCase("uk").includes(normalizedSearch))
      .sort((left, right) => left.name.localeCompare(right.name, "uk"))
      .slice(0, 20);
  }, [catalog, draftMobIds, mobSearch]);

  function changePlayer(nextPlayerId: string) {
    if (isDirty && !window.confirm("Відхилити незбережені зміни?")) return;
    setNameDraft(nameBaseline);
    void navigate({ search: { playerId: nextPlayerId || undefined } });
  }

  function addMob(mob: Mob) {
    setDraft((current) => [...current, { mobId: mob.id, level: 1 }]);
    setMobSearch("");
  }

  function updateLevel(mobId: string, rawValue: string) {
    const level = rawValue === "" ? null : Number(rawValue);
    setDraft((current) => current.map((row) => (row.mobId === mobId ? { ...row, level } : row)));
  }

  function updateMobName(mobId: string, name: string) {
    setNameDraft((current) => current.map((row) => (row.mobId === mobId ? { ...row, name } : row)));
  }

  async function saveChanges() {
    if (!selectedPlayerId || !canSave) return;
    setIsSaving(true);
    setStorageError(null);

    try {
      if (hasLevelChanges) {
        await mobLevelsRepository.upsertMany(
          draft.map(({ mobId, level }) => ({
            playerId: selectedPlayerId,
            mobId,
            level: level!,
          })),
        );
        const removedMobIds = getRemovedMobIds(baseline, draft);
        await Promise.all(
          removedMobIds.map((mobId) => mobLevelsRepository.remove(selectedPlayerId, mobId)),
        );
      }

      const changedNames = getChangedMobNames(nameBaseline, nameDraft);
      await mobCatalogRepository.updateNames(changedNames);

      const [savedLevels, savedCatalog] = await Promise.all([
        mobLevelsRepository.getByPlayer(selectedPlayerId),
        mobCatalogRepository.getAll(),
      ]);
      const savedDraft = savedLevels.map(({ mobId, level }) => ({ mobId, level }));
      const savedNames = savedCatalog.map(({ id, name }) => ({ mobId: id, name }));
      setBaseline(savedDraft);
      setDraft(savedDraft);
      setNameBaseline(savedNames);
      setNameDraft(savedNames);
      await queryClient.invalidateQueries({ queryKey: ["mob-catalog"] });
      await queryClient.invalidateQueries({ queryKey: ["mob-levels", selectedPlayerId] });
      toast.success(
        hasLevelChanges && hasNameChanges
          ? "Назви й рівні мобів збережено"
          : hasNameChanges
            ? "Назви мобів збережено"
            : "Рівні мобів збережено",
      );
    } catch {
      setStorageError("Не вдалося зберегти зміни. Внесені дані залишилися у формі.");
      toast.error("Не вдалося зберегти зміни");
    } finally {
      setIsSaving(false);
    }
  }

  const queryError = playersQuery.error ?? catalogQuery.error;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Toaster theme="light" position="top-center" richColors />
      <AppHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-12 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              to="/mob-levels"
              search={{ playerId: selectedPlayerId }}
              className="text-xs text-muted-foreground hover:text-primary"
            >
              ← До перегляду
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">✏️ Редагування рівнів мобів</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Назва спільна для всіх гравців, рівень має бути від 1 до 30.
            </p>
          </div>
          <Button disabled={!canSave} onClick={() => void saveChanges()}>
            {isSaving ? "Збереження…" : "💾 Зберегти зміни"}
          </Button>
        </div>

        <section className="mt-5 rounded-2xl border border-border bg-card/60 p-4">
          <PlayerSelectField
            id="mob-level-editor-player"
            value={selectedPlayerId}
            players={players}
            disabled={playersQuery.isLoading || players.length === 0 || isSaving}
            onValueChange={changePlayer}
          />
        </section>

        {(queryError || storageError) && (
          <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {storageError ?? "Не вдалося завантажити дані. Оновіть сторінку й спробуйте ще раз."}
          </p>
        )}

        {!queryError && !playersQuery.isLoading && players.length === 0 && (
          <EmptyEditorState
            title="Немає гравців із заповненим БС"
            description="Спочатку додайте учасника на сторінці бойової сили."
          />
        )}

        {!queryError && players.length > 0 && !catalogQuery.isLoading && catalog.length === 0 && (
          <EmptyEditorState
            title="Каталог мобів ще не завантажений"
            description="Після імпорту CSV тут можна буде додавати мобів і встановлювати рівні."
          />
        )}

        {!queryError && catalog.length > 0 && !selectedPlayerId && (
          <EmptyEditorState
            title="Оберіть гравця"
            description="Виберіть нік, щоб редагувати його мобів."
          />
        )}

        {!queryError && catalog.length > 0 && selectedPlayerId && (
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <section className="space-y-3">
              <div>
                <h2 className="font-semibold">Моби гравця</h2>
                <p className="text-xs text-muted-foreground">
                  {draftRows.length} записів · зміни зберігаються однією кнопкою
                </p>
              </div>

              {isLoadingLevels && (
                <p className="text-sm text-muted-foreground">Завантаження рівнів…</p>
              )}

              {!isLoadingLevels && draftRows.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Для цього гравця мобів ще не додано.
                </div>
              )}

              {draftRows.map(({ mob, level }) => {
                const mobName = nameDraftById.get(mob.id) ?? mob.name;
                return (
                  <article
                    key={mob.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3"
                  >
                    {mob.imageUrl ? (
                      <img
                        src={mob.imageUrl}
                        alt=""
                        className="h-12 w-12 rounded-xl border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-secondary text-xl">
                        👾
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <label className="block text-xs text-muted-foreground">
                        Назва моба
                        <Input
                          value={mobName}
                          onChange={(event) => updateMobName(mob.id, event.target.value)}
                          aria-invalid={!isValidMobName(mobName)}
                          className="mt-1 h-8"
                        />
                      </label>
                      {!isValidMobName(mobName) && (
                        <p className="mt-1 text-xs text-destructive">
                          Назва не може бути порожньою
                        </p>
                      )}
                      <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        Рівень
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          step={1}
                          value={level ?? ""}
                          onChange={(event) => updateLevel(mob.id, event.target.value)}
                          className="h-8 w-20"
                          aria-invalid={!isValidMobLevel(level)}
                        />
                      </label>
                      {!isValidMobLevel(level) && (
                        <p className="mt-1 text-xs text-destructive">
                          Вкажіть ціле число від 1 до 30
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Видалити ${mobName}`}
                      onClick={() =>
                        setDraft((current) => current.filter(({ mobId }) => mobId !== mob.id))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </article>
                );
              })}
            </section>

            <aside className="h-fit rounded-2xl border border-border bg-card/60 p-4 lg:sticky lg:top-24">
              <h2 className="font-semibold">Додати моба</h2>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={mobSearch}
                  onChange={(event) => setMobSearch(event.target.value)}
                  placeholder="Пошук за назвою…"
                  className="pl-9"
                />
              </div>
              <div className="mt-3 max-h-80 space-y-1 overflow-y-auto">
                {availableMobs.map((mob) => (
                  <button
                    key={mob.id}
                    type="button"
                    onClick={() => addMob(mob)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-accent"
                  >
                    <Plus className="h-4 w-4 text-primary" />
                    <span className="truncate">{mob.name}</span>
                  </button>
                ))}
                {availableMobs.length === 0 && (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    Немає доступних мобів
                  </p>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyEditorState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-border bg-card/30 px-5 py-10 text-center">
      <div className="text-3xl">👾</div>
      <h2 className="mt-3 font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
