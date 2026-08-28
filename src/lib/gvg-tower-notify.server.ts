// Sends a short technical message about a tower to the pinned Telegram topic.
const CHAT_ID = -1003978316922;
const THREAD_ID = 8;

export async function notifyTowerToTelegram(
  nickname: string,
  towerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
  if (!token) return { ok: false, error: "TELEGRAM_GVG_VIDEO_BOT_TOKEN is not configured" };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      message_thread_id: THREAD_ID,
      text: `🏰 Вежа ${towerId} — ${nickname}`,
      disable_notification: true,
      disable_web_page_preview: true,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!json.ok) {
    console.error(`[tower-notify] sendMessage failed [${res.status}] ${json.description ?? ""}`);
    return { ok: false, error: json.description ?? "telegram-error" };
  }
  return { ok: true };
}
