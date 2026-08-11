# Pre-React visual baseline

**Captured:** 2026-08-09
**Git HEAD:** `21565204aa7b3ebb79a3d0a5c5687df6e4d3823f`
(`2156520 fix: keep each story's saved reading position to itself`), plus the
working-tree state of that day — see "What was in the tree" below.
**Frames:** 55

## What this is

The last complete visual record of diffStory's hand-written HTML/CSS/JS UI,
taken immediately before the React 19 + Tailwind v4 + beUI rewrite described in
`docs/superpowers/specs/2026-08-09-beui-react-rewrite-design.md` replaced every
surface.

`docs/ui-atlas/screenshots/` is overwritten by every `npm run ui:atlas` run, so
within a few days of the rewrite starting there would have been no "before" left
anywhere. This directory is that before. **Nothing should ever write to it
again.** It is a fixed reference point, not a living gallery.

It is a byte-for-byte copy of the live atlas as of the capture, so
`index.html` here opens and browses exactly as the live one does.

## How to use it

Re-run `npm run ui:atlas` after a surface is rewritten and compare the new
`../screenshots/<name>.png` against `screenshots/<name>.png` here. The `state`
names are stable across the rewrite by design — that is what makes the pair
comparable. `manifest.json` lists every frame with its surface, viewport, theme
and route.

A rewritten surface is not expected to be pixel-identical; the design doc adopts
beUI's spacing, radii and motion deliberately. Use these frames to answer "did
we lose something", not "did anything move". The things most worth checking are
listed in the "At risk" section of `docs/superpowers/specs/surface-inventory.md`.

## Coverage

| Surface | Frames | Viewport/theme |
|---|---|---|
| `picker-recent` | 4 | desktop/dark, tablet/dark, mobile/dark, desktop/light |
| `picker-empty` | 2 | desktop/dark, mobile/dark |
| `picker-modal` | 4 | desktop/dark, tablet/dark, mobile/dark, desktop/light |
| `history-populated` | 4 | desktop/dark, tablet/dark, mobile/dark, desktop/light |
| `history-empty` | 2 | desktop/dark, mobile/dark |
| `change-populated` | 4 | desktop/light, tablet/light, mobile/light, desktop/dark |
| `change-empty` | 4 | desktop/dark, tablet/dark, mobile/dark, desktop/light |
| `change-refpicker` | 3 | desktop/dark, tablet/dark, mobile/dark |
| `raw-diff` | 4 | desktop/dark, tablet/dark, mobile/dark, desktop/light |
| `overview`, `code-step`, `concept-step` | 3 | desktop |
| `files-unified`, `files-split` | 2 | desktop |
| `review-menu`, `comment-queue`, `comment-composer`, `comment-anchor` | 4 | desktop |
| `pp-running` | 4 | desktop/dark, tablet/dark, mobile/dark, desktop/light |
| `pp-complete`, `pp-stopped`, `pp-failed`, `pp-blocked`, `pp-stage` | 5 | desktop/dark |
| `pp-detail-running`, `pp-detail-failed` | 2 | element-scale closeups |
| `tablet-review`, `mobile-step`, `mobile-comment-composer`, `mobile-comments` | 4 | tablet, mobile |

## Honest caveats

Read these before trusting a comparison.

- **Every frame is captured under `prefers-reduced-motion: reduce`.** That is a
  pre-existing property of the capture harness (`reducedMotion:'reduce'` on the
  browser context). Entrance animations, the picker sheet's open transition and
  the hero thread's draw/pulse are therefore *not* in these images. The motion
  behaviour lives in `motion-regressions.test.mjs` and in §1.7 / §2.6 / §3.6 /
  §4.11 of the surface inventory, not here.
- **The progress-panel frames are driven by fixture events, not a real agent.**
  No AI agent is on `PATH` during a capture. `progressState()` in
  `scripts/capture-ui-atlas.mjs` constructs the shipped `ProgressPanel` and
  feeds it the exact `ProgressEvent` shapes that `src/progress.ts` defines and
  that the server streams as NDJSON. Every pixel is produced by the real panel
  code; only the run behind it is synthetic. The elapsed timer therefore always
  reads `0s`.
- **`pp-stage` mirrors `mountPanelInStage()` rather than calling it.** That
  function is private to `PAGE_JS`. The capture performs the same three DOM
  operations — set `data-variant="stage"`, create `#ds-storystage` before the
  story-gen card, re-parent the panel node — so the placement is the real one,
  but it is a mirror, not the original code path.
- **The panel is captured against `prefers-color-scheme: dark` except for
  `pp-running-light`.** That single frame emulates a light OS scheme to record
  the panel's deliberate "stays dark in light mode" behaviour.
- **`change-populated` needed an explicit `?base=main&head=feat/spending-limit`.**
  Plain `/change` resolves to the (clean) uncommitted scope on the demo fixture,
  which is why the historical `change-populated` frame was in fact a duplicate
  of `change-empty` in the light theme. The change page's populated file
  inventory had never actually been in the atlas before this capture.
- **The folder-browser modal lists a seeded temp `HOME`.** The capture creates
  `notes-archive/`, `Projects/`, `Sandbox/` and a `workbench-demo/` containing a
  `.git` directory, so the sheet shows real rows and the green `repo` badge
  instead of its "No subfolders here." branch. The absolute paths in those
  frames are per-run temp directories and will differ on every capture.
- **Excluded from this copy:** eight orphaned PNGs still sitting in
  `../screenshots/` (`communication-agent-*.png`, `communication-task-picker.png`,
  `review-notes-drawer.png`, `review-conversation.png`,
  `responsive-mobile-notes.png`). They are unreferenced leftovers from an older
  atlas of a UI that no longer exists, and are not part of this baseline.

## What was in the tree

The capture is from `HEAD` **plus uncommitted work** — several agents were
preparing the rewrite in the same tree. Relevant to these images:

- `src/diff-assets.ts` carried a same-day fix renaming `mountThreads` →
  `mountCommentPins`. Without it, every lazily-loaded diff body threw
  `ReferenceError: mountThreads is not defined` and rendered "Could not load the
  split view." The `raw-diff`, `files-unified`, `files-split`, `code-step`,
  `comment-composer` and `comment-anchor` frames all depend on that fix, and all
  show real diff rows here.
- `src/server.ts` and a new `src/shell.ts` were also modified. Neither changed
  the appearance of these surfaces.

`manifest.json` records `source` as the short commit plus `+ working tree` for
exactly this reason.
