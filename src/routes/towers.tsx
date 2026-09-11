import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/db";
import { AppHeader } from "@/components/AppHeader";
import { Toaster } from "@/components/ui/sonner";
import { TowerModal } from "@/components/TowerModal";
import { MirrorOrderModal } from "@/components/MirrorOrderModal";
import { isMirrorRow, MIRROR_PREFIX } from "@/lib/mirror-order";
import * as Dialog from "@radix-ui/react-dialog";
import { getTowerStatusFlags, getTowerStatuses, TOWER_STATUS_LABELS } from "@/lib/tower-status";
import { VALID_TOWER_IDS } from "@/lib/mirror-order";

export const Route = createFileRoute("/towers")({
  head: () => ({
    meta: [
      { title: "Вежі — GvG" },
      { name: "description", content: "48 веж GvG — швидкий трекер проходки." },
      { property: "og:title", content: "Вежі — GvG" },
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
  breached?: boolean | null;
  placed?: boolean | null;
  testing?: boolean | null;
  destroyed?: boolean | null;
  removed?: boolean | null;
  previous_nickname?: string | null;
  screenshot_url?: string | null;
  screenshot_path?: string | null;
};

const COMPACT_STATUS_LABELS = {
  placed: "Вист.",
  breached: "Проб.",
  testing: "Тест",
  destroyed: "Знищ.",
  removed: "Знятий",
} as const;

const COLUMNS = [
  { num: 1, label: "I", color: "text-col-i" },
  { num: 2, label: "II", color: "text-col-ii" },
  { num: 3, label: "III", color: "text-col-iii" },
  { num: 4, label: "IV", color: "text-col-iv" },
] as const;

// Pairs of towers grouped visually: (r.1) + (r.2) in a bordered frame.
const PAIRS: Array<[[number, number], [number, number]]> = [
  [
    [1, 1],
    [1, 2],
  ],
  [
    [2, 1],
    [2, 2],
  ],
  [
    [3, 1],
    [3, 2],
  ],
  [
    [4, 1],
    [4, 2],
  ],
  [
    [5, 1],
    [5, 2],
  ],
  [
    [6, 1],
    [6, 2],
  ],
];

function HomePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [mirrorOpen, setMirrorOpen] = useState(false);

  const { data: towers = [], refetch } = useQuery({
    queryKey: ["towers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("towers").select("*");
      if (error) throw error;
      return (data ?? []) as Tower[];
    },
  });

  const realTowers = towers.filter((t) => !isMirrorRow(t.tower_id));
  const { data: variants = [], refetch: refetchVariants } = useQuery({
    queryKey: ["tower-defense-variants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tower_defense_variants")
        .select("tower_id,variant");
      if (error) throw error;
      return data ?? [];
    },
  });
  const variantsByTower = new Map(variants.map((row) => [row.tower_id, row.variant]));
  const mirrorRequested = new Set(
    towers
      .filter((t) => isMirrorRow(t.tower_id))
      .map((t) => t.tower_id.slice(MIRROR_PREFIX.length)),
  );
  const map = new Map(realTowers.map((t) => [t.tower_id, t]));
  const existing = selected ? map.get(selected) : undefined;

  const openTower = (id: string) => {
    setSelected(id);
    setModalOpen(true);
  };

  useEffect(() => {
    const towerId = new URLSearchParams(window.location.search).get("tower");
    if (towerId && VALID_TOWER_IDS.includes(towerId)) openTower(towerId);
  }, []);

  const handleClearAll = async () => {
    setBusy(true);
    if (towers.length > 0 || variants.length > 0) {
      const archiveIds = new Set([
        ...realTowers.map((tower) => tower.tower_id),
        ...variantsByTower.keys(),
      ]);
      const archiveRows = [...archiveIds].map((id) => ({
        tower_id: id,
        nickname: map.get(id)?.nickname ?? null,
        awakenings: map.get(id)?.awakenings ?? null,
        notes: map.get(id)?.notes ?? null,
        defense_variant: variantsByTower.get(id) ?? null,
        ...getTowerStatusFlags(map.get(id)),
        previous_nickname: map.get(id)?.previous_nickname ?? null,
        // Tower screenshots are wiped along with the records; only copies
        // already saved into the defenses database survive.
        screenshot_url: null,
      }));
      const { error: archErr } = await supabase.from("towers_archive").insert(archiveRows);
      if (archErr) {
        setBusy(false);
        return;
      }
      const screenshotPaths = realTowers
        .map((t) => t.screenshot_path)
        .filter((path): path is string => Boolean(path));
      if (screenshotPaths.length > 0) {
        await supabase.storage.from("defense-screenshots").remove(screenshotPaths);
      }
      const { error: delErr } = await supabase.from("towers").delete().neq("tower_id", "");
      if (delErr) {
        setBusy(false);
        return;
      }
      const { error: variantError } = await supabase
        .from("tower_defense_variants")
        .delete()
        .neq("tower_id", "");
      if (variantError) {
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    setClearOpen(false);
    setConfirmOpen(false);
    setConfirmText("");
    refetch();
    refetchVariants();
  };

  // Second-step confirmation: proceed only if the user typed "згоден"
  const proceedFromFirst = () => {
    setClearOpen(false);
    setConfirmOpen(true);
    setConfirmText("");
  };

  const confirmReady = confirmText.trim().toLowerCase() === "згоден";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Toaster position="top-center" richColors />
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl px-3 pb-6 pt-4 sm:px-4">
        {/* 4-column grid of towers */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {COLUMNS.map((col) => (
            <div key={col.num} className="row-span-13 grid grid-rows-subgrid">
              <div
                className={[
                  "text-center text-base font-bold tracking-widest sm:text-lg",
                  col.color,
                ].join(" ")}
              >
                {col.label}
              </div>
              <div className="row-span-12 grid grid-rows-subgrid">
                {PAIRS.map((pair, pIdx) => (
                  <div
                    key={pIdx}
                    className="row-span-2 grid grid-rows-subgrid gap-y-1 rounded-lg border-2 border-border/50 p-1 sm:gap-y-1.5 sm:p-1.5"
                  >
                    {pair.map(([r, s]) => {
                      const id = `${col.num}.${r}.${s}`;
                      const tower = map.get(id);
                      const variant = variantsByTower.get(id);
                      const status = getTowerStatusFlags(tower);
                      const statuses = getTowerStatuses(tower);
                      const active = status.placed;
                      const breached = status.breached;
                      const mirror = mirrorRequested.has(id);
                      return (
                        <button
                          key={id}
                          onClick={() => openTower(id)}
                          aria-label={[
                            id,
                            variant != null ? `К${variant}` : null,
                            ...statuses.map((flag) => TOWER_STATUS_LABELS[flag]),
                            status.removed
                              ? `Був: ${tower?.previous_nickname || "нік не вказаний"}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          className={[
                            "relative grid min-h-14 min-w-0 grid-cols-1 grid-rows-[1rem_1.25rem_auto] content-start items-start gap-1 rounded-md px-1.5 py-1.5 text-left text-xs font-semibold transition-colors duration-200 active:scale-95 sm:min-h-16 sm:grid-rows-[1.25rem_1.25rem_auto_auto] sm:rounded-lg sm:px-3 sm:text-sm",
                            "border",
                            status.removed
                              ? "border-dashed border-violet-500 bg-violet-50 text-violet-950 dark:border-violet-400 dark:bg-violet-950 dark:text-violet-100"
                              : status.destroyed
                                ? "border-red-700 bg-red-700 text-white"
                                : status.testing
                                  ? "border-blue-700 bg-blue-700 text-white"
                                  : breached
                                    ? "border-tower-breached/40 bg-tower-breached text-tower-breached-foreground shadow-[0_0_14px_-6px_var(--tower-breached)]"
                                    : mirror
                                      ? "border-2 border-primary bg-tower-idle text-tower-idle-text hover:text-foreground"
                                      : active
                                        ? "border-tower-active/40 bg-tower-active text-tower-active-foreground shadow-[0_0_14px_-6px_var(--tower-active)]"
                                        : "border-border bg-tower-idle text-tower-idle-text hover:text-foreground",
                          ].join(" ")}
                        >
                          <span className="flex items-center gap-1 sm:gap-2">
                            <span className="hidden h-2 w-2 shrink-0 rounded-full bg-current opacity-70 sm:block" />
                            <span className="whitespace-nowrap font-mono leading-4 sm:tracking-wide">
                              {id}
                            </span>
                          </span>
                          <span className="flex h-5 items-start">
                            {variant != null && (
                              <span
                                title={`Варіант дефу К${variant}`}
                                className="whitespace-nowrap rounded border border-current/30 px-1 font-mono text-[10px] font-bold leading-4 sm:px-1.5 sm:text-xs"
                              >
                                К{variant}
                              </span>
                            )}
                          </span>
                          <span className="flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap">
                            {statuses.map((flag) => (
                              <span
                                key={flag}
                                title={TOWER_STATUS_LABELS[flag]}
                                className={[
                                  "max-w-full rounded text-[9px] leading-3 sm:px-1 sm:py-0.5 sm:text-xs",
                                  flag === "breached"
                                    ? "border border-emerald-400 bg-emerald-700 px-0.5 py-0.5 text-white"
                                    : flag === "removed"
                                      ? "border border-violet-400 bg-violet-700 px-0.5 py-0.5 text-white"
                                      : "sm:border sm:border-current/30",
                                ].join(" ")}
                              >
                                <span className="sm:hidden">{COMPACT_STATUS_LABELS[flag]}</span>
                                <span className="hidden sm:inline">
                                  {TOWER_STATUS_LABELS[flag]}
                                </span>
                              </span>
                            ))}
                          </span>
                          {status.removed && (
                            <span
                              title={`Був: ${tower?.previous_nickname || "нік не вказаний"}`}
                              className="hidden text-xs font-normal leading-tight xl:block [overflow-wrap:anywhere]"
                            >
                              Був: {tower?.previous_nickname || "нік не вказаний"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => setMirrorOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-mirror/40 bg-mirror/10 px-4 py-3 text-sm font-semibold text-mirror transition hover:bg-mirror/20"
          >
            <span>🪞</span>
            <span>Замовити Дзеркало</span>
          </button>

          <Link
            to="/archive"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-card/50 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            <span>🗄</span>
            <span>Архів</span>
          </Link>

          <button
            onClick={() => setClearOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/50 bg-destructive/15 px-4 py-3 text-sm font-semibold text-destructive transition hover:bg-destructive/25"
          >
            <span>🗑</span>
            <span>Видалити всі записи</span>
          </button>
        </div>
      </main>

      <MirrorOrderModal
        open={mirrorOpen}
        onOpenChange={setMirrorOpen}
        onChanged={() => refetch()}
      />

      <TowerModal
        towerId={selected}
        open={modalOpen}
        existing={existing}
        defenseVariant={selected ? (variantsByTower.get(selected) ?? null) : null}
        onVariantChanged={() => refetchVariants()}
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
                onClick={proceedFromFirst}
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

      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 duration-200">
            <Dialog.Title className="text-base font-semibold text-destructive">Увага!</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Ця дія видалить всі записи всіх веж!
            </Dialog.Description>
            <p className="mt-2 text-sm text-foreground">
              Для продовження напишіть — <span className="font-semibold">згоден</span>
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              placeholder="згоден"
              className="mt-3 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary"
            />
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                disabled={!confirmReady || busy}
                onClick={handleClearAll}
                className="rounded-lg bg-destructive px-3 py-2.5 text-sm font-semibold text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                Згоден
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                }}
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
