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
