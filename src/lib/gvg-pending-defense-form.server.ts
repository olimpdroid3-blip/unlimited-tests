import { supabaseAdmin } from "@/lib/db.server";
import { resolveAdminNickname } from "@/lib/tower-form";

export const REVIEW_CHAT_ID = -1003978316922;
export const REVIEW_THREAD_ID = 4;
export const REVIEW_BUTTON_TEXT = "📸 ДОДАТИ СКРІН І КОД";
export const REVIEW_CALLBACK = "defense-review:add";

const STATE_BUCKET = "defense-screenshots";
const STATE_DIR = "bot-state/pending-defense-forms";
const FORM_TTL_MS = 30 * 60 * 1000;
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

type Step = "screenshot" | "code" | "comment";
type Form = {
  id: string;
  chat_id: number;
  thread_id: number;
  user_id: number;
  nickname: string;
  step: Step;
  screenshot_url: string | null;
  screenshot_path: string | null;
  run_code: string | null;
  comment: string | null;
  bot_message_ids: number[];
  created_at: string;
  expires_at: string;
};

type TgPhotoSize = { file_id?: string; file_size?: number };
type TgMessage = {
  message_id?: number;
  chat?: { id?: number };
  message_thread_id?: number;
  from?: { id?: number };
  text?: string;
  photo?: TgPhotoSize[];
  document?: { file_id?: string; mime_type?: string };
};

type TgCallback = {
  id: string;
  data?: string;
  from?: { id?: number };
  message?: { chat?: { id?: number }; message_thread_id?: number };
};

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
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: T;
      description?: string;
    };
    if (!json.ok) console.error(`[pending-defense-form] ${method} failed [${res.status}] ${json.description ?? ""}`);
    return { ok: json.ok === true, result: json.result, description: json.description };
  } catch (error) {
    console.error(`[pending-defense-form] ${method} error`, error);
    return { ok: false };
  }
}

async function send(text: string): Promise<number | null> {
  const res = await tg<{ message_id?: number }>("sendMessage", {
    chat_id: REVIEW_CHAT_ID,
    message_thread_id: REVIEW_THREAD_ID,
    text,
    disable_notification: true,
    disable_web_page_preview: true,
  });
  return res.result?.message_id ?? null;
}

async function del(messageId: number): Promise<void> {
  await tg("deleteMessage", { chat_id: REVIEW_CHAT_ID, message_id: messageId });
}

function pathFor(form: Pick<Form, "user_id" | "id">): string {
  return `${STATE_DIR}/${form.user_id}__${form.id}.json`;
}

async function listStateNames(): Promise<string[]> {
  const { data, error } = await supabaseAdmin.storage.from(STATE_BUCKET).list(STATE_DIR, { limit: 200 });
  if (error) {
    console.error("[pending-defense-form] state list failed", error.message);
    return [];
  }
  return (data ?? []).map((item) => item.name).filter((name) => name.endsWith(".json"));
}

async function readState(name: string): Promise<Form | null> {
  const { data, error } = await supabaseAdmin.storage.from(STATE_BUCKET).download(`${STATE_DIR}/${name}`);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as Form;
  } catch {
    return null;
  }
}

async function saveState(form: Form): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(STATE_BUCKET)
    .upload(pathFor(form), new Blob([JSON.stringify(form)], { type: "application/json" }), {
      upsert: true,
      contentType: "application/json",
    });
  if (error) console.error("[pending-defense-form] state write failed", error.message);
}

async function dropState(form: Form): Promise<void> {
  await supabaseAdmin.storage.from(STATE_BUCKET).remove([pathFor(form)]);
}

async function cleanupBotMessages(form: Form): Promise<void> {
  for (const id of [...new Set(form.bot_message_ids)]) {
    if (id > 0) await del(id);
  }
}

async function removeScreenshot(form: Form): Promise<void> {
  if (form.screenshot_path) await supabaseAdmin.storage.from(STATE_BUCKET).remove([form.screenshot_path]);
}

async function expire(form: Form): Promise<void> {
  await cleanupBotMessages(form);
  await removeScreenshot(form);
  await dropState(form);
}

async function findForm(userId: number): Promise<Form | null> {
  const names = (await listStateNames()).filter((name) => name.startsWith(`${userId}__`));
  const active: Form[] = [];

  for (const name of names) {
    const form = await readState(name);
    if (!form) continue;
    if (new Date(form.expires_at).getTime() <= Date.now()) {
      await expire(form);
      continue;
    }
    active.push(form);
  }

  if (active.length === 0) return null;

  // Storage listing order is not guaranteed. If an older duplicate form is
  // returned first, the conversation can jump backwards from "code" to
  // "screenshot". Always keep the newest form and purge every older active
  // duplicate for this Telegram user.
  active.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const [latest, ...duplicates] = active;
  for (const duplicate of duplicates) await expire(duplicate);
  return latest ?? null;
}

async function trackPrompt(form: Form, text: string): Promise<Form> {
  const messageId = await send(text);
  const next = messageId ? { ...form, bot_message_ids: [...form.bot_message_ids, messageId] } : form;
  await saveState(next);
  return next;
}

