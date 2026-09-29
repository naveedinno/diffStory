# 025: Ground ProgressPanel in tokens and safe areas
- Findings: COL-4, LAY-4, MOT-7, MOT-13
- Severity: LOW
- Wave: 2
- Owned files: client/surfaces/progress/ProgressPanel.tsx

## Problem
- COL-4: `PALETTE` pins literals (`--pp-bg:#14171c`, `--pp-elev:#1e232b`, `--pp-text:#eef1f5`, `--pp-muted:#98a2b3`, `--pp-blue:#3fb2ff`, `--pp-err:#ff6b62`, `--pp-ok:#3ddc97`, :78-88) duplicating `--surface`, `--surface-3`, `--text`, `--accent`, `--del`, `--add` (already drifted: `#3fb2ff` vs `#49b7ff`), with `[@media(prefers-color-scheme:light)]` overrides while the app switches on `data-theme`. The panel is deliberately a dark console in both themes.
- LAY-4 (panel half): floating variant `fixed right-[18px] bottom-[18px] ...` (:96) ignores safe-area insets. (Toast half is plan 005.)
- MOT-7 (panel half): `<NumberTicker value={state.planDone} startOnView={false} duration={0.45} ... />` (:345). (RecentRepos half removed in plan 020.)
- MOT-13 (panel half): hand-typed curves at :163 and :170. (Module is plan 001.)

## Target
- Keep the deliberate dark-always floor but alias values onto canonical tokens: `[--pp-bg:var(--surface)] [--pp-elev:var(--surface-3)] [--pp-text:var(--text)] [--pp-muted:var(--text-3)] [--pp-blue:var(--accent)] [--pp-err:var(--del)] [--pp-ok:var(--add)]` (verify each canonical token name exists; `--pp-line`/`--pp-faint` alias to the nearest line/faint tokens or stay documented literals if no match exists). Drop the OS-scheme branch (dark-always is intentional).
- Floating variant: `right-[calc(18px+env(safe-area-inset-right))] bottom-[calc(18px+env(safe-area-inset-bottom))]`. NOTE: plan 034 (LAY-3) converts these to logical props later; write them physical here.
- Ticker `duration={0.28}`.
- Curves imported from `../../shared/motion.ts`.

## Repo conventions
- Canonical tokens in `src/theme.ts`; one-directional aliasing only.
- Safe-area exemplar: PickerApp.tsx:62.

## Steps
1. Alias the palette onto canonical tokens; remove the OS-scheme branch.
2. Add physical safe-area insets to the floating variant.
3. Shorten the ticker duration.
4. Swap curve literals for the shared import.

## Boundaries
- Edit only the owned files. Do NOT touch text sizes (plan 033).
- Add no dependencies. If `client/shared/motion.ts` is missing, stop and report.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`
- Look: panel still a dark console in both themes; floats clear of notches; counts roll briskly.
- Done when: typecheck passes; all four target states present.
