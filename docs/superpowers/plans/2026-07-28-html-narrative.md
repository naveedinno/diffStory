# HTML Narrative Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Markdown with sanitized HTML as the authoring format for diffStory story narrative text, so a concept primer can carry a bit-layout table instead of describing one in prose.

**Architecture:** One new zero-dependency module, `src/narrative.ts`, tokenizes untrusted story text into a validated tree and re-serializes it — no input byte reaches the output except as escaped text or an escaped attribute value. That tree drives three projections (`html`, `text`, `speech`) which `src/view-model.ts` computes once at the trust boundary, so `src/render.ts` never touches a raw narrative field. Fields are tiered by what their surrounding markup can legally hold: block HTML in concept `body`, inline-only where the text renders inside a `<p>` or `<button>`, plain text in titles.

**Tech Stack:** TypeScript (strict, ES2022, NodeNext), `node:test` + `node:assert/strict`, zero runtime dependencies.

**Spec:** [`docs/superpowers/specs/2026-07-28-html-narrative-design.md`](../specs/2026-07-28-html-narrative-design.md)
**Schema doc:** [`docs/story-schema.md`](../../story-schema.md)

## Status: executed

This plan has been carried out. The artifacts now live where they belong:

| What | Where |
| --- | --- |
| The sanitizer module | `src/narrative.ts` |
| Its hostile-payload suite | `test/narrative.test.mjs` |
| The round-trip fuzzer | `scripts/fuzz-narrative.mjs` |
| CSS blocks, with contrast math and specificity reasoning | `assets/2026-07-28-html-narrative/css-blocks.md` |
| Wiring blocks, with the full render-site inventory | `assets/2026-07-28-html-narrative/wiring-blocks.md` |

Task 1's module and suite were written and verified *before* the plan was executed, rather than
sketched: `tsc --strict --noUnusedLocals --noUnusedParameters` exits 0, `node --test` reports 34/34,
and the fuzzer reports *"clean: idempotent, allowlist-closed, no handlers, no live URLs, no markup
in speech/text"* over 120,000 round-trips across all three tiers.

The fuzzer earned its place: it found a real bug a prior 300,000-round fuzz run had missed. A
self-closed `<table/>` pushed a node without opening a frame, so the caption check never ran — the
empty table survived pass one and was dropped by pass two, breaking the fixpoint. Fixed, and pinned
by a regression test.

Deviations found during execution are recorded at the end of this document.

## Global Constraints

Every task's requirements implicitly include this section.

- **Zero runtime dependencies.** `package.json` declares no `dependencies` field at all. Do not add one.
- **`dist/` is committed.** Run `npm run build` and `git add dist` in the same commit as any `src/` change. GitHub installs have no build step and every test imports from `../dist/`.
- **`PAGE_JS` is a TypeScript template string** (`src/page-assets.ts`). Every backslash must be doubled — a lost backslash does not throw, it compiles to a different regex. No backticks, no `${`, no imports. Run `node --check` on the emitted `PAGE_JS` after editing it.
- **Sanitization completes server-side.** CSP is `script-src 'self' 'unsafe-inline'` (`server.ts:318-327`) and the lazy step-panel route does raw `template.innerHTML` with no client check. The client is not a second line of defence.
- **Do not widen the allowlist.** If a story needs an element that is not safe, that is a story problem.
- **`.text` and `.speech` are RAW plain text.** Their callers need them unescaped for word counts, truncation and aria-labels. **Every attribute sink keeps its `esc()` wrapper.** A literal `<` in `.speech` is legitimate content (an author writing about the `<script>` tag) and is escaped at the sink. Forgetting `esc()` on a speech attribute is an XSS hole.
- **Element allowlist, verbatim:**
  - inline: `code kbd strong em sup sub span br`
  - block (tier A only): `p h2 h3 h4 ul ol li blockquote pre hr table caption thead tbody tr th td dl dt dd`
  - dropped with contents: `script style iframe object embed form input textarea select button template noscript svg math link meta base title head body`
- **Attribute allowlist, verbatim:** `class` on `span`/`code`/`td`/`th` from `{ds-bit, ds-slot, ds-flag, ds-val, ds-warn}`; `scope` on `th` ∈ `{row, col}`; `colspan`/`rowspan` on `td`/`th` integer 1–20; `data-lang` on `pre` matching `[a-z0-9-]{1,20}`. Nothing else. No URL-bearing attribute exists.
- **Field tiers, verbatim:**
  - A (block): concept `steps[].body`
  - B (inline): `steps[].why`, `steps[].beats[].text`, `summary`, `intent.goal`, `intent.design`, `intent.nonGoals[]`, `hotspots[].reason`
  - C (text): `title`, `steps[].title`, `storyScope.reviewerNote`
