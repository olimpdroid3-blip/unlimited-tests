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

export type TowerSourceLink = { label: "— [ТГ] —" | "◆"; url: string };

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
    return { label: "— [ТГ] —", url: origin.telegram_message_link };
  }
  if (origin?.source === "web" && origin.site_url) {
    return { label: "◆", url: origin.site_url };
  }
  return null;
}
