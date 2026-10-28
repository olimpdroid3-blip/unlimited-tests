// Pure, dependency-free logic for the Telegram "➕ Додати" tower workflow.
// Kept out of *.server.ts so it can be unit tested without network/env.

export const TOWER_CHAT_ID = -1003978316922;
/** Main working topic: forms, tower list, and pinned controls. */
export const TOWER_WORK_THREAD_ID = 8;
/** Topic 4: short tower updates only. */
export const TOWER_UPDATE_THREAD_ID = 4;
/** Topic 108: walkthrough screenshot review intake. */
export const WALKTHROUGH_REVIEW_THREAD_ID = 108;

export const BTN_ADD = "➕ Додати";
export const BTN_LIST = "🏰 Всі вежі";
export const BTN_MIRRORS = "Сайт";

/** Callback data of the pinned inline control panel. */
export const CB_TOWER_ADD = "tower:add";
export const CB_TOWER_LIST = "tower:list";

/** The permanent pinned tower control panel. */
export function buildTowerPanelKeyboard(towersUrl: string) {
  return {
    inline_keyboard: [
      [
        { text: BTN_ADD, callback_data: CB_TOWER_ADD },
        { text: BTN_LIST, callback_data: CB_TOWER_LIST },
        { text: BTN_MIRRORS, url: towersUrl },
      ],
    ],
  };
}

export const FORM_TTL_MS = 30 * 60 * 1000;

export type TowerFormStep = "position" | "screenshot" | "comment" | "confirm";

export type TowerForm = {
  id: string;
  chat_id: number;
  thread_id: number;
  user_id: number;
  nickname: string;
  step: TowerFormStep;
  tower_id: string | null;
  screenshot_url: string | null;
  screenshot_path: string | null;
  comment: string | null;
  bot_message_ids: number[];
  user_message_ids: number[];
  submitted: boolean;
  created_at: string;
  expires_at: string;
};

/** Every handler must verify the exact chat AND topic before doing anything. */
export function isTowerWorkflowThread(chatId: number, threadId: number | null): boolean {
  return chatId === TOWER_CHAT_ID && (threadId ?? 0) === TOWER_WORK_THREAD_ID;
}

/** Identifies topic 4, which must never accept workflow input. */
export function isUpdateOnlyThread(chatId: number, threadId: number | null): boolean {
  return chatId === TOWER_CHAT_ID && (threadId ?? 0) === TOWER_UPDATE_THREAD_ID;
}

/** Every walkthrough handler must verify this exact chat and topic. */
export function isWalkthroughReviewThread(chatId: number, threadId: number | null): boolean {
  return chatId === TOWER_CHAT_ID && (threadId ?? 0) === WALKTHROUGH_REVIEW_THREAD_ID;
}

export type ChatMemberInfo =
  | { status?: string; custom_title?: string | null; tag?: string | null }
  | null
  | undefined;

/** The actual message/callback actor, never the bot's callback message author. */
export type TowerActor = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export function isValidTowerActor(actor: TowerActor | null | undefined): actor is TowerActor & { id: number } {
  return typeof actor?.id === "number" && Number.isSafeInteger(actor.id) && actor.id > 0;
}

/** Role lookup enriches tower display names only; it never grants/denies entry. */
export function resolveTowerNickname(member: ChatMemberInfo, actor: TowerActor & { id: number }): string {
  const title = member?.status === "administrator" || member?.status === "creator"
    ? member.custom_title?.trim()
    : member?.status === "member" || member?.status === "restricted"
      ? member.tag?.trim()
      : undefined;
  if (title) return title;
  const username = actor.username?.trim().replace(/^@+/, "");
  if (username) return `@${username}`;
  const fullName = [actor.first_name?.trim(), actor.last_name?.trim()].filter(Boolean).join(" ");
  return fullName || `Telegram ${actor.id}`;
}

export const NOT_MEMBER_TEXT = "⛔ Ця форма доступна лише учасникам групи.";
export const NO_NICKNAME_TEXT =
  "⛔ Для вашого акаунта не задано ігровий нік у групі (тег учасника або титул адміністратора). Зверніться до власника групи.";

/**
 * Strict game nickname for the walkthrough form (not tower entry):
 * regular members → their Telegram member `tag`;
 * administrators/creator → their `custom_title`.
 * Never falls back to username / first_name / last_name.
 */
export function resolveMemberNickname(
  member: ChatMemberInfo,
): { ok: true; nickname: string } | { ok: false; error: string } {
  const status = member?.status ?? "";
  let nickname: string;
  if (status === "member") {
    nickname = (member?.tag ?? "").trim();
  } else if (status === "administrator" || status === "creator") {
    nickname = (member?.custom_title ?? "").trim();
  } else {
    return { ok: false, error: NOT_MEMBER_TEXT };
  }
  if (!nickname) return { ok: false, error: NO_NICKNAME_TEXT };
  return { ok: true, nickname };
}

export function isFormExpired(form: Pick<TowerForm, "expires_at">, now = Date.now()): boolean {
  return new Date(form.expires_at).getTime() <= now;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildSummary(form: TowerForm): string {
  return [
    "Перевірте дані:",
    `Вежа: ${escapeHtml(form.tower_id ?? "—")}`,
    `Нік: ${escapeHtml(form.nickname)}`,
    `Скріншот: ${form.screenshot_url || form.screenshot_path ? "✅" : "—"}`,
    `Коментар: ${form.comment ? escapeHtml(form.comment) : "немає"}`,
  ].join("\n");
}

/** Only the ids this workflow itself produced — never anyone else's messages. */
export function collectFormMessageIds(form: TowerForm): number[] {
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const id of [...form.bot_message_ids, ...form.user_message_ids]) {
    if (typeof id === "number" && id > 0 && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** Guards a double tap on "✅ Додати" from creating a duplicate request. */
export function canConfirm(form: TowerForm): boolean {
  return form.step === "confirm" && !form.submitted && !!form.tower_id && !!form.screenshot_path;
}

export const STEP_POSITION_TEXT = "Вкажіть позицію вежі";
export const STEP_SCREENSHOT_TEXT = "Надішліть скріншот";
export const STEP_COMMENT_TEXT = "Додайте коментар або натисніть «Пропустити»";
export const BAD_POSITION_TEXT =
  "❌ Невірна позиція. Формат: 1.1.1, 111, 1-1-1 або 1 1 1. Спробуйте ще раз.";
export const NEED_PHOTO_TEXT = "❌ Потрібен скріншот. Надішліть зображення.";
export const CANCELLED_TEXT = "Скасовано";
