import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTowerSiteUrl,
  buildTowerSourceButtons,
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
  assert.equal(buildTowerSiteUrl("1.2.1"), "https://unlimited-tests.lovable.app/towers?tower=1.2.1");
});

test("source buttons include only origins with direct links", () => {
  const rows = buildTowerSourceButtons(
    ["1.1.1", "1.1.2", "1.2.1", "1.2.2"],
    [
      origin({ tower_id: "1.1.1" }),
      origin({
        tower_id: "1.1.2",
        source: "web",
        telegram_message_id: null,
        telegram_message_link: null,
        site_url: buildTowerSiteUrl("1.1.2"),
      }),
      origin({ tower_id: "1.2.1", telegram_message_link: null }),
    ],
  );

  assert.deepEqual(rows, [[
    { text: "Telegram · 1.1.1", url: "https://t.me/c/3978316922/8/42" },
    { text: "UU · 1.1.2", url: "https://unlimited-tests.lovable.app/towers?tower=1.1.2" },
  ]]);
});