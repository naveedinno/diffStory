# 022: Unify StoriesApp vocabulary and removal exit
- Findings: COPY-6, MOT-14
- Severity: LOW
- Wave: 2
- Owned files: client/surfaces/stories/StoriesApp.tsx

## Problem
- COPY-6 (StoriesApp half): header counts "open notes" (:164) while rows count "queued comments". (ReviewApp/StoryRow halves are plans 013 and 023.)
- MOT-14: `setStories((rows) => rows.filter((row) => row.id !== story.id))` (:75) drops the row instantly; siblings jump. Marked additive/optional by the lens.
- NOTE: TYP-4 for this file moved to plan 033. Do NOT touch sizes or wrapping here.

## Target
- Header reads "open comments" (keep the singular/plural branch).
- Removal exit: wrap the list in `AnimatePresence` with `initial={false}` and give removed rows an exit of opacity plus a small fixed move (~-12px), or add a layout animation so siblings glide. `motion/react` is already a dependency; check how other surfaces import it. If neither lands cleanly without restructuring, keep the instant removal and report MOT-14 as Not fixed with the reason (it is explicitly additive).

## Repo conventions
- Motion import exemplar: `client/surfaces/change/ScopeCard.tsx` (motion/react usage).

## Steps
1. Rename "open notes" to "open comments".
2. Add the removal exit or layout animation; else report Not fixed with reason.

## Boundaries
- Edit only the owned files. Do NOT touch sizes or wrapping (plan 033).
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`
- Look: header says open comments; deleting a row fades/slides instead of teleporting.
- Done when: typecheck passes; COPY-6 fixed; MOT-14 fixed or honestly reported Not fixed.
