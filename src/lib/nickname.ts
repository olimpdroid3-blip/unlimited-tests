export const NICK_COOKIE = "uu_nick";

export type NicknameOption = {
  id: string;
  nickname: string;
};

export type NicknameSaveResolution =
  | { kind: "empty" }
  | { kind: "existing"; nickname: string }
  | { kind: "create"; nickname: string };

export function filterNicknameOptions(
  players: readonly NicknameOption[],
  search: string,
): readonly NicknameOption[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  if (!normalizedSearch) return players;
  return players.filter((player) =>
    player.nickname.trim().toLocaleLowerCase().includes(normalizedSearch),
  );
}

export function resolveNicknameSave(
  input: string,
  players: readonly NicknameOption[],
): NicknameSaveResolution {
  const nickname = input.trim();
  if (!nickname) return { kind: "empty" };

  const normalizedNickname = nickname.toLocaleLowerCase();
  const existingPlayer = players.find(
    (player) => player.nickname.trim().toLocaleLowerCase() === normalizedNickname,
  );

  return existingPlayer
    ? { kind: "existing", nickname: existingPlayer.nickname.trim() }
    : { kind: "create", nickname };
}

export function findPlayerIdByNickname(
  players: readonly NicknameOption[],
  nickname: string,
): string | undefined {
  const normalizedNickname = nickname.trim().toLocaleLowerCase();
  if (!normalizedNickname) return undefined;

  return players.find((player) => player.nickname.trim().toLocaleLowerCase() === normalizedNickname)
    ?.id;
}

export function getNickCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.split("; ").find((c) => c.startsWith(NICK_COOKIE + "="));
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
