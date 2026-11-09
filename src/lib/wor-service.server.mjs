import { createHash } from "node:crypto";
import {
  MACHINE,
  VERSION,
  decode,
  randomSecret,
  sha256,
  safeEqual,
  signLicense,
  expiry,
  versionCompare,
  exactStrings,
  parseManifest,
  parseTables,
} from "./wor-crypto.mjs";

const messages = {
  pending: "Ожидается подтверждение в Telegram.",
  denied: "Запрос отклонён или уже использован.",
  expired: "Срок запроса или лицензии истёк.",
  revoked: "Доступ устройства отозван.",
  member_removed: "Нет доступа участника клана.",
  device_limit: "Достигнут лимит устройств.",
  rate_limited: "Слишком много попыток. Повторите позже.",
  version_too_old: "Установите актуальную версию программы.",
  server_error: "Сервис временно недоступен. Повторите позже.",
};
export class WorFault extends Error {
  constructor(code, status = 403) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
const fail = (c, s) => {
  throw new WorFault(c, s);
};
export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extra,
    },
  });
export const faultResponse = (c, status = 403) =>
  json({ status: "error", code: c, message: messages[c] ?? messages.denied }, status);
const secret = (value) => {
  try {
    if (decode(value).length !== 32) fail("denied", 400);
  } catch {
    fail("denied", 400);
  }
};
const machine = (value) => {
  if (typeof value !== "string" || !MACHINE.test(value)) fail("denied", 400);
};
const version = (value) => {
  if (typeof value !== "string" || value.length > 40 || !VERSION.test(value)) fail("denied", 400);
};
const cookie = (req) =>
  req.headers
    .get("Cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("__Host-wor="))
    ?.slice(11) ?? "";
const audit = (s, actor, action, target) =>
  s.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), actor, action, target });
