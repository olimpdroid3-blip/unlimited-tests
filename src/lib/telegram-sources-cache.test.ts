import assert from "node:assert/strict";
import test from "node:test";
import { createTelegramSourcesCache, type SourceRow } from "./telegram-sources-cache.ts";

function setup(initial: SourceRow[]) {
  let rows = initial;
  let calls = 0;
  let fail = false;
  let t = 0;
  const cache = createTelegramSourcesCache(
    async () => {
      calls++;
      await Promise.resolve();
      if (fail) throw new Error("boom");
      return rows;
    },
    { ttlMs: 60_000, now: () => t },
  );
  return {
    cache,
    calls: () => calls,
    setRows: (r: SourceRow[]) => (rows = r),
    setFail: (f: boolean) => (fail = f),
    advance: (ms: number) => (t += ms),
  };
}
const A = { id: "a", telegram_chat_id: -1003978316922, telegram_thread_id: 8 };

test("sequential hits share one load", async () => {
  const s = setup([A]);
  assert.equal(await s.cache.findSource(-1003978316922, 8), "a");
  assert.equal(await s.cache.findSource(-1003978316922, 8), "a");
  assert.equal(s.calls(), 1);
});

test("parallel first lookups single-flight", async () => {
  const s = setup([A]);
  await Promise.all([1, 2, 3].map(() => s.cache.findSource(-1003978316922, 8)));
  assert.equal(s.calls(), 1);
});

test("TTL expiry triggers one refresh", async () => {
  const s = setup([A]);
  await s.cache.findSource(-1003978316922, 8);
  s.advance(60_001);
  await s.cache.findSource(-1003978316922, 8);
  await s.cache.findSource(-1003978316922, 8);
  assert.equal(s.calls(), 2);
});

test("miss forces refresh and finds new source", async () => {
  const s = setup([A]);
  await s.cache.findSource(-1003978316922, 8);
  s.setRows([A, { id: "b", telegram_chat_id: "5", telegram_thread_id: 0 }]);
  assert.equal(await s.cache.findSource(5, null), "b");
  assert.equal(s.calls(), 2);
});

test("deactivated source is rejected after refresh", async () => {
  const s = setup([A]);
  await s.cache.findSource(-1003978316922, 8);
  s.setRows([]);
  s.advance(60_001);
  assert.equal(await s.cache.findSource(-1003978316922, 8), null);
});

test("refresh error keeps last good cache; no cache ever -> throws", async () => {
  const s = setup([A]);
  await s.cache.findSource(-1003978316922, 8);
  s.setFail(true);
  s.advance(60_001);
  assert.equal(await s.cache.findSource(-1003978316922, 8), "a");
  assert.equal(await s.cache.findSource(1, 1), null);
  const e = setup([A]);
  e.setFail(true);
  await assert.rejects(e.cache.findSource(-1003978316922, 8));
});

test("exact chat/thread matching, null thread = 0", async () => {
  const s = setup([A, { id: "z", telegram_chat_id: 7, telegram_thread_id: 0 }]);
  assert.equal(await s.cache.findSource(-1003978316922, 4), null);
  assert.equal(await s.cache.findSource(-1003978316922, null), null);
  assert.equal(await s.cache.findSource(7, null), "z");
  assert.equal(await s.cache.findSource(7, 0), "z");
});
