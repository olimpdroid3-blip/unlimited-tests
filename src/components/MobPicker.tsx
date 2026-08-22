import { useEffect, useMemo, useRef, useState } from "react";
import type { Mob } from "@/lib/mob-levels";

type MobPickerProps = {
  mobs: readonly Mob[];
  value: string | null;
  onChange: (mobId: string | null) => void;
  placeholder?: string;
  excludeIds?: readonly string[];
};

export function MobPicker({
  mobs,
  value,
  onChange,
  placeholder = "Пошук моба…",
  excludeIds = [],
}: MobPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedMob = mobs.find((mob) => mob.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const filteredMobs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("uk");
    const excludedIds = new Set(excludeIds);
    return mobs
      .filter((mob) => !excludedIds.has(mob.id) || mob.id === value)
      .filter(
        (mob) => !normalizedQuery || mob.name.toLocaleLowerCase("uk").includes(normalizedQuery),
      );
  }, [excludeIds, mobs, query, value]);

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground transition hover:border-primary/40">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {selectedMob ? (
            <>
              {selectedMob.imageUrl && (
                <img
                  src={selectedMob.imageUrl}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-md border border-border object-cover"
                />
              )}
              <span className="min-w-0 flex-1 truncate">{selectedMob.name}</span>
            </>
          ) : (
            <span className="flex-1 text-muted-foreground">{placeholder}</span>
          )}
          <span className="text-muted-foreground">▾</span>
        </button>
        {selectedMob && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Очистити"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Введіть назву…"
            className="w-full border-b border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="max-h-64 overflow-y-auto">
            {filteredMobs.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                Нічого не знайдено
              </div>
            ) : (
              filteredMobs.map((mob) => (
                <button
                  type="button"
                  key={mob.id}
                  onClick={() => {
                    onChange(mob.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-accent"
                >
                  {mob.imageUrl && (
                    <img
                      src={mob.imageUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-md border border-border object-cover"
                    />
                  )}
                  <span className="truncate text-foreground">{mob.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
