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
      return json({ status: "ok", enabled: state.data.settings.enabled === true });
    } catch {
      return faultResponse("server_error", 503);
    }
  }
  if (!(await worEnabled())) return faultResponse("server_error", 503);
  const p = new URL(request.url).pathname;
  if (new URL(request.url).protocol !== "https:") return faultResponse("denied", 400);
  if (p === "/wor/admin") return worAdminPage();
  if (p === "/api/wor/bootstrap") return faultResponse("denied", 404);
  return service.http(request);
}
export const handleWorUpdate = async (update) =>
  isWorCandidate(update) && (await worEnabled()) ? service.bot(update) : false;
