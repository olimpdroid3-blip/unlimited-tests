import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const EXPECTED_NEW_MOBS = [
  [
    "mob-48",
    "Моб 48",
    "/mobs/image47.jpg",
    "demon",
    "epic",
    "206b28d97de6691f4849a9be3d3de64e20a7889a7811bd59f31c3e3cc13ee98f",
  ],
  [
    "mob-49",
    "Моб 49",
    "/mobs/image48.jpg",
    "demon",
    "epic",
    "17a7975cf74470b0e8dbe7a003f014a6acd07178326d3374b111cf4367fd8ed2",
  ],
  [
    "mob-50",
    "Моб 50",
    "/mobs/image49.jpg",
    "demon",
    "epic",
    "216a16b1ca6ff1a862d81e49d49d7e1119124c0a958fe938e9a476d1ee5ab96a",
  ],
  [
    "mob-51",
    "Моб 51",
    "/mobs/image50.jpg",
    "demon",
    "epic",
    "a0058ab48dd18b20cddaf69c3b8250d17fa7f6298f22f62bcbad4024efefc84d",
  ],
  [
    "mob-52",
    "Моб 52",
    "/mobs/image51.jpg",
    "demon",
    "epic",
    "fe457810bb4330ffe2b1a8ff5037010e43307b4121c088512f450eef1bfb6956",
  ],
  [
    "mob-53",
    "Моб 53",
    "/mobs/image52.jpg",
    "demon",
    "epic",
    "77cbb1d1ebee690e02290a534dd7c766997e7ec16b867b69a8555e7c567c1d53",
  ],
] as const;

test("ships the six new mob catalog rows with their public images", () => {
  const projectRoot = path.resolve(import.meta.dirname, "../..");
  const migrationSql = readFileSync(
    path.join(projectRoot, "supabase/migrations/20260824113000_add_six_mobs.sql"),
    "utf8",
  );

  for (const [id, name, imageUrl, mobType, rarity, expectedHash] of EXPECTED_NEW_MOBS) {
    const escapedValues = [id, name, imageUrl, mobType, rarity].map(escapeRegularExpression);
    const rowPattern = new RegExp(`\\('${escapedValues.join("'\\s*,\\s*'")}'\\)`);

    assert.match(migrationSql, rowPattern, `Missing catalog row for ${id}`);

    const imagePath = path.join(projectRoot, "public", imageUrl);
    const imageBytes = readFileSync(imagePath);
    assert.deepEqual([...imageBytes.subarray(0, 3)], [0xff, 0xd8, 0xff]);
    assert.equal(createHash("sha256").update(imageBytes).digest("hex"), expectedHash);
  }
});

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
