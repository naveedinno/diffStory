# 034: Convert directional CSS to logical properties
- Findings: LAY-3
- Severity: LOW
- Wave: 2 (runs LAST, after every other plan; touches files across all surfaces)
- Owned files: all files under client/surfaces, client/shared, client/entry (excluding client/vendor), plus client/styles.css

## Problem
- LAY-3: dozens of physical direction declarations that will not mirror under `dir="rtl"`: `margin-left/right`, `padding-left/right`, `border-left/right`, `text-align:left/right`, `left:`/`right:` offsets, and Tailwind `ml/mr/pl/pr/left/right/text-left/border-l/border-r/rounded-l/rounded-r` (also `space-x-` if found, `border-x` splits, `rounded-l/r` pairs). Enumerate at run time with:
  - `grep -rno "margin-left\|margin-right\|padding-left\|padding-right\|border-left\|border-right" client/surfaces/review/review.css client/shared/shared.css client/styles.css`
  - `grep -rno "text-align: *left\|text-align: *right" <same css files>`
  - `grep -rno "[^-]left: *[^0 ;}][^;}]*\|[^-]right: *[^0 ;}][^;}]*" <same css files>` (offsets; inspect each)
  - `grep -rno "\bml-\|\bmr-\|\bpl-\|\bpr-\|\bleft-\|\bright-\|\btext-left\|\btext-right\|\bborder-l\|\bborder-r\|\brounded-l\|\brounded-r\|\bspace-x-" client/surfaces client/shared client/entry --include='*.tsx'`

## Target
Mapping (Tailwind v4 logical utilities exist: ms/me/ps/pe/start/end/text-start/border-s/border-e/rounded-s/rounded-e/space-x handles RTL via --tw-space-x-reverse already, verify):
- CSS: `margin-left`->`margin-inline-start`, `margin-right`->`margin-inline-end`, same for padding/border/text-align/inset (`left:`->`inset-inline-start:`, `right:`->`inset-inline-end:`).
- Tailwind: `ml-`->`ms-`, `mr-`->`me-`, `pl-`->`ps-`, `pr-`->`pe-`, `left-`->`start-`, `right-`->`end-`, `text-left`->`text-start`, `text-right`->`text-end`, `border-l`->`border-s`, `border-r`->`border-e`, `rounded-l`->`rounded-s`, `rounded-r`->`rounded-e` (keep responsive/state prefixes attached).
- EXCLUSIONS (keep physical, list each in the reply): toast `left:50%` centering + `translateX(-50%)` (review.css:730 area); rail resizer edge (review.css:224 area); any `left/right` that is device/notch geometry rather than reading order; `space-x-` IF it already carries the RTL reverse variable; icon-glyph optical offsets (e.g. play-triangle `margin-left:2px`); `text-align` on code/diff content that must stay put. When unsure whether geometry is physical or directional, keep physical and report it.

## Repo conventions
- Styling idiom unchanged (plain CSS in review.css/shared.css, Tailwind utilities in TSX); this plan only swaps direction-dependent tokens.

## Steps
1. Run the four enumeration greps; build the full conversion list.
2. Convert every non-excluded match per the mapping.
3. Grep-verify zero non-excluded physical matches remain.

## Boundaries
- Edit only the owned files. Touch ONLY direction-dependent declarations; no sizes, colors, copy, or behavior changes.
- Tolerance: earlier plans changed many of these files; match by declaration/utility substring plus context. Do not "fix" anything else you see.
- Add no dependencies.

## Verification
- Commands: `npm run typecheck:client`, `npm run build`
- Look: render LTR before/after (must be pixel-near-identical); spot-check one screen with `dir="rtl"` forced in devtools for gross breakage (full RTL QA is out of scope; English-only is the stated convention).
- Done when: typecheck + build pass; verification greps return only documented exclusions; LTR rendering unchanged.
