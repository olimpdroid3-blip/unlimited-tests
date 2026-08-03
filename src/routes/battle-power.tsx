import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast, Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
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

type Row = {
  id: string;
  nickname: string;
  power1: number | null;
  power2: number | null;
  power3: number | null;
  power4: number | null;
  power5: number | null;
};

const isLatin = (s: string) => /^[A-Za-z]/.test(s.trim());

function sortRows(rows: Row[]) {
  return [...rows].sort((a, b) => {
    const la = isLatin(a.nickname);
    const lb = isLatin(b.nickname);
    if (la !== lb) return la ? -1 : 1;
    return a.nickname.localeCompare(b.nickname, la ? "en" : "uk", {
      sensitivity: "base",
    });
  });
}

const fmt = (v: number | null) =>
  v === null || v === undefined ? "—" : Number(v).toFixed(2);

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("battle_power")
        .select("id,nickname,power1,power2,power3,power4,power5");
      if (error) throw error;
      return sortRows((data ?? []) as Row[]);
    },
  });

  const openForm = () => {
    setNick(getNickCookie());
    setPowers(["", "", "", "", ""]);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (r: Row) => {
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
      const { error } = await supabase
        .from("battle_power")
        .update(payload)
        .eq("id", editingId);
      setSaving(false);
      if (error) {
        toast.error("Не вдалося оновити");
        return;
      }
      toast.success("Оновлено");
    } else {
      const { error } = await supabase.from("battle_power").insert(payload);
      setSaving(false);
      if (error) {
        toast.error("Не вдалося зберегти");
        return;
      }
      toast.success("Збережено");
    }
    setOpen(false);
    setPowers(["", "", "", "", ""]);
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["battle_power"] });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase
      .from("battle_power")
      .delete()
      .eq("id", deleteId);
    setDeleteId(null);
    if (error) {
      toast.error("Не вдалося видалити");
      return;
    }
    toast.success("Видалено");
    qc.invalidateQueries({ queryKey: ["battle_power"] });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />
      <Toaster position="top-center" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-3 pb-10 pt-6">
        <h1 className="text-center text-xl font-bold tracking-tight sm:text-2xl">
          💪 Бойова Сила
        </h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Збереження бойової сили учасників
        </p>

        {!open && (
          <button
            onClick={openForm}
            className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.99]"
          >
            ➕ Додати свій БС
          </button>
        )}

        {open && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card/60 p-2">
            <div className="flex min-w-max items-center gap-1.5">
              <input
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="Нік"
                className="w-28 rounded-lg border border-border bg-input px-2 py-2 text-xs outline-none focus:border-primary"
              />
              {powers.map((p, i) => (
                <input
                  key={i}
                  value={p}
                  inputMode="decimal"
                  onChange={(e) => setPower(i, e.target.value)}
                  placeholder={`БС ${i + 1}`}
                  className="w-20 rounded-lg border border-border bg-input px-2 py-2 text-xs outline-none focus:border-primary"
                />
              ))}
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                ✅ OK
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground transition hover:bg-accent"
              >
                ❌
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card/60">
          {isLoading && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Завантаження…
            </div>
          )}
          {!isLoading && data.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Записів поки немає
            </div>
          )}
          {data.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 px-2 py-1.5 text-[11px] sm:text-xs"
            >
              <span className="w-20 shrink-0 truncate font-semibold sm:w-28">
                {r.nickname}
              </span>
              <span className="flex-1 whitespace-nowrap font-mono text-[10px] tabular-nums text-muted-foreground sm:text-xs">
                {[r.power1, r.power2, r.power3, r.power4, r.power5]
                  .map(fmt)
                  .join(" • ")}
              </span>
              <button
                onClick={() => setDeleteId(r.id)}
                aria-label="Видалити"
                className="shrink-0 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </main>

      <Dialog.Root
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=open]:zoom-in-95">
            <Dialog.Title className="text-base font-semibold">
              Видалити запис?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Запис буде повністю видалено з бази даних.
            </Dialog.Description>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={handleDelete}
                className="rounded-lg bg-destructive px-3 py-2.5 text-sm font-semibold text-destructive-foreground transition hover:opacity-90"
              >
                🗑 Видалити
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground transition hover:bg-accent"
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
