# Server shell contract — the five React surfaces

Date: 2026-08-09
Status: Contract for the beUI/React rewrite (see
`2026-08-09-beui-react-rewrite-design.md`)
Owner of `src/shell.ts`: the shell agent. Owner of each surface: the five
surface-rewrite agents.

This document is the seam. It records, for every surface, what route renders it
today, what data the current renderer receives, where that data comes from, what
`/api/*` it talks to at runtime, and the exact `__DIFFSTORY_DATA__` payload the
React entry should expect.

Line numbers are against the working tree as of 2026-08-09 and will drift (and
`src/server.ts` is being edited concurrently). Every reference also names the
function, which will not.

**Read this together with `surface-inventory.md`**, which is the companion
document: that one records the *behaviour and layout* of the pages being
deleted; this one records the *data contract* between the server and the React
entries. Where they overlap they agree; where they differ, the inventory wins on
"what the UI did" and this file wins on "what the payload is".

---

## 1. The shell API

`src/shell.ts` exports:

```ts
type ShellSurface = 'picker' | 'stories' | 'change' | 'review' | 'progress';

interface ShellInput<TPayload> {
  surface: ShellSurface;
  title: string;                                  // "diffStory — {title}"
  payload: TPayload;
  bodyClass?: string;
  skeleton?: 'brand' | 'none' | { html: string }; // default 'brand'
  lang?: string;                                  // default 'en'
}

function renderShell<TPayload>(input: ShellInput<TPayload>): string;
function serializeShellPayload(value: unknown): string;
function clientEntryHref(surface: ShellSurface): string;

const SHELL_PAYLOAD_ID = '__DIFFSTORY_DATA__';
const CLIENT_ASSET_BASE = '/assets/client';
const CLIENT_STYLESHEET_HREF = '/assets/client/app.css';
```

