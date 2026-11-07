import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { awakeningLabel, formatBp, scoutingDate, type ScoutingResult } from "@/lib/awakening";

export function AwakeningScouting({ data, loading, error, onRefresh }: {
  data?: ScoutingResult; loading: boolean; error: boolean; onRefresh: () => void;
}) {
  return (
    <section className="mt-5 border-t border-border pt-4" aria-labelledby="scouting-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="scouting-title" className="text-base font-semibold">Розвідка суперника</h2>
        <Button variant="ghost" size="icon" aria-label="Оновити розвідку" title="Оновити розвідку" disabled={loading} onClick={onRefresh}>
          <RefreshCw className={loading ? "animate-spin motion-reduce:animate-none" : ""} />
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Пробуди розраховані. Невідоме значення — не A0. Лише поточний матч.</p>
      {error ? <p role="alert" className="text-sm text-destructive">Не вдалося завантажити розвідку.</p> : !data ? <p className="text-sm text-muted-foreground">Завантаження…</p> : !data.reports.length ? <p className="text-sm text-muted-foreground">У поточному матчі розвідки ще немає.</p> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.reports.map((report) => (
            <article key={report.tower_position} className="min-w-0 rounded-md border border-border bg-card p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-1 text-sm">
                <h3 className="min-w-0 font-semibold [overflow-wrap:anywhere]"><span className="font-mono">{report.tower_position}</span> · {report.player_name}</h3>
                <span>БС: {formatBp(report.total_bp)}</span>
              </div>
              <ol className="mt-2 space-y-1 text-xs">
                {Array.from({ length: 5 }, (_, index) => {
                  const hero = report.heroes[index];
                  return <li key={index} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                    <span className="[overflow-wrap:anywhere]">{hero?.name ?? "Невідомий герой"}</span>
                    <span className="tabular-nums">{formatBp(hero?.bp ?? null)}</span>
                    <span className="min-w-14 text-right text-muted-foreground">{awakeningLabel(hero?.awakening ?? null)}</span>
                  </li>;
                })}
              </ol>
              <p className="mt-2 text-[10px] text-muted-foreground">Знімок: {scoutingDate(report.captured_at)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}