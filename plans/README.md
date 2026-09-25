# Animation and story-stage improvement plans

Baseline: commit `b352778`, audited against the working tree on 2026-07-14. The working tree already contained unrelated uncommitted changes when these plans were written; executors must preserve them.

| Plan | Title | Severity | Status |
| --- | --- | --- | --- |
| 001 | Unify motion tokens | MEDIUM | DONE |
| 002 | Make change navigation instant and stable | HIGH | DONE |
| 003 | Coalesce focus scrolling | HIGH | DONE |
| 004 | Frame-batch resize gestures | HIGH | DONE |
| 005 | Remove read-aloud repaint loops | HIGH | DONE |
| 006 | Complete reduced-motion handling | MEDIUM | DONE |
| 007 | Make drawers spatial and interruptible | MEDIUM | DONE |
| 008 | Transform the reading progress fill | MEDIUM | DONE |
| 009 | Make comment switching instant | MEDIUM | DONE |
| 010 | Restore reduced-motion and touch gating on the React surfaces | MEDIUM | DONE |
| 011 | Unify press feedback to one scale | MEDIUM | DONE |
| 012 | Give the floating progress panel an entrance and exit | MEDIUM | DONE |
| 013 | Build the native presentation story stage | MEDIUM | DONE |

## Second audit — 2026-08-09, commit `2156520`

Plans 001–009 were written against the pre-rewrite vanilla app. Four of the five
surfaces have since been rewritten in React 19 + Motion 11 + Tailwind v4, and
their vanilla sources (`src/picker.ts`, `src/story-picker.ts`,
`src/change-page.ts`, `src/progress-ui.ts`) deleted. This audit re-checked the
motion surface after that move.

**The July standards largely survived.** No `ease-in`, no `transition: all`,
every duration a motion token, explicit transition property lists throughout.
There is no large corrective backlog and nothing rated HIGH.

Three findings became plans:

- **010** is a genuine regression: plan 006 completed reduced-motion coverage
  across the app, and the repo picker lost it in the rewrite. It is now the only
  surface with ungated movement. Bundled with a touch-hover gap on the story row.
- **011** is cohesion: four different press scales (`.94`, `.97`, `.98`, `.992`)
  where the playbook specifies 0.95–0.98. `.992` is imperceptible on the picker's
  most-clicked control; `.94` is the app's most aggressive press and sits on a
  destructive delete.
- **012** is the one additive item, and it closes a deferral from the first
  audit (see the scope note below).

**Status of the three opportunities deferred in July**, re-checked against git:

| Opportunity | Outcome |
| --- | --- |
| Folder-browser entrance | Already existed in the vanilla picker; the rewrite ported and tokenised it. Closed, not new. |
| Anchored popover polish | The vanilla change page had **zero** transitions on the ref picker. The React version added a `clipPath: inset()` reveal with `y: -4`, `scale: 0.985`, gated on reduced motion. **Delivered by the rewrite.** |
| Floating progress-panel entrance | **Still open** → plan 012. |

Not audited in depth this round: interruptibility and performance across
`client/surfaces/review/engine/review-engine.js` (3,319 lines) and
`client/surfaces/review/review.css` (1,190 lines). Both were lifted near-verbatim
from the code that passed the July audit, so they carry its findings forward, but
they have not been re-examined against those two categories since the port.

## Feature plan — 2026-08-16, commit `1e23de5`

Plan 013 is an additive product plan for making the existing filmstrip Story
view feel like a composed presentation while keeping the real diff viewer live.
It deliberately does not embed Reveal.js or add a second slide/navigation
runtime. The app derives a small scene-layout projection from existing story
facts, then owns responsive composition and restrained first-visit motion.

The plan is split into four passing slices: scene contract, static composition,
first-visit choreography, and visual evidence. It preserves the metadata-first
300-step lazy contract, the imperative review-engine ownership boundary, Tour
v1/v2/v3 compatibility, narration, comments, and current keyboard behavior.

## Recommended execution order

1. **001** establishes the shared curves and durations referenced by later CSS plans.
2. **002**, **003**, and **005** remove the most visible high-frequency keyboard/read-aloud problems.
3. **004** fixes direct-manipulation performance independently of the other behavior changes.
4. **006** audits the resulting motion surface and supplies complete reduced-motion alternatives. Run it after 002 and 005 so it verifies their final selectors rather than temporary keyframes.
5. **008** uses the movement token from 001 and the reduced-motion convention from 006.
6. **007** uses the drawer curve from 001 and the accessibility convention from 006.
7. **009** is independent and intentionally deletes motion rather than replacing it.
8. **010–012** are complete follow-up findings from the React migration audit.
9. **013** is complete. Its optional standalone export follow-up remains a
   separate future decision after the native scene system has been used on real
   stories.

## Dependencies

- Plans 007 and 008 depend on the token names introduced by 001.
- Plan 006 should follow 002 and 005, but remains safe if executed earlier because it explicitly handles their current keyframes.
- Plans 002, 003, 004, 005, and 009 have no code dependency on one another.
- Plan 013 depends on the shared tokens from 001, the reduced-motion contract
  from 006, and the already-delivered filmstrip/View Transition/logic-move
  behavior. It has no dependency on a presentation library.

## Scope note

The July audit originally deferred three additive opportunities. Folder-browser
and anchored-popover polish were delivered by the React rewrite; plan 012 has
since delivered the floating progress-panel entrance. Plan 013 is a separate
story-presentation feature, not an unresolved corrective audit finding.

## Execution

Completed on 2026-07-14. Plan 001's token migration stops at the review surfaces because `picker.ts` and `story-picker.ts` do not consume `sharedTokens()`, and `navStyles()` is shared with the tokenless story picker. Their literal timings remain unchanged per the plan's no-local-duplicate boundary.

