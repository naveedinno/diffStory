# Diff viewer enhancement — unified engine, orientation, comfort, polish — design

**Date:** 2026-07-03
**Status:** Approved, awaiting implementation plan

## Problem

The diff-reading experience is the heart of the app, but it is uneven:

- **Three renderers draw diff rows.** The story-step renderer (`sbsRow` in
  `src/render.ts`, side-by-side), the All-files renderer (`unifiedRow` in
  `src/render.ts`, unified), and the full-file body (`renderDiffFullBody` in
  `src/diff-view.ts`). They share view-models but duplicate row markup and
  drift independently.
- **Dead code.** `renderDiffFiles`, `diffViewStyles`, and `diffViewScript` in
  `src/diff-view.ts` (the whole `dv-*` styling system) have no callers — only
  `renderDiffFullBody` is live.
- **Missing reading affordances.** All-files is unified-only (steps get
  side-by-side, the richer layout). Hunk gaps (`⋯`) are inert — you cannot see
  more context without flipping to Full file. There is no way to track which
  files you have already reviewed.
- **Two visual dialects.** The review page runs Apple-HIG tokens (`--md-*`
  role names mapped to system grays + system blue in `src/page-assets.ts`);
  the change page (`src/change-page.ts`) has its own parallel token set
  (`--elev`, `--hair`, `--subbg`, …). Values are close but not identical, so
  the two screens read as sibling apps rather than one.
- **Oversized asset file.** `src/page-assets.ts` is 2,280 lines of CSS + JS in
  two exported strings; every diff feature grows it further.

## Decisions (from brainstorming)

1. **Scope:** the whole diff-reading experience — story steps, All-files tab,
   full-file view, and the change page's visual language. One experience.
2. **Approach:** unify the diff engine *first* (approach B), then build
   features on the clean base (approach A). Delete dead `dv-*` code. Split
   diff CSS/JS out of `page-assets.ts`.
3. **Orientation features:** viewed-file tracking only. (Sticky toolbar, `?`
   shortcuts overlay, and change minimap were considered and cut.)
4. **Comfort features:** Split view in All-files + expand-context at hunk
   gaps. (Word-wrap toggle was considered and cut.)
5. **Polish reach:** both pages — unify tokens across change page and review
   page, plus a diff-focused visual pass.

## Design

### 1. Architecture — one diff engine

**New module `src/diff-render.ts`** — the single place that turns view-model
rows into HTML:

- `renderSplitRow(row: SbsRow, opts)` — the side-by-side row: left/right
  cells, gutters, signs, intra-line spans. Extracted from `sbsRow`/`cell` in
  `render.ts`.
- `renderUnifiedRow(row: UnifiedRow | SbsRow, opts)` — the unified row:
  number gutter, sign, code. Extracted from `unifiedRow` in `render.ts` and
  `rowHtml` in `diff-view.ts` (these are near-duplicates today).
- `renderHunkGap(...)` — the `⋯` separator, now carrying the data attributes
  expand-context needs (file, gap line range).
- Shared helpers: sign glyphs, gutter cells, intra-line side picking
  (`pickSide`), escaping.

**Invariants the extraction must preserve** (this is where regressions live):

- Comment-anchor attributes: `data-file` / line targets produced by
  `rowAttrs`/`targetAttrs` must be byte-identical for existing rows — comments
  and the selection→comment flow key off them.
- Voice-focus wiring: `data-step-focus` / focus-group attributes on step rows.
- Trust-check rendering (`UNEXPLAINED` tags on untoured rows).
- All HTML escaped server-side; client keeps injecting only server-escaped
  HTML (the existing no-injection-sink rule in `page-assets.ts` header).

**Call sites after the change:** step renderer (`render.ts`), All-files panel
(`render.ts`), full-file endpoint (`server.ts`), trust-drawer cards
(`render.ts`). `src/diff-view.ts` is deleted; `renderDiffFullBody` moves into
`diff-render.ts`.

**Asset split:** diff-specific CSS and client JS move from `page-assets.ts`
into a sibling `src/diff-assets.ts` exporting `DIFF_CSS` and `DIFF_JS`,
concatenated into the page at render time exactly like today (plain strings,
no `${}`). Page chrome (nav, sidebar, drawer, voice, story generator) stays in
`page-assets.ts`.

### 2. Viewed-file tracking (orientation)

- Each sidebar file item in the All-files tab gets a **viewed checkmark**
  control (a circled check that fills in when marked).
