import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  clearNickCookie,
  getNickCookie,
  setNickCookie,
} from "@/lib/nickname";

export function NicknameInput() {
  const [nick, setNick] = useState("");
  const [input, setInput] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setNick(getNickCookie());
  }, []);

  const handleSave = () => {
    const v = input.trim();
    if (!v) return;
    setNickCookie(v);
    setNick(v);
    setInput("");
  };

  const handleReset = () => {
    clearNickCookie();
    setNick("");
    setConfirmOpen(false);
  };

  const locked = !!nick;

  return (
    <div className="mx-auto mb-6 max-w-md sm:mb-8">
      <label className="mb-1.5 block text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Введіть свій нік в грі
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            value={locked ? nick : input}
            onChange={(e) => setInput(e.target.value)}
            disabled={locked}
            placeholder="Ваш нікнейм"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !locked) handleSave();
            }}
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 pr-10 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-80"
          />
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
          onClick={handleSave}
          disabled={locked || !input.trim()}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          OK
        </button>
      </div>

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
