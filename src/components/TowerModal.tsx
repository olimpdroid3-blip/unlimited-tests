import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { toast } from "sonner";
import { getNickCookie } from "@/lib/nickname";
import { notifyTower } from "@/lib/tower-notify.functions";
import { fileToDataUrl, uploadScreenshot } from "@/lib/screenshot-upload";
import { HeroPicker, type HeroOption } from "@/components/HeroPicker";

type Tower = {
  tower_id: string;
  nickname: string | null;
  awakenings: string | null;
  notes: string | null;
  breached?: boolean | null;
  screenshot_url?: string | null;
  screenshot_path?: string | null;
};

export function TowerModal({
  towerId,
  open,
  existing,
  onOpenChange,
  onChanged,
}: {
  towerId: string | null;
  open: boolean;
  existing: Tower | undefined;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) {
  const [nickname, setNickname] = useState("");
  const [awakenings, setAwakenings] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cookieNick, setCookieNick] = useState("");
  const [breached, setBreached] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [runCode, setRunCode] = useState("");
  const [heroSlots, setHeroSlots] = useState<Array<string | null>>([null, null, null, null, null]);
  const [savingDefense, setSavingDefense] = useState(false);
  const [sendingTg, setSendingTg] = useState(false);

  const { data: heroes = [] } = useQuery({
    queryKey: ["heroes"],
    enabled: open,
    queryFn: async (): Promise<HeroOption[]> => {
      const { data, error } = await supabase
        .from("heroes")
        .select("id, name_en, name_ru, icon_url")
        .order("name_ru");
      if (error) throw error;
      return (data ?? []) as HeroOption[];
    },
  });

  useEffect(() => {
    if (open) {
      const ck = getNickCookie();
      setCookieNick(ck);
      setNickname(existing?.nickname ?? ck ?? "");
      setAwakenings(existing?.awakenings ?? "");
      setNotes(existing?.notes ?? "");
      setBreached(!!existing?.breached);
      setScreenshotUrl(existing?.screenshot_url ?? null);
      setScreenshotPreview(null);
      setScreenshotFile(null);
      setRunCode("");
      setHeroSlots([null, null, null, null, null]);
      setConfirmDelete(false);
    }
  }, [open, existing]);

  if (!towerId) return null;

  const chosenHeroes = heroSlots.filter((v): v is string => !!v);
  const shownImage = screenshotPreview ?? screenshotUrl;

  const toggleBreached = async () => {
    const next = !breached;
    setBusy(true);
    const { error } = await supabase.from("towers").upsert({
      tower_id: towerId,
      nickname: existing ? (existing.nickname ?? null) : nickname.trim() || null,
      awakenings: existing ? (existing.awakenings ?? null) : awakenings.trim() || null,
      notes: existing ? (existing.notes ?? null) : notes.trim() || null,
      breached: next,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) return toast.error("Помилка збереження");
    setBreached(next);
    toast.success(next ? "Позначено як пробито" : "Позначку знято");
    onChanged();
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      let url = screenshotUrl;
      let path = existing?.screenshot_path ?? null;
      if (screenshotFile) {
        const uploaded = await uploadScreenshot("defense-screenshots", screenshotFile, "tower");
        url = uploaded.url;
        path = uploaded.path;
      }
      const { error } = await supabase.from("towers").upsert({
        tower_id: towerId,
        nickname: nickname.trim() || null,
        awakenings: awakenings.trim() || null,
        notes: notes.trim() || null,
        breached,
        screenshot_url: url,
        screenshot_path: path,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Збережено");
      onChanged();
      onOpenChange(false);
    } catch {
      toast.error("Помилка збереження");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDefense = async () => {
    if (chosenHeroes.length < 1) return toast.error("Оберіть хоча б одного героя");
    setSavingDefense(true);
    try {
      // Reuse the already-saved tower screenshot, or upload the freshly picked file.
      let url = screenshotUrl;
      if (!url && screenshotFile) {
        url = (await uploadScreenshot("defense-screenshots", screenshotFile, "tower")).url;
        setScreenshotUrl(url);
      }

      let playerId: string | null = null;
      const nick = nickname.trim();
      if (nick) {
        const { data: player } = await supabase
          .from("battle_power")
          .select("id")
          .ilike("nickname", nick)
          .maybeSingle();
        playerId = player?.id ?? null;
      }

      const { data: created, error } = await supabase
        .from("defenses")
        .insert({
          screenshot_url: url,
          run_code: runCode.trim() || null,
          player_id: playerId,
          comment: `Вежа ${towerId}${notes.trim() ? ` — ${notes.trim()}` : ""}`,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: hErr } = await supabase.from("defense_heroes").insert(
        chosenHeroes.map((heroId, index) => ({
          defense_id: created.id,
          hero_id: heroId,
          position: index + 1,
        })),
      );
      if (hErr) throw hErr;

      toast.success("Код проходки збережено в базі захистів");
      setRunCode("");
      setHeroSlots([null, null, null, null, null]);
    } catch (e) {
      console.error(e);
      toast.error("Не вдалося зберегти проходку");
    } finally {
      setSavingDefense(false);
    }
  };

  const [sendingTg, setSendingTg] = useState(false);

  const handleNotify = async () => {
    // sendingTg state declared with the other hooks above
    const nick = nickname.trim();
    if (!nick) return toast.error("Спочатку вкажіть нік");
    setSendingTg(true);
    try {
      const result = await notifyTower({ data: { nickname: nick, towerId } });
      if (result.ok) {
        toast.success("Повідомлення надіслано в Telegram");
      } else {
        toast.error("Не вдалося надіслати повідомлення");
      }
    } catch {
      toast.error("Не вдалося надіслати повідомлення");
    } finally {
      setSendingTg(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    if (existing?.screenshot_path) {
      await supabase.storage.from("defense-screenshots").remove([existing.screenshot_path]);
    }
    const { error } = await supabase.from("towers").delete().eq("tower_id", towerId);
    setBusy(false);
    if (error) return toast.error("Помилка видалення");
    toast.success("Видалено");
    onChanged();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between gap-2">
            <Dialog.Title className="text-lg font-semibold text-foreground">
              🏰 Башня {towerId}
            </Dialog.Title>
            <button
              type="button"
              disabled={busy}
              onClick={toggleBreached}
              aria-pressed={breached}
              className={[
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-50",
                breached
                  ? "bg-destructive text-destructive-foreground shadow-sm"
                  : "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
              ].join(" ")}
            >
              {breached ? "🔴 Пробито ✓" : "🔴 Пробито"}
            </button>
          </div>
          <Dialog.Description className="sr-only">Редагування вежі {towerId}</Dialog.Description>

          <div className="mt-4 space-y-3">
            <Field label="Нік">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                disabled={!!cookieNick}
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-80"
                placeholder="Ім'я гравця"
              />
            </Field>
            <Field label="Пробуди">
              <input
                value={awakenings}
                onChange={(e) => setAwakenings(e.target.value)}
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Напр. 5/5"
              />
            </Field>
            <Field label="Примітки при проходці">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Стратегія, склад..."
              />
            </Field>

            <Field label="📷 Скріншот розстановки">
              <div className="space-y-2">
                {shownImage && (
                  <div className="overflow-hidden rounded-lg border border-border bg-black/20">
                    <img
                      src={shownImage}
                      alt={`Розстановка вежі ${towerId}`}
                      loading="lazy"
                      className="mx-auto block max-h-56 w-full object-contain"
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0] || null;
                    setScreenshotFile(f);
                    setScreenshotPreview(f ? await fileToDataUrl(f) : null);
                  }}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-secondary-foreground hover:file:bg-accent"
                />
                {shownImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setScreenshotFile(null);
                      setScreenshotPreview(null);
                      setScreenshotUrl(null);
                    }}
                    className="text-xs text-muted-foreground underline transition hover:text-destructive"
                  >
                    Прибрати скріншот
                  </button>
                )}
              </div>
            </Field>
          </div>

          {breached && (
            <div className="mt-4 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                🛡 Додати до бази захистів
              </div>
              <input
                value={runCode}
                onChange={(e) => setRunCode(e.target.value)}
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Код проходки <GVG>...</GVG>"
              />
              <div className="space-y-2">
                {heroSlots.map((value, index) => (
                  <HeroPicker
                    key={index}
                    heroes={heroes}
                    value={value}
                    placeholder={`Герой ${index + 1}`}
                    excludeIds={heroSlots.filter((v, i): v is string => !!v && i !== index)}
                    onChange={(id) =>
                      setHeroSlots((prev) => prev.map((v, i) => (i === index ? id : v)))
                    }
                  />
                ))}
              </div>
              <button
                type="button"
                disabled={savingDefense || chosenHeroes.length === 0}
                onClick={handleSaveDefense}
                className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
              >
                💾 Зберегти код проходки
              </button>
            </div>
          )}

          {confirmDelete ? (
            <div className="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <div className="text-sm text-foreground">Видалити запис?</div>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy}
                  onClick={handleDelete}
                  className="flex-1 rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  Так, видалити
                </button>
                <button
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground transition hover:bg-accent"
                >
                  Відміна
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex gap-2">
              <button
                disabled={busy}
                onClick={handleSave}
                className="flex-1 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                💾 Зберегти
              </button>
              <button
                type="button"
                disabled={busy || sendingTg}
                onClick={handleNotify}
                title="Надіслати в Telegram"
                aria-label="Надіслати в Telegram"
                className="flex w-11 shrink-0 items-center justify-center rounded-lg bg-[#229ED9] px-2 py-2.5 transition hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden="true">
                  <path d="M9.04 15.31l-.38 5.32c.54 0 .78-.23 1.06-.5l2.55-2.44 5.28 3.87c.97.53 1.65.25 1.91-.9l3.46-16.2c.31-1.42-.51-1.98-1.45-1.63L2.7 10.8c-1.39.54-1.37 1.32-.24 1.67l4.8 1.5 11.13-7.02c.52-.35 1 .16.61.5L9.04 15.31z" />
                </svg>
              </button>
              <button
                disabled={busy || !existing}
                onClick={() => setConfirmDelete(true)}
                title="Видалити запис"
                aria-label="Видалити запис"
                className="flex w-11 shrink-0 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/20 disabled:opacity-40"
              >
                🗑
              </button>
            </div>
          )}

          <Dialog.Close asChild>
            <button className="mt-2 w-full rounded-lg px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground">
              ❌ Закрити
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}
