# 005: Unclip review chrome at narrow widths
- Findings: LAY-1, LAY-2, LAY-4
- Severity: HIGH
- Wave: 2 (review.css chain, runs after plan 004)
- Owned files: client/surfaces/review/review.css

## Problem
- LAY-1: `.ds-filepanel-head{...display:flex;align-items:center;gap:10px;padding:10px 16px;...}` (:616) never wraps; wrap/order rules exist only inside `@media (max-width:720px)` (:1058). At 768px viewport with the 240px rail open the panel is ~490px and the Unified pill clips with Split/Full file unreachable (screens/diff-tablet-dark.png). `.ds-filedetail` already sets `container-type:inline-size` (:613).
- LAY-2: below 470px the chrome bar holds ~418px of flex-none children in 375px (mobile nav 88px, tabs ~226px, theme 44px, Reload 44px plus gaps); `.ds-reviewchrome-utilities{display:flex;align-items:center;gap:10px;flex:none;...}` (:1363) has no overflow handling, so Reload clips (screens/diff-mobile-dark.png).
- LAY-4 (CSS half): `.ds-toast{position:fixed;left:50%;bottom:26px;...}` (:730) ignores safe-area insets. (ProgressPanel half is plan 025.)

## Target
- File panel head wraps by container width: add `@container (max-width:560px)` on `.ds-filedetail` carrying the same flex-wrap/order declarations now in the 720px block (adapted: wrap, gap 7px, padding 10px 12px, cardpath order 1 flex `1 1 110px`, badge order 2, untoured order 3, stepchip order 4, controls flow after). Keep the 720px viewport block untouched (it covers the rail-collapsed phone case).
- At the 470px breakpoint, `.ds-reviewchrome-utilities` scrolls: `overflow-x:auto;scrollbar-width:none` (plus `::-webkit-scrollbar{display:none}`), so trailing actions stay reachable. No other 470px rule changes.
- Toast: `bottom:calc(26px + env(safe-area-inset-bottom))`.

## Repo conventions
- Container-query exemplar: the step toolbar `@container (max-width:420px)` at review.css:521.
- Safe-area exemplar: picker undo toast `bottom-[calc(16px+env(safe-area-inset-bottom))]` at PickerApp.tsx:62.

## Steps
1. Add the `@container` wrap rule for `.ds-filepanel-head` after the `.ds-filedetail` rule.
2. Extend the `@media (max-width:470px)` block with the utilities scroll declarations.
3. Change the toast `bottom` to the safe-area calc.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`
- Look: 768px All-files with rail open shows Split/Full file reachable (wrapped rows); 375px storyless chrome reaches Reload via horizontal scroll with no visible scrollbar; toast clears the home indicator.
- Done when: build passes; all three target states present; no horizontal page scroll at 320/375/768px.
