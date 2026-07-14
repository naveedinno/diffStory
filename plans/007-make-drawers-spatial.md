# 007 — Make drawers spatial and interruptible

- **Status**: DONE
- **Commit**: b352778
- **Severity**: MEDIUM
- **Category**: Physicality & origin / Interruptibility
- **Estimated scope**: 2 files, medium CSS/JS lifecycle change plus tests

## Problem

Right-edge drawers use a generic downward entrance and instant close:

```css
/* src/page-assets.ts:93,694-696 — current */
@keyframes dsIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.ds-drawer-scrim{...animation:dsIn .15s ease}
.ds-drawer{...animation:dsIn .18s ease}
```

```js
// src/page-assets.ts:1916 — current
function openDrawer(){if(drawer){drawer.hidden=false;document.body.classList.add('ds-noscroll');}}
function closeDrawer(){if(drawer){drawer.hidden=true;document.body.classList.remove('ds-noscroll');}}
```

The panel's origin is the right edge, not below, and a close cannot be interrupted or reversed.

## Target

Use transitions with this exact motion:

```css
.ds-drawer-scrim{
  opacity:0;
  transition:opacity 200ms var(--motion-ease-out);
}
.ds-drawer{
  transform:translateX(100%);
  transition:transform 250ms var(--motion-ease-drawer);
}
.ds-drawer-root.is-open .ds-drawer-scrim{opacity:1}
.ds-drawer-root.is-open .ds-drawer{transform:translateX(0)}
```

On open: cancel pending hide, remove `hidden`, then add `is-open` in the next animation frame. On close: remove `is-open`, keep the root mounted for 250ms, then set `hidden=true`. Reopening during close must cancel the pending hide and retarget from the current transform.

## Repo conventions to follow

- Both trust and feedback drawers share `.ds-drawer-root` markup in `src/render.ts:1434-1453` and `src/render.ts:1504-1515`.
- Existing open/close entry points are centralized in `openDrawer`, `closeDrawer`, `openFeedbackDrawer`, and `closeFeedbackDrawer`.
- Use motion tokens from `src/theme.ts`; if plan 001 has not run, add the exact three easing tokens documented there rather than hard-coding another curve.

## Steps

1. Remove `animation` from `.ds-drawer-scrim` and `.ds-drawer`.
2. Add the transition and `is-open` rules above.
3. Add generic `showDrawerRoot(root)` and `hideDrawerRoot(root)` helpers. Store one hide timer per root, cancel it on reopen, and use 250ms exactly.
4. Route trust and feedback drawer functions through those helpers while preserving `ds-noscroll` behavior.
5. Ensure Escape, scrim click, close button, and navigation from drawer cards all use the animated close path.
6. Add reduced-motion handling: no `translateX`; keep a 200ms opacity-only transition, and use a 200ms hide delay.
7. Add tests for the `is-open` lifecycle and cancellable hide timer.

## Boundaries

- Do NOT change drawer markup, width, content, focus behavior, tabs, or z-index.
- Do NOT translate the scrim.
- Do NOT use keyframes or add a motion dependency.
- If the drawer can become hidden before focus is restored, STOP and fix lifecycle ordering rather than adding another timeout.

## Verification

- **Mechanical**: run `npm run build`, then `npm test`.
- **Feel check**: open/close both drawers from buttons, Escape, scrim, and internal navigation. They must move from the right edge and the scrim must only fade.
- Spam open/close at 10% playback; motion must reverse from its current position without jumping or disappearing early.
- Emulate reduced motion and confirm position movement disappears while opacity feedback remains.
- **Done when**: both drawers share one interruptible spatial lifecycle and no `dsIn` drawer animation remains.