Emitted document (≈6.2 KB with `skeleton: 'none'`, ≈7.3 KB with the default
placeholder — almost all of it the inline theme bootstrap and the two brand
data-URI icons):

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#0a0c0f" data-ds-theme-color>
<script>…themeBootstrapScript()…</script>
<link rel="icon" …><link rel="mask-icon" …>
<title>diffStory — {title}</title>
<link rel="stylesheet" href="/assets/client/app.css">
<style>…boot placeholder only…</style>
</head>
<body class="{bodyClass}" data-surface="{surface}">
<div id="root">…placeholder…</div>
<script type="application/json" id="__DIFFSTORY_DATA__">{payload}</script>
<script type="module" src="/assets/client/{surface}.js"></script>
</body>
</html>
```

Client-side read:

```ts
const el = document.getElementById('__DIFFSTORY_DATA__');
const data = JSON.parse(el!.textContent!) as ReviewPayload;
```

### Rules for surface agents

- **Do not add a second inline `<script>`.** One inline script (theme) plus one
  JSON block plus one module entry is the whole budget. Anything else belongs in
  the bundle.
- **The payload must be a plain JSON value.** No `Map`, no `Set`, no `Date`, no
  `undefined`-valued keys you care about (`JSON.stringify` drops them). Prefer
  arrays of tuples and epoch-millisecond numbers, which is already how
  `view-model.ts` and `stories.ts` behave.
- **The payload is the whole initial state.** Do not put state in `data-*`
  attributes on `<body>` the way `render.ts` does today (`data-repo`,
  `data-review-page-token`, `data-story-key`, …). Those all become payload
  fields; `data-surface` is the only body attribute the shell sets.
- **Escaping is the shell's job, not yours.** Never hand-build the JSON block.

---

## 2. CSP finding — one change is required, and it is not the one you'd guess

`setLocalResponseHeaders()` (`src/server.ts:306`) sets, on **every** response:

```
default-src 'none'; base-uri 'none'; connect-src 'self'; font-src 'self';
form-action 'self'; frame-ancestors 'none'; img-src 'self' data:;
media-src 'self' blob:; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'
```

Findings, in order of importance:

1. **`style-src` has no `'self'`.** Today that is fine, because every page
   inlines all of its CSS in a `<style>` element. The moment the shell emits
   `<link rel="stylesheet" href="/assets/client/app.css">`, **the browser will
   block that stylesheet** and every surface renders unstyled. `style-src` must
   become `style-src 'self' 'unsafe-inline'`. This is the single blocking CSP
   change for the rewrite. *(I have not made it — the server file is owned by
   another agent. It must land before any surface can be visually verified.)*
2. **`script-src 'self' 'unsafe-inline'` already covers everything the shell
   needs.** `'unsafe-inline'` permits the theme bootstrap; `'self'` permits
   `<script type="module" src="/assets/client/…">`. No change.
3. **The `application/json` block needs nothing.** A `script` element whose type
   is not a JavaScript MIME type is a data block and is never executed, so the
   inline-script check never runs against it. (And `'unsafe-inline'` is present
   anyway, so this is belt-and-braces.)
4. **`font-src 'self'`** still works: the `@font-face` rules move from the inlined
   `sharedTokens()` into `app.css`, but the URLs stay `/assets/fonts/*`.
5. **`connect-src 'self'`** already covers `fetch` and `EventSource` to `/api/*`.
6. **Source maps.** If `scripts/build-client.mjs` emits external `.map` files,
   they are fetched by devtools, not the page, so CSP does not apply — but the
   `/assets/client/*` route must serve them or devtools will 404 noisily.
7. **`/assets/client/*` has no route yet.** `src/server.ts` serves only
   `/assets/mermaid.esm.min.mjs` (`sendMermaidBrowserAsset`, line 2470) and
   `/assets/fonts/*` (`sendFontAsset`, line 2502). A `/assets/client/*` handler
   with `text/javascript` + `text/css` content types must be added. Note
   `sendMermaidBrowserAsset` already sets `Cache-Control: public, max-age=3600`,
   which is wrong for a bundle that changes every build unless the filename is
   hashed — recommend `no-cache` for `/assets/client/*` until hashing exists.

Also relevant, though not CSP: **`isTrustedLocalRequest()`** (line 281) rejects
any request whose `Sec-Fetch-Site` is not `same-origin`/`none`. Module scripts
and stylesheets from the same origin send `same-origin`, so bundles load fine.

---

## 3. Skeleton recommendation

**Ship one shared, delayed boot placeholder. Do not build five skeletons.**

The reasoning:

- Everything is localhost. The stylesheet is render-blocking and small; the
  bundle is served from the same machine. The realistic gap between first paint
  and React's first commit is bundle *parse + execute*, on the order of 50–150 ms
  for React 19 + Motion — not network.
- A per-surface skeleton that is accurate enough to avoid a layout jolt is, by
  construction, a second implementation of the layout. Five of them will drift
  from the five React trees inside a week, and every drift shows up as a visible
  snap at mount.
- But an empty ink-colored rectangle for 150 ms on a cold macOS-app launch reads
  as "broken", and the review page (the big bundle) is exactly where that bites.

So `renderShell` defaults to `skeleton: 'brand'`: three centered dots, styled by
a ~600-byte inline `<style>`, with `animation-delay: 240ms` and
`animation-fill-mode: backwards`. **A boot that beats 240 ms shows nothing at
all** — no flash-of-spinner — and a slow boot gets an honest "working" signal.
`prefers-reduced-motion: reduce` gets a plain opacity step instead of a pulse.

React's `createRoot(...).render()` replaces the container's children on its first
commit, so no teardown code is needed in any surface.

Pass `skeleton: 'none'` if a surface measures its boot as consistently
sub-100 ms and prefers a clean empty frame. Pass `{ html }` only if a surface
genuinely earns a bespoke skeleton — the review page is the only plausible
candidate, and only after it is measured.

---

## 4. Escaping

`serializeShellPayload()` is `JSON.stringify` followed by `&`, `<`, `>`, U+2028
and U+2029 → `\uXXXX`. This is the same technique as `render.ts`'s private
`jsonForDataScript()` (line 126), which already protects
`#ds-initial-comments` and the move-annotation blocks; the shell version is the
one that survives `render.ts`'s deletion.

Escaping `<` alone is what neutralizes the attack surface: an HTML tokenizer
inside a `script` element is in *script data* state, where the only two exits are
`</script` (early close) and `<!--` (switch to script-data-escaped state, which
then swallows the real closing tag). Both begin with `<`. Entities are **not**
decoded in that state, so HTML-escaping (`&lt;`) would corrupt the payload — the
JSON `<` escape is the correct one because `JSON.parse` reverses it exactly.

Lone surrogates need no special handling: `JSON.stringify` has been well-formed
since ES2019, so a lone `U+D800` is emitted as the six literal characters
`\ud800` and the document stays valid UTF-8.

Verified in `/private/tmp/.../scratchpad/shell-escape-check.mjs` and
`shell-browser-check.mjs`:

| Check | Result |
|---|---|
| `</script>`, `</SCRIPT >`, `</\tscript >`, `<script src=…>` in string values | round-trip intact, no early close |
| `<!--` / `-->` in string values | round-trip intact, no escaped-text state |
| `<!DOCTYPE html>`, `]]><![CDATA[`, `<img src=x onerror=…>` | round-trip intact, no element created |
| `&amp;`, `&#x3c;/script>` (double-escape bait) | round-trip byte-identical |
| U+2028 / U+2029 | escaped, round-trip intact |
| lone high surrogate `\uD800`, lone low `\uDC00` | escaped to `\ud800` / `\udc00`, same code units back |
| valid astral pair (emoji) | left raw, round-trip intact |
| hostile `title` and `bodyClass` | HTML-escaped, no attribute break-out |
| `undefined` / function payload | emits `null`, never an empty script body |
| Real Chromium parse (playwright-core) | 3 `<script>` elements in the DOM, 0 `<img>`, no injected code ran, `JSON.parse(el.textContent)` deep-equals the input, `data-theme` resolved before paint |

The escaping helper deserves a permanent unit test in `test/` — the test-owning
agent should port `shell-escape-check.mjs` rather than re-derive it.

---

## 5. Surface inventory

### 5.1 `picker` — the repository picker

| | |
|---|---|
| Routes | `GET /` when `session.repo == null` (server.ts:376); `GET /repos` (:430); `GET /change` and `GET /review` with no repo (:433, :437); `GET /repo/…` whose repo cannot be restored redirects to `/` (:393) |
| Route helper | `pickerStub(home)` — server.ts:771 |
| Current renderer | `renderPicker(recents, home, now)` — `src/picker.ts:93` |
| Title | `diffStory — pick a repo` |

**Arguments today**

```ts
renderPicker(
  recentRowsForPicker(home),  // RecentRow[]  — server.ts:973
  home,                       // string, os.homedir()
  Date.now(),
)
```

**Provenance:** none of this comes from `view-model.ts`. `recentRowsForPicker`
is assembled ad hoc in `server.ts:973` from `loadRecents(home)`
(`src/recents.ts`) plus a single `existsSync` freshness check. Deliberately so —
the comment at :967 explains that re-inspecting every recent repo on Home
navigation was too slow. `RecentRow` is exported from `src/picker.ts:10` and
must be **moved** (to `src/types.ts` or a new `src/payloads.ts`) when `picker.ts`
is deleted.

`prettyPath()` and `relativeTime()` (picker.ts:29, :35) are presentation and
should move into the React component, so the payload carries raw `path` and
`lastOpened` — which it already does.

**Runtime API calls**

| Endpoint | Method | Shape | Notes |
|---|---|---|---|
| `/api/fs?path=` | GET | JSON | server-backed directory browser (`listDirs`) |
| `/api/repo/open` | POST | JSON | returns repo state + `route` to navigate to |
| `/api/repos/recent` | DELETE | JSON | returns `{ ok, removed, recents }` — a fresh `RecentRow[]` |
| `/api/repos/recent` | GET | JSON | exists (:440) but the picker does not call it today |
| `/api/agents` | GET | JSON | `{ agents, skills }` — drives the skills-readiness banner |
| `/api/skills/update` | POST | JSON | `{ ok, installed, skills }` |

No HTML-fragment endpoints. This surface is a clean port.

**Payload**

```ts
export interface RecentRow {
  path: string;
  name: string;
  isGit: boolean;
  hasTour: boolean;
  currentBranch: string | null;
  changedFiles: number;
  lastOpened: number; // epoch ms
}

export interface PickerPayload {
  recents: RecentRow[];
  /** os.homedir(), used to render "~/…" paths client-side. */
  home: string;
  /** Server clock at render time — relative times must not use the client clock. */
  now: number;
}
```

---

### 5.2 `stories` — the review-history / story picker

| | |
|---|---|
| Routes | `GET /repo/<name>`, `GET /repo/<name>/`, `GET /repo/<name>/stories` — via `parseRepoRoute` (:234) → `repoScreen === 'stories'` (:398). `GET /stories` 302-redirects here (:422) |
| Route helper | `storyChooser(session, refreshEvidence)` — server.ts:775 |
| Current renderer | `renderStoryPicker(opts)` — `src/story-picker.ts` |
| Title | `diffStory — {repoName} review history` |
| Side effect | This route **mutates session state** (`chooseStory = true`, `selectedStory = undefined`) and calls `recordStorySelection(home, repo, null)` — reaching review history is the explicit "close story" transition (:398–:407). Keep that behaviour in the rewritten handler. |

**Arguments today**

```ts
renderStoryPicker({
  repoName: basename(repo),
  routeBase: repoRouteBase(repo),          // `/repo/${encodeURIComponent(basename(repo))}`
  stories: url.searchParams.get('evidence') === 'refresh'
    ? listStories(repo)          // rebuilds the diff — expensive, live evidence
    : listStoryMetadata(repo),   // navigation-first, liveEvidence === false
  now: Date.now(),
})
```

**Provenance:** not from `view-model.ts`. `StorySummary` comes from
`src/stories.ts:12` and is already a flat, serializable record — it can go into
the payload verbatim. The `?evidence=refresh` split is important and easy to
lose: the default projection sets `liveEvidence: false` and the UI must not
present `additions` / `deletions` / `liveFiles` as facts when that flag is false
(`story-picker.ts:67` already gates on it).

`storyRow()`'s state machine (story-picker.ts:31–:57) — the `Needs repair` /
`Saved` / `In review` / `Story changed` / `Verify scope` / `Current` badge — is
pure presentation over `StorySummary` and should be ported into TSX as-is. It is
the one piece of real logic on this surface.

`narrativeText(s.title)` / `narrativeText(s.summary)` (`src/narrative.ts`) are
applied **server-side** today. Keep it that way: project the narrative to plain
text in the route and put strings in the payload, so the client bundle does not
need `narrative.ts`.

**Runtime API calls**

| Endpoint | Method | Shape | Notes |
|---|---|---|---|
| `/api/stories` | DELETE | JSON | `{ ok, removed, stories }` — a fresh `StorySummary[]` |

Navigation to a story is a plain link: `${routeBase}/review?story=<id>`.

**Payload**

```ts
export interface StoryRowView {
  id: string;
  title: string;      // narrativeText() already applied
  summary: string;    // narrativeText() already applied, or the error text
  updatedAt: number;
  valid: boolean;
  error?: string;
  steps: number;
  primers: number;
  files: number;
  freshness: 'current' | 'stale' | 'unverified';
  inStoryDrift: number;
  outsideStoryDrift: number;
  liveEvidence: boolean;
  liveFiles: number;
  additions: number;
  deletions: number;
  openComments: number;
  scope: { label: string; description: string; command: string };
}

