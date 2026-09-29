# 026: Lift milestone labels onto the scale
- Findings: TYP-7, MOT-13, TYP-2
- Severity: LOW
- Wave: 2
- Owned files: client/surfaces/progress/Milestones.tsx

## Problem
- TYP-7 (same edit as this file's TYP-2 instance): milestone labels render `font-mono text-[8.5px] tracking-[0.05em] uppercase` (:49) with `compact && "text-[9.5px]"` (:50), below the 10px `--text-xs` floor.
- MOT-13 (Milestones half): `ease-[cubic-bezier(.23,1,.32,1)]` (:63). (Module is plan 001.)

## Target
- Labels use `text-xs` (10px) at the same tracking; compact variant also `text-xs` (delete the 9.5px branch; if compact needs distinction, keep it identical and note why). Confirm the six-node rail still fits its panel at 320px.
- Easing uses the shared CSS value: `ease-[var(--motion-ease-out)]` if that utility resolves in this Tailwind setup, else import `EASE_SIGNAL_OUT_CSS` from `../../shared/motion.ts` and interpolate. Verify the built CSS contains the curve.

## Repo conventions
- Scale floor: `--text-xs: 10px` (generated theme.css).
- Motion module: `client/shared/motion.ts` (plan 001).

## Steps
1. Raise both label sizes to `text-xs`.
2. Swap the hand-typed curve for the shared value.
3. Verify 320px fit and built-CSS curve.

## Boundaries
- Edit only the owned files.
- Add no dependencies. If `client/shared/motion.ts` is missing, stop and report.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`, `npm run build`
- Look: milestone strip legible; six nodes fit at 320px; segment easing unchanged.
- Done when: typecheck + build pass; TYP-7, MOT-13, and this file's TYP-2 instance all fixed (plan 033 explicitly excludes this file).
