# File-Budget Triage for Many-File Changes

Date: 2026-07-16
Status: approved

## Problem

diffStory bounds single files (`REVIEW_NOISE_MAX_LINES = 1500` in
`src/noise.ts`) but places no bound on file count. A change touching thousands
of files renders a sidebar row and a lazy panel placeholder for every one of
them: page HTML is O(change size), the sidebar becomes unusable, and the
per-file acknowledgment path that approval requires becomes infeasible by
hand. Mass codegen, dependency bumps, and repo-wide renames all hit this.

## Goal

A change of any file count opens as a bounded, reviewable page. The meaningful
files render; the long tail is triaged in acknowledgeable bundles; the exact
approval contract — every changed file is either reviewed or explicitly
acknowledged — is preserved, and becomes *practical* at scale.

## Design

### Budget and selection (`src/noise.ts`)

- New constant `REVIEW_MAX_RENDERED_FILES = 200` beside the existing line cap.
  `src/noise.ts` remains the single owner of exclusion policy.
- New pure function `applyFileBudget(files, priority)` returning
  `{ rendered, overflow }`. It runs **after** the existing per-file exclusions
  (generated-path / large-diff / binary / metadata-only).
- Selection is deterministic, in priority classes:
  1. story-step files (the tour must never point at an unrendered panel),
  2. files with saved comments (anchors need their panels),
  3. remaining files in diff order until the budget fills.
  Priority classes always render even when they alone exceed the budget; the
  budget truncates only the unprioritized tail.
- Overflow files get the new `ReviewExclusionReason: 'file-budget'` with the
  same `ReviewExclusionMetadata` shape (path, reason, added/removed/changed
  lines).

### Server (`src/git.ts`, `src/server.ts`)

- `excludedReviewFiles` merges the existing per-file exclusions with the
  budget overflow, so every downstream consumer — trust drawer, verdict
  gating, excluded-file preview — sees one list with per-file reasons.
- The rendered page (sidebar, panels, lazy placeholders) is built from
  `rendered` only: page HTML becomes O(budget), independent of change size.
- The existing `GET /api/review/excluded-file` preview works unchanged for
  budget-excluded files.
- The exact change fingerprint is untouched: it continues to cover every
  changed file, rendered or not, so approval identity never narrows.

### Triage UI (`src/render.ts`, `src/page-assets.ts`)

- **Sidebar overflow row**: after the rendered file list, one compact row —
  "+N more files — open triage", where N counts `'file-budget'` exclusions —
  opens the trust drawer. No sidebar rows for overflow files.
- **Directory bundles in the trust drawer**: excluded files group by their
  first two path segments (e.g. `packages/foo/`; root-level files group under
  the repository root), each bundle showing a count,
  aggregate +/− lines, and the dominant exclusion reason. A bundle expands to
  its file rows (existing preview links) and has an **Acknowledge all**
  action.
- Bulk acknowledgment is purely client UX: it expands to the same
  per-path `acknowledgedExclusions: string[]` the verdict API already
  accepts. No server contract change.
- The trust pill and Review menu counts already reflect excluded files;
  `'file-budget'` flows through those counters unchanged.
- Accessibility follows the drawer's existing contracts: bundles are
  disclosure buttons with stable accessible names, counts announced, 44px
  targets, WCAG AA in both themes.

### Interactions with existing behavior

- **Coverage**: story-claim coverage continues to measure the rendered diff;
  excluded files are surfaced by the trust pill, not counted as unexplained
  changes. `'file-budget'` inherits the existing exclusion semantics.
- **Since-review mode**: the budget applies to whichever file list the mode
  presents, computed per render, so a follow-up view is bounded the same way.
- **File filters/search**: operate on rendered files; the overflow row stays
  visible so triage is always reachable.
- **Live events**: unchanged. The fingerprint poll already covers unrendered
  files because it hashes the change, not the view.

## Testing

- `test/noise.test.mjs`: budget selection determinism, priority classes
  (story/comment files always render, tail truncates), overflow metadata
  shape, budget boundary (exactly at/over the cap).
- `test/git-noise.test.mjs`: `excludedReviewFiles` merges per-file and budget
  exclusions with correct reasons.
- `test/render-page.test.mjs`: overflow row markup and count, bundle grouping,
  acknowledge-all hooks, ARIA contract.
- `test/app-server.test.mjs`: approval over a budget-exceeding change is
  blocked until budget-excluded files are acknowledged, and succeeds after
  bulk acknowledgment; excluded-file preview works for a `'file-budget'` file.

## Out of scope

- DOM recycling/virtualization inside the rendered set (revisit only if a
  ~200-file rendered view proves heavy).
- Async or pre-checked git fingerprinting for large repos (separate concern,
  noted in the live-review-loop spec).
- Merge-commit, copy-detection, binary-preview, and submodule capability gaps
  (the other half of big-diff resilience).
- A user-configurable budget (constant first; add a knob only on real demand).
