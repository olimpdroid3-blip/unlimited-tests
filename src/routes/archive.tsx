import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/archive")({
  head: () => ({
    meta: [
      { title: "Архів — GvG Вежі" },
      { name: "description", content: "Архів записів веж GvG (тільки перегляд)." },
      { property: "og:title", content: "Архів — GvG Вежі" },
      { property: "og:description", content: "Архів записів веж GvG." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ArchivePage,
});

type Row = {
  id: string;
  tower_id: string;
  nickname: string | null;
  awakenings: string | null;
  notes: string | null;
  archived_at: string;
};

function ArchivePage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["towers_archive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("towers_archive")
        .select("*")
        .order("archived_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // Group by archive batch (rounded to minute) for readability
  const groups = new Map<string, Row[]>();
  for (const r of data) {
    const key = new Date(r.archived_at).toISOString().slice(0, 16);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">📦 Архів</h1>
          <Link
            to="/towers"
            className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition hover:bg-accent"
          >
            ← Назад
          </Link>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Завантаження…</div>
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
            Архів порожній
          </div>
        ) : (
          <div className="space-y-6">
            {[...groups.entries()].map(([key, rows]) => (
              <section key={key}>
                <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                  {new Date(key).toLocaleString("uk-UA")}
                </div>
                <div className="grid gap-2">
                  {rows
                    .slice()
                    .sort((a, b) => a.tower_id.localeCompare(b.tower_id))
                    .map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg border border-border bg-card p-3"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="text-sm font-semibold text-foreground">
                            🏰 {r.tower_id}
                          </div>
                          {r.nickname && (
                            <div className="truncate text-xs text-muted-foreground">
                              {r.nickname}
                            </div>
                          )}
                        </div>
                        {r.awakenings && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Пробуди: <span className="text-foreground">{r.awakenings}</span>
                          </div>
                        )}
                        {r.notes && (
                          <div className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                            {r.notes}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
