# 013: Unify ReviewApp feedback vocabulary
- Findings: COPY-6, COPY-7, COPY-23, COPY-25
- Severity: LOW
- Wave: 2
- Owned files: client/surfaces/review/ReviewApp.tsx

## Problem
- COPY-6 (ReviewApp half): Review tab accessible name counts "queued comments" (:136) while the badge reads "Unresolved notes" (:488). (Stories halves are plans 022, 023.)
- COPY-7 (ReviewApp half): drift copy uses "side files" (:144, :215 area). (State/StoryView halves are plans 011 and 024.)
- COPY-23: palette row "Toggle read aloud" carries detail "Pause or resume narration" (:264).
- COPY-25: "Toggle current file reviewed" carries detail "Bind completion to this exact file diff." (:258).

## Target
- Badge reads "Unresolved comments" (standardize queued feedback on "comments", the majority + API term). Tab name keeps "queued comments".
- "side files" phrasing becomes "files outside the story" in both spots (match surrounding grammar).
- Read-aloud detail reads "Pause or resume read aloud".
- Viewed detail reads "Mark this file reviewed for this exact diff."

## Repo conventions
- One voice, one noun per object; sentence case (DESIGN_MEMORY.md).

## Steps
1. Rename the badge to "Unresolved comments".
2. Rewrite the two "side files" strings.
3. Rewrite the two palette details.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`
- Look: badge, drift lines, and palette rows read with one vocabulary.
- Done when: typecheck passes; all four strings exact; no "notes"/"side files"/"narration"/"Bind completion" remains in this file.
