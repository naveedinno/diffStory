# Independent Split Panes Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the screen-tall hatched void that an aligned split diff paints on the side that has no counterpart (a 47-line insertion leaves 47 empty left rows). Adopt the IntelliJ model: each side is its own compressed column, the two columns are kept in step by a scroll-linked mapping anchored at the viewport centre, and the divider between them draws bands that fan from a change's range on one side to its range on the other. No filler rows anywhere.

**Architecture:** One vertical scroller stays (`.ds-diffscroll` in a story step, `.ds-filedetail` in All files) so sticky toolbars, file heads, comments, focus, and keyboard flows keep working. Inside the split body, rows no longer hold two cells. The body becomes `[.ds-col-l][.ds-celldiv][.ds-col-r]`, each column an independent flow of single-cell `.ds-row`s. The engine measures both columns, builds a *timeline* (the union order of both flows: paired logical rows advance by the taller side, one-sided content advances by its own height), sizes the body to the timeline height, and on every scroll frame translates each column so the row under the viewport centre sits at its timeline position. Away from the centre the columns drift apart by exactly the one-sided content between, which is what the divider bands visualise. Row consumers keep addressing `.ds-row` elements; a logical row now exists as up to two halves sharing `data-ri`.

**Tech Stack:** TypeScript renderers (`src/diff-render.ts`, `src/render.ts`), plain browser engine (`client/surfaces/review/engine/review-engine.js`), tokens-only CSS (`client/surfaces/review/review.css`), node:test.

**Reference:** IntelliJ's `SimpleDiffViewer` (`needAlignChanges()` off by default; `MySyncScrollable`; `MyDividerPainter.paintPolygons`). JetBrains docs: "Align Changes in Side-by-Side Diff" pads with empty space and ships off.

## Global constraints

- `dist/` ships in git: rebuild before every commit that touches `src/` or `client/`.
- Engine comments are page content: never name a banned API or an asserted-absent string in a comment.
- After editing the engine: `node --check dist/client/review.js`.
- Existing tokens only in CSS. Signal / Thread-Ledger restraint: the bands are quiet fills, not neon.
- Verification: `npm run check`. Inner loop: `npm run build && node --test test/<file>.test.mjs`.
- Do not run destructive git commands. The tree carries an unrelated uncommitted batch (story evolution); leave it alone.

## Design details

### Markup (per split body)

```
<div class="ds-diffbody ds-diffbody-cols">
  <div class="ds-col ds-col-l">
    <div class="ds-row ds-row-ctx" data-ri="0" …review attrs for the BEFORE line…><span class="ds-cell ds-cell-l">…</span></div>
    <div class="ds-row ds-row-del" data-ri="3" …><span class="ds-cell ds-cell-del ds-cell-l">…</span></div>
    <div class="ds-row ds-row-pair-l" data-ri="4" …><span class="ds-cell ds-cell-del ds-cell-paired ds-cell-l">…</span></div>
    <div class="ds-hunkgap ds-hunkgap-side ds-hunkgap-l" data-ri="9" data-gap-mirror>[↓ 5 lines]</div>
  </div>
  <div class="ds-celldiv" role="separator" …><svg class="ds-bands" aria-hidden="true"></svg></div>
  <div class="ds-col ds-col-r">
    <div class="ds-row ds-row-ctx" data-ri="0" …review attrs for the AFTER line…>…</div>
    <div class="ds-row ds-row-add" data-ri="5" …>…</div>
    <div class="ds-row ds-row-pair" data-ri="4" …>…</div>
    <div class="ds-hunkgap ds-hunkgap-side ds-hunkgap-r is-expandable" data-ri="9" data-gap data-gap-file=… data-gap-from=… data-gap-to=…>[Show all] [↑ 5 lines]</div>
  </div>
</div>
```

- `data-ri` is the logical row index within the body, shared by both halves of a paired logical row (ctx, change pair, gap). One-sided rows (add, del) carry it too; the other column simply has no element with that index.
- Change units for navigation stay exactly one element each: `.ds-row-add` (right only), `.ds-row-del` (left only), `.ds-row-pair` (right half only; the left half is `.ds-row-pair-l`). `changeRows()` sorts by `data-ri` because DOM order is now column-major.
- Story focus (`data-step-focus`), voice focus, `data-move`, `data-step`, comment target attributes are emitted on each half for the side they describe. Left halves get the BEFORE review attrs (`data-side="left"`), right halves the AFTER ones.
- Single-cell bodies (context steps, new-file steps) are untouched.
- The canonical expandable gap is the right half (`[data-gap]`); the left half mirrors it (`[data-gap-mirror]`) and shares `data-ri`. The "Show all" control moves from the middle slot to the leading edge of the right half.
- `/api/diff/context?layout=split` returns `<div data-ctx-rows …><div data-ctx-side="left">…</div><div data-ctx-side="right">…</div></div>`; the engine inserts each side next to the matching gap half.
- Scope rows (All files) render in the right column only. Callouts render in the column of their side.

### Engine layout model (`splitFlow`)

