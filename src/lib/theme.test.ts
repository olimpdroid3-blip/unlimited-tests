import assert from "node:assert/strict";
import test from "node:test";

import { isTheme, resolveTheme, toggleTheme } from "./theme.ts";

test("uses a stored dark preference instead of a light system preference", () => {
  assert.equal(resolveTheme("dark", false), "dark");
});

test("uses a stored light preference instead of a dark system preference", () => {
  assert.equal(resolveTheme("light", true), "light");
});

test("falls back to the system preference when storage is empty or invalid", () => {
  assert.equal(resolveTheme(null, true), "dark");
  assert.equal(resolveTheme("sepia", false), "light");
});

test("accepts only supported persisted theme values", () => {
  assert.equal(isTheme("light"), true);
  assert.equal(isTheme("dark"), true);
  assert.equal(isTheme("system"), false);
  assert.equal(isTheme(null), false);
});

test("toggles between light and dark themes", () => {
  assert.equal(toggleTheme("light"), "dark");
  assert.equal(toggleTheme("dark"), "light");
});
