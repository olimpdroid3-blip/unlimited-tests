import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTowerSiteUrl,
  getTowerSourceLink,
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

test("source links use a compact icon for the tower's origin", () => {
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
    icon: "✈️",
    url: "https://t.me/c/3978316922/8/42",
  });
  assert.deepEqual(getTowerSourceLink("1.1.2", origins), {
    icon: "◆",
    url: "https://unlimited-tests.lovable.app/towers?tower=1.1.2",
  });
  assert.equal(getTowerSourceLink("1.2.1", origins), null);
  assert.equal(getTowerSourceLink("1.2.2", origins), null);
});