Per split body, cached on the element:

- `items`: for each column, in-flow children with `{el, top, h, ri}` (`ri` null for unpaired extras such as composers, callouts, scope rows). Measured with `offsetTop`/`offsetHeight` after any transform is cleared for measurement (transforms do not affect offsets, so no clearing is needed).
- `timeline`: merge of both columns by `ri`. Paired entries advance `max(hL, hR)`; unpaired entries advance their own height. Each entry records `t0` and, per side, the column offset `y` and height.
- `mapSide(side, T)`: timeline position → column position. Inside a paired entry scale linearly; inside an entry absent on that side, return the column position of the next present entry (frozen).
- `shift(side, scrollTop)`: anchor `Ta = scrollTop + viewport/2` (clamped to the body span). `colScroll = clamp(mapSide(side, Ta) − viewport/2, 0, colH − viewport)`. `shift = (scrollTop − bodyTop) − colScroll`. Applied as `translateY(shift)` on the column. Body `height` is set to the timeline height so the scroller's range is unchanged from today.
- Bands: group consecutive timeline entries whose halves are add/del/pair into a change. For each change the left span is the covered left rows (zero-height at the insertion point when none) and likewise right. The `.ds-bands` SVG is sticky to the viewport inside the divider column and repaints on the same frame as the shifts: a closed path L(top)→R(top)→R(bottom)→L(bottom) using a soft cubic for the two slanted edges, filled with the change tint at low alpha.
- `timelineTopOf(rowEl)`: used by `scrollReviewRowVertically` and `centerFocusRows` so a row is centred by its timeline position rather than its transient rect.
- Re-measure on: mount, mode switch, resize (ResizeObserver on both columns), line-wrap toggle, gap expansion, composer insert/remove.
- Scroll handler: one passive listener per scroller, rAF-coalesced; only the visible split body is updated. Annotations (`.ds-annot`) are rescheduled on scroll end (150 ms idle) because they measure rects.

### Sticky scope rows

Sticky offsets are computed before transforms, so a sticky element in a translated column would stick at `top + shift`. Scope rows therefore stay `position:sticky` only in the unified/full modes; in the column layout they are ordinary rows. Documented in CSS.

## Tasks

### Task 1: Column builder in the row renderer

**Files:** `src/diff-render.ts`, `test/diff-render.test.mjs`

- [x] Add `renderSplitCells(row, opts): { left: string; right: string }` returning the two `.ds-row` halves (or `''` for an absent side), reusing `cell()` and `reviewRowAttrs`. Left half attrs describe the BEFORE target; right half attrs the AFTER target. `ds-row-pair` only on the right half, `ds-row-pair-l` on the left.
- [x] Add `SplitColumns` builder: `.row(row, opts)`, `.gap(gap?, opts)`, `.left(html)`, `.right(html)`, `.both(html)`, `.html()`. It assigns `data-ri` and emits `<div class="ds-col ds-col-l">…</div><span class="ds-celldiv" aria-hidden="true"><svg class="ds-bands" aria-hidden="true"></svg></span><div class="ds-col ds-col-r">…</div>`.
- [x] Gap halves: left `[↓ N lines]` right-aligned; right `[Show all][↑ N lines]`. Bare gap: both halves carry the "Skipped lines" label, left half muted.
- [x] Keep `renderSplitRow` for the single-cell path only (`single: true`); throw if called without `single` so no caller silently keeps the old shape.
- [x] Tests: halves carry correct attrs, `data-ri` matches across halves, pair classes, gap halves, single-cell unchanged.

### Task 2: Renderers emit columns

**Files:** `src/render.ts`, `test/review-page.test.mjs`, `test/app-server.test.mjs`

- [x] `diffInner` (story step): when not single, feed `SplitColumns` with rows, hunk gaps, viewport gaps, callouts (`.left`/`.right` by callout side), keep `annotationData`.
- [x] `renderFullFile`, `renderSplitHunks` (scope rows via `.right`; the `.ds-hunk` wrappers are gone with the sticky behaviour they existed for).
- [x] `renderContextRows` split branch returns the two side fragments described above.
- [x] Update the tests that assert `ds-celldiv` per row or two cells per row.

### Task 3: CSS for columns, divider, bands

**Files:** `client/surfaces/review/review.css`, `test/diff-client.test.mjs`

- [x] `.ds-diffbody-cols{display:flex;align-items:flex-start;position:relative}`; `.ds-col{min-width:0;display:block;will-change:transform}`; `.ds-col-l{flex-grow:var(--ds-split,50);…}`; `.ds-col-r{flex-grow:calc(100 - var(--ds-split,50));…}`.
- [x] `.ds-diffbody-cols .ds-row` single-cell rows; `.ds-cell` stretches; remove per-row divider assumptions.
- [x] Divider column: `.ds-diffbody-cols>.ds-celldiv{width:var(--ds-divider-w,18px);flex:none;position:relative;cursor:col-resize;background:var(--panel2)}` with a 1px centre rule via `::before`; `.ds-bands{position:sticky;top:var(--ds-bands-top,0px);display:block;width:100%;height:var(--ds-bands-h,0px)}`; band fills `.ds-band-add/.ds-band-del/.ds-band-pair` using `--add-bg/--del-bg` at reduced alpha; `prefers-reduced-motion` unaffected (no animation).
- [x] Gap halves styling; callouts inside columns are `width:100%`.
- [x] Remove `.ds-cell-empty` hatch use from the column layout (keep the rule for any legacy single-cell case).
- [x] Update CSS assertions.

