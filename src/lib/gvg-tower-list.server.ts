// Handles the "/+" chat command: posts a list of active towers in the towers
// topic, then deletes all previously tracked bot messages in that topic.
import { supabaseAdmin } from "@/lib/db.server";
import { isMirrorRow, MIRROR_PREFIX } from "@/lib/mirror-order";
import {
  deleteTelegramMessage,
  ensureTowerSourceDeleteButton,
} from "@/lib/gvg-tower-notify.server";
import { drainBotMessages, setBotMessages } from "@/lib/gvg-bot-messages.server";
import { listTowerOrigins } from "@/lib/tower-origin.server";
import {
  renderTowerLine,
  renderTowerListText,
  TOWER_BREACHED_MARK,
  TOWERS_SITE_URL,
} from "@/lib/tower-origin";
import { CB_TOWER_ADD } from "@/lib/tower-form";

const CHAT_ID = -1003978316922;
const THREAD_ID = 8;
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
type TowerRow = {
  tower_id: string;
  nickname: string | null;
  screenshot_url: string | null;
  breached: boolean | null;
  removed: boolean;
  placed: boolean;
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
    .select("tower_id, nickname, screenshot_url, breached, removed, placed");
  if (error) {
    console.error("[tower-list] towers fetch failed", error.message);
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as TowerRow[];
  const filled = rows
    .filter(
      (r) => !isMirrorRow(r.tower_id) && r.placed && !r.removed && (r.nickname || r.screenshot_url),
    )
    .sort((a, b) => compareTowerIds(a.tower_id, b.tower_id));
  const ordered = rows
    .filter((r) => isMirrorRow(r.tower_id))
    .sort((a, b) => compareTowerIds(a.tower_id, b.tower_id));

  const origins = await listTowerOrigins();
  await Promise.all(
    origins.flatMap((origin) =>
      origin.source === "telegram" && origin.telegram_message_id
        ? [ensureTowerSourceDeleteButton(origin.telegram_message_id, origin.tower_id)]
        : [],
    ),
  );
  const lines: string[] = [];
  for (const r of filled) {
    lines.push(
      renderTowerLine(r.tower_id, r.nickname, origins, r.breached ? TOWER_BREACHED_MARK : ""),
    );
  }
  for (const r of ordered) {
    const realId = r.tower_id.slice(MIRROR_PREFIX.length);
    lines.push(renderTowerLine(realId, r.nickname, origins, " 🔴<b>замовив дзеркало</b>"));
  }

  const text = renderTowerListText(lines);

  const reply_markup = {
    inline_keyboard: [
      [{ text: "➕ Додати вежу", callback_data: CB_TOWER_ADD }],
      [{ text: "🌐 Перейти на сайт", url: TOWERS_SITE_URL }],
    ],
  };

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
      reply_markup,
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
  console.log(`[tower-list] deleting ${stale.length} stale bot messages`);
  for (const id of stale) {
    await deleteTelegramMessage(id);
  }
  // Single authoritative write so a stale read can never resurrect old ids.
  await setBotMessages([newId], "list");

  return { ok: true };
}
