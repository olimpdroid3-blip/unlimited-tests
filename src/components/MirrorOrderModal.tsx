import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/db";
import { getNickCookie } from "@/lib/nickname";
import { fileToDataUrl, uploadScreenshot } from "@/lib/screenshot-upload";
import { mirrorRowId, normalizeTowerId } from "@/lib/mirror-order";
import { notifyMirrorOrder } from "@/lib/tower-notify.functions";

export function MirrorOrderModal({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) {
  const [nickname, setNickname] = useState("");
  const [towerInput, setTowerInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setNickname(getNickCookie() || "");
      setTowerInput("");
      setFile(null);
      setPreview(null);
    }
  }, [open]);

  const towerId = normalizeTowerId(towerInput);
  const canOrder = !!towerId && !!nickname.trim() && !busy;

  const pickFile = async (f: File | null) => {
    setFile(f);
    setPreview(f ? await fileToDataUrl(f) : null);
  };

  const handleOrder = async () => {
    if (!towerId) return;
    setBusy(true);
    try {
      if (file) {
        const uploaded = await uploadScreenshot("defense-screenshots", file, "tower");
        const { error } = await supabase.from("towers").upsert({
          tower_id: towerId,
          screenshot_url: uploaded.url,
          screenshot_path: uploaded.path,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }

      const res = await notifyMirrorOrder({ data: { nickname: nickname.trim(), towerId } });

      const { error: mErr } = await supabase.from("towers").upsert({
        tower_id: mirrorRowId(towerId),
        nickname: nickname.trim(),
        // The mirror row stores the bot's Telegram message id in `notes`
        // so it can be deleted once the tower is filled in.
        notes: res.ok && res.messageId ? `tg:${res.messageId}` : null,
        updated_at: new Date().toISOString(),
      });
      if (mErr) throw mErr;

      if (!res.ok) toast.error("Замовлення збережено, але Telegram не відповів");
      else toast.success("Дзеркало замовлено");

      onChanged();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Не вдалося замовити дзеркало");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 duration-200">
          <Dialog.Title className="text-lg font-semibold text-foreground">
            🪞 Замовити Дзеркало
          </Dialog.Title>
          <Dialog.Description className="sr-only">Форма замовлення дзеркала</Dialog.Description>

          <div className="mt-4 space-y-3">
            <label className="block">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Нік
              </div>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ім'я гравця"
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary"
              />
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Вежа
              </div>
              <input
                value={towerInput}
                onChange={(e) => setTowerInput(e.target.value)}
                placeholder="1.1.1 / 111 / 1-1-1"
                inputMode="text"
                className={[
                  "w-full rounded-lg border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition",
                  towerInput && !towerId ? "border-destructive" : "border-border focus:border-primary",
                ].join(" ")}
              />
              <div className="mt-1 text-xs">
                {towerId ? (
                  <span className="text-tower-active">✓ Вежа {towerId}</span>
                ) : towerInput ? (
                  <span className="text-destructive">Невірна нумерація вежі</span>
                ) : (
                  <span className="text-muted-foreground">Формат: 1.1.1, 111 або 1-1-1</span>
                )}
              </div>
            </label>

            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Скріншот (необов'язково)
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-xs file:text-secondary-foreground"
              />
              {preview && (
                <img
                  src={preview}
                  alt="Прев'ю скріншота"
                  className="mt-2 max-h-48 w-full rounded-lg object-contain"
                />
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              disabled={!canOrder}
              onClick={handleOrder}
              className="rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              🪞 Замовити
            </button>
            <Dialog.Close asChild>
              <button className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground transition hover:bg-accent">
                ❌ Закрити
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