- **Reviewer comments stay Markdown.** `renderMarkdown` / `renderInlineMarkdown` are NOT deleted; `comments.json` bodies, replies and turns keep using them. `skills/address-review/SKILL.md` writes into that path.
- **No back-compat.** No version gate, no per-field detection. Pre-existing stories render their Markdown literally.
- `npm run check` = `npm run build && node --test test/*.test.mjs`. Script strings are pinned by `test/release-readiness.test.mjs:27-33` — do not change them.
- `tsconfig.json` is strict with `noUnusedLocals` / `noUnusedParameters`; a partially-wired module fails the build.
- **Baseline:** the suite is green at **630 passing / 0 failing** before this work starts. Any drop is a regression you caused.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/narrative.ts` (new) | Tokenizer, tree builder, serializer, and the three projections. The only place the subset is defined. |
| `test/narrative.test.mjs` (new) | Hostile corpus, mXSS idempotence, well-formedness, tier enforcement, speech rules. |
| `src/view-model.ts` | The trust boundary. Computes `Narrative` triples; `ReviewModel` grows tour-level narrative. |
| `src/render.ts` | Consumes projections only. Loses `renderMarkdown(s.body)`; keeps `renderMarkdown` for comments. |
| `src/page-assets.ts` | CSS for the new elements; one small `PAGE_JS` speech edit. |
| `src/tour.ts` | `validateTour` calls `narrativeIssues`; word count and prose gates move to the text projection. |
| `src/story-picker.ts` | Title and summary via `narrativeText`. |
| `src/types.ts` | Per-field tier doc comments pointing at `docs/story-schema.md`. |
| `src/agent.ts` | `storyPrompt` and `storyRepairPrompt` carry the format contract. |
| `skills/diffstory-storyteller/SKILL.md` | The published authoring contract. |
| `examples/demo.mjs`, `.diffstory/*.json` | Fixtures converted to HTML. |

**Dependency order:** 1 → 2 needs 1. 3 is independent. 4 needs 1. 5 needs 3 and 4. 6 needs 1. 7 and 8 need 5–6 for their fixtures to be checkable. 9 is last.

---

### Task 1: The narrative module and its hostile-payload suite

**Files:**
- Create: `src/narrative.ts`
- Create: `test/narrative.test.mjs`
- Source: `docs/superpowers/plans/assets/2026-07-28-html-narrative/`

**Interfaces:**
- Consumes: nothing. This module has no imports.
- Produces:
  ```ts
  export type NarrativeTier = 'block' | 'inline' | 'text';
  export interface Narrative { html: string; text: string; speech: string }
  export interface NarrativeElement { type: 'element'; tag: string; attrs: Array<[string, string]>; children: NarrativeNode[] }
  export interface NarrativeText { type: 'text'; value: string }
  export type NarrativeNode = NarrativeElement | NarrativeText;
  export function parseNarrative(input: string, tier: NarrativeTier): NarrativeNode[];
  export function serialize(nodes: NarrativeNode[]): string;
  export function narrativeHtml(input: string, tier: NarrativeTier): string;
  export function narrativeText(input: string): string;
  export function narrativeSpeech(input: string, tier: NarrativeTier): string;
  export function narrative(input: string, tier: NarrativeTier): Narrative;
  export function narrativeIssues(input: string, tier: NarrativeTier): string[];
  ```

**Behaviours the suite pins — do not "fix" these, they are decisions:**

1. `parseNarrative` decodes character references **exactly once**, at tokenize time, on text and attribute values only. This is what makes idempotence hold: the serializer writes `&amp;` for a literal `&`, so a re-parse must read it back as `&` or every round trip would escape the escape.
2. Attribute values validate **exactly as written** — `colspan=" 2 "` is dropped. No trimming, no `Number()` coercion, no clamping.
3. `narrativeText()` returns **raw** text. `narrativeText('<p>a &amp; b</p>')` is `a & b`.
4. A block element at tier `inline` **unwraps** (element gone, words kept) rather than dropping with contents.
5. At tier `text`, all three projections are the same words: any block structure the author wrote is a source of word boundaries only, never of sentences. `<p>Fee guard</p><p>The clamp runs first.</p>` is `Fee guard The clamp runs first.`, not `Fee guardThe clamp runs first.`
6. A NUL byte is **dropped**, not replaced with U+FFFD. This is authored prose, not a document parser; a visible replacement character would show in the UI and be spoken aloud.
7. A `<table>` needs a caption to **exist**; a late caption is hoisted to first position and a second is discarded. Only absence drops the table.
8. The HTML projection never invents whitespace between siblings, so unwrapping produces `<p>loose cellloose header</p>`.
9. Text-node escaping is `& < >` only; quotes stay literal in text. The `&quot;`/`&#39;` attribute branch is unreachable from author input (every allowlisted value pattern is `[a-z0-9-]+`) and is kept as defence in depth — there is a test asserting exactly that.

- [x] **Step 1: Put the verified module and suite in place**

They were staged beside this plan and are now at `src/narrative.ts` and
`test/narrative.test.mjs`. The staged copies were deleted rather than committed: a byte-identical
duplicate of a shipped module is a drift hazard, not provenance.

- [ ] **Step 2: Build, and confirm the module compiles under the repo's strict settings**

```bash
npm run build
```

Expected: exits 0, no output from `tsc`. `dist/narrative.js` now exists.

If `tsc` reports an unused local, do not delete the symbol blindly — `noUnusedLocals` is on and every export in the interface block above is consumed by a later task.

- [ ] **Step 3: Run the hostile-payload suite**

```bash
node --test test/narrative.test.mjs
```

Expected: `# pass 34`, `# fail 0`.

- [ ] **Step 4: Run the round-trip fuzzer**

```bash
node scripts/fuzz-narrative.mjs
```

Expected, verbatim:

```
checked 120000 round-trips across 4 tier draws
clean: idempotent, allowlist-closed, no handlers, no live URLs, no markup in speech/text
```

The fuzzer is seeded (`seed = 20260728`), so a failure is reproducible and prints the exact payload.

- [ ] **Step 5: Confirm the rest of the suite is untouched**

```bash
node --test test/*.test.mjs
```

Expected: `# pass 664`, `# fail 0` — the 630 baseline plus this task's 34.

- [ ] **Step 6: Commit**

```bash
git add src/narrative.ts test/narrative.test.mjs dist/narrative.js docs/superpowers/plans docs/story-schema.md docs/superpowers/specs
git commit -m "feat: add the narrative HTML sanitizer and its hostile-payload suite"
```

---

### Task 2: Style the newly allowed elements

**Files:**
- Modify: `src/page-assets.ts` — five insertion points
- Test: `test/render-page.test.mjs`

**Interfaces:**
- Consumes: nothing from Task 1 at runtime; it styles the tags Task 1's serializer can emit.
- Produces: the CSS classes `.ds-md-tablewrap`, `.ds-bit`, `.ds-slot`, `.ds-flag`, `.ds-val`, `.ds-warn`, and rules for `table caption thead tbody tr th td dl dt dd hr kbd sup sub pre`.

**Zero new theme tokens.** `src/theme.ts` is untouched. Reused: `--text-3` (table rules), `--muted` / `--text-2` (caption), `--line` + `--line-soft` (hr, kbd, pre border), `--fill-1` (zebra), `--fill-2` (kbd ground), `--gutter` (pre ground), `--panel3` (opaque fallbacks), `--mono`, `--text`, and the `--tk-s/--tk-f/--tk-k/--tk-n` syntax palette plus `--amber*` for the five accent classes. The `--tk-*` set is the right borrow because `theme.ts` already gives it a separate light-theme ramp tuned for small text (`theme.ts:162` vs `:193`), so the accents inherit that tuning instead of needing their own pair.

**Three constraints that are easy to get wrong:**

1. **The cell reset is `overflow-wrap:normal`, not `break-word`.** `.ds-md` sets `overflow-wrap:anywhere` at its root (`page-assets.ts:471`) and it inherits. `anywhere` is the one value that participates in min-content width calculation — which is exactly what collapses a column to one character per line. `break-word` would not undo it. Long unbroken tokens now overflow instead of wrapping, which is fine because `.ds-md-tablewrap` scrolls them.
2. **`<pre>` needs its own rule** even though it was not in the original element list. A narrative-authored `<pre>` arrives **bare** — only `renderMarkdown` stamps `.ds-md-code` (`render.ts:2111`) — and a bare UA `<pre>` is `white-space:pre` with no overflow container, so it would push the concept column sideways and violate the no-horizontal-scroll requirement. The alternative (having the sanitizer stamp a class) is rejected: the serializer invents only `ds-md-tablewrap`.
3. **`:is()` specificity is deliberate.** `:is()` takes the specificity of its most specific argument, so `.ds-md :is(.ds-bit,…)` is (0,2,0) and beats `.ds-md code` (0,1,1) for background; `.ds-md code:is(.ds-bit,…)` is (0,2,1) and beats `.ds-md code` for border-color; `.ds-md :is(th,td).ds-val` is (0,2,1) and beats `.ds-md th,.ds-md td` for text-align. `:is()` is already used at `page-assets.ts:770`, so it is not new syntax here.

**Contrast, measured against the concept ground (`--panel2` = `#181b20` dark / `#eef1f5` light):** `--text-3` table rules land 4.95:1 dark and 4.92:1 light — past the 3:1 non-text floor and past 4.5:1. Caption at `--muted` is 6.70:1 dark / 5.04:1 light. Use `--text-3` as-is; never mix it toward transparent, because an alpha mix behaves asymmetrically across themes (38% of `--text` is 3.2:1 on dark but only 2.4:1 on light), which is why one mixed value cannot serve both.

**`.ds-warn` clears AA unconditionally** — this deviates from house style deliberately. The neighbours (`.ds-severity-concern` at `:813`, `.ds-exclusion-ack small` at `:815`) put amber text on an amber tint and land near 3.9:1 in the light theme. New surface should not ship a new near-miss, so `.ds-warn` uses `--text` on `--amber-soft` with an amber ring instead.

- [ ] **Step 1: Write the failing test**

Add to `test/render-page.test.mjs`:

```js
test('narrative tables and signal classes are styled in both themes', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });

  // A wide table owns its own horizontal scroll so the concept column never
  // scrolls sideways — the same contract .ds-concept-diagram-output has.
  assert.match(html, /\.ds-md-tablewrap\{[^}]*overflow-x:auto/);
  // anywhere (inherited from .ds-md) participates in min-content width and
  // collapses a column to one character per line; only `normal` undoes it.
  assert.match(html, /\.ds-md :is\(th,td\)\{[^}]*overflow-wrap:normal/);
  // A narrative <pre> arrives without .ds-md-code, so it needs its own container.
  assert.match(html, /\.ds-md pre\{[^}]*overflow-x:auto/);
  for (const cls of ['ds-bit', 'ds-slot', 'ds-flag', 'ds-val', 'ds-warn']) {
    assert.match(html, new RegExp(`\\.${cls}`), `${cls} has no styling`);
  }
  // The caption carries the table's meaning and is read aloud in its place, so
  // it must not be dimmer than the AA floor in either theme.
  assert.match(html, /\.ds-md caption\{[^}]*var\(--muted\)/);
  assert.doesNotMatch(html, /\.ds-md table\{[^}]*color-mix\([^)]*transparent/);
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm run build && node --test test/render-page.test.mjs
```

Expected: FAIL — `.ds-md-tablewrap` is not in the stylesheet yet.

- [ ] **Step 3: Insert the five CSS blocks**

The five blocks, with their measured contrast figures and specificity reasoning, are in
[`assets/2026-07-28-html-narrative/css-blocks.md`](assets/2026-07-28-html-narrative/css-blocks.md).
Apply each at the point named in its heading. Each is a single-line minified declaration run,
matching the surrounding house style — do not reformat them, and do not introduce type-scale
variables (narrative CSS hardcodes px throughout).

| # | Insertion point |
| --- | --- |
| A | `src/page-assets.ts` after line 482, immediately after `.ds-md .ds-md-code code{…}` and before `.ds-comment-menu{…}` |
| B | after line 789, immediately after the `.ds-concept-body{…}` line and before `.ds-concept-diagram` |
| C | inside `@media (max-width:620px){…}` (line 840), immediately before its closing `}` |
| D | inside `@media (prefers-reduced-transparency:reduce){…}` (line 847), before its closing `}` |
| E | inside `@media (prefers-contrast:more){…}` (line 848), before its closing `}` |

Block E drops the zebra stripe and turns on real `tr+tr` rules using the `--line` that block already redefines to 42% of `--text`, and lifts `.ds-warn` to `--text` on an amber ring.

`PAGE_CSS` has no `@layer` and no nesting; `.ds-concept-body` beats `.ds-md` at equal specificity purely by source order, so block B must stay after block A.

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm run build && node --test test/render-page.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Confirm the CSS regression suites still pass**

```bash
node --test test/ui-layout-regressions.test.mjs test/motion-regressions.test.mjs
```

Expected: `# fail 0`. Both regex `src/page-assets.ts` as raw text and are brittle to insertions; `motion-regressions` reads **dist**, so the build above matters.

- [ ] **Step 6: Commit**

```bash
npm run build
git add src/page-assets.ts test/render-page.test.mjs dist
git commit -m "feat: style narrative tables, definition lists and signal classes"
```

---

### Task 3: Make the view-model the trust boundary

**Files:**
- Modify: `src/view-model.ts` — header docstring (1-8), `StepViewBase`…`StepBeatView` (66-124), `HotspotView` + `ReviewModel` (166-190), hotspot construction (239-265), the `buildReviewModel` return (282-296), `buildCodeStep` + `buildConceptStep` (305-366), `stepBeats` (401-407)
- Test: `test/view-model.test.mjs`

**Interfaces:**
- Consumes: `narrative`, `narrativeText`, `Narrative`, `NarrativeTier` from Task 1.
- Produces: every narrative field on the model changes type from `string` to `Narrative`. Specifically `StepView.title`, `StepView.why`, `StepBeatView.text`, `ConceptStepView.body`, `ConceptDiagramView.caption`, `HotspotView.title`, `HotspotView.reason`, plus a new `ReviewModel.story` carrying `{ title, summary, goal, design, nonGoals, lede }`.

**Why here and not `tour.ts` or `render.ts`:** `loadTour()` returns the parsed object itself (`tour.ts:475`) and `reviewStoryIdentity` hashes `JSON.stringify(tour)` (`server.ts:1270`), so sanitizing at load would desync the hash; `stories.ts` also calls `loadTour()` per story per history-page load, putting the cost on the picker. Sanitizing per call site in `render.ts` means ~30 places to forget.

**`ReviewModel` must grow tour-level narrative.** Today it carries no `title`/`summary`/`intent`/`hotspots` prose, so `render.ts` reads those straight off the `Tour` (`render.ts:187, 653-667, 720`). Without closing that gap the trust boundary is incomplete by construction.

- [ ] **Step 1: Rewrite the header docstring**

The current text at `src/view-model.ts:1-8` states the opposite of the new invariant:

```
// Pure data only — no HTML. The renderer (render.ts) and the /api/fullfile
// endpoint (server.ts) both consume these, so the diff-shaping logic lives in
// exactly one place. Code strings are passed through verbatim; escaping happens
// at the render boundary.
```

Replace that paragraph with:

```
// This module is the trust boundary for authored prose. Narrative fields arrive
// untrusted from story.json and leave as Narrative triples — sanitized HTML for
// the page, plain text for attributes and counts, a speech stream for Aloud —
// so render.ts places projections and never sanitizes. Code strings are still
// passed through verbatim; their escaping happens at the render boundary.
```

- [ ] **Step 2: Write the failing test**

Add to `test/view-model.test.mjs`:

```js
test('narrative fields arrive as sanitized projections, not raw strings', () => {
  const hostile = {
    ...tour,
    title: 'Plain <script>alert(1)</script> title',
    summary: 'A <strong>bold</strong> summary.',
    steps: [{
      ...tour.steps[0],
      title: 'A <em>marked-up</em> title',
      why: 'Uses <code>settleFunding()</code> first.',
      beats: [{ text: 'The clamp runs <strong>before</strong> balances move.', highlights: [[1, 1]] }],
    }],
  };
  const model = buildReviewModel({ repo: process.cwd(), tour: hostile, files, baseLabel: 'main' });

  // Titles are tier C: markup is stripped to its words, in all three projections.
  assert.equal(model.story.title.html, 'Plain  title');
  assert.equal(model.story.title.text, 'Plain title');
  // Tier B keeps inline markup in html and drops it from text and speech.
  assert.equal(model.steps[0].title.html, 'A <em>marked-up</em> title');
  assert.equal(model.steps[0].title.text, 'A marked-up title');
  assert.equal(model.steps[0].why.html, 'Uses <code>settleFunding()</code> first.');
  assert.equal(model.steps[0].beats[0].text.text, 'The clamp runs before balances move.');
  // The speech projection never carries tags.
  assert.doesNotMatch(model.steps[0].beats[0].text.speech, /</);
});
```

- [ ] **Step 3: Run it to confirm it fails**

```bash
npm run build && node --test test/view-model.test.mjs
```

Expected: FAIL with `model.story is undefined`.

- [ ] **Step 4: Apply the seven view-model edits**

The seven blocks are in
[`assets/2026-07-28-html-narrative/wiring-blocks.md`](assets/2026-07-28-html-narrative/wiring-blocks.md)
under the `src/view-model.ts` headings; apply each at the range named in its heading. Three things
the compiler will otherwise catch late:

- Remove `ConceptDiagram` from the `import type { … } from './types.js'` list once `ConceptDiagramView` replaces it. `noUnusedLocals` fails the build on an unused import.
- Hotspot views are now built from `stepViews` rather than raw `steps`, which removes a second parse of every flagged step's title. The `isCodeStep` guard becomes `step.kind !== 'concept'` because the array holds views. `isCodeStep` stays imported — it is used elsewhere in the module.
- `intent.sources` stays `string[]` (text-projected); it is not rendered anywhere. `storyScope.reviewerNote` gets no view-model field at all — it has no render surface and only feeds agent prompts.

- [ ] **Step 5: Run the test to confirm it passes**

```bash
npm run build && node --test test/view-model.test.mjs
```

Expected: PASS. Other assertions in this file that compare narrative to raw strings will now fail — update each to read `.text` or `.html`. Do not weaken an assertion to make it pass; the point is that the type changed.

- [ ] **Step 6: Commit**

```bash
npm run build
git add src/view-model.ts test/view-model.test.mjs dist
git commit -m "feat: make the view-model the trust boundary for authored prose"
```

---

### Task 4: Move every render site onto a projection

**Files:**
- Modify: `src/render.ts` — 10 ranges
- Modify: `src/page-assets.ts` — one `PAGE_JS` edit at 1927-1934
- Modify: `src/story-picker.ts` — import + 46-72
- Test: `test/render-page.test.mjs`, `test/render-accessibility.test.mjs`

**Interfaces:**
- Consumes: the `Narrative`-typed model from Task 3, the CSS classes from Task 2.
- Produces: a `render.ts` that never reads a raw narrative field.

**The complete inventory. A missed site is a rendering bug or an XSS hole.**

Tour-level, all now read from `model.story`:

| Line | Current | Replacement | Projection |
| --- | --- | --- | --- |
| 187 | `tour.title` | `model.story.title.text` | TEXT (feeds `<title>` at 257 and `title=` at 286, both already `esc()`'d) |
| 654 | `nl(esc(tour.summary.trim()))` | `nl(story.summary.html)` | HTML |
| 655 | `nl(esc(intent.goal.trim()))` | `nl(intent.goal.html)` | HTML |
| 664 | `nl(esc(intent.design.trim()))` | `nl(intent.design.html)` + new `data-speech-text="${esc(intent.design.speech)}"` | HTML + SPEECH |
| 666 | the reading-map `<p>` | same html + `data-speech-text="${esc(story.summary.speech)}"` | HTML + SPEECH |
| 671 | `<li>${esc(g)}</li>` | `<li>${nonGoal.html}</li>` | HTML (trim/filter moves into the view-model) |
| 683 | `${esc(spot.title)}` | `${spot.title.html}` | HTML |
| 684 | `${esc(spot.reason)}` | `${spot.reason.html}` | HTML |
| 720 | `${esc(tour.title)}` | `${story.title.html}` | HTML |
| 721 | the lede `<p>` | + `data-speech-text="${esc(ledeSpeech)}"` | SPEECH |

Step titles (nine sinks): 491, 510, 592, 1159, 1216, 1248, 1793 take `.html`; **529** (`aria-label`) and **590** (`aria-label`) take `esc(.text)`.

Beat text (eight sinks, all confirmed at these exact lines):

| Line | Sink | Projection |
| --- | --- | --- |
| 525 | `title="…"` | `esc(beat.text.text)` |
| 525 | `aria-label="Beat N: …"` | `esc(beat.text.text)` |
| 527 | `railBeatLabel(...)` | `esc(railBeatLabel(beat.text.text))` — truncation must never see `.html` |
| 1103 | `data-speech-text` (lazy cache) | `esc(beat.text.speech)` |
| 1105 | lazy cache node body | `esc(beat.text.text)` |
| 1316 | `data-speech-text` (live button) | `esc(beat.text.speech)` |
| 1318 | `aria-label="Focus beat N: …"` | `esc(beat.text.text)` |
| 1320 | `<span class="ds-beat-text">` | `nl(beat.text.html)` |

`why`: 1101 becomes `esc(step.why.text)` plus `data-speech-text="${esc(step.why.speech)}"`; 1299 becomes `nl(s.why.html)` plus the same speech attribute.
Step hotspot: 1164-1165 becomes `s.hotspot.html`.
Concept: 1249 becomes `${s.body.html}` (bare — see below); 1222-1224 `aria-label` becomes `esc(s.diagram.caption.text)`; 1226 `<figcaption>` becomes `s.diagram.caption.html`.

**Do not touch:** 1225 / 1229 `esc(s.diagram.source)` — Mermaid source is not narrative; `tour.ts` validates it against its own unsafe-pattern list and the client parses it. Also unchanged: 523 and 1192 `step.health.reasons`, 1142-1144 `s.flow`, 503/1154 `s.kindLabel`, 1333/1346/1385/1400 `s.note`, and every `s.file`/`s.id` sink — all renderer-generated strings, not authored prose. **1475/1481/1529/1685/1686 `renderMarkdown(...)` stay exactly as they are.**

**Two rules that prevent silent corruption:**

1. **Never call `nl()` on a block-tier projection.** `narrative(body, 'block')` can emit a `<pre>`, and rewriting its newlines to `<br>` would corrupt the code block. That is why 1249 is a bare `${s.body.html}` while the inline-tier sites (654, 655, 664, 1299, 1320) keep their `nl()`.
2. **Do not widen `render.ts`'s `esc()`.** It does not escape `'`, which is fine because every attribute there is double-quoted. The module's stricter `'` → `&#39;` rule governs attributes the serializer emits, not these hand-written ones. Widening it would churn several unrelated snapshot assertions for no security gain.

**The `PAGE_JS` edit is not optional.** Today `stepSpeechUnits` reads `textContent` for `[data-speech-overview]` / `[data-speech-concept]`, and `fallbackStepText` reads `textContent` of `.ds-why-text`; beats already prefer `data-speech-text`. Without a `speechFrom()` helper that prefers the attribute, the new speech projections on the Overview and the no-beats dock are emitted and **silently ignored**, and narration falls back to flattened markup. The edit contains no regex, so there is nothing to double — but `node --check` the emitted `PAGE_JS` anyway.

- [ ] **Step 1: Invert the existing security assertion**

`test/render-page.test.mjs:100-102` currently asserts that `<script>alert("primer")</script>` and `<img src=x onerror=…>` come back **entity-encoded** from a Markdown body. Under HTML authoring they must be **absent**. Rewrite, do not delete:

```js
  // Was: these came back entity-encoded, because the body was Markdown and every
  // angle bracket was escaped on the way out. The body is HTML now, so the
  // sanitizer removes them outright — script and its contents both go.
  assert.doesNotMatch(html, /alert\(&quot;primer&quot;\)/);
  assert.doesNotMatch(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert\("primer"\)<\/script>/);
  assert.doesNotMatch(html, /onerror/);
```

Convert that test's fixture body from Markdown to HTML in the same edit: `## Request envelope` → `<h2>Request envelope</h2>`, `**request envelope**` → `<strong>request envelope</strong>`, the bullet list → `<ul><li>…</li></ul>`, and the fenced block → `<pre><code>…</code></pre>`.

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm run build && node --test test/render-page.test.mjs
```

Expected: FAIL — the Markdown renderer still escapes rather than removes.

- [ ] **Step 3: Apply the render, page-assets and story-picker edits**

The inventory table above is the contract; the rewritten blocks for all ten `render.ts` ranges, the
`PAGE_JS` edit and the `story-picker.ts` rewrite are in
[`assets/2026-07-28-html-narrative/wiring-blocks.md`](assets/2026-07-28-html-narrative/wiring-blocks.md)
under their respective file headings. Check each replacement against the table as you apply it — the
table is what a reviewer will verify.

`story-picker.ts` line 66 is **not** a narrative site despite appearing in early notes — it interpolates `s.scope.command`, `s.scope.label` and `activity`, all derived from git scope and review state. Leave it. The real title sinks are 58 and 70 (twice: `data-story-title` and the `aria-label`), so hoist a single `title` const. `s.error` at 50 is a loader message, not authored prose — it keeps plain `esc()`.

- [ ] **Step 4: Syntax-check the emitted client bundle**

```bash
npm run build
node -e "import('./dist/page-assets.js').then(m => { new (require('vm').Script)(m.PAGE_JS); console.log('PAGE_JS parses'); })"
```

Expected: `PAGE_JS parses`.

- [ ] **Step 5: Run the full suite**

```bash
node --test test/*.test.mjs
```

Expected: `# fail 0`. Fallout to expect and fix: `test/render-page.test.mjs`, `test/render-accessibility.test.mjs`, `test/motion-regressions.test.mjs` and `test/ui-layout-regressions.test.mjs` all grep rendered markup.

- [ ] **Step 6: Commit**

```bash
npm run build
git add src/render.ts src/page-assets.ts src/story-picker.ts test dist
git commit -m "feat: render story narrative from sanitized projections"
```

---

### Task 5: Validate narrative at authoring time

**Files:**
- Modify: `src/tour.ts` — 16 ranges (see below)
- Test: `test/tour.test.mjs`

**Interfaces:**
- Consumes: `narrativeIssues`, `narrativeText` from Task 1.
- Produces: `validateTour` errors naming the offending tag or attribute, in the house style of the existing `diagram.source` denylist.

**Two mechanisms, different jobs.** Rejection here gives the authoring agent a repair loop. The sanitizer in Task 1 still strips unconditionally, because `story.json` may arrive with someone else's repository and never pass through this validator. Do not treat one as a substitute for the other.

**Three raw-string checks must move to the text projection:**

- `conceptWordCount` (`tour.ts:655-659`) matches word characters, so it counts `<p>` as the word "p" against the 60/220 bounds.
- `LINE_NUMBER_OPENER = /^lines?\s+\d/i` (`tour.ts:29`) is `^`-anchored, so a beat opening with a tag silently stops matching — disarming the most-taught beat rule exactly when the format changes.
- `VALUE_TRANSITION` (`tour.ts:29-42`) breaks with markup between digits.

- [ ] **Step 1: Write the failing test**

Add to `test/tour.test.mjs`:

```js
test('narrative validation names the tag it rejected, per field tier', () => {
  const bad = {
    version: 2,
    title: 'A <em>marked-up</em> title',
    summary: 'Fine.',
    steps: [{
      id: 's1', order: 1, title: 'Fine', kind: 'changed', file: 'a.ts',
      range: [1, 1], viewport: [1, 1], highlights: [[1, 1]],
      why: 'A <table><caption>c</caption><tr><td>x</td></tr></table> in a why.',
      beats: [{ text: 'Fine.', highlights: [[1, 1]] }],
    }],
  };
  const errors = validateTour(bad);
  // Tier C: a title carries no markup at all.
  assert.ok(errors.some((e) => e.includes('title') && e.includes('<em>')), errors.join(' | '));
  // Tier B: block markup is rejected where it cannot legally render.
  assert.ok(errors.some((e) => e.includes('why') && e.includes('<table>')), errors.join(' | '));
});

test('the concept word budget counts words, not tags', () => {
  const words = Array.from({ length: 70 }, (_, i) => `word${i}`).join(' ');
  const tour = {
    version: 2, title: 'T', summary: 'S',
    steps: [
      { id: 'c1', order: 1, title: 'Primer', kind: 'concept', preparesFor: ['s1'],
        body: `<p>${words}</p>` },
      { id: 's1', order: 2, title: 'Code', kind: 'changed', file: 'a.ts',
        range: [1, 1], viewport: [1, 1], highlights: [[1, 1]], why: 'Because.',
        beats: [{ text: 'Fine.', highlights: [[1, 1]] }] },
    ],
  };
  // 70 real words clears the 60-word floor; the <p> must not be counted as "p".
  assert.deepEqual(validateTour(tour).filter((e) => e.includes('60 words')), []);
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm run build && node --test test/tour.test.mjs
```

Expected: FAIL — no narrative errors are produced yet.

- [ ] **Step 3: Apply the tour.ts edits**

The sixteen blocks are in
[`assets/2026-07-28-html-narrative/wiring-blocks.md`](assets/2026-07-28-html-narrative/wiring-blocks.md)
under the `src/tour.ts` headings. The ranges are: the import block (4-5); the `LINE_NUMBER_OPENER` doc block plus two new narrative helpers (29-43); `validateBeats` body (219-224); `validateIntent` after its shape guard (233-256); `validateHotspots` (272-273); `validateStoryScope` reviewerNote (312-314); `validateConceptDiagram` caption (325-327); `validateConceptStep` body (361); `validateCodeStep` why (381); `validateTour` title/summary (513-514) and per-step title/chapter/tags (552-556); `conceptWordCount` (655-659); and the `validateGeneratedTour` gates at 709-711, 715-717, 731-733 and 775-791.

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm run build && node --test test/tour.test.mjs
```

Expected: PASS. Existing tests asserting exact error-string lists will need the new per-field entries added.

- [ ] **Step 5: Delete the dead `question:` keys**

`test/tour.test.mjs:24` and `:111` still pass a `question:` key. That field was removed long ago (`render.ts:1791` carries the tombstone; `test/agent.test.mjs:653` forbids the word in SKILL.md). Remove both so they stop implying the field exists.

- [ ] **Step 6: Commit**

```bash
npm run build
git add src/tour.ts test/tour.test.mjs dist
git commit -m "feat: reject out-of-tier narrative markup at story validation"
```

---

### Task 6: Teach the storyteller to author HTML

**Files:**
- Modify: `skills/diffstory-storyteller/SKILL.md` — 433-437, 601-620, 694-700, 1049-1158, 1178-1205
- Modify: `skills/address-review/SKILL.md` — one sentence
- Modify: `src/agent.ts` — `storyPrompt` (72-157), `storyRepairPrompt` (252-287)
- Test: `test/agent.test.mjs`

**Interfaces:**
- Consumes: the tiers and allowlist from the Global Constraints; the validator errors from Task 5.
- Produces: authored stories that emit HTML in tier A and B fields.

**The prompt budget must rise.** `storyPrompt` measures ~3799 chars against a hard `< 4000` assertion (`test/agent.test.mjs:71-74`) — roughly two sentences of headroom. `agent.ts:112-115` states that validator-enforced contracts must live in the prompt because deep-skill prose does not reliably survive. Raise the ceiling to 4500 and record that reason in the test itself, so the next person to hit it knows why it moved.

**Watch these three test couplings:**
- `test/agent.test.mjs:136-153` pins the exact concept-body word limits and the Mermaid "No links, URLs, … HTML, images" sentence. The Mermaid rules stay as they are — the diagram slot is still the answer for diagrams, and it still forbids HTML.
- `test/agent.test.mjs:155-167` JSON-parses SKILL.md's `## Schema` block and requires **both** validators to return `[]`. The example concept body at SKILL.md:1106 must become valid HTML, and it should demonstrate a captioned table — it is the thing authors copy.
- `test/agent.test.mjs:653` forbids the word `question` in SKILL.md. Do not reintroduce it.

Changing SKILL.md by one byte flips every installed copy to "out of date" (`repo-setup.ts:70-113` does normalized full-text equality). That is expected; mention it in the changelog.

- [ ] **Step 1: Write the failing test**

Add to `test/agent.test.mjs`:

```js
test('the storyteller skill teaches the HTML tiers and the caption rule', () => {
  const skill = readFileSync('skills/diffstory-storyteller/SKILL.md', 'utf8');
  assert.match(skill, /concept primer `body`[\s\S]{0,400}HTML/i);
  assert.match(skill, /<caption>/, 'the caption requirement must be shown, not just described');
  assert.match(skill, /inline/i, 'beats and why are inline-only');
  assert.doesNotMatch(skill, /Markdown links\/images/, 'the Markdown-era prohibition is stale');
  // Titles never carry markup — the single easiest tier to get wrong.
  assert.match(skill, /title[\s\S]{0,200}plain text/i);
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
node --test test/agent.test.mjs
```

Expected: FAIL — SKILL.md still says "Do not paste implementation code, add Markdown links/images".

- [ ] **Step 3: Rewrite the skill's formatting contract**

At SKILL.md:433-437, the only Markdown sentence today is:

```
Use compact paragraphs, small lists, emphasis, and inline code.
Do not paste implementation code, add Markdown links/images, or inflate a
primer to hit the word target.
```

Replace it with the HTML contract: the tier of each field, the element allowlist per tier, the attribute allowlist, and the caption requirement. Point at `docs/story-schema.md` for the full statement rather than duplicating it. State the word budget as counted on text with tags excluded. At 601-620 (beats) and 694-700 (`why`), say inline-only explicitly.

- [ ] **Step 4: Update the schema example and the prompts**

Convert SKILL.md's `## Schema` concept body (1106) to HTML with a captioned table. Add the format contract to `storyPrompt` and `storyRepairPrompt`. Raise the budget assertion:

```js
  // Raised from 4000 when the HTML format contract landed. Validator-enforced
  // contracts must live in the prompt (see agent.ts:112-115) — deep-skill prose
  // does not reliably survive, so this ceiling buys correctness, not verbosity.
  assert.ok(prompt.length < 4500, `storyPrompt is ${prompt.length} chars`);
```

Add one sentence to `skills/address-review/SKILL.md` stating that comment `turns[].text` stays Markdown, so the two formats do not bleed into each other.

- [ ] **Step 5: Run the test to confirm it passes**

```bash
npm run build && node --test test/agent.test.mjs
```

Expected: PASS, including the schema block round-tripping through both validators.

- [ ] **Step 6: Commit**

```bash
npm run build
git add skills src/agent.ts test/agent.test.mjs dist
git commit -m "feat: author story narrative as HTML in the storyteller skill"
```

---

### Task 7: Convert the fixtures and document the field tiers

**Files:**
- Modify: `src/types.ts` — the doc comment on every narrative field, especially `ConceptTourStep.body` (138)
- Modify: `examples/demo.mjs` — the concept body at 130
- Modify: `.diffstory/story.json`, `.diffstory/stories/*.json`
- Test: `test/render-page.test.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: fixtures that render correctly under the new pipeline, and types that say which tier each field is.

`src/types.ts:138` currently reads *"Restricted Markdown: headings, paragraphs, lists, quotes, emphasis, and inline code."* Every narrative field's doc comment gains its tier and a pointer to `docs/story-schema.md`.

- [ ] **Step 1: Write the failing test**

```js
test('the shipped demo primer renders as HTML, not literal markup', async () => {
  const demo = await readFile('examples/demo.mjs', 'utf8');
  assert.doesNotMatch(demo, /body: *['"`][^'"`]*\*\*/, 'demo concept body still uses Markdown bold');
  assert.match(demo, /<(?:p|h2|ul|table)/, 'demo concept body should carry real HTML');
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
node --test test/render-page.test.mjs
```

Expected: FAIL — `examples/demo.mjs:130` still contains `##`, `**bold**`, backticks and `>`.

