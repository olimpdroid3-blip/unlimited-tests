import assert from "node:assert/strict";
import test from "node:test";
import {
  getTowerStatuses,
  getTowerStatusUpdate,
  getTowerSaveUpdate,
  getTowerCardStatusFlags,
} from "./tower-status.ts";

test("shows breached, testing and removed at the same time", () => {
  assert.deepEqual(getTowerStatuses({ breached: true, testing: true, removed: true }), [
    "breached",
    "testing",
    "removed",
  ]);
});

test("toggling testing preserves breached, removed and previous owner", () => {
  const next = getTowerStatusUpdate(
    { breached: true, removed: true, previous_nickname: "Owner" },
    "testing",
    true,
    "Viewer",
  );
  assert.equal(next.breached, true);
  assert.equal(next.removed, true);
  assert.equal(next.testing, true);
  assert.equal(next.nickname, null);
  assert.equal(next.previous_nickname, "Owner");
});

test("removing a defense keeps its saved owner and other statuses", () => {
  const next = getTowerStatusUpdate(
    { nickname: "Owner", testing: true, breached: true },
    "removed",
    true,
    "Viewer",
  );
  assert.equal(next.previous_nickname, "Owner");
  assert.equal(next.nickname, null);
  assert.equal(next.testing, true);
  assert.equal(next.breached, true);
  assert.equal(next.removed, true);
});

test("unchecking removed preserves history without marking the defense as placed", () => {
  const next = getTowerStatusUpdate(
    { removed: true, breached: true, testing: true, previous_nickname: "Owner" },
    "removed",
    false,
    " New player ",
  );
  assert.equal(next.nickname, null);
  assert.equal(next.placed, false);
  assert.equal(next.previous_nickname, "Owner");
  assert.equal(next.removed, false);
  assert.equal(next.testing, true);
  assert.equal(next.breached, true);
});

test("destroyed replaces breached without clearing testing or removed", () => {
  const next = getTowerStatusUpdate(
    { breached: true, testing: true, removed: true },
    "destroyed",
    true,
    "",
  );
  assert.equal(next.breached, false);
  assert.deepEqual(getTowerStatuses(next), ["testing", "destroyed", "removed"]);
});

test("selecting breached clears destroyed", () => {
  const next = getTowerStatusUpdate({ destroyed: true }, "breached", true, "");
  assert.equal(next.destroyed, false);
  assert.deepEqual(getTowerStatuses(next), ["breached"]);
});

test("legacy records with both flags show only destroyed and normalize on save", () => {
  const legacy = { breached: true, destroyed: true };
  assert.deepEqual(getTowerStatuses(legacy), ["destroyed"]);
  assert.equal(getTowerSaveUpdate(legacy, "Owner").breached, false);
});

test("unchecking destroyed does not restore breached", () => {
  const next = getTowerStatusUpdate({ destroyed: true, breached: true }, "destroyed", false, "");
  assert.deepEqual(getTowerStatuses(next), []);
});

test("unchecking breached preserves destroyed", () => {
  const next = getTowerStatusUpdate({ destroyed: true }, "breached", false, "");
  assert.deepEqual(getTowerStatuses(next), ["destroyed"]);
});

test("legacy and empty records retain their existing meaning", () => {
  assert.deepEqual(getTowerStatuses(undefined), []);
  assert.deepEqual(getTowerStatuses({ breached: true }), ["breached"]);
  assert.deepEqual(getTowerStatuses({ breached: false }), []);
});

test("saving a removed defense keeps it removed and preserves its previous owner", () => {
  const removed = getTowerStatusUpdate(
    { placed: true, nickname: "Owner", breached: true, testing: true },
    "removed",
    true,
    "Viewer",
  );
  const next = getTowerSaveUpdate(removed, "Viewer");
  assert.deepEqual(getTowerStatuses(next), ["breached", "testing", "removed"]);
  assert.equal(next.placed, false);
  assert.equal(next.nickname, null);
  assert.equal(next.previous_nickname, "Owner");
});

test("explicit placement restores a removed defense without resetting other flags", () => {
  const next = getTowerSaveUpdate(
    { removed: true, breached: true, testing: true, previous_nickname: "Owner" },
    "New owner",
    { placeAgain: true },
  );
  assert.deepEqual(getTowerStatuses(next), ["placed", "breached", "testing"]);
  assert.equal(next.removed, false);
  assert.equal(next.nickname, "New owner");
  assert.equal(next.previous_nickname, "Owner");
});

test("status toggles alone do not mark an empty tower as placed", () => {
  assert.equal(getTowerStatusUpdate(undefined, "testing", true, "Viewer").placed, false);
  assert.equal(getTowerSaveUpdate(undefined, "Viewer").placed, true);
  assert.equal(getTowerStatusUpdate({ placed: true }, "removed", true, "Viewer").placed, false);
});

test("do not attack can be enabled and removed independently", () => {
  const next = getTowerStatusUpdate({ testing: true }, "do_not_attack", true, "");
  assert.deepEqual(getTowerStatuses(next), ["testing", "do_not_attack"]);
  assert.equal(next.placed, false);
  const cleared = getTowerStatusUpdate(next, "do_not_attack", false, "");
  assert.deepEqual(getTowerStatuses(cleared), ["testing"]);
});

test("saving and changing other statuses preserves do not attack", () => {
  const existing = { do_not_attack: true, breached: true };
  assert.equal(getTowerSaveUpdate(existing, "Owner").do_not_attack, true);
  const next = getTowerStatusUpdate(existing, "destroyed", true, "Owner");
  assert.deepEqual(getTowerStatuses(next), ["destroyed", "do_not_attack"]);
});

test("an inactive copy shows placement instead of its historical damage when another copy is active", () => {
  const flags = getTowerCardStatusFlags(
    { removed: true, destroyed: true, do_not_attack: true },
    true,
    false,
  );
  assert.deepEqual(getTowerStatuses(flags), ["placed", "do_not_attack"]);
});

test("without active copies the card keeps local damage but has no placed tag", () => {
  const flags = getTowerCardStatusFlags({ placed: true, destroyed: true }, false, false);
  assert.deepEqual(getTowerStatuses(flags), ["destroyed"]);
});

test("an active copy retains its own testing and breached markers", () => {
  const flags = getTowerCardStatusFlags(
    { placed: true, breached: true, testing: true },
    true,
    true,
  );
  assert.deepEqual(getTowerStatuses(flags), ["placed", "breached", "testing"]);
});
