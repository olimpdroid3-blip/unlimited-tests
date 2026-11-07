import { isMirrorRow, VALID_TOWER_IDS } from "./mirror-order.ts";
import { getTowerGroup } from "./tower-participants.ts";
import { getTowerStatusFlags } from "./tower-status.ts";
import { isTowerWorkflowThread } from "./tower-form.ts";

export type ScoutingHero = { name: string; bp: number | null; awakening: number | null };
export type ScoutingReport = {
  tower_position: string;
  player_name: string;
  total_bp: number | null;
  heroes: ScoutingHero[];
  captured_at: string | null;
  received_at: string | null;
};
export type ScoutingResult = { match_id: string; reports: ScoutingReport[] };
export type SnapshotTower = {
  tower_id: string;
  nickname?: string | null;
  awakenings?: string | null;
  notes?: string | null;
  participants?: unknown;
  previous_nickname?: string | null;
  placed?: boolean | null;
  breached?: boolean | null;
  testing?: boolean | null;
  destroyed?: boolean | null;
  removed?: boolean | null;
  do_not_attack?: boolean | null;
  [key: string]: unknown;
};
export type ResetSnapshot = {
  match_id: string;
  towers: SnapshotTower[];
  variants: { tower_id: string; variant: number; [key: string]: unknown }[];
  [key: string]: unknown;
};
export type ResetResult = { ok: true; match_id: string; screenshot_paths: string[] };

/** Strict plain-position request, not arbitrary digits embedded in prose. */
export function parseScoutingPosition(text: string): string | null {
  const match = /^([1-4])(?:\s*[.\-]\s*|\s+)([1-6])(?:\s*[.\-]\s*|\s+)([1-2])$/.exec(text.trim());
  if (!match) return null;
  const position = `${match[1]}.${match[2]}.${match[3]}`;
  return VALID_TOWER_IDS.includes(position) ? position : null;
}

export function scoutingRequestPosition(chatId: number, threadId: number | null, text: string, formHandled: boolean): string | null {
  return !formHandled && isTowerWorkflowThread(chatId, threadId) ? parseScoutingPosition(text) : null;
}

export function awakeningLabel(value: number | null): string {
  return Number.isInteger(value) && value !== null && value >= 0 && value <= 5 ? `A${value}` : "невідомо";
}

export function formatBp(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("uk-UA") : "невідомо";
}

export function scoutingDate(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "невідомо";
  return new Date(value).toLocaleString("uk-UA", { timeZone: "UTC" }) + " UTC";
}

// Sent without parse_mode: user content remains literal, never Telegram markup.
const plainName = (value: string) => value.replace(/[\r\n\u0000-\u001f\u007f]/g, " ").slice(0, 200);
export function formatScoutingReply(position: string, report?: ScoutingReport): string {
  if (!report) return `Розвідки для вежі ${position} у поточному матчі ще немає.`;
  const heroes = Array.from({ length: 5 }, (_, index) => {
    const hero = report.heroes[index];
    return `${index + 1}. ${hero ? plainName(hero.name) : "Невідомий герой"} — БС: ${formatBp(hero?.bp ?? null)}; ${awakeningLabel(hero?.awakening ?? null)}`;
  });
  return [
    `Розвідка суперника — ${position}`,
    `Гравець: ${plainName(report.player_name)}`,
    `Загальна БС: ${formatBp(report.total_bp)}`,
    ...heroes,
    `Знімок: ${scoutingDate(report.captured_at)}`,
    `Отримано: ${scoutingDate(report.received_at)}`,
    "Пробуди розраховані; «невідомо» не означає A0.",
  ].join("\n");
}

/** Exact legacy archive projection; IDs/dates/marker rows never enter archive objects. */
export function prepareAwakeningArchive(snapshot: ResetSnapshot) {
  const realTowers = snapshot.towers.filter((tower) => !isMirrorRow(tower.tower_id));
  const variants = snapshot.variants.filter((variant) => !isMirrorRow(variant.tower_id));
  const map = new Map(realTowers.map((tower) => [tower.tower_id, tower]));
  const variantsByTower = new Map(variants.map((row) => [row.tower_id, row.variant]));
  const ids = new Set([...realTowers.map((tower) => tower.tower_id), ...variantsByTower.keys()]);
  return [...ids].map((id) => ({
    tower_id: id,
    participants: getTowerGroup(id, realTowers, variants).participants,
    nickname: map.get(id)?.nickname ?? null,
    awakenings: map.get(id)?.awakenings ?? null,
    notes: map.get(id)?.notes ?? null,
    defense_variant: variantsByTower.get(id) ?? null,
    ...getTowerStatusFlags(map.get(id)),
    previous_nickname: map.get(id)?.previous_nickname ?? null,
    screenshot_url: null,
  }));
}

export type AwakeningRpc = <T>(name: string, args: Record<string, unknown>) => Promise<T>;

/** Injected IO makes transaction/cleanup boundaries testable without live records. */
export async function executeAwakeningReset(rpc: AwakeningRpc, cleanup: (paths: string[]) => Promise<void>) {
  const snapshot = await rpc<ResetSnapshot>("awakening_tower_reset_snapshot", {});
  const result = await rpc<ResetResult>("awakening_clear_towers", {
    p_snapshot: snapshot,
    p_archive_rows: prepareAwakeningArchive(snapshot),
  });
  if (result.ok !== true) throw new Error("RESET_FAILED");
  let cleanupWarning: string | null = null;
  if (result.screenshot_paths.length) {
    try { await cleanup(result.screenshot_paths); }
    catch { cleanupWarning = "Вежі архівовано й новий матч розпочато, але не всі скріншоти вдалося прибрати."; }
  }
  return { ok: true as const, match_id: result.match_id, cleanupWarning };
}