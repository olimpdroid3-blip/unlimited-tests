// Keeps a single pinned control panel (inline buttons only) in one forum topic.
import { supabaseAdmin } from "@/lib/db.server";
import { buildTowerPanelKeyboard } from "@/lib/tower-form";

export const PIN_CHAT_ID = -1003978316922;
export const PIN_THREAD_ID = 8;
export const TOWERS_URL = "https://unlimited-tests.lovable.app/towers";

// Telegram requires non-empty text; keep it to a single glyph so the pinned
// panel is just the three buttons.
const PIN_TEXT = "🏰";

type PinState = { chat_id: number; thread_id: number; message_id: number; updated_at: string };


function api(path: string): string {
  const token = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_GVG_VIDEO_BOT_TOKEN is not configured");
  return `https://api.telegram.org/bot${token}/${path}`;
}

async function call(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; description?: string; result?: Record<string, unknown> }> {
  const res = await fetch(api(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: Record<string, unknown>;
  };
  if (!json.ok) {
    console.error(`[gvg-pin] ${method} failed [${res.status}] ${json.description ?? "unknown"}`);
  }
  return { ok: json.ok === true, description: json.description ?? "", result: json.result };
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

async function writeState(state: PinState): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(STATE_BUCKET)
    .upload(STATE_PATH, new Blob([JSON.stringify(state)], { type: "application/json" }), {
      upsert: true,
      contentType: "application/json",
    });
  if (error) console.error("[gvg-pin] state write failed", error.message);
}

const keyboard = { inline_keyboard: [[{ text: BUTTON_TEXT, url: TOWERS_URL }]] };

/** Returns true when the stored message still exists in the topic. */
async function messageExists(messageId: number): Promise<boolean> {
  const res = await call("editMessageReplyMarkup", {
    chat_id: PIN_CHAT_ID,
    message_id: messageId,
    reply_markup: keyboard,
  });
  if (res.ok) return true;
  const d = (res.description ?? "").toLowerCase();
  // "message is not modified" means the message is alive and already correct.
  return d.includes("not modified");
}

async function pin(messageId: number): Promise<void> {
  await call("pinChatMessage", {
    chat_id: PIN_CHAT_ID,
    message_id: messageId,
    disable_notification: true,
  });
}

let lastCheck = 0;

/**
 * Ensures the topic has a pinned message with the towers button.
 * Recreates and re-pins it when the message was deleted.
 */
export async function ensurePinnedTowersMessage(
  force = false,
): Promise<{ action: string; message_id: number | null }> {
  const now = Date.now();
  if (!force && now - lastCheck < 5 * 60 * 1000) {
    return { action: "skipped-throttled", message_id: null };
  }
  lastCheck = now;

  const state = await readState();
  if (state?.message_id && (await messageExists(state.message_id))) {
    await pin(state.message_id);
    return { action: "kept", message_id: state.message_id };
  }

  const sent = await call("sendMessage", {
    chat_id: PIN_CHAT_ID,
    message_thread_id: PIN_THREAD_ID,
    text: PIN_TEXT,
    disable_web_page_preview: true,
    reply_markup: keyboard,
  });
  const messageId = (sent.result?.["message_id"] as number | undefined) ?? null;
  if (!messageId) return { action: "send-failed", message_id: null };

  await pin(messageId);
  await writeState({
    chat_id: PIN_CHAT_ID,
    thread_id: PIN_THREAD_ID,
    message_id: messageId,
    updated_at: new Date().toISOString(),
  });
  return { action: "created", message_id: messageId };
}
