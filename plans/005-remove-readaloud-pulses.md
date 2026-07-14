# 005 — Remove read-aloud repaint loops

- **Status**: DONE
- **Commit**: b352778
- **Severity**: HIGH
- **Category**: Performance / Purpose & frequency
- **Estimated scope**: 2 files, small CSS change plus tests

## Problem

Read-aloud continuously repaints every row in the active focus group:

```css
/* src/diff-assets.ts:51 — current */
.ds-row.is-voice-focus{box-shadow:inset 3px 0 0 var(--md-primary);animation:dsVoiceFocus 1.35s ease-in-out infinite}
@keyframes dsVoiceFocus{0%,100%{filter:brightness(1)}50%{filter:brightness(1.16)}}
```

The same rows already have a purple inset rail, gradient, line-number color, and `▶` marker. The toolbar icon also pulses indefinitely:

```css
/* src/page-assets.ts:191 — current */
.ds-readaloud.is-speaking .ds-readaloud-ico{animation:dsPulse 1s ease-in-out infinite}
```

This is redundant continuous motion during a long-running, keyboard-controlled workflow.

## Target

Keep voice focus entirely static:

```css
.ds-row.is-voice-focus,
.ds-urow.is-voice-focus{
  box-shadow:inset 3px 0 0 var(--md-primary);
}

.ds-readaloud.is-speaking .ds-readaloud-ico{
  animation:none;
  box-shadow:0 0 0 3px var(--accent-soft);
}
```

Preserve the existing gradient, `▶` marker, line-number color, and loading spinner. Remove `dsVoiceFocus` completely if nothing else uses it.

## Repo conventions to follow

- Static story focus at `src/diff-assets.ts:41-50` already communicates location without animation.
- Busy/loading state may still use the existing linear spinner because it communicates indeterminate work; plan 006 supplies its reduced-motion fallback.

## Steps

1. Remove `animation:dsVoiceFocus ...` from both focused row selectors.
2. Delete `@keyframes dsVoiceFocus` after confirming no remaining references.
3. Replace the speaking-icon pulse with the static three-pixel ring above.
4. Keep `dsPulse` if agent-busy state still references it; do not delete a shared keyframe with live consumers.
5. Update tests to assert voice-focus CSS contains no animation or filter.

## Boundaries

- Do NOT change read-aloud sequencing, speech timing, focus grouping, automatic scrolling, or keyboard controls.
- Do NOT remove static focus affordances.
- Do NOT remove loading spinners.
- Do NOT add a new animation.

## Verification

- **Mechanical**: run `npm run build`, then `npm test`.
- **Feel check**: play a multi-beat story for at least one minute. The active rows and speaking icon must remain unmistakable without pulsing.
- In DevTools Performance, confirm focused rows no longer generate continuous paint work.
- In the Animations panel, read-aloud playback must not create `dsVoiceFocus` or speaking-icon entries.
- **Done when**: narration retains clear static location/status feedback with no perpetual focus animation.
