# Design spec: diffStory "Signal / Thread-Ledger" — Foundation (tokens + type)

**Status:** approved direction, pending implementation-plan
**Date:** 2026-07-17
**Sub-project:** 1 of N in porting the `ui_kits/diffstory` (direction 3b) redesign into the real server-rendered app.

## Summary

Port the *foundation* of design direction **3b "Signal / Thread-Ledger"** into the real app: a single canonical token layer (ink surfaces, signal-blue accent, IBM Plex + Space Grotesk type) plus self-hosted webfonts. This re-skins all four routes (`/repos`, `/change`, `/stories`, `/review`) at once with **no markup or layout changes**. Islands, the numeral thread, the filmstrip, and the notes model are explicitly out of scope here — they land per-screen in later sub-projects, consuming the token vocabulary this sub-project establishes.

The imported mockup lives at `.claude-design/lab/diffstory-ds/` and is the source of truth for token values (`tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, `tokens/motion.css`).

## Goals

- Establish the 3b token set as the **canonical source of truth** in the shared token module, in both dark (default) and light schemes.
- Re-point every existing token-name layer (`--app-*`, `--md-*`, page-local `--panel*`/`--text-secondary*`/`--sans`/`--mono`, and the self-defined blocks in `story-picker.ts`/`picker.ts`) at the canonical 3b variables, so **no consumer CSS has to change**.
- Self-host IBM Plex Sans, IBM Plex Mono, and Space Grotesk as woff2, served same-origin (satisfies the existing `font-src 'self'` CSP with no CSP change).
- Add the new 3b-only tokens (`--font-display`, `--surface(-2/-3)`, `--radius-sm/·/-lg/-island`, `--thread(-dim)`, `--numeral(-dim)`, `--accent-line`, `--add-soft/--del-soft`, `--text-2/-3`) as available primitives, defined but not yet consumed.
- Preserve all HIG-grade accessibility guarantees already in place: ≥44px compact targets, `:focus-visible` rings, `prefers-reduced-motion`, and WCAG AA contrast in both themes.

## Non-goals (deferred to later sub-projects)

- Island layout (rounded floating panels + 12px gutters), the numeral-thread navigation, the filmstrip walkthrough, the Atlas-map cut, and any screen restructuring.
- The Notes / one-shot feedback model replacing rounds/verdicts (`review-state.ts`).
- Promoting ReviewHistory from a drawer to a standalone screen.
- Consolidating the scattered SystemStates.
- Retiring the blue rounded-square app icon / adopting the Thread-Path brand mark (brand sub-project).

## Approved decisions (from brainstorm)

1. **3b supersedes the documented Apple-HIG direction.** `DESIGN_MEMORY.md` and the saved design memory are rewritten to reflect ink/signal-blue/Plex as canonical, retaining the HIG-grade accessibility rules. *(This doc edit is part of this sub-project's plan.)*
2. **Canonical 3b token layer** (not a value-only retint): the full 3b block becomes the single source; existing names alias onto it.
3. **Self-hosted woff2 fonts** (not Google Fonts @import, not system-only): robust offline, no third-party calls, no CSP change.

## Current state (what we're building on)

Token-defining sites today (`grep :root{`):

| File | Role |
|---|---|
| `src/theme.ts` `sharedTokens()` | Shared `--app-*` graphite base + motion tokens. Included by page-assets, change-page, story-picker, picker. |
| `src/page-assets.ts` (3 `:root` blocks) | `/review` semantic layer: `--md-*` Material roles → Apple system colors, `--panel*`, `--text-secondary/tertiary/minimum`, `--line`, `--fill-*`, `--tk-*` syntax, `--sans`/`--mono`, `--ds-rail-width`. |
| `src/change-page.ts` | Page-local aliases: `--bg:var(--app-bg)` etc. (mostly inherits the shared base). |
| `src/story-picker.ts` | **Self-defined hardcoded** values (`--bg:#17181b; --blue:#0a84ff; --green:#48d597; …`) — does *not* fully reuse `--app-*`. |
| `src/picker.ts` | Own Apple-HIG token block. |
| `src/brand.ts`, `src/nav.ts` | Brand + nav tokens. |

Other facts:
- **Fonts are system-only.** Hardcoded SF Pro/SF Mono stacks in `page-assets.ts`, `story-picker.ts`, `change-page.ts`, `picker.ts`, `progress-ui.ts`. No `@font-face`, no webfont load anywhere.
- **CSP** in `server.ts` includes `font-src 'self'` — same-origin fonts need no CSP change; Google Fonts would have.
- **Static-asset serving** precedent exists (`server.ts` serves `/assets/mermaid.esm.min.mjs`); a `/assets/fonts/*.woff2` route follows the same shape.
- **Build:** `scripts/build-browser-assets.mjs` (esbuild) currently only bundles mermaid. `dist/` is committed (git-installs have no build step), so any vendored font files must end up committed under `dist/`.
- ~37 literal system-blue occurrences (`#4a9cff`, `#0866e5`, `rgba(10,132,255,…)`, etc.) across `src/*.ts` that bypass tokens and need tokenizing.

## Architecture

### 1. Canonical token layer (`src/theme.ts`)

`sharedTokens()` becomes the home of the **canonical 3b variables**, copied from the imported `tokens/*.css`, for `:root` (dark) and `:root[data-theme="light"]` (light). This includes: surfaces (`--bg`, `--surface`, `--surface-2`, `--surface-3`), text (`--text`, `--text-2`, `--text-3`), lines/fills (`--line`, `--line-soft`, `--fill-1/2/3`), signal accent (`--accent`, `--accent-hi`, `--on-accent`, `--accent-soft`, `--accent-line`), semantic (`--add`, `--add-soft`, `--del`, `--del-soft`, `--amber`, `--amber-soft`, `--on-amber`), thread/numerals (`--numeral`, `--numeral-dim`, `--thread`, `--thread-dim`, `--map-dot`, `--accent-glow`), diff (`--gutter`, `--add-bg`, `--del-bg`), syntax (`--tk-*`), misc (`--scrim`, `--shadow`, `--scroll`), type (`--font-sans`, `--font-mono`, `--font-display`, size/tracking/leading scale), spacing/radii (`--sp-*`, `--radius-sm/·/-lg/-island`, `--rail-width`, `--control-h*`), and motion (already carried over verbatim — keep the existing `--motion-*`).

The existing motion tokens in `sharedTokens()` are already identical to 3b's and stay as-is.

### 2. Alias / compatibility layer

Each existing name is re-pointed at a canonical 3b variable so downstream CSS is untouched. Representative mapping (full list enumerated in the plan):

| Existing name | → Canonical 3b |
|---|---|
| `--app-bg` | `var(--bg)` |
| `--app-elev` | `var(--surface)` |
| `--app-label` / `--app-l2` / `--app-l3` | `var(--text)` / `var(--text-2)` / `var(--text-3)` |
| `--app-hair` / `--app-sep` / `--app-fill` | `var(--line)` / `var(--line-soft)` / `var(--fill-2)` |
| `--app-blue` / `--app-blue2` | `var(--accent)` / `var(--accent-hi)` |
| `--app-add` / `--app-del` (+ bars) | `var(--add)` / `var(--del)` |
| `--md-primary` / `--md-surface` / `--md-on-surface` | `var(--accent)` / `var(--bg)` / `var(--text)` |
| `--md-surface-container` / `--panel2` | `var(--surface-2)` (or `--surface`) |
| `--panel` / `--panel3` / `--panel4` | mapped onto `--bg` / `--surface` / `--surface-3` |
| `--text-secondary` / `--text-tertiary` / `--text-minimum` | `var(--text-2)` / `var(--text-3)` / `var(--text-3)` |
| `--muted` / `--dim` / `--faint` | `var(--text-2)` / `var(--text-3)` / `var(--text-3)` |
| `--sans` / `--mono` | `var(--font-sans)` / `var(--font-mono)` |
| `story-picker` `--bg/--elev/--blue/--green/…` | replaced with `var(--bg)`/`var(--surface)`/`var(--accent)`/`var(--add)`/… |
| `picker.ts` own tokens | re-pointed at the canonical layer |

**Light-mode add/del legibility is preserved.** The existing code deliberately keeps darker, text-legible `--add`/`--del` in light mode (documented "don't tidy away" comment). 3b's `tokens/colors.css` light block already provides exactly these legible values (`--add:#178a52`, `--del:#d2372e`), so the intent is honored — the canonical light block carries them.

Hardcoded SF stacks in `progress-ui.ts`, `story-picker.ts`, `change-page.ts`, `picker.ts` are replaced with `var(--font-sans)` / `var(--font-mono)` (or the Plex stack directly where a var isn't in scope). The ~37 literal blue values are replaced with `var(--accent)` / `var(--accent-hi)` / `var(--accent-soft)` as appropriate.

### 3. Self-hosted fonts

- **Vendored files:** subsetted (latin) woff2 for IBM Plex Sans (400/500/600/700), IBM Plex Mono (400/500/600/700), Space Grotesk (500/600/700) — ~11 files, ~250–330KB total — sourced from `@fontsource/*` (added as devDeps) or Google's woff2, committed under a source assets dir and emitted to `dist/assets/fonts/`.
- **Build:** `scripts/build-browser-assets.mjs` copies the woff2 into `dist/assets/fonts/` so the committed `dist/` is self-contained (no devDeps at git-install time).
- **Serving:** a `GET /assets/fonts/:file.woff2` route in `server.ts` (mirroring the mermaid asset route), `Content-Type: font/woff2`, long cache header, path-allowlisted to the known filenames.
- **CSS:** `@font-face` blocks (in the shared token CSS) with `src:url('/assets/fonts/…') format('woff2')`, `font-display:swap`, correct `font-weight`/`font-style`. `--font-sans`/`--font-mono`/`--font-display` keep the system stack as fallback so offline / pre-load paints degrade to SF.
- **CSP:** unchanged — `font-src 'self'` already permits it.

### 4. New additive tokens

Define `--font-display`, `--surface(-2/-3)`, `--radius-sm/·/-lg/-island`, `--thread(-dim)`, `--numeral(-dim)`, `--accent-line`, `--add-soft/--del-soft`, `--map-dot`, `--accent-glow` in the canonical layer even though no current markup consumes them. They cost nothing unused and let each later per-screen sub-project pull from a complete vocabulary.

## Files to change

- `src/theme.ts` — canonical 3b token block (dark+light) + `@font-face` + re-point `--app-*` + update the `#15171b`/`#f1f3f6` theme-color meta values in the bootstrap to the ink/light bg.
- `src/page-assets.ts` — re-point `--md-*`, `--panel*`, `--text-*`, `--muted/--dim/--faint`, `--sans/--mono`, `::selection`, `--tk-*` to the canonical layer.
- `src/story-picker.ts`, `src/picker.ts`, `src/change-page.ts` — re-point their token blocks + font stacks.
- `src/progress-ui.ts` — font stack → `var(--font-sans)`.
- `src/brand.ts`, `src/nav.ts` — re-point any color literals to tokens (verify).
- `src/server.ts` — add `/assets/fonts/*.woff2` static route.
- `scripts/build-browser-assets.mjs` — copy woff2 into `dist/assets/fonts/`.
- `assets/fonts/` (new) — vendored woff2 (+ committed under `dist/assets/fonts/`).
- `package.json` — `@fontsource/*` devDeps (if used for sourcing).
- `DESIGN_MEMORY.md` + saved design memory — rewrite to the 3b direction.
- `dist/**` — rebuilt and committed.

## Edge cases & risks

- **Two-layer indirection depth.** `--md-*` → `--app-*` → canonical could create long `var()` chains; keep the alias mapping direct (name → canonical) to avoid 3-deep resolution and hard-to-trace drift.
- **Light add/del drift** — mitigated by carrying 3b's legible light values (above); verify on the light `/review` diff explicitly.
- **Diff gutter in light mode** — `--gutter` must stay a light near-white in light theme (3b light provides `#edf0f5`); confirm the line-number column isn't black.
- **Syntax token remap** — `--tk-*` dark and light both change to 3b's cool palette; verify code readability in both.
- **Literal-value stragglers** — scrollbar (`--scroll`), `::selection`, `meta[theme-color]`, and any inline `style=""` blues must be caught, or the retint looks half-applied.
- **PAGE_JS integrity** — this pass is CSS-dominant, but if any client-JS string is touched, run `node --check` on the emitted `PAGE_JS` (per repo convention) and rebuild.
- **Contrast** — signal blue `#3fb2ff` on ink vs system blue on graphite: re-verify AA for text/icon on accent and accent-on-surface in both themes.

## Verification

1. `npm run build` succeeds; `dist/` regenerated.
2. Launch the app (`diffstory-demo` config) and load **all four routes** (`/repos`, `/change`, `/stories`, `/review`) in **dark and light**; screenshot each.
3. Console clean; network shows woff2 served `200` from `/assets/fonts/` (same-origin), fonts actually applied (computed `font-family` = IBM Plex / Space Grotesk).
4. Spot-check AA contrast on: body text, muted text, accent buttons, diff add/del lines, syntax — both themes.
5. Confirm `prefers-reduced-motion` and focus-visible rings still behave.
6. Existing render-contract tests (`test/render-page.test.mjs`) still pass.
7. Visual comparison against the imported mockup at `localhost:4599` for palette/type fidelity.

## Open questions for the plan stage

- Exact font source (`@fontsource` packages vs hand-vendored subsets) and which weights to ship vs trim.
- Whether `--md-*` is kept as a thin alias indefinitely or scheduled for later removal (out of scope to remove now).
