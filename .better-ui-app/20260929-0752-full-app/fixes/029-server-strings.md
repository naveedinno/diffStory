# 029: Sentence-case server titles and errors
- Findings: COPY-18, COPY-24, COPY-8
- Severity: LOW
- Wave: 2 (runs after plan 028; both own src/server.ts)
- Owned files: src/server.ts, src/comments.ts

## Problem
- COPY-18: tab titles render `title: "pick a repo"` (:1284), `title: "choose review scope"` (:1490), `title: `${repoName} review history`` (:1333) while pages head "Repositories", "Choose what to review", "Review history".
- COPY-24: API errors `invalid JSON` (:635 and mirrors), `no such comment`, `comment body is required` (comments.ts:180) surface beside sentence-case strings.
- COPY-8 (server half): "Not a git repository." (:812). Fix all user-facing "git" in both owned files.

## Target
- Titles: "Pick a repository", "Choose review scope", "{repoName} Review history" (exact strings).
- Errors: "Invalid JSON.", "No such comment.", "Comment body is required." (fix EVERY occurrence of each fragment in both files, including mirrored 400 handlers; grep to confirm zero remain).
- "Git" capitalized in user-facing strings (not code identifiers, not the `git` CLI/package names).

## Repo conventions
- Sentence case with terminal periods for errors; titles match page headings.

## Steps
1. Rewrite the three titles.
2. Rewrite all error-fragment occurrences (grep-verify zero remain, case-sensitive, excluding tests).
3. Capitalize "Git" in user-facing strings.

## Boundaries
- Edit only the owned files. Do NOT touch the EXP-2 plumbing from plan 028 (verify it is intact; if missing, stop and report).
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`
- Look: tab titles match pages; API errors arrive sentence-cased with periods.
- Done when: build passes; greps confirm zero remaining occurrences of each old fragment.
