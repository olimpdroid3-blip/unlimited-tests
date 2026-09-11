export const TOWERS_SITE_URL = "https://unlimited-tests.lovable.app/towers";
export const CB_TOWER_DELETE_PREFIX = "tower:delete:";

export type TowerOriginSource = "telegram" | "web";

export type TowerOrigin = {
  tower_id: string;
  source: TowerOriginSource;
  telegram_message_id: number | null;
  telegram_message_link: string | null;
  site_url: string | null;
  created_at: string;
};

export type TowerSourceLink = { icon: "✈️" | "◆"; url: string };

export function buildTowerSiteUrl(towerId: string): string {
  return `${TOWERS_SITE_URL}?tower=${encodeURIComponent(towerId)}`;
}

export function buildTowerDeleteCallback(towerId: string): string {
  return `${CB_TOWER_DELETE_PREFIX}${towerId}`;
}

export function getTowerSourceLink(
  towerId: string,
  origins: readonly TowerOrigin[],
): TowerSourceLink | null {
  const origin = origins.find((candidate) => candidate.tower_id === towerId);
  if (origin?.source === "telegram" && origin.telegram_message_link) {
    return { icon: "✈️", url: origin.telegram_message_link };
  }
  if (origin?.source === "web" && origin.site_url) {
    return { icon: "◆", url: origin.site_url };
  }
  return null;
}
