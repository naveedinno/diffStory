# Design spec: 3b islands on the /review surface

**Status:** pending approval
**Date:** 2026-07-17
**Sub-project:** 2 of N in the "Signal / Thread-Ledger" (3b) port. Builds on the foundation (canonical tokens + type) already shipped.

## Summary

Restyle the `/review` shell from full-bleed hairline-split panels into 3b **islands**: floating rounded `--surface` panels on the deeper ink `--bg`, separated by 12px gutters. Uses tokens already in place (`--surface`, `--line-soft`, `--radius-island`, `--shadow`). **CSS-first** in `src/page-assets.ts`; markup and behavior (beat-nav, rail resize, diff viewer, drawers) stay intact. This is the visual move that makes the ink palette read as designed rather than flat.

## Goals

- Turn the four review shell regions into islands: **top chrome**, **semantic ledger**, **rail**, **main/stage** — each `--surface` + 1px `--line-soft` + `--radius-island` (16px), separated by 12px gutters on the ink page.
- Remove the glass top bar (`backdrop-filter: blur`) — 3b is explicitly "no glass"; islands are flat, shadow reserved for overlays.
- Preserve every behavior: rail collapse/resize/persistence, the compact overlay model, arrow-key beat nav, the diff viewer (untouched), drawers, and the review menu.

## Non-goals (later slices)

- The filmstrip walkthrough / numeral-thread nav (keeps the current beat-tree rail).
- Island treatment on the other routes (`/repos`, `/change`, `/stories`) — this slice is `/review` only.
- Any change to the diff viewer internals, comments, or the rounds model.

## Current state (`/review` shell)

Markup (`render.ts`): `<header class="ds-reviewchrome">` (56px, grid `rail-width | 1fr`) → `.ds-reviewstatusbar` (semantic ledger, ≥44px) → `.ds-layout` (`.ds-rail` 316px + `.ds-main`). CSS (`page-assets.ts`):
- `.ds-top`/chrome ~L717: `backdrop-filter: saturate(180%) blur(20px)` **glass**, `border-bottom`.
- `.ds-reviewstatusbar` L242: `border-bottom:1px solid var(--line)`, `background:var(--panel3)`.
- `.ds-rail` L254/723: `border-right:1px solid var(--line-soft)`, `background:var(--panel3)`.
- `.ds-main` L416: `background:var(--bg)`.
- `.ds-rail-resizer` L260: 12px band absolutely positioned at the rail's right edge.
- Compact overlay: `@media (max-width:720px)` makes the rail `position:fixed` with a scrim.

Everything is full-bleed, joined by hairlines — no gutters, no radius.

## Design

**Frame.** The review body becomes the ink `--bg` page with a 12px frame padding. Inside, regions are islands separated by 12px gaps.

**Layout (recommended):**
```
┌──────────────────────────────────────────┐  ← 12px frame
│  ds-reviewchrome        (island, 16px r)  │
│  (gutter 12px)                            │
│  ds-reviewstatusbar     (island)          │  ← ledger, full width
│  (gutter 12px)                            │
│  ┌─ ds-rail ─┐ (12px) ┌─ ds-main ──────┐  │
│  │  island   │  gutter │  island (stage)│  │
│  └───────────┘         └────────────────┘  │
└──────────────────────────────────────────┘
```
- Chrome + ledger stay two stacked full-width islands (matches the established "56px title row + semantic ledger" rhythm).
- Rail + main sit in a flex row with a 12px gutter; the resizer lives in that gutter.
- Each island: `background:var(--surface)`, `border:1px solid var(--line-soft)`, `border-radius:var(--radius-island)`, `overflow:hidden` (so inner scroll clips to the rounded corner). No shadow (flat); shadows remain only on overlays/drawers.
- Drop `backdrop-filter` from the chrome (solid `--surface`); drop the full-bleed `border-bottom`/`border-right` in favor of island borders.

**Implementation shape.** Prefer pure CSS: a shell wrapper (the existing body/`.ds-layout` containers) gets `padding`/`gap`; each region gets island styling. If a clean wrapper for the vertical stack (chrome + ledger + layout) doesn't already exist, add one thin wrapper `<div>` in `render.ts` — the only markup change.

## Edge cases & risks

- **Rail resize:** reposition `.ds-rail-resizer` into the 12px inter-island gutter; keep `--ds-rail-width` drag + persistence working.
- **Rail collapse:** collapsed rail (width 0) → main island expands to fill; the rail gutter must collapse too (no empty 12px gap).
- **Compact (`max-width:720px`):** drop gutters/radius to full-bleed on mobile, or keep the rail as a rounded fixed overlay island with the scrim — must not break the existing overlay model.
- **Chrome grid alignment:** the chrome's internal `rail-width | 1fr` cells no longer need to pixel-align to the rail island (gutters loosen it) — verify the nav/title still read correctly.
- **Reduced transparency / contrast:** removing glass is strictly better here; re-verify the `prefers-contrast:more` block still applies.

## Verification

1. `npm run build`; load `/review` in dark + light — islands render with gutters, no glass, correct radii; screenshot both.
2. Drag-resize the rail, collapse/expand it, and shrink to compact width — all still work; console clean.
3. Confirm the diff viewer, drawers, and review menu are visually intact.
4. `node --test test/*.test.mjs` — update any shell-layout contract tests that assert the old full-bleed borders/backdrop-blur (preserve their intent), and rebuild `dist/`.

## Open question for approval

- **Ledger placement:** keep it as its own full-width island under the chrome (recommended, preserves the title-row + ledger rhythm), or merge it into the top of the chrome island as a second row. Recommend keeping separate.
