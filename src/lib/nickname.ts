export const NICK_COOKIE = "uu_nick";

export function getNickCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(NICK_COOKIE + "="));
  if (!match) return "";
  try {
    return decodeURIComponent(match.split("=").slice(1).join("="));
  } catch {
    return "";
  }
}

export function setNickCookie(nick: string) {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${NICK_COOKIE}=${encodeURIComponent(nick)}; path=/; max-age=${oneYear}; SameSite=Lax`;
  window.dispatchEvent(new Event("uu-nick-changed"));
}

export function clearNickCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${NICK_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  window.dispatchEvent(new Event("uu-nick-changed"));
}