- Keyboard: `v` toggles viewed on the selected file (ignored in text-entry
  targets, consistent with `handleChangeShortcut`).
- Sidebar header shows progress: **"3 of 12 viewed"**.
- Marking a file viewed does not auto-advance; it is a bookkeeping act, not
  navigation. (j/k already navigate.)
- Persistence: `localStorage`, keyed by repo root + scope (base/head), same
  pattern as `ds-sidebar-width` / `ds-split`. Viewed state survives reloads of
  the same scope and resets naturally when the scope changes.
- Visual: viewed files render dimmed-but-legible in the sidebar so the
  unviewed remainder stands out.

### 3. Reading comfort

**Split view in All-files.** The per-file mode toggle becomes a three-way
segmented control: **Unified | Split | Full file**. Split reuses
`renderSplitRow` — the same layout steps use, including the draggable
`--ds-split` divider. Choosing a mode applies to the current file immediately
and becomes the default for every file (persisted as `ds-files-mode` in
`localStorage`; there is no separate per-file preference). The initial page
renders unified as today; a file's Split body is fetched lazily from
`GET /api/diff/split?file=…` the first time it is shown (same lazy pattern as
Full file), so the initial page stays light.

**Expand context.** Hunk gaps (`⋯`) and the region above the first hunk /
below the last become interactive:

- Controls: "↑ 20 lines", "↓ 20 lines", and "expand all" on each gap.
- Server: extend the existing full-file machinery (`buildFullFileRows`) with
  a range-parameterized endpoint —
  `GET /api/diff/context?file=…&from=…&to=…&layout=unified|split` — returning
  rows for that line range rendered in the requested layout (context rows
  only, no invented add/del rows).
- Client inserts the returned rows into the gap and updates or removes the
  gap control. Expanded rows are plain context rows — they carry line-number
  anchors so commenting on them works like any context row.
- Expansion works in both the unified and split layouts; the client passes
  the layout it is currently showing.

### 4. Visual polish — one app, both pages

- **Token unification.** The change page's token set (`--elev`, `--hair`,
  `--subbg`, …) is redefined on top of the review page's Apple-HIG values so
  both screens draw from the same palette — same grays, same system blue,
  same add/del hues, same shadows. Mechanically: a shared token block emitted
  into both pages (source of truth in one module), with the change page's
  legacy names aliased to it.
- **Diff-focused pass** (both layouts): distinct gutter background column
  (numbers visually separate from code), refined add/del row tints and
  stronger intra-line emphasis, cleaner hunk separators, macOS-style
  segmented controls for the mode toggles, consistent badges
  (New/Modified/Deleted/Renamed) across pages.
- **Motion.** 150–200ms ease transitions on file switches and mode switches;
  all motion behind `@media (prefers-reduced-motion: no-preference)`.
- **Contrast audit.** Verify add/del tints, intra-line emphasis, and dimmed
  viewed-file rows hit legible contrast in both dark (default) and light
  schemes.

## Error handling

- Expand-context on a file missing from the worktree → inline
  `ds-diffnote` ("Couldn't read … from the working tree"), matching the
  full-file behavior.
- Expand-context race (scope reloaded underneath): the endpoint validates the
  file is in the current scope; on mismatch the client shows the note and
  leaves the gap control in place.
- Split-view lazy fetch failure → inline note in the panel, toggle stays on
  the previous mode.
- localStorage unavailable (private mode) → features degrade silently:
  viewed marks and mode preference just don't persist (existing try/catch
  pattern).

## Testing

- **Unit (node --test):** `diff-render` row output — unified/split parity on
  the same view-model rows; anchor attributes byte-identical to current
  output (golden assertions captured before the refactor); hunk-gap data
  attributes; escaping.
- **Server:** new `/api/diff/context` param validation, range clamping,
  out-of-scope file rejection; split-view lazy endpoint.
- **Regression:** existing render/app-server suites must pass unchanged
  through the extraction phase — the refactor is done before any behavior
  change lands.
- **Manual:** run the demo, exercise steps + All-files in all three modes,
  comment on an expanded-context row, verify viewed marks survive reload,
  screenshot dark + light.
- `dist/` is rebuilt and committed with every src change (GitHub installs
  have no build step).

## Out of scope (considered, cut)

- Sticky file toolbar, `?` shortcuts overlay, change minimap (orientation
  extras).
- Word-wrap toggle.
- Any change to story generation, comments/agent loop, voice, or progress UI.
