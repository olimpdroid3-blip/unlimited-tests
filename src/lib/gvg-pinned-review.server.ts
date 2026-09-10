import { supabaseAdmin } from "@/lib/db.server";
import { REVIEW_CALLBACK, REVIEW_BUTTON_TEXT, REVIEW_CHAT_ID, REVIEW_THREAD_ID } from "@/lib/gvg-pending-defense-form.server";

const PIN_TEXT = "📸 ДОДАТИ ПРОХОДКУ НА ПЕРЕВІРКУ";
const STATE_BUCKET = "defense-screenshots";
const STATE_PATH = "bot-state/pinned-pending-defense.json";

type PinState = { message_id: number; updated_at: string };

function token(): string {
  const value = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
  if (!value) throw new Error("TELEGRAM_GVG_VIDEO_BOT_TOKEN is not configured");
  return value;
}

async function tg<T = Record<string, unknown>>(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; result?: T; description?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
    return { ok: json.ok === true, result: json.result, description: json.description };
  } catch (error) {
    console.error("[pending-defense-pin] Telegram error", error);
    return { ok: false };
  }
}

async function readState(): Promise<PinState | null> {
  const { data, error } = await supabaseAdmin.storage.from(STATE_BUCKET).download(STATE_PATH);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as PinState;
  } catch {
    return null;
  }
}

async function writeState(messageId: number): Promise<void> {
  await supabaseAdmin.storage.from(STATE_BUCKET).upload(
    STATE_PATH,
    new Blob([JSON.stringify({ message_id: messageId, updated_at: new Date().toISOString() })], { type: "application/json" }),
    { upsert: true, contentType: "application/json" },
  );
}

const markup = {
  inline_keyboard: [[{ text: REVIEW_BUTTON_TEXT, callback_data: REVIEW_CALLBACK }]],
};

async function updateExisting(messageId: number): Promise<boolean> {
  const edited = await tg("editMessageText", {
    chat_id: REVIEW_CHAT_ID,
    message_id: messageId,
    text: PIN_TEXT,
    reply_markup: markup,
    disable_web_page_preview: true,
  });
  if (edited.ok || (edited.description ?? "").toLowerCase().includes("not modified")) {
    await tg("pinChatMessage", { chat_id: REVIEW_CHAT_ID, message_id: messageId, disable_notification: true });
    return true;
  }
  return false;
}

let lastCheck = 0;

export async function ensurePinnedReviewMessage(force = false): Promise<{ action: string; message_id: number | null }> {
  const now = Date.now();
  if (!force && now - lastCheck < 5 * 60 * 1000) return { action: "skipped-throttled", message_id: null };
  lastCheck = now;

  const state = await readState();
  if (state?.message_id && (await updateExisting(state.message_id))) {
    return { action: "kept", message_id: state.message_id };
  }

  const sent = await tg<{ message_id?: number }>("sendMessage", {
    chat_id: REVIEW_CHAT_ID,
    message_thread_id: REVIEW_THREAD_ID,
    text: PIN_TEXT,
    reply_markup: markup,
    disable_notification: true,
    disable_web_page_preview: true,
  });
  const messageId = sent.result?.message_id ?? null;
  if (!messageId) return { action: "send-failed", message_id: null };
  await tg("pinChatMessage", { chat_id: REVIEW_CHAT_ID, message_id: messageId, disable_notification: true });
  await writeState(messageId);
  return { action: "created", message_id: messageId };
}
