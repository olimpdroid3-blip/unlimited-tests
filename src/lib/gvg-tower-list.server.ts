// Handles the "/+" chat command: posts a list of active towers in the towers
// topic, then deletes all previously tracked bot messages in that topic.
import { supabaseAdmin } from "@/lib/db.server";
import { isMirrorRow, MIRROR_PREFIX } from "@/lib/mirror-order";
import { deleteTelegramMessage } from "@/lib/gvg-tower-notify.server";
import { drainBotMessages, trackBotMessage } from "@/lib/gvg-bot-messages.server";
import { TOWERS_URL } from "@/lib/gvg-pinned-towers.server";

const CHAT_ID = -1003978316922;
const THREAD_ID = 8;

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type TowerRow = {
  tower_id: string;
  nickname: string | null;
  screenshot_url: string | null;
  breached: boolean | null;
};

function towerSortKey(id: string): number[] {
  return id.split(".").map((n) => Number(n) || 0);
}

function compareTowerIds(a: string, b: string): number {
  const ka = towerSortKey(a);
  const kb = towerSortKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const d = (ka[i] ?? 0) - (kb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export async function handleTowerListCommand(): Promise<{ ok: boolean; error?: string }> {
  const token = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
  if (!token) return { ok: false, error: "TELEGRAM_GVG_VIDEO_BOT_TOKEN is not configured" };

  const { data, error } = await supabaseAdmin
    .from("towers")
    .select("tower_id, nickname, screenshot_url, breached");
  if (error) {
    console.error("[tower-list] towers fetch failed", error.message);
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as TowerRow[];
  const filled = rows
    .filter((r) => !isMirrorRow(r.tower_id) && !r.breached && (r.nickname || r.screenshot_url))
    .sort((a, b) => compareTowerIds(a.tower_id, b.tower_id));
  const ordered = rows
    .filter((r) => isMirrorRow(r.tower_id))
    .sort((a, b) => compareTowerIds(a.tower_id, b.tower_id));

  const lines: string[] = [];
  for (const r of filled) {
    lines.push(`🏰 Вежа ${escape(r.tower_id)} — ${escape(r.nickname ?? "?")}`);
  }
  for (const r of ordered) {
    const realId = r.tower_id.slice(MIRROR_PREFIX.length);
    lines.push(
      `🏰 Вежа ${escape(realId)} — ${escape(r.nickname ?? "?")} 🔴<b>замовив дзеркало</b>`,
    );
  }

  const text =
    lines.length > 0
      ? `🏰 <b>Вежі</b>\n\n${lines.join("\n")}`
      : "🏰 <b>Вежі</b>\n\nНемає активних веж";

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      message_thread_id: THREAD_ID,
      parse_mode: "HTML",
      text,
      disable_notification: true,
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: "🏰 Вежі — Дзеркала", url: TOWERS_URL }]] },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };
  if (!json.ok || !json.result?.message_id) {
    console.error(`[tower-list] sendMessage failed [${res.status}] ${json.description ?? ""}`);
    return { ok: false, error: json.description ?? "telegram-error" };
  }

  const newId = json.result.message_id;
  // Delete every previously tracked bot message, keep only the fresh list.
  const stale = await drainBotMessages([newId]);
  for (const id of stale) {
    await deleteTelegramMessage(id);
  }
  await trackBotMessage(newId, "list");

  return { ok: true };
}
