# 002 — Make change navigation instant and stable

- **Status**: DONE
- **Commit**: b352778
- **Severity**: HIGH
- **Category**: Purpose & frequency / Interruptibility
- **Estimated scope**: 2 files, small CSS/JS change plus tests

## Problem

Every Arrow, `n`/`p`, or bracket change jump starts a 1.2-second keyframe and schedules uncancelled cleanup:

```css
/* src/diff-assets.ts:102 — current */
.ds-row.is-change-jump,.ds-urow.is-change-jump{animation:dsChangeJump 1.2s ease}
@keyframes dsChangeJump{0%,100%{filter:brightness(1)}20%,70%{filter:brightness(1.32)}}
```

```js
// src/diff-assets.ts:197 — current
row.classList.add('is-change-jump');
scrollReviewRowVertically(row,opts);
setTimeout(function(){row.classList.remove('is-change-jump');},1300);
```

This is high-frequency keyboard navigation. Revisiting a row while it still owns the class may not restart feedback, and an older timer can remove a newer visit.

## Target

Change navigation must have no animation and no cleanup timer. The currently indexed change stays statically marked until navigation moves elsewhere:

```css
.ds-row.is-change-jump,.ds-urow.is-change-jump{
  box-shadow:inset 3px 0 0 var(--accent-blue);
}
```

Before marking the next row, remove `is-change-jump` from every change row in the same holder, then add it to the selected row. Keep the existing scroll behavior; plan 003 controls its scheduling.

## Repo conventions to follow

- `updateChangeNav()` already stores `data-change-index` and updates the numeric counter.
- Static story and voice focus use inset rails at `src/diff-assets.ts:41-58`; copy that visual grammar rather than inventing a pulse.

## Steps

1. Replace the `dsChangeJump` keyframe declaration in `src/diff-assets.ts` with the static inset-rail rule above.
2. Delete `@keyframes dsChangeJump`.
3. In `jumpToChange()`, remove `is-change-jump` from `changeRows(holder)` before adding it to `row`.
4. Delete the 1300ms timeout entirely.
5. Ensure `setMode()`, `selectFile()`, and `jumpToFirstChange()` still leave exactly one visible current change marked.
6. Add or update a test to assert that `DIFF_CSS` contains no `dsChangeJump` keyframes and `DIFF_JS` contains no delayed removal.

## Boundaries

- Do NOT remove change navigation, smooth scrolling, the counter, or shortcuts.
- Do NOT change story-focus or voice-focus selectors.
- Do NOT add a replacement animation.
- Do NOT add dependencies.

## Verification

- **Mechanical**: run `npm run build`, then `npm test`.
- **Feel check**: hold `n`, `p`, `[` and `]` on a file with many changes. The marker must follow immediately, never flash late, and never disappear because of an older visit.
- In DevTools at 10% playback, confirm change navigation creates no animation entry.
- Toggle `prefers-reduced-motion`; behavior must be identical because the interaction is motion-free.
- **Done when**: rapid navigation always leaves one current row statically marked and no timer/keyframe remains.
