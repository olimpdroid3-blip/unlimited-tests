import { createFileRoute } from '@tanstack/react-router';
import { timingSafeEqual } from 'crypto';
import { deriveWebhookSecret } from './gvg-video-webhook';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// One-time setup endpoint: open it with ?token=<bot token> to register the webhook.
export const Route = createFileRoute('/api/public/telegram/gvg-video-setup')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const botToken = process.env['TELEGRAM_GVG_VIDEO_BOT_TOKEN'];
        if (!botToken) return new Response('Not configured', { status: 500 });

        const url = new URL(request.url);
        const provided = url.searchParams.get('token') ?? '';
        if (!safeEqual(provided, botToken)) {
          return new Response('Unauthorized', { status: 401 });
        }

        const webhookUrl = `${url.origin}/api/public/telegram/gvg-video-webhook`;
        const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl,
            secret_token: deriveWebhookSecret(botToken),
            allowed_updates: ['message', 'edited_message', 'channel_post'],
            drop_pending_updates: false,
          }),
        });
        const body = await res.text();
        if (!res.ok) {
          console.error(`[gvg-video-setup] setWebhook failed [${res.status}]: ${body}`);
        }
        return new Response(`webhook_url=${webhookUrl}\nstatus=${res.status}\n${body}`, {
          status: res.ok ? 200 : 502,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      },
    },
  },
});
