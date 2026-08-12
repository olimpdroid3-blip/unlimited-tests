// Server-only logic for @gvg_video_index_bot: hero collection + notes flow.
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const MAX_NOTES = 2000;
const PENDING_TTL_MIN = 30;

type HeroRow = { id: string; name_en: string; name_ru: string };
type PendingRow = {
  id: string;
  telegram_chat_id: number;
  telegram_thread_id: number | null;
  telegram_user_id: number;
  video_message_id: number;
  video_row_id: string | null;
  status: string;
  confirmed_hero_ids: string[];
  unresolved_token: string | null;
  suggestion_hero_ids: string[];
  bot_message_ids?: number[] | null;
};

/* ---------------- Telegram API ---------------- */

function api(path: string): string {
  const token = process.env['TELEGRAM_GVG_VIDEO_BOT_TOKEN'];
  if (!token) throw new Error('TELEGRAM_GVG_VIDEO_BOT_TOKEN is not configured');
  return `https://api.telegram.org/bot${token}/${path}`;
}

export async function tgSend(
  chatId: number,
  threadId: number | null,
  text: string,
  keyboard?: { text: string; callback_data: string }[][],
): Promise<number | null> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (threadId) body['message_thread_id'] = threadId;
  if (keyboard) body['reply_markup'] = { inline_keyboard: keyboard };
  const res = await fetch(api('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`[gvg-video-bot] sendMessage failed [${res.status}] ${await res.text()}`);
    return null;
  }
  const json = (await res.json()) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };
  if (!json.ok) {
    console.error(`[gvg-video-bot] sendMessage rejected: ${json.description ?? 'unknown'}`);
    return null;
  }
  return json.result?.message_id ?? null;
}

/* --- intermediate bot messages: track then clean up --- */

async function trackBotMessage(pendingId: string, messageId: number | null): Promise<void> {
  if (!messageId) return;
  const { data, error } = await supabaseAdmin
    .from('telegram_video_pending_heroes')
    .select('bot_message_ids')
    .eq('id', pendingId)
    .maybeSingle();
  if (error) {
    console.error('[gvg-video-bot] track read failed', error.message);
    return;
  }
  const ids = ((data?.bot_message_ids as number[] | null) ?? []).slice();
  if (ids.includes(messageId)) return;
  ids.push(messageId);
  const { error: upErr } = await supabaseAdmin
    .from('telegram_video_pending_heroes')
    .update({ bot_message_ids: ids })
    .eq('id', pendingId);
  if (upErr) console.error('[gvg-video-bot] track write failed', upErr.message);
}

/** Send an intermediate bot message and remember it for later cleanup. */
async function tgSendTracked(
  p: PendingRow,
  text: string,
  keyboard?: { text: string; callback_data: string }[][],
): Promise<void> {
  const id = await tgSend(p.telegram_chat_id, p.telegram_thread_id, text, keyboard);
  await trackBotMessage(p.id, id);
}

async function tgDelete(chatId: number, messageId: number): Promise<void> {
  try {
    const res = await fetch(api('deleteMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
    if (!res.ok) {
      console.warn(`[gvg-video-bot] deleteMessage ${messageId} failed [${res.status}] ${await res.text()}`);
    }
  } catch (e) {
    console.warn('[gvg-video-bot] deleteMessage error', e);
  }
}

/** Remove all tracked intermediate bot messages of this workflow. */
async function cleanupBotMessages(pendingId: string, chatId: number): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('telegram_video_pending_heroes')
    .select('bot_message_ids')
    .eq('id', pendingId)
    .maybeSingle();
  if (error) {
    console.error('[gvg-video-bot] cleanup read failed', error.message);
    return;
  }
  const ids = (data?.bot_message_ids as number[] | null) ?? [];
  for (const id of ids) await tgDelete(chatId, id);
  await supabaseAdmin
    .from('telegram_video_pending_heroes')
    .update({ bot_message_ids: [] })
    .eq('id', pendingId);
}

/** Send the initial hero prompt for a freshly created pending row. */
export async function sendHeroPrompt(
  pendingId: string,
  chatId: number,
  threadId: number | null,
): Promise<void> {
  const id = await tgSend(chatId, threadId, HERO_PROMPT);
  await trackBotMessage(pendingId, id);
}

/** Resolve the uploader display name: admin custom_title wins, else username/first+last. */
export async function resolveUploader(
  chatId: number,
  user: { id?: number; username?: string; first_name?: string; last_name?: string } | undefined,
): Promise<{ userId: number | null; name: string | null; customTitle: string | null }> {
  if (!user?.id) return { userId: null, name: null, customTitle: null };

  let customTitle: string | null = null;
  try {
    const res = await fetch(api('getChatMember'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, user_id: user.id }),
    });
    if (res.ok) {
      const json = (await res.json()) as { ok?: boolean; result?: { custom_title?: string } };
      const t = json.ok ? json.result?.custom_title?.trim() : '';
      if (t) customTitle = t;
    } else {
      console.warn(`[gvg-video-bot] getChatMember failed [${res.status}]`);
    }
  } catch (e) {
    console.warn('[gvg-video-bot] getChatMember error', e);
  }

  // Only the Telegram admin custom_title may identify the uploader.
  // Never fall back to username / first_name / last_name.
  return { userId: user.id, name: customTitle ?? 'Невідомий автор', customTitle };
}

