import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import type { BattlePowerRow } from "@/lib/battle-power";

export type PendingDefenseRow = {
  id: string;
  screenshot_url: string;
  run_code: string;
  comment: string | null;
  submitted_nickname: string | null;
  created_at: string;
};

function normalizeNickname(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function PendingDefensesTab({
  players,
  onOpen,
}: {
  players: BattlePowerRow[];
  onOpen: (row: PendingDefenseRow, matchedPlayerId?: string) => void;
}) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pending-defenses"],
    queryFn: async (): Promise<PendingDefenseRow[]> => {
      const { data, error } = await supabase
        .from("pending_defenses")
        .select("id,screenshot_url,run_code,comment,submitted_nickname,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PendingDefenseRow[];
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-muted-foreground">
        {isLoading ? "Завантаження…" : `На перевірку: ${rows.length}`}
      </div>

      {rows.map((row) => {
        const nickname = normalizeNickname(row.submitted_nickname);
        const matched = players.find((player) => normalizeNickname(player.nickname) === nickname);
        return (
          <button
            key={row.id}
            onClick={() => onOpen(row, matched?.id)}
            className="flex w-full gap-3 rounded-xl border border-border bg-card/50 p-2.5 text-left transition hover:border-primary/40 hover:bg-accent/40"
          >
            <img
              src={row.screenshot_url}
              alt=""
              className="h-20 w-28 shrink-0 rounded-lg border border-border bg-background object-cover sm:h-24 sm:w-36"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{row.run_code || "Без коду"}</div>
              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {row.comment || "Без коментаря"}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>📅 {formatDate(row.created_at)}</span>
                <span>👤 {matched?.nickname ?? "Не встановлено"}</span>
                {!matched && row.submitted_nickname && <span>Telegram: {row.submitted_nickname}</span>}
              </div>
            </div>
          </button>
        );
      })}

      {!isLoading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
          Немає проходок на перевірку
        </div>
      )}
    </div>
  );
}
