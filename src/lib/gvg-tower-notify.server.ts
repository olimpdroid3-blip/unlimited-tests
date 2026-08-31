// Sends a short technical message about a tower to the pinned Telegram topic.
import { trackBotMessage } from "@/lib/gvg-bot-messages.server";

const CHAT_ID = -1003978316922;
const THREAD_ID = 8;

export async function notifyTowerToTelegram(
  nickname: string,
  towerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
  if (!token) return { ok: false, error: "TELEGRAM_GVG_VIDEO_BOT_TOKEN is not configured" };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      message_thread_id: THREAD_ID,
      text: `🏰 Вежа ${towerId} — ${nickname}`,
      disable_notification: true,
      disable_web_page_preview: true,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };
  if (!json.ok) {
    console.error(`[tower-notify] sendMessage failed [${res.status}] ${json.description ?? ""}`);
    return { ok: false, error: json.description ?? "telegram-error" };
  }
  if (json.result?.message_id) await trackBotMessage(json.result.message_id, "tower");
  return { ok: true };
}

// Mirror order notification. Telegram does not support arbitrary text colors,
// so the "замовив дзеркало" part is emphasised in bold with a red marker.
export async function notifyMirrorOrderToTelegram(
  nickname: string,
  towerId: string,
): Promise<{ ok: boolean; error?: string; messageId?: number }> {
  const token = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
  if (!token) return { ok: false, error: "TELEGRAM_GVG_VIDEO_BOT_TOKEN is not configured" };

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      message_thread_id: THREAD_ID,
      parse_mode: "HTML",
      text: `🏰 Вежа ${escape(towerId)} — ${escape(nickname)} 🔴<b>замовив дзеркало</b>`,
      disable_notification: true,
      disable_web_page_preview: true,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };
  if (!json.ok) {
    console.error(`[mirror-notify] sendMessage failed [${res.status}] ${json.description ?? ""}`);
    return { ok: false, error: json.description ?? "telegram-error" };
  }
  if (json.result?.message_id) await trackBotMessage(json.result.message_id, "mirror");
  return { ok: true, messageId: json.result?.message_id };
}

// Deletes a bot message (e.g. a mirror-order notification) from the pinned topic.
export async function deleteTelegramMessage(
  messageId: number,
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
  if (!token) return { ok: false, error: "TELEGRAM_GVG_VIDEO_BOT_TOKEN is not configured" };

  const res = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, message_id: messageId }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!json.ok) {
    console.error(`[tg-delete] deleteMessage failed [${res.status}] ${json.description ?? ""}`);
    return { ok: false, error: json.description ?? "telegram-error" };
  }
  return { ok: true };
}
