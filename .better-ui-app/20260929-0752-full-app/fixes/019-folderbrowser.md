# 019: Give FolderBrowser retry, continuity, and readable fallbacks
- Findings: EXP-4, EXP-10, TYP-1, TYP-3, COPY-8
- Severity: MEDIUM
- Wave: 2
- Owned files: client/surfaces/picker/FolderBrowser.tsx

## Problem
- EXP-4: folder-read error renders only `<div className="p-[26px] text-center text-[13px] text-text-3">{READ_ERROR}</div>` (:401) with no retry.
- EXP-10: `browse()` calls `setView({ kind: "loading" })` (:136) before every fetch, flashing a full spinner on each descent.
- TYP-1 (FolderBrowser half): filter input renders `pl-[35px] text-[13px] leading-[34px]` (:381). NOTE: project `text-base` is 13px; the 16px mobile target is `text-lg`.
- TYP-3 (FolderBrowser half): entry names (:427) and current-path footer (:441) truncate with no fallback.
- COPY-8 (FolderBrowser half): "Not a git repo" (:462). Fix all user-facing "git" in this file.

## Target
- Error branch keeps `READ_ERROR` and adds a ghost "Try again" button rerunning `browse()` with the last requested path (kept in a ref).
- Refetch keeps the previous listing mounted at reduced opacity with a small loading row; the full loading view shows on first open only. Focus-return behavior after descent unchanged.
- Filter input: `text-lg sm:text-[13px]` (leading/spacing unchanged).
- Truncated entry names and current path each get the full string via the beUI Tooltip (interactive rows) or plain `title` (footer).
- "Git" capitalized in user-facing strings.

## Repo conventions
- Ghost-button exemplar: existing ghost button idiom in picker surfaces.
- Refetch exemplar: EXP rule 7 (previous content at reduced opacity, pointer events on).

## Steps
1. Add the last-path ref and Try-again button to the error branch.
2. Implement keep-previous-listing refetch.
3. Apply `text-lg sm:text-[13px]` to the filter input.
4. Add Tooltip/title fallbacks to truncated names and path.
5. Capitalize "Git" file-wide (user-facing strings only).

## Boundaries
- Edit only the owned files. Do NOT touch text sizes other than :381 (plan 033 owns the scale sweep).
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`
- Look: fail a folder read and retry; descend levels with no full-listing flash; phone-width filter renders 16px; long names reveal full text.
- Done when: typecheck passes; all five target states present.
