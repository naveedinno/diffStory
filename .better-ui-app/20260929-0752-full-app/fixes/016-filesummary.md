# 016: Calm FileSummary actions and accordion
- Findings: MOT-2, A11Y-15, COPY-22
- Severity: MEDIUM
- Wave: 2
- Owned files: client/surfaces/change/FileSummary.tsx

## Problem
- MOT-2 (FileSummary half): generated-output disclosure renders `<BouncyAccordion` (:207) with bounce 0.26 to 0.38 over ~0.5s on a frequent control. (RecentRepos half is plan 020.)
- A11Y-15: `ButtonLink` shows visible "Review {reviewCount}" (:197) with `aria-label={`Start review of ${reviewCount}`}` (:189); the name does not contain the visible label verbatim (WCAG 2.5.3).
- COPY-22: clean-tree empty state offers "Re-check" (:126) while the same screen's nav offers "Reload" (ScopeCard:746); both run `window.location.reload()`.

## Target
- Generated-output disclosure uses a non-overshooting treatment: a native `<details>`/`<summary>` styled in the surface idiom, or a height tween on the drawer token like ScopeCard `panelMotion`. Same title row content ("Generated output" + counts), same border-t separator, keyboard and screen-reader operable, reduced-motion safe.
- `aria-label={`Review ${reviewCount}`}` matching the visible label exactly.
- Empty-state button labeled "Reload".

## Repo conventions
- Disclosure exemplar: ScopeCard `panelMotion` drawer-token tween, or native details (prefer native if styling stays clean).
- Button-label rule: accessible name contains the visible label.

## Steps
1. Replace the BouncyAccordion with the calm disclosure (keep content and separators).
2. Align the ButtonLink accessible name with its visible label.
3. Rename "Re-check" to "Reload".

## Boundaries
- Edit only the owned files.
- Add no dependencies. Do not touch the vendored BouncyAccordion itself.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`
- Look: generated section expands crisply with no bounce; voice-control name matches the visible label; empty state offers Reload.
- Done when: typecheck passes; all three target states present.
