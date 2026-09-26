# Concept pages

Part of the diffstory-storyteller skill. Read when a code stop needs a mental
model the reviewer does not have yet.

### 3.75. Test for concept gaps

Run the Concept-gap test before finalizing the path: before each code stop, can
the reviewer explain the terminology, roles, relationships, or state model the
next lines need? When a model lands better shown than told, build a concept
page for it. You decide how many pages the change needs and where they sit.
Pages may open the story, close it, or sit back to back.

- Overview is the whole-change reading map. A concept page is a mental model,
  not a summary of the diff.
- Teach with a concrete instance from this diff, not a generic textbook
  picture: the real function names, the real numbers, the real states.
- Starting ideas, not a menu: an interactive state machine the reviewer steps
  through; an animated money or data flow; a before/after toggle; a worked
  numeric example with sliders (a position's margin as price moves); a
  lifecycle timeline; a table that fills in as you scrub. Build whatever
  teaches best.

### 6.25. Write concept pages

```jsonc
{
  "id": "concept-margin",
  "order": 2,
  "title": "How margin moves with price",
  "kind": "concept",
  "page": "<!doctype html><html><head>…</head><body>…</body></html>",
  "narration": "Drag the price. The margin line falls until it crosses the liquidation threshold, which is the check step 3 moves.",
  "preparesFor": ["s3"],
  "tags": ["mental-model"]
}
```

- `page` is a complete HTML document. Anything goes: HTML, CSS, SVG, canvas,
  JavaScript, and libraries or fonts from a CDN (d3, three.js, Chart.js…).
  It runs in a sandboxed frame that fills the stage, and it cannot reach
  diffStory or the reviewer's files.
- `narration` is what you would say while pointing at the page. Plain text,
  no tags. Aloud reads it and screen readers announce it, so it must make
  sense without seeing the page.
- Optional theming: the frame sets `data-ds-theme="light"` or `"dark"` on
  `<html>` and follows the app's theme live. The variables `--ds-bg`,
  `--ds-surface`, `--ds-text`, `--ds-text-2`, `--ds-text-3`, `--ds-line`,
  `--ds-accent`, `--ds-add`, `--ds-del` match the app's palette. Use them or
  ignore them.
- Arrow keys and story shortcuts pressed inside the page still move the story
  unless the page handles them (`preventDefault()`) or the focus is in an
  input, so claim the keys your page needs.
- `preparesFor` (optional) names code steps the page sets up.
- A concept step must not contain `file`, `range`, `ranges`, `viewport`,
  `highlights`, `beats`, `why`, `calls`, or `returnsTo`, nor legacy `focus`.
  Concept steps never claim diff coverage.
- Older stories carry a text `body` with an optional Mermaid `diagram`
  instead of `page`; keep them intact when repairing. New concept steps use
  `page`.
