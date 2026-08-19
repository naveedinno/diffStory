import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const menu = read("../client/shared/editor-menu.tsx");
const nav = read("../client/shared/nav.tsx");
const hero = read("../client/surfaces/picker/Hero.tsx");
const review = read("../client/surfaces/review/ReviewApp.tsx");
const sharedCss = read("../client/shared/shared.css");
const reviewCss = read("../client/surfaces/review/review.css");

test("source editor menu offers persistent Zed and VS Code radio choices", () => {
  assert.match(menu, /requestJson<EditorPreferenceResponse>\("\/api\/settings\/editor"/);
  assert.match(menu, /method: "PUT"/);
  assert.match(menu, /role="menuitemradio"/);
  assert.match(menu, /aria-checked=\{editor === choice\.value\}/);
  assert.match(menu, /value: "zed", label: "Zed"/);
  assert.match(menu, /value: "vscode", label: "VS Code"/);
  assert.match(menu, /Source editor: \$\{currentLabel\}/);
  assert.match(menu, /Source editor set to \$\{data\.label\}/);
});

test("source editor menu keeps complete keyboard and failure states", () => {
  for (const key of ["Tab", "Escape", "ArrowDown", "ArrowUp", "Home", "End"]) {
    assert.match(menu, new RegExp(key));
  }
  assert.match(menu, /event\.key === "Tab"[\s\S]{0,80}close\(false\)/);
  assert.match(menu, /Could not save the source editor setting/);
  assert.match(menu, /className="ds-editor-retry"/);
  assert.match(menu, /role="status" aria-live="polite"/);
  assert.match(sharedCss, /\.ds-editor-toggle:focus-visible/);
  assert.match(sharedCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ds-editor-toggle/);
});

test("source editor choice is reachable from every primary product surface", () => {
  assert.match(nav, /<EditorMenu \/>/);
  assert.match(hero, /<EditorMenu \/>/);
  assert.match(review, /<EditorMenu compact \/>/);
  assert.match(reviewCss, /max-width:470px[\s\S]{0,420}\.ds-editor-wrap\{display:none\}/);
});
