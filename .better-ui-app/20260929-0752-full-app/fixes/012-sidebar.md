# 012: Fix sidebar semantics and repair copy
- Findings: A11Y-6, A11Y-9, A11Y-10, COPY-15
- Severity: MEDIUM
- Wave: 2 (runs after plan 008; plan 008 owns the A11Y-6 engine half and the two flag spans)
- Owned files: client/surfaces/review/Sidebar.tsx

## Problem
- A11Y-6 (Sidebar remainder): none, unless plan 008 stopped early. FIRST confirm `syncViewed()` in the engine composes ", reviewed" / ", N unexplained changes" into file-button names and the two `▲` spans (Sidebar.tsx:338, :383) carry `aria-hidden="true"`. If plan 008 did not land, STOP and report (hiding glyphs without composed names would lose information).
- A11Y-9 (Sidebar half): `aria-label` on the role-less rail-beats container (Sidebar.tsx:97).
- A11Y-10: rail scrim is `<button className="ds-rail-scrim" ... aria-label="Close review navigation" aria-hidden="true" tabIndex={-1} />` (:610).
- COPY-15 (Sidebar half): repair row detail "Give each decision its own local camera." (:53). (Server mirror is plan 030.)

## Target
- A11Y-6: no edit here if plan 008 landed (verify only).
- Rail-beats container: delete the `aria-label` (content speaks for itself).
- Scrim: replace the `button` with a non-focusable `div` (drop aria-label/aria-hidden/tabIndex/type), since the sidebar toggle and Escape already close the rail.
- Detail reads "Give each decision its own stop."

## Repo conventions
- Native elements first; no ARIA better than wrong ARIA.
- Sentence case; plain reviewer vocabulary (DESIGN_MEMORY.md, COPY lens).

## Steps
1. Verify the A11Y-6 engine half landed; stop and report if not.
2. Delete the rail-beats `aria-label`.
3. Convert the scrim button to a div.
4. Rewrite the repair detail.

## Boundaries
- Edit only the owned files. Do NOT touch the two `▲` flag spans (plan 008 owns them).
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`, `npm run typecheck:client`
- Look: rail opens/closes via toggle and Escape; scrim is inert; repair menu reads correctly.
- Done when: build + typecheck pass; all target states present.