- [ ] **Step 3: Convert the fixtures**

`examples/demo.mjs` is the canonical fixture and feeds both `npm run demo` and the UI atlas capture, so give it a captioned table — it is the feature's shop window. Convert `.diffstory/story.json` and the three files under `.diffstory/stories/` the same way. `.diffstory/stories/concept-primer-steps.json` has the only concept body in the repo's own stories (`**code step**`, `` `kind` ``, `` `preparesFor` ``).

- [ ] **Step 4: Annotate the types**

- [ ] **Step 5: Run the full suite and the demo**

```bash
npm run build && node --test test/*.test.mjs && node examples/demo.mjs
```

Expected: `# fail 0`, and the demo writes its page without throwing.

- [ ] **Step 6: Commit**

```bash
npm run build
git add src/types.ts examples .diffstory test dist
git commit -m "feat: convert story fixtures to HTML narrative"
```

---

### Task 8: Full verification

**Files:** none — this task only runs things.

- [ ] **Step 1: Clean build and full suite**

```bash
npm run check
```

Expected: `# fail 0`, with a total at or above **664** (the 630 baseline plus Task 1's 34, plus whatever later tasks added).

- [ ] **Step 2: Re-run the fuzzer against the shipped module**

```bash
node scripts/fuzz-narrative.mjs
```

Expected: `clean: idempotent, allowlist-closed, no handlers, no live URLs, no markup in speech/text`.

- [ ] **Step 3: Confirm the client bundle parses**

```bash
node -e "import('./dist/page-assets.js').then(m => { new (require('vm').Script)(m.PAGE_JS); console.log('PAGE_JS parses'); })"
```

- [ ] **Step 4: Confirm dist matches src**

```bash
npm run build && git diff --exit-code dist && echo "dist is current"
```

Expected: `dist is current`. Nothing in CI checks this, so it is checked here.

- [ ] **Step 5: Look at the result**

Run the app and open a story with a concept primer containing a table. Check it in **both** themes and at a **narrow** viewport, and confirm the concept panel never scrolls sideways. Play the narration on that step and confirm the table is spoken as its caption and nothing else.

```bash
npm run demo
```

- [ ] **Step 6: Release check and commit**

```bash
npm run release:check
git add -A && git commit -m "chore: verify HTML narrative end to end"
```

## What this plan does not do

- Regenerate `docs/ui-atlas/` — Playwright-driven, needs a local browser, and `test/ui-atlas.test.mjs` only checks the manifest. The 21 shots will show Markdown-era primers until someone runs `npm run ui:atlas`.
- Add a dist-freshness check to CI. Task 8 Step 4 does it by hand. Worth having, unrelated to this change, and `test/release-readiness.test.mjs:27-33` pins the script strings so a new build step must thread through without changing them.
- Add a markup dimension to the eval rubric (`scripts/eval-stories.mjs:363-370`). An eval run will score broken markup as fine. Capture a pre-change baseline label before starting so there is something to compare against.
- Touch reviewer comments, `steps[].question` (the field does not exist), or `storyScope.reviewerNote`'s absent display surface.

---

## Deviations found during execution

Seven things the plan got wrong or left out. Recorded so the next reader trusts the document.

1. **`ds-num` collided with an existing UI class.** The narrative signal vocabulary claimed
   `ds-num`, which is already the 22-28px step-number chip (`render.ts:489`, 11 CSS rules). Every
   existing rule is scoped, so nothing broke, but the name would mislead. Renamed to **`ds-val`**
   throughout — module, tests, CSS, schema doc, spec.

2. **Titles were validated at the wrong tier.** The drafted `tour.ts` validated `title` and
   `steps[].title` as `inline`; the spec puts them in tier C. Fixed both call sites. Every other
   tier assignment matched the spec.

3. **Tasks 3 and 4 are one compile unit.** Changing the view-model's narrative fields to `Narrative`
   breaks `render.ts` by construction, so there is no green build between them. The task boundary
   was wrong. The compiler enumerating all 29 broken sites was the useful part — but note the
   intro-panel sites (654-721) did *not* error, because `render.ts` still read `tour.summary`
   directly. Type errors are not a complete inventory.

4. **`diagram.caption` became a narrative field.** Not in the original spec; the wiring draft added
   it. Kept, because it is authored prose that is both rendered and spoken, and documented as tier B
   in `docs/story-schema.md` and `src/types.ts`. Consequence: a caption containing a literal
   `<then>` now loses it unless written `&lt;then&gt;`.

5. **A table's caption may be authored anywhere.** The spec said "first child, else drop". The
   sanitizer hoists a late caption instead, and discards a second one. Only *absence* drops the
   table. The spec was over-strict — position is the serializer's job, and the contract that matters
   is that a caption exists, because it is what the voice speaks.

6. **`.ds-warn` clears WCAG AA unconditionally**, deviating from the house pattern its neighbours
   use (`.ds-severity-concern` puts amber text on an amber tint, ~3.9:1 in the light theme). New
   surface should not ship a new near-miss. It uses `--text` on `--amber-soft` with an amber ring,
   which also overrides the shared `currentColor` tint — without that override the chip washes grey.

7. **Two prompt-budget assertions, not one.** `test/agent.test.mjs` caps `storyPrompt` at both
   `:57` and `:78`. Both were raised to 4600 (measured: 4482/4486/4494).

Also: the plan said to delete the dead `question:` keys at `test/tour.test.mjs:24,111`. Done — but
the keys at `:894-895` were left alone, because those two lines deliberately assert that an unknown
key is tolerated rather than merely carrying a stale fixture.

### Not done, deliberately

`docs/ui-atlas/` still shows Markdown-era primers. Regenerating needs `npm run ui:atlas` and a local
Chrome; `test/ui-atlas.test.mjs` only checks the manifest, so the suite stays green either way. The
eval rubric (`scripts/eval-stories.mjs:363-370`) still has no markup dimension.
