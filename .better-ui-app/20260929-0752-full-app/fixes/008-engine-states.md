# 008: Honest engine states (search, coverage, position, badges)
- Findings: EXP-6, EXP-7, EXP-9, A11Y-6
- Severity: MEDIUM
- Wave: 2 (engine chain, runs after plan 007)
- Owned files: client/surfaces/review/engine/review-engine.js, client/surfaces/review/Sidebar.tsx

## Problem
- EXP-6: file-search catch (:3100) runs `fileSearchMatches={};applyFileFilters();`, so a failed `/api/review/file-search` request reports "No matching files" instead of a failure.
- EXP-7: trust catch (:2891) writes only the message ("Could not calculate coverage.") with a Reload button solely for the lease-conflict case; transient failures offer no inline action though re-entering the Review tab refetches.
- EXP-9: `currentReviewPosition` (:2042) persists `{view,step,file,scroll,reviewTab}` to localStorage; `setView` writes no URL state (no `history.*` calls in the file), so views/files/steps cannot be linked and filters reset.
- A11Y-6 (engine half): `syncViewed()` (:2694) toggles classes/`data-reviewed` only; the reviewed `✓` is `aria-hidden` and the unexplained `▲` is title-only, so screen readers get neither state. (Sidebar glyph half: the two `▲` flag spans at Sidebar.tsx:338 and :383 need `aria-hidden="true"` once names carry the state. Plan 012 also owns Sidebar.tsx and runs after this plan.)

## Target
- Search failure keeps previous `fileSearchMatches` and renders one inline note near the file-search field that content search is unavailable and only name matches show; clears on the next successful response. Existing debounced retry on keystroke stays.
- Trust transient failures render a Retry button calling `loadTrustEvidence` via the existing `reviewLazyAction` helper, matching step/file/drift error blocks.
- `setView` and file/step selection mirror `{view,file,step}` into the query string with `history.replaceState` (never pushState); load reads the query first, localStorage resume stays the fallback. Filter/search query inclusion is out of scope.
- `syncViewed()` composes each file button's accessible name like `reviewTabLabel()` does: base name plus ", reviewed" and/or ", N unexplained changes"; both glyph spans `aria-hidden="true"` (add it to the two `▲` spans in Sidebar.tsx).

## Repo conventions
- Error-block exemplar: step panel / file panel / drift preview errors using `reviewLazyAction`.
- Name-composition exemplar: `reviewTabLabel()` for the Review tab.

## Steps
1. Change the search catch to keep matches and show/clear the inline note.
2. Route trust failures through `reviewLazyAction` with Retry.
3. Add `history.replaceState` mirroring on view/file/step change plus query-first load.
4. Extend `syncViewed()` name composition; add `aria-hidden="true"` to the two Sidebar flag spans.

## Boundaries
- Edit only the owned files. In Sidebar.tsx touch ONLY the two flag spans (plan 012 owns the rest and runs after).
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`
- Look: block file-search (offline) and confirm the note plus kept matches; fail coverage and confirm Retry; change view/file/step and confirm the URL mirrors it; screen-reader/file-button names include reviewed/unexplained state.
- Done when: build passes; all four target states present; Back-button behavior unchanged (replace only).