async function tgAnswerCallback(callbackId: string, text?: string): Promise<void> {
  await fetch(api('answerCallbackQuery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text: text ?? '' }),
  }).catch((e) => console.error('[gvg-video-bot] answerCallbackQuery failed', e));
}

/* ---------------- Hero matching ---------------- */

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’'`´]/g, '')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[b.length]!;
}

export type MatchResult =
  | { kind: 'exact'; hero: HeroRow }
  | { kind: 'suggest'; suggestions: HeroRow[] }
  | { kind: 'none' };

export function matchHero(token: string, heroes: HeroRow[]): MatchResult {
  const q = normalizeName(token);
  if (!q) return { kind: 'none' };

  for (const h of heroes) {
    if (normalizeName(h.name_ru) === q || normalizeName(h.name_en) === q) {
      return { kind: 'exact', hero: h };
    }
  }

  const scored = heroes
    .map((h) => {
      const names = [normalizeName(h.name_ru), normalizeName(h.name_en)].filter(Boolean);
      let best = Number.MAX_SAFE_INTEGER;
      for (const n of names) {
        let d = levenshtein(q, n);
        if (n.startsWith(q) || q.startsWith(n)) d = Math.min(d, Math.abs(n.length - q.length));
        best = Math.min(best, d);
      }
      return { hero: h, distance: best };
    })
    .filter((s) => s.distance <= Math.max(2, Math.floor(q.length / 3)))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  if (!scored.length) return { kind: 'none' };
  return { kind: 'suggest', suggestions: scored.map((s) => s.hero) };
}

/* ---------------- Pending state ---------------- */

export async function expireStalePendings(): Promise<void> {
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('telegram_video_pending_heroes')
    .update({ status: 'cancelled' })
    .eq('status', 'waiting_for_heroes')
    .lt('expires_at', now);
  await supabaseAdmin
    .from('telegram_video_pending_heroes')
    .update({ status: 'completed' })
    .eq('status', 'waiting_for_notes')
    .lt('expires_at', now);
}

export async function createPending(params: {
  chatId: number;
  threadId: number | null;
  userId: number;
  videoMessageId: number;
  videoRowId: string | null;
}): Promise<string | null> {
  const expires = new Date(Date.now() + PENDING_TTL_MIN * 60_000).toISOString();
  const { data, error } = await supabaseAdmin.from('telegram_video_pending_heroes').upsert(
    {
      telegram_chat_id: params.chatId,
      telegram_thread_id: params.threadId,
      telegram_user_id: params.userId,
      video_message_id: params.videoMessageId,
      video_row_id: params.videoRowId,
      status: 'waiting_for_heroes',
      confirmed_hero_ids: [],
      unresolved_token: null,
      suggestion_hero_ids: [],
      expires_at: expires,
      bot_message_ids: [],
    },
    { onConflict: 'telegram_chat_id,telegram_user_id,video_message_id' },
  )
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[gvg-video-bot] pending upsert failed', error.message);
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}

async function loadActivePending(chatId: number, userId: number): Promise<PendingRow | null> {
  const { data, error } = await supabaseAdmin
    .from('telegram_video_pending_heroes')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .eq('telegram_user_id', userId)
    .in('status', ['waiting_for_heroes', 'waiting_for_notes'])
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[gvg-video-bot] pending lookup failed', error.message);
    return null;
  }
  return (data as PendingRow | null) ?? null;
}

async function loadPendingByPrefix(prefix: string): Promise<PendingRow | null> {
  // NOTE: `id` is uuid — PostgREST cannot run LIKE on it, so filter in JS.
  const { data, error } = await supabaseAdmin
    .from('telegram_video_pending_heroes')
    .select('*')
    .in('status', ['waiting_for_heroes', 'waiting_for_notes'])
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('[gvg-video-bot] pending prefix lookup failed', error.message);
    return null;
  }
  const rows = (data ?? []) as PendingRow[];
  return rows.find((r) => r.id.startsWith(prefix)) ?? null;
}


