// Telegram step-by-step "➕ Додати" workflow for the towers working topic.
// State lives in Supabase Storage (same pattern as the other bot state files),
// so a restarted server never loses an in-progress form.
import { supabaseAdmin } from "@/lib/db.server";
import { normalizeTowerId } from "@/lib/mirror-order";
import { upsertPlacedTower } from "@/lib/gvg-tower-requests.server";
import { handleTowerListCommand } from "@/lib/gvg-tower-list.server";
import {
  BAD_POSITION_TEXT,
  BTN_ADD,
  BTN_LIST,
  buildSummary,
  canConfirm,
  CB_TOWER_ADD,
  CB_TOWER_LIST,
  CANCELLED_TEXT,
  collectFormMessageIds,
  FORM_TTL_MS,
  isFormExpired,
  isTowerWorkflowThread,
  NEED_PHOTO_TEXT,
  resolveAdminNickname,
  STEP_COMMENT_TEXT,
  STEP_POSITION_TEXT,
  STEP_SCREENSHOT_TEXT,
  TOWER_CHAT_ID,
  BTN_MIRROR_KB,
  BTN_MIRRORS,
  TOWER_REPLY_KEYBOARD,

  TOWER_WORK_THREAD_ID,
  type TowerForm,
} from "@/lib/tower-form";

const STATE_BUCKET = "defense-screenshots";
// One state object per workflow, so parallel forms never clash.
const STATE_DIR = "bot-state/tower-forms";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

/* ---------------- Telegram API ---------------- */

function token(): string {
  const t = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
  if (!t) throw new Error("TELEGRAM_GVG_VIDEO_BOT_TOKEN is not configured");
  return t;
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
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: T;
      description?: string;
    };
    if (!json.ok) {
      console.error(`[tower-form] ${method} failed [${res.status}] ${json.description ?? ""}`);
    }
    return { ok: json.ok === true, result: json.result, description: json.description };
  } catch (e) {
    console.error(`[tower-form] ${method} error`, e);
    return { ok: false };
  }
}

async function send(
  chatId: number,
  text: string,
  markup?: Record<string, unknown>,
): Promise<number | null> {
  const res = await tg<{ message_id?: number }>("sendMessage", {
    chat_id: chatId,
    message_thread_id: TOWER_WORK_THREAD_ID,
    text,
    disable_notification: true,
    disable_web_page_preview: true,
    ...(markup ? { reply_markup: markup } : {}),
  });
  return res.result?.message_id ?? null;
}

async function del(chatId: number, messageId: number): Promise<void> {
  await tg("deleteMessage", { chat_id: chatId, message_id: messageId });
}

async function answer(callbackId: string, text?: string): Promise<void> {
  await tg("answerCallbackQuery", { callback_query_id: callbackId, text: text ?? "" });
}

/* ---------------- State ----------------
 * One JSON object per workflow: bot-state/tower-forms/<user_id>__<form_id>.json
 * Two admins filling the form at the same time write different objects, so
 * concurrent workflows can never overwrite each other.
 */

function formPath(form: Pick<TowerForm, "id" | "user_id">): string {
  return `${STATE_DIR}/${form.user_id}__${form.id}.json`;
}

async function listFormFiles(): Promise<string[]> {
  const { data, error } = await supabaseAdmin.storage.from(STATE_BUCKET).list(STATE_DIR, {
    limit: 200,
  });
  if (error) {
    console.error("[tower-form] state list failed", error.message);
    return [];
  }
  return (data ?? []).map((f) => f.name).filter((n) => n.endsWith(".json"));
}

