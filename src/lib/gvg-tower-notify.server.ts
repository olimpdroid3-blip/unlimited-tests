// Sends a short technical message about a tower to the pinned Telegram topic.
import { listBotMessages, trackBotMessage } from "@/lib/gvg-bot-messages.server";
import {
  buildTowerDeleteCallback,
  buildTowerDeleteCancelCallback,
  buildTowerDeleteConfirmCallback,
} from "@/lib/tower-origin";

const CHAT_ID = -1003978316922;
const THREAD_ID = 8;

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function towerTelegramMessageLink(messageId: number): string {
  return `https://t.me/c/3978316922/${THREAD_ID}/${messageId}`;
}

/** Creates the permanent source post linked from the compact tower list button. */
export async function createTowerSourceMessage(input: {
  towerId: string;
  nickname: string;
  screenshotUrl: string | null;
  comment: string | null;
}): Promise<{ ok: boolean; messageId?: number; messageLink?: string; error?: string }> {
  const botToken = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
  if (!botToken) return { ok: false, error: "TELEGRAM_GVG_VIDEO_BOT_TOKEN is not configured" };

  const caption = [
    `🏰 <b>Вежа ${escapeHtml(input.towerId)}</b>`,
    `Код вежі: <code>${escapeHtml(input.towerId)}</code>`,
    `Нік: ${escapeHtml(input.nickname)}`,
    `Коментар: ${escapeHtml(input.comment || "немає")}`,
  ].join("\n");
  const method = input.screenshotUrl ? "sendPhoto" : "sendMessage";
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      message_thread_id: THREAD_ID,
      parse_mode: "HTML",
      disable_notification: true,
      ...(input.screenshotUrl
        ? { photo: input.screenshotUrl, caption }
        : { text: caption, disable_web_page_preview: true }),
      reply_markup: {
        inline_keyboard: [
          [{ text: "🗑 Видалити запис", callback_data: buildTowerDeleteCallback(input.towerId) }],
        ],
      },
    }),
  });
  const json = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };
  const messageId = json.result?.message_id;
  if (!json.ok || !messageId) {
    console.error(`[tower-source] ${method} failed [${response.status}] ${json.description ?? ""}`);
    return { ok: false, error: json.description ?? "telegram-error" };
  }
  return { ok: true, messageId, messageLink: towerTelegramMessageLink(messageId) };
}

/** Adds the delete control to an existing permanent source post. */
export async function ensureTowerSourceDeleteButton(
  messageId: number,
  towerId: string,
): Promise<void> {
  const botToken = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
  if (!botToken) return;
  const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🗑 Видалити запис", callback_data: buildTowerDeleteCallback(towerId) }],
        ],
      },
    }),
  });
  if (!response.ok) {
    console.error(`[tower-source] editMessageReplyMarkup failed [${response.status}]`);
  }
}

/** Replaces the delete button with an explicit yes/no confirmation. */
export async function showTowerSourceDeleteConfirmation(
  messageId: number,
  towerId: string,
): Promise<void> {
  const botToken = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
  if (!botToken) return;
  const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Так, видалити", callback_data: buildTowerDeleteConfirmCallback(towerId) },
            { text: "❌ Ні", callback_data: buildTowerDeleteCancelCallback(towerId) },
          ],
        ],
      },
    }),
  });
  if (!response.ok) {
    console.error(`[tower-source] confirmation markup failed [${response.status}]`);
  }
}

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

// Thread 4 keeps the short add/remove lines plus one pinned walkthrough-submit control.
const UPDATE_THREAD_ID = 4;

export async function notifyTowerUpdate(
  kind: "add" | "remove",
  towerId: string,
  nickname: string,
): Promise<{ ok: boolean; error?: string; messageId?: number | null }> {
  const token = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
  if (!token) return { ok: false, error: "TELEGRAM_GVG_VIDEO_BOT_TOKEN is not configured" };

  const reviewPin = await import("@/lib/gvg-pinned-review.server");
  await reviewPin.ensurePinnedReviewMessage();

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
 * Backwards-compatible alias: mirror orders are announced as a short update
 * line in thread 4.
 */
export async function notifyMirrorOrderToTelegram(
  nickname: string,
  towerId: string,
): Promise<{ ok: boolean; error?: string; messageId?: number }> {
  const res = await notifyTowerUpdate("add", towerId, nickname);
  return { ok: res.ok, error: res.error, messageId: res.messageId ?? undefined };
}

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