async function bytes(req, max = 32768) {
  const reader = req.body?.getReader();
  if (!reader) fail("denied", 400);
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      fail("denied", 413);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(length);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}
async function body(req, keys) {
  if (!req.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))
    fail("denied", 400);
  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await bytes(req)));
    return exactStrings(value, keys);
  } catch (e) {
    if (e instanceof WorFault) throw e;
    fail("denied", 400);
  }
}
function activeMember(s, id) {
  const m = s.members.find((x) => x.id === id);
  if (!m || m.banned) fail("member_removed");
  return m;
}
function device(s, code, digest, requireValid = true) {
  const d = s.devices.find((x) => x.machine === code && x.status === "active");
  if (!d || !safeEqual(d.refresh_hash, digest)) fail("revoked");
  const m = activeMember(s, d.owner);
  if (requireValid && d.expiry < new Date().toISOString().slice(0, 10)) fail("expired");
  return { d, m };
}
export function createWorService({ store, telegram, clock = () => Date.now() }) {
  const membershipCache = new Map();
  async function limit(req, scope, count = 60, seconds = 60, id = "") {
    const ip = req?.headers.get("CF-Connecting-IP") ?? "unknown";
    if (
      !(await store.rpc("wor_rate_take", {
        k: await sha256(scope + "|" + ip + "|" + id),
        max_attempts: count,
        seconds,
      }))
    )
      fail("rate_limited", 429);
  }
  async function membership(id, settings, force = false) {
    const key = settings.clan_chat_id + ":" + id,
      cached = membershipCache.get(key);
    if (!force && cached && cached.until > clock()) {
      if (!cached.allowed) fail("member_removed");
      return cached.member;
    }
    let result;
    try {
      result = await telegram("getChatMember", { chat_id: settings.clan_chat_id, user_id: id });
    } catch {
      fail("server_error", 503);
    }
    const allowed =
      !result.user?.is_bot &&
      (["creator", "administrator", "member"].includes(result.status) ||
        (result.status === "restricted" && result.is_member === true));
    if (membershipCache.size > 200) membershipCache.clear();
    membershipCache.set(key, { allowed, member: result, until: clock() + 180000 });
    if (!allowed) fail("member_removed");
    return result;
  }
  async function cert(d, m) {
    const key = await store.rpc("wor_license_key");
    if (!key) fail("server_error", 503);
    return signLicense(key, d.machine, m.name, d.expiry);
  }
  function browserPost(req) {
    if (req.headers.get("Origin") !== new URL(req.url).origin) fail("denied");
  }
  async function admin(req, s, write = true) {
    const h = await sha256(cookie(req)),
      session = s.sessions.find((x) => safeEqual(x.hash, h) && x.expires > clock());
    if (!session || !s.settings.owner_id || session.owner !== s.settings.owner_id)
      fail("denied", 401);
    if (write && req.method !== "GET") {
      browserPost(req);
      if (!safeEqual(req.headers.get("X-CSRF-Token"), session.csrf)) fail("denied");
    }
    return session;
  }
  async function newRequest(req, kind, b) {
    secret(b.poll_hash);
    const request_id = randomSecret();
    return store.transaction(async (s) => {
      if (!s.settings.bot_username || !s.settings.license_public_key || !s.settings.owner_id)
        fail("server_error", 503);
      let registrationCode, registrationHash, registrationCommand;
      if (kind === "activation") {
        registrationCommand = s.settings.activation_command ?? "reg";
        if (
          !/^[a-z][a-z0-9_]{0,31}$/.test(registrationCommand) ||
          ["start", "devices", "revoke", "ban", "unban", "limit"].includes(registrationCommand)
        )
          fail("server_error", 503);
        const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
        for (let attempt = 0; attempt < 8; attempt++) {
          const chars = Array.from(
            crypto.getRandomValues(new Uint8Array(8)),
            (x) => alphabet[x & 31],
          );
          registrationCode = chars.slice(0, 4).join("") + "-" + chars.slice(4).join("");
          registrationHash = await sha256(registrationCode);
          if (!s.requests.some((x) => x.reg_hash === registrationHash)) break;
          registrationHash = undefined;
        }
        if (!registrationHash) fail("server_error", 503);
      }
      s.requests.push({
        id: request_id,
        kind,
        status: "pending",
        expires: clock() + 600000,
        poll_hash: b.poll_hash,
        shown_to: [],
        ...(registrationHash ? { reg_hash: registrationHash } : {}),
        ...(kind === "activation" ? { machine: b.machine_code, version: b.app_version } : {}),
      });
      return json({
        status: "ok",
        request_id,
        activate_url: "https://t.me/" + s.settings.bot_username + "?start=" + request_id,
        expires_in: 600,
        interval: 3,
        ...(registrationCode
          ? {
              command: "/" + registrationCommand + " " + registrationCode,
              chat_url:
                "https://t.me/c/" +
                s.settings.clan_chat_id.replace(/^-100/, "") +
                "/" +
                s.settings.confirmation_thread_id,
            }
          : {}),
      });
    });
  }
  async function poll(req, kind) {
    const b = await body(req, ["request_id", "poll_secret"]);
    secret(b.request_id);
    secret(b.poll_secret);
    await limit(req, "poll", 22, 60, b.request_id);
    const digest = await sha256(b.poll_secret),
      { data: before } = await store.read();
    const prior = before.requests.find((x) => x.id === b.request_id && x.kind === kind);
    if (
      prior &&
      safeEqual(prior.poll_hash, digest) &&
      prior.status === "approved" &&
      kind === "activation"
    )
      await membership(prior.owner, before.settings);
    const result = await store.transaction(async (s) => {
      const r = s.requests.find((x) => x.id === b.request_id && x.kind === kind);
      if (!r || !safeEqual(r.poll_hash, digest)) return faultResponse("denied");
      if (r.status === "consumed") return faultResponse("denied");
      if (r.expires < clock()) return faultResponse("expired");
      if (r.status === "pending") return json({ status: "pending" }, 202);
      if (r.status !== "approved")
        return faultResponse(r.status === "device_limit" ? "device_limit" : "denied");
      if (kind === "admin") {
        if (r.owner !== s.settings.owner_id) return faultResponse("denied");
        const token = randomSecret(),
          csrf = randomSecret();
        s.sessions.push({
          hash: await sha256(token),
          csrf,
          owner: r.owner,
          expires: clock() + 1800000,
        });
        r.status = "consumed";
        audit(s, r.owner, "admin_login", r.id);
        return json({ status: "ok", csrf }, 200, {
          "Set-Cookie":
            "__Host-wor=" + token + "; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=1800",
        });
      }
      const m = activeMember(s, r.owner),
        max = m.limit ?? s.settings.device_limit;
      if (s.devices.filter((x) => x.owner === m.id && x.status === "active").length >= max) {
        r.status = "device_limit";
        return faultResponse("device_limit");
      }
      if (s.devices.some((x) => x.machine === r.machine && x.status === "active")) {
        r.status = "denied";
        return faultResponse("denied");
      }
      const refresh = randomSecret(),
        d = {
          id: crypto.randomUUID(),
          machine: r.machine,
          owner: m.id,
          version: r.version,
          status: "active",
          issued: new Date(clock()).toISOString(),
          renewed: new Date(clock()).toISOString(),
          expiry: expiry(clock()),
          refresh_hash: await sha256(refresh),
        };
      const license = await cert(d, m);
      s.devices.push(d);
      r.status = "consumed";
      audit(s, m.id, "activate", d.id);
      return json({ status: "ok", license, refresh_secret: refresh, valid_days: 7 });
    });
    if (kind === "activation" && result.status === 200 && prior) {
      const notify = async () => {
        try {
          const { data: current } = await store.read();
          const issued = current.devices.find(
            (x) => x.machine === prior.machine && x.status === "active",
          );
          const member = current.members.find((x) => x.id === issued?.owner);
          await telegram("sendMessage", {
            chat_id: current.settings.clan_chat_id,
            message_thread_id: current.settings.confirmation_thread_id,
            text:
              "✅ Активировано: " +
              (member?.name ?? "Участник") +
              ", компьютер …" +
              prior.machine.slice(-4),
          });
        } catch {
          console.error("WOR_ACTIVATION_NOTICE_FAILED");
        }
      };
      const context = req.runtime?.cloudflare?.context;
      if (typeof context?.waitUntil === "function") context.waitUntil(notify());
      else await notify();
    }
    return result;
  }
  async function http(req) {
    const url = new URL(req.url),
      p = url.pathname;
    if (!p.startsWith("/api/wor/") && !p.startsWith("/downloads/")) return null;
    try {
      if (url.protocol !== "https:") fail("denied", 400);
      await limit(req, "global", 180);
      if (p === "/api/wor/start" && req.method === "POST") {
        await limit(req, "start", 5, 600);
        const b = await body(req, ["machine_code", "app_version", "poll_hash"]);
        machine(b.machine_code);
        version(b.app_version);
        return newRequest(req, "activation", b);
      }
      if (p === "/api/wor/poll" && req.method === "POST") return await poll(req, "activation");
      if (p === "/api/wor/renew" && req.method === "POST") {
        const b = await body(req, ["machine_code", "app_version", "refresh_secret"]);
        machine(b.machine_code);
        version(b.app_version);
        secret(b.refresh_secret);
        await limit(req, "renew", 10, 60, b.machine_code);
        const digest = await sha256(b.refresh_secret),
          { data: s } = await store.read(),
          { d } = device(s, b.machine_code, digest, false);
        await membership(d.owner, s.settings);
        return await store.transaction(async (state) => {
          const { d, m } = device(state, b.machine_code, digest, false);
          d.version = b.app_version;
          d.expiry = expiry(clock());
          d.renewed = new Date(clock()).toISOString();
          return json({ status: "ok", license: await cert(d, m) });
        });
      }
      if (
        (["/api/wor/update", "/api/wor/tables"].includes(p) || p.startsWith("/downloads/")) &&
        req.method === "GET"
      ) {
        const code = req.headers.get("X-Machine-Code"),
          v = req.headers.get("X-App-Version"),
          auth = req.headers.get("Authorization") ?? "";
        machine(code);
        if (!auth.startsWith("Bearer ")) fail("revoked");
        const token = auth.slice(7);
        secret(token);
        if (p !== "/api/wor/tables") version(v);
        const digest = await sha256(token),
          { data: s } = await store.read(),
          { d } = device(s, code, digest);
        await membership(d.owner, s.settings);
        let object,
          type = "application/json; charset=utf-8",
          filename;
        if (p === "/api/wor/tables") {
          const table = s.tables.find((x) => x.id === s.settings.current_tables);
          if (!table) fail("server_error", 503);
          object = table.object;
        } else {
          const current = s.releases.find((x) => x.id === s.settings.current_release && x.ready);
          if (!current) fail("server_error", 503);
          if (versionCompare(v, current.manifest.min_version) < 0) fail("version_too_old");
          if (p === "/api/wor/update") object = current.manifest_object;
          else {
            const release = s.releases.find((x) => x.ready && x.manifest.url === p);
            if (!release) fail("denied", 404);
            object = release.exe_object;
            type = "application/octet-stream";
            filename = p.slice(11);
          }
        }
        const upstream = await store.get(object);
        return new Response(upstream.body, {
          headers: {
            "Content-Type": type,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            ...(filename
              ? { "Content-Disposition": 'attachment; filename="' + filename + '"' }
              : {}),
            ...(upstream.headers.get("content-length")
              ? { "Content-Length": upstream.headers.get("content-length") }
              : {}),
          },
        });
      }
      if (p === "/api/wor/admin/start" && req.method === "POST") {
        browserPost(req);
        await limit(req, "admin_start", 3, 600);
        const b = await body(req, ["poll_hash"]);
        return newRequest(req, "admin", b);
      }
      if (p === "/api/wor/admin/poll" && req.method === "POST") {
        browserPost(req);
        return await poll(req, "admin");
      }
      const { data: s } = await store.read();
      const session = await admin(req, s);
      if (p === "/api/wor/admin" && req.method === "GET")
        return json({
          status: "ok",
          csrf: session.csrf,
          members: s.members,
          devices: s.devices.map(({ refresh_hash, ...d }) => d),
          releases: s.releases,
          tables: s.tables,
          audit: s.audit,
          settings: s.settings,
        });
      if (p === "/api/wor/admin/export" && req.method === "GET")
        return json(
          {
            schema: 1,
            exported_at: new Date().toISOString(),
            data: { ...s, sessions: [], requests: [] },
          },
          200,
          { "Content-Disposition": 'attachment; filename="wor-backup.json"' },
        );
      if (p === "/api/wor/admin/logout" && req.method === "POST")
        return store.transaction(async (state) => {
          await admin(req, state);
          state.sessions = state.sessions.filter((x) => x.hash !== session.hash);
          return json({ status: "ok" }, 200, {
            "Set-Cookie": "__Host-wor=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0",
          });
        });
      if (p === "/api/wor/admin/snapshot" && req.method === "POST") {
        await store.snapshot();
        return json({ status: "ok" });
      }
      if (p === "/api/wor/admin/action" && req.method === "POST") {
        const b = await body(req, ["action", "target", "value"]);
        return store.transaction(async (state) => {
          await admin(req, state);
          manage(state, state.settings.owner_id, b.action, b.target, b.value);
          return json({ status: "ok" });
        });
      }
      if (p === "/api/wor/admin/manifest" && req.method === "PUT") {
        const raw = await bytes(req),
          id = crypto.randomUUID();
        let manifest;
        try {
          manifest = parseManifest(raw);
        } catch {
          fail("denied", 400);
        }
        if (
          s.releases.some(
            (x) => x.manifest.version === manifest.version || x.manifest.url === manifest.url,
          )
        )
          fail("denied");
        const manifest_object = "releases/" + id + "/manifest.json",
          exe_object = "releases/" + id + "/" + manifest.url.slice(11);
        await store.put(manifest_object, raw, "application/json");
        return await store.transaction(async (state) => {
          await admin(req, state);
          if (
            state.releases.some(
              (x) => x.manifest.version === manifest.version || x.manifest.url === manifest.url,
            )
          )
            fail("denied");
          state.releases.push({
            id,
            manifest,
            manifest_object,
            exe_object,
            ready: false,
            created_at: new Date().toISOString(),
          });
          audit(state, state.settings.owner_id, "release_draft", id);
          return json({ status: "ok", release_id: id });
        });
      }
      if (p.startsWith("/api/wor/admin/exe/") && req.method === "PUT") {
        const id = p.split("/").pop(),
          release = s.releases.find((x) => x.id === id && !x.ready);
        if (!release || !req.body) fail("denied");
        const digest = createHash("sha256");
        let size = 0;
        const stream = req.body.pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              size += chunk.length;
              if (size > 50 * 1024 * 1024) throw Error("WOR_SIZE");
              digest.update(chunk);
              controller.enqueue(chunk);
            },
          }),
        );
        await store.put(release.exe_object, stream);
        if (size === 0 || digest.digest("hex") !== release.manifest.sha256) {
          await store.remove([release.exe_object]);
          fail("denied", 400);
        }
        return await store.transaction(async (state) => {
          await admin(req, state);
          const r = state.releases.find((x) => x.id === id && !x.ready);
          if (!r) fail("denied");
          r.ready = true;
          r.bytes = size;
          audit(state, state.settings.owner_id, "release_upload", id);
          return json({ status: "ok" });
        });
      }
      if (p === "/api/wor/admin/tables" && req.method === "PUT") {
        const raw = await bytes(req, 1024 * 1024),
          id = crypto.randomUUID();
        let table;
        try {
          table = parseTables(raw);
        } catch {
          fail("denied", 400);
        }
        const object = "tables/" + id + "/tables.json";
        await store.put(object, raw, "application/json");
        return await store.transaction(async (state) => {
          await admin(req, state);
          state.tables.push({
            id,
            object,
            version: table.version,
            sha256: Buffer.from(await sha256(raw), "base64url").toString("hex"),
            bytes: raw.length,
            created_at: new Date().toISOString(),
          });
          state.settings.current_tables = id;
          audit(state, state.settings.owner_id, "tables_upload", id);
          return json({ status: "ok" });
        });
      }
      if (p === "/api/wor/admin/tables" && req.method === "GET") {
        const t = s.tables.find((x) => x.id === s.settings.current_tables);
        if (!t) fail("denied", 404);
        const r = await store.get(t.object);
        return new Response(r.body, {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (p === "/api/wor/admin/publish" && req.method === "POST") {
        const b = await body(req, ["release_id"]);
        return store.transaction(async (state) => {
          await admin(req, state);
          const r = state.releases.find((x) => x.id === b.release_id && x.ready),
            old = state.releases.find((x) => x.id === state.settings.current_release);
          if (!r || (old && versionCompare(r.manifest.version, old.manifest.version) <= 0))
            fail("denied");
          state.settings.current_release = r.id;
          audit(state, state.settings.owner_id, "release_publish", r.id);
          return json({ status: "ok" });
        });
      }
      if (p === "/api/wor/admin/delete-release" && req.method === "POST") {
        const b = await body(req, ["release_id"]),
          r = s.releases.find((x) => x.id === b.release_id);
        if (!r) fail("denied");
        await store.transaction(async (state) => {
          await admin(req, state);
          if (state.settings.current_release === r.id) fail("denied");
          state.releases = state.releases.filter((x) => x.id !== r.id);
          audit(state, state.settings.owner_id, "release_delete", r.id);
        });
        await store.remove([r.manifest_object, r.exe_object]);
        return json({ status: "ok" });
      }
      return faultResponse("denied", 404);
    } catch (e) {
      if (e instanceof WorFault) return faultResponse(e.code, e.status);
      console.error("WOR_SERVER_ERROR");
      return faultResponse("server_error", 503);
    }
  }
  function manage(s, actor, action, target, value) {
    if (!s.settings.owner_id || actor !== s.settings.owner_id) fail("denied");
    if (action === "revoke") {
      const d =
        s.devices.find((x) => x.id === target) ??
        s.devices.find((x) => x.machine === target && x.status === "active");
      if (!d) fail("denied");
      d.status = "revoked";
    } else if (action === "revoke_all") {
      for (const d of s.devices.filter((x) => x.owner === target)) d.status = "revoked";
    } else if (action === "ban" || action === "unban") {
      const m = s.members.find((x) => x.id === target);
      if (!m || target === actor) fail("denied");
      m.banned = action === "ban";
      if (m.banned)
        for (const d of s.devices.filter((x) => x.owner === target)) d.status = "revoked";
    } else if (action === "limit") {
      if (!/^([1-9]|10)$/.test(value)) fail("denied", 400);
      if (target === "default") s.settings.device_limit = Number(value);
      else activeMember(s, target).limit = Number(value);
    } else fail("denied", 400);
    audit(s, actor, action, target);
  }
  async function bot(update) {
    const cb = update.callback_query,
      msg = update.message;
    const isCallback = typeof cb?.data === "string" && cb.data.startsWith("wor:");
    const registration =
      /^\/([a-z][a-z0-9_]{0,31})(?:@([A-Za-z0-9_]+))?\s+([A-Z2-9]{4}-[A-Z2-9]{4})$/i.exec(
        msg?.text?.trim() ?? "",
      );
    const isCommand =
      typeof msg?.text === "string" &&
      /^\/(start(?:@[A-Za-z0-9_]+)?\s+[A-Za-z0-9_-]{43}|devices(?:@[A-Za-z0-9_]+)?(?:\s.*)?|revoke(?:@[A-Za-z0-9_]+)?(?:\s.*)?|ban(?:@[A-Za-z0-9_]+)?(?:\s.*)?|unban(?:@[A-Za-z0-9_]+)?(?:\s.*)?|limit(?:@[A-Za-z0-9_]+)?(?:\s.*)?)$/.test(
        msg.text.trim(),
      );
    if (!isCallback && !isCommand && !registration) return false;
    const sender = isCallback ? cb.from : msg.from,
      chat = isCallback ? cb.message?.chat : msg.chat;
    if (!Number.isSafeInteger(sender?.id) || sender.is_bot) return true;
    // Commands are accepted only in private chat. Other topics and legacy
    // group commands are left entirely to the existing bot handlers.
    if (
      !isCallback &&
      !registration &&
      (chat?.type !== "private" || String(chat.id) !== String(sender.id))
    )
      return false;
    const id = String(sender.id);
    let registrationDestination;
    try {
      const { data: s } = await store.read();
      const isRegistration =
        registration && registration[1].toLowerCase() === (s.settings.activation_command ?? "reg");
      if (registration && !isCommand && !isRegistration) return false;
      if (!isCallback && !isRegistration && (chat?.type !== "private" || String(chat.id) !== id))
        return false;
      if (isRegistration) {
        if (
          registration[2] &&
          registration[2].toLowerCase() !== s.settings.bot_username.toLowerCase()
        )
          return false;
        if (
          String(chat?.id) !== s.settings.clan_chat_id ||
          msg.message_thread_id !== s.settings.confirmation_thread_id
        )
          return false;
        registrationDestination = {
          chat_id: s.settings.clan_chat_id,
          message_thread_id: s.settings.confirmation_thread_id,
        };
        await limit(null, "registration", 6, 600, id);
      }
      await limit(null, "telegram", 30, 60, id);
      if (isCallback) {
        if (
          String(chat?.id) !== s.settings.clan_chat_id ||
          cb.message?.message_thread_id !== s.settings.confirmation_thread_id
        )
          fail("denied");
        const match = /^wor:(yes|no):([A-Za-z0-9_-]{43})$/.exec(cb.data);
        if (!match) return true;
        const r = s.requests.find((x) => x.id === match[2]);
        if (!r || r.expires < clock()) fail("expired");
        if (r.requester !== id || (r.kind === "admin" && id !== s.settings.owner_id))
          fail("denied");
        const member = await membership(id, s.settings, true);
        const name = (
          member.custom_title ||
          member.tag ||
          [member.user?.first_name, member.user?.last_name].filter(Boolean).join(" ") ||
          "Участник " + id
        )
          .trim()
          .slice(0, 80);
        await store.transaction((state) => {
          const r = state.requests.find((x) => x.id === match[2]);
          if (!r || r.expires < clock()) fail("expired");
          if (r.status !== "pending" || r.requester !== id) fail("denied");
          if (r.kind === "admin" && id !== state.settings.owner_id) fail("denied");
          let m = state.members.find((x) => x.id === id);
          if (m?.banned) fail("member_removed");
          if (!m) {
            m = { id, name, banned: false };
            state.members.push(m);
          } else m.name = name;
          if (
            match[1] === "yes" &&
            r.kind === "activation" &&
            state.devices.filter((x) => x.owner === id && x.status === "active").length >=
              (m.limit ?? state.settings.device_limit)
          ) {
            r.status = "device_limit";
            audit(state, id, "device_limit", r.id);
            return;
          }
          r.owner = id;
          r.status = match[1] === "yes" ? "approved" : "denied";
          audit(state, id, match[1] === "yes" ? "approve" : "deny", r.id);
        });
        await telegram("answerCallbackQuery", {
          callback_query_id: cb.id,
          text: "Ответ сохранён. Вернитесь в программу или админку.",
        });
        try {
          await telegram("editMessageReplyMarkup", {
            chat_id: s.settings.clan_chat_id,
            message_id: cb.message.message_id,
            reply_markup: { inline_keyboard: [] },
          });
        } catch {
          /* The request is already consumed safely. */
        }
        return true;
      }
      const [raw, ...args] = msg.text.trim().split(/\s+/),
        command = raw.split("@")[0];
      if (command === "/start" || isRegistration) {
        const registrationHash = isRegistration
          ? await sha256(registration[3].toUpperCase())
          : null;
        const r = s.requests.find((x) =>
          isRegistration
            ? x.kind === "activation" && safeEqual(x.reg_hash, registrationHash)
            : x.id === args[0],
        );
        if (!r && isRegistration) fail("denied");
        if (!r) return false;
        if (r.expires < clock()) fail("expired");
        if (r.status !== "pending") fail("denied");
        if (r.kind === "admin" && id !== s.settings.owner_id) fail("denied");
        const member = await membership(id, s.settings, true);
        if (s.members.some((x) => x.id === id && x.banned)) fail("member_removed");
        await store.transaction((state) => {
          const req = state.requests.find((x) => x.id === r.id);
          if (!req || req.status !== "pending" || req.expires < clock()) fail("expired");
          if (req.requester && req.requester !== id) fail("denied");
          req.requester = id;
        });
        const name = (
          member.custom_title ||
          member.tag ||
          member.user?.first_name ||
          "Участник"
        ).slice(0, 80);
        const text =
          r.kind === "admin"
            ? "Подтвердить вход владельца в управление программой?"
            : "Подтвердить активацию на компьютере с кодом " +
              r.machine +
              "?\nУчастник: " +
              name +
              "\n\nПередаются только код компьютера, версия и секрет устройства. Данные игры, имя персонажа, игровой аккаунт и пароли не передаются. Отозвать доступ может владелец клана. Офлайн-лицензия действует до 7 дней.\n\nПодтверждайте только свой запрос. Срок запроса — 10 минут.";
        await telegram("sendMessage", {
          chat_id: s.settings.clan_chat_id,
          message_thread_id: s.settings.confirmation_thread_id,
          text,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Подтвердить", callback_data: "wor:yes:" + r.id },
                { text: "Отклонить", callback_data: "wor:no:" + r.id },
              ],
            ],
          },
        });
        return true;
      }
      if (!s.settings.owner_id || id !== s.settings.owner_id) fail("denied");
      if (command === "/devices") {
        const list = s.devices.filter((d) => !args[0] || d.owner === args[0]);
        const lines = list.map(
          (d) =>
            d.machine +
            " | " +
            d.owner +
            " | " +
            d.version +
            " | " +
            d.status +
            " | до " +
            d.expiry +
            "\n/revoke " +
            d.machine,
        );
        const text = lines.length ? lines.join("\n\n") : "Устройств пока нет.";
        for (let pos = 0; pos < text.length; pos += 3500)
          await telegram("sendMessage", { chat_id: id, text: text.slice(pos, pos + 3500) });
        return true;
      }
      const action = command.slice(1),
        target = args[0],
        value = args[1] ?? "";
      if (!target || (action === "limit" && !value)) fail("denied", 400);
      await store.transaction((state) => manage(state, id, action, target, value));
      await telegram("sendMessage", { chat_id: id, text: "Готово." });
      return true;
    } catch (e) {
      const code = e instanceof WorFault ? e.code : "server_error";
      if (isCallback) {
        try {
          await telegram("answerCallbackQuery", {
            callback_query_id: cb.id,
            text: messages[code],
            show_alert: true,
          });
        } catch {}
      } else {
        try {
          await telegram("sendMessage", {
            ...(registrationDestination ?? { chat_id: id }),
            text: messages[code],
          });
        } catch {}
      }
      if (code === "server_error") throw Error("WOR_BOT_RETRY");
      return true;
    }
  }
  return {
    http: async (req) => {
      try {
        return await http(req);
      } catch (e) {
        if (e instanceof WorFault) return faultResponse(e.code, e.status);
        console.error("WOR_SERVER_ERROR");
        return faultResponse("server_error", 503);
      }
    },
    bot,
  };
}
