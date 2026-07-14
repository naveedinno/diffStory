# 008 — Transform the reading progress fill

- **Status**: DONE
- **Commit**: b352778
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 2 files, small CSS/JS change plus tests

## Problem

The reading-progress indicator animates layout-triggering width on every step:

```css
/* src/page-assets.ts:312 — current */
.ds-readhead-fill{height:100%;background:var(--md-primary);border-radius:99px;transition:width .25s}
```

```js
// src/page-assets.ts:1253 — current
var pf=$('#ds-progress-fill');if(pf)pf.style.width=(i===0||!steps?0:(i/steps*100))+'%';
```

Rapid `j`/`k` navigation keeps width layout work active for consecutive 250ms transitions.

## Target

The fill stays at full layout width and represents progress only through a composite transform:

```css
.ds-readhead-fill{
  width:100%;
  height:100%;
  transform:scaleX(0);
  transform-origin:left center;
  transition:transform 250ms var(--motion-ease-in-out);
}
```

Set `style.transform='scaleX('+ratio+')'`, where `ratio` is clamped to `[0,1]`. Under reduced motion, preserve the transform state but set `transition:none`.

## Repo conventions to follow

- Progress text and fill are updated together in `activateStep()`.
- Use `--motion-ease-in-out:cubic-bezier(0.77,0,0.175,1)` because the indicator moves on screen rather than entering/exiting.
- Use the existing 250ms duration through `--motion-duration-progress` if plan 001 has run.

## Steps

1. Replace the width transition with the exact CSS above.
2. In `activateStep()`, calculate `ratio=i===0||!steps?0:i/steps`, clamp it, and write a scale transform.
3. Remove all inline width writes for `#ds-progress-fill`.
4. Add `.ds-readhead-fill{transition:none!important}` to the reduced-motion block without removing its transform state.
5. Update tests to assert `scaleX`, `transform-origin:left center`, and absence of inline width assignment.

## Boundaries

- Do NOT change progress math, text, track dimensions, colors, or step numbering.
- Do NOT use the Framer Motion `scaleX` shorthand; this is plain CSS transform.
- Do NOT add dependencies.

## Verification

- **Mechanical**: run `npm run build`, then `npm test`.
- **Feel check**: navigate forward/back rapidly with `j` and `k`. The fill must stay anchored to the left and retarget smoothly from its current size.
- In DevTools Performance, confirm the fill updates through compositor transform without layout events caused by the fill.
- Emulate reduced motion; progress must update instantly to the correct value.
- **Done when**: no progress update writes or transitions `width`, and the visual percentage remains exact.
