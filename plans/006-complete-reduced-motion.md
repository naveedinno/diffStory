# 006 — Complete reduced-motion handling

- **Status**: DONE
- **Commit**: b352778
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 4 files, medium CSS/JS accessibility pass plus tests

## Problem

Reduced-motion handling misses several active paths:

```css
/* src/page-assets.ts:809 — current */
@media (prefers-reduced-motion:reduce){... .ds-toast{animation:none!important}}
```

The toast actually moves through `transition`, not `animation` (`src/page-assets.ts:733-736`). Diff row keyframes are not covered by `src/diff-assets.ts:152`, and `src/progress-ui.ts:23-63` has rotating/pulsing status motion with no reduced-motion query. Programmatic scrolling also ignores the preference:

```js
// src/diff-assets.ts:162 — current
scroller.scrollTo({top:Math.max(0,top),behavior:opts&&opts.instant?'auto':'smooth'});
```

## Target

Add one shared client helper:

```js
function prefersReducedMotion(){
  return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
```

All programmatic review scrolling must select `auto` when this returns true. CSS reduced-motion states must:

- remove row brightness/keyframe motion;
- keep toast opacity feedback for `200ms ease`, but remove its vertical translation;
- stop progress spinner/pulse keyframes while leaving static colored indicators;
- remove the voice-card `translateY(-1px)` hover movement;
- preserve color, opacity, and static status information.

## Repo conventions to follow

- `compactScreen()` at `src/page-assets.ts:1013` demonstrates the existing `matchMedia` helper style.
- The picker already gates decorative reveal with `@media (prefers-reduced-motion:no-preference)` at `src/picker.ts:251-255`.
- The VS Code spinner already becomes static under reduced motion at `vscode-extension/src/webview.ts:568`.

## Steps

1. Add `prefersReducedMotion()` in `PAGE_JS_HEAD` beside `compactScreen()` or the other environment helpers.
2. Update both `scrollReviewRowVertically()` and `centerFocusRows()` to use `auto` whenever the preference is reduced, regardless of the caller's `instant` flag.
3. Extend the diff reduced-motion block to explicitly disable `dsVoiceFocus`, `dsChangeJump` if still present because plans ran out of order, and body-switch movement.
4. Rewrite the toast reduced-motion rule so its transform is always `translateX(-50%)`, its transition is `opacity 200ms ease`, and `.is-show` only changes opacity.
5. Add a reduced-motion block inside `progressPanelStyles()` after its keyframes. Stop `.ds-pp-spin`, active-step, live-dot, and milestone animation; keep their border/background colors visible.
6. Gate `.ds-voice-card:hover{transform:translateY(-1px)}` behind `@media (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)`.
7. Add tests that check the JS preference branch and each affected CSS selector, not just the existence of the media-query string.

## Boundaries

- Do NOT turn off all feedback globally.
- Do NOT hide spinners, progress markers, toast text, focus rails, or status colors.
- Do NOT change speech or navigation semantics.
- Do NOT add a dependency.

## Verification

- **Mechanical**: run `npm run build`, then `npm test`.
- **Feel check**: in DevTools Rendering, emulate reduced motion and exercise change navigation, beat navigation, toasts, read-aloud, voice selection, and a live progress panel.
- Confirm scrolling snaps to the destination, toast text still fades, progress remains legible, and no element translates, rotates, or pulses.
- Turn the preference off and confirm standard motion returns.
- **Done when**: every movement path has an explicit reduced alternative and comprehension feedback remains intact.
