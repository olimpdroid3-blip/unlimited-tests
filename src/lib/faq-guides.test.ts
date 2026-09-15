import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { FAQ_GUIDES, getFaqGuide } from "./faq-guides.ts";

const publicRoot = new URL("../../public/", import.meta.url);

test("every guide download is a shipped PDF and every illustration matches its declared format", () => {
  for (const guide of FAQ_GUIDES) {
    const pdf = readFileSync(new URL(guide.pdf.slice(1), publicRoot));
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-", guide.pdf);
    for (const section of guide.sections) {
      for (const block of section.blocks) {
        if (block.kind !== "image") continue;
        const image = readFileSync(new URL(block.src.slice(1), publicRoot));
        if (block.src.endsWith(".jpg")) {
          assert.equal(image.subarray(0, 3).toString("hex"), "ffd8ff", block.src);
        } else {
          assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", block.src);
        }
      }
    }
  }
});

test("unknown and inherited property names never resolve to a guide", () => {
  for (const id of ["", "missing", "constructor", "__proto__", "../defense"]) {
    assert.equal(getFaqGuide(id), undefined);
  }
  assert.equal(getFaqGuide("defense")?.id, "defense");
});
