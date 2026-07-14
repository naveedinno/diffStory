# 004 — Frame-batch resize gestures

- **Status**: DONE
- **Commit**: b352778
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 2 files, medium client gesture refactor plus tests

## Problem

Sidebar and split-pane resizing write layout variables on every raw mouse event:

```js
// src/page-assets.ts:3075 — current
function moveSidebarResize(e){
  if(!sidebarResizing)return;
  setSidebarWidth(sidebarDragWidth(e),false);
}

// src/page-assets.ts:3092 — current
function moveSplit(e){
  if(!splitBody)return;
  // ...
  document.documentElement.style.setProperty('--ds-split',String(pct));
}
```

`--ds-split` is written on the document root and controls headers, cells, and gap rows. Sidebar collapse also animates layout-triggering `width` for 180ms:

```css
/* src/page-assets.ts:289 — current */
transition:width .18s ease,border-color .18s ease
```

## Target

- At most one sidebar and one split update may run per animation frame.
- Store pending `clientX`, request one frame, and compute/write inside that frame.
- Store `--ds-rail-width` on `.ds-layout`, not `document.documentElement`.
- Store `--ds-split` on the active `.ds-filepanel` or `.ds-diff` holder so it inherits only through that surface.
- Remove the sidebar `width` transition. Keep only `border-color var(--motion-duration-fast) ease`.

## Repo conventions to follow

- Drag state already lives in `PAGE_JS_TAIL` near `sidebarResizing` and `splitBody`.
- `body.ds-sidebar-resizing .ds-rail{transition:none}` documents that direct manipulation must track the pointer exactly.
- Persisted widths use `ds-sidebar-width` and `ds-split`; preserve both keys and their value formats.

## Steps

1. Add `sidebarResizeFrame`, `sidebarResizeClientX`, `splitResizeFrame`, `splitResizeClientX`, and `splitHolder` state.
2. Make each move handler store the latest `clientX` and request a frame only when one is not already pending.
3. In the frame callback, clear the frame id and perform the existing clamp/calculation once.
4. Update `setSidebarWidth()` and `currentSidebarWidth()` to read/write `--ds-rail-width` on `.ds-layout`, with the current computed value as fallback.
5. Set `splitHolder=closest(div,'.ds-filepanel,.ds-diff')` in `startSplit()` and write `--ds-split` there.
6. On initialization, apply the stored split value to every `.ds-filepanel,.ds-diff` rather than the document root.
7. Cancel any pending frame in both end handlers, flush the latest coordinate synchronously once, then persist.
8. Remove `width .18s ease` from `.ds-rail`; retain a 150ms color transition using the token from plan 001.
9. Add tests for scoped variable writes, animation-frame batching, and unchanged storage keys.

## Boundaries

- Do NOT change the 240px/560px sidebar bounds or 22%/78% split bounds.
- Do NOT change mouse/keyboard accessibility semantics of the separators.
- Do NOT animate transforms as a fake resize; the content must genuinely reflow.
- Do NOT add dependencies or convert the entire input system to a framework.

## Verification

- **Mechanical**: run `npm run build`, then `npm test`.
- **Feel check**: drag both separators quickly and slowly on a large diff. They must stay under the pointer with no delayed tail.
- In DevTools Performance, confirm resize writes occur no more than once per rendered frame.
- Confirm hidden diff panels do not receive inline `--ds-split` updates during an active drag.
- Keyboard-resize the sidebar and verify persisted widths survive reload.
- **Done when**: gestures remain exact while raw mousemove frequency no longer dictates layout-write frequency.
