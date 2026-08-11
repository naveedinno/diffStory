# Animation improvement plans

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

## Recommended execution order

1. **001** establishes the shared curves and durations referenced by later CSS plans.
2. **002**, **003**, and **005** remove the most visible high-frequency keyboard/read-aloud problems.
3. **004** fixes direct-manipulation performance independently of the other behavior changes.
4. **006** audits the resulting motion surface and supplies complete reduced-motion alternatives. Run it after 002 and 005 so it verifies their final selectors rather than temporary keyframes.
5. **008** uses the movement token from 001 and the reduced-motion convention from 006.
6. **007** uses the drawer curve from 001 and the accessibility convention from 006.
7. **009** is independent and intentionally deletes motion rather than replacing it.

## Dependencies

- Plans 007 and 008 depend on the token names introduced by 001.
- Plan 006 should follow 002 and 005, but remains safe if executed earlier because it explicitly handles their current keyframes.
- Plans 002, 003, 004, 005, and 009 have no code dependency on one another.

## Scope note

These plans cover every corrective finding selected from the audit. The three additive missed opportunities—folder-browser entrance, floating-progress-panel entrance, and anchored popover polish—remain deliberately out of scope until the corrective work is implemented and feel-checked.

## Execution

Completed on 2026-07-14. Plan 001's token migration stops at the review surfaces because `picker.ts` and `story-picker.ts` do not consume `sharedTokens()`, and `navStyles()` is shared with the tokenless story picker. Their literal timings remain unchanged per the plan's no-local-duplicate boundary.
