import { useEffect, useMemo, useRef, useState } from "react";

export type HeroOption = {
  id: string;
  name_en: string;
  name_ru: string;
  icon_url: string | null;
};

type Props = {
  heroes: HeroOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  excludeIds?: string[];
};

export function HeroPicker({
  heroes,
  value,
  onChange,
  placeholder = "Пошук героя…",
  excludeIds = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = heroes.find((h) => h.id === value) || null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const excl = new Set(excludeIds);
    return heroes
      .filter((h) => !excl.has(h.id) || h.id === value)
      .filter((h) => {
        if (!q) return true;
        return h.name_ru.toLowerCase().includes(q) || h.name_en.toLowerCase().includes(q);
      })
      .slice(0, 30);
  }, [heroes, query, excludeIds, value]);

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground transition hover:border-primary/40">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {selected ? (
            <div className="flex flex-1 flex-col leading-tight">
              <span className="text-sm text-foreground">{selected.name_ru}</span>
              <span className="text-[11px] text-muted-foreground">{selected.name_en}</span>
            </div>
          ) : (
            <span className="flex-1 text-muted-foreground">{placeholder}</span>
          )}
          <span className="text-muted-foreground">▾</span>
        </button>
        {selected && (
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введіть ім'я…"
            className="w-full border-b border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                Нічого не знайдено
              </div>
            ) : (
              filtered.map((h) => (
                <button
                  type="button"
                  key={h.id}
                  onClick={() => {
                    onChange(h.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full flex-col px-3 py-2 text-left text-sm leading-tight transition hover:bg-accent"
                >
                  <span className="text-foreground">{h.name_ru}</span>
                  <span className="text-[11px] text-muted-foreground">{h.name_en}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
