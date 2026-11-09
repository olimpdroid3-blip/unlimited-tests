import { createWorStore } from "./wor-store.server.mjs";
import { createWorService, json, faultResponse } from "./wor-service.server.mjs";
import { worAdminPage } from "./wor-ui.server.mjs";

const store = createWorStore();
async function telegram(method, params) {
  const token = process.env.TELEGRAM_GVG_VIDEO_BOT_TOKEN;
  if (!token) throw Error("WOR_BOT_CONFIG");
  const r = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw Error("WOR_TELEGRAM");
  const b = await r.json();
  if (!b.ok) throw Error("WOR_TELEGRAM");
  return b.result;
}
const service = createWorService({ store, telegram });
let botInspection;
async function inspectBot(settings) {
  if (botInspection?.chat === settings.clan_chat_id && botInspection.until > Date.now())
    return botInspection.value;
  const value = (async () => {
    const me = await telegram("getMe", {});
    const [member, ...menus] = await Promise.all([
      telegram("getChatMember", { chat_id: settings.clan_chat_id, user_id: me.id }),
      telegram("getMyCommands", { scope: { type: "default" } }),
      telegram("getMyCommands", { scope: { type: "all_group_chats" } }),
      telegram("getMyCommands", { scope: { type: "chat", chat_id: settings.clan_chat_id } }),
    ]);
    return {
      username: me.username,
      status: member.status,
      receives_bare_commands:
        ["administrator", "creator"].includes(member.status) ||
        me.can_read_all_group_messages === true,
      registered_commands: [...new Set(menus.flat().map((x) => x.command))].sort(),
    };
  })();
  botInspection = { chat: settings.clan_chat_id, until: Date.now() + 300000, value };
  try {
    return await value;
  } catch (error) {
    botInspection = undefined;
    throw error;
  }
}

// Runtime environment overrides the private server configuration. An unset
// flag still defaults to off; only a service-role operator can enable in DB.
export async function worEnabled(repository = store, env = process.env) {
  if (env.WOR_ENABLED !== undefined) return env.WOR_ENABLED === "true";
  try {
    return (await repository.read()).data.settings.enabled === true;
  } catch {
    return false;
  }
}

function isWorCandidate(update) {
  if (
    typeof update.callback_query?.data === "string" &&
    update.callback_query.data.startsWith("wor:")
  )
    return true;
  const message = update.message;
  if (
    typeof message?.text === "string" &&
    /^\/[a-z][a-z0-9_]{0,31}(?:@[A-Za-z0-9_]+)?\s+[A-Z2-9]{4}-[A-Z2-9]{4}$/i.test(
      message.text.trim(),
    )
  )
    return true;
  return (
    message?.chat?.type === "private" &&
    typeof message.text === "string" &&
    /^\/(?:start(?:@[A-Za-z0-9_]+)?\s+[A-Za-z0-9_-]{43}|(?:devices|revoke|ban|unban|limit)(?:@[A-Za-z0-9_]+)?(?:\s.*)?)$/.test(
      message.text.trim(),
    )
  );
}

export async function handleWor(request) {
  if (new URL(request.url).pathname === "/api/wor/health" && request.method === "GET") {
    try {
      const state = await store.read();
      return json({
        status: "ok",
        enabled: state.data.settings.enabled === true,
        ...(new URL(request.url).searchParams.get("telegram") === "1"
          ? { telegram: await inspectBot(state.data.settings) }
          : {}),
      });
    } catch {
      return faultResponse("server_error", 503);
    }
  }
  const p = new URL(request.url).pathname;
  if (!(await worEnabled())) {
    if (["/api/wor/tables", "/api/wor/update"].includes(p) || p.startsWith("/downloads/"))
      return json(
        { code: "server_error", message: "Сервис временно недоступен. Повторите позже." },
        503,
      );
    return faultResponse("server_error", 503);
  }
  if (new URL(request.url).protocol !== "https:") return faultResponse("denied", 400);
  if (p === "/wor/admin") return worAdminPage();
  if (p === "/api/wor/bootstrap") return faultResponse("denied", 404);
  return service.http(request);
}
export const handleWorUpdate = async (update) =>
  isWorCandidate(update) && (await worEnabled()) ? service.bot(update) : false;
