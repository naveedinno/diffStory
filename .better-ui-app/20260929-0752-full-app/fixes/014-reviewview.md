# 014: Align ReviewView acknowledgment, coverage, and history link
- Findings: COPY-9, COPY-13, COPY-19
- Severity: LOW
- Wave: 2
- Owned files: client/surfaces/review/ReviewView.tsx

## Problem
- COPY-9 (React half): "Bound to this exact diff; a code change clears the acknowledgement." (:315, UK spelling in a US-spelled product). (Server mirror is plan 030.)
- COPY-13 (React half): coverage foot reads "Excluded files remain a separate reviewer responsibility." (:266) beside "which version you intend to commit" (:250). (Server mirror is plan 030.)
- COPY-19: actions panel links "Saved reviews" with desc "Open older review sessions for this repository." (:553-554) to the page headed "Review history".

## Target
- "acknowledgment" (US) in this file.
- Foot reads "You still need to inspect excluded files before deciding." (keep the staged "you" perspective; check whether a storyless plural variant exists in this file and apply the same voice).
- Action titled "Review history" with desc "Open an earlier saved review for this repository."

## Repo conventions
- Sentence case; reader addressed as "you"; links carry their destination's name.

## Steps
1. Fix the spelling.
2. Rewrite the coverage foot (all variants in this file).
3. Retitle the history action and desc.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`
- Look: exclusion ack, coverage foot, and history action read correctly.
- Done when: typecheck passes; all three strings exact.