async function loadHeroes(): Promise<HeroRow[]> {
  const { data, error } = await supabaseAdmin.from('heroes').select('id, name_en, name_ru');
  if (error) {
    console.error('[gvg-video-bot] heroes load failed', error.message);
    return [];
  }
  return (data ?? []) as HeroRow[];
}

async function heroNames(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data } = await supabaseAdmin.from('heroes').select('id, name_ru').in('id', ids);
  const map = new Map((data ?? []).map((h) => [h.id as string, h.name_ru as string]));
  return ids.map((id) => map.get(id) ?? '—');
}

/* ---------------- Prompts ---------------- */

export const HERO_PROMPT =
  '🎥 Відео отримано.\n\nВкажіть героїв (до 5) через пробіл.\n\nНаприклад:\nОрен Валара Ароган Хаттор';

const NOTES_PROMPT =
  '📝 Додайте примітки до проходки.\n\nНаприклад:\n• БС\n• таймінг\n• порядок дій\n• нюанси проходки\n• заміни героїв\n• інші важливі деталі\n\nПоле необовʼязкове.';

async function askNotes(p: PendingRow): Promise<void> {
  await tgSendTracked(p, NOTES_PROMPT, [
    [{ text: 'Пропустити', callback_data: `sk|${p.id.slice(0, 8)}` }],
  ]);
}

async function finish(p: PendingRow, notes: string | null): Promise<void> {
  if (p.video_row_id) {
    const { error } = await supabaseAdmin
      .from('telegram_video_messages')
      .update({ notes })
      .eq('id', p.video_row_id);
    if (error) console.error('[gvg-video-bot] notes save failed', error.message);
  }
  await supabaseAdmin
    .from('telegram_video_pending_heroes')
    .update({ status: 'completed' })
    .eq('id', p.id);

  let link: string | null = null;
  if (p.video_row_id) {
    const { data } = await supabaseAdmin
      .from('telegram_video_messages')
      .select('telegram_message_link')
      .eq('id', p.video_row_id)
      .maybeSingle();
    link = (data?.telegram_message_link as string | null) ?? null;
  }
  const names = await heroNames(p.confirmed_hero_ids);
  const text =
    '✅ Відео успішно додано до бази.\n\nГерої:\n' +
    names.join('\n') +
    `\n\n📝 Примітки:${notes ? `\n${notes}` : ' немає'}` +
    (link ? `\n\n🎥 Відкрити відео: ${link}` : '');
  const finalId = await tgSend(p.telegram_chat_id, p.telegram_thread_id, text);
  if (finalId) await cleanupBotMessages(p.id, p.telegram_chat_id);
}

async function saveHeroesAndAskNotes(p: PendingRow, heroIds: string[]): Promise<void> {
  if (!p.video_row_id) {
    await tgSendTracked(p, '❌ Не вдалося знайти запис відео.');
    return;
  }
  const rows = heroIds.map((hero_id) => ({ video_message_id: p.video_row_id!, hero_id }));
  const { error } = await supabaseAdmin
    .from('video_heroes')
    .upsert(rows, { onConflict: 'video_message_id,hero_id', ignoreDuplicates: true });
  if (error) {
    console.error('[gvg-video-bot] video_heroes insert failed', error.message);
    await tgSendTracked(p, '❌ Помилка збереження героїв. Спробуйте ще раз.');
    return;
  }
  const expires = new Date(Date.now() + PENDING_TTL_MIN * 60_000).toISOString();
  await supabaseAdmin
    .from('telegram_video_pending_heroes')
    .update({
      status: 'waiting_for_notes',
      confirmed_hero_ids: heroIds,
      unresolved_token: null,
      suggestion_hero_ids: [],
      expires_at: expires,
    })
    .eq('id', p.id);
  await askNotes({ ...p, status: 'waiting_for_notes', confirmed_hero_ids: heroIds });
}

/* ---------------- Handlers ---------------- */

