import { createWorStore } from "./wor-store.server.mjs";
import { createWorService, json, faultResponse } from "./wor-service.server.mjs";
import { base64url, decode, sha256, safeEqual, signLicense } from "./wor-crypto.mjs";
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

// The operator configures a one-use credential hash as a server secret.
// No environment-specific bootstrap credential or hash is shipped in Git.
async function bootstrap(req) {
  if (req.method !== "POST") return faultResponse("denied", 405);
  const auth = req.headers.get("Authorization") ?? "";
  const expected =
    process.env.WOR_BOOTSTRAP_SHA256 ?? (await store.read()).data.settings.bootstrap_sha256;
  if (!expected || !auth.startsWith("Bearer ") || !safeEqual(await sha256(auth.slice(7)), expected))
    return faultResponse("denied");
  const { data: state } = await store.read();
  if (state.settings.initialized) return faultResponse("denied");
  const me = await telegram("getMe", {}),
    chat = await telegram("getChat", { chat_id: state.settings.clan_chat_id });
  const self = await telegram("getChatMember", {
    chat_id: state.settings.clan_chat_id,
    user_id: me.id,
  });
  if (!["administrator", "creator"].includes(self.status) || !chat.is_forum)
    throw Error("WOR_BOT_PERMISSIONS");
  let key = await store.rpc("wor_license_key");
  if (!key) {
    const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
    const candidate = base64url(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
    key = await store.rpc("wor_license_key", { candidate });
  }
  const imported = await crypto.subtle.importKey("pkcs8", decode(key), "Ed25519", true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", imported),
    public_key = Buffer.from(jwk.x, "base64url").toString("hex");
  const test_license = await signLicense(key, "AAAA-BBBB-CCCC-DDDD", "Тест", "2030-01-01");
  const webhook = await telegram("getWebhookInfo", {});
  return store.transaction((s) => {
    if (s.settings.initialized) throw Error("WOR_ALREADY_INITIALIZED");
    s.settings.license_public_key = public_key;
    s.settings.test_license = test_license;
    s.settings.bot_username = me.username;
    s.settings.initialized = true;
    s.settings.bot_check = {
      checked_at: new Date().toISOString(),
      type: chat.type,
      is_forum: chat.is_forum,
      status: self.status,
      can_manage_topics: self.can_manage_topics ?? false,
    };
    return json({
      status: "ok",
      public_key,
      test_license,
      bot_username: me.username,
      chat_type: chat.type,
      is_forum: chat.is_forum,
      bot_status: self.status,
      webhook_url: webhook.url,
      allowed_updates: webhook.allowed_updates,
    });
  });
}
export async function handleWor(request) {
  if (new URL(request.url).pathname === "/api/wor/health" && request.method === "GET") {
    try {
      const state = await store.read();
      return json({status:"ok",enabled:state.data.settings.enabled===true});
    } catch (error) {
      const reason = /^WOR_(CONFIG|STATE|STORAGE_\d+|TRANSPORT_[A-Z]+|RESPONSE_JSON)$/.test(error?.message ?? "") ? error.message : "WOR_NETWORK";
      return json({status:"error",code:"server_error",message:"Сервис временно недоступен.",reason},503);
    }
  }
  if (!(await worEnabled())) return faultResponse("server_error", 503);
  const p = new URL(request.url).pathname;
  if (new URL(request.url).protocol !== "https:") return faultResponse("denied", 400);
  if (p === "/wor/admin") return worAdminPage();
  if (p === "/api/wor/bootstrap") {
    try {
      if (new URL(request.url).protocol !== "https:") return faultResponse("denied", 400);
      return await bootstrap(request);
    } catch {
      console.error("WOR_BOOTSTRAP_ERROR");
      return faultResponse("server_error", 503);
    }
  }
  return service.http(request);
}
export const handleWorUpdate = async (update) =>
  isWorCandidate(update) && (await worEnabled()) ? service.bot(update) : false;
