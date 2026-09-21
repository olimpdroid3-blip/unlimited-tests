import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import {
  checkTelegramAdminSession,
  listTelegramRecipientsFn,
  loginTelegramAdmin,
  sendTelegramAdminTest,
  setTelegramRecipientEnabledFn,
  syncTelegramRecipientsFn,
} from "@/lib/telegram-admin.functions";

type Recipient = {
  telegram_user_id: number;
  username: string | null;
  display_name: string | null;
  member_status: string | null;
  is_bot: boolean;
  is_self: boolean;
  is_deleted: boolean;
  enabled: boolean;
  in_group: boolean;
};

function isEligible(r: Recipient): boolean {
  return !r.is_bot && !r.is_self && !r.is_deleted;
}

const SESSION_KEY = "telegram-admin-session";

export const Route = createFileRoute("/telegram-admin")({
  head: () => ({
    meta: [
      { title: "Telegram розсилка — NoNameClan" },
      { name: "description", content: "Службова панель Telegram-розсилки NoNameClan." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Telegram розсилка — NoNameClan" },
      { property: "og:description", content: "Службова панель Telegram-розсилки NoNameClan." },
    ],
  }),
  component: TelegramAdminPage,
});

function TelegramAdminPage() {
  const login = useServerFn(loginTelegramAdmin);
  const check = useServerFn(checkTelegramAdminSession);
  const sendTest = useServerFn(sendTelegramAdminTest);
  const syncRecipients = useServerFn(syncTelegramRecipientsFn);
  const listRecipients = useServerFn(listTelegramRecipientsFn);
  const setRecipientEnabled = useServerFn(setTelegramRecipientEnabledFn);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);


  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) return;
    void check({ data: { token } }).then((res) => {
      if (res.valid) setAuthed(true);
      else sessionStorage.removeItem(SESSION_KEY);
    });
  }, [check]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await login({ data: { password } });
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, res.token);
        setPassword("");
        setAuthed(true);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Не вдалося перевірити пароль. Спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  }

  async function onTestSend() {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) {
      setAuthed(false);
      return;
    }
    setSending(true);
    setResult("Відправлення…");
    try {
      const res = await sendTest({ data: { token, recipient: recipient.trim(), message } });
      setResult(res.ok ? "Тестове повідомлення надіслано" : (res.error ?? "Не вдалося надіслати."));
    } catch {
      setResult("Не вдалося надіслати тестове повідомлення.");
    } finally {
      setSending(false);
    }
  }

  const loadRecipients = useCallback(async () => {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) return;
    try {
      const res = await listRecipients({ data: { token } });
      if (res.ok) setRecipients(res.recipients as Recipient[]);
      else setSyncStatus(res.error ?? "Не вдалося завантажити список.");
    } catch {
      setSyncStatus("Не вдалося завантажити список.");
    }
  }, [listRecipients]);

  useEffect(() => {
    if (!authed) return;
    void loadRecipients();
  }, [authed, loadRecipients]);

  async function onSync() {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) {
      setAuthed(false);
      return;
    }
    setSyncing(true);
    setSyncStatus("Оновлення…");
    try {
      const res = await syncRecipients({ data: { token } });
      if (res.ok) {
        await loadRecipients();
        setSyncStatus("Список оновлено");
      } else {
        setSyncStatus(res.error ?? "Не вдалося оновити список.");
      }
    } catch {
      setSyncStatus("Не вдалося оновити список.");
    } finally {
      setSyncing(false);
    }
  }

  async function onToggleRecipient(row: Recipient, enabled: boolean) {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) {
      setAuthed(false);
      return;
    }
    setSavingId(row.telegram_user_id);
    setRecipients((prev) =>
      prev.map((r) => (r.telegram_user_id === row.telegram_user_id ? { ...r, enabled } : r)),
    );
    try {
      const res = await setRecipientEnabled({
        data: { token, telegramUserId: row.telegram_user_id, enabled },
      });
      if (!res.ok) {
        setRecipients((prev) =>
          prev.map((r) =>
            r.telegram_user_id === row.telegram_user_id ? { ...r, enabled: !enabled } : r,
          ),
        );
        setSyncStatus(res.error ?? "Не вдалося зберегти зміну.");
      }
    } catch {
      setRecipients((prev) =>
        prev.map((r) =>
          r.telegram_user_id === row.telegram_user_id ? { ...r, enabled: !enabled } : r,
        ),
      );
      setSyncStatus("Не вдалося зберегти зміну.");
    } finally {
      setSavingId(null);
    }
  }

  const query = search.trim().toLowerCase();
  const visibleRecipients = query
    ? recipients.filter((r) =>
        `${r.display_name ?? ""} ${r.username ?? ""}`.toLowerCase().includes(query),
      )
    : recipients;
  const eligibleCount = recipients.filter((r) => isEligible(r) && r.enabled).length;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-8">
        <h1 className="mb-6 text-center text-xl font-bold tracking-tight sm:text-2xl">
          Telegram розсилка
        </h1>

        {!authed ? (
          <form
            onSubmit={onSubmit}
            className="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <label className="text-sm font-medium" htmlFor="admin-password">
              Пароль
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/60"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <button
              type="submit"
              disabled={busy || password.length === 0}
              className="rounded-lg border border-border bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:opacity-50"
            >
              {busy ? "Перевірка…" : "Увійти"}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <label className="text-sm font-medium" htmlFor="test-recipient">
              Тестовий отримувач
            </label>
            <input
              id="test-recipient"
              type="text"
              placeholder="@username"
              autoCapitalize="none"
              autoCorrect="off"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/60"
            />

            <label className="text-sm font-medium" htmlFor="broadcast-text">
              Текст повідомлення
            </label>
            <textarea
              id="broadcast-text"
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/60"
            />
            <div className="text-right text-xs text-muted-foreground">{message.length} символів</div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void onTestSend()}
                disabled={sending || message.trim().length === 0 || recipient.trim().length === 0}
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition hover:border-primary/50 hover:bg-primary/10 disabled:opacity-50"
              >
                {sending ? "Відправлення…" : "Тестове повідомлення"}
              </button>
              <button
                type="button"
                onClick={() => setResult("Масова розсилка ще не підключена.")}
                className="flex-1 rounded-lg border border-border bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
              >
                Надіслати всім
              </button>
            </div>


            <div className="min-h-10 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              {result ?? "Результат відправки з'явиться тут."}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
