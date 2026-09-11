import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTowerDeleteCancelCallback,
  buildTowerDeleteCallback,
  buildTowerDeleteConfirmCallback,
  buildTowerSiteUrl,
  getTowerSourceLink,
  parseTowerDeleteCallback,
  type TowerOrigin,
} from "./tower-origin.ts";

const origin = (overrides: Partial<TowerOrigin>): TowerOrigin => ({
  tower_id: "1.1.1",
  source: "telegram",
  telegram_message_id: 42,
  telegram_message_link: "https://t.me/c/3978316922/8/42",
  site_url: null,
  created_at: "2026-09-11T00:00:00.000Z",
  ...overrides,
});

test("tower site links open the requested tower", () => {
  assert.equal(
    buildTowerSiteUrl("1.2.1"),
    "https://unlimited-tests.lovable.app/towers?tower=1.2.1",
  );
});

test("tower delete callback identifies the requested tower", () => {
  assert.equal(buildTowerDeleteCallback("1.2.1"), "tower:delete:1.2.1");
  assert.equal(buildTowerDeleteConfirmCallback("1.2.1"), "tower:delete:yes:1.2.1");
  assert.equal(buildTowerDeleteCancelCallback("1.2.1"), "tower:delete:no:1.2.1");
  assert.deepEqual(parseTowerDeleteCallback("tower:delete:1.2.1"), {
    action: "request",
    towerId: "1.2.1",
  });
  assert.deepEqual(parseTowerDeleteCallback("tower:delete:yes:1.2.1"), {
    action: "confirm",
    towerId: "1.2.1",
  });
  assert.deepEqual(parseTowerDeleteCallback("tower:delete:no:1.2.1"), {
    action: "cancel",
    towerId: "1.2.1",
  });
});

test("only Telegram origins expose a source link with the compact icon", () => {
  const origins = [
    origin({ tower_id: "1.1.1" }),
    origin({
      tower_id: "1.1.2",
      source: "web",
      telegram_message_id: null,
      telegram_message_link: null,
      site_url: buildTowerSiteUrl("1.1.2"),
    }),
    origin({ tower_id: "1.2.1", telegram_message_link: null }),
  ];

  assert.deepEqual(getTowerSourceLink("1.1.1", origins), {
    icon: "🔵➤",
    url: "https://t.me/c/3978316922/8/42",
  });
  assert.equal(getTowerSourceLink("1.1.2", origins), null);
  assert.equal(getTowerSourceLink("1.2.1", origins), null);
  assert.equal(getTowerSourceLink("1.2.2", origins), null);
});