function pickFileId(message: TgMessage): string | null {
  const photos = message.photo ?? [];
  if (photos.length > 0) return photos[photos.length - 1]?.file_id ?? null;
  if (message.document?.file_id && (message.document.mime_type ?? "").startsWith("image/")) {
    return message.document.file_id;
  }
  return null;
}

async function storePhoto(fileId: string): Promise<{ url: string; path: string } | null> {
  const info = await tg<{ file_path?: string }>("getFile", { file_id: fileId });
  const filePath = info.result?.file_path;
  if (!filePath) return null;
  const res = await fetch(`https://api.telegram.org/file/bot${token()}/${filePath}`);
  if (!res.ok) return null;
  const bytes = await res.arrayBuffer();
  const ext = (filePath.split(".").pop() ?? "jpg").toLowerCase().replace("jpeg", "jpg");
  const contentType = ext === "png" ? "image/png" : "image/jpeg";
  const path = `pending-defense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(STATE_BUCKET)
    .upload(path, new Blob([bytes], { type: contentType }), { contentType, upsert: true });
  if (error) return null;
  const { data, error: signedError } = await supabaseAdmin.storage.from(STATE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (signedError || !data?.signedUrl) return null;
  return { url: data.signedUrl, path };
}

export async function startPendingDefenseForm(userId: number): Promise<void> {
  const member = await tg<{ status?: string; custom_title?: string }>("getChatMember", {
    chat_id: REVIEW_CHAT_ID,
    user_id: userId,
  });
  const resolved = resolveAdminNickname(member.ok ? member.result : null);
  if (!resolved.ok) {
    const warningId = await send(resolved.error);
    if (warningId) setTimeout(() => void del(warningId), 15_000);
    return;
  }

  const existing = await findForm(userId);
  if (existing) await expire(existing);

  const now = Date.now();
  let form: Form = {
    id: `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    chat_id: REVIEW_CHAT_ID,
    thread_id: REVIEW_THREAD_ID,
    user_id: userId,
    nickname: resolved.nickname,
    step: "screenshot",
    screenshot_url: null,
    screenshot_path: null,
    run_code: null,
    comment: null,
    bot_message_ids: [],
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + FORM_TTL_MS).toISOString(),
  };
  await saveState(form);
  form = await trackPrompt(form, `👤 ${form.nickname}\n📸 Надішліть скріншот проходки`);
}

export async function handlePendingDefenseCallback(callback: TgCallback): Promise<boolean> {
  if (callback.data !== REVIEW_CALLBACK) return false;
  const chatId = callback.message?.chat?.id;
  const threadId = callback.message?.message_thread_id ?? 0;
  const userId = callback.from?.id;
  await tg("answerCallbackQuery", { callback_query_id: callback.id });
  if (chatId !== REVIEW_CHAT_ID || threadId !== REVIEW_THREAD_ID || !userId) return true;
  await startPendingDefenseForm(userId);
  return true;
}

export async function handlePendingDefenseMessage(message: TgMessage): Promise<boolean> {
  if (message.chat?.id !== REVIEW_CHAT_ID || (message.message_thread_id ?? 0) !== REVIEW_THREAD_ID || !message.from?.id) {
    return false;
  }
  let form = await findForm(message.from.id);
  if (!form) return false;

  if (form.step === "screenshot") {
    const fileId = pickFileId(message);
    if (!fileId) {
      await trackPrompt(form, "❌ Потрібен скріншот. Надішліть зображення.");
      return true;
    }
    const stored = await storePhoto(fileId);
    if (!stored) {
      await trackPrompt(form, "❌ Не вдалося завантажити скріншот. Спробуйте ще раз.");
      return true;
    }
    form = { ...form, screenshot_url: stored.url, screenshot_path: stored.path, step: "code" };
    await saveState(form);
    await trackPrompt(form, "🔑 Надішліть код проходки");
    return true;
  }

  const text = (message.text ?? "").trim();
  if (!text) {
    await trackPrompt(form, form.step === "code" ? "❌ Надішліть код текстом." : "❌ Надішліть коментар текстом.");
    return true;
  }

  if (form.step === "code") {
    form = { ...form, run_code: text, step: "comment" };
    await saveState(form);
    await trackPrompt(form, "💬 Додайте коментар");
    return true;
  }

  form = { ...form, comment: text };
  await saveState(form);
  const { error } = await supabaseAdmin.from("pending_defenses").insert({
    screenshot_url: form.screenshot_url,
    run_code: form.run_code,
    comment: form.comment,
    submitted_nickname: form.nickname,
    telegram_user_id: form.user_id,
    telegram_chat_id: form.chat_id,
    telegram_thread_id: form.thread_id,
    source_form_id: form.id,
  });
  if (error) {
    console.error("[pending-defense-form] pending insert failed", error.message);
    await trackPrompt(form, "❌ Не вдалося передати проходку на сайт. Спробуйте ще раз пізніше.");
    return true;
  }

  await cleanupBotMessages(form);
  await dropState(form);
  return true;
}
