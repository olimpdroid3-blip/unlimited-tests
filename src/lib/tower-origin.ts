export const TOWERS_SITE_URL = "https://unlimited-tests.lovable.app/towers";
export const CB_TOWER_DELETE_PREFIX = "tower:delete:";
export const CB_TOWER_DELETE_CONFIRM_PREFIX = "tower:delete:yes:";
export const CB_TOWER_DELETE_CANCEL_PREFIX = "tower:delete:no:";

export type TowerOriginSource = "telegram" | "web";

export type TowerOrigin = {
  tower_id: string;
  source: TowerOriginSource;
  telegram_message_id: number | null;
  telegram_message_link: string | null;
  site_url: string | null;
  created_at: string;
};

export type TowerSourceLink = { url: string };

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeHtmlAttribute = (value: string) => escapeHtml(value).replace(/"/g, "&quot;");

export function buildTowerSiteUrl(towerId: string): string {
  return `${TOWERS_SITE_URL}?tower=${encodeURIComponent(towerId)}`;
}

export function buildTowerDeleteCallback(towerId: string): string {
  return `${CB_TOWER_DELETE_PREFIX}${towerId}`;
}

export function buildTowerDeleteConfirmCallback(towerId: string): string {
  return `${CB_TOWER_DELETE_CONFIRM_PREFIX}${towerId}`;
}

export function buildTowerDeleteCancelCallback(towerId: string): string {
  return `${CB_TOWER_DELETE_CANCEL_PREFIX}${towerId}`;
}

export function parseTowerDeleteCallback(
  data: string,
): { action: "request" | "confirm" | "cancel"; towerId: string } | null {
  if (data.startsWith(CB_TOWER_DELETE_CONFIRM_PREFIX)) {
    return { action: "confirm", towerId: data.slice(CB_TOWER_DELETE_CONFIRM_PREFIX.length) };
  }
  if (data.startsWith(CB_TOWER_DELETE_CANCEL_PREFIX)) {
    return { action: "cancel", towerId: data.slice(CB_TOWER_DELETE_CANCEL_PREFIX.length) };
  }
  if (data.startsWith(CB_TOWER_DELETE_PREFIX)) {
    return { action: "request", towerId: data.slice(CB_TOWER_DELETE_PREFIX.length) };
  }
  return null;
}

export function getTowerSourceLink(
  towerId: string,
  origins: readonly TowerOrigin[],
): TowerSourceLink | null {
  const origin = origins.find((candidate) => candidate.tower_id === towerId);
  if (origin?.source === "telegram" && origin.telegram_message_link) {
    return { url: origin.telegram_message_link };
  }
  return null;
}

export function renderTowerLine(
  towerId: string,
  nickname: string | null,
  origins: readonly TowerOrigin[],
  suffix = "",
): string {
  const source = getTowerSourceLink(towerId, origins);
  const label = `🏰 Вежа ${escapeHtml(towerId)} — ${escapeHtml(nickname ?? "?")}${suffix}`;
  return source ? `<a href="${escapeHtmlAttribute(source.url)}">${label}</a>` : label;
}

export function renderTowerListText(lines: readonly string[]): string {
  return lines.length > 0
    ? `🏰 <b>Вежі</b>\n\n${lines.join("\n\n")}`
    : "🏰 <b>Вежі</b>\n\nНемає активних веж";
}
