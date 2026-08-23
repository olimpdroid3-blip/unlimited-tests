import assert from "node:assert/strict";
import test from "node:test";

import { filterHeroOptions } from "./hero-picker.ts";

test("returns every matching hero when more than 30 heroes are available", () => {
  const heroes = Array.from({ length: 31 }, (_, index) => ({
    id: `hero-${index + 1}`,
    name_en: `Hero ${index + 1}`,
    name_ru: `Герой ${index + 1}`,
    icon_url: null,
  }));

  const result = filterHeroOptions(heroes, "", [], null);

  assert.equal(result.length, 31);
  assert.equal(result.at(-1)?.id, "hero-31");
});
