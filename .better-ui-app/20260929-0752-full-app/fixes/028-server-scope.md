# 028: Surface silent scope substitution
- Findings: EXP-2
- Severity: MEDIUM
- Wave: 2 (runs after plan 018; both own ChangeApp.tsx)
- Owned files: src/scope.ts, src/git.ts, src/server.ts, src/payloads.ts, client/surfaces/change/ChangeApp.tsx

## Problem
- EXP-2: `commitScope` runs `const commit = isCommitRef(repo, requested) ? requested : 'HEAD'` (scope.ts:50); `branchScope` falls back to `currentBranch(repo) ?? 'HEAD'` for unknown branches and drops unknown parents; `resolveBase` (git.ts:124) returns the default base when `rev-parse --verify` fails. No notice attaches, so `?scope=commit&commit=ma` renders the latest commit while the URL names `ma`.
- Plumbing exists: `changeScreen(session, params, notice?)` (server.ts:1461) → `renderChange(..., notice?)` (:1485) → `payload.notice` → ChangeApp amber box (:178). BUT that box prefixes "That review couldn't be loaded." (plan 018), which is wrong for a substitution. A separate field is required.

## Target
- `Scope` gains optional `substitutionNote?: string`, set whenever a fallback fires, naming the unknown ref and the shown scope, e.g. "`ma` is not a known ref, showing the latest commit instead." Cover: unknown commit, unknown branch, unknown parent (kept branch, dropped parent), unresolvable base override. `resolveBase` must signal fallback: change its signature to accept an optional out-collector (e.g. `onFallback?: (requested: string) => void`) rather than changing its return type; update all callers accordingly (grep them).
- `renderChange` passes `scope.substitutionNote` through as `payload.scopeNotice` (add optional `scopeNotice?: string` to `ChangePayload` in src/payloads.ts:87 AND the client-side ChangePayload declaration, wherever it lives; find it first).
- ChangeApp renders `payload.scopeNotice` in its own amber box (same amber styling as the notice box, WITHOUT the "couldn't be loaded" prefix), above the scope controls. No other ChangeApp line changes (plan 018 owns the rest and runs first; COPY-1/contrast edits must be intact).

## Repo conventions
- Scope constructors in src/scope.ts; payload interfaces in src/payloads.ts mirrored client-side.
- Amber-notice exemplar: ChangeApp.tsx:178-180 box (styling only; new box omits the prefix sentence).

## Steps
1. Add `substitutionNote` to Scope; set it in all four fallback paths (incl. resolveBase out-collector + caller updates).
2. Plumb through renderChange → payload (server + client type declarations).
3. Render the scopeNotice box in ChangeApp.

## Boundaries
- Edit only the owned files. In ChangeApp.tsx add ONLY the scopeNotice box.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`, `node --test test/scope*.test.mjs` (or the closest scope/git test files; list and run them).
- Look: `/change?scope=commit&commit=ma` shows the amber substitution note naming `ma`; valid refs show no box.
- Done when: build + scope tests pass; all four fallback paths produce the note; no box on clean scopes.
