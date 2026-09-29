# 015: Stop ScopeCard navigating while typing
- Findings: EXP-3, TYP-1, TYP-6, A11Y-9, COPY-8, COPY-22, MOT-13
- Severity: MEDIUM
- Wave: 2
- Owned files: client/surfaces/change/ScopeCard.tsx

## Problem
- EXP-3: ref-field `onChange` calls `commit(next, 700)` (:412) and `scheduleNavTo` assigns `window.location.href` after the delay (:307), so a 700ms pause mid word navigates to a partial ref and destroys the typed text. The `wire()` helper already distinguishes row choice, Enter, and blur commit.
- TYP-1 (ScopeCard half): ref fields render `font-mono text-[13.5px]` (:169-170), triggering iOS zoom on mobile. NOTE: in this project the `text-base` utility is 13px (theme override), and `text-lg` is 16px; the size-up target is `text-lg` on mobile, NOT `text-base`.
- TYP-6 (TSX half): "Regenerate"-style link uses `underline-offset-2 hover:underline` (:611) without from-font tuning.
- A11Y-9 (ScopeCard half): `aria-label` on role-less summary slots (:663, :670, :679).
- COPY-8 (ScopeCard half): "Set the exact git scope" (:160) uses lowercase "git". (Other halves are plans 017, 019, 030/029, 014-area. This plan fixes ONLY this file's occurrences; grep the file for all "git" and fix each.)
- COPY-22 (reference): the empty-state "Re-check" vs nav "Reload" fix lands in FileSummary (plan 016); ScopeCard:746 is the nav exemplar ("Reload") and needs NO edit. Included here only so the fixer does not "fix" the nav label.
- MOT-13 (ScopeCard half): hand-typed Signal curve at :121. (Module is plan 001; other adoption sites are plans 017, 025, 026.)

## Target
- No navigation from `onChange`: navigate on row choice, Enter, and blur commit only; auto-navigate solely a typed value matching a ref from the cached `/api/refs` list.
- Ref fields: `text-lg sm:text-[13.5px]` (16px mobile, designed size desktop). DO NOT let plan 033 change this: 033 is instructed to leave these lines' mobile size intact (its special case reduces the desktop half to `sm:text-base`, which keeps 16px mobile; either end state is acceptable, but 16px mobile is REQUIRED).
- Link: add `decoration-from-font` (keep `underline-offset-2`).
- Summary slots: delete the `aria-label`s where content speaks for itself, or add `role="group"` where the label adds context (read each of the three and choose per case).
- "Git" capitalized in every user-facing string in this file.
- Import the curve from `../../shared/motion.ts` (`EASE_SIGNAL_OUT`) instead of the literal.

## Repo conventions
- Checks: `npm run typecheck:client`. Motion module: `client/shared/motion.ts` (plan 001, wave 1, runs before this plan).

## Steps
1. Remove navigation from `onChange`; keep row/Enter/blur navigation plus cached-ref auto-nav.
2. Apply `text-lg sm:text-[13.5px]` to the ref-field classes.
3. Add `decoration-from-font` to the link.
4. Resolve the three summary-slot labels (role or delete).
5. Capitalize "Git" file-wide (user-facing strings only, not code identifiers).
6. Swap the curve literal for the shared import.

## Boundaries
- Edit only the owned files. Do NOT rename the nav "Reload" at :746.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising. If `client/shared/motion.ts` does not exist (plan 001 failed), stop and report.

## Verification
- Commands: `npm run typecheck:client`
- Look: pausing mid word in a ref field navigates nowhere; Enter/row/blur still navigate; phone-width fields render 16px.
- Done when: typecheck passes; all six target states present.
