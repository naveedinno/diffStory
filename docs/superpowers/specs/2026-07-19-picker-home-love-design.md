# Picker home page — Signal 3b editorial pass

**Date:** 2026-07-19 · **Status:** approved (chat) · **Scope:** `src/picker.ts` only (plus rebuilt dist)

## Problem

The home page (repo picker) is a brand lockup, a "Repositories" header, and 1–2 cards.
With few repos, most of the viewport is bare background — it reads as unfinished, not calm.

## Approved direction

Option A ("ledger + masthead") plus option B's animated thread-line. Purely visual;
no new data model, no server/API changes, sheet/dialog untouched.

## Design

1. **Hero thread-line (signature).** The brand's thread path, drawn oversized as a
   background stroke sweeping through the hero band. On load it draws itself in
   (stroke-dash, ~1.4s, ease-out); afterwards a slow accent "signal pulse" travels the
   stroke on a long loop. `prefers-reduced-motion: reduce` → static full stroke, no
   pulse. `aria-hidden`, `pointer-events:none`, tokens `--thread-dim` / `--accent`.
2. **Stat line.** A quiet mono line in the hero computed from existing `RecentRow`
   data: repository count, total changed files, most recent open. No new data.
3. **Ledger numerals.** Repo rows get mono index numerals (`01`, `02`…) in
   `--numeral`, matching the review rail's numbering system. Order = recency, so the
   numbering encodes real information. Missing/unavailable rows use `--numeral-dim`.
4. **Footer colophon.** Hairline-topped footer: small thread mark, brand kicker,
   "Reads your working tree locally — nothing leaves this machine." Anchors the page
   bottom so short lists no longer float in a void.
5. **Background texture.** Barely-there dot grid on `--bg` using the existing
   `--map-dot` token, faded out with a mask toward the bottom. Theme-aware.

## Quality floor

Light + dark themes, reduced-motion honored, contrast-more unaffected, mobile
breakpoints keep working (numerals may compress/hide under 480px). Existing tests
must pass; dist/ rebuilt and committed with the change.
