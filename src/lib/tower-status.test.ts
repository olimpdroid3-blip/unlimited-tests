import assert from "node:assert/strict";
import test from "node:test";
import { getTowerStatuses, getTowerStatusUpdate, getTowerSaveUpdate } from "./tower-status.ts";

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

test("destroyed implies breached without clearing testing or removed", () => {
  const next = getTowerStatusUpdate({ testing: true, removed: true }, "destroyed", true, "");
  assert.deepEqual(getTowerStatuses(next), ["breached", "testing", "destroyed", "removed"]);
});

test("unchecking destroyed leaves breached set; unchecking breached also clears destroyed", () => {
  assert.equal(
    getTowerStatusUpdate({ destroyed: true, breached: true }, "destroyed", false, "").breached,
    true,
  );
  assert.equal(
    getTowerStatusUpdate({ destroyed: true, breached: true, testing: true }, "breached", false, "")
      .destroyed,
    false,
  );
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
