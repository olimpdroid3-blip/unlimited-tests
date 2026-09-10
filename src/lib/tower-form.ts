// Pure, dependency-free logic for the Telegram "➕ Додати" tower workflow.
// Kept out of *.server.ts so it can be unit tested without network/env.

export const TOWER_CHAT_ID = -1003978316922;
/** Main working topic: reply keyboard, forms, tower list. */
export const TOWER_WORK_THREAD_ID = 8;
/** Update-only topic: short "➕/➖ Вежа ..." lines and nothing else. */
export const TOWER_UPDATE_THREAD_ID = 4;

export const BTN_ADD = "➕ Додати";
export const BTN_LIST = "🏰 Всі вежі";
export const BTN_MIRRORS = "Вежі — Дзеркала";

/** Callback data of the pinned inline control panel. */
export const CB_TOWER_ADD = "tower:add";
export const CB_TOWER_LIST = "tower:list";



/**
 * The permanent tower control panel: three inline buttons in one row.
 * Telegram may wrap them on narrow screens — that is acceptable.
 */
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

/**
 * Reply-keyboard buttons survive on the chat level, so every handler must
 * verify the exact chat AND topic before doing anything.
 */
export function isTowerWorkflowThread(chatId: number, threadId: number | null): boolean {
  return chatId === TOWER_CHAT_ID && (threadId ?? 0) === TOWER_WORK_THREAD_ID;
}

/** Thread 4 is notification-only: it never accepts commands or form input. */
export function isUpdateOnlyThread(chatId: number, threadId: number | null): boolean {
  return chatId === TOWER_CHAT_ID && (threadId ?? 0) === TOWER_UPDATE_THREAD_ID;
}

export type ChatMemberInfo = { status?: string; custom_title?: string | null } | null | undefined;

export const NOT_ADMIN_TEXT = "⛔ Додавання вежі доступне лише адміністраторам групи.";
export const NO_TITLE_TEXT =
  "⛔ Для вашого акаунта не задано ігровий нік (custom title в групі). Зверніться до власника групи.";

/** The game nickname comes only from the admin custom_title — never username. */
export function resolveAdminNickname(
  member: ChatMemberInfo,
): { ok: true; nickname: string } | { ok: false; error: string } {
  const status = member?.status ?? "";
  if (status !== "administrator" && status !== "creator") {
    return { ok: false, error: NOT_ADMIN_TEXT };
  }
  const title = (member?.custom_title ?? "").trim();
  if (!title) return { ok: false, error: NO_TITLE_TEXT };
  return { ok: true, nickname: title };
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
