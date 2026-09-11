export const TOWERS_SITE_URL = "https://unlimited-tests.lovable.app/towers";

export type TowerOriginSource = "telegram" | "web";

export type TowerOrigin = {
  tower_id: string;
  source: TowerOriginSource;
  telegram_message_id: number | null;
  telegram_message_link: string | null;
  site_url: string | null;
  created_at: string;
};

export type TowerSourceButton = { text: string; url: string };

export function buildTowerSiteUrl(towerId: string): string {
  return `${TOWERS_SITE_URL}?tower=${encodeURIComponent(towerId)}`;
}

export function buildTowerSourceButtons(
  towerIds: readonly string[],
  origins: readonly TowerOrigin[],
): TowerSourceButton[][] {
  const byTower = new Map(origins.map((origin) => [origin.tower_id, origin]));
  const buttons = towerIds.flatMap((towerId) => {
    const origin = byTower.get(towerId);
    if (origin?.source === "telegram" && origin.telegram_message_link) {
      return [{ text: `◉ Telegram · ${towerId}`, url: origin.telegram_message_link }];
    }
    if (origin?.source === "web" && origin.site_url) {
      return [{ text: `◆ UU · ${towerId}`, url: origin.site_url }];
    }
    return [];
  });

  const rows: TowerSourceButton[][] = [];
  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }
  return rows;
}