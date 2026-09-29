# 002: Align theme-token copies (press, flip, emphasis)
- Findings: MOT-9, MOT-5
- Severity: MEDIUM
- Wave: 1
- Owned files: src/theme.ts

## Problem
- MOT-9: `src/theme.ts:45` carries `.ds-theme-toggle:active{transform:scale(.94)}`, below the 0.95 to 0.98 house band (the shared.css copy is plan 001).
- MOT-5: the vanilla `themeBootstrapScript()` `apply()`/`save()` path writes `data-theme` with no transition suppression (same smear as the React path fixed in plan 001).
- TYP-5 note: no italic woff2 ships in `assets/fonts/` (latin normal only), so the True-italic fix is impossible without new binaries; TYP-5 is fixed in plan 006 by restyling instead. No TYP-5 edit here.

## Target
- `.ds-theme-toggle:active{transform:scale(.97)}` in the theme.ts copy.
- `apply()` suppresses per-element transitions during the swap: inject `*,*::before,*::after{transition:none!important}`, write attributes, force reflow (`void root.offsetWidth`), remove the override on the next frame. Behavior of `save()`, `syncControls()`, and the `ds-theme-change` event unchanged.

## Repo conventions
- Canonical tokens live in this file's `sharedTokens()`; edit values in place, keep the 3b block structure.
- Never add Google Fonts (font-src 'self' CSP); fonts stay self-hosted woff2.

## Steps
1. Change `scale(.94)` to `scale(.97)` in the theme.ts toggle rule.
2. In `themeBootstrapScript()` `apply()`, wrap the attribute writes with the inject/reflow/remove suppression sequence.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build` (runs tsc plus client build)
- Look: theme toggle press feels identical to beUI buttons; a theme flip from a vanilla (non-React) context does not smear.
- Done when: build passes; both target states present in src/theme.ts.
