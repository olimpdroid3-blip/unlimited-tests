import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Toaster } from "@/components/ui/sonner";
import { getBattlePowerFormPresentation, type BattlePowerRow } from "@/lib/battle-power";
import { battlePowerRepository } from "@/lib/battle-power-ui";
import { getNickCookie } from "@/lib/nickname";

export const Route = createFileRoute("/battle-power")({
  head: () => ({
    meta: [
      { title: "Бойова Сила — Ukraine Unlimited" },
      {
        name: "description",
        content: "Збереження бойової сили учасників гільдії Ukraine Unlimited.",
      },
      { property: "og:title", content: "Бойова Сила — Ukraine Unlimited" },
      {
        property: "og:description",
        content: "Збереження бойової сили учасників гільдії.",
      },
    ],
  }),
  component: BattlePowerPage,
});

const fmt = (v: number | null) => {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return Number(n.toFixed(1)).toString();
};

function BattlePowerPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState("");
  const [powers, setPowers] = useState<string[]>(["", "", "", "", ""]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setNick(getNickCookie());
  }, []);

  const { data = [], isLoading } = useQuery({
    queryKey: ["battle_power"],
    queryFn: () => battlePowerRepository.getAll(),
  });
  const formPresentation = getBattlePowerFormPresentation(open, editingId);

  const openForm = () => {
    setNick(getNickCookie());
    setPowers(["", "", "", "", ""]);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (r: BattlePowerRow) => {
    setNick(r.nickname);
    setPowers([
      r.power1?.toString() ?? "",
      r.power2?.toString() ?? "",
      r.power3?.toString() ?? "",
      r.power4?.toString() ?? "",
      r.power5?.toString() ?? "",
    ]);
    setEditingId(r.id);
    setOpen(true);
  };

  const setPower = (i: number, raw: string) => {
    const v = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
    setPowers((p) => p.map((x, idx) => (idx === i ? v : x)));
  };

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const closeForm = () => {
    setOpen(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    const n = nick.trim();
    if (!n) {
      toast.error("Вкажіть нік");
      return;
    }
    setSaving(true);
    const payload = {
      nickname: n,
      power1: num(powers[0]),
      power2: num(powers[1]),
      power3: num(powers[2]),
      power4: num(powers[3]),
      power5: num(powers[4]),
    };
    if (editingId) {
      try {
        await battlePowerRepository.update(editingId, payload);
      } catch {
        setSaving(false);
        toast.error("Не вдалося оновити");
        return;
      }
      setSaving(false);
      toast.success("Оновлено");
    } else {
      try {
        await battlePowerRepository.create(payload);
      } catch {
        setSaving(false);
        toast.error("Не вдалося зберегти");
        return;
      }
      setSaving(false);
      toast.success("Збережено");
    }
    setOpen(false);
    setPowers(["", "", "", "", ""]);
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["battle_power"] });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await battlePowerRepository.remove(deleteId);
    } catch {
      setDeleteId(null);
      toast.error("Не вдалося видалити");
      return;
    }
    setDeleteId(null);
    toast.success("Видалено");
    qc.invalidateQueries({ queryKey: ["battle_power"] });
  };

  const nicknameInput = (
    <input
      value={nick}
      onChange={(e) => setNick(e.target.value)}
      placeholder="Нік"
      aria-label="Нік"
      className="w-full min-w-0 rounded-lg border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
    />
  );
  const powerInputs = powers.map((power, index) => (
    <input
      key={index}
      value={power}
      inputMode="decimal"
      onChange={(e) => setPower(index, e.target.value)}
      placeholder={`БС ${index + 1}`}
      aria-label={`БС ${index + 1}`}
      className="w-full min-w-0 rounded-lg border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
    />
  ));

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />
      <Toaster position="top-center" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-3 pb-10 pt-6">
        <h1 className="text-center text-xl font-bold tracking-tight sm:text-2xl">💪 Бойова Сила</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Збереження бойової сили учасників
        </p>

        {!open && (
          <button
            onClick={openForm}
            className="mt-4 w-full cursor-pointer rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.99]"
          >
            ➕ Додати свій БС
          </button>
        )}

        {formPresentation === "inline" && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card/60 p-2">
            <div className="flex min-w-max items-center gap-1.5">
              <div className="w-28">{nicknameInput}</div>
              {powerInputs.map((input, index) => (
                <div key={index} className="w-20">
                  {input}
                </div>
              ))}
              <button
                onClick={handleSave}
                disabled={saving}
                className="cursor-pointer rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✅ OK
              </button>
              <button
                onClick={closeForm}
                className="cursor-pointer rounded-lg border border-border bg-secondary px-3 py-2.5 text-xs text-secondary-foreground transition hover:bg-accent"
              >
                ❌
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card/60">
          {isLoading && (
            <div className="p-4 text-center text-xs text-muted-foreground">Завантаження…</div>
          )}
          {!isLoading && data.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">Записів поки немає</div>
          )}
          {data.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-x-1 gap-y-0.5 px-2 py-2 text-[11px] sm:text-xs"
            >
              <span className="font-bold">{r.nickname}</span>
              {[r.power1, r.power2, r.power3, r.power4].map((p, i) => (
                <span
                  key={i}
                  className="font-mono font-semibold tabular-nums text-muted-foreground"
                >
                  {fmt(p)}
                </span>
              ))}
              <span className="inline-flex items-center gap-x-1">
                <span className="font-mono font-semibold tabular-nums text-muted-foreground">
                  {fmt(r.power5)}
                </span>
                <button
                  onClick={() => openEdit(r)}
                  aria-label="Редагувати"
                  className="shrink-0 cursor-pointer rounded-md px-1 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                >
                  ✏️
                </button>
                <button
                  onClick={() => setDeleteId(r.id)}
                  aria-label="Видалити"
                  className="shrink-0 cursor-pointer rounded-md px-1 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  🗑️
                </button>
              </span>
            </div>
          ))}
        </div>
      </main>

      <Dialog.Root
        open={formPresentation === "dialog"}
        onOpenChange={(isOpen) => !isOpen && closeForm()}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=open]:zoom-in-95">
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Закрити"
                className="absolute right-3 top-3 flex size-8 cursor-pointer items-center justify-center rounded-full text-xl leading-none text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                ×
              </button>
            </Dialog.Close>
            <Dialog.Title className="text-base font-semibold">✏️ Редагування запису</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              Оновіть нік або значення бойової сили.
            </Dialog.Description>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-3">{nicknameInput}</div>
              {powerInputs}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="cursor-pointer rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✅ OK
              </button>
              <button
                onClick={closeForm}
                className="cursor-pointer rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground transition hover:bg-accent"
              >
                Скасувати
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=open]:zoom-in-95">
            <Dialog.Title className="text-base font-semibold">Видалити запис?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Запис буде видалено.
            </Dialog.Description>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={handleDelete}
                className="cursor-pointer rounded-lg bg-destructive px-3 py-2.5 text-sm font-semibold text-destructive-foreground transition hover:opacity-90"
              >
                🗑 Видалити
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="cursor-pointer rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground transition hover:bg-accent"
              >
                Скасувати
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
