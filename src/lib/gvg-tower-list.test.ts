import assert from "node:assert/strict";
import test from "node:test";

import { renderTowerLine, type TowerOrigin } from "./tower-origin.ts";

const telegramOrigin: TowerOrigin = {
  tower_id: "3.6.1",
  source: "telegram",
  telegram_message_id: 42,
  telegram_message_link: "https://t.me/c/3978316922/8/42",
  site_url: null,
  created_at: "2026-09-11T00:00:00.000Z",
};

test("Telegram tower icon precedes the nickname and the whole row is linked", () => {
  assert.equal(
    renderTowerLine("3.6.1", "DrDOOM", [telegramOrigin]),
    '<a href="https://t.me/c/3978316922/8/42">🏰 Вежа 3.6.1 — 🔵➤ DrDOOM</a>',
  );
});

test("web-created tower remains plain and has no Telegram icon", () => {
  const webOrigin: TowerOrigin = {
    ...telegramOrigin,
    source: "web",
    telegram_message_id: null,
    telegram_message_link: null,
    site_url: "https://unlimited-tests.lovable.app/towers?tower=3.6.1",
  };

  assert.equal(renderTowerLine("3.6.1", "DrDOOM", [webOrigin]), "🏰 Вежа 3.6.1 — DrDOOM");
});
