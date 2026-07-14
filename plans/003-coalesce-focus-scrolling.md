# 003 — Coalesce focus scrolling

- **Status**: DONE
- **Commit**: b352778
- **Severity**: HIGH
- **Category**: Interruptibility
- **Estimated scope**: 2 files, focused client-controller change plus tests

## Problem

Story and voice focus schedule a fresh uncancelled 120ms timer for every beat:

```js
// src/page-assets.ts:1297 — current
function centerFocusRows(rows,instant){
  if(!rows.length)return;
  var target=rows[Math.floor((rows.length-1)/2)];if(!target)return;
  setTimeout(function(){
    // ...
    scroller.scrollTo({top:Math.max(0,top),behavior:instant?'auto':'smooth'});
  },instant?0:120);
}
```

Rapid ArrowLeft/ArrowRight navigation can therefore execute stale intermediate destinations after the newest selection.

## Target

Only the most recent requested focus target may scroll. Preserve the existing 120ms non-instant settling delay, but make it cancellable and frame-aligned:

```js
var focusScrollTimer=0,focusScrollFrame=0;

function cancelFocusScroll(){
  if(focusScrollTimer)clearTimeout(focusScrollTimer);
  if(focusScrollFrame)cancelAnimationFrame(focusScrollFrame);
  focusScrollTimer=0;focusScrollFrame=0;
}
```

`centerFocusRows()` must call `cancelFocusScroll()`, retain the newest target, and schedule one `requestAnimationFrame` after either 0ms or 120ms. The frame must confirm the target is still connected before reading layout.

## Repo conventions to follow

- Long-lived review-controller state is declared in `PAGE_JS_HEAD` near `src/page-assets.ts:827`.
- Existing focus cleanup is centralized in `clearVoiceFocus()` and `clearStoryFocus()`.
- `scrollReviewRowVertically()` in `src/diff-assets.ts:156-165` is the shared change/comment scroll helper; do not duplicate its geometry formula.

## Steps

1. Add `focusScrollTimer` and `focusScrollFrame` to the page controller state.
2. Add `cancelFocusScroll()` beside `centerFocusRows()`.
3. Rewrite `centerFocusRows()` so every call cancels pending work, waits the existing 0/120ms delay, then performs layout reads and `scrollTo()` inside one animation frame.
4. Before scrolling, require `document.documentElement.contains(target)` and a live scroller.
5. Call `cancelFocusScroll()` when leaving the tour view and when read-aloud is cancelled.
6. Keep `scrollReviewRowVertically()` synchronous; change-navigation scheduling is already immediate and browser smooth-scroll calls naturally retarget.
7. Add a client-script regression assertion for the cancellation variables and `cancelAnimationFrame` path.

## Boundaries

- Do NOT change Arrow-key routing order or speech cursor behavior.
- Do NOT change the existing 120ms settling delay.
- Do NOT introduce a debounce library.
- Reduced-motion behavior belongs to plan 006; expose one clear behavior selection point but do not duplicate preference logic here.

## Verification

- **Mechanical**: run `npm run build`, then `npm test`.
- **Feel check**: press ArrowRight five times rapidly across story beats. The viewport must travel toward the final beat without visiting stale intermediate targets afterward.
- Repeat while read-aloud auto-advances and while manually reversing direction.
- In DevTools Performance, confirm one scroll geometry read per settled input burst, not one per discarded beat.
- **Done when**: stale focus requests are cancelled and the latest beat always owns the final viewport position.
