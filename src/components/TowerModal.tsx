import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { ChevronDown, Settings2, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { toast } from "sonner";
import {
  normalizeParticipants,
  getTowerOwnerIndex,
  type TowerGroup,
  type TowerParticipant,
} from "@/lib/tower-participants";
import { TowerParticipantsEditor } from "@/components/TowerParticipantsEditor";
import { notifyTower, dropTowerRequest, markTowerWebOrigin } from "@/lib/tower-notify.functions";
import { fileToDataUrl, uploadScreenshot } from "@/lib/screenshot-upload";
import { HeroPicker, type HeroOption } from "@/components/HeroPicker";
import { PlayerSelectField } from "@/components/PlayerSelectField";
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
  do_not_attack?: boolean | null;
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
  group,
}: {
  group: TowerGroup;
  towerId: string | null;
  open: boolean;
  existing: Tower | undefined;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void | Promise<unknown>;
  defenseVariant: number | null;
  onVariantChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [participants, setParticipants] = useState<TowerParticipant[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState(0);
  const nickname = participants[selectedParticipant]?.nickname ?? participants[0]?.nickname ?? "";
  const notes = participants[selectedParticipant]?.comment ?? participants[0]?.comment ?? "";
  const [awakenings, setAwakenings] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [status, setStatus] = useState<TowerStatusFlags>(getTowerStatusFlags(undefined));
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [runCode, setRunCode] = useState("");
  const [heroSlots, setHeroSlots] = useState<Array<string | null>>([null, null, null, null, null]);
  const [mobSlots, setMobSlots] = useState<Array<string | null>>([null, null, null, null, null]);
  const [defensePlayerId, setDefensePlayerId] = useState<string | undefined>();
  const [savingDefense, setSavingDefense] = useState(false);
  const [sendingTg, setSendingTg] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setSettingsOpen(false);
  }, [open, towerId]);

  const playersQuery = useQuery({
    queryKey: ["nickname-options"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("battle_power")
        .select("id,nickname")
        .order("nickname");
      if (error) throw error;
      return data ?? [];
    },
  });
  const matchingPlayers = (playersQuery.data ?? []).filter(
    (player) => player.nickname.trim().toLowerCase() === nickname.trim().toLowerCase(),
  );
  const selectedDefensePlayerId =
    defensePlayerId ?? (matchingPlayers.length === 1 ? matchingPlayers[0].id : undefined);
  useEffect(() => {
    setDefensePlayerId(undefined);
  }, [open, towerId, nickname]);

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
      setAwakenings(existing?.awakenings ?? "");
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

  const groupKey = JSON.stringify(group.participants);
  const groupIdsKey = JSON.stringify(group.towerIds);
  const savedOwner = existing?.nickname || existing?.previous_nickname;
  const participantsDirty = JSON.stringify(participants) !== groupKey;
  useEffect(() => {
    if (!open) return;
    const saved = JSON.parse(groupKey) as TowerParticipant[];
    setParticipants(saved);
    setSelectedParticipant(getTowerOwnerIndex(saved, { nickname: savedOwner }));
    // Status refetches must not discard unsaved participant edits.
  }, [open, towerId, groupKey, groupIdsKey, savedOwner]);

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
    if (participants.some((entry) => !entry.nickname.trim())) {
      toast.error("Вкажіть нік або видаліть порожній рядок");
      return;
    }
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
      const { error } = await supabase.rpc("save_tower_with_participants", {
        p_tower_id: towerId,
        p_group_ids: group.towerIds,
        p_participants: normalizeParticipants(participants),
        p_details: {
          ...update,
          awakenings: awakenings.trim() || null,
          notes: notes.trim() || null,
          screenshot_url: url,
          screenshot_path: path,
        },
      });
      if (error) throw error;
      if (!existing) await markTowerWebOrigin({ data: { towerId } });
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
    if (!selectedDefensePlayerId) return toast.error("Оберіть гравця зі списку БС для проходки");
    setSavingDefense(true);
    try {
      // Reuse the already-saved tower screenshot, or upload the freshly picked file.
      let url = screenshotUrl;
      if (screenshotFile) {
        url = (await uploadScreenshot("defense-screenshots", screenshotFile, "tower")).url;
        setScreenshotUrl(url);
      }

      const { error } = await supabase.rpc("create_defense_with_details", {
        p_screenshot_url: url,
        p_run_code: runCode.trim() || null,
        p_player_id: selectedDefensePlayerId,
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
            // Radix observes Escape before the input's React handler. Let the
            // nickname combobox close its list without dismissing this dialog.
            const target = e.target;
            if (
              target instanceof HTMLElement &&
              target.getAttribute("role") === "combobox" &&
              target.getAttribute("aria-expanded") === "true"
            ) {
              e.preventDefault();
              return;
            }
            // Let Escape close the lightbox first, not the modal.
            if (lightboxOpen) {
              e.preventDefault();
              setLightboxOpen(false);
            }
          }}
          className={`fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-2 duration-200 ${lightboxOpen ? "pointer-events-none" : ""}`}
        >
          <div className="sticky -top-5 z-20 -mx-5 -mt-5 flex items-center justify-between gap-2 border-b border-border bg-card px-5 py-3">
            <Dialog.Title className="text-lg font-semibold text-foreground">
              🏰 Башня {towerId}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Закрити модалку"
                title="Закрити"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Редагування вежі {towerId}</Dialog.Description>

          <div className="mt-4 space-y-3">
            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Позначки дефу
              </legend>
              {(["breached", "testing", "destroyed", "removed", "do_not_attack"] as const).map(
                (flag) => (
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
                ),
              )}
              <p className="text-xs text-muted-foreground">
                Можна вибрати кілька. Позначки зберігаються одразу. «Пробитий» і «Знищений»
                взаємовиключні. «Зберегти» залишає позначку «Знятий».
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
            {group.towerIds.length > 1 && (
              <p className="text-sm text-muted-foreground">
                Спільні ніки та коментарі для комірок: {group.towerIds.join(", ")}
              </p>
            )}
            {group.towerIds.length > 1 && group.placedTowerIds.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Цей деф виставлено: {group.placedTowerIds.join(", ")}
              </p>
            )}
            {group.activeParticipants.length > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="font-semibold">Зараз виставлено у</p>
                <p>{group.activeParticipants.map((entry) => entry.nickname).join(", ")}</p>
              </div>
            )}
            {group.previousParticipants.length > 0 && (
              <div className="rounded-lg border border-border bg-secondary p-3 text-sm">
                <p className="mb-2 font-semibold">У кого був цей деф</p>
                <ul className="space-y-2">
                  {group.previousParticipants.map((entry) => (
                    <li key={entry.nickname}>
                      <strong>{entry.nickname}</strong>
                      {entry.comment && (
                        <p className="whitespace-pre-wrap text-muted-foreground">{entry.comment}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <TowerParticipantsEditor
              value={participants}
              onChange={(next) => {
                if (next.length !== participants.length) {
                  setSelectedParticipant(
                    Math.max(
                      0,
                      next.findIndex((entry) => entry.nickname === nickname),
                    ),
                  );
                }
                setParticipants(next);
              }}
              disabled={busy}
            />
            {participantsDirty && (
              <p className="text-xs text-muted-foreground">
                Збережіть ніки та коментарі перед зміною варіанта дефу.
              </p>
            )}
            {participants.length > 1 && (
              <Field label="У кого виставлено деф у цій комірці">
                <select
                  value={selectedParticipant}
                  onChange={(event) => setSelectedParticipant(Number(event.target.value))}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
                >
                  {participants.map((entry, index) => (
                    <option key={index} value={index}>
                      {entry.nickname || "Нік не вказаний"}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Цей нік зберігається як власник розстановки та використовується для проходки й
                  Telegram.
                </p>
              </Field>
            )}
            <Field label="Пробуди">
              <input
                value={awakenings}
                onChange={(e) => setAwakenings(e.target.value)}
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Напр. 5/5"
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

          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen} className="mt-4">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm font-medium text-secondary-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                Додаткові налаштування
                <ChevronDown
                  className={`ml-auto h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <TowerDefenseVariantSelect
                towerId={towerId}
                value={defenseVariant}
                onChanged={onVariantChanged}
                disabled={busy || participantsDirty}
              />
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
                  <PlayerSelectField
                    id="tower-defense-player"
                    value={selectedDefensePlayerId}
                    players={playersQuery.data ?? []}
                    disabled={savingDefense || playersQuery.isLoading}
                    onValueChange={setDefensePlayerId}
                  />
                  {playersQuery.isError ? (
                    <button
                      type="button"
                      onClick={() => void playersQuery.refetch()}
                      className="text-sm text-destructive underline"
                    >
                      Не вдалося завантажити гравців. Повторити
                    </button>
                  ) : !selectedDefensePlayerId && !playersQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">
                      Оберіть гравця з бази БС. Вибір для проходки не змінює власника вежі.
                    </p>
                  ) : null}
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
                      savingDefense ||
                      chosenHeroes.length === 0 ||
                      !selectedMobIds ||
                      !selectedDefensePlayerId
                    }
                    onClick={handleSaveDefense}
                    className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                  >
                    {savingDefense ? "Збереження…" : "💾 Зберегти код проходки"}
                  </button>
                  {(chosenHeroes.length === 0 || !selectedMobIds) && (
                    <p className="text-xs text-muted-foreground">
                      Для збереження оберіть хоча б одного героя та від 2 до 5 мобів без пропусків.
                    </p>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

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