export interface StoriesPayload {
  repoName: string;
  routeBase: string;   // "/repo/<encoded-basename>"
  stories: StoryRowView[];
  /** True when ?evidence=refresh was honoured (listStories, not listStoryMetadata). */
  liveEvidence: boolean;
  now: number;
}
```

*Guess, flagged:* I am proposing `StoryRowView` as a narrowed projection rather
than shipping raw `StorySummary`, because `StorySummary` also carries `path`
(an absolute filesystem path) and `mode`/`base`/`head`, none of which the UI
reads. Shipping the absolute path into the page is avoidable, so avoid it. If a
surface agent finds a use for a dropped field, add it back explicitly.

---

### 5.3 `change` — the "Your change" scope picker

| | |
|---|---|
| Routes | `GET /repo/<name>/change` (:409). `GET /change` redirects here (:432). `GET /` with `?scope`/`?base`/`?head`/`?commit` redirects here (:386). **Also the fallback for `/repo/<name>/review`** when no story is selected or the story fails to load (`reviewScreen`, :789–:811) |
| Route helper | `changeScreen(session, params, notice?)` — server.ts:883 → `renderChange` :892 |
| Current renderer | `renderChangePage(sum, opts)` — `src/change-page.ts:90` |
| Title | `diffStory — choose review scope` |
| Side effect | `changeScreen` writes the resolved scope onto the session (`session.base` / `session.head`) before rendering. `repoScreen === 'change'` also sets `chooseStory = false; selectedStory = null`. |

**Arguments today**

```ts
renderChangePage(
  summarizeChange(repo, session.base, session.head),  // ChangeSummary — src/change-view.ts:20
  {
    repoName: basename(repo),
    routeBase: repoRouteBase(repo),
    base: session.base,          // undefined = smart default
    head: session.head,          // undefined = working tree
    scopeLabel: scope.label,     // from resolveScope() — src/scope.ts
    active: scope.active,        // '' | 'compare' | 'commit'
    notice,                      // set only on the review-failure fallback path
  },
)
```

**Provenance:** not from `view-model.ts`. `ChangeSummary` comes from
`src/change-view.ts` (pure composition over `git.ts`); `scope.label` / `scope.active`
come from `resolveScope()` in `src/scope.ts`. Both are already serializable.

**The `notice` path is the trap on this surface.** It is the only way a user
sees "That review couldn't be loaded" (change-page.ts:107), and it is reached
from the *review* route, not the change route. A rewrite that forgets it turns a
broken story into a blank scope picker with no explanation.

**Runtime API calls**

| Endpoint | Method | Shape | Notes |
|---|---|---|---|
| `/api/refs?ref=` | GET | JSON | `{ ref?, current, branches, commits }` — feeds the branch/commit pickers |

The primary CTA is a plain navigation to `${routeBase}/diff?…`, which renders
the **storyless review page** (surface `review`, not a separate surface).

**Payload**

```ts
export interface ChangeFileView {
  path: string;
  added: number | null;    // null = binary / unknown
  removed: number | null;
}

