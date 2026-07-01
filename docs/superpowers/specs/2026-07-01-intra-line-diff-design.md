# Intra-line (word-level) diff highlighting — design

**Date:** 2026-07-01
**Status:** Implemented (2026-07-01) — 219 tests passing

## Problem

Both diff viewers tint whole rows: the removed line is fully red, the added line
fully green. When a line changes only in the middle — e.g.

```
- results = instantLayer.executeTemplate(templateId, signedOps, signatures, fills, flexFillerSignatures);
+ results = _executeInstantTemplate(templateId, signedOps, signatures, fills, flexFillerSignatures);
```

the identical prefix (`results = `) and identical suffix (the argument list) are
tinted exactly like the one span that actually changed
(`instantLayer.executeTemplate` → `_executeInstantTemplate`). The real change is
invisible in a sea of uniform color. Reviewers read this as "no diff here."

We want **intra-line highlighting**: pair each removed line with its
corresponding added line, diff them at the token level, and give the changed
tokens a stronger tint than the rest of the row.

## Current state

Two independent renderers, neither does intra-line diffing:

- **Side-by-side review page** — `src/render.ts`, `cell()` (~line 771). Renders
  `highlight(row.content)` inside a fully-tinted `ds-cell-del` / `ds-cell-add`.
  This is the view in the reported screenshot.
- **Unified story-less viewer** — `src/diff-view.ts`, `rowHtml()` /
  `hunksBody()`. Renders `highlight(content)` inside a fully-tinted `dv-del` /
  `dv-add` row.

Both share the syntax highlighter `src/highlight.ts`, whose `highlight(line)`
returns HTML-escaped text wrapped in `<span class="tk-*">` token spans. It is a
single regex tokenizer pass with one look-ahead: an identifier followed by `(`
is classified as a function call.

Line-level diff structures live in `src/diff.ts` (`parseUnifiedDiff`) and
`src/view-model.ts` (`SbsRow`). Rows are a flat, ordered list; a removed line and
its replacement are two separate rows.

## Decisions (from brainstorming)

1. **Scope:** both viewers, via a shared helper.
2. **Granularity:** word/token-level (not character-level).
3. **Composition strategy:** one unified tokenizer pass (Approach B below).
4. **Rendering location:** server-side, matching the existing SSR + zero-dep +
   trust model. No client-side diffing.

## Approach: unified tokenizer pass

Rather than overlaying diff markers onto already-highlighted HTML (fragile HTML
range surgery) or highlighting diffed runs in isolation (breaks `highlight()`'s
look-ahead at seams), we decide syntax class and diff class in one place:

1. Extract a `tokenize(line): Token[]` from `highlight()`, where
   `Token = { text: string; cls: string | null }` — `cls` is the `tk-*` class
   or `null` for unclassified text. `highlight()` is reimplemented as
   `tokenize(line).map(renderToken).join('')` and must produce **byte-identical
   output** to today's implementation (pinned by existing highlight tests).
2. Diff the two token arrays (old-line tokens vs new-line tokens) by `text`
   using an LCS. Tokens not in the common subsequence are marked changed.
3. Render each token with its `tk-*` class, wrapping changed tokens (or adding a
   `changed` class) so CSS can give them a stronger tint.

This keeps `highlight()`'s behavior intact, needs no HTML parsing, and puts
syntax + diff coloring in exactly one code path shared by both viewers.

## New / changed modules

### `src/highlight.ts` (refactor, output-preserving)
- Add `export function tokenize(line: string): Token[]`.
- Add `export interface Token { text: string; cls: string | null }`.
- `highlight()` becomes a thin wrapper over `tokenize()`. Escaping stays exactly
  where it is today (comments/strings/numbers/operators escaped; identifiers and
  whitespace passed through). Output must not change.

### `src/intra-line.ts` (new, shared)
- `diffLineTokens(oldLine: string, newLine: string): { left: string; right: string } | null`
  - Tokenizes both lines, runs LCS over token `text`.
  - Returns HTML for each side with changed tokens wrapped in a single shared
    `changed` span (plus their `tk-*` class). The class name is the same for both
    viewers; each CSS system scopes it (`.ds-code .changed`, `.dv-code .changed`).
    Escaping matches `highlight()`.
  - **Similarity guard:** returns `null` when the pair shares too few tokens
    (line effectively rewritten), so callers fall back to whole-line
    `highlight()` instead of rendering confetti. Threshold: common tokens ≥ ~30%
    of the larger side's non-whitespace token count. Exact constant tuned during
    implementation; documented in code.
- `pairChanges(rows, getType): Array<[delIndex, addIndex]>`
  - Given an ordered row list, finds contiguous change runs and pairs the i-th
    removed row with the i-th added row by position.
  - Unequal counts: pair `min(dels, adds)`; unpaired rows get no intra-line
    treatment (whole-line tint as today).
  - Generic over row shape so both `SbsRow[]` (render.ts) and the unified
    viewer's rows can use it.

### `src/render.ts` (side-by-side)
- Before rendering a block, compute pairs via `pairChanges`. For a paired
  removed/added row, precompute `diffLineTokens(oldContent, newContent)`.
- In `cell()`, when a row is half of a successful pair, emit the precomputed
  side's HTML instead of `highlight(row.content)`. Unpaired rows and `null`
  (dissimilar) results keep the current `highlight()` path.

### `src/diff-view.ts` (unified)
- Same idea in `hunksBody()` / `rowHtml()`: pair del/add lines within a hunk,
  emit intra-line HTML when `diffLineTokens` returns non-null.

### CSS
- Add a `changed` sub-tint in **both** class systems:
  - `ds-*` (render.ts styles): a stronger green on added-side changed tokens, a
    stronger red on removed-side changed tokens, layered over the row tint.
  - `dv-*` (`diffViewStyles()` in diff-view.ts): the same, using its tokens.
- Respect light and dark (`prefers-color-scheme`), consistent with existing
  `--dv-add` / `--dv-del` and `ds-cell-*` tints. The changed span must stay
  readable with the `tk-*` foreground colors on top of it.

## Data flow

```
parseUnifiedDiff → DiffFile[] → (view-model) SbsRow[]
                                     │
render.ts block ──► pairChanges ──► [del,add] pairs
        │                               │
        └── cell() ──► diffLineTokens(old,new) ──► {left,right} | null
                              │
                       tokenize() × LCS   (fallback: highlight())

diff-view.ts hunk ─► pairChanges ─► pairs ─► rowHtml() ─► diffLineTokens ─► …
```

## Edge cases

- **Whitespace-only / indentation changes:** tokens include whitespace; a pure
  reindent diffs cleanly (only whitespace tokens marked). Acceptable.
- **Fully rewritten line:** similarity guard returns `null` → whole-line tint.
- **Unequal del/add counts in a run:** pair by position up to the minimum;
  leftovers untouched.
- **Empty line vs non-empty:** treated as an add or del alone (no pair).
- **Very long lines:** LCS is O(n·m) in tokens; lines have few tokens, so this is
  fine. No special casing needed unless a pathological line appears — if so, cap
  token count and fall back to whole-line highlight above the cap.
- **HTML safety:** all token text is escaped exactly as `highlight()` escapes it
  today; the only new markup is the `changed` wrapper (static class name). Trust
  model unchanged (server-rendered, no user HTML injected).

## Testing (TDD)

- `tokenize()` round-trips: `tokenize(l).map(render).join('') === highlight(l)`
  for a corpus of TS/JS/Solidity lines (locks output-preservation).
- LCS diff: prefix/suffix common, middle changed; whole-line change; identical
  lines (no `changed` spans); whitespace-only change.
- Similarity guard: dissimilar pair → `null`.
- `pairChanges`: 1:1, 3-del/1-add, add-only run, del-only run.
- Integration: the `instantLayer.executeTemplate` → `_executeInstantTemplate`
  case as a fixture — assert only `_executeInstantTemplate` (right) and
  `instantLayer.executeTemplate` (left) carry `changed`, and the shared prefix /
  argument list do not.
- Rendered HTML in both viewers contains the `changed` class on the expected
  span and remains valid (spans balanced).

## Build / repo

- Rebuild and commit `dist/` alongside `src/` (github installs have no build
  step — repo convention).

## Out of scope (YAGNI)

- Character-level refinement within a changed token.
- Moved-line / block-move detection.
- Client-side or interactive re-diffing.
- Any change to how lines are *paired at the hunk level* by `parseUnifiedDiff`
  (we only pair within already-parsed runs for display).