async function readFormFile(name: string): Promise<TowerForm | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(STATE_BUCKET)
      .createSignedUrl(`${STATE_DIR}/${name}`, 60);
    if (error || !data?.signedUrl) return null;
    const res = await fetch(`${data.signedUrl}&_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const parsed = (await res.json()) as TowerForm;
    return parsed && typeof parsed.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}

async function saveForm(form: TowerForm): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(STATE_BUCKET)
    .upload(formPath(form), new Blob([JSON.stringify(form)], { type: "application/json" }), {
      upsert: true,
      contentType: "application/json",
    });
  if (error) console.error("[tower-form] state write failed", error.message);
}

async function dropForm(form: Pick<TowerForm, "id" | "user_id">): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(STATE_BUCKET).remove([formPath(form)]);
  if (error) console.error("[tower-form] state remove failed", error.message);
}

/**
 * TTL auto-cancel: an abandoned form is treated exactly like "❌ Скасувати" —
 * its own screenshot and its own messages are removed, then the state file.
 * Nothing outside that single workflow is touched.
 */
async function expireForm(form: TowerForm): Promise<void> {
  await removeUploadedScreenshot(form);
  for (const id of collectFormMessageIds(form)) {
    await del(form.chat_id, id);
  }
  await dropForm(form);
}

/** Reads every live form, auto-cancelling expired ones on the way. */
async function loadForms(): Promise<TowerForm[]> {
  const names = await listFormFiles();
  const live: TowerForm[] = [];
  for (const name of names) {
    const form = await readFormFile(name);
    if (!form) continue;
    if (isFormExpired(form)) {
      await expireForm(form);
      continue;
    }
    live.push(form);
  }
  return live;
}

async function findFormByUser(userId: number): Promise<TowerForm | null> {
  const names = (await listFormFiles()).filter((n) => n.startsWith(`${userId}__`));
  for (const name of names) {
    const form = await readFormFile(name);
    if (!form) continue;
    if (isFormExpired(form)) {
      await expireForm(form);
      continue;
    }
    return form;
  }
  return null;
}

async function findFormById(shortId: string): Promise<TowerForm | null> {
  const names = (await listFormFiles()).filter((n) => n.includes(`__${shortId}`));
  for (const name of names) {
    const form = await readFormFile(name);
    if (!form) continue;
    if (isFormExpired(form)) {
      await expireForm(form);
      continue;
    }
    if (form.id.startsWith(shortId)) return form;
  }
  return null;
}

/** Best-effort sweep so abandoned forms never linger in Storage. */
async function sweepExpiredForms(): Promise<void> {
  await loadForms();
}

/* ---------------- Helpers ---------------- */

function keyboardFor(step: TowerForm["step"], shortId: string): Record<string, unknown> {
  const cancel = { text: "❌ Скасувати", callback_data: `tw|x|${shortId}` };
  if (step === "comment") {
    return {
      inline_keyboard: [[{ text: "Пропустити", callback_data: `tw|sk|${shortId}` }], [cancel]],
    };
  }
  if (step === "confirm") {
    return {
      inline_keyboard: [[{ text: "✅ Додати", callback_data: `tw|ok|${shortId}` }], [cancel]],
    };
  }
  return { inline_keyboard: [[cancel]] };
}

async function trackBot(form: TowerForm, messageId: number | null): Promise<TowerForm> {
  if (!messageId) return form;
  const next = { ...form, bot_message_ids: [...form.bot_message_ids, messageId] };
  await saveForm(next);
  return next;
}

async function trackUser(form: TowerForm, messageId: number | undefined): Promise<TowerForm> {
  if (!messageId) return form;
  const next = { ...form, user_message_ids: [...form.user_message_ids, messageId] };
  await saveForm(next);
  return next;
}

/** Deletes every message this workflow produced and forgets the form. */
async function wipeForm(form: TowerForm): Promise<void> {
  for (const id of collectFormMessageIds(form)) {
    await del(form.chat_id, id);
  }
  await dropForm(form);
}

async function removeUploadedScreenshot(form: TowerForm): Promise<void> {
  if (!form.screenshot_path) return;
  const { error } = await supabaseAdmin.storage.from(STATE_BUCKET).remove([form.screenshot_path]);
  if (error) console.error("[tower-form] screenshot cleanup failed", error.message);
}

/* ---------------- Photo intake ---------------- */

type TgPhotoSize = { file_id?: string; file_size?: number };

function pickFileId(message: {
  photo?: TgPhotoSize[];
  document?: { file_id?: string; mime_type?: string };
}): string | null {
  const photos = message.photo ?? [];
  if (photos.length) return photos[photos.length - 1]?.file_id ?? null;
  const doc = message.document;
  if (doc?.file_id && (doc.mime_type ?? "").startsWith("image/")) return doc.file_id;
  return null;
}

async function storeTelegramPhoto(
  fileId: string,
): Promise<{ url: string | null; path: string } | null> {
  const info = await tg<{ file_path?: string }>("getFile", { file_id: fileId });
  const filePath = info.result?.file_path;
  if (!filePath) return null;

  const res = await fetch(`https://api.telegram.org/file/bot${token()}/${filePath}`);
  if (!res.ok) {
    console.error(`[tower-form] file download failed [${res.status}]`);
    return null;
  }
  const bytes = await res.arrayBuffer();
  const ext = (filePath.split(".").pop() ?? "jpg").toLowerCase().replace("jpeg", "jpg");
  const contentType = ext === "png" ? "image/png" : "image/jpeg";
  const path = `tower-tg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(STATE_BUCKET)
    .upload(path, new Blob([bytes], { type: contentType }), { contentType, upsert: true });
  if (error) {
    console.error("[tower-form] screenshot upload failed", error.message);
    return null;
  }
  const { data: signed } = await supabaseAdmin.storage
    .from(STATE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  return { url: signed?.signedUrl ?? null, path };
}

/* ---------------- Workflow ---------------- */

/**
 * Starts the step-by-step add form. Called both from the (legacy) reply
 * keyboard text button and from the pinned inline panel, where there is no
 * trigger message to clean up.
 */
export async function startTowerForm(
  chatId: number,
  userId: number,
  triggerMessageId?: number,
): Promise<void> {

  const member = await tg<{ status?: string; custom_title?: string }>("getChatMember", {
    chat_id: chatId,
    user_id: userId,
  });
  const resolved = resolveAdminNickname(member.ok ? member.result : null);
  if (!resolved.ok) {
    const warnId = await send(chatId, resolved.error);

    // Keep the topic tidy: the refusal and the tap disappear shortly after.
    if (triggerMessageId) await del(chatId, triggerMessageId);
    if (warnId) setTimeout(() => void del(chatId, warnId), 15_000);
    return;
  }

  // One active form per user: restart cleanly if an old one is around.
  const existing = await findFormByUser(userId);
  if (existing) {
    await removeUploadedScreenshot(existing);
    await wipeForm(existing);
  }

  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  let form: TowerForm = {
    id,
    chat_id: chatId,
    thread_id: TOWER_WORK_THREAD_ID,
    user_id: userId,
    nickname: resolved.nickname,
    step: "position",
    tower_id: null,
    screenshot_url: null,
    screenshot_path: null,
    comment: null,
    bot_message_ids: [],
    user_message_ids: triggerMessageId ? [triggerMessageId] : [],
    submitted: false,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + FORM_TTL_MS).toISOString(),
  };
  await saveForm(form);

  // Greeting confirms whose form it is; the next message carries the step
  // prompt with its inline "Скасувати" button.
  const greetId = await send(chatId, `👤 ${resolved.nickname}`);
  form = await trackBot(form, greetId);

  const promptId = await send(chatId, STEP_POSITION_TEXT, keyboardFor("position", id.slice(0, 8)));
  await trackBot(form, promptId);
}

async function askScreenshot(form: TowerForm): Promise<void> {
  const id = await send(form.chat_id, STEP_SCREENSHOT_TEXT, keyboardFor("screenshot", form.id.slice(0, 8)));
  await trackBot(form, id);
}

async function askComment(form: TowerForm): Promise<void> {
  const id = await send(form.chat_id, STEP_COMMENT_TEXT, keyboardFor("comment", form.id.slice(0, 8)));
  await trackBot(form, id);
}

async function askConfirm(form: TowerForm): Promise<void> {
  const id = await send(form.chat_id, buildSummary(form), keyboardFor("confirm", form.id.slice(0, 8)));
  await trackBot(form, id);
}

/**
 * Handles a message inside the working topic.
 * Returns true when the message belonged to the tower workflow.
 */
export async function handleTowerWorkflowMessage(message: {
  message_id?: number;
  chat?: { id?: number };
  message_thread_id?: number;
  from?: { id?: number };
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  document?: { file_id?: string; mime_type?: string };
}): Promise<boolean> {
  const chatId = message.chat?.id;
  const userId = message.from?.id;
  if (!chatId || !userId) return false;
  if (!isTowerWorkflowThread(chatId, message.message_thread_id ?? null)) return false;

  const text = (message.text ?? "").trim();

  if (text === BTN_LIST) {
    if (message.message_id) await del(chatId, message.message_id);
    // Good moment to auto-cancel any abandoned form.
    await sweepExpiredForms();
    await handleTowerListCommand();
    return true;
  }

  if (text === BTN_ADD) {
    await startTowerForm(chatId, userId, message.message_id);
    return true;
  }

  let form = await findFormByUser(userId);
  if (!form) return false;

  form = await trackUser(form, message.message_id);

  if (form.step === "position") {
    const towerId = normalizeTowerId(text);
    if (!towerId) {
      const id = await send(chatId, BAD_POSITION_TEXT, keyboardFor("position", form.id.slice(0, 8)));
      await trackBot(form, id);
      return true;
    }
    form = { ...form, tower_id: towerId, step: "screenshot" };
    await saveForm(form);
    await askScreenshot(form);
    return true;
  }

  if (form.step === "screenshot") {
    const fileId = pickFileId(message);
    if (!fileId) {
      const id = await send(chatId, NEED_PHOTO_TEXT, keyboardFor("screenshot", form.id.slice(0, 8)));
      await trackBot(form, id);
      return true;
    }
    const stored = await storeTelegramPhoto(fileId);
    if (!stored) {
      const id = await send(
        chatId,
        "❌ Не вдалося зберегти скріншот. Спробуйте ще раз.",
        keyboardFor("screenshot", form.id.slice(0, 8)),
      );
      await trackBot(form, id);
      return true;
    }
    form = {
      ...form,
      screenshot_url: stored.url,
      screenshot_path: stored.path,
      step: "comment",
    };
    await saveForm(form);
    await askComment(form);
    return true;
  }

  if (form.step === "comment") {
    form = { ...form, comment: text.slice(0, 500) || null, step: "confirm" };
    await saveForm(form);
    await askConfirm(form);
    return true;
  }

  return true;
}

async function submitForm(form: TowerForm): Promise<void> {
  const marked: TowerForm = { ...form, submitted: true };
  await saveForm(marked);

  // "➕ Додати" in Telegram means: this tower is actually ON TEST now.
  // It writes the normal towers row, never a mirror ("M:") request.
  const result = await upsertPlacedTower({
    towerId: marked.tower_id!,
    nickname: marked.nickname,
    screenshotUrl: marked.screenshot_url,
    screenshotPath: marked.screenshot_path,
    comment: marked.comment,
  });

  if (!result.ok) {
    const id = await send(
      marked.chat_id,
      "❌ Не вдалося зберегти вежу. Спробуйте ще раз.",
      keyboardFor("confirm", marked.id.slice(0, 8)),
    );
    await trackBot({ ...marked, submitted: false }, id);
    return;
  }

  // Fresh list first, then wipe the whole conversation of this form.
  await handleTowerListCommand();
  await wipeForm(marked);
}

/**
 * Handles the pinned panel buttons ("tower:add" / "tower:list") and the
 * workflow inline buttons (callback_data prefixed with "tw|").
 */
export async function handleTowerFormCallback(cb: {
  id: string;
  data?: string;
  from?: { id?: number };
  message?: { chat?: { id?: number }; message_thread_id?: number };
}): Promise<boolean> {
  const data = (cb.data ?? "").trim();

  if (data === CB_TOWER_ADD || data === CB_TOWER_LIST) {
    const panelChatId = cb.message?.chat?.id ?? null;
    // The pinned panel lives only in the towers chat.
    if (panelChatId !== TOWER_CHAT_ID) {
      await answer(cb.id);
      return true;
    }
    if (data === CB_TOWER_LIST) {
      await answer(cb.id);
      await sweepExpiredForms();
      await handleTowerListCommand();
      return true;
    }
    const userId = cb.from?.id;
    if (!userId) {
      await answer(cb.id);
      return true;
    }
    // Same workflow as the old reply-keyboard button, without a trigger message.
    await answer(cb.id);
    await startTowerForm(panelChatId, userId);
    return true;
  }

  const parts = data.split("|");
  if (parts[0] !== "tw") return false;

  const [, action, shortId] = parts;
  if (!shortId) {
    await answer(cb.id);
    return true;
  }

  const chatId = cb.message?.chat?.id ?? null;
  if (chatId !== null && !isTowerWorkflowThread(chatId, cb.message?.message_thread_id ?? null)) {
    await answer(cb.id);
    return true;
  }

  const form = await findFormById(shortId);
  if (!form) {
    await answer(cb.id, "Форма більше не активна");
    return true;
  }
  if (cb.from?.id && cb.from.id !== form.user_id) {
    await answer(cb.id, "Це не ваша форма");
    return true;
  }

  if (action === "x") {
    await answer(cb.id, CANCELLED_TEXT);
    await removeUploadedScreenshot(form);
    await wipeForm(form);
    return true;
  }

  if (action === "sk") {
    if (form.step !== "comment") {
      await answer(cb.id);
      return true;
    }
    await answer(cb.id, "Пропущено");
    const next: TowerForm = { ...form, comment: null, step: "confirm" };
    await saveForm(next);
    await askConfirm(next);
    return true;
  }

  if (action === "ok") {
    if (!canConfirm(form)) {
      await answer(cb.id, form.submitted ? "Вже додано" : "Форма не заповнена");
      return true;
    }
    await answer(cb.id, "Додано");
    await submitForm(form);
    return true;
  }

  await answer(cb.id);
  return true;
}

/**
 * Maintenance endpoint: makes sure the pinned inline panel exists and that the
 * bottom reply keyboard is present again. The keyboard rides on a fresh tower
 * list, so no throwaway service message is created.
 */
export async function installTowerKeyboard(): Promise<{ ok: boolean; message_id: number | null }> {
  const { ensurePinnedTowersMessage } = await import("@/lib/gvg-pinned-towers.server");
  const pinned = await ensurePinnedTowersMessage(true);

  await handleTowerListCommand();

  return { ok: pinned.message_id !== null, message_id: pinned.message_id };
}


