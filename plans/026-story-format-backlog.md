# 026 — Backlog: what stories strained to express (briefs, not plans)

> **Not executable as-is.** Each item below is a brief: the evidence, a
> proposed shape, and acceptance criteria. Each needs its own planning pass
> (read the touched code, write a plan in the 014–025 style) before a cheap
> agent can execute it. Ordered by expected reviewer value per unit of work.

**Spec:** `docs/research/story-corpus-audit-2026-09.md` (sections 3–4) and the
two corpus audits' "things the format can't express".

---

## B1 — Checker findings inside the app ("story health")

- **Evidence:** 17 of 40 v3 stories fail the generation contract, and 35 of 53
  corpus stories fail validation, the contract, or lint. The reviewer only
  finds out when a step looks wrong.
- **Shape:** the review page shows a collapsible "Story health" row in the
  Overview: contract errors, unexplained changes (already shown as amber),
  and lint findings grouped by rule. Each finding has a "Repair with agent"
  action that calls the existing `storyRepairPrompt` flow with the step id.
- **Accept when:** opening the 2026-09-23 perps-core story shows its 16
  contract errors in the Overview, and repairing one step clears its finding
  without a full regeneration.
- **Touches:** `src/view-model.ts` (compute findings with `lintStory`),
  `src/render.ts`/`payloads.ts`, `client/surfaces/review/StoryView.tsx`, the repair route.

## B2 — Old-side (deleted-line) highlights in beats

- **Evidence:** stories say "at the deletion boundary around line 223 …"
  while glowing unrelated surviving lines, because highlights can only point
  at post-change lines (perps audit, pattern 6.1). The user's own complaint:
  "I see old code on the left and new code on the right and I can't connect
  those two".
- **Shape:** optional `beats[].oldHighlights: Array<[number, number]>`
  (pre-change lines) that glow in the left pane of split view. The validator
  checks them against the base-side file length.
- **Accept when:** a beat can glow a removed `require` on the left while the
  right pane shows where the check moved to.
- **Touches:** `src/types.ts`, `src/tour.ts`, `src/view-model.ts`
  (focus groups), `client/surfaces/review/engine/review-engine.js` (split pane
  glow). This is the largest item; its plan must read the engine's focus-group code first.

## B3 — Cross-file sweeps

- **Evidence:** renames, import churn, and multi-file deletions became one
  step per file: 42 steps for a folder rename, 13 identical deletion steps,
  and "Skim: repeated wiring (1/5)…(5/5)" (F7).
- **Shape:** a sweep step (tagged `sweep`) may carry
  `sweepFiles: Array<{ file: string; ranges: Array<[number, number]> }>`
  that claims coverage in other files. Its own `file`/`range`/beat show one
  representative instance. Coverage counts every entry; the UI lists the
  claimed files under the step.
- **Accept when:** the deployment-folder rename can be told in a few steps
  with 0 uncovered changes, and `numbered-series` lint findings disappear on a
  regenerated story.
- **Touches:** `src/types.ts`, `src/tour.ts`, `src/coverage.ts`,
  `src/story-lint.ts` (sweep rules), skill `references/camera-and-coverage.md`.

## B4 — "Regenerated" claims for generated files

- **Evidence:** stories narrate `dist/client/review.js`, ABIs, and
  lockfiles as decisions ("Ship the corrected review engine"; 3 lockfile
  stops in one story). `noise.ts` catches only some generators.
- **Shape:** `storyScope.regenerated: Array<{ files: string[]; by: string }>`
  (e.g. `{ files: ["abis/*.json"], by: "npx hardhat export-abi" }`). Coverage
  treats those files as explained; the all-files view shows one row per
  generator with its command.
- **Accept when:** a Solidity story with regenerated ABIs has zero ABI steps
  and zero unexplained ABI changes.

## B5 — Must-read path vs skim

- **Evidence:** summaries say "read the first four … skim the tail", and
  chapters are named "Skim: … (n/5)" (perps audit, 6.6). Fregnan et al. 2022:
  attention decays with position.
- **Shape:** optional step `weight: "must" | "skim"`. The rail can collapse
  skim runs and offer a "must-read only" walkthrough. Narration skips skim
  steps in that mode.
- **Accept when:** a 100-step story can be walked in its must-read subset
  with narration, without losing coverage accounting.

## B6 — Visual evidence for UI changes

- **Evidence:** UI/CSS stories describe renders the reviewer cannot see
  ("reads like a sibling of theme …"). The user: "I wanted something
  completely visual, bold".
- **Shape:** `evidence: Array<{ step: string; before?: string; after: string; caption: string }>`
  with image paths under `.diffstory/assets/`. The step's stage shows
  before/after thumbnails, and the caption is what narration speaks.
- **Open question:** who captures the screenshots (the agent via a browser
  tool, or the app)? Decide before planning.

## B7 — Automatic story history

- **Evidence:** the user keeps story revisions by hand in `backups/`
  (7 files in perps-core3), and patched stories leak residue ("The prior
  six-commit walkthrough is preserved in the local backups folder").
- **Shape:** the app snapshots the previous story to `.diffstory/history/<timestamp>.json`
  whenever a story file changes, and the story picker can open or diff an old
  version.

## B8 — Real Mermaid parsing in the app

- **Evidence:** an unquoted `O(1)` label broke a diagram (08-17). The lint
  (plan 016) now catches the known classes, but not every parse failure.
- **Shape:** when the client's Mermaid render throws, show the error and the
  offending line inside the concept step (not a blank box), and report it to
  the story-health row (B1).

## B9 — Audience knob (expertise reversal)

- **Evidence:** Kalyuga et al. 2003: guidance that helps newcomers costs
  experts. The user reviews their own protocol's code but asks "what is
  single close?" about unfamiliar corners.
- **Shape:** preferences gain `"audience": "newcomer" | "familiar"`. The
  skill scales landing detail and primer density to it. No schema change.
- **Accept when:** an A/B on one case with both settings shows the familiar
  story is shorter without losing judge `newcomer_coverage` below 3.

## B10 — 300-step stories stay fast

- **Evidence:** memory note "Performance: 300-step stories" (2026-08-04 brief:
  "300-step stories and 100+ file diffs must feel the same as 6-step ones").
  The muon stories have 235 and 252 steps.
- **Shape:** a separate performance campaign (profiling first), not part of
  story quality. Listed so it is not forgotten.
