# 030: Align server-rendered mirrors
- Findings: COPY-9, COPY-13, COPY-15
- Severity: LOW
- Wave: 2
- Owned files: src/render.ts

## Problem
- COPY-9 (server half): "...clears the acknowledgement." (:1021). (React half is plan 014.)
- COPY-13 (server half): the storyless plural variant of "Excluded files remain a separate reviewer responsibility" (:1010). (React half is plan 014.)
- COPY-15 (server half): "Give each decision its own local camera." (:370). (Sidebar half is plan 012.)

## Target
- "...clears the acknowledgment."
- "You still need to inspect excluded files before deciding." (adapt number agreement for the storyless variant if it differs).
- "Give each decision its own stop."

## Repo conventions
- Mirrors must match plans 012 and 014 exactly; read those files first if edited, else match this plan's strings.

## Steps
1. Apply the three string fixes.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`
- Done when: build passes; all three strings exact and consistent with the React mirrors.
