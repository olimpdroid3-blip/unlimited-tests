import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getNickCookie } from "@/lib/nickname";

type Tower = {
  tower_id: string;
  nickname: string | null;
  awakenings: string | null;
  notes: string | null;
  breached?: boolean | null;
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

  useEffect(() => {
    if (open) {
      const ck = getNickCookie();
      setCookieNick(ck);
      setNickname(existing?.nickname ?? ck ?? "");
      setAwakenings(existing?.awakenings ?? "");
      setNotes(existing?.notes ?? "");
      setBreached(!!existing?.breached);
      setConfirmDelete(false);
    }
  }, [open, existing]);

  if (!towerId) return null;

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
    const { error } = await supabase.from("towers").upsert({
      tower_id: towerId,
      nickname: nickname.trim() || null,
      awakenings: awakenings.trim() || null,
      notes: notes.trim() || null,
      breached,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) return toast.error("Помилка збереження");
    toast.success("Збережено");
    onChanged();
    onOpenChange(false);
  };

  const handleDelete = async () => {
    setBusy(true);
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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-2 duration-200">
          <Dialog.Title className="text-lg font-semibold text-foreground">
            🏰 Башня {towerId}
          </Dialog.Title>
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
          </div>

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
            <div className="mt-5 grid grid-cols-3 gap-2">
              <button
                disabled={busy}
                onClick={handleSave}
                className="col-span-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                💾 Зберегти
              </button>
              <button
                disabled={busy || !existing}
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/20 disabled:opacity-40"
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
