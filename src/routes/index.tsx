import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { TowerModal } from "@/components/TowerModal";
import * as Dialog from "@radix-ui/react-dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GvG Вежі — Watcher of Realms" },
      { name: "description", content: "48 веж GvG — швидкий трекер проходки." },
      { property: "og:title", content: "GvG Вежі — Watcher of Realms" },
      { property: "og:description", content: "48 веж GvG — швидкий трекер проходки." },
    ],
  }),
  component: HomePage,
});

type Tower = {
  tower_id: string;
  nickname: string | null;
  awakenings: string | null;
  notes: string | null;
};

const COLUMNS = [1, 2, 3, 4] as const;
const ROWS: Array<[number, number]> = [
  [1, 1], [1, 2],
  [2, 1], [2, 2],
  [3, 1], [3, 2],
  [4, 1], [4, 2],
  [5, 1], [5, 2],
  [6, 1], [6, 2],
];

function HomePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: towers = [], refetch } = useQuery({
    queryKey: ["towers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("towers").select("*");
      if (error) throw error;
      return (data ?? []) as Tower[];
    },
  });

  const map = new Map(towers.map((t) => [t.tower_id, t]));
  const existing = selected ? map.get(selected) : undefined;

  const openTower = (id: string) => {
    setSelected(id);
    setModalOpen(true);
  };

  const handleClearAll = async () => {
    setBusy(true);
    if (towers.length > 0) {
      const archiveRows = towers.map((t) => ({
        tower_id: t.tower_id,
        nickname: t.nickname,
        awakenings: t.awakenings,
        notes: t.notes,
      }));
      const { error: archErr } = await supabase.from("towers_archive").insert(archiveRows);
      if (archErr) {
        setBusy(false);
        return;
      }
      const { error: delErr } = await supabase.from("towers").delete().neq("tower_id", "");
      if (delErr) {
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    setClearOpen(false);
    refetch();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Toaster theme="dark" position="top-center" richColors />
      <AppHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 pb-6 pt-4 sm:px-4">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {COLUMNS.map((col) => (
            <div
              key={col}
              className="rounded-xl border border-border bg-card/40 p-3 sm:p-4"
            >
              <div className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Стовпчик {col}
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {ROWS.map(([r, s]) => {
                  const id = `${col}.${r}.${s}`;
                  const active = map.has(id);
                  return (
                    <button
                      key={id}
                      onClick={() => openTower(id)}
                      className={[
                        "rounded-md px-2 py-2 text-[11px] font-semibold transition-colors duration-300 active:scale-95 sm:text-sm",
                        active
                          ? "bg-tower-active text-tower-active-foreground shadow-[0_0_16px_-8px_var(--tower-active)]"
                          : "bg-tower-idle text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      🏰 {id}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            to="/archive"
            className="block w-full rounded-xl border border-border bg-card px-4 py-3 text-center text-sm font-semibold text-foreground transition hover:border-primary/40 hover:bg-accent"
          >
            📦 Архів
          </Link>

          <button
            onClick={() => setClearOpen(true)}
            className="w-full rounded-xl border border-destructive/50 bg-destructive/20 px-4 py-3 text-center text-sm font-semibold text-destructive-foreground transition hover:bg-destructive/30"
          >
            🗑 Видалити всі записи
          </button>
        </div>
      </main>

      <TowerModal
        towerId={selected}
        open={modalOpen}
        existing={existing}
        onOpenChange={setModalOpen}
        onChanged={() => refetch()}
      />

      <Dialog.Root open={clearOpen} onOpenChange={setClearOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 duration-200">
            <Dialog.Title className="text-base font-semibold text-foreground">
              Підтвердження
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Всі записи будуть перенесені до архіву. Продовжити?
            </Dialog.Description>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                disabled={busy}
                onClick={handleClearAll}
                className="rounded-lg bg-destructive px-3 py-2.5 text-sm font-semibold text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                Так
              </button>
              <button
                disabled={busy}
                onClick={() => setClearOpen(false)}
                className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground transition hover:bg-accent"
              >
                Скасувати
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
