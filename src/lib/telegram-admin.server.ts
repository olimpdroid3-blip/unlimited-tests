// Server-only helpers for the hidden Telegram broadcast admin.
// The password lives in the TELEGRAM_ADMIN_PASSWORD secret and never reaches the client.

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getPassword(): string {
  const password = process.env["TELEGRAM_ADMIN_PASSWORD"];
  if (!password) {
    throw new Error("Missing TELEGRAM_ADMIN_PASSWORD secret");
  }
  return password;
}

function getSigningKey(): string {
  // Dedicated signing secret when available, otherwise derive from the password secret.
  return process.env["TELEGRAM_ADMIN_SESSION_SECRET"] ?? `session:${getPassword()}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSigningKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns a short-lived signed token, or null when the password is wrong. */
export async function createAdminSession(password: string): Promise<string | null> {
  if (!safeEqual(password, getPassword())) return null;
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `telegram-admin.${expiresAt}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyAdminSession(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [scope, expiresRaw, signature] = parts;
  if (scope !== "telegram-admin") return false;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = await sign(`${scope}.${expiresRaw}`);
  return safeEqual(signature, expected);
}

export type TestSendResult = { ok: boolean; error?: string; messageId?: number };

/** Reads the bridge key server-side. Never returned to the client. */
async function getBridgeKey(): Promise<string | null> {
  const { supabaseAdmin } = await import("@/lib/db.server");
  const { data, error } = await supabaseAdmin
    .from("telegram_broadcast_bridge" as never)
    .select("bridge_key")
    .eq("id", 1)
    .maybeSingle<{ bridge_key: string }>();
  if (error || !data?.bridge_key) return null;
  return data.bridge_key;
}

function getEdgeBaseUrl(): string | null {
  return process.env["GVG_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? null;
}

export type SyncMembersResult = {
  ok: boolean;
  chatTitle?: string;
  totalReturned?: number;
  saved?: number;
  eligible?: number;
  error?: string;
};

export async function syncTelegramRecipients(
  token: string | null | undefined,
): Promise<SyncMembersResult> {
  if (!(await verifyAdminSession(token))) {
    return { ok: false, error: "Сесія недійсна. Увійдіть ще раз." };
  }

  const baseUrl = getEdgeBaseUrl();
  if (!baseUrl) return { ok: false, error: "Сервіс синхронізації не налаштований." };

  const bridgeKey = await getBridgeKey();
  if (!bridgeKey) return { ok: false, error: "Немає доступу до каналу синхронізації." };

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/functions/v1/telegram-mtproto-send`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-broadcast-bridge": bridgeKey },
      body: JSON.stringify({ action: "sync_members" }),
    });
  } catch {
    return { ok: false, error: "Сервіс синхронізації недоступний." };
  }

  const raw = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }

  if (!response.ok || payload["ok"] === false) {
    const detail =
      typeof payload["error"] === "string"
        ? payload["error"]
        : typeof payload["message"] === "string"
          ? (payload["message"] as string)
          : `Помилка сервісу (${response.status})`;
    return { ok: false, error: detail };
  }

  const num = (key: string): number | undefined => {
    const value = payload[key] ?? payload[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)];
    return typeof value === "number" ? value : undefined;
  };
  const chatTitle = payload["chatTitle"] ?? payload["chat_title"];

  return {
    ok: true,
    ...(typeof chatTitle === "string" ? { chatTitle } : {}),
    ...(num("totalReturned") !== undefined ? { totalReturned: num("totalReturned")! } : {}),
    ...(num("saved") !== undefined ? { saved: num("saved")! } : {}),
    ...(num("eligible") !== undefined ? { eligible: num("eligible")! } : {}),
  };
}

export type RecipientRow = {
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

export async function listTelegramRecipients(
  token: string | null | undefined,
): Promise<{ ok: boolean; recipients: RecipientRow[]; error?: string }> {
  if (!(await verifyAdminSession(token))) {
    return { ok: false, recipients: [], error: "Сесія недійсна. Увійдіть ще раз." };
  }

  const { supabaseAdmin } = await import("@/lib/db.server");
  const { data, error } = await supabaseAdmin
    .from("telegram_broadcast_recipients" as never)
    .select(
      "telegram_user_id, username, display_name, member_status, is_bot, is_self, is_deleted, enabled, in_group",
    )
    .eq("in_group", true)
    .order("enabled", { ascending: false })
    .order("is_bot", { ascending: true })
    .order("display_name", { ascending: true })
    .returns<RecipientRow[]>();

  if (error) return { ok: false, recipients: [], error: "Не вдалося завантажити список." };

  return {
    ok: true,
    recipients: (data ?? []).map((row) => ({
      telegram_user_id: Number(row.telegram_user_id),
      username: row.username ?? null,
      display_name: row.display_name ?? null,
      member_status: row.member_status ?? null,
      is_bot: Boolean(row.is_bot),
      is_self: Boolean(row.is_self),
      is_deleted: Boolean(row.is_deleted),
      enabled: Boolean(row.enabled),
      in_group: Boolean(row.in_group),
    })),
  };
}

export async function setTelegramRecipientEnabled(
  token: string | null | undefined,
  telegramUserId: number,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyAdminSession(token))) {
    return { ok: false, error: "Сесія недійсна. Увійдіть ще раз." };
  }

  const { supabaseAdmin } = await import("@/lib/db.server");
  const { error } = await supabaseAdmin
    .from("telegram_broadcast_recipients" as never)
    .update({ enabled, updated_at: new Date().toISOString() } as never)
    .eq("telegram_user_id", telegramUserId);

  if (error) return { ok: false, error: "Не вдалося зберегти зміну." };
  return { ok: true };
}

/** Sends a single test MTProto message through the backend function. Secrets stay server-side. */
export async function sendTelegramTestMessage(input: {
  token: string | null | undefined;
  recipient: string;
  message: string;
}): Promise<TestSendResult> {
  if (!(await verifyAdminSession(input.token))) {
    return { ok: false, error: "Сесія недійсна. Увійдіть ще раз." };
  }

  const recipient = input.recipient.trim();
  const message = input.message.trim();
  if (!recipient) return { ok: false, error: "Вкажіть тестового отримувача." };
  if (!message) return { ok: false, error: "Текст повідомлення порожній." };
  if (message.length > 4000) return { ok: false, error: "Максимум 4000 символів." };

  const baseUrl = process.env["GVG_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  if (!baseUrl) return { ok: false, error: "Сервіс відправки не налаштований." };

  const { supabaseAdmin } = await import("@/lib/db.server");
  const { data, error } = await supabaseAdmin
    .from("telegram_broadcast_bridge" as never)
    .select("bridge_key")
    .eq("id", 1)
    .maybeSingle<{ bridge_key: string }>();

  if (error || !data?.bridge_key) {
    return { ok: false, error: "Немає доступу до каналу відправки." };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/functions/v1/telegram-mtproto-send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-broadcast-bridge": data.bridge_key,
      },
      body: JSON.stringify({ action: "test_send", recipient, message }),
    });
  } catch {
    return { ok: false, error: "Сервіс відправки недоступний." };
  }

  const raw = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }

  if (!response.ok || payload["ok"] === false) {
    const detail =
      typeof payload["error"] === "string"
        ? payload["error"]
        : typeof payload["message"] === "string"
          ? (payload["message"] as string)
          : `Помилка сервісу (${response.status})`;
    return { ok: false, error: detail };
  }

  const messageId = payload["messageId"] ?? payload["message_id"];
  return {
    ok: true,
    ...(typeof messageId === "number" ? { messageId } : {}),
  };
}
