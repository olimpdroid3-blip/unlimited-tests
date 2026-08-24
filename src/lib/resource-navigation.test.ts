import assert from "node:assert/strict";
import test from "node:test";

import * as resourceNavigation from "./resource-navigation.ts";
import {
  LANDING_SECTIONS,
  PLAYER_PROGRESS_SECTIONS,
  WALKTHROUGH_SECTIONS,
} from "./resource-navigation.ts";

test("returns each resource page to its direct parent section", () => {
  const resourceBackLinks = (
    resourceNavigation as typeof resourceNavigation & {
      RESOURCE_BACK_LINKS?: Record<string, { label: string; to: string }>;
    }
  ).RESOURCE_BACK_LINKS;

  assert.deepEqual(resourceBackLinks, {
    "/progress": { label: "На головну", to: "/" },
    "/walkthroughs": { label: "На головну", to: "/" },
    "/battle-power": { label: "Назад", to: "/progress" },
    "/mob-levels": { label: "Назад", to: "/progress" },
    "/defenses": { label: "Назад", to: "/walkthroughs" },
    "/videos": { label: "Назад", to: "/walkthroughs" },
  });
});

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