## Story quality campaign — 2026-09-25

Plans 014–026 improve the stories the `diffstory-storyteller` skill writes.
They argue from one evidence file: `docs/research/story-corpus-audit-2026-09.md`,
an audit of 66 real stories across 20 repositories, 3,141 user messages,
the app's validators run over the whole corpus, and new research.

**The short version of what was found:** stories written from chat are never
validated (the newest one fails with 50 errors); the 56 KB skill does not
survive long sessions; no craft rule (landing, seams, copied beats, formulaic
voice) is checked anywhere; a stale 1,400-line Codex copy of the skill was
still installed; and standing preferences ("only Solidity", "detailed") had
nowhere to live. The campaign fixes the tooling first, measures, rewrites the
skill, and measures again.

| Plan | Title | Kind | Billed runs | Status |
| --- | --- | --- | --- | --- |
| 014 | Extract story verification into standalone modules | refactor | no | DONE |
| 015 | Add a `verification` field (what the author ran) | schema → UI | no | DONE |
| 016 | Deterministic story lints | new module | no | DONE |
| 017 | Bundle a story checker (and ledger) into the skill folder | tooling | no | DONE |
| 018 | No stale storyteller skill survives an install | tooling | no | DONE |
| 019 | Eval cases from the repos stories are written for (Solidity) | eval | no | DONE |
| 020 | Lint in the eval, rubric v2, blind A/B, corpus report | eval | no | DONE |
| 021 | Baseline: measure the current skill | operations | **yes (~12)** | DONE |
| 022 | Split the skill into a core and references (verbatim) | skill | no | DONE |
| 023 | Storyteller craft rules v2 | skill | no | DONE |
| 024 | App prompts run the checker; repairs land the listener | prompt | no | DONE |
| 025 | Measure v2 against the baseline, then decide | operations | **yes (~24)** | TODO |
| 026 | Backlog briefs (story-format features) | briefs | — | needs planning |

### Execution order and dependencies

```text
014 ─┬─> 017 ──┬──> 020 ──> 021 (baseline) ──> 022 ──> 023 ──> 024 ──> 025 (after)
015 ─┤         │
016 ─┘         │
018 ───────────┤
019 ───────────┘
```

- 014, 015, 016, 018, and 019 are independent of each other; run them in any
  order, or in parallel **only in separate worktrees** (see rules below).
- 016 needs 015 (it reads `tour.verification`). 017 needs 014 and 016.
  020 needs 016 and 019.
- **021 must run before 022.** The baseline measures the current skill, so
  nothing under `skills/diffstory-storyteller/` (except the plan-017 bundle)
  may change before it.
- 022 → 023 → 024 strictly in order. 023 checks a digest of 022's output and
  refuses to run on anything else.
- 025 last. 026 items each need their own planning pass.

Every plan's code was compiled and its tests run in a scratch copy of this
repository on 2026-09-25 (except 021 and 025, which spend agent runs, and
015's React rendering, which has a manual check). Executors should expect the
steps to work as written. If one doesn't, the repo moved since then: fix the
smallest thing and report it.

### Rules for every executor

1. **Start clean.** Work on the `story-quality-campaign` branch. The work that
   was uncommitted when these plans were written was committed there as
   `f80d93a`, so the tree should be clean. For every plan: run
   `git status --short` first, and if a file your plan modifies already shows
   as modified and you did not modify it, **stop and report**.
2. **Git safety.** Never run `git checkout`, `git switch`, `git stash`,
   `git reset`, `git restore`, `git clean`, `git rebase`, or `git push`. Stage
   files by explicit path only; never `git add .`, `git add -A`, or
   `git add dist/`. Parallel agents must each work in their own
   `git worktree` (they can wipe each other's uncommitted work otherwise).
3. **`dist/` is committed.** Every `src/` change ships with its rebuilt
   `dist/*.js` in the same commit (`npm run build`). The same goes for
   `skills/diffstory-storyteller/scripts/check-story.mjs` once plan 017 lands.
4. **Tests are the gate.** A task is done when its tests pass and `npm test`
   passes. Never weaken an assertion to make a test pass unless the plan tells
   you to change that assertion.
5. **No billed runs without a go-ahead.** Plans 021 and 025 spawn `claude` runs.
   Do not run `generate`, `judge`, `all`, or `compare` in any other plan.
6. **Never commit `.diffstory/`** (stories, preferences, comments). It is local
   review state in every repository.
7. **Never write into other repositories.** Plans 017 and 019 only read
   `~/Codes/**` (checker dry-runs, eval clones via `git clone --shared`).
8. **Commit messages:** conventional prefix (`feat:`, `fix:`, `refactor:`,
   `test:`, `docs:`), imperative, and no generated-by or co-author trailers.
9. **Report:** list your commits, paste the outputs each plan asks for, and
   say plainly what you could not verify.

### Decisions this campaign makes (the user can override before 023)

These defaults are explained in section 6 of the audit file. Each is a single
edit to reverse.

- **D1** A checker script ships inside the skill folder; it is not a `diffstory` CLI.
- **D2** One spoken line pointer ("down at line 120") is allowed per step, after the landing; "Look at lines …" is an error.
- **D3** Moves are expected for every relocation; the restraint filter stays for callouts.
- **D4** Standing preferences live in `.diffstory/preferences.json` (local).
- **D5** Environment gaps go in a new `verification` field, not in hotspots.
- **D6** The skill runs only when explicitly asked (your decision; already landed in `9a88ea0`, pinned by a test).
- **D7** Intent opens on the problem, not the diff.
- **D8** Core `SKILL.md` ≤ 520 lines, with references loaded on demand; schema re-read before writing.

### Follow-ups

(Plan 025 appends here.)
