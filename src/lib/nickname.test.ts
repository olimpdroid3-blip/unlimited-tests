import assert from "node:assert/strict";
import test from "node:test";

import { filterNicknameOptions, findPlayerIdByNickname, resolveNicknameSave } from "./nickname.ts";

const players = [
  { id: "player-alex", nickname: "Alex" },
  { id: "player-skye", nickname: "Skye" },
];

test("uses an existing nickname when input only differs by case and whitespace", () => {
  assert.deepEqual(resolveNicknameSave("  aLeX  ", players), {
    kind: "existing",
    nickname: "Alex",
  });
});

test("returns a trimmed new nickname when no existing player matches", () => {
  assert.deepEqual(resolveNicknameSave("  New Player  ", players), {
    kind: "create",
    nickname: "New Player",
  });
});

test("rejects an empty nickname", () => {
  assert.deepEqual(resolveNicknameSave("   ", players), { kind: "empty" });
});

test("filters dropdown options case-insensitively and ignores surrounding whitespace", () => {
  assert.deepEqual(filterNicknameOptions(players, "  SKY "), [
    { id: "player-skye", nickname: "Skye" },
  ]);
});

test("shows every dropdown option when the search is empty", () => {
  assert.deepEqual(filterNicknameOptions(players, ""), players);
});

test("finds the player id for a saved nickname without case or whitespace sensitivity", () => {
  assert.equal(findPlayerIdByNickname(players, "  sKyE  "), "player-skye");
  assert.equal(findPlayerIdByNickname(players, "Unknown"), undefined);
});
