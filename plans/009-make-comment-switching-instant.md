# 009 — Make comment switching instant

- **Status**: DONE
- **Commit**: b352778
- **Severity**: MEDIUM
- **Category**: Interruptibility / Purpose & frequency
- **Estimated scope**: 2 files, small CSS change plus tests

## Problem

Opening a conversation and revealing each comment starts entry keyframes:

```css
/* src/page-assets.ts:504,517 — current */
.ds-thread.is-open{display:block;animation:dsChatIn .18s ease}
.ds-comment{padding:12px 14px 14px;background:transparent;border:0;font-family:var(--sans);animation:dsIn .18s ease}
```

Previous/next navigation changes `hidden` synchronously:

```js
// src/page-assets.ts:2052 — current
for(var k=0;k<comments.length;k++){
  var active=k===index;
  comments[k].hidden=!active;
}
```

Rapid comment navigation repeatedly restarts the incoming keyframe while the outgoing comment disappears immediately.

## Target

Conversation opening and comment switching are immediate. Remove both keyframe declarations from `.ds-thread.is-open` and `.ds-comment`; do not replace them. Keep `display:block`, `hidden`, focus, counter, and active-comment state unchanged.

The separate new-comment composer may retain `dsChatIn` because creating a comment is occasional and not part of previous/next navigation.

## Repo conventions to follow

- The keyboard command panel is intentionally instant at `src/page-assets.ts:741`; frequent review navigation should follow that responsive precedent.
- `showCommentInSurface()` already owns the complete comment-switch state and needs no timing lifecycle.

## Steps

1. Remove `animation:dsChatIn .18s ease` from `.ds-thread.is-open`.
2. Remove `animation:dsIn .18s ease` from `.ds-comment`.
3. Keep `dsChatIn` for `.ds-composer` if still used; remove `dsIn` only if no other selector references it after all plans run.
4. Do not add timers or transition-end handlers to `showCommentInSurface()`.
5. Update CSS-string tests to assert thread/comment navigation has no animation.

## Boundaries

- Do NOT change comment ordering, hidden state, focus restoration, sidebar collapse, or reply submission.
- Do NOT animate height, position, or opacity as a replacement.
- Do NOT remove composer entrance unless a separate audit selects it.
- Do NOT add dependencies.

## Verification

- **Mechanical**: run `npm run build`, then `npm test`.
- **Feel check**: open a row with several comments and rapidly press previous/next. Every action must show the requested comment immediately with no fade, restart, double exposure, or delayed close.
- In DevTools Animations at 10% playback, opening and switching conversations must create no animation entry.
- Emulate reduced motion; behavior must be identical.
- **Done when**: comment traversal is completely immediate and all existing navigation/focus behavior remains intact.
