# 017: Make RefPicker honest, calm, and shared
- Findings: EXP-5, MOT-1, MOT-10, MOT-13, TYP-3, COPY-8
- Severity: MEDIUM
- Wave: 2
- Owned files: client/surfaces/change/RefPicker.tsx, client/surfaces/change/refs.ts

## Problem
- EXP-5: `loadRefs` catches failure with `inflightRefs = null; return null;` (RefPicker.tsx:73) and `optionsFor` returns `[option("", "Loading refs…", "reading local git refs", "")]` for null data (refs.ts:102), so a failed load shows "Loading refs…" forever.
- MOT-1: listbox exit uses `: { duration: 0.18, ease: [0.68, 0, 0.77, 0] }` (RefPicker.tsx:392), an ease-in shape, against entrance `{ duration: 0.24, ease: EASE_SIGNAL_OUT }`.
- MOT-10: shown/concealed states animate Motion `y`/`scale` shorthands plus filter blur and clipPath while refs fetch (RefPicker.tsx:358). Low confidence, unverified.
- MOT-13 (RefPicker half): `const EASE_SIGNAL_OUT = [0.23, 1, 0.32, 1] as const;` (:53). (Module is plan 001.)
- TYP-3 (RefPicker half): rows truncate label (:429) and meta (:430) with no fallback.
- COPY-8 (RefPicker/refs half): "Available git references" (:381), "reading local git refs" (refs.ts:102). Fix all user-facing "git" in both owned files.

## Target
- `useRefPicker` tracks load failure; `RefListbox` renders an error row plus a Retry row rerunning `loadRefs`. First attempt stays silent; failed loads never present as ongoing.
- Exit mirrors the entrance: `{ duration: 0.16, ease: EASE_SIGNAL_OUT }` (imported from `../../shared/motion.ts`; delete the local const).
- Animate one transform string for the move; keep clip-path OR blur, not both (keep clip-path, drop the blur unless the reveal visibly needs it).
- Truncated label and meta each wrapped in the existing beUI Tooltip with the full string (ScopeCard `TOOLTIP_SURFACE` pattern).
- "Git" capitalized in user-facing strings in both files.

## Repo conventions
- Error-row exemplar: report EXP-5 fix shape (error + Retry rows in RefListbox).
- Tooltip exemplar: ScopeCard `TOOLTIP_SURFACE` usage. Motion module: `client/shared/motion.ts` (plan 001).

## Steps
1. Add failure state + error/Retry rows.
2. Import `EASE_SIGNAL_OUT`, delete the local const, mirror the exit.
3. Simplify the shown/concealed animation to one transform string + clip-path.
4. Tooltip-wrap label and meta.
5. Capitalize "Git" in both files.

## Boundaries
- Edit only the owned files.
- Add no dependencies. If `client/shared/motion.ts` is missing, stop and report.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`
- Look: block /api/refs and confirm error + working Retry; listbox exits briskly; long ref names show full text on hover.
- Done when: typecheck passes; all five target states present.
