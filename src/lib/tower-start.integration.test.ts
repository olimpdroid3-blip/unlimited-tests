import assert from "node:assert/strict";
import test from "node:test";
import { BTN_ADD, TOWER_CHAT_ID, type ChatMemberInfo, type TowerActor, type TowerForm } from "./tower-form.ts";

// Bun's module mocks isolate every server dependency; no credentials or live IO.
// The regular Node suite still runs all pure policy tests in tower-form.test.ts.
if (!process.versions.bun) {
  test("tower-start integration requires Bun module mocks", { skip: true }, () => {});
} else {
  const bunModule = "bun:test";
  const { mock } = await import(bunModule) as { mock: { module: (path: string, factory: () => unknown) => void } };
  let forms: TowerForm[] = [];
  let calls: { method: string; body: Record<string, unknown> }[] = [];
  type LookupMode = "success" | "api-failure" | "http-failure" | "exception";
  let lookup: LookupMode = "success";
  let member: ChatMemberInfo;
  const storage = {
    list: async () => ({ data: [], error: null }),
    upload: async (_path: string, blob: Blob) => {
      forms.push(JSON.parse(await blob.text()) as TowerForm);
      return { error: null };
    },
    remove: async () => { throw new Error("Unexpected record removal"); },
    createSignedUrl: async () => { throw new Error("Unexpected state read"); },
  };
  mock.module("@/lib/db.server", () => ({ supabaseAdmin: { storage: { from: () => storage } } }));
  const forbidden = async () => { throw new Error("Unexpected live-operation path"); };
  mock.module("@/lib/gvg-tower-requests.server", () => ({ deletePlacedTower: forbidden, markPlacedTowerBreached: forbidden, upsertPlacedTower: forbidden }));
  mock.module("@/lib/gvg-tower-list.server", () => ({ handleTowerListCommand: forbidden }));
  mock.module("@/lib/gvg-tower-notify.server", () => ({ deleteTelegramMessage: forbidden, ensureTowerSourceDeleteButton: forbidden, showTowerSourceBreachConfirmation: forbidden, showTowerSourceDeleteConfirmation: forbidden }));
  mock.module("@/lib/tower-origin.server", () => ({ listTowerOrigins: forbidden }));
  const { handleTowerWorkflowMessage, handleTowerFormCallback, startTowerForm } = await import("./gvg-tower-form.server.ts");

  async function isolated(run: () => Promise<void>) {
    forms = [];
    calls = [];
    const originalFetch = globalThis.fetch;
    const originalToken = process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
    process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"] = "local-mocked-token";
    globalThis.fetch = async (input, init) => {
      const method = String(input).split("/").pop() ?? "";
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ method, body });
      if (method === "getChatMember") {
        if (lookup === "exception") throw new Error("Mocked transport failure");
        if (lookup === "http-failure") return new Response("unavailable", { status: 503 });
        if (lookup === "api-failure") return Response.json({ ok: false, description: "Mocked API failure" });
        return Response.json({ ok: true, result: member });
      }
      assert.ok(["sendMessage", "answerCallbackQuery"].includes(method), `Unexpected Telegram method ${method}`);
      return Response.json({ ok: true, result: { message_id: 900 + calls.length } });
    };
    try { await run(); } finally {
      globalThis.fetch = originalFetch;
      if (originalToken === undefined) delete process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"];
      else process.env["TELEGRAM_GVG_VIDEO_BOT_TOKEN"] = originalToken;
    }
  }

  const actor = { id: 123456, username: "actual_actor", first_name: "Actual", last_name: "Actor" };
  const cases: { label: string; member: ChatMemberInfo; nickname: string; lookup?: LookupMode; actor?: TowerActor }[] = [
    { label: "member with tag", member: { status: "member", tag: " Clan " }, nickname: "Clan" },
    { label: "member without tag", member: { status: "member" }, nickname: "@actual_actor" },
    { label: "admin with title", member: { status: "administrator", custom_title: " Boss " }, nickname: "Boss" },
    { label: "admin without title", member: { status: "administrator", tag: "Wrong" }, nickname: "@actual_actor" },
    { label: "owner without title", member: { status: "creator" }, nickname: "@actual_actor" },
    { label: "restricted", member: { status: "restricted" }, nickname: "@actual_actor" },
    { label: "missing result", member: undefined, nickname: "@actual_actor" },
    { label: "API failure", member: null, lookup: "api-failure", nickname: "@actual_actor" },
    { label: "HTTP failure", member: null, lookup: "http-failure", nickname: "@actual_actor" },
    { label: "lookup exception", member: null, lookup: "exception", nickname: "@actual_actor" },
    { label: "full name fallback", member: null, actor: { id: actor.id, first_name: " First ", last_name: " Last " }, nickname: "First Last" },
    { label: "ID fallback", member: null, actor: { id: actor.id }, nickname: `Telegram ${actor.id}` },
  ];
  for (const entry of ["reply", "inline"] as const) {
    for (const scenario of cases) {
      test(`${entry} tower form opens: ${scenario.label}, with actual actor profile`, async () => {
        member = scenario.member;
        lookup = scenario.lookup ?? "success";
        await isolated(async () => {
          const from = scenario.actor ?? actor;
          if (entry === "reply") {
            assert.equal(await handleTowerWorkflowMessage({ message_id: 42, chat: { id: TOWER_CHAT_ID }, message_thread_id: 8, from, text: BTN_ADD }), true);
          } else {
            // Extra bot profile on callback.message must never become the actor.
            const callback = { id: "callback", data: "tower:add", from, message: { message_id: 10, chat: { id: TOWER_CHAT_ID }, message_thread_id: 8, from: { id: 999, username: "bot_author" } } };
            assert.equal(await handleTowerFormCallback(callback), true);
            assert.equal(calls.filter(c => c.method === "answerCallbackQuery").length, 1);
          }
          const saved = forms.at(-1);
          assert.ok(saved);
          assert.equal(saved.user_id, actor.id);
          assert.equal(saved.nickname, scenario.nickname);
          assert.equal(saved.step, "position");
          assert.equal(saved.thread_id, 8);
          assert.equal(Date.parse(saved.expires_at) - Date.parse(saved.created_at), 30 * 60 * 1000);
          assert.deepEqual(saved.user_message_ids, entry === "reply" ? [42] : []);
          assert.deepEqual(calls.find(c => c.method === "getChatMember")?.body, { chat_id: TOWER_CHAT_ID, user_id: actor.id });
          assert.equal(calls.filter(c => c.method === "sendMessage").length, 2);
        });
      });
    }
  }
  test("tower entry rejects malformed actors and wrong chat/reply topic before IO", async () => {
    await isolated(async () => {
      await startTowerForm(TOWER_CHAT_ID, { id: -1 });
      await startTowerForm(-100123, actor);
      assert.equal(await handleTowerWorkflowMessage({ chat: { id: TOWER_CHAT_ID }, message_thread_id: 108, from: actor, text: BTN_ADD }), false);
      assert.equal(await handleTowerWorkflowMessage({ chat: { id: TOWER_CHAT_ID }, message_thread_id: 8, from: {}, text: BTN_ADD }), false);
      assert.deepEqual(calls, []);
      assert.deepEqual(forms, []);
    });
  });
  test("inline panel preserves configured-chat-only location rule, not bot identity", async () => {
    await isolated(async () => {
      await handleTowerFormCallback({ id: "wrong-chat", data: "tower:add", from: actor, message: { chat: { id: -100123 }, message_thread_id: 8 } });
      await handleTowerFormCallback({ id: "missing-actor", data: "tower:add", message: { chat: { id: TOWER_CHAT_ID }, message_thread_id: 8 } });
      assert.deepEqual(calls.map(c => c.method), ["answerCallbackQuery", "answerCallbackQuery"]);
      assert.deepEqual(forms, []);
    });
  });
}