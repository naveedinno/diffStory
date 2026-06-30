# Collapse scope picker from six cards to three

**Date:** 2026-06-30
**Status:** Approved (design)

## Problem

The "Your change" screen's scope picker (`renderChangePage` in `src/change-page.ts`)
offers six mode cards:

1. Uncommitted — Working tree vs HEAD
2. Single commit — Parent → selected commit
3. Current branch — Merge-base → HEAD
4. Branch commits — Two commits on one branch
5. Cross-branch commits — Commit from each branch
6. Compare any refs — Branches, heads, commits

This is more choice than the underlying behavior justifies. Server-side
(`src/scope.ts`), cards 4, 5, and 6 are **already identical**: each only emits
`?base=X&head=Y` and resolves to `active: 'compare'`. The three differ purely in
their input UI (three separate `refpanel` blocks). "Compare any refs" is the
general case the other two are special-cased presentations of.

## Goal

Reduce the picker to exactly three cards:

| Card | URL it produces | Resolved diff (unchanged) |
|---|---|---|
| **Uncommitted** | `?scope=uncommitted` | `git diff HEAD` (working tree) |
| **Single commit** | `?scope=commit&commit=X` | parent(X) → X |
| **Compare any refs** | `?base=X&head=Y` (head optional) | `git diff X [Y]`; blank Y = working tree |

`Branch commits` and `Cross-branch commits` are removed because they are redundant
with `Compare any refs`. `Current branch` (merge-base / three-dot) is removed by
explicit decision: its merge-base semantics are not reproduced by typing two refs
into Compare, and we accept that trade-off for the simpler picker.

## Non-goals

- No change to how any retained scope is diffed. `resolveScope` output for
  `uncommitted`, `commit`, and `compare` is byte-for-byte the same.
- No change to the `compare` panel's UI or its generic ref picker (HEAD +
  branches + recent commits, sourced from `/api/refs`). Pasting a SHA and picking
  a branch both still work, which is how a user reaches any commit on any branch.
- No unrelated refactoring of `change-page.ts`.

## Changes by file

### `src/change-page.ts`
- **Markup:** remove the `Current branch` `<a>`, the `Branch commits` button, and
  the `Cross-branch commits` button from `scopeControls`. Remove the `range` and
  `cross` `refpanel` blocks. Keep the `commit` and `compare` panels and the shared
  `refPicker`.
- **CSS:** remove `.refpanel[data-panel="range"]`, `.refpanel[data-panel="cross"]`,
  `.refside`, and the `range`/`cross` references inside the `max-width:1080px`
  media query.
- **JS:** remove the `rangeGo`/`rangeBase`/`rangeHead` and
  `crossGo`/`crossBase`/`crossHead` click handlers; remove the branch→commit
  wiring loop (`[['rangeBranch',...],['crossBaseBranch',...],['crossHeadBranch',...]]`);
  remove `fetchBranchCommits`, `branchFor`, the `branchCommits` field on `refData`,
  and the `branch` / `branch-commit` cases in `sourceOptions`. Keep `branchOptions`,
  `commitOptions`, `refOptions` — the `compare` panel's `ref` picker still uses them.

### `src/scope.ts`
- Remove the `if (sel === 'branch')` block.
- Drop `'branch'` from the `active` union type (`'uncommitted' | 'commit' | 'compare'`).
- Update the leading comment to drop the "committed current branch" mode.
- `resolveBase` import: keep only if still referenced; it is no longer used in
  `scope.ts` after this change, so remove it from `scope.ts`'s import. (The
  function itself stays in `git.ts` — it is used by `change-view.ts`,
  `repo-state.ts`, and `server.ts`.)

### `src/server.ts`
- Remove the `GET /api/commits` endpoint (the per-branch commit list). It was only
  ever called by the now-deleted branch→commit drill-down; the compare picker uses
  `/api/refs`.

### Tests
- `test/change-page.test.mjs` — remove assertions for `Cross-branch commits` and
  `data-panel="cross"`. Add/keep an assertion that the three retained cards render
  and that `range`/`cross` panels are absent.
- `test/scope.test.mjs` — remove the `scope=branch` → `active: 'branch'` case.
- `test/app-server.test.mjs` — remove the `/api/commits` case.

### `dist/`
- Rebuild and commit the regenerated `dist/` alongside the `src/` changes
  (GitHub installs have no build step).

## Verification

1. `npm test` passes.
2. Manual: open the change page — exactly three cards render in one row;
   `Single commit` and `Compare any refs` panels still open, autocomplete, and
   navigate; `Uncommitted` link still works.
3. Confirm no console errors from removed handlers (the picker JS still wires
   cleanly with the reduced markup).

## Risks

- Low. The removed cards were redundant (4, 5) or an explicitly-dropped
  convenience (3). No retained diff behavior changes.
- A user with a bookmarked `?scope=branch` URL will now fall through to the
  auto/clean-tree default instead of the merge-base diff. Acceptable given the
  decision to drop the mode.
