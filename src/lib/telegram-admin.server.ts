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
