import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { toast, Toaster } from "sonner";
import {
  clearNickCookie,
  filterNicknameOptions,
  getNickCookie,
  resolveNicknameSave,
  setNickCookie,
} from "@/lib/nickname";
import { supabase } from "@/lib/db";

const nicknameColumns = "id,nickname";

export function NicknameInput() {
  const [nick, setNick] = useState("");
  const [input, setInput] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const playersQuery = useQuery({
    queryKey: ["nickname-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("battle_power")
        .select(nicknameColumns)
        .order("nickname");
      if (error) throw error;
      return data ?? [];
    },
  });

  const players = playersQuery.data ?? [];
  const filteredPlayers = filterNicknameOptions(players, input);

  useEffect(() => {
    setNick(getNickCookie());
  }, []);

  const handleSave = async () => {
    const resolution = resolveNicknameSave(input, players);
    if (resolution.kind === "empty") return;

    setDropdownOpen(false);
    setIsSaving(true);
    try {
      let nickname = resolution.nickname;

      if (resolution.kind === "create") {
        const { data, error } = await supabase
          .from("battle_power")
          .insert({
            nickname,
            power1: null,
            power2: null,
            power3: null,
            power4: null,
            power5: null,
          })
          .select(nicknameColumns)
          .single();
        if (error) throw error;

        nickname = data.nickname.trim();
        queryClient.setQueryData(
          ["nickname-options"],
          [...players, data].sort((left, right) =>
            left.nickname.localeCompare(right.nickname, undefined, { sensitivity: "base" }),
          ),
        );
        toast.success("Новий нік додано до бази");
      }

      setNickCookie(nickname);
      setNick(nickname);
      setInput("");
    } catch (error) {
      console.error(error);
      toast.error("Не вдалося зберегти нік");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    clearNickCookie();
    setNick("");
    setConfirmOpen(false);
  };

  const locked = !!nick;
  const controlsDisabled = locked || playersQuery.isLoading || isSaving;

  return (
    <div className="mx-auto mb-6 max-w-md sm:mb-8">
      <Toaster position="top-center" richColors />
      <label className="mb-1.5 block text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Введіть свій нік в грі
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            value={locked ? nick : input}
            onChange={(e) => {
              setInput(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => {
              if (!controlsDisabled) setDropdownOpen(true);
            }}
            onBlur={() => setDropdownOpen(false)}
            disabled={controlsDisabled}
            autoComplete="off"
            placeholder={playersQuery.isLoading ? "Завантаження ніків…" : "Оберіть або введіть нік"}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDropdownOpen(false);
              if (e.key === "Enter" && !controlsDisabled) void handleSave();
            }}
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 pr-10 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-80"
          />
          {!locked && (
            <button
              type="button"
              aria-label="Показати список ніків"
              aria-expanded={dropdownOpen}
              disabled={controlsDisabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setDropdownOpen((isOpen) => !isOpen)}
              className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
          )}
          {dropdownOpen && !controlsDisabled && filteredPlayers.length > 0 && (
            <div
              role="listbox"
              aria-label="Ніки гравців"
              onMouseDown={(event) => event.preventDefault()}
              className="absolute inset-x-0 top-full z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl"
            >
              {filteredPlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  role="option"
                  aria-selected={player.nickname === input}
                  onClick={() => {
                    setInput(player.nickname);
                    setDropdownOpen(false);
                  }}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm transition hover:bg-accent focus:bg-accent focus:outline-none"
                >
                  {player.nickname}
                </button>
              ))}
            </div>
          )}
          {locked && (
            <button
              aria-label="Скинути нік"
              onClick={() => setConfirmOpen(true)}
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={controlsDisabled || !input.trim()}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? "…" : "OK"}
        </button>
      </div>
      {playersQuery.isError && !locked && (
        <p className="mt-2 text-center text-xs text-destructive">
          Не вдалося завантажити список ніків. Новий нік усе ще можна ввести вручну.
        </p>
      )}

      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 duration-200">
            <Dialog.Title className="text-base font-semibold text-foreground">
              Скинути нік?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Ваш нікнейм буде видалено з цього пристрою.
            </Dialog.Description>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={handleReset}
                className="rounded-lg bg-destructive px-3 py-2.5 text-sm font-semibold text-destructive-foreground transition hover:opacity-90"
              >
                Так, скинути
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
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
