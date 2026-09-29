# 006: Calm review motion, inputs, and emphasis
- Findings: MOT-3, MOT-4, MOT-11, MOT-12, TYP-1, TYP-5, TYP-6, VIS-1
- Severity: MEDIUM
- Wave: 2 (review.css chain, runs after plan 005)
- Owned files: client/surfaces/review/review.css

## Problem
- MOT-3: `.ds-filmnode-num{...transition:transform 260ms cubic-bezier(.34,1.56,.64,1),color ...}` (:1179) overshoots over 260ms on frequent hover/focus.
- MOT-4: `.ds-readaloud-wave{...transition:width var(--motion-duration-ui) ...}` (:1401) animates `width` (0 to 20px).
- MOT-11: transport morph runs `ds-transport-morph 220ms cubic-bezier(.34,1.56,.64,1)` from `scale(.58) rotate(-18deg)` with no blur (:1401 area); copy action swaps from `scale(.45) rotate(-24deg)` (:192 area).
- MOT-12: `.ds-fileitem-viewed{...opacity:0;transform:scale(.72);...}` (:1027) enters from near nothing.
- TYP-1 (CSS half): `.ds-file-search input` (:243), `.ds-storyfile-search input` (:376), `.ds-field-note textarea` (:387), `.ds-queue-edit textarea` (:1288) set 12 to 12.5px, triggering iOS zoom. (TSX halves are plans 015 and 019.)
- TYP-5: `.ds-md em{font-style:italic}` (:534) and `.ds-code .tk-c{...font-style:italic}` (:1012) request italics no shipped face provides (assets/fonts holds latin normal only; confirmed no italic woff2 exists). Per the lens fallback: restyle instead of loading.
- TYP-6 (CSS half): `.ds-intro-freshness a{...text-decoration:underline;text-underline-offset:3px}` (:965) plus plain underlines at :1013, :1266, :1267 lack skip-ink/from-font tuning. (TSX half is plan 015.)
- VIS-1: `.ds-intro-start{...padding:14px 22px;border-radius:12px;...}` (:323) is a rect while every other primary is a pill (surface base `.ds-btn{...border-radius:var(--radius-pill);...}` at :147).

## Target
- Filmnode: `transition:transform 150ms var(--motion-ease-out),color ...` (house curve, no overshoot); drop `will-change:transform` (or scope to `:hover,:focus-visible` only).
- Wave: width change instant; animate opacity/transform only (keep the same end state).
- Icon swaps: cross-fade with opacity 0 to 1, `blur(4px)` to 0, scale 0.25 to 1, no rotation, no overshoot curve (use `var(--motion-ease-out)`); 220 to 300ms.
- Viewed check: enter from `scale(.95)` with opacity (or opacity alone).
- Inputs: add a coarse-pointer/max-width media block setting `font-size:16px` on the four controls for small screens (e.g. `@media (pointer:coarse),(max-width:640px)`), desktop values unchanged. User chose the size-up recipe.
- Emphasis: `.ds-md em{font-style:normal;font-weight:600}`; `.ds-code .tk-c` drops `font-style:italic` (keep its color).
- Underlines: add `text-decoration-skip-ink:auto;text-underline-position:from-font;text-decoration-thickness:from-font` to the four underlined rules.
- Intro CTA: `border-radius:var(--radius-pill)`; padding and sub-line unchanged.

## Repo conventions
- Motion tokens: `var(--motion-ease-out)`, `var(--motion-duration-ui/fast)` in theme; reduced-motion paths stay intact (rules at :1347 area).
- Type: self-hosted faces only; never reference unshipped italics again.

## Steps
1. Retune the filmnode transition and will-change.
2. Make the wave width instant, opacity/transform animated.
3. Rewrite both icon-swap keyframes to the cross-fade values.
4. Change the viewed-check entrance to scale(.95).
5. Add the mobile 16px input block.
6. Restyle `em` and `.tk-c` to non-italic.
7. Tune the four underline rules.
8. Pill the intro CTA radius.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`
- Look: dock magnification is a short flat lift; wave reveal has no layout jank; icon swaps cross-fade; phone-sized inputs render 16px; story `em` reads semibold; intro CTA is a pill matching other primaries.
- Done when: build passes; all eight target states present; reduced-motion block untouched and still covering these elements.