export interface ChangePayload {
  repoName: string;
  routeBase: string;
  base: string;            // resolved base ref
  baseLabel: string;       // describeBase() output
  /** The session's explicit overrides; absent means "smart default". */
  baseOverride?: string;
  headOverride?: string;
  scopeLabel: string;
  active: '' | 'compare' | 'commit';
  files: ChangeFileView[];
  totalChanged: number;
  hasChanges: boolean;
  /** Set only when arriving from a review route that could not load its story. */
  notice?: string;
}
```

---

### 5.4 `review` — the review page (storyful **and** storyless)

This is one surface with two entry points and one renderer. ~70% of the work.

| | |
|---|---|
| Routes | `GET /repo/<name>/review` → `reviewScreen` (:419, :789) → `renderReview` (:1133) — **storyful**<br>`GET /repo/<name>/diff` → `diffScreen` (:414, :908) — **storyless** (`storyless: true`)<br>`GET /review` redirects to the former (:436) |
| Current renderer | `renderPage(input: RenderInput)` — `src/render.ts:135`, `RenderInput` at `:35` |
| Title | `diffStory — {model.story.title.text}`, or `diffStory — Reviewing the diff` when storyless |
| Side effects | Both handlers issue a **review page lease** (`issueReviewPageLease`) and cache a snapshot (`cacheReviewPageSnapshot`). Every lazy `/api/*` call on this page carries `?page=<token>`. |

**Arguments today — `renderReview` (storyful, server.ts:1171)**

```ts
renderPage({
  repo,                                    // absolute path
  routeBase: repoRouteBase(repo),
  repoName: basename(repo),
  tour,                                    // Tour, from loadTour(selectedStoryPath(session))
  files: [],                               // always empty: metadata-first rendering
  fileIndex: boundedReviewIndex(fileIndex),// ReviewFileIndexEntry[]
  baseLabel: describeBase(repo, base),
  headRef: head,
  comments: commentsForStory(loadComments(repo), activeStoryId(session, pageLease)),
  reviewState,                             // ReviewStateSummary — src/review-state.ts
  reviewPageToken: pageLease.token,
  storyKey: pageLease.storyIdentity,
  storyDrift,                              // StoryDriftView | undefined
  stagedWorktreeDivergentFiles: data.stagedWorktreeDivergentFiles,
  excludedFiles: data.excludedFiles,       // ReviewExclusionMetadata[]
})
```

**Arguments today — `diffScreen` (storyless, server.ts:943)** — same shape, plus
`storyless: true`, `tour` a synthetic empty `{ version:1, title:'', summary:'', steps:[], base }`,
`comments: loadComments(repo)` (unfiltered — no story owns the feedback), and no
`storyDrift`.

**Provenance — the important part**

`RenderInput` is *not* the view-model. `renderPage` calls
`buildReviewModel(repo, tour, files, headRef, opts)` **internally**
(render.ts:156) and everything the UI actually reads comes out of that call:

```ts
buildReviewModel(repo, tour, [], headRef, {
  storyless,
  detailedStepIndexes: input.fileIndex ? new Set() : new Set([0]),
  detailedFilePaths: new Set(),
  fileIndex: input.fileIndex,
  trustPending: !!input.fileIndex,
  baseRef: tour.base ?? baseLabel,
})
```

So the rewritten route must call `buildReviewModel` itself and put the resulting
`ReviewModel` (view-model.ts:240) into the payload. **`ReviewModel` is already
exactly the right shape** — that is the design doc's "load-bearing continuity"
claim, and it holds.

What is *not* in `ReviewModel`, and must be assembled by the route:

| Field | Source | Note |
|---|---|---|
| `reviewState` | `reviewStateSummary()` — review-state.ts | scope key, diff hash, feedback health |
| `reviewPageToken` | `issueReviewPageLease()` — session.ts | required by every lazy endpoint |
| `storyKey` | `pageLease.storyIdentity` | scopes the saved reading position |
| `storyDrift` | `storyDriftView(inspectStoryDrift(…))` — server.ts:1683 | storyful only |
| `excludedFiles` | `sessionReviewIndex()` | `ReviewExclusionMetadata[]` — noise.ts:16 |
| `stagedWorktreeDivergentFiles` | `sessionReviewIndex()` | `string[]` |
| `comments` | `commentsForStory(loadComments(repo), storyId)` | filtered by the lease's story |
| `storyFreshness` | derived in render.ts:140–:148 from `storyDrift` | see below |
| `fileIndex` | `boundedReviewIndex()` | `ReviewFileIndexEntry[]`, bounded |

`storyFreshness` is computed by a small derivation at render.ts:140 —
storyless → `'current'`; `storyDrift.state === 'unverified'` → `'unverified'`;
`'story-changed' | 'mixed'` → `'stale'`; otherwise `'current'`. Port this into
the route (or into the React component — but pick one and only one).

Also derived in `renderPage` and worth keeping server-side because they gate
chrome that must be correct on first paint: `openCount` / `blockingOpenCount`
(render.ts:171–:173), `reviewClean` (:180), `showTrustPill` (:190),
`trustPillClean` (:191), `focusedStory` (:175).

**Body `data-*` attributes to migrate into the payload** (render.ts:282–:286):
`data-repo`, `data-viewed-scope`, `data-review-scope`, `data-story-key`,
`data-current-diff-hash`, `data-review-page-token`, `data-storyless`,
`data-story-freshness`, `data-feedback-health`, `data-story-scope`,
`data-read-view`. Client code reads the page token off the body today
(`reviewPageUrl`, page-assets.ts:964); the React version should read it from the
payload and keep a single `reviewFetch(path)` helper that appends `?page=`.

**Runtime API calls**

*All of these except `/api/agents`, `/api/codex/models`, `/api/skills/update`
and `/api/aloud/*` take `?page=<reviewPageToken>` and return HTTP 409
`{ error, detail, reloadRequired: true }` when the lease is stale
(`sendReviewPageConflict`, :1462). Handle 409 as "reload required" everywhere.*

| Endpoint | Method | Today | Target | Notes |
|---|---|---|---|---|
| `/api/fullfile?file=` | GET | **HTML** | **stays HTML** | diff rows (`renderFullFile`) — `dangerouslySetInnerHTML` |
| `/api/diff/split?file=` | GET | **HTML** | **stays HTML** | diff rows (`renderSplitHunks`) |
| `/api/diff/context?file=&…` | GET | **HTML** | **stays HTML** | hunk-gap expansion rows |
| `/api/story-drift/file?observation=&file=&layout=` | GET | **HTML** | **stays HTML** | drift diff rows |
| `/api/diff/file-panel?file=` | GET | **HTML** | **→ JSON** | `renderFilePanelResponse` (:1567) wraps *panel chrome* around rows. Split it: return the `FileView` from `buildReviewModel` as JSON plus a pre-rendered `rowsHtml` string. |
| `/api/review/step-panel?index=` | GET | **HTML** | **→ JSON** | `renderStoryStepResponse` (:1592). Same treatment: `StepView` as JSON, diff rows as an HTML string field. |
| `/api/review/trust` | GET | **HTML** | **→ JSON** | `renderTrustResponse` (:1617) — `TrustView` is already a view-model type |
| `/api/review/excluded-file?file=` | GET | **HTML** | **→ JSON** | `renderExcludedFileResponse` (:1662) — a safe-preview panel |
| `/api/review/file-search?q=` | GET | JSON | unchanged | `{ query, files: string[] }` |
| `/api/review/coverage` | GET | JSON | unchanged | verdict; re-checks the race after computing |
| `/api/review-state` | GET | JSON | unchanged | `ReviewStateSummary` |
| `/api/story-drift` | GET | JSON | unchanged | `StoryDriftView` |
| `/api/comments` | GET/POST | JSON | unchanged | server owns the `story` tag on POST |
| `/api/comments/<id>` | PATCH/DELETE | JSON / 204 | unchanged | |
| `/api/editor/open` | POST | JSON | unchanged | opens VS Code via the navigation bridge |
| `/api/events` | GET | **SSE** | unchanged | `EventSource`; **204** means the lease is dead — stop reconnecting (:364) |
| `/api/agents` | GET | JSON | unchanged | `{ agents, skills }` |
| `/api/codex/models` | GET | JSON | unchanged | `{ models }` |
| `/api/skills/update` | POST | JSON | unchanged | |
| `/api/generate` | POST | **NDJSON stream** | unchanged | drives the progress panel |
| `/api/story/repair` | POST | **NDJSON stream** | unchanged | drives the progress panel |
| `/api/aloud/status` | GET | JSON | unchanged | narration daemon |
| `/api/aloud/speak` `/prepare` `/control` | POST | JSON | unchanged | narration daemon |

**Payload**

```ts
import type { ReviewModel } from './view-model.js';
import type { Comment, ReviewFileIndexEntry } from './types.js';
import type { ReviewStateSummary } from './review-state.js';
import type { ReviewExclusionMetadata } from './noise.js';
import type { StoryDriftView } from './render.js'; // → move to types.ts before render.ts dies

export interface ReviewPayload {
  /** Absolute repo path. Used for display and for VS Code links only. */
  repo: string;
  repoName: string;
  routeBase: string;
  storyless: boolean;

  /** Everything the UI reads about the story + diff. Built by buildReviewModel(). */
  model: ReviewModel;

  baseLabel: string;
  headRef?: string;
  fileIndex: ReviewFileIndexEntry[];

  /** Lease identity — every lazy request must carry `?page=pageToken`. */
  pageToken: string;
  storyKey: string;

  reviewState: ReviewStateSummary;
  comments: Comment[];                 // already story-scoped
  excludedFiles: ReviewExclusionMetadata[];
  stagedWorktreeDivergentFiles: string[];
  storyDrift?: StoryDriftView;
  storyFreshness: 'current' | 'stale' | 'unverified';

  /** Chrome facts that must be right on first paint. */
  chrome: {
    openCount: number;
    blockingOpenCount: number;
    focusedStory: boolean;
    feedbackHealthy: boolean;
    feedbackRecovery: string;
    reviewClean: boolean;
    showTrustPill: boolean;
    trustPillClean: boolean;
  };

  /** Pre-rendered diff rows for the panels the shell ships eagerly. Empty when
   *  fileIndex is present (metadata-first), which is the normal case. */
  initialPanels?: { stepIndex: number; rowsHtml: string }[];
}
```

*Guess, flagged:* `initialPanels` is my proposal, not something the current code
has an analogue for. Today `renderPage` inlines step-panel 0 eagerly
(render.ts:258–:267) and lazy-loads the rest. Whether React should keep that
eager first panel or just fire `/api/review/step-panel?index=0` on mount is a
call for the review agent — measure it. If lazy is fine, delete the field.

*Also flagged:* `ReviewModel` on a large review is not small. The current page is
~300 KB of HTML; a JSON `ReviewModel` for a 300-step story could be comparable.
The metadata-first design (`files: []`, `detailedStepIndexes: new Set()`,
`detailedFilePaths: new Set()`) is what keeps it bounded today and **must be
preserved verbatim** in the rewrite. Watch payload size in the atlas run.

---

### 5.5 `progress` — the agent progress panel

**There is no route for this surface.** It is a panel mounted inside the review
page: `render.ts:348` emits `<div id="ds-agentpanel">${progressPanelMarkup('floating')}</div>`,
with styles at `:280` and script at `:438`. `src/progress-ui.ts` exports
`progressPanelStyles()`, `progressPanelMarkup(variant)` and
`progressPanelScript()` and nothing else.

It is listed as a surface because it gets its own bundle entry and its own
payload type, so the review page can code-split it and a future standalone
progress route needs no shell change.

**Data today:** none. The panel renders empty and fills from a stream. Its
entire state comes from the NDJSON body of:

| Endpoint | Method | Shape | Notes |
|---|---|---|---|
| `/api/generate` | POST | **NDJSON stream** (`application/x-ndjson`, `Cache-Control: no-cache`) | `runWorkflow` — server.ts:1949 |
| `/api/story/repair` | POST | **NDJSON stream** | `runStoryRepair` — server.ts:2193 |

Each line is a `ProgressEvent` (`src/progress.ts:34`), with `Phase`,
`ErrorStage`, `Workflow`, `FileAction`, `ActivityKind`, `RunStatus`, `PlanItem`
and `RunContext` as the supporting types. Those types are already exported and
already serializable — **the client should import them directly** rather than
restating them.

Related endpoints the launcher UI (not the panel itself) calls before starting a
run: `/api/agents` (GET, JSON), `/api/codex/models` (GET, JSON),
`/api/skills/update` (POST, JSON).

Per the live-progress protocol in project memory: reuse `src/progress.ts` +
`runWorkflow` + one shared `ProgressPanel` component. Honest progress only — no
bespoke consoles, no invented percentages.

**Payload**

```ts
import type { ProgressEvent, RunContext, Workflow } from './progress.js';

