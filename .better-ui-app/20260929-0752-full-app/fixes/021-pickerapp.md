# 021: Add retry to picker toasts
- Findings: COPY-3
- Severity: MEDIUM
- Wave: 2
- Owned files: client/surfaces/picker/PickerApp.tsx

## Problem
- COPY-3: open failure (`fallback: "Could not open that path."`, `networkFallback: "Could not reach the server."`, :131) and remove failure (`fallback: "Could not remove repository."`, :150) surface through `setStatus` with dismiss only, while the sibling restore failure (:189) pairs `Could not restore {name}. Try again.` with a `Try again` action (`actionLabel: "Try again"`, :191).
- NOTE: TYP-4 for this file moved to plan 033. Do NOT touch sizes or wrapping here.

## Target
- Both failure paths set status with a "Try again" action re-running the same request (`openRepo(path)` / `removeRepo(path)`), matching the restore `undo.actionLabel` pattern exactly.

## Repo conventions
- Retry exemplar: the restore failure block at PickerApp.tsx:189-191.

## Steps
1. Add the Try-again action to the open-failure catch.
2. Add the Try-again action to the remove-failure path.

## Boundaries
- Edit only the owned files. Do NOT touch sizes or wrapping (plan 033).
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`
- Look: fail an open and a remove; each toast offers a working Try again.
- Done when: typecheck passes; both toasts carry the retry action.
