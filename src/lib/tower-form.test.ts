import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTowerId } from "./mirror-order.ts";
import {
  BTN_ADD,
  BTN_LIST,
  BTN_MIRRORS,
  buildSummary,
  buildTowerPanelKeyboard,
  canConfirm,
  CB_TOWER_ADD,
  CB_TOWER_LIST,
  collectFormMessageIds,
  isFormExpired,
  isTowerWorkflowThread,
  isUpdateOnlyThread,
  isWalkthroughReviewThread,
  resolveAdminNickname,
  TOWER_CHAT_ID,
  type TowerForm,
} from "./tower-form.ts";

function form(overrides: Partial<TowerForm> = {}): TowerForm {
  return {
    id: "f1",
    chat_id: TOWER_CHAT_ID,
    thread_id: 8,
    user_id: 100,
    nickname: "Fakra",
    step: "confirm",
    tower_id: "2.3.1",
    screenshot_url: "https://example.com/s.jpg",
    screenshot_path: "tg-tower-1.jpg",
    comment: null,
    bot_message_ids: [11, 12],
    user_message_ids: [21],
    submitted: false,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

test("normalizeTowerId accepts every supported separator", () => {
  for (const input of ["2.3.1", "231", "2-3-1", "2 3 1", " 2.3.1 "]) {
    assert.equal(normalizeTowerId(input), "2.3.1");
  }
});

test("normalizeTowerId rejects malformed or out-of-range positions", () => {
  for (const input of ["", "12", "1234", "9.9.9", "5.1.1", "abc"]) {
    assert.equal(normalizeTowerId(input), null);
  }
});

test("workflow runs only in chat -1003978316922 thread 8", () => {
  assert.equal(isTowerWorkflowThread(TOWER_CHAT_ID, 8), true);
  assert.equal(isTowerWorkflowThread(TOWER_CHAT_ID, 4), false);
  assert.equal(isTowerWorkflowThread(TOWER_CHAT_ID, 11), false);
  assert.equal(isTowerWorkflowThread(TOWER_CHAT_ID, null), false);
  assert.equal(isTowerWorkflowThread(-100123, 8), false);
});

test("thread 4 is update-only and never accepts the button captions", () => {
  assert.equal(isUpdateOnlyThread(TOWER_CHAT_ID, 4), true);
  assert.equal(isWalkthroughReviewThread(TOWER_CHAT_ID, 4), false);
  for (const text of [BTN_ADD, BTN_LIST]) {
    assert.ok(text.length > 0);
    assert.equal(isTowerWorkflowThread(TOWER_CHAT_ID, 4), false);
  }
});

test("walkthrough review intake works only in thread 108", () => {
  assert.equal(isWalkthroughReviewThread(TOWER_CHAT_ID, 108), true);
  assert.equal(isWalkthroughReviewThread(TOWER_CHAT_ID, 4), false);
  assert.equal(isWalkthroughReviewThread(TOWER_CHAT_ID, 8), false);
  assert.equal(isWalkthroughReviewThread(-100123, 108), false);
});

test("pinned panel has exactly three buttons in one row", () => {
  const kb = buildTowerPanelKeyboard("https://example.com/towers");
  assert.equal(kb.inline_keyboard.length, 1);
  assert.deepEqual(kb.inline_keyboard[0], [
    { text: BTN_ADD, callback_data: CB_TOWER_ADD },
    { text: BTN_LIST, callback_data: CB_TOWER_LIST },
    { text: BTN_MIRRORS, url: "https://example.com/towers" },
  ]);
});

test("panel callback data is stable and distinct from the form prefix", () => {
  assert.equal(CB_TOWER_ADD, "tower:add");
  assert.equal(CB_TOWER_LIST, "tower:list");
  for (const data of [CB_TOWER_ADD, CB_TOWER_LIST]) {
    assert.equal(data.split("|")[0] === "tw", false);
    assert.ok(Buffer.byteLength(data) <= 64);
  }
});

test("the module exposes no bottom reply keyboard anymore", async () => {
  const mod = (await import("./tower-form.ts")) as Record<string, unknown>;
  assert.equal("TOWER_REPLY_KEYBOARD" in mod, false);
  assert.equal("BTN_MIRROR_KB" in mod, false);
});

test("non-admins cannot start the form", () => {
  assert.equal(resolveAdminNickname({ status: "member", custom_title: "Fakra" }).ok, false);
  assert.equal(resolveAdminNickname(null).ok, false);
});

test("admins without custom_title cannot start the form", () => {
  assert.equal(resolveAdminNickname({ status: "administrator" }).ok, false);
  assert.equal(resolveAdminNickname({ status: "administrator", custom_title: "  " }).ok, false);
});

test("nickname comes from custom_title only", () => {
  assert.deepEqual(resolveAdminNickname({ status: "creator", custom_title: " Fakra " }), {
    ok: true,
    nickname: "Fakra",
  });
});

test("confirmation is allowed only once and only for a complete form", () => {
  assert.equal(canConfirm(form()), true);
  assert.equal(canConfirm(form({ submitted: true })), false);
  assert.equal(canConfirm(form({ step: "comment" })), false);
  assert.equal(canConfirm(form({ screenshot_path: null })), false);
  assert.equal(canConfirm(form({ tower_id: null })), false);
});

test("cleanup collects only this workflow's message ids", () => {
  assert.deepEqual(
    collectFormMessageIds(form({ bot_message_ids: [1, 2, 2], user_message_ids: [2, 3] })),
    [1, 2, 3],
  );
  assert.deepEqual(collectFormMessageIds(form({ bot_message_ids: [], user_message_ids: [] })), []);
});

test("forms expire after the TTL", () => {
  assert.equal(
    isFormExpired(form({ expires_at: new Date(Date.now() - 1000).toISOString() })),
    true,
  );
  assert.equal(isFormExpired(form()), false);
});

test("summary shows tower, nickname, screenshot and comment", () => {
  assert.ok(buildSummary(form({ comment: "нічний тест" })).includes("Вежа: 2.3.1"));
  assert.ok(buildSummary(form()).includes("Коментар: немає"));
  assert.ok(buildSummary(form()).includes("Скріншот: ✅"));
  assert.ok(buildSummary(form()).includes("Нік: Fakra"));
});
