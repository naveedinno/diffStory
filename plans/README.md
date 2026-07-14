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