export interface ProgressPayload {
  /** 'floating' inside the review page; 'inline' if it ever gets its own route. */
  variant: 'inline' | 'floating';
  /** Endpoint the panel POSTs to. */
  endpoint: '/api/generate' | '/api/story/repair';
  workflow: Workflow;
  /** Present only when replaying/attaching to a run already in flight. */
  context?: RunContext;
  /** Events already observed, for a panel mounted after a run started. */
  replay?: ProgressEvent[];
}
```

*Guess, flagged:* `context` and `replay` do not exist today — the current panel
cannot survive a page reload mid-run. I am including them because the field is
cheap now and expensive to retrofit. If the progress agent decides reload-resume
is out of scope, drop both and the payload becomes `{ variant, endpoint, workflow }`.

---

## 6. Surprises worth flagging

1. **`style-src` blocks the external stylesheet.** Section 2, finding 1. Nothing
   works until that header changes.
2. **`/assets/client/*` is not routed.** Only mermaid and fonts are served today.
3. **The review page's data does *not* come from `view-model.ts` at the route.**
   `renderPage` builds the model itself. Five of the surface agents will read the
   design doc's "`view-model.ts` survives almost untouched" and assume the route
   hands them a `ReviewModel`; it does not, and the `buildReviewModelOptions` it
   passes (metadata-first, empty detail sets) are what keep large reviews fast.
   Copy them exactly.
4. **`review` and `diff` are the same surface.** `/repo/<n>/diff` is the review
   page with `storyless: true` and a synthetic empty `Tour`. One React entry,
   one payload, one `storyless` flag.
5. **The change page is the review page's error surface.** `reviewScreen` falls
   through to `changeScreen(session, params, notice)` for a missing or malformed
   story. The `notice` string is the only user-visible explanation.
6. **Three route handlers mutate session state as a side effect of rendering** —
   `stories` clears the story selection and persists that, `change` and `diff`
   clear it too, `change`/`diff` write the resolved scope onto the session. These
   are not incidental; `home-navigation.test.mjs` and `change-route.test.mjs`
   cover them.
7. **`?evidence=refresh` on the stories route** switches `listStoryMetadata` →
   `listStories`, which rebuilds the diff. Losing that distinction makes review
   history slow on every visit.
8. **Comment scoping is server-owned.** The story tag on a new comment is set
   from the *lease*, not from the client (`server.ts:714`). The React client must
   not send one.
9. **`/api/events` returns 204, not an error, for a dead lease** — deliberately,
   so `EventSource` stops reconnecting. Any replacement client must not retry.
10. **Four HTML-fragment endpoints stay HTML forever** (`/api/fullfile`,
    `/api/diff/split`, `/api/diff/context`, `/api/story-drift/file`) because
    `diff-render.ts` / `highlight.ts` / `intra-line.ts` keep emitting rows. Four
    others become JSON. Getting this split wrong in either direction is the
    single most likely source of rework.
