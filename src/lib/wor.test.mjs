import test from "node:test";
import assert from "node:assert/strict";
import { verify, createPublicKey, createHash } from "node:crypto";
import {
  base64url,
  sha256,
  randomSecret,
  signLicense,
  licensePayload,
  parseManifest,
  parseTables,
  versionCompare,
} from "./wor-crypto.mjs";
import { createWorService } from "./wor-service.server.mjs";
import { worAdminPage } from "./wor-ui.server.mjs";
import { handleWor, handleWorUpdate, worEnabled } from "./wor.server.mjs";
import { createWorStore } from "./wor-store.server.mjs";

test("Worker fetch uses supported manual redirects and rejects upstream redirects", async () => {
  const originalFetch = globalThis.fetch,
    oldUrl = process.env.GVG_SUPABASE_URL,
    oldKey = process.env.GVG_SUPABASE_SERVICE_ROLE_KEY;
  try {
    process.env.GVG_SUPABASE_URL = "https://database.example.test/";
    process.env.GVG_SUPABASE_SERVICE_ROLE_KEY = "test-server-key";
    globalThis.fetch = async (url, init) => {
      assert.equal(
        url,
        "https://database.example.test/rest/v1/wor_state?id=eq.true&select=revision,data",
      );
      assert.equal(init.redirect, "manual");
      return Response.json([{ revision: 1, data: { settings: { enabled: true } } }]);
    };
    const repository = createWorStore();
    assert.equal((await repository.read()).data.settings.enabled, true);
    globalThis.fetch = async () =>
      new Response(null, { status: 302, headers: { Location: "https://attacker.example.test" } });
    await assert.rejects(repository.read(), /WOR_STORAGE_302/);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.GVG_SUPABASE_URL;
    else process.env.GVG_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.GVG_SUPABASE_SERVICE_ROLE_KEY;
    else process.env.GVG_SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test("new server feature is off by default, including its bot hook", async () => {
  const old = process.env.WOR_ENABLED;
  const oldBootstrap = process.env.WOR_BOOTSTRAP_SHA256;
  try {
    process.env.WOR_ENABLED = "false";
    assert.equal(await handleWorUpdate({ message: { text: "/devices" } }), false);
    assert.equal(
      (await handleWor(new Request("https://example.test/api/wor/start", { method: "POST" })))
        .status,
      503,
    );
    process.env.WOR_ENABLED = "true";
    assert.equal(await handleWorUpdate({ callback_query: { data: "tower:list" } }), false);
    process.env.WOR_BOOTSTRAP_SHA256 = await sha256("test-operator-credential");
    assert.equal(
      (
        await handleWor(
          new Request("https://example.test/api/wor/bootstrap", {
            method: "POST",
            headers: { Authorization: "Bearer invalid" },
          }),
        )
      ).status,
      404,
    );
  } finally {
    if (old === undefined) delete process.env.WOR_ENABLED;
    else process.env.WOR_ENABLED = old;
    if (oldBootstrap === undefined) delete process.env.WOR_BOOTSTRAP_SHA256;
    else process.env.WOR_BOOTSTRAP_SHA256 = oldBootstrap;
  }
});

test("private runtime configuration defaults off and environment can force-disable", async () => {
  const repo = (enabled) => ({ read: async () => ({ data: { settings: { enabled } } }) });
  assert.equal(await worEnabled(repo(undefined), {}), false);
  assert.equal(await worEnabled(repo(true), {}), true);
  assert.equal(await worEnabled(repo(true), { WOR_ENABLED: "false" }), false);
  assert.equal(
    await worEnabled(
      {
        read: async () => {
          throw Error("unavailable");
        },
      },
      {},
    ),
    false,
  );
});

async function fixture() {
  const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  const pk = base64url(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  let state = {
    requests: [],
    members: [],
    devices: [],
    sessions: [],
    releases: [],
    tables: [],
    audit: [],
    settings: {
      owner_id: "100",
      clan_chat_id: "-1003978316922",
      confirmation_thread_id: 6,
      bot_username: "Test_bot",
      license_public_key: "test",
      device_limit: 2,
    },
  };
  let timestamp = Date.now(),
    queue = Promise.resolve();
  const objects = new Map(),
    calls = [],
    statuses = new Map();
  let denyRate = false,
    tgError = false;
  const store = {
    read: async () => ({ revision: 0, data: structuredClone(state) }),
    transaction: (fn) => {
      const next = queue.then(async () => {
        const copy = structuredClone(state),
          result = await fn(copy);
        state = copy;
        return result;
      });
      queue = next.catch(() => {});
      return next;
    },
    rpc: async (name) => (name === "wor_license_key" ? pk : !denyRate),
    get: async (object) => {
      if (!objects.has(object)) throw Error("missing");
      return new Response(objects.get(object));
    },
    put: async (object, body) => {
      if (objects.has(object)) throw Error("immutable");
      objects.set(object, new Uint8Array(await new Response(body).arrayBuffer()));
      return new Response();
    },
    remove: async (names) => names.forEach((n) => objects.delete(n)),
    snapshot: async () => {},
  };
  const telegram = async (method, params) => {
    calls.push({ method, params });
    if (tgError) throw Error("network");
    if (method === "getChatMember")
      return {
        status: statuses.get(params.user_id) ?? "member",
        user: { id: Number(params.user_id), first_name: "Тест", is_bot: false },
      };
    return {};
  };
  const service = createWorService({ store, telegram, clock: () => timestamp });
  const req = (path, data, extra = {}) =>
    new Request("https://example.test" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1", ...extra },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
  async function start(code = "AAAA-BBBB-CCCC-DDDD", kind = "activation") {
    const poll_secret = randomSecret(),
      b = {
        poll_hash: await sha256(poll_secret),
        ...(kind === "activation" ? { machine_code: code, app_version: "1.0.0" } : {}),
      };
    const r = await service.http(
      req(kind === "admin" ? "/api/wor/admin/start" : "/api/wor/start", b, {
        Origin: "https://example.test",
      }),
    );
    assert.equal(r.status, 200);
    return { ...(await r.json()), poll_secret };
  }
  const begin = (r, id = 100, chat = { id, type: "private" }) =>
    service.bot({ message: { message_id: 1, from: { id }, chat, text: "/start " + r.request_id } });
  const confirm = (r, id = 100, thread = 6) =>
    service.bot({
      callback_query: {
        id: "cb",
        data: "wor:yes:" + r.request_id,
        from: { id },
        message: {
          message_id: 2,
          message_thread_id: thread,
          chat: { id: -1003978316922, type: "supergroup" },
        },
      },
    });
  const poll = (r) =>
    service.http(req("/api/wor/poll", { request_id: r.request_id, poll_secret: r.poll_secret }));
  async function activate(code, id = 100) {
    const r = await start(code);
    await begin(r, id);
    await confirm(r, id);
    const response = await poll(r);
    assert.equal(response.status, 200);
    return response.json();
  }
  return {
    service,
    req,
    start,
    begin,
    confirm,
    poll,
    activate,
    objects,
    calls,
    statuses,
    get state() {
      return state;
    },
    advance: (ms) => (timestamp += ms),
    denyRate: () => (denyRate = true),
    tgError: () => (tgError = true),
  };
}
test("strict license payload UTF-8, order and independent Ed25519 verification", async () => {
  const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]),
    pk = base64url(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  assert.equal(
    licensePayload("AAAA-BBBB-CCCC-DDDD", "Тест", "2030-01-01"),
    '{"v":1,"m":"AAAA-BBBB-CCCC-DDDD","n":"Тест","e":"2030-01-01"}',
  );
  const cert = await signLicense(pk, "AAAA-BBBB-CCCC-DDDD", "Тест", "2030-01-01"),
    [payload, sig] = cert.split(".");
  assert.ok(!cert.includes("="));
  const pub = createPublicKey({
    key: Buffer.from(await crypto.subtle.exportKey("spki", pair.publicKey)),
    format: "der",
    type: "spki",
  });
  assert.equal(
    verify(null, Buffer.from(payload, "base64url"), pub, Buffer.from(sig, "base64url")),
    true,
  );
  assert.equal(
    verify(null, Buffer.from(payload, "base64url").subarray(1), pub, Buffer.from(sig, "base64url")),
    false,
  );
  assert.throws(() => licensePayload("AAAA-BBBB-CCCC-1111", "Тест", "2030-01-01"));
  assert.throws(() => licensePayload("AAAA-BBBB-CCCC-DDDD", "Тест", "2030-02-30"));
});
test("poll pending, proof validation, topic-only confirmation and one-time concurrent issue", async () => {
  const f = await fixture(),
    r = await f.start();
  assert.match(r.activate_url, /^https:\/\/t.me\/Test_bot\?start=/);
  assert.equal(r.request_id.length, 43);
  assert.equal((await f.poll(r)).status, 202);
  const wrong = await f.service.http(
    f.req("/api/wor/poll", { request_id: r.request_id, poll_secret: randomSecret() }),
  );
  assert.equal(wrong.status, 403);
  await f.begin(r);
  const sent = f.calls.find((x) => x.method === "sendMessage");
  assert.equal(sent.params.chat_id, "-1003978316922");
  assert.equal(sent.params.message_thread_id, 6);
  await f.confirm(r, 101);
  assert.equal(f.state.requests[0].status, "pending");
  await f.confirm(r, 100, 8);
  assert.equal(f.state.requests[0].status, "pending");
  await f.confirm(r);
  assert.equal(f.state.requests[0].status, "approved");
  const responses = await Promise.all([f.poll(r), f.poll(r)]);
  assert.deepEqual(responses.map((x) => x.status).sort(), [200, 403]);
  const issued = await responses.find((x) => x.status === 200).json();
  assert.equal(issued.valid_days, 7);
  assert.equal(f.state.devices[0].owner, "100");
  assert.equal(f.state.devices[0].refresh_hash, await sha256(issued.refresh_secret));
  assert.ok(!JSON.stringify(f.state).includes(issued.refresh_secret));
  assert.equal((await f.poll(r)).status, 403);
});
test("unrelated bot updates, group commands and unrelated deep links preserve routing", async () => {
  const f = await fixture();
  assert.equal(
    await f.service.bot({
      message: {
        text: "/+",
        from: { id: 100 },
        chat: { id: -1003978316922, type: "supergroup" },
        message_thread_id: 8,
      },
    }),
    false,
  );
  assert.equal(
    await f.service.bot({ callback_query: { data: "tower:list", from: { id: 100 } } }),
    false,
  );
  assert.equal(await f.begin({ request_id: randomSecret() }), false);
  assert.equal(
    await f.service.bot({
      message: {
        text: "/devices",
        from: { id: 100 },
        chat: { id: -1003978316922, type: "supergroup" },
        message_thread_id: 6,
      },
    }),
    false,
  );
  assert.equal(f.calls.length, 0);
});
test("expired requests and limits cannot issue extra devices", async () => {
  const f = await fixture(),
    r = await f.start();
  f.advance(600001);
  assert.equal((await (await f.poll(r)).json()).code, "expired");
  await f.activate("AAAA-BBBB-CCCC-EEEE");
  await f.activate("AAAA-BBBB-CCCC-FFFF");
  const third = await f.start("AAAA-BBBB-CCCC-GGGG");
  await f.begin(third);
  await f.confirm(third);
  assert.equal((await (await f.poll(third)).json()).code, "device_limit");
  assert.equal(f.state.devices.length, 2);
});
test("renew rechecks membership after three-minute cache, denies failures and bans", async () => {
  const f = await fixture(),
    a = await f.activate();
  const b = {
    machine_code: "AAAA-BBBB-CCCC-DDDD",
    app_version: "1.0.1",
    refresh_secret: a.refresh_secret,
  };
  assert.equal((await f.service.http(f.req("/api/wor/renew", b))).status, 200);
  f.statuses.set("100", "left");
  f.advance(180001);
  assert.equal(
    (await (await f.service.http(f.req("/api/wor/renew", b))).json()).code,
    "member_removed",
  );
  const f2 = await fixture(),
    a2 = await f2.activate();
  f2.advance(180001);
  f2.tgError();
  assert.equal(
    (
      await (
        await f2.service.http(f2.req("/api/wor/renew", { ...b, refresh_secret: a2.refresh_secret }))
      ).json()
    ).code,
    "server_error",
  );
});
test("strict request schemas, HTTPS and rate limiting", async () => {
  const f = await fixture();
  assert.equal(
    (
      await f.service.http(
        f.req("/api/wor/start", {
          machine_code: "AAAA-BBBB-CCCC-DDDD",
          app_version: "1.0.0",
          poll_hash: await sha256("x"),
          game_data: "forbidden",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await f.service.http(new Request("http://example.test/api/wor/start", { method: "POST" })))
      .status,
    400,
  );
  f.denyRate();
  assert.equal(
    (await (await f.service.http(f.req("/api/wor/start", {}))).json()).code,
    "rate_limited",
  );
});
test("owner admin login uses same topic, HttpOnly cookie and CSRF; other users rejected", async () => {
  const f = await fixture(),
    r = await f.start(undefined, "admin");
  await f.begin(r, 101);
  assert.equal(f.state.requests[0].requester, undefined);
  await f.begin(r);
  await f.confirm(r);
  const p = await f.service.http(
    f.req(
      "/api/wor/admin/poll",
      { request_id: r.request_id, poll_secret: r.poll_secret },
      { Origin: "https://example.test" },
    ),
  );
  assert.equal(p.status, 200);
  const c = p.headers.get("Set-Cookie");
  assert.match(c, /HttpOnly; SameSite=Strict/);
  const { csrf } = await p.json(),
    headers = { Cookie: c.split(";")[0], Origin: "https://example.test", "X-CSRF-Token": csrf };
  assert.equal(
    (
      await f.service.http(
        f.req("/api/wor/admin/action", { action: "limit", target: "default", value: "3" }, headers),
      )
    ).status,
    200,
  );
  assert.equal(f.state.settings.device_limit, 3);
  assert.equal(
    (
      await f.service.http(
        f.req(
          "/api/wor/admin/action",
          { action: "limit", target: "default", value: "4" },
          { ...headers, "X-CSRF-Token": "wrong" },
        ),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await f.service.http(
        f.req(
          "/api/wor/admin/action",
          { action: "limit", target: "default", value: "4" },
          { ...headers, Origin: "https://attacker.test" },
        ),
      )
    ).status,
    403,
  );
});
test("tables and manifest bytes are delivered unchanged; unauthorized downloads fail", async () => {
  const f = await fixture(),
    a = await f.activate();
  const admin = await f.start(undefined, "admin");
  await f.begin(admin);
  await f.confirm(admin);
  const p = await f.service.http(
    f.req(
      "/api/wor/admin/poll",
      { request_id: admin.request_id, poll_secret: admin.poll_secret },
      { Origin: "https://example.test" },
    ),
  );
  const { csrf } = await p.json(),
    headers = {
      Cookie: p.headers.get("Set-Cookie").split(";")[0],
      Origin: "https://example.test",
      "X-CSRF-Token": csrf,
    };
  const raw = Buffer.from(
    '{\n "version": "1", "tables": [], "signature": "' + base64url(new Uint8Array(64)) + '"\n}\n',
  );
  const upload = await f.service.http(
    new Request("https://example.test/api/wor/admin/tables", { method: "PUT", headers, body: raw }),
  );
  assert.equal(upload.status, 200);
  const download = new Request("https://example.test/api/wor/tables", {
    headers: {
      Authorization: "Bearer " + a.refresh_secret,
      "X-Machine-Code": "AAAA-BBBB-CCCC-DDDD",
    },
  });
  const result = await f.service.http(download);
  assert.equal(result.status, 200);
  assert.deepEqual(Buffer.from(await result.arrayBuffer()), raw);
  assert.equal(
    (
      await f.service.http(
        new Request("https://example.test/api/wor/tables", {
          headers: {
            Authorization: "Bearer " + randomSecret(),
            "X-Machine-Code": "AAAA-BBBB-CCCC-DDDD",
          },
        }),
      )
    ).status,
    403,
  );
  const manifest = Buffer.from(
    '{"version":"1.2.0","min_version":"1.0.0","url":"/downloads/WoR.exe","sha256":"' +
      "0".repeat(64) +
      '","notes":"Тест","signature":"' +
      base64url(new Uint8Array(64)) +
      '"}\n',
  );
  assert.equal(parseManifest(manifest).version, "1.2.0");
  assert.equal(parseTables(raw).version, "1");
  assert.equal(versionCompare("1.10.0", "1.2.0"), 1);
});
test("admin page has parseable script and no dynamic HTML insertion", async () => {
  const page = worAdminPage(),
    html = await page.text(),
    script = html.match(/<script nonce="[^"]+">([\s\S]*)<\/script>/)[1];
  assert.doesNotThrow(() => new Function(script));
  assert.ok(!script.includes("innerHTML"));
  assert.ok(page.headers.get("Content-Security-Policy").includes("frame-ancestors 'none'"));
});
test("owner commands revoke and ban immediately; nonowners cannot manage devices", async () => {
  const f = await fixture(),
    a = await f.activate("AAAA-BBBB-CCCC-DDDD", 101);
  const command = (id, text) =>
    f.service.bot({
      message: { message_id: 9, from: { id }, chat: { id, type: "private" }, text },
    });
  await command(101, "/revoke AAAA-BBBB-CCCC-DDDD");
  assert.equal(f.state.devices[0].status, "active");
  await command(100, "/limit 101 3");
  assert.equal(f.state.members.find((x) => x.id === "101").limit, 3);
  await command(100, "/revoke AAAA-BBBB-CCCC-DDDD");
  assert.equal(f.state.devices[0].status, "revoked");
  const r = await f.service.http(
    f.req("/api/wor/renew", {
      machine_code: "AAAA-BBBB-CCCC-DDDD",
      app_version: "1.0.0",
      refresh_secret: a.refresh_secret,
    }),
  );
  assert.equal((await r.json()).code, "revoked");
  await f.activate("AAAA-BBBB-CCCC-EEEE", 101);
  await command(100, "/ban 101");
  assert.equal(f.state.members.find((x) => x.id === "101").banned, true);
  assert.equal(f.state.devices[1].status, "revoked");
  await command(100, "/unban 101");
  assert.equal(f.state.members.find((x) => x.id === "101").banned, false);
  assert.equal(f.state.devices[1].status, "revoked");
});
test("signed release bytes, hash check, publish, minimum version and immutable paths", async () => {
  const f = await fixture(),
    a = await f.activate();
  const request = await f.start(undefined, "admin");
  await f.begin(request);
  await f.confirm(request);
  const response = await f.service.http(
      f.req(
        "/api/wor/admin/poll",
        { request_id: request.request_id, poll_secret: request.poll_secret },
        { Origin: "https://example.test" },
      ),
    ),
    { csrf } = await response.json(),
    headers = {
      Cookie: response.headers.get("Set-Cookie").split(";")[0],
      Origin: "https://example.test",
      "X-CSRF-Token": csrf,
    };
  const exe = Buffer.from("MZ-test-fixture"),
    sha = createHash("sha256").update(exe).digest("hex");
  const raw = Buffer.from(
    '{\n"version":"1.2.0","min_version":"1.1.0","url":"/downloads/Test.exe","sha256":"' +
      sha +
      '","notes":"Тест","signature":"' +
      base64url(new Uint8Array(64)) +
      '"\n}\n',
  );
  const manifest = await f.service.http(
    new Request("https://example.test/api/wor/admin/manifest", {
      method: "PUT",
      headers,
      body: raw,
    }),
  );
  assert.equal(manifest.status, 200);
  const { release_id } = await manifest.json();
  const upload = await f.service.http(
    new Request("https://example.test/api/wor/admin/exe/" + release_id, {
      method: "PUT",
      headers,
      body: exe,
    }),
  );
  assert.equal(upload.status, 200);
  assert.equal(
    (await f.service.http(f.req("/api/wor/admin/publish", { release_id }, headers))).status,
    200,
  );
  const deviceHeaders = {
    Authorization: "Bearer " + a.refresh_secret,
    "X-Machine-Code": "AAAA-BBBB-CCCC-DDDD",
    "X-App-Version": "1.1.0",
  };
  const got = await f.service.http(
    new Request("https://example.test/api/wor/update", { headers: deviceHeaders }),
  );
  assert.equal(got.status, 200);
  assert.deepEqual(Buffer.from(await got.arrayBuffer()), raw);
  const binary = await f.service.http(
    new Request("https://example.test/downloads/Test.exe", { headers: deviceHeaders }),
  );
  assert.equal(binary.status, 200);
  assert.deepEqual(Buffer.from(await binary.arrayBuffer()), exe);
  assert.equal(binary.headers.has("Location"), false);
  const old = await f.service.http(
    new Request("https://example.test/api/wor/update", {
      headers: { ...deviceHeaders, "X-App-Version": "1.0.0" },
    }),
  );
  assert.equal((await old.json()).code, "version_too_old");
  assert.equal(
    (await f.service.http(f.req("/api/wor/admin/delete-release", { release_id }, headers))).status,
    403,
  );
  assert.equal(
    (
      await f.service.http(
        new Request("https://example.test/api/wor/admin/manifest", {
          method: "PUT",
          headers,
          body: raw,
        }),
      )
    ).status,
    403,
  );
});
