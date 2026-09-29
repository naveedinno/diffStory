# 027: Unify progress failure punctuation
- Findings: TYP-9
- Severity: LOW
- Wave: 2
- Owned files: client/surfaces/progress/run-progress.ts, client/surfaces/progress/state.ts

## Problem
- TYP-9: the same failure reads "Could not start." (run-progress.ts:44) vs "Could not start" (state.ts:438).

## Target
- Both read "Could not start." (add the period in state.ts:438).

## Repo conventions
- One punctuation shape for one message.

## Steps
1. Add the terminal period in state.ts:438.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`
- Done when: typecheck passes; both strings identical.
