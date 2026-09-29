# 001: Harden shared foundation (focus, menus, motion tokens)
- Findings: A11Y-3, A11Y-11, MOT-5, MOT-9, MOT-13, COPY-20, TYP-3
- Severity: HIGH
- Wave: 1
- Owned files: client/styles.css, client/shared/shared.css, client/shared/theme-menu.tsx, client/shared/editor-menu.tsx, client/shared/nav.tsx, client/shared/motion.ts (new)

## Problem
- A11Y-3: every focus ring is `box-shadow` with `outline:none` (`client/styles.css:52` `:focus-visible { outline: none; box-shadow: var(--shadow-focus); }`, inside `@layer base`), and a repo-wide grep finds zero `forced-colors` handling. Forced-colors mode drops box-shadow, leaving no indicator.
- A11Y-11: menu toggles wire `onClick` only (`client/shared/theme-menu.tsx:114` `onClick={() => setOpen((value) => !value)}`, same shape in `client/shared/editor-menu.tsx:124`); arrow handling exists only inside the open menu.
- MOT-5: `theme-menu.tsx:136` calls `setTheme(mode)` with no transition suppression while segment tiles, beUI buttons, and tabs carry color transitions, so the flip smears. (The vendored `use-theme.ts` is out of scope; wrap the call site.)
- MOT-9: `client/shared/shared.css:312` `.ds-theme-toggle:active { transform: scale(0.94); }` dips below the 0.95 to 0.98 house band.
- MOT-13: Signal curves hand-typed per file (`[0.23, 1, 0.32, 1]` in RefPicker, ScopeCard, ProgressPanel; `[0.32, 0.72, 0, 1]` in ProgressPanel; `ease-[cubic-bezier(.23,1,.32,1)]` in Milestones). No shared module exists.
- COPY-20: `client/shared/editor-menu.tsx:15-16` details restate the label ("Workspace and exact source line with Zed / with VS Code").
- TYP-3 (nav part): `client/shared/nav.tsx:118` breadcrumb shape `"max-w-[42ch] truncate ... whitespace-nowrap"` has no `title` or Tooltip fallback.

## Target
- styles.css and shared.css each end with an UNLAYERED `@media (forced-colors: active) { :focus-visible { outline: 2px solid Highlight; outline-offset: 2px; } }` rule placed after all component rules so it wins over `outline:none`.
- Both menu toggles open on ArrowDown (first item) and ArrowUp (last item) via `onKeyDown`, reusing the existing open/focus effect; Enter/Space behavior unchanged.
- Theme flip wrapped: in the `setTheme(mode)` call site, inject `*,*::before,*::after{transition:none!important}`, set theme, force reflow, remove override on next frame.
- `.ds-theme-toggle:active` uses `scale(0.97)` in shared.css (the src/theme.ts copy is plan 002).
- New `client/shared/motion.ts` exporting `EASE_SIGNAL_OUT = [0.23, 1, 0.32, 1] as const`, `EASE_SIGNAL_DRAWER = [0.32, 0.72, 0, 1] as const`, and `EASE_SIGNAL_OUT_CSS = "cubic-bezier(.23,1,.32,1)"`, each documented as mirroring the `src/theme.ts` tokens. No other file changes for MOT-13 in this plan (adoption sites are wave 2).
- Editor details share one string: "Opens the workspace at the exact source line".
- Breadcrumb links get `title={full label}`; the current-page span gets `title={full label}` (plain title, non-interactive).

## Repo conventions
- Tokens: `src/theme.ts` `sharedTokens()`; focus ring is `box-shadow: var(--shadow-focus)`, never outline (except forced-colors, where box-shadow cannot render).
- Exemplar for toggle keyboard: the existing `onMenuKeyDown` inside each menu file.

## Steps
1. styles.css: append the unlayered forced-colors block at end of file (outside any @layer).
2. shared.css: `scale(0.94)` to `scale(0.97)`; append the same forced-colors block at end of file.
3. theme-menu.tsx: add `onKeyDown` on the toggle for ArrowDown/ArrowUp; wrap the `setTheme(mode)` onClick with transition suppression.
4. editor-menu.tsx: add `onKeyDown` on the toggle for ArrowDown/ArrowUp; replace both detail strings with the shared sentence.
5. nav.tsx: add `title` with the full crumb label to breadcrumb links and the current-page span.
6. Create client/shared/motion.ts with the three exports.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`
- Look: Tab through theme/editor menus with keyboard only (arrows open, arrows move, Escape closes); flip theme and confirm no smear; breadcrumbs show full label on hover.
- Done when: typecheck passes; arrows open both menus; forced-colors blocks exist unlayered in both CSS files; motion.ts exports all three values.
