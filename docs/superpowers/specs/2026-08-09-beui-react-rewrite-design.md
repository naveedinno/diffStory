# diffStory → React + Tailwind + Motion (beUI) rewrite

Date: 2026-08-09
Status: Approved, in implementation

## Summary

Rewrite diffStory's five UI surfaces as React 19 applications built on
[beUI](https://beui.dev) components (MIT, `starc007/ui-components`), styled with
Tailwind v4 and animated with Motion 11. The Node/TS server keeps every route
and its whole JSON API, but stops emitting hand-written HTML/CSS/JS and starts
emitting a thin shell plus an embedded view-model payload.

## Decisions

| Decision | Choice |
|---|---|
| Stack | React 19 + Tailwind v4 + Motion 11, beUI source vendored |
| Design language | **Hybrid** — beUI's spacing / radii / shadows / motion; Signal's ink + signal-blue palette and IBM Plex + Space Grotesk type |
| Render model | React app per surface; review-page **diff rows stay server-rendered HTML** injected into the React shell |
| Distribution | VS Code extension **deleted**; npm publishing **dropped**. Local clone + macOS app only |
| Sequencing | Surface by surface: picker → story picker → change page → progress panel → review page |
| Not adopted | `lenis` smooth-scroll (hostile in a diff viewer), `shiki` (we have `highlight.ts`) |

## Architecture

### Delivery path (unchanged for users)

`git clone` → `npm install` → `./scripts/install-macos-app.sh` (which already
runs `npm run build` at line 30) → Rust wrapper launches `dist/app-server.js` →
pages served over local HTTP. A client build step is therefore free; nobody
installs a prebuilt artifact without a build.

### Build

- `client/` — React 19 + TS source.
- `scripts/build-client.mjs` — esbuild bundles one entry per surface into
  `dist/client/<surface>.js`; Tailwind v4 CLI compiles `dist/client/app.css`.
- Wired into `npm run build`, after `tsc`.
- Bundles served from the existing `/assets/*` route family.

### Server becomes a data backend

Each surface route returns a thin shell:

1. Inline theme bootstrap script (must stay inline — prevents FOUC).
2. `<link rel="stylesheet" href="/assets/client/app.css">` + existing font links.
3. `<div id="root">`.
4. `<script type="application/json" id="__DIFFSTORY_DATA__">` — the view-model.
5. `<script type="module" src="/assets/client/<surface>.js">`.

`src/view-model.ts` survives almost untouched: it already produces exactly the
serializable shape React needs, and its exported types become the React props.
This is the load-bearing continuity in the whole rewrite.

**Correction (shell agent finding).** Do not assume the route handlers hand you
a `ReviewModel`. `renderPage()` calls `buildReviewModel()` *itself*
(`render.ts:156`) with a specific metadata-first option set — `files: []`,
`detailedStepIndexes: new Set()`, `detailedFilePaths: new Set()`,
`trustPending: true`. Those options are what keep large reviews bounded, and
they must be copied exactly into the new route. Picker and stories data is not
from view-model at all; it is assembled ad hoc by `recentRowsForPicker`
(deliberately cheap) and `listStoryMetadata` vs `listStories`.

See `docs/superpowers/specs/server-shell-contract.md` for the full per-surface
route inventory and proposed payload interfaces. Three of its structural
findings matter to anyone planning work:

- `review` and `diff` are **one surface** — `/repo/<n>/diff` is the review page
  with `storyless: true` and a synthetic empty `Tour`.
- The **change page is the review page's error surface**: `reviewScreen` falls
  through to `changeScreen(…, notice)` for a missing or broken story, and that
  notice is the only user-visible explanation.
- **`progress` has no route.** It is a panel inside the review page, fed by the
  NDJSON response bodies of `POST /api/generate` and `POST /api/story/repair`.
  It has its own bundle entry, not its own page.

### Deleted

`src/page-assets.ts` (319 KB), most of `src/render.ts` (122 KB),
`src/picker.ts`, `src/story-picker.ts`, `src/change-page.ts`,
`src/progress-ui.ts`, and `vscode-extension/`. About 550 KB of untypable
template-string source becomes typed TSX.

### Untouched

`git.ts`, `narrative.ts`, `tour.ts`, `story-drift.ts`, `diff.ts`, `comments.ts`,
`agent.ts`, `stories.ts`, `coverage.ts`, `noise.ts`, `nav.ts` — all real logic.

`diff-render.ts`, `highlight.ts`, `intra-line.ts` keep emitting diff-row HTML,
injected via `dangerouslySetInnerHTML`.

## Token bridge

Tailwind v4 is CSS-first. The build generates `client/generated/theme.css`
containing an `@theme` block emitted from the Signal tokens already defined in
`src/theme.ts` — one source of truth, no drift. beUI's spacing, radii, shadow
and easing scales go into the same block, replacing Tailwind's defaults.

## Component mapping

> **Audit before adopting — every beUI "agents" component ships a baked-in live
> region.** Verified in the vendored source: `agents/todo-list.tsx` has
> `<ol aria-live="polite">`; `agents/agent-activity`,
> `agents/loading-states/agent-progress` and `motion/loader` carry
> `role="status"`; `motion/dynamic-island` and reasoning-text use
> `aria-live="polite"`.
>
> This disqualified the entire proposed mapping for the progress panel: using
> `TodoList` for the plan would have read the whole plan aloud on every update,
> and six existing tests assert precisely that this must not happen. That panel
> is hand-built with Tailwind utilities and uses only `motion/button/base`.
>
> A later audit of the vendored source found the problem is wider than the
> progress panel, and hits the review page's core recommendations:
>
> | Component | Carries |
> |---|---|
> | `agents/file-diff.tsx` | `aria-live="polite"` **on the diff viewport** (line 220) |
> | `agents/ai-sidebar.tsx` | `aria-live="polite"` |
> | `agents/tool-result.tsx` | `aria-live="polite"` + `role="log"` |
> | `agents/streaming-response.tsx`, `agents/agent-activity/`, `agents/todo-list.tsx`, `agents/loading-states/*`, `motion/loader.tsx` | `aria-live` / `role="status"` |
> | `agents/code-block.tsx` | `aria-live={streaming ? "polite" : undefined}` — safe only while `streaming` stays false |
>
> A live region on the diff viewport would announce the whole diff body on every
> lazy load, context expansion and split↔unified toggle. Strip it in a wrapper
> under the surface directory (never edit `client/vendor/beui/**`), or hand-build.
>
> **The mapping below was written from component names, not source. Treat every
> row as a candidate to audit, not a decision.**

| Surface | beUI components |
|---|---|
| Review page | `ai-sidebar`, `agent-disclosure`, `code-block`, `file-diff`, `citations` (trust evidence), `scroll-progress` (reading position), `dock` (filmstrip), `morphing-tabs` (split/unified), `drawer` (comments), `command-palette` (nav), `popover`, `tooltip` |
| Progress panel | ~~`agent-activity`, `todo-list`, `streaming-response`, `loading-states`, `dynamic-island`~~ — **none adopted**; all carry live regions. Hand-built, plus `motion/button/base`. |
| Change page | `morphing-tabs`, `select`, `table/`, `file-diff` |
| Repo / story picker | `table/`, `context-menu`, `animated-badge`, `swipeable-list` |
| Global | `theme-toggle`, `notification-stack`, `animated-toast-stack`, `loader` |

## Testing

The 14 HTML-assertion test files are **not** ported one-to-one — they assert on
markup that ceases to exist.

- `motion-regressions`, `render-accessibility`, `ui-layout-regressions` →
  Playwright against the real server, driven by `scripts/capture-ui-atlas.mjs`.

  **Correction (recon finding).** The atlas is a weaker net than this design
  originally assumed: it shoots the repo picker, story picker, change page and
  review page at **desktop only** — tablet and mobile shots exist for the review
  page alone, and the progress panel has no shot at all. Coverage must be
  widened to all five surfaces at all three viewports, and a full "before"
  capture taken, **before** any surface is rewritten. Otherwise there is no
  baseline to diff against.
- `render-page`-class tests → assert on the shell and the embedded JSON payload.
- RTL + happy-dom only where component logic is genuinely non-trivial.
- The other 40 test files never move.

## Corrections to earlier assumptions

- `/api/events` is **SSE** (`text/event-stream`, `EventSource`), not NDJSON.
  NDJSON is the *progress* stream — the POST response body of `/api/generate`
  and `/api/story/repair`.
- De-Nextifying was cheaper than feared: no `next/image`, `next/link`,
  `@vercel/*` or analytics imports exist anywhere in the vendored subtree.
- `react-use-measure` was specced as a dependency but nothing imports it;
  removed.
- Navigation is always a real URL — there is no `history.pushState` anywhere in
  the codebase. The React rewrite must preserve real-URL navigation rather than
  introducing client-side routing.

## Known risks

0. **Performance is lazy loading, not virtualization.** There is no
   virtualization, no `content-visibility` and no `IntersectionObserver`
   anywhere in the current app. 300-step stories stay fast because *every* step
   and file panel ships as a lazy stub, prefetch is capped at `i+1`, narration
   warms at most 2 ahead, coverage is deferred to `requestIdleCallback`, and
   work is debounced at 90/180/1000 ms and rAF-batched. Reaching for
   `@tanstack/react-virtual` instead of preserving this would be a rewrite of
   the performance model, not a port of it. See
   `docs/superpowers/specs/review-page-inventory.md` for the full list of
   measures that must survive.

1. **Review page is ~70% of the work.** Everything else is small.
2. **Diff-row interaction seam.** `dangerouslySetInnerHTML` means React cannot
   own row-level interaction (comment gutters, line selection, intra-line
   highlights). Mitigation: one delegated handler on the container reading
   `data-*` attributes off rows — which is how the vanilla code already works.
   This is the seam most likely to get ugly.
3. **Tailwind v4 `@theme` bridge** is the least-proven part of the stack.
4. **De-Nextifying** ~30 vendored files (`'use client'`, `next-themes`,
   `next/image`) is mechanical but unavoidable.
5. **Bundle size** — React 19 + Motion 11 + lucide. Watch it; skipping shiki
   and lenis is partly why.

## Conventions for implementers

- **No git mutations.** No `git checkout`, `reset`, `stash`, `clean`, `commit`.
  Multiple agents share one working tree with uncommitted work.
- Respect file ownership boundaries; do not edit files outside your assignment.
- `client/vendor/beui/**` is vendored MIT source — keep the upstream copyright
  header and a provenance comment naming the source path.
