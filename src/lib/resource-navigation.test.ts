import assert from "node:assert/strict";
import test from "node:test";

import {
  LANDING_SECTIONS,
  PLAYER_PROGRESS_SECTIONS,
  WALKTHROUGH_SECTIONS,
} from "./resource-navigation.ts";

test("groups battle power and mob levels under the БС та моби landing section", () => {
  assert.deepEqual(
    LANDING_SECTIONS.map(({ title, to }) => ({ title, to })),
    [
      { title: "Вежі", to: "/towers" },
      { title: "БС та моби", to: "/progress" },
      { title: "Проходки", to: "/walkthroughs" },
    ],
  );

  assert.deepEqual(
    PLAYER_PROGRESS_SECTIONS.map(({ title, to }) => ({ title, to })),
    [
      { title: "Бойова Сила", to: "/battle-power" },
      { title: "Рівні мобів", to: "/mob-levels" },
    ],
  );
});

test("groups defenses and videos under the Проходки landing section", () => {
  assert.deepEqual(
    WALKTHROUGH_SECTIONS.map(({ title, to }) => ({ title, to })),
    [
      { title: "База захистів", to: "/defenses" },
      { title: "Відео проходок", to: "/videos" },
    ],
  );
});
