# 023: Fix StoryRow motion, plurals, and delete weight
- Findings: MOT-6, COPY-5, COPY-6, COPY-10, VIS-2
- Severity: MEDIUM
- Wave: 2
- Owned files: client/surfaces/stories/StoryRow.tsx

## Problem
- MOT-6: glance detail uses `transition-[max-width,opacity,transform] duration-[var(--motion-duration-ui)]` with `group-hover:max-w-[150px]` (:239) plus a `-translate-y-px` lift over 200ms (:228) on frequent hover.
- COPY-5 (StoryRow half): resume pill/tooltip pairs "Resume review" with "Remove story" (:235, :274). (Dialog/generator halves are plans 010 and 024.)
- COPY-6 (StoryRow half): rows count "queued comments" (:194-195); consistent already, verify only. (Header/badge halves are plans 013 and 022.)
- COPY-10: facts render `{n} files` (:180), `{n} code stops` (:189), glance `{n} files, {n} stops` (:247) with no singular branch ("1 files").
- VIS-2 (stories half): delete is a 34px transparent ghost circle `bg-transparent` (:294). This file is the EXEMPLAR (keep as-is); the picker side converges here in its own file (plan 020 covers RecentRepos geometry? No: VIS-2 fix edits RecentRepos.tsx:247 only, which is plan 020). No VIS-2 edit in this file; verify only.

## Target
- Detail reveal uses opacity/transform at fixed width (no max-width animation); hover motion 150ms or less. Lift kept iff within budget.
- Tooltip reads "Remove review" to match "Resume review" (one noun per object within the row; dialog title becomes "Remove this story?" in plan 024 to match its own button).
- Facts route through the surface `plural()` helper (singular "1 file", "1 code stop", glance "1 file, 1 stop").
- Ghost delete untouched.

## Repo conventions
- Plural exemplar: the primers fact in this file already uses `plural()`.
- Hover-motion budget: 100 to 150ms opacity/color on frequent hover.

## Steps
1. Replace the max-width reveal with fixed-width opacity/transform at <=150ms.
2. Retitle the tooltip to "Remove review".
3. Pluralize the three facts via `plural()`.
4. Verify ghost delete and "queued comments" unchanged.

## Boundaries
- Edit only the owned files. Do NOT touch text sizes (plan 033) or the ghost delete.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`
- Look: hover reveals crisply; single-file rows read "1 file"; tooltip says Remove review.
- Done when: typecheck passes; all target states present.
