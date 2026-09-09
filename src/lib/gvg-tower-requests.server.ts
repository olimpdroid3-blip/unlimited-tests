// Single source of truth for creating / closing a tower request ("дзеркало"),
// shared by the web form (MirrorOrderModal) and the Telegram workflow.
import { supabaseAdmin } from "@/lib/db.server";
import { mirrorRowId } from "@/lib/mirror-order";
import { deleteTelegramMessage, notifyTowerUpdate } from "@/lib/gvg-tower-notify.server";

const STATE_BUCKET = "defense-screenshots";
const META_PATH = "bot-state/tower-requests.json";

export type TowerRequestSource = "web" | "telegram";

export type TowerRequestMeta = {
  tower_id: string;
  nickname: string;
  screenshot_url: string | null;
  screenshot_path: string | null;
  comment: string | null;
  source: TowerRequestSource;
  telegram_user_id: number | null;
  telegram_message_id: number | null;
  created_at: string;
};

type MetaState = { requests: TowerRequestMeta[] };

// Storage reads go through a CDN cache; use a signed URL with cache busting.
async function readMeta(): Promise<MetaState> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(STATE_BUCKET)
      .createSignedUrl(META_PATH, 60);
    if (error || !data?.signedUrl) return { requests: [] };
    const res = await fetch(`${data.signedUrl}&_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { requests: [] };
    const parsed = (await res.json()) as MetaState;
    return { requests: Array.isArray(parsed.requests) ? parsed.requests : [] };
  } catch {
    return { requests: [] };
  }
}

async function writeMeta(state: MetaState): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(STATE_BUCKET)
    .upload(META_PATH, new Blob([JSON.stringify(state)], { type: "application/json" }), {
      upsert: true,
      contentType: "application/json",
    });
  if (error) console.error("[tower-requests] meta write failed", error.message);
}

export async function listTowerRequestMeta(): Promise<TowerRequestMeta[]> {
  return (await readMeta()).requests;
}

async function saveMeta(meta: TowerRequestMeta): Promise<void> {
  const state = await readMeta();
  state.requests = state.requests.filter((r) => r.tower_id !== meta.tower_id);
  state.requests.push(meta);
  await writeMeta(state);
}

async function dropMeta(towerId: string): Promise<TowerRequestMeta | null> {
  const state = await readMeta();
  const found = state.requests.find((r) => r.tower_id === towerId) ?? null;
  state.requests = state.requests.filter((r) => r.tower_id !== towerId);
  await writeMeta(state);
  return found;
}

export type CreateTowerRequestInput = {
  towerId: string;
  nickname: string;
  screenshotUrl?: string | null;
  screenshotPath?: string | null;
  comment?: string | null;
  source: TowerRequestSource;
  telegramUserId?: number | null;
};

export type CreateTowerRequestResult = {
  ok: boolean;
  telegramOk: boolean;
  messageId?: number | null;
  error?: string;
};

/**
 * Creates the mirror-order marker row (kept for backwards compatibility with
 * the existing site + "/+" list), stores the extra metadata separately and
 * posts a short update line in the update-only topic.
 *
 * The database write happens first, so a Telegram outage can never lose a
 * correctly submitted request.
 */
export async function createTowerRequest(
  input: CreateTowerRequestInput,
): Promise<CreateTowerRequestResult> {
  const towerId = input.towerId;
  const nickname = input.nickname.trim();
  if (!towerId || !nickname) return { ok: false, telegramOk: false, error: "invalid-input" };

  if (input.screenshotUrl || input.screenshotPath) {
    const { error } = await supabaseAdmin.from("towers").upsert({
      tower_id: towerId,
      screenshot_url: input.screenshotUrl ?? null,
      screenshot_path: input.screenshotPath ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error("[tower-requests] tower screenshot upsert failed", error.message);
  }

  const { error: markerError } = await supabaseAdmin.from("towers").upsert({
    tower_id: mirrorRowId(towerId),
    nickname,
    updated_at: new Date().toISOString(),
  });
  if (markerError) {
    console.error("[tower-requests] marker upsert failed", markerError.message);
    return { ok: false, telegramOk: false, error: markerError.message };
  }

  const notify = await notifyTowerUpdate("add", towerId, nickname).catch(() => ({
    ok: false as const,
    messageId: null,
  }));
  const messageId = notify.ok ? (notify.messageId ?? null) : null;

  if (messageId) {
    // The marker row keeps the bot message id so it can be removed later.
    await supabaseAdmin
      .from("towers")
      .update({ notes: `tg:${messageId}` })
      .eq("tower_id", mirrorRowId(towerId));
  }

  await saveMeta({
    tower_id: towerId,
    nickname,
    screenshot_url: input.screenshotUrl ?? null,
    screenshot_path: input.screenshotPath ?? null,
    comment: input.comment?.trim() || null,
    source: input.source,
    telegram_user_id: input.telegramUserId ?? null,
    telegram_message_id: messageId,
    created_at: new Date().toISOString(),
  });

  return { ok: true, telegramOk: notify.ok === true, messageId };
}

/**
 * Closes a request: deletes the update message, the marker row and the stored
 * metadata, then posts the "➖" update line.
 */
export async function removeTowerRequest(
  towerId: string,
): Promise<{ ok: boolean; existed: boolean }> {
  const markerId = mirrorRowId(towerId);
  const { data } = await supabaseAdmin
    .from("towers")
    .select("nickname, notes")
    .eq("tower_id", markerId)
    .maybeSingle();

  const meta = await dropMeta(towerId);
  if (!data && !meta) return { ok: true, existed: false };

  const messageId =
    Number(data?.notes?.match(/^tg:(\d+)$/)?.[1] ?? 0) || meta?.telegram_message_id || 0;
  if (messageId) await deleteTelegramMessage(messageId).catch(() => undefined);

  const { error } = await supabaseAdmin.from("towers").delete().eq("tower_id", markerId);
  if (error) console.error("[tower-requests] marker delete failed", error.message);

  const nickname = data?.nickname ?? meta?.nickname ?? "?";
  await notifyTowerUpdate("remove", towerId, nickname).catch(() => undefined);

  return { ok: !error, existed: true };
}
