import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { toast } from "sonner";
import { getNickCookie } from "@/lib/nickname";
import { notifyTower, dropTowerRequest, markTowerWebOrigin } from "@/lib/tower-notify.functions";
import { fileToDataUrl, uploadScreenshot } from "@/lib/screenshot-upload";
import { HeroPicker, type HeroOption } from "@/components/HeroPicker";
import { MobPicker } from "@/components/MobPicker";
import { getDefenseMobSelection } from "@/lib/defenses";
import { mobCatalogRepository } from "@/lib/mob-levels-ui";
import { TowerDefenseVariantSelect } from "@/components/TowerDefenseVariantSelect";
import {
  getTowerStatusFlags,
  getTowerSaveUpdate,
  getTowerStatusUpdate,
  TOWER_STATUS_LABELS,
  type TowerStatus,
  type TowerStatusFlags,
} from "@/lib/tower-status";

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

export function TowerModal({
  towerId,
  open,
  existing,
  onOpenChange,
  onChanged,
  defenseVariant,
  onVariantChanged,
}: {
  towerId: string | null;
  open: boolean;
  existing: Tower | undefined;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void | Promise<unknown>;
  defenseVariant: number | null;
  onVariantChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [nickname, setNickname] = useState("");
  const [awakenings, setAwakenings] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cookieNick, setCookieNick] = useState("");
  const [status, setStatus] = useState<TowerStatusFlags>(getTowerStatusFlags(undefined));
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [runCode, setRunCode] = useState("");
  const [heroSlots, setHeroSlots] = useState<Array<string | null>>([null, null, null, null, null]);
  const [mobSlots, setMobSlots] = useState<Array<string | null>>([null, null, null, null, null]);
  const [savingDefense, setSavingDefense] = useState(false);
  const [sendingTg, setSendingTg] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  const { data: mobs = [] } = useQuery({
    queryKey: ["mob-catalog"],
    enabled: open,
    queryFn: () => mobCatalogRepository.getAll(),
  });

  useEffect(() => {
    if (open) {
      const ck = getNickCookie();
      setCookieNick(ck);
      setNickname(existing?.nickname ?? ck ?? "");
      setAwakenings(existing?.awakenings ?? "");
      setNotes(existing?.notes ?? "");
      setStatus(getTowerStatusFlags(existing));
      setScreenshotUrl(existing?.screenshot_url ?? null);
      setScreenshotPreview(null);
      setScreenshotFile(null);
      setRunCode("");
      setHeroSlots([null, null, null, null, null]);
      setMobSlots([null, null, null, null, null]);
      setConfirmDelete(false);
    }
  }, [open, existing]);

  useEffect(() => {
    if (lightboxOpen) {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  }, [lightboxOpen]);


  if (!towerId) return null;

  const chosenHeroes = heroSlots.filter((v): v is string => !!v);
  const chosenMobs = mobSlots.filter((value): value is string => Boolean(value));
  const selectedMobIds = getDefenseMobSelection(mobSlots);
  const shownImage = screenshotPreview ?? screenshotUrl;

  const changeStatus = async (next: TowerStatus, checked: boolean, close = false) => {
    setBusy(true);
    const update = getTowerStatusUpdate(existing, next, checked, existing?.nickname ?? nickname);
    const previousStatus = status;
    setStatus(getTowerStatusFlags(update));
    try {
      const { error } = await supabase.from("towers").upsert({
        tower_id: towerId,
        awakenings: existing?.awakenings ?? (awakenings.trim() || null),
        notes: existing?.notes ?? (notes.trim() || null),
        ...update,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success(`${TOWER_STATUS_LABELS[next]}: ${checked ? "так" : "ні"}`);
      await onChanged();
      if (close) onOpenChange(false);
    } catch {
      setStatus(previousStatus);
      toast.error("Помилка збереження статусу");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (placeAgain = false) => {
    setBusy(true);
    try {
      const update = getTowerSaveUpdate({ ...existing, ...status }, nickname, { placeAgain });
      let url = screenshotUrl;
      let path = existing?.screenshot_path ?? null;
      if (screenshotFile) {
        const uploaded = await uploadScreenshot("defense-screenshots", screenshotFile, "tower");
        url = uploaded.url;
        path = uploaded.path;
      }
      const { error } = await supabase.from("towers").upsert({
        tower_id: towerId,
        ...update,
        awakenings: awakenings.trim() || null,
        notes: notes.trim() || null,
        screenshot_url: url,
        screenshot_path: path,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await markTowerWebOrigin({ data: { towerId } });
      // Filling the tower fulfils any pending request: shared removal deletes
      // the bot's update message, the marker row and posts the "➖" update.
      if (update.placed) {
        await dropTowerRequest({ data: { towerId } }).catch(() => {});
      }
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
    if (!selectedMobIds) return toast.error("Оберіть від 2 до 5 мобів без пропусків");
    const nick = nickname.trim();
    if (!nick) return toast.error("Спочатку вкажіть нік");
    setSavingDefense(true);
    try {
      const { data: player, error: playerError } = await supabase
        .from("battle_power")
        .select("id")
        .ilike("nickname", nick)
        .maybeSingle();
      if (playerError) throw playerError;
      if (!player) return toast.error("Гравця не знайдено. Перевірте нік у списку БС");

      // Reuse the already-saved tower screenshot, or upload the freshly picked file.
      let url = screenshotUrl;
      if (!url && screenshotFile) {
        url = (await uploadScreenshot("defense-screenshots", screenshotFile, "tower")).url;
        setScreenshotUrl(url);
      }

      const { error } = await supabase.rpc("create_defense_with_details", {
        p_screenshot_url: url,
        p_run_code: runCode.trim() || null,
        p_player_id: player.id,
        p_comment: `Вежа ${towerId}${notes.trim() ? ` — ${notes.trim()}` : ""}`,
        p_hero_ids: chosenHeroes,
        p_mob_ids: selectedMobIds,
      });
      if (error) throw error;
      void queryClient.invalidateQueries({ queryKey: ["defenses"] });

      toast.success("Код проходки збережено в базі захистів");
      setRunCode("");
      setHeroSlots([null, null, null, null, null]);
      setMobSlots([null, null, null, null, null]);
    } catch (e) {
      console.error(e);
      toast.error("Не вдалося зберегти проходку");
    } finally {
      setSavingDefense(false);
    }
  };

  const handleNotify = async () => {
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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          onInteractOutside={(e) => {
            // The lightbox overlay is a sibling of this content inside the same
            // portal; Radix would otherwise treat taps on it as "outside" and
            // dismiss the whole tower modal. Suppress that while it's open.
            if (lightboxOpen) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            // Let Escape close the lightbox first, not the modal.
            if (lightboxOpen) {
              e.preventDefault();
              setLightboxOpen(false);
            }
          }}
          className={`fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-2 duration-200 ${lightboxOpen ? "pointer-events-none" : ""}`}>
          <div className="flex items-start justify-between gap-2">
            <Dialog.Title className="text-lg font-semibold text-foreground">
              🏰 Башня {towerId}
            </Dialog.Title>
          </div>
          <Dialog.Description className="sr-only">Редагування вежі {towerId}</Dialog.Description>

          <div className="mt-4 space-y-3">
            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Позначки дефу
              </legend>
              {(["breached", "testing", "destroyed", "removed"] as const).map((flag) => (
                <label key={flag} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={status[flag]}
                    disabled={busy}
                    onChange={(event) => void changeStatus(flag, event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  {TOWER_STATUS_LABELS[flag]}
                </label>
              ))}
              <p className="text-xs text-muted-foreground">
                Можна вибрати кілька. Позначки зберігаються одразу. «Знищений» також означає
                «Пробитий». «Зберегти» залишає позначку «Знятий».
              </p>
            </fieldset>
            {status.removed && (
              <div className="rounded-lg border border-dashed border-border bg-secondary p-3 text-sm">
                <strong>Деф знятий</strong>
                <p>Був: {existing?.nickname || existing?.previous_nickname || "нік не вказаний"}</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSave(true)}
                  className="mt-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  Виставити знову
                </button>
              </div>
            )}
            <TowerDefenseVariantSelect
              towerId={towerId}
              value={defenseVariant}
              onChanged={onVariantChanged}
            />
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setLightboxOpen(true);
                    }}
                    title="Збільшити скріншот"
                    aria-label="Збільшити скріншот"
                    className="block w-full cursor-zoom-in overflow-hidden rounded-lg border border-border bg-black/20"
                  >
                    <img
                      src={shownImage}
                      alt={`Розстановка вежі ${towerId}`}
                      loading="lazy"
                      className="mx-auto block max-h-56 w-full object-contain"
                    />
                  </button>
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

          {(status.breached || status.destroyed) && (
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
              <div className="space-y-2">
                {mobSlots.map((value, index) => (
                  <div key={index} className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Моб {index + 1}
                      {index < 2 && <span className="ml-1 text-destructive">*</span>}
                    </span>
                    <MobPicker
                      mobs={mobs}
                      value={value}
                      placeholder={`Оберіть моба ${index + 1}`}
                      excludeIds={chosenMobs}
                      onChange={(id) =>
                        setMobSlots((prev) => prev.map((v, i) => (i === index ? id : v)))
                      }
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={
                  savingDefense || chosenHeroes.length === 0 || !selectedMobIds || !nickname.trim()
                }
                onClick={handleSaveDefense}
                className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
              >
                💾 Зберегти код проходки
              </button>
            </div>
          )}

          {confirmDelete ? (
            <div className="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <div className="text-sm text-foreground">
                Зняти деф? Попередній нік залишиться на плитці.
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => void changeStatus("removed", true, true)}
                  className="flex-1 rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  Так, зняти
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
                onClick={() => void handleSave()}
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
                disabled={busy || !existing || status.removed}
                onClick={() => setConfirmDelete(true)}
                title="Зняти деф"
                aria-label="Зняти деф"
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
        {lightboxOpen && shownImage && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Скріншот розстановки вежі ${towerId}`}
            // Any tap outside the picture closes the lightbox. We close on
            // click (not pointerdown): the lightbox is still mounted when the
            // click fires, so the event cannot leak to the tower dialog's
            // overlay below and accidentally close the whole modal. The inner
            // image wrapper stops propagation so taps directly on the picture
            // do nothing.
            onClick={() => setLightboxOpen(false)}
            className="pointer-events-auto fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-2 sm:p-6"
            style={{ touchAction: "manipulation" }}
          >
            <div
              className="relative flex max-h-full max-w-full flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                aria-label="Закрити перегляд"
                className="mb-3 flex min-h-14 w-full touch-manipulation select-none items-center justify-center gap-2 rounded-xl bg-white/15 px-6 py-4 text-lg font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-white/25 active:scale-95"
              >
                <span className="text-2xl leading-none">×</span>
                <span>Закрити</span>
              </button>
              <img
                src={shownImage}
                alt={`Розстановка вежі ${towerId}`}
                className="max-h-[80dvh] max-w-[100vw] object-contain"
                draggable={false}
              />
            </div>
          </div>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // Not a <label>: nested interactive elements (thumbnail, buttons) must not
  // implicitly activate a wrapped file input.
  return (
    <div className="block">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
