import { createFileRoute } from '@tanstack/react-router';
import { createHash, timingSafeEqual } from 'crypto';

export function deriveWebhookSecret(botToken: string): string {
  return createHash('sha256').update(`gvg-video-webhook:${botToken}`).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

type TgMessage = {
  message_id?: number;
  message_thread_id?: number;
  date?: number;
  chat?: { id?: number; type?: string; username?: string };
  from?: { id?: number; username?: string; first_name?: string };
  text?: string;
  caption?: string;
  video?: unknown;
  video_note?: unknown;
  animation?: unknown;
  photo?: unknown;
  document?: unknown;
  audio?: unknown;
  voice?: unknown;
  is_topic_message?: boolean;
  reply_to_message?: { message_thread_id?: number; message_id?: number };
  // service messages
  new_chat_members?: unknown;
  left_chat_member?: unknown;
  forum_topic_created?: unknown;
  pinned_message?: unknown;
};

function pickMessage(update: Record<string, unknown>): TgMessage | null {
  const candidate =
    (update['message'] as TgMessage | undefined) ??
    (update['edited_message'] as TgMessage | undefined) ??
    (update['channel_post'] as TgMessage | undefined) ??
    (update['edited_channel_post'] as TgMessage | undefined);
  return candidate ?? null;
}

function isServiceMessage(m: TgMessage): boolean {
  return Boolean(
    m.new_chat_members || m.left_chat_member || m.forum_topic_created || m.pinned_message,
  );
}

// Telegram puts the topic id in message_thread_id, but for the "General" topic
// and for some replies it can be missing — fall back to the reply chain.
export function resolveThreadId(m: TgMessage): number | null {
  if (typeof m.message_thread_id === 'number') return m.message_thread_id;
  if (m.is_topic_message && typeof m.reply_to_message?.message_thread_id === 'number') {
    return m.reply_to_message.message_thread_id;
  }
  return null;
}

export function resolveMessageType(m: TgMessage): string {
  if (m.video || m.video_note || m.animation) return 'video';
  if (m.photo) return 'photo';
  if (m.document) return 'document';
  if (typeof m.text === 'string' && m.text.length > 0) return 'text';
  return 'other';
}

export function buildMessageLink(
  chatId: number,
  messageId: number,
  threadId: number | null,
  chatUsername?: string,
): string {
  if (chatUsername) {
    return threadId
      ? `https://t.me/${chatUsername}/${threadId}/${messageId}`
      : `https://t.me/${chatUsername}/${messageId}`;
  }
  const internal = String(chatId).replace(/^-100/, '');
  return threadId
    ? `https://t.me/c/${internal}/${threadId}/${messageId}`
    : `https://t.me/c/${internal}/${messageId}`;
}

export const Route = createFileRoute('/api/public/telegram/gvg-video-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const botToken = process.env['TELEGRAM_GVG_VIDEO_BOT_TOKEN'];
        if (!botToken) {
          console.error('[gvg-video-webhook] TELEGRAM_GVG_VIDEO_BOT_TOKEN is not configured');
          return new Response('Not configured', { status: 500 });
        }

        const provided = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '';
        if (!safeEqual(provided, deriveWebhookSecret(botToken))) {
          console.error('[gvg-video-webhook] invalid secret token (header present:', provided.length > 0, ')');
          return new Response('Unauthorized', { status: 401 });
        }

        let update: Record<string, unknown>;
        try {
          update = (await request.json()) as Record<string, unknown>;
        } catch (error) {
          console.error('[gvg-video-webhook] invalid JSON body', error);
          return Response.json({ ok: true, ignored: 'invalid-json' });
        }

        const callback = update['callback_query'] as
          | { id: string; data?: string; from?: { id?: number } }
          | undefined;
        if (callback?.id) {
          const { handleCallbackQuery } = await import('@/lib/gvg-video-bot.server');
          await handleCallbackQuery(callback);
          return Response.json({ ok: true, handled: 'callback' });
        }

        const message = pickMessage(update);
        if (!message || !message.chat?.id || typeof message.message_id !== 'number') {
          return Response.json({ ok: true, ignored: 'no-message' });
        }
        if (isServiceMessage(message)) {
          return Response.json({ ok: true, ignored: 'service-message' });
        }

        const chatId = message.chat.id;
        const threadId = resolveThreadId(message);

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

        const { data: source, error: sourceError } = await supabaseAdmin
          .from('telegram_sources')
          .select('id')
          .eq('telegram_chat_id', chatId)
          .eq('telegram_thread_id', threadId ?? 0)
          .eq('active', true)
          .maybeSingle();

        if (sourceError) {
          console.error('[gvg-video-webhook] source lookup failed', sourceError.message);
          return Response.json({ ok: true, error: 'source-lookup-failed' });
        }

        if (!source) {
          return Response.json({ ok: true, ignored: 'source-not-allowed' });
        }

        const messageType = resolveMessageType(message);
        const bot = await import('@/lib/gvg-video-bot.server');

        // A plain text message may be an answer to the bot's hero/notes prompt.
        if (messageType === 'text' && message.from?.id) {
          const handled = await bot.handleTextMessage(chatId, message.from.id, message.text ?? '');
          if (handled) return Response.json({ ok: true, handled: 'pending-reply' });
        }

        const link = buildMessageLink(chatId, message.message_id, threadId, message.chat.username);
        const messageDate = message.date ? new Date(message.date * 1000).toISOString() : null;

        const { data: stored, error: upsertError } = await supabaseAdmin
          .from('telegram_video_messages')
          .upsert(
            {
              telegram_chat_id: chatId,
              telegram_message_id: message.message_id,
              telegram_thread_id: threadId,
              telegram_user_id: message.from?.id ?? null,
              telegram_username: message.from?.username ?? message.from?.first_name ?? null,
              message_date: messageDate,
              message_type: messageType,
              caption: message.caption ?? message.text ?? null,
              telegram_message_link: link,
            },
            { onConflict: 'telegram_chat_id,telegram_message_id', ignoreDuplicates: false },
          )
          .select('id')
          .maybeSingle();

        if (upsertError) {
          console.error('[gvg-video-webhook] upsert failed', upsertError.message);
          return Response.json({ ok: true, error: 'store-failed' });
        }

        console.log(
          `[gvg-video-webhook] indexed chat_id=${chatId} message_id=${message.message_id} thread_id=${threadId ?? 'null'} type=${messageType} user_id=${message.from?.id ?? 'null'} username=${message.from?.username ?? 'null'} date=${messageDate ?? 'null'}`,
        );

        if (messageType === 'video' && message.from?.id) {
          await bot.expireStalePendings();
          await bot.createPending({
            chatId,
            threadId,
            userId: message.from.id,
            videoMessageId: message.message_id,
            videoRowId: stored?.id ?? null,
          });
          await bot.tgSend(chatId, threadId, bot.HERO_PROMPT);
        }

        return Response.json({ ok: true, indexed: true });
      },
    },
  },
});
