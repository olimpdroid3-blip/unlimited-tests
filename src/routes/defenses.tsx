import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { HeroPicker, type HeroOption } from "@/components/HeroPicker";
import { syncHeroes } from "@/lib/heroes.functions";

const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

async function compressImage(file: File, maxSide = 1280, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = dataUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

async function uploadToBucket(
  bucket: string,
  file: File,
  prefix: string,
): Promise<string | null> {
  const compressed = await compressImage(file);
  const extMatch = compressed.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = (extMatch?.[1] ?? compressed.type.split("/")[1] ?? "bin")
    .toLowerCase()
    .replace("jpeg", "jpg");
  const path = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, compressed, {
    contentType: compressed.type || undefined,
    upsert: true,
  });
  if (error) throw error;
  const { data: signed, error: sErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (sErr) throw sErr;
  return signed?.signedUrl ?? null;
}

export const Route = createFileRoute("/defenses")({
  head: () => ({
    meta: [
      { title: "База захистів — GvG Вежі" },
      { name: "description", content: "Додавання, пошук та керування базою проходок." },
      { property: "og:title", content: "База захистів — GvG Вежі" },
      { property: "og:description", content: "Додавання, пошук та керування базою проходок." },
    ],
  }),
  component: DefensesPage,
});

type Tab = "add" | "search" | "editor";

function DefensesPage() {
  const [tab, setTab] = useState<Tab>("add");

  const { data: heroes = [] } = useQuery({
    queryKey: ["heroes"],
    queryFn: async (): Promise<HeroOption[]> => {
      const { data, error } = await supabase
        .from("heroes")
        .select("id, name_en, name_ru, icon_url")
        .order("name_ru");
      if (error) throw error;
      return (data ?? []) as HeroOption[];
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Toaster theme="dark" position="top-center" richColors />
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-3 pb-10 pt-4 sm:px-4">
        <div className="mb-4">
          <Link
            to="/"
            className="text-xs text-muted-foreground transition hover:text-primary"
          >
            ← На головну
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight">
            <span>🛡</span>
            <span>База захистів</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Додавання, пошук та керування базою проходок.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-xl border border-border bg-card/40 p-1">
          <TabButton active={tab === "add"} onClick={() => setTab("add")}>
            ➕ <span className="hidden sm:inline">Додати захист</span>
            <span className="sm:hidden">Додати</span>
          </TabButton>
          <TabButton active={tab === "search"} onClick={() => setTab("search")}>
            🔍 <span className="hidden sm:inline">Пошук</span>
            <span className="sm:hidden">Пошук</span>
          </TabButton>
          <TabButton active={tab === "editor"} onClick={() => setTab("editor")}>
            ⚙️ <span className="hidden sm:inline">Редактор героїв</span>
            <span className="sm:hidden">Герої</span>
          </TabButton>
        </div>

        {tab === "add" && <AddTab heroes={heroes} />}
        {tab === "search" && <SearchTab heroes={heroes} />}
        {tab === "editor" && <EditorTab heroes={heroes} />}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-primary/15 text-primary shadow-inner"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ---------------- ADD TAB ----------------

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AddTab({ heroes }: { heroes: HeroOption[] }) {
  const qc = useQueryClient();
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [runCode, setRunCode] = useState("");
  const [slots, setSlots] = useState<Array<string | null>>([null, null, null, null, null]);
  const [busy, setBusy] = useState(false);

  const chosen = slots.filter((v): v is string => !!v);
  const canSave = chosen.length >= 1 && !busy;

  const onSave = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      let screenshot_url: string | null = null;
      if (screenshotFile) {
        screenshot_url = await uploadToBucket("defense-screenshots", screenshotFile, "def");
      }
      const { data: def, error } = await supabase
        .from("defenses")
        .insert({ screenshot_url, run_code: runCode.trim() || null })
        .select("id")
        .single();
      if (error) throw error;
      const rows = chosen.map((hero_id, i) => ({
        defense_id: def!.id,
        hero_id,
        position: i + 1,
      }));
      const { error: linkErr } = await supabase.from("defense_heroes").insert(rows);
      if (linkErr) throw linkErr;
      toast.success("Захист збережено");
      setScreenshot(null);
      setScreenshotFile(null);
      setRunCode("");
      setSlots([null, null, null, null, null]);
      qc.invalidateQueries({ queryKey: ["defenses"] });
    } catch (e) {
      console.error(e);
      toast.error("Не вдалося зберегти");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/50 p-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          📷 Скріншот
        </span>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const f = e.target.files?.[0] || null;
              setScreenshotFile(f);
              setScreenshot(f ? await fileToDataUrl(f) : null);
            }}
            className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-secondary-foreground hover:file:bg-accent"
          />
          {screenshot && (
            <img
              src={screenshot}
              alt=""
              className="h-16 w-16 rounded-md border border-border object-cover"
            />
          )}
        </div>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Код проходки
        </span>
        <input
          value={runCode}
          onChange={(e) => setRunCode(e.target.value)}
          placeholder="Напр. WoR-12345"
          className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none"
        />
      </label>

      {slots.map((val, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Герой {i + 1}
            {i === 0 && <span className="ml-1 text-destructive">*</span>}
          </span>
          <HeroPicker
            heroes={heroes}
            value={val}
            onChange={(id) => {
              const next = [...slots];
              next[i] = id;
              setSlots(next);
            }}
            excludeIds={chosen}
          />
        </div>
      ))}

      <button
        disabled={!canSave}
        onClick={onSave}
        className="mt-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        💾 Зберегти
      </button>
    </div>
  );
}

// ---------------- SEARCH TAB ----------------

type DefenseRow = {
  id: string;
  screenshot_url: string | null;
  run_code: string | null;
  created_at: string;
  defense_heroes: Array<{
    position: number | null;
    hero_id: string;
    heroes: { id: string; name_ru: string; name_en: string; icon_url: string | null } | null;
  }>;
};

function SearchTab({ heroes }: { heroes: HeroOption[] }) {
  const qc = useQueryClient();
  const [slots, setSlots] = useState<Array<string | null>>([null, null, null, null, null]);
  const chosen = slots.filter((v): v is string => !!v);

  const { data: allDefenses = [], isFetching } = useQuery({
    queryKey: ["defenses"],
    queryFn: async (): Promise<DefenseRow[]> => {
      const { data, error } = await supabase
        .from("defenses")
        .select(
          "id, screenshot_url, run_code, created_at, defense_heroes(position, hero_id, heroes(id, name_ru, name_en, icon_url))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DefenseRow[];
    },
  });

  const results = useMemo(() => {
    if (chosen.length === 0) return allDefenses;
    return allDefenses.filter((d) => {
      const ids = new Set(d.defense_heroes.map((r) => r.hero_id));
      return chosen.every((id) => ids.has(id));
    });
  }, [allDefenses, chosen]);

  const onDelete = async (id: string) => {
    if (!confirm("Видалити цей захист?")) return;
    const { error } = await supabase.from("defenses").delete().eq("id", id);
    if (error) {
      toast.error("Не вдалося видалити");
      return;
    }
    toast.success("Видалено");
    qc.invalidateQueries({ queryKey: ["defenses"] });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/50 p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Фільтр (AND) — оберіть від 1 до 5 героїв
        </div>
        {slots.map((val, i) => (
          <HeroPicker
            key={i}
            heroes={heroes}
            value={val}
            onChange={(id) => {
              const next = [...slots];
              next[i] = id;
              setSlots(next);
            }}
            excludeIds={chosen}
            placeholder={`Герой ${i + 1}`}
          />
        ))}
        {chosen.length > 0 && (
          <button
            onClick={() => setSlots([null, null, null, null, null])}
            className="self-start text-xs text-muted-foreground hover:text-destructive"
          >
            Очистити фільтр
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-xs text-muted-foreground">
          {isFetching ? "Пошук…" : `Знайдено: ${results.length}`}
        </div>
        {results.map((d) => (
          <DefenseCard key={d.id} defense={d} onDelete={() => onDelete(d.id)} />
        ))}
        {!isFetching && results.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
            Немає результатів
          </div>
        )}
      </div>
    </div>
  );
}

function DefenseCard({
  defense,
  onDelete,
}: {
  defense: DefenseRow;
  onDelete: () => void;
}) {
  const heroes = [...defense.defense_heroes].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const copy = async () => {
    if (!defense.run_code) return;
    await navigator.clipboard.writeText(defense.run_code);
    toast.success("Код скопійовано");
  };
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/50 p-3">
      {defense.screenshot_url && (
        <a href={defense.screenshot_url} target="_blank" rel="noreferrer">
          <img
            src={defense.screenshot_url}
            alt=""
            className="max-h-64 w-full rounded-lg border border-border object-cover"
          />
        </a>
      )}
      {defense.run_code && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-input px-3 py-2">
          <span className="text-xs text-muted-foreground">🔑</span>
          <code className="flex-1 truncate font-mono text-sm text-foreground">
            {defense.run_code}
          </code>
          <button
            onClick={copy}
            className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
          >
            📋 Копіювати
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {heroes.map((r) =>
          r.heroes ? (
            <div
              key={r.hero_id}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2 py-1"
            >
              {r.heroes.icon_url ? (
                <img
                  src={r.heroes.icon_url}
                  alt=""
                  className="h-8 w-8 rounded object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded bg-muted" />
              )}
              <span className="text-xs text-foreground">{r.heroes.name_ru}</span>
            </div>
          ) : null,
        )}
      </div>
      <div className="flex justify-end">
        <button
          onClick={onDelete}
          className="text-xs text-muted-foreground transition hover:text-destructive"
        >
          🗑 Видалити
        </button>
      </div>
    </div>
  );
}

// ---------------- EDITOR TAB ----------------

function EditorTab({ heroes }: { heroes: HeroOption[] }) {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");

  const onSync = async () => {
    setSyncing(true);
    let totalAdded = 0;
    try {
      for (let i = 0; i < 20; i++) {
        const r = await syncHeroes({ data: { limit: 60 } });
        totalAdded += r.added;
        qc.invalidateQueries({ queryKey: ["heroes"] });
        if (r.remaining === 0 || r.added === 0) {
          toast.success(`Синхронізовано: додано ${totalAdded} з ${r.total}`);
          return;
        }
        toast.message(`Додано ${totalAdded}, залишилось ${r.remaining}…`);
      }
      toast.success(`Додано ${totalAdded}. Натисніть ще раз, якщо не всі.`);
    } catch (e) {
      console.error(e);
      toast.error("Помилка синхронізації");
    } finally {
      setSyncing(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Видалити героя? Не вдасться, якщо він використовується.")) return;
    const { error } = await supabase.from("heroes").delete().eq("id", id);
    if (error) {
      toast.error("Не вдалося видалити (можливо, використовується у захистах)");
      return;
    }
    toast.success("Видалено");
    qc.invalidateQueries({ queryKey: ["heroes"] });
  };

  const filtered = heroes.filter((h) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return h.name_ru.toLowerCase().includes(q) || h.name_en.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/50 p-3 sm:flex-row sm:items-center">
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
        >
          ➕ Додати героя
        </button>
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition hover:bg-accent disabled:opacity-50"
        >
          🔄 {syncing ? "Синхронізація…" : "Синхронізувати героїв"}
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Пошук…"
          className="w-full flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none sm:w-auto"
        />
      </div>

      {addOpen && (
        <HeroForm
          onClose={() => setAddOpen(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["heroes"] })}
        />
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {filtered.map((h) =>
          editingId === h.id ? (
            <HeroForm
              key={h.id}
              hero={h}
              onClose={() => setEditingId(null)}
              onSaved={() => qc.invalidateQueries({ queryKey: ["heroes"] })}
            />
          ) : (
            <div
              key={h.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-card/50 p-2"
            >
              {h.icon_url ? (
                <img
                  src={h.icon_url}
                  alt=""
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded bg-muted" />
              )}
              <div className="flex flex-1 flex-col leading-tight">
                <span className="text-sm text-foreground">{h.name_ru}</span>
                <span className="text-[11px] text-muted-foreground">{h.name_en}</span>
              </div>
              <button
                onClick={() => setEditingId(h.id)}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-primary"
              >
                ✏️
              </button>
              <button
                onClick={() => onDelete(h.id)}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
              >
                🗑
              </button>
            </div>
          ),
        )}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
            Список порожній. Натисніть «Синхронізувати героїв».
          </div>
        )}
      </div>
    </div>
  );
}

function HeroForm({
  hero,
  onClose,
  onSaved,
}: {
  hero?: HeroOption;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nameEn, setNameEn] = useState(hero?.name_en ?? "");
  const [nameRu, setNameRu] = useState(hero?.name_ru ?? "");
  const [iconUrl, setIconUrl] = useState<string | null>(hero?.icon_url ?? null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onSubmit = async () => {
    if (!nameEn.trim() || !nameRu.trim()) {
      toast.error("Вкажіть обидві назви");
      return;
    }
    setBusy(true);
    try {
      let icon = iconUrl;
      const file = fileRef.current?.files?.[0];
      if (file) {
        icon = await uploadToBucket("hero-icons", file, nameEn.trim() || "hero");
      }
      if (hero) {
        const { error } = await supabase
          .from("heroes")
          .update({ name_en: nameEn.trim(), name_ru: nameRu.trim(), icon_url: icon })
          .eq("id", hero.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("heroes")
          .insert({ name_en: nameEn.trim(), name_ru: nameRu.trim(), icon_url: icon });
        if (error) throw error;
      }
      toast.success("Збережено");
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Не вдалося зберегти");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col-span-full flex flex-col gap-2 rounded-xl border border-primary/40 bg-card p-3">
      <div className="flex items-center gap-3">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="h-12 w-12 rounded object-cover" />
        ) : (
          <div className="h-12 w-12 rounded bg-muted" />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setIconUrl(await fileToDataUrl(f));
          }}
          className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:text-secondary-foreground"
        />
      </div>
      <input
        value={nameEn}
        onChange={(e) => setNameEn(e.target.value)}
        placeholder="English name"
        className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none"
      />
      <input
        value={nameRu}
        onChange={(e) => setNameRu(e.target.value)}
        placeholder="Русское название"
        className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={onSubmit}
          className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          💾 Зберегти
        </button>
        <button
          disabled={busy}
          onClick={onClose}
          className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground transition hover:bg-accent"
        >
          ❌
        </button>
      </div>
    </div>
  );
}