### Task 4: Engine flow model

**Files:** `client/surfaces/review/engine/review-engine.js`, `test/diff-client.test.mjs`

- [x] `splitFlowOf(body)` cache; `measureSplitFlow(body)`; `applySplitFlow(body, scroller)` (shifts + bands); `timelineTopOf(row)`.
- [x] Hook scroll on `.ds-diffscroll` and `.ds-filedetail` (delegated, passive, rAF).
- [x] ResizeObserver on both columns → re-measure + apply.
- [x] `syncSplitPaneLayout` → after its work, `measureSplitFlow` + apply. Mode switch, gap expansion, composer open/close, line-wrap toggle all funnel through it already or get one call added.
- [x] `changeRows()` sorted by `data-ri`; `jumpToChange` marks the twin half too.
- [x] `scrollReviewRowVertically`, `centerFocusRows` use `timelineTopOf` when the row lives in a column.
- [x] Gap expansion inserts per side and mirrors attribute updates/removal to `[data-gap-mirror]` with the same `data-ri`.
- [x] `prepareSplitDivider` now finds one divider per body.
- [x] Annotations rescheduled on scroll idle.

### Task 5: Verification

- [x] `npm run check` green; `node --check dist/client/review.js`.
- [x] Browser: story step with a large insertion shows no void, left column freezes while scrolling the insertion, bands fan correctly; unified and full-file unchanged; All files split, expand context up/down/all, comment composer, change jump n/p, story focus centring, pane resize, wrap toggle, narrow viewport.

## Outcome (2026-09-06)

Implemented in one pass. Verified in the live app at 1400px: a 47-line insertion no longer pads the BEFORE column; the left column freezes while the right scrolls the insertion; the divider band fans from the insertion point to the added span. All files split: expanding context from the left half's button lands five rows per side with shared `data-ri` (old and new line numbers offset correctly), repeated up/down/all expansions keep indices integral and monotonic, and Show all removes both gap halves. Full file mode measures its flow after the lazy load. Wrap toggling changes and restores the timeline height. Keyboard pane resize repaints the band at the new width. A comment composer grows the timeline by one entry inside its column and shrinks it on close. Unified mode untouched. 729 tests green.

One design note learned the hard way: the context-rows response must build its two side fragments directly (`SplitColumns.sides()`), never by string surgery on the column markup — a mis-nested wrapper silently sends the whole fragment down the legacy insertion path.

### Follow-up: fill the short column (same day)

Compressing the columns removed the hatch but a story step whose viewport holds only two old-side lines still showed a blank BEFORE pane. IntelliJ never does, because both editors hold the whole file. `autoFillFlow` now expands real context when a column is shorter than the pane: trailing lines first (they land past the change on the tall side and fill the short side), leading lines only when the tail is exhausted, at most three rounds per body. The divider widened to 26px so the band reads as a wedge. Verified on two steps: the short column reaches pane height after one or two rounds and both panes read like two editors.

### Follow-up: move annotations ride the columns (same day)

Move boxes and arrows were measured in body coordinates and only re-measured on scroll idle, so for ~200ms after every scroll they sat where the rows used to be, then jumped. `cacheAnnotationFlow` stores the measured regions in column coordinates and `shiftAnnotations` repaints from that cache on the same frame the columns move. Verified on the perps-core "legacyOwnerOf" step: box-to-row offset stays at 1px at 20, 50, and 110ms after a scroll and after a second scroll.

### Follow-up: new files and unexplained runs (same day)

All files rendered a new file as two columns with an empty "did not exist" pane; it now renders as one column with the new-file head, like a new-file story step, and the engine leaves such a card at content width so long lines scroll natively. Consecutive unexplained rows carry one tag with the run length ("UNEXPLAINED ×237") instead of one tag per row; the tag is sticky at the right edge so it stays visible while the card scrolls sideways.

### Follow-up: one flag per unexplained file, and scope honoured everywhere (same day)

Two things behind the 237 amber rows. First, a file the story never visits is one fact, not one per line: `wholeUntoured` now sends such a file's rows through `plainRows` and the panel head carries a single "Unexplained file" badge; partially covered files keep their per-run tags, in Unified too. Second, and the actual cause of that screenshot: the lazy split and full-file responses computed coverage on the bare file while the review model computes it on `filesForStoryCoverage`, so a file outside a scoped story's included set was flagged on every line by the split view and by nothing else. Both responses now apply the same filter (tested by source assertion and a unit test). Verified live: the excluded test file is clean in Split, Unified, and Full file, matching the sidebar.
