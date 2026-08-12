import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { HeroPicker, type HeroOption } from "@/components/HeroPicker";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/videos")({
  head: () => ({
    meta: [
      { title: "Відео проходок — Ukraine Unlimited" },
      {
        name: "description",
        content:
          "Пошук відео проходок GvG за героями. Посилання на оригінальні відео в Telegram.",
      },
      { property: "og:title", content: "Відео проходок — Ukraine Unlimited" },
      {
        property: "og:description",
        content: "Пошук відео проходок GvG за героями.",
      },
    ],
  }),
  component: VideosPage,
});

const PAGE_SIZE = 20;

type VideoRow = {
  id: string;
  message_date: string | null;
  created_at: string;
  telegram_message_link: string | null;
  notes: string | null;
  telegram_uploader_name: string | null;
  telegram_uploader_custom_title: string | null;
  video_heroes: Array<{ heroes: { id: string; name_ru: string } | null }>;
};

const SELECT =
  "id, message_date, created_at, telegram_message_link, notes, telegram_uploader_name, telegram_uploader_custom_title, video_heroes(heroes(id, name_ru))";

function formatDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function VideosPage() {
  const [picks, setPicks] = useState<(string | null)[]>([null, null, null, null, null]);
  const [rows, setRows] = useState<VideoRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"search" | "all">("search");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const { data: heroes = [] } = useQuery({
    queryKey: ["heroes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("heroes")
        .select("id, name_en, name_ru, icon_url")
        .order("name_ru");
      if (error) throw error;
      return (data ?? []) as HeroOption[];
    },
  });

  const { data: bpRows = [] } = useQuery({
    queryKey: ["battle-power-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("battle_power")
        .select("nickname, power1, power2, power3");
      if (error) throw error;
      return data ?? [];
    },
  });

  const bpMap = new Map<string, (number | null)[]>(
    bpRows.map((r) => [
      (r.nickname ?? "").trim().toLowerCase(),
      [r.power1, r.power2, r.power3],
    ]),
  );

  const selected = picks.filter((p): p is string => !!p);

  async function runSearch() {
    setLoading(true);
    setErr(null);
    setMode("search");
    setPage(0);
    setHasMore(false);
    try {
      const { data: links, error: linkErr } = await supabase
        .from("video_heroes")
        .select("video_message_id, hero_id")
        .in("hero_id", selected);
      if (linkErr) throw linkErr;

      const counts = new Map<string, Set<string>>();
      for (const l of links ?? []) {
        const set = counts.get(l.video_message_id) ?? new Set<string>();
        set.add(l.hero_id);
        counts.set(l.video_message_id, set);
      }
      const ids = [...counts.entries()]
        .filter(([, s]) => s.size === selected.length)
        .map(([id]) => id);

      if (ids.length === 0) {
        setRows([]);
        return;
      }

      const { data, error } = await supabase
        .from("telegram_video_messages")
        .select(SELECT)
        .in("id", ids.slice(0, 200))
        .order("message_date", { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      setRows((data ?? []) as unknown as VideoRow[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка пошуку");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadAll(nextPage = 0) {
    setLoading(true);
    setErr(null);
    setMode("all");
    try {
      const from = nextPage * PAGE_SIZE;
      const { data, error } = await supabase
        .from("telegram_video_messages")
        .select(SELECT)
        .order("message_date", { ascending: false, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const batch = (data ?? []) as unknown as VideoRow[];
      setRows((prev) => (nextPage === 0 ? batch : [...(prev ?? []), ...batch]));
      setPage(nextPage);
      setHasMore(batch.length === PAGE_SIZE);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка завантаження");
    } finally {
      setLoading(false);
    }
  }

  function patchRow(id: string, notes: string) {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, notes } : r)) ?? prev);
  }
  function dropRow(id: string) {
    setRows((prev) => prev?.filter((r) => r.id !== id) ?? prev);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-12 pt-6">
        <h1 className="text-xl font-bold sm:text-2xl">🎥 Відео проходок</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Пошук проіндексованих відео з Telegram. Відео залишаються в Telegram.
        </p>

        <section className="mt-5 rounded-2xl border border-border bg-card/60 p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {picks.map((v, i) => (
              <HeroPicker
                key={i}
                heroes={heroes}
                value={v}
                onChange={(id) =>
                  setPicks((p) => p.map((x, idx) => (idx === i ? id : x)))
                }
                placeholder={`Герой ${i + 1}`}
                excludeIds={selected}
              />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={selected.length === 0 || loading}
              onClick={() => runSearch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
            >
              🔎 Пошук
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => loadAll(0)}
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium transition hover:bg-accent disabled:opacity-40"
            >
              📋 Всі відео
            </button>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => setPicks([null, null, null, null, null])}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
              >
                ✕ Очистити
              </button>
            )}
          </div>
        </section>

        {err && (
          <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </p>
        )}

        {loading && (
          <p className="mt-4 text-sm text-muted-foreground">Завантаження…</p>
        )}

        {rows !== null && !loading && rows.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Нічого не знайдено
          </p>
        )}

        {rows && rows.length > 0 && (
          <div className="mt-5 space-y-3">
            {rows.map((r) => (
              <VideoCard
                key={r.id}
                row={r}
                canDelete={mode === "all"}
                power={bpMap.get(((r.telegram_uploader_custom_title ?? r.telegram_uploader_name) ?? "").trim().toLowerCase())}
                onNotes={(n) => patchRow(r.id, n)}
                onDeleted={() => dropRow(r.id)}
              />
            ))}
          </div>
        )}

        {mode === "all" && hasMore && !loading && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => loadAll(page + 1)}
              className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-accent"
            >
              Показати ще
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function VideoCard({
  row,
  onNotes,
  onDeleted,
  canDelete,
  power,
}: {
  row: VideoRow;
  onNotes: (n: string) => void;
  onDeleted: () => void;
  canDelete: boolean;
  power?: (number | null)[] | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.notes ?? "");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const powerText = (power ?? [])
    .filter((v): v is number => v !== null && v !== undefined)
    .map((v) => Number(v).toFixed(1).replace(/\.0$/, ""))
    .join(" | ");

  const heroNames = row.video_heroes
    .map((v) => v.heroes?.name_ru)
    .filter((n): n is string => !!n);

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("telegram_video_messages")
      .update({ notes: draft.trim() || null })
      .eq("id", row.id);
    setBusy(false);
    if (!error) {
      onNotes(draft.trim());
      setEditing(false);
    }
  }

  async function remove() {
    setBusy(true);
    await supabase.from("video_heroes").delete().eq("video_message_id", row.id);
    const { error } = await supabase
      .from("telegram_video_messages")
      .delete()
      .eq("id", row.id);
    setBusy(false);
    if (!error) onDeleted();
    setConfirming(false);
  }

  return (
    <article className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">🎥 Відео</span>
        <span className="text-xs text-muted-foreground">
          📅 {formatDate(row.message_date ?? row.created_at)}
        </span>
      </div>

      {(row.telegram_uploader_custom_title ?? row.telegram_uploader_name) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-medium">
            👤 {row.telegram_uploader_custom_title ?? row.telegram_uploader_name}
          </span>
          {powerText && (
            <span className="text-sm text-muted-foreground">💪 {powerText}</span>
          )}
        </div>
      )}

      {heroNames.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {heroNames.map((n, i) => (
            <span
              key={i}
              className="rounded-md border border-border bg-secondary px-2 py-0.5 text-xs"
            >
              {n}
            </span>
          ))}
        </div>
      )}

      {editing ? (
        <div className="mt-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none"
            placeholder="Примітки…"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              💾 Зберегти
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(row.notes ?? "");
                setEditing(false);
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-sm"
            >
              ❌ Скасувати
            </button>
          </div>
        </div>
      ) : (
        row.notes && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            📝 {row.notes}
          </p>
        )
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {row.telegram_message_link && (
          <a
            href={row.telegram_message_link}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            ▶️ Відкрити відео
          </a>
        )}
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm transition hover:bg-accent"
          >
            ✏️ Редагувати примітки
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-destructive/40 px-3 py-1.5 text-sm text-destructive transition hover:bg-destructive/10"
          >
            🗑️ Видалити
          </button>
        )}
      </div>

      {canDelete && confirming && (
        <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <p className="text-sm">Ви впевнені, що хочете видалити цей запис?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Відео в Telegram залишиться без змін.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm"
            >
              ❌ Скасувати
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground disabled:opacity-50"
            >
              🗑️ Видалити
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
