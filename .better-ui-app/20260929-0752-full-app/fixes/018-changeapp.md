# 018: Fix ChangeApp notice, contrast, and spelling
- Findings: COPY-1, COPY-8, COL-5
- Severity: MEDIUM
- Wave: 2
- Owned files: client/surfaces/change/ChangeApp.tsx

## Problem
- COPY-1: recovery notice reads "That review couldn't be loaded. {notice} Open the diff viewer below, then generate a fresh story from the Story tab." (:178-180) but the control below is labeled "Review N files"; nothing is called a diff viewer.
- COPY-8 (ChangeApp half): "Set the exact git scope" (:160). Fix all user-facing "git" in this file.
- COL-5 (ChangeApp half): dim text (`text-text-3` kicker :75, `text-text-2` lede :159 and meta :168) has no increased-contrast lift; only `contrast-more:border-text` border swaps exist. (review.css half is plan 004.)
- NOTE: TYP-4 (text-balance/pretty) for this file moved to plan 033. Do NOT add balance/pretty here. NOTE: plan 028 (EXP-2) also owns this file and runs after this plan; it adds a separate scopeNotice box. Keep edits to the lines below.

## Target
- Notice reads "That review couldn't be loaded. {notice} Start the review below, then generate a fresh story from the Story tab." (exact: replace "Open the diff viewer below" with "Start the review below").
- "Git" capitalized in user-facing strings.
- The three dim-text elements gain `contrast-more:text-text` (kicker keeps its mono/uppercase treatment).

## Repo conventions
- Labels match controls; sentence case; contrast utilities already in use in this file (`contrast-more:border-text`).

## Steps
1. Replace "Open the diff viewer below" with "Start the review below".
2. Capitalize "Git" file-wide (user-facing strings only).
3. Add `contrast-more:text-text` to the kicker, lede, and meta class strings.

## Boundaries
- Edit only the owned files. Do NOT add text-balance/pretty (plan 033). Do NOT touch sizes (plan 033).
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`
- Look: notice names the real control; forced-contrast mode lifts dim text.
- Done when: typecheck passes; all three target states present.
