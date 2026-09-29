# 020: Quiet RecentRepos motion, numerals, and labels
- Findings: COL-2, MOT-2, MOT-7, MOT-8, TYP-3, COPY-21
- Severity: MEDIUM
- Wave: 2
- Owned files: client/surfaces/picker/RecentRepos.tsx

## Problem
- COL-2 (RecentRepos half): unavailable-row numerals use `text-[var(--numeral-dim)]` (:165) at 1.43:1 light / 1.71:1 dark. (Rail half is plan 004.)
- MOT-2 (RecentRepos half): unavailable-workspaces disclosure renders `<BouncyAccordion` (:345). (FileSummary half is plan 016.)
- MOT-7/MOT-8: `<NumberTicker value={missing.length} duration={0.5} startOnView={false} ... />` (:352) rolls 0.5s from zero on every page load.
- TYP-3 (RecentRepos half): repo row names truncate (:180) while only the path below gets a Tooltip (:196).
- COPY-21: disclosure reads `{n} unavailable {workspace, workspaces}` (:353) on a repositories page.

## Target
- Unavailable numerals use `text-[var(--text-3)]` (git rows keep `var(--numeral)`).
- Disclosure uses the same calm treatment as plan 016 (native details preferred if consistent; match FileSummary's final pattern by reading that file first).
- Static count: replace NumberTicker with the plain number (or ActionSwapRollText as StoriesApp does); no roll on load.
- Row names get the full string via Tooltip, matching the path pattern at :196.
- Disclosure reads `{n} unavailable {repository, repositories}` (keep the `plural()` helper).

## Repo conventions
- Disclosure must match plan 016's FileSummary pattern (read that file; it runs in the same batch, so if it is not yet edited, implement native details and note the pairing for the recheck).
- Numeral exemplar: plan 004 rail fix (`var(--text-3)`).

## Steps
1. Swap the numeral token for unavailable rows.
2. Replace the accordion with the calm disclosure.
3. Replace the ticker with a static count.
4. Tooltip-wrap row names.
5. Rename workspaces to repositories.

## Boundaries
- Edit only the owned files. Do NOT touch text sizes (plan 033 owns them).
- Add no dependencies. Do not touch vendored components.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`
- Look: unavailable numerals quiet but visible; disclosure opens crisply; count renders instantly; long repo names reveal; disclosure says repositories.
- Done when: typecheck passes; all five target states present.
