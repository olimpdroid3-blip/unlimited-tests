// Sends a short technical message about a tower to the pinned Telegram topic.
import { listBotMessages, trackBotMessage } from "@/lib/gvg-bot-messages.server";

const CHAT_ID = -1003978316922;
const THREAD_ID = 8;

/** Removes the button from every older tracked bot message. */
export async function clearOldTowerButtons(exceptId?: number): Promise<void> {
  const token = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
  if (!token) return;
  const ids = await listBotMessages();
  for (const id of ids) {
    if (id === exceptId) continue;
    await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, message_id: id, reply_markup: {} }),
    }).catch(() => undefined);
  }
}


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
  if (json.result?.message_id) {
    await clearOldTowerButtons(json.result.message_id);
    await trackBotMessage(json.result.message_id, "tower");
  }
  return { ok: true };
}

// Thread 4 is the update-only topic: one short line per add/remove, no
// keyboards, no lists, no forms.
const UPDATE_THREAD_ID = 4;

export async function notifyTowerUpdate(
  kind: "add" | "remove",
  towerId: string,
  nickname: string,
): Promise<{ ok: boolean; error?: string; messageId?: number | null }> {
  const token = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
  if (!token) return { ok: false, error: "TELEGRAM_GVG_VIDEO_BOT_TOKEN is not configured" };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      message_thread_id: UPDATE_THREAD_ID,
      text: `${kind === "add" ? "➕" : "➖"} Вежа ${towerId} — ${nickname}`,
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
    console.error(`[tower-update] sendMessage failed [${res.status}] ${json.description ?? ""}`);
    return { ok: false, error: json.description ?? "telegram-error" };
  }
  return { ok: true, messageId: json.result?.message_id ?? null };
}

/**
 * Backwards-compatible alias: mirror orders are now announced as a short
 * update line in thread 4 instead of a message in the working topic.
 */
export async function notifyMirrorOrderToTelegram(
  nickname: string,
  towerId: string,
): Promise<{ ok: boolean; error?: string; messageId?: number }> {
  const res = await notifyTowerUpdate("add", towerId, nickname);
  return { ok: res.ok, error: res.error, messageId: res.messageId ?? undefined };
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