export async function handleHeroesInput(p: PendingRow, rawText: string): Promise<void> {
  const tokens = rawText.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
  if (!tokens.length) {
    await tgSendTracked(p, '❌ Вкажіть від 1 до 5 героїв.');
    return;
  }
  if (tokens.length > 5) {
    await tgSendTracked(p, `❌ Забагато героїв (${tokens.length}). Вкажіть максимум 5.`);
    return;
  }

  const heroes = await loadHeroes();
  const lines: string[] = [];
  const resolved: string[] = [];
  let unresolved: { token: string; suggestions: HeroRow[] } | null = null;

  for (const token of tokens) {
    const m = matchHero(token, heroes);
    if (m.kind === 'exact') {
      lines.push(`✅ ${m.hero.name_ru}`);
      if (!resolved.includes(m.hero.id)) resolved.push(m.hero.id);
    } else {
      lines.push(`❌ ${token} — не знайдено`);
      if (!unresolved) {
        unresolved = { token, suggestions: m.kind === 'suggest' ? m.suggestions : [] };
      }
    }
  }

  if (!unresolved) {
    await tgSendTracked(p, lines.join('\n'));
    await saveHeroesAndAskNotes(p, resolved);
    return;
  }

  await supabaseAdmin
    .from('telegram_video_pending_heroes')
    .update({
      confirmed_hero_ids: resolved,
      unresolved_token: unresolved.token,
      suggestion_hero_ids: unresolved.suggestions.map((h) => h.id),
    })
    .eq('id', p.id);

  const prefix = p.id.slice(0, 8);
  const keyboard = unresolved.suggestions.map((h, i) => [
    { text: `${i + 1}. ${h.name_ru}`, callback_data: `h|${prefix}|${i}` },
  ]);
  keyboard.push([{ text: '❌ Ввести заново', callback_data: `hx|${prefix}` }]);

  const suggestText = unresolved.suggestions.length
    ? `\n\nМожливо, ви мали на увазі:\n${unresolved.suggestions.map((h, i) => `${i + 1}. ${h.name_ru}`).join('\n')}`
    : '\n\nСхожих варіантів не знайдено. Введіть героїв ще раз.';

  await tgSendTracked(
    p,
    `${lines.join('\n')}\n\n❌ Не знайдено: ${unresolved.token}${suggestText}`,
    unresolved.suggestions.length ? keyboard : undefined,
  );
}

export async function handleTextMessage(
  chatId: number,
  userId: number,
  text: string,
): Promise<boolean> {
  await expireStalePendings();
  const pending = await loadActivePending(chatId, userId);
  if (!pending) return false;

  if (pending.status === 'waiting_for_heroes') {
    await handleHeroesInput(pending, text);
    return true;
  }

  if (pending.status === 'waiting_for_notes') {
    const notes = text.trim();
    if (notes.length > MAX_NOTES) {
      await tgSendTracked(
        pending,
        `❌ Примітки задовгі (${notes.length} символів). Максимум ${MAX_NOTES}.`,
      );
      return true;
    }
    await finish(pending, notes.length ? notes : null);
    return true;
  }
  return false;
}

export async function handleCallbackQuery(cb: {
  id: string;
  data?: string;
  from?: { id?: number };
}): Promise<void> {
  const data = cb.data ?? '';
  const [kind, prefix, idxRaw] = data.split('|');
  if (!prefix) {
    await tgAnswerCallback(cb.id);
    return;
  }
  const pending = await loadPendingByPrefix(prefix);
  if (!pending) {
    await tgAnswerCallback(cb.id, 'Запит більше не активний');
    return;
  }
  if (cb.from?.id && cb.from.id !== pending.telegram_user_id) {
    await tgAnswerCallback(cb.id, 'Це не ваше відео');
    return;
  }

  if (kind === 'sk') {
    await tgAnswerCallback(cb.id, 'Пропущено');
    if (pending.status === 'waiting_for_notes') await finish(pending, null);
    return;
  }

  if (kind === 'hx') {
    await supabaseAdmin
      .from('telegram_video_pending_heroes')
      .update({ unresolved_token: null, suggestion_hero_ids: [], confirmed_hero_ids: [] })
      .eq('id', pending.id);
    await tgAnswerCallback(cb.id);
    await tgSendTracked(pending, 'Введіть героїв (до 5) через пробіл ще раз.');
    return;
  }

  if (kind === 'h') {
    const idx = Number(idxRaw);
    const heroId = pending.suggestion_hero_ids[idx];
    if (!heroId) {
      await tgAnswerCallback(cb.id, 'Варіант недоступний');
      return;
    }
    const ids = [...pending.confirmed_hero_ids];
    if (!ids.includes(heroId)) ids.push(heroId);
    await tgAnswerCallback(cb.id, 'Прийнято');
    await saveHeroesAndAskNotes({ ...pending, confirmed_hero_ids: ids }, ids);
    return;
  }

  await tgAnswerCallback(cb.id);
}
