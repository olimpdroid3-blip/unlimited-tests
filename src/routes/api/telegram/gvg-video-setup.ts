import { createFileRoute } from '@tanstack/react-router';
import { deriveWebhookSecret } from '../public/telegram/gvg-video-webhook';

const WEBHOOK_URL =
  'https://project--33e3ef01-cf16-4bfd-9d4e-cc28e96d83d2-dev.lovable.app/api/public/telegram/gvg-video-webhook';

export const Route = createFileRoute('/api/telegram/gvg-video-setup')({
  server: {
    handlers: {
      GET: async () => {
        const botToken = process.env['TELEGRAM_GVG_VIDEO_BOT_TOKEN'];
        if (!botToken) return new Response('Not configured', { status: 500 });
        const api = `https://api.telegram.org/bot${botToken}`;
        const [meRes, infoRes] = await Promise.all([
          fetch(`${api}/getMe`),
          fetch(`${api}/getWebhookInfo`),
        ]);
        const me = ((await meRes.json()) as { result?: Record<string, unknown> }).result ?? {};
        const info = ((await infoRes.json()) as { result?: Record<string, unknown> }).result ?? {};
        return Response.json({
          bot_username: me['username'] ?? null,
          can_read_all_group_messages: me['can_read_all_group_messages'] ?? null,
          url: info['url'] ?? null,
          pending_update_count: info['pending_update_count'] ?? null,
          allowed_updates: info['allowed_updates'] ?? null,
          last_error_message: info['last_error_message'] ?? null,
          last_error_date: info['last_error_date'] ?? null,
        });
      },
      POST: async () => {
        const botToken = process.env['TELEGRAM_GVG_VIDEO_BOT_TOKEN'];
        if (!botToken) return new Response('Not configured', { status: 500 });
        const api = `https://api.telegram.org/bot${botToken}`;

        const setRes = await fetch(`${api}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: WEBHOOK_URL,
            secret_token: deriveWebhookSecret(botToken),
            allowed_updates: ['message', 'edited_message', 'channel_post', 'callback_query'],
          }),
        });
        const setBody = (await setRes.json()) as Record<string, unknown>;
        if (!setRes.ok) console.error(`[gvg-video-setup] setWebhook failed [${setRes.status}]`);

        const infoRes = await fetch(`${api}/getWebhookInfo`);
        const infoBody = (await infoRes.json()) as { result?: Record<string, unknown> };
        const info = infoBody.result ?? {};

        return Response.json({
          set_ok: setBody['ok'] === true,
          url: info['url'] ?? null,
          pending_update_count: info['pending_update_count'] ?? null,
          last_error_message: info['last_error_message'] ?? null,
          last_error_date: info['last_error_date'] ?? null,
        });
      },
    },
  },
});
