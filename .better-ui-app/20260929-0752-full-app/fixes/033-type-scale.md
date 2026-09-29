# 033: Return utility surfaces to the type scale
- Findings: TYP-2, TYP-4
- Severity: MEDIUM
- Wave: 2 (runs after plans 015, 016, 017, 018, 019, 020, 021, 022, 023, 024, 025; owns no file another pending plan owns)
- Owned files: client/surfaces/change/ChangeApp.tsx, client/surfaces/change/RefPicker.tsx, client/surfaces/change/ScopeCard.tsx, client/surfaces/change/FileSummary.tsx, client/surfaces/progress/PlanList.tsx, client/surfaces/progress/ProgressPanel.tsx, client/surfaces/picker/Hero.tsx, client/surfaces/picker/FolderBrowser.tsx, client/surfaces/picker/PickerApp.tsx, client/surfaces/picker/RecentRepos.tsx, client/surfaces/picker/SkillBanner.tsx, client/surfaces/stories/StoryRow.tsx, client/surfaces/stories/RemoveStoryDialog.tsx, client/surfaces/stories/StoriesApp.tsx, client/surfaces/stories/EmptyHistory.tsx

## Problem
- TYP-2: one-off sizes beside the scale (`--text-xs:10px --text-sm:11px --text-md:12.5px --text-base:13px --text-lg:16px --text-xl:20px --text-2xl:26px`, theme.css:55): `text-[8.5px]`, `text-[9.5px]`, `text-[10.5px]`, `text-[11.5px]` (19x), `text-[13.5px]` (8x), `text-[15px]`, `text-[15.5px]`, `text-[19px]`, `text-[21px]`, `text-[22px]`, `text-[24px]`, `text-[28px]` across the owned files (full grep list was enumerated at plan time; re-run it: `grep -rn "text-\[\(8\.5\|9\.5\|10\.5\|11\.5\|13\.5\|15\|15\.5\|19\|21\|22\|24\|28\)px\]" client/surfaces --include='*.tsx'`).
- TYP-4: utility headings/descriptions lack `text-balance`/`text-pretty`: ChangeApp:156/159, StoriesApp:125/146, PickerApp:206, EmptyHistory:21/22, FileSummary:112/114.

## Target
Nearest-step mapping (substring swaps; NOT full-class rewrites):
- `text-[8.5px]` and `text-[9.5px]` -> `text-xs` (Milestones.tsx is EXCLUDED, fixed by plan 026; do not touch it)
- `text-[10.5px]` -> `text-xs`
- `text-[11.5px]` -> `text-sm`
- `text-[13.5px]` -> `text-base`
- `text-[15px]` and `text-[15.5px]` -> `text-lg`
- `text-[19px]`, `text-[21px]`, `text-[22px]` -> `text-xl`
- `text-[24px]`, `text-[28px]` -> `text-2xl`
- EXCLUDE `text-[0px]` / `max-[600px]:text-[0px]` (ChangeApp:97, a hiding technique, not type).
- SPECIAL CASE ScopeCard ref fields (plan 015 wrote `text-lg sm:text-[13.5px]` there for TYP-1): end state `text-lg sm:text-base`. The `text-lg` (16px mobile) half is REQUIRED and must survive.
- TYP-4: add `text-balance` to the page/section headings and `text-pretty` to their descriptions at the listed locations (plus the FileSummary:114 description). review.css already sets this pattern (`.ds-intro-title` balance, ledes pretty).

## Repo conventions
- Scale tokens in theme.css:55 / src/theme.ts; Tailwind v4 `text-<name>` utilities resolve from `--text-<name>` (so `text-base` = 13px, `text-lg` = 16px in this project).

## Steps
1. Re-run the enumeration grep; convert every match per the mapping (substring swaps only, preserving responsive prefixes and all other utilities).
2. Apply the ScopeCard special case exactly.
3. Add balance/pretty at the TYP-4 locations.

## Boundaries
- Edit only the owned files. Touch ONLY size substrings (plus balance/pretty additions); do not reword classes otherwise.
- Tolerance: earlier plans may have added utilities (e.g. `contrast-more:text-text`) inside the same class strings; match by the size-token substring plus surrounding context and proceed. Any other difference: stop and report.
- Add no dependencies.

## Verification
- Commands: `npm run typecheck:client`, `npm run build`
- Look: desktop rendering nearly identical (nearest steps); headings balance at narrow widths.
- Done when: typecheck + build pass; enumeration grep returns zero matches (excluding 0px + Milestones); ScopeCard fields still `text-lg` on mobile.
