import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import {
  calculateAverageBattlePower,
  findBattlePowerRowByNickname,
  getBattlePowerFormPresentation,
  getBattlePowerValueTone,
  sortBattlePowerRows,
  type BattlePowerRow,
  type BattlePowerSortDirection,
  type BattlePowerSortKey,
} from "@/lib/battle-power";
import { battlePowerRepository } from "@/lib/battle-power-ui";
import { getNickCookie } from "@/lib/nickname";

export const Route = createFileRoute("/battle-power")({
  head: () => ({
    meta: [
      { title: "Бойова Сила — NoNameClan" },
      {
        name: "description",
        content: "Збереження бойової сили учасників гільдії NoNameClan.",
      },
      { property: "og:title", content: "Бойова Сила — NoNameClan" },
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

function powerColor(v: number | null): string | undefined {
  if (v === null || v === undefined || Number.isNaN(v)) return undefined;
  if (getBattlePowerValueTone(v) === "high") return "var(--battle-power-high)";
  if (v >= 145) return "#ED4848"; // червоний
  if (v >= 140) return "#F15D4D"; // світло-червоний
  if (v >= 135) return "#F5891E"; // тьмяно-жовтий
  if (v >= 130) return "#F9D017"; // жовтий
  return "#34A835"; // зелений (<130)
}

const legendItems: { color: string; label: string }[] = [
  { color: "var(--battle-power-high)", label: "≥150" },
  { color: "#ED4848", label: "145–149.9" },
  { color: "#F15D4D", label: "140–144.9" },
  { color: "#F5891E", label: "135–139.9" },
  { color: "#F9D017", label: "130–134.9" },
  { color: "#34A835", label: "<130" },
];

const sortOptions: { value: BattlePowerSortKey; label: string }[] = [
  { value: "nickname", label: "Ім’я" },
  { value: "power1", label: "БС #1" },
  { value: "power2", label: "БС #2" },
  { value: "power3", label: "БС #3" },
  { value: "power4", label: "БС #4" },
  { value: "power5", label: "БС #5" },
  { value: "average", label: "Середній БС" },
];

function BattlePowerPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState("");
  const [savedNickname, setSavedNickname] = useState("");
  const [powers, setPowers] = useState<string[]>(["", "", "", "", ""]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<BattlePowerSortKey>("nickname");
  const [sortDirection, setSortDirection] = useState<BattlePowerSortDirection>("asc");

  useEffect(() => {
    const cookieNickname = getNickCookie();
    setNick(cookieNickname);
    setSavedNickname(cookieNickname);
  }, []);

  const { data = [], isLoading } = useQuery({
    queryKey: ["battle_power"],
    queryFn: () => battlePowerRepository.getAll(),
  });
  const formPresentation = getBattlePowerFormPresentation(open, editingId);
  const savedBattlePowerRow = findBattlePowerRowByNickname(data, savedNickname);
  const sortedData = useMemo(
    () => sortBattlePowerRows(data, sortKey, sortDirection),
    [data, sortDirection, sortKey],
  );

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

  const openOwnForm = () => {
    const cookieNickname = getNickCookie();
    const existingRow = findBattlePowerRowByNickname(data, cookieNickname);
    setSavedNickname(cookieNickname);

    if (existingRow) {
      openEdit(existingRow);
      return;
    }

    setNick(cookieNickname);
    setPowers(["", "", "", "", ""]);
    setEditingId(null);
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
        <Link
          to="/progress"
          className="inline-flex rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition hover:bg-accent"
        >
          ← Назад
        </Link>
        <h1 className="text-center text-xl font-bold tracking-tight sm:text-2xl">💪 Бойова Сила</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Збереження бойової сили учасників
        </p>

        {!open && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={openOwnForm}
              disabled={isLoading}
              className="w-full cursor-pointer rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
            >
              {isLoading
                ? "Завантаження…"
                : savedBattlePowerRow
                  ? "✏️ Редагувати свій БС"
                  : "➕ Додати свій БС"}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full cursor-pointer rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition hover:bg-accent active:scale-[0.99]">
                  ⇅ Сортування
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Сортувати за</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sortKey}
                  onValueChange={(value) => setSortKey(value as BattlePowerSortKey)}
                >
                  {sortOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Напрямок</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sortDirection}
                  onValueChange={(value) => setSortDirection(value as BattlePowerSortDirection)}
                >
                  <DropdownMenuRadioItem value="asc">За зростанням</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="desc">За спаданням</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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

        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card/60">
          <table className="w-full table-fixed border-collapse text-[10px] min-[360px]:text-[11px] sm:text-base">
            <colgroup>
              <col style={{ width: "30%" }} />
              {[1, 2, 3, 4, 5, 6].map((column) => (
                <col key={column} style={{ width: "11.6667%" }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-1 py-2 text-left font-semibold sm:px-2">Гравець</th>
                <th className="px-0.5 py-2 text-center font-semibold sm:px-1">БС #1</th>
                <th className="px-0.5 py-2 text-center font-semibold sm:px-1">БС #2</th>
                <th className="px-0.5 py-2 text-center font-semibold sm:px-1">БС #3</th>
                <th className="px-0.5 py-2 text-center font-semibold sm:px-1">БС #4</th>
                <th className="px-0.5 py-2 text-center font-semibold sm:px-1">БС #5</th>
                <th className="px-0.5 py-2 text-center font-semibold sm:px-1">
                  <span className="sm:hidden">Сер.</span>
                  <span className="hidden sm:inline">Середній БС</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-xs text-muted-foreground">
                    Завантаження…
                  </td>
                </tr>
              )}
              {!isLoading && data.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-xs text-muted-foreground">
                    Записів поки немає
                  </td>
                </tr>
              )}
              {sortedData.map((r) => {
                const averagePower = calculateAverageBattlePower(r);
                const displayedPowers = [
                  r.power1,
                  r.power2,
                  r.power3,
                  r.power4,
                  r.power5,
                  averagePower,
                ];

                return (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="px-1 py-2 sm:px-2">
                      <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
                        <span className="min-w-0 flex-1 truncate font-bold" title={r.nickname}>
                          {r.nickname}
                        </span>
                        <button
                          onClick={() => openEdit(r)}
                          aria-label={`Редагувати ${r.nickname}`}
                          className="shrink-0 cursor-pointer rounded-md px-0.5 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-primary/10 hover:text-primary sm:px-1 sm:text-[11px]"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => setDeleteId(r.id)}
                          aria-label={`Видалити ${r.nickname}`}
                          className="shrink-0 cursor-pointer rounded-md px-0.5 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive sm:px-1 sm:text-[11px]"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                    {displayedPowers.map((power, index) => (
                      <td key={index} className="px-0.5 py-2 text-center sm:px-1">
                        <span
                          className="font-mono font-semibold tabular-nums"
                          style={power == null ? undefined : { color: powerColor(power) }}
                        >
                          {fmt(power)}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-card/60 px-3 py-3 text-[10px] sm:text-[11px]">
          {legendItems.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground">{item.label}</span>
            </span>
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
