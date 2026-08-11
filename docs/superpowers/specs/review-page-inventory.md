# Review page — behavioural inventory

Date: 2026-08-09
Status: Reference for the React + beUI rewrite (`2026-08-09-beui-react-rewrite-design.md`)
Scope: **the review page only**. The picker, story picker, change page, and progress
panel are covered by `surface-inventory.md` and are deliberately out of scope here.

Sources read: `src/render.ts` (2403 lines), `src/page-assets.ts` (3763 lines —
`PAGE_CSS`, `PAGE_JS = PAGE_JS_HEAD + DIFF_JS + PAGE_JS_TAIL`), `src/diff-assets.ts`
(`DIFF_CSS`, `DIFF_JS`), `src/diff-render.ts`, `src/view-model.ts`, `src/highlight.ts`,
`src/intra-line.ts`, `src/live.ts`, `src/session.ts`, `src/server.ts` (routes),
and the test oracles named in each section.

Notation: **[INFERENCE]** marks a conclusion drawn from reading rather than an
assertion the code or a test states directly.

---

## 0. Entry points and page shells

Two server routes render the *same* page component (`renderPage()` in
`src/render.ts:135`):

| Route | Server fn | `storyless` | Initial view |
|---|---|---|---|
| `GET /repo/<name>/review` | `reviewScreen()` (`server.ts:~1140`) | `false` | Story |
| `GET /repo/<name>/diff` | `diffScreen()` (`server.ts:~912`) | `true` | Files (forced by client `init()`) |

`/review` and `/change` at the root redirect into the `/repo/<name>/…` form.

Both call `issueReviewPageLease()` and `cacheReviewPageSnapshot()`, and both pass
`fileIndex: boundedReviewIndex(fileIndex)`. **Because `fileIndex` is always present
on the real routes, `renderPage` renders *every* story step as a lazy stub** (the
`!input.fileIndex && i === 0` branch that would inline step 1 is dead in
production). Only the Overview panel is server-rendered inline.

Security headers set on every response (`setLocalResponseHeaders`, `server.ts:305`):
`default-src 'none'; base-uri 'none'; connect-src 'self'; font-src 'self';
form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; media-src 'self'
blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'`, plus
`Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: no-referrer`,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`. Requests are gated by
`isTrustedLocalRequest` (localhost + same-origin `Origin` when present).

### `<body>` attribute contract

`renderPage` writes every page-level fact onto `<body>`. The client reads these
constantly; in React they become props/context, but the *values* must survive.

| Attribute | Value | Read by |
|---|---|---|
| `class="ds-map-bg"` + `ds-overview-active` | overview active marker | CSS |
| `data-storyless="1"` | storyless page | `init()` → forces Files view |
| `data-read-view` | `tour` \| `files` \| `review` | `currentView()`; server paints the honest first value |
| `data-story-freshness` | `current` \| `stale` \| `unverified` | `refreshCount()`, `setLiveIssue('story')` |
| `data-feedback-health` | `healthy` \| `invalid` | `refreshCount()`, `refreshReviewState()` |
| `data-story-scope="focused"` | story excluded some files | `refreshCount()` clean-state gate |
| `data-repo` | absolute repo path | — (diagnostic) |
| `data-viewed-scope` | `` `${repo}|${scopeKey||baseLabel}|full` `` | `viewedKey()` |
| `data-review-scope` | `reviewState.scopeKey` | `reviewUiKey()`, `challengeKey()`, `exclusionsAckKey()`, `refreshReviewState()` |
| `data-story-key` | `pageLease.storyIdentity` | `reviewUiKey()` — **the fix from commit 2156520** |
| `data-current-diff-hash` | `reviewState.currentDiffHash` | `challengeKey()`, `exclusionsAckKey()`, `refreshReviewState()` |
| `data-review-page-token` | opaque lease token | `reviewPageUrl()`, `startLiveEvents()` |
| `data-live-diff-stale` | `0` \| `1` (client-written) | `refreshCount()` |
| `data-initial-view` | *never rendered* — read by `init()` | dead hook **[INFERENCE]** |

Runtime body classes: `ds-rail-collapsed`, `ds-selecting-left` / `ds-selecting-right`,
`ds-resizing`, `ds-sidebar-resizing`, `ds-noscroll` (modal scroll lock),
`ds-aloud-active`, `ds-story-reload-pending`, `ds-overview-active`.

---

## 1. Region map (visual order)

### 1.1 `<head>` bootstrap
Inline `themeBootstrapScript()` (must stay inline — prevents FOUC), brand font
links, `<style>${PAGE_CSS}${progressPanelStyles()}</style>`. Title is
`diffStory — <story title>` or `diffStory — Reviewing the diff` (storyless).

### 1.2 Header chrome — `header.ds-reviewchrome`
Two rows: a narrow rail (`.ds-reviewchrome-rail`) and the main bar.

* **Sidebar toggle** `[data-sidebar-toggle]` — duplicated in the rail and in
  `.ds-reviewchrome-mobile-nav`. `aria-expanded`, `aria-label`/`title` flip between
  "Collapse sidebar" / "Expand sidebar".
* **Close story** `a.ds-back[data-close-story]` → `${routeBase}/stories`. Plain link.
* **Title block** — `.ds-title` reads literally "Diff review"; the story title is
  only in the `title=` tooltip and the document title. Subtitle:
  `Working tree vs <baseLabel>`.
* **View tablist** `.ds-viewtoggle[role=tablist]` with three
  `button.ds-tab[role=tab][data-view]`: `tour` (Story), `files` (Files),
  `review` (Review). Roving `tabindex`, `aria-controls` → `#ds-view-{tour,files,review}`.
  * The Review tab carries the whole page's decision signal:
    `data-review-status`, `data-unexplained-count`, `data-excluded-count`,
    `data-index-divergence-count`, `data-story-freshness`, a composed `aria-label`
    (rebuilt client-side by `refreshCount()` — the two strings **must stay in step**),
    a `▲` flag `[data-review-flag]`, and a badge `#ds-open-count` with the queued count.
* **Theme control** — `themeControl()` from `src/theme.ts` (`ds-theme` localStorage
  key, `data-theme` / `data-theme-mode` on `<html>`, `ds-theme-change` document event).
* **Reload diff** `[data-reload-diff]` — storyless pages only. Disables itself,
  sets `aria-busy`, swaps the label to "Reloading", then `location.reload()`.

**States:** no loading or error state; always present.

### 1.3 Live banner — `.ds-live-banner[data-live-banner]`
`role="status" aria-live="polite" aria-atomic="true"`, `hidden` by default.
Two kinds in priority order: `diff` ("Diff changed.") then `disconnected`
("Live updates interrupted."). Actions: `[data-live-reload]` (reload) and
`[data-live-dismiss]` (dismisses *this generation* of the current kind only —
a later re-fire re-shows it). CSS must not move document flow
(`ui-layout` / `render-page.test.mjs:2763`).

### 1.4 Story-reload toast — `.ds-story-reload-toast`
Appears when a `story-changed` live event fires: "Story updated. Reloading in 10
seconds." with `[data-story-reload-cancel]`. 10 000 ms timer; cancel toasts
"Automatic reload cancelled."

### 1.5 Agent panel host — `#ds-agentpanel`
Contains `progressPanelMarkup('floating')`, hidden until a story repair or
storyless story generation runs. Owned by the progress-panel inventory; the
review page only mounts it and drives `ProgressPanel` for `repairStory()` /
`generateStory()`.

### 1.6 Sidebar — `aside.ds-rail` (`aria-label="Review navigation"`)
Width is `--ds-rail-width` on `<body>` (default 316px, clamped 240…min(560, vw−360)).

1. **Resume button** `[data-resume-review]` — `hidden` unless a stored position
   exists **and** the current view is Files. Label: "Resume at `<file>`" or
   "Resume at story step N".
2. **Intro card** `introCard()` — `.ds-stepcard.is-intro[data-intro][data-step-index="0"]`,
   "Overview / The change at a glance · N steps".
3. **Reading-order head** `[data-rail="tour"]` — label, `#ds-progress-text`
   ("Overview" or "i / steps"), and `#ds-progress-fill` (a `scaleX()` bar).
4. **Files head** `[data-rail="files"]`, hidden in Story view — file count,
   `[data-viewed-progress]` ("n of m reviewed"), a search input
   `[data-file-search]`, a `<details>` filter menu with six buttons
   (`all`, `reviewed`, `unreviewed`, `comments`, `unexplained`, `tests`), and
   `[data-next-unviewed]`.
5. **Rail scroll** — `.ds-railsteps[data-rail="tour"]` (spine + step cards) and
   `.ds-railfiles[data-rail="files"]` (file tree).
6. **Resizer** `[data-sidebar-resizer][role=separator][aria-orientation=vertical]`
   with `aria-valuemin/max/now`, `tabindex=0`.
7. **Scrim** `button.ds-rail-scrim[data-sidebar-scrim]` — compact-screen overlay close.

**Story rail cards** (`storyRail`): ≤ 10 steps → one `railCard` per step with its
full beat tree (`.ds-railbeats`, `[data-rail-beat]` buttons, `[data-rail-current]`
counter, `storyRepairMenu`). **> 10 steps → chapters**: `<details class="ds-railchapter">`
grouped by `step.chapter` (or fixed groups of 6 labelled "Start here" /
"Follow the flow · N" / "Boundaries and proof"), **and beat trees are dropped**
(`includeBeats=false`). This is an explicit performance measure — the comment says
a 245-step story otherwise puts ~1 MB of narration in the initial DOM.

**File tree** (`railFileTree`): nested `<details class="ds-filetree-dir">` (open by
default) with per-directory counts, `+`/`−` stats, and a `▲` unexplained flag.
Leaves are `button.ds-fileitem` carrying `data-file-index`, `data-file-path`,
`data-goto-file`, `data-review-hash`, `data-filter-path` (path + symbols,
lowercased), `data-filter-status`, `data-filter-test`, `data-filter-comments`,
`data-filter-unexplained`, `data-filter-since`, `--tree-indent`. The `sinceFiles`
argument is always `[]` — `data-filter-since` is dead **[INFERENCE]**.

**Empty states:** no files → `.ds-empty.ds-empty-rail` "No files in this change.";
excluded-only scope → `excludedScopeNotice(files, compact=true)`, a list of
`[data-goto-review="exclusions"][data-goto-excluded="<path>"]` buttons.

### 1.7 Main — Story view `#ds-view-tour[role=tabpanel]`

**a) Overview panel** `section.ds-step.is-intro[data-step-panel="0"]`
(`introPanel()`), or `generateCta()` when storyless.

Storyful: eyebrow + brand mark, `h1.ds-intro-title` (story title HTML),
`p.ds-intro-lede[data-speech-overview][data-speech-text]` (recovered intent goal,
else summary, else a generic line), a freshness note, "Start the walkthrough"
`[data-goto-step="1"]`, a utility row with the scope text, a "Review notes"
`<details>` (author hotspots `[data-goto-step]` + design/map/non-goals), and
"All files" `[data-open-all-files]`.

Freshness note is one of: nothing (current, no drift), `driftStatus()` —
`.ds-intro-freshness.is-current` "Story current" or a
`button[data-drift-open]` "Story needs refresh · N story files + M side files
changed / See changes →" — or a static `▲ Story is out of date` /
`▲ Freshness unverified` with a `Regenerate` link to `/change`.

Storyless: `generateCta()` — facts row, then the whole story-generator card
(depth radiogroup, writer/quality radiogroups filled from `/api/agents` and
`/api/codex/models`, reviewer-note textarea, file-scope `<details>` with search,
`data-story-scope-action` chips and per-extension chips, and
`[data-generate-story]`). Excluded-only scope replaces the card with
`excludedScopeNotice(files, compact=false)`.

**b) Step panels** — one `section.ds-step[data-step-panel="i+1"][data-step-id]` per
step, all `hidden` except the active one. In production every one is the lazy stub:

```html
<section class="ds-step ds-step-lazy is-code-step|ds-concept-step"
         data-step-panel="N" data-step-id="…" data-step-lazy="1" hidden>
  <div class="ds-sr-only" data-step-speech-cache>…speech projections…</div>
  <div class="ds-step-loading" role="status">Loading this review step…</div>
</section>
```

The `[data-step-speech-cache]` block carries `[data-speech-beat]` /
`[data-speech-concept]` / `.ds-why-text` nodes with `data-speech-text`, so narration
can plan a whole story without loading a single panel. **This is load-bearing for
Aloud sequencing and easy to drop.**

*Loaded code step* (`codeStepPanel`, also what `/api/review/step-panel` returns):
`.ds-step-top` (step count · kind badge · optional call-flow chip · title ·
`storyRepairMenu`), optional `.ds-hotspot-flag`, then
`.ds-diffscroll > .ds-diff[data-diff][data-story-diff][data-file][role=region]`
containing `.ds-difftoolbar` (All-files button, `changeJumpControls()`,
`.ds-modetoggle` with Unified/Split/Full-file), then three siblings:
`[data-diff-inner] hidden` (unified, pre-rendered), `[data-split-inner] data-loaded="1"`
(split, pre-rendered — **story steps never fetch split**), `[data-full-inner] hidden`.
Finally `stepStoryHtml()` emits the beat dock (see 1.8).

*Loaded concept step* (`conceptStepPanel`): step meta, `.ds-concept-scroll >
article.ds-concept-document` with eyebrow, title, `.ds-concept-body.ds-md`
(server-sanitized block-tier narrative HTML), an optional Mermaid figure
(section 12), an optional "Next in code" `[data-goto-step]` button, and an
`.ds-sr-only[data-speech-concept]` node.

*Error state*: `loadStoryStep` failure replaces the panel with
`.ds-step-loaderror[role=alert]` + a `[data-retry-story-step="N"]` button, or a
`[data-review-reload]` button on HTTP 409.

**c) Filmstrip dock** — `filmstripThread()`, one floating island:

```html
<div class="ds-dock" data-story-dock>
  <div class="ds-dock-transport">
    <div class="ds-narration" data-narration> … [data-readaloud] … [data-aloud-stop] </div>
    <div class="ds-dock-stage" data-dock-slot><p data-dock-idle>Overview</p></div>
  </div>
  <nav class="ds-filmthread is-overview" data-filmthread aria-label="Reading order"
       style="--thread-pct:0%">
    <div class="ds-filmthread-scroll">
      <div class="ds-filmthread-nodes"><div class="ds-filmthread-line"></div>…nodes…</div>
    </div>
    <span class="ds-filmthread-tooltip" data-filmthread-tooltip aria-hidden="true"></span>
  </nav>
</div>
```

Nodes: `button.ds-filmnode[data-thread-node="i"][data-goto-step="i"]`; node 0 is
`.is-overview` with a `◆` glyph, nodes 1..N carry zero-padded numerals and the
step title as label + `aria-label`. The dock stage **adopts** each step's own
`[data-beat-dock]` element out of its panel (`adoptStepDocks()`), so at runtime the
beat dock is a child of the island, not of the step section. `beatHost(panel)` and
`beatPanel(node)` are the two bridges across that move.

Storyless: `storylessThread()` renders nothing unless the scope is excluded-only,
in which case it renders a single "Review excluded file →" button.

### 1.8 Beat dock — `[data-beat-dock][data-dock-step="N"]`
Rendered inside each code step by `stepStoryHtml()`, adopted into the island.

* No beats → `.is-single`: "Review note" + `.ds-why-text[data-speech-text]`.
* Beats → counter `[data-beat-current]` / total, `.ds-beats` containing one
  `button.ds-beat.ds-beatdock-note[data-story-beat]` per beat with
  `data-speech-beat`, `data-focus-group`, `data-speech-text`,
  `data-focus-destination` ("file.ts, lines 3 to 9"), `aria-controls` → the diff
  region id, `aria-pressed`; prev/next `[data-beat-move="-1|1"]`; and an
  `.ds-sr-only[data-story-focus-status][aria-live=polite][aria-atomic=true]`
  live region.

### 1.9 Main — Files view `#ds-view-files[role=tabpanel]`
`.ds-filedetail#ds-file-detail` holding one
`section.ds-filepanel[data-file-panel="i"][data-file][data-review-hash]` per file
(plus `data-newfile="1"` / `data-context-file="1"`). All but index 0 are `hidden`;
**every one ships as a stub**:

```html
<div class="ds-filepanel-loading" data-file-panel-lazy role="status">Loading file review…</div>
```

`renderFilePanelContent()` (served by `/api/diff/file-panel`) fills it with:
`.ds-filepanel-head` (path, `changeJumpControls()`, `[data-viewed-toggle]`,
`.ds-modetoggle`) and `.ds-filepanel-body` with `[data-diff-inner]` (unified rows,
server-rendered), `[data-split-inner]` (placeholder "Loading the split view…", **no
`data-loaded`** → fetched on demand), `[data-full-inner] hidden`.

Mode toggle varies by file kind:
* context-only file → Unified (active) + Full file if available. **Split is not offered.**
* changed file with `hasFull` → Unified / Split (active) / Full file.
* changed file without `hasFull` → Unified / Split (active).
* no hunks → no toggle.

**Empty states:** no files → `.ds-empty` "No files in this change."; excluded-only →
`excludedScopeNotice(files, false)`. Panel error → `.ds-filepanel-loaderror[role=alert]`
+ `[data-retry-file-panel]` or `[data-review-reload]`.

### 1.10 Main — Review view `#ds-view-review[role=tabpanel]`
`reviewPanel()` renders `.ds-reviewpage[data-review-tab="coverage"]`:

1. **Pinned summary** `.ds-reviewsummary[data-review-section="status"]` — queued
   count, an optional `.ds-feedback-health-alert[role=alert]`, and the **trust pill**.
2. **Sub-tablist** `.ds-reviewtabs[role=tablist]` with four
   `[data-review-tab-select]` tabs: `coverage`, `notes` (Comments), `challenge`,
   `actions`. Coverage carries `[data-coverage-flag]`; notes carries
   `[data-review-open-notes]`.
3. **Coverage panel** — `renderTrustEvidence()` (section 1.11).
4. **Comments panel** — head with `[data-queue-summary]` and
   `[data-copy-comments="queued"]`, then `.ds-feedback-list[data-feedback-view="feedback"]`
   containing `feedbackGroups()`: one `section.ds-feedback-group` per file, each
   holding `article.ds-feedback-card[data-feedback-card][data-feedback-anchor]
   [data-comment-id][data-comment-file][data-comment-line][data-comment-step]`.
   Card body: flavor icon/label, `file:line`, an anchor badge
   (`current` / `moved` / `changed` / `old-side` / `legacy`, computed server-side by
   re-reading the working-tree file and searching for `selectedText`), an optional
   "Commented on / Current region" comparison, the markdown-rendered message, a
   hidden `[data-comment-editor]` (flavor `role=group` + `[data-edit-body]` textarea
   + Cancel/Save), and actions `[data-goto-comment]` / `[data-edit-comment]` /
   `[data-remove-comment]`.
   **Empty:** `.ds-drawer-empty` "No queued comments. Select code in the diff and press C."
5. **Challenge panel** — `challengeChecklist()`: four generic checkboxes
   (`intent`, `failure`, `boundary`, `tests`) via `[data-challenge-check]`, plus up
   to five `[data-goto-step]` "Steps to re-read" buttons.
6. **Actions panel** — currently a single link to `${routeBase}/stories`.

**Trust pill** `.ds-trustpill[data-goto-review][data-trust-excluded][data-trust-focused]`
— one of six states in strict precedence:
`divergent` → `excluded` (storyless only) → `stale` → `pending` → `uncovered` → `clean`.
`pending` renders `◌ Checking coverage…` with `[data-trust-pill-text]` and class
`is-unknown`; the client resolves it after first paint. The pill's
`data-goto-review` target follows its verdict (`staged` / `exclusions` /
`unexplained` / `evidence`).

### 1.11 Trust evidence — `renderTrustEvidence()`
Wrapper `div.ds-trust-evidence[data-trust-evidence][data-trust-pending]
[data-trust-uncovered][data-trust-storyless]`. An **empty** `data-trust-uncovered`
means "no verdict" and the client must leave the pill alone.

Sections (each `[data-review-section]`, `tabindex="-1"`, own heading):
* `evidence` — "Coverage": two stat tiles (covered lines / unexplained changes),
  a verdict line, and a footnote. Pending and storyless suppress the stats.
* `unexplained` — only when there are uncovered ranges and coverage is resolved.
  Per-file `[data-goto-file]` buttons, then a **closed** `<details>`
  `[data-unexplained-disclosure]` holding one `trustCard()` per uncovered range
  (unified diff rows + `[data-goto-step]`/`[data-goto-file]` jump + `[data-explain]`).
* `staged` — index/working-tree divergence cards. Approval-blocking.
* `exclusions` — one `article.ds-exclusion-card[data-excluded-file]` per excluded
  file with `[data-inspect-excluded]` and a `[data-excluded-preview]` slot, plus an
  `[data-exclusions-ack]` acknowledgement checkbox.

### 1.12 Drift drawer — `#ds-drift-drawer.ds-drawer-root`
Rendered only when a drift report exists with files. Scrim `[data-drift-close]`,
`div.ds-drawer[role=dialog][aria-modal=true][aria-labelledby=ds-drift-title]`,
a file list of `button.ds-drift-file[data-drift-file][data-drift-label]
[data-drift-detail][aria-pressed]`, and a detail pane with `[data-drift-back]`,
`[data-drift-selected-path][aria-live=polite]`, `[data-drift-preview]`.
Carries `data-drift-observation`.

### 1.13 Command palette — `[data-command-root]`
`div.ds-command[role=dialog][aria-modal][aria-labelledby=ds-command-title]
[aria-describedby=ds-command-description]`, a **non-focusable** scrim
(`div`, not `button` — asserted), a close button, and six `[data-command]` rows:
`story`, `files`, `review`, `next-unviewed`, `toggle-viewed`, `read-aloud`.
Footer legend: `← →` changes/narration, `C` comment selection, `?` commands.
No `[data-shortcuts-open]` element exists in the markup — the handler is
reachable only via `?` **[INFERENCE: dead hook]**.

### 1.14 Selection menu / toast / noscript / data script
* `.ds-selection-menu[data-selection-menu][role=menu]` with one
  `[data-selection-comment][role=menuitem]` "Comment selected code".
* `#ds-toast[role=status][aria-live=polite][aria-atomic=true][aria-relevant="additions text"]`
  — escalates to `role=alert` / `aria-live=assertive` for errors, auto-hides at 4200 ms.
* `<noscript>` fallback.
* `<script type="application/json" id="ds-initial-comments">` — the **open**
  comments only, escaped through `jsonForDataScript()` (`&`, `<`, `>`, U+2028/9).
* Inline `<script>${progressPanelScript()}</script>` then `<script>${PAGE_JS}</script>`.

---

## 2. The step / walkthrough model

### 2.1 Sequencing
`buildReviewModel()` orders steps (`orderedSteps(tour)`). `model.steps` is a mixed
list of `CodeStepView` and `ConceptStepView`. Navigation is **0-based with the
Overview as index 0**, so `model.steps[i]` renders at panel index `i + 1`.
`stepIndexById` (`Map<stepId, i+1>`) is the single source for every `[data-goto-step]`.

Client: `stepPanels = $all('.ds-step')` — index 0 is the Overview panel;
`total = stepPanels.length || 1`; `active` is the current index; `visited` is a
`{index: true}` map driving `.is-visited`.

### 2.2 Code step vs concept step

| | Code step | Concept step |
|---|---|---|
| Panel class | `.ds-step.is-code-step` | `.ds-step.ds-concept-step` |
| Body | diff (`.ds-diffscroll > .ds-diff`) | prose `article.ds-concept-document` |
| Kind badge | `Changed` / `New file` / `Context` | `Concept` |
| Beats | `[data-beat-dock]` with `[data-story-beat]` | none |
| Speech units | per-beat `[data-speech-beat]`, else `.ds-why-text` | one `[data-speech-concept]` |
| Focus rows | `[data-step-focus="g"]` on diff rows | n/a |
| Diagram | n/a | optional Mermaid figure |
| Rail card | file base name + kind badge | "Concept primer" |
| Extra | `data-story-focus="authored"` when `focusExplicit` | `.ds-concept-next[data-goto-step]` |

`data-story-focus` is the gate for `selectStoryFocus()` — a step without it never
enters focus mode.

### 2.3 Navigation
`setActive(i, autoSpeak)` is the user-driven entry point:
1. Clamp to `[0, total-1]`, call `markResumeMoved()` (invalidates a paused Aloud job).
2. If the target panel is `[data-step-lazy]`: `activateStep(i, false)` immediately
   (shows the skeleton), then `loadStoryStep(i, cb)`; on success and if still
   active, `activateStep(i, autoSpeak)` **and prefetch `loadStoryStep(i+1)`**.
3. Otherwise `activateStep(i, autoSpeak)` and, for `i > 0`, prefetch `i+1`.

`activateStep(i, autoSpeak)`:
* `runWorkspaceTransition('step', i > previous ? 1 : -1, update)` (view transition,
  see section 11) wrapping: panel visibility, rail card `is-active`/`is-visited`
  and stable zero-padded numbers, `[data-story-step-node]` active class, opening the
  owning `[data-story-chapter]` details, `syncDockStage()`, `[data-thread-node]`
  active/visited, `ds-overview-active` body class, filmstrip fill + horizontal
  auto-scroll centring, `syncActiveAnnotations()`.
* Outside the transition: `#ds-progress-text` ("Overview" or `i / steps`),
  `#ds-progress-fill` `transform: scaleX(ratio)`, reset `tourView.scrollTop` and
  panel scrollTop, `renderConceptDiagrams(panel)`, `applyResponsiveStoryMode(panel)`,
  `watchStickyMetrics()`, `prepareStepNarration(i===0?1:i)`, `clearStoryFocus()` at 0,
  `selectStoryFocus(i, 0, true)` else `jumpToFirstChange()`, then `speakStep(i)`
  when `autoSpeak !== false`, then `saveReviewPositionSoon()`.

Entry points into `setActive`: `.ds-stepcard` click, `[data-goto-step]` click,
`[data-thread-node]` (filmstrip) click, `j`/`k`, `[data-move-target-step]` callouts,
`gotoComment()` when the comment carries a `step`, `advanceAfterSpeechStep()` from
narration, and `focusStoryStepBoundary()` from beat overflow.

### 2.4 Filmstrip ↔ steps
`[data-thread-node="k"]` maps 1:1 to `stepPanels[k]`; node 0 is the Overview.
`syncFilmProgress()` measures the active node's rendered centre against
`.ds-filmthread-nodes` and writes `--thread-pct` in **pixels** (the attribute's
initial server value is `0%`). A `ResizeObserver` on `.ds-filmthread-nodes` keeps
it correct through zoom/layout changes. Hover/focus shows
`[data-filmthread-tooltip]` positioned via `--ds-film-tooltip-x`. Pointer-move
applies a macOS-dock magnification (`--ds-dock-scale`, `--ds-dock-lift`,
smoothstep over a 96px radius), disabled under reduced motion and on
`(hover:none),(pointer:coarse)`.

### 2.5 Persisted reading position — the per-story key

```js
function reviewUiKey(){
  return 'ds-review-ui:'
    + (document.body.getAttribute('data-review-scope')
       || document.body.getAttribute('data-viewed-scope') || '')
    + ':' + (document.body.getAttribute('data-story-key') || '');
}
```

* **Storage:** `localStorage`, JSON value.
* **Scoping rule (commit 2156520):** scope key **plus** `data-story-key`, which the
  server sets to `pageLease.storyIdentity`. Several stories — and every regeneration
  of one — share one `base..head` scope, so scope alone replayed one story's position
  into another. `data-review-scope` is the primary; `data-viewed-scope` is a fallback
  when the scope key is empty.
* **Value:** `{ view, step, file, scroll, reviewTab }` where `scroll` is
  `#ds-file-detail.scrollTop` in Files view or the active step's
  `.ds-diffscroll` scrollTop in Story view.
* **Write:** `saveReviewPositionSoon()` — 90 ms debounce; suppressed while
  `restoringReviewPosition` or before `reviewPositionReady`. Triggered by
  `setView`, `setActive`/`activateStep`, `selectFile`, `setMode`,
  `setReviewTab`, and a capture-phase `scroll` listener on `document`.
* **Read:** `restoreReviewPosition()` runs once in `init()` right after
  `reviewPositionReady = true`; also re-invoked by `[data-resume-review]`.
  Review view restores the tab; Files restores file + scrollTop on the next tick;
  Story calls `setActive(step, false)` (silent) then restores scrollTop.
* `revealResumeReview()` shows the Resume button **only in Files view**, with the
  label from `describeReviewPosition()`.

Test oracle: `comments-client.test.mjs:155` asserts `reviewUiKey` mentions
`data-story-key`.

---

## 3. Diff rendering modes

### 3.1 Modes and how they are chosen
Three modes, driven by `.ds-modetoggle button[data-mode="diff|split|full"]` and
`setMode()` in `DIFF_JS`:

* **Unified** (`diff`) — `[data-diff-inner]`, always server-rendered inline.
* **Split** (`split`) — `[data-split-inner]`. Pre-rendered with `data-loaded="1"`
  for story steps; **lazy** (`/api/diff/split`) for All-files panels.
* **Full file** (`full`) — `[data-full-inner]`, always lazy (`/api/fullfile`).

Selection rules:
* Story steps default to **Split** (server-rendered `is-active`), except context /
  new-file steps which render a single-column body.
* All-files panels: `applyFilesMode()` picks `localStorage['ds-files-mode']`, else
  `compactScreen() ? 'diff' : 'split'`; a `[data-context-file]` panel is always forced
  to `diff`. This call uses `{persist:false}` so it does not rewrite the preference.
* `applyResponsiveStoryMode()` forces a story step to Unified on compact screens
  **unless** the holder has `data-mode-user-set="1"` (set by a real user click on
  `[data-mode]` inside `[data-story-diff]`).
* Persistence: `setMode` writes `ds-files-mode` only for `.ds-filepanel` holders and
  only when `persist !== false`. Story-step mode is never persisted.

Mode switching runs through `runWorkspaceTransition('mode', 0, update)` unless
`persist === false`, then `updateChangeNav`, `jumpToFirstChange`, and
`scheduleAnnotations` (split) or `clearAnnotations()`.

### 3.2 Resizable before/after divider
* CSS variable `--ds-split` (percentage, default 50) on the `.ds-filepanel` /
  `.ds-diff` holder, clamped to **22…78**.
* Drag: `mousedown` on `.ds-celldiv` (`startSplit`) → `mousemove` batched through
  `requestAnimationFrame` (`moveSplit` / `applySplitResize`) → `mouseup` (`endSplit`)
  persists to `localStorage['ds-split']`. `body.ds-resizing` during the drag.
  Each move also calls `scheduleAnnotations()`.
* Keyboard: `prepareSplitDivider()` promotes the **first** `.ds-celldiv` in the
  visible diff root to `role="separator"` with `aria-orientation=vertical`,
  `aria-valuemin=22`, `aria-valuemax=78`, `aria-valuenow`, `aria-valuetext`
  ("62% before, 38% after"), `aria-keyshortcuts="ArrowLeft ArrowRight Home End"`,
  `tabindex=0`; every other divider is `aria-hidden`, `tabindex=-1`, roles stripped.
  Arrow = ±4 (±10 with Shift), Home = 22, End = 78; persists to `ds-split`.
* On load and after every lazy insertion, the stored `ds-split` is re-applied to
  `.ds-filepanel,.ds-diff` holders.

### 3.3 Hunk gaps and context expansion
`renderHunkGap(gap?, opts)` in `diff-render.ts`:
* **Bare** (no `GapInfo`): `.ds-hunkgap` (or `.ds-hunkgap-split` with three spans)
  containing only `⋯`. Not expandable.
* **Expandable**: `.ds-hunkgap.is-expandable[data-gap][data-gap-file][data-gap-from]
  [data-gap-to][data-gap-chunk]` with `[data-expand="up|down|all"]` buttons.
  Chunk size: **20** unified, **5** split. `data-gap-to` may be the literal `eof`,
  which suppresses the `up` button.
  `opts.edge === 'before'` suppresses the `down` button.

`expandGap(btn)` in `DIFF_JS`: computes `[rf, rt]` from mode + chunk, disables all
`.ds-gapbtn`s, sets `aria-busy`, fetches `/api/diff/context?file=&from=&to=&layout=`,
requires the response's first element to have `data-ctx-rows`, reads
`data-from`/`data-to` (the range actually served), calls `mountThreads(wrap)`,
inserts the rows before (`down`/`all`) or after (`up`) the gap, then either removes
the gap (`all`, or exhausted) or narrows `data-gap-from` / `data-gap-to`.
Error → `.ds-gaperror[role=alert]` with a `[data-expand]` retry (or
`[data-review-reload]` on 409); focus is restored to the retry button if focus was
inside the gap.

Where expandable gaps appear:
* Story split view: `viewportBefore` (from 1 to `viewport[0]-1`, `edge:'before'`)
  and `viewportAfter` (from `viewport[1]+1` to `eof`), only when the step is not
  context, not a new file, not a paired view, and `viewport[0] > 0`.
* All-files unified: between hunks and after the last hunk (`eof`), only when
  `f.kind !== 'context' && f.hasFull`. **A new file gets no trailing eof gap.**
* `renderSplitHunks` mirrors the same rules for the lazy split body.
* Story unified inner and non-expandable cases use bare gaps.

### 3.4 Full-file view
`/api/fullfile?file=` → `renderFullFile(rows, opts)`: `splitHead()` + `.ds-diffbody`
of `fullRow()`s (split layout, intra-line applied). Empty →
`.ds-diffnote` "Couldn't read `<file>` from the working tree."
The toolbar hint (`[data-difthint]`) swap to "Complete file" targets an element that
render.ts never emits **[INFERENCE: dead]**.

### 3.5 Intra-line highlighting
`intraLineMap(rows, getType, getContent)` (`src/intra-line.ts`) pairs each run of
consecutive `del` rows with the following run of `add` rows positionally, token-diffs
each pair with an LCS over `highlight.ts` tokens, and marks off-subsequence
non-whitespace tokens with the `changed` class. Below a **0.3** similarity threshold
the pair is skipped and the caller falls back to whole-line tint. Whitespace-only
tokens are never marked. `del` rows consume `sides.left`, `add` rows `sides.right`.
Single-cell rows (context / new-file steps) deliberately take **no** intra data.

Oracle: `intra-line-render.test.mjs`.

### 3.6 Syntax token classes
`src/highlight.ts` emits `<span class="tk-*">`:

| Class | Meaning |
|---|---|
| `tk-c` | comment (`//`, `/* */`) |
| `tk-s` | string (`"` `'` `` ` ``) |
| `tk-n` | number (incl. hex, `_` separators, exponent) |
| `tk-k` | keyword (JS/TS + Solidity keyword set) |
| `tk-t` | type-ish (identifier starting with a capital) |
| `tk-f` | call-ish (identifier immediately followed by `(`) |
| *(none)* | plain identifier, whitespace, operator |
| `changed` | added by intra-line diff, alone or appended to a `tk-*` class |

`highlightNavigable()` is used for the **right/after side only** and additionally
stamps every non-keyword identifier with `data-vscode-symbol` and a 1-based
`data-vscode-column`, plus `title="Open implementation in VS Code (Command/Ctrl-click)"`.

---

## 4. The `data-*` contract on diff rows — **the critical output**

Everything below is emitted by `src/diff-render.ts` (plus small injections from
`render.ts`) and read by the delegated document-level handlers in `PAGE_JS` /
`DIFF_JS`. In the rewrite these strings are injected with
`dangerouslySetInnerHTML`, so **React must not own any of it** — one delegated
handler on the container reads these attributes.

### 4.1 Row element — `div.ds-row` (split) / `div.ds-urow` (unified)

| Attribute | Emitted when | Value | Read by |
|---|---|---|---|
| `data-review-row` | any row with a comment target | boolean | CSS focus ring; `diff-client.test.mjs` |
| `data-file` | target present | post-change path (`del` rows use the *old* path) | `buildComposer`, `openMoveTargetFile` |
| `data-line` | target present | integer line number | `buildComposer`, `openComposer` guard, `openMoveTargetFile` |
| `data-side` | target present | `left` \| `right` | `buildComposer`, `openMoveTargetFile` selector |
| `data-step` | split story rows (target + `stepId`); injected into unified story rows by `storyUnifiedRow`'s regex rewrite | step id | `currentSelectionContext`, `focusedRowContext`, `buildComposer` |
| `data-step-focus` | story rows inside a focus group | integer group index | `focusGroupsForPanel`, `focusRowsForGroup` |
| `data-move` | split story rows overlapping a logic-move endpoint | space-separated `"<moveId>:before"` / `"<moveId>:after"` tokens | `moveEndpointRows` (annotation geometry) |
| `data-annot-tag-lanes` | **client-written** | lane count; paired with `--ds-annot-tag-space` | `prepareAnnotationTagLanes`, CSS padding |

Non-`data` attributes on the same element, all part of the contract:
`class="ds-row ds-row-<add|del|ctx>"` / `class="ds-urow ds-row-<type>[ is-untoured]"`,
`role="group"`, `tabindex="-1"`, `aria-keyshortcuts="C"`,
`aria-label="<Added|Deleted|Context> <before|after> line N in path: <collapsed content>"`
(content collapsed to single spaces, empty → "blank line"),
and at runtime `aria-current="true"` on the change-jump target.

Runtime classes added to rows: `is-change-jump`, `is-voice-focus`, `is-story-focus`,
`ds-comment-anchor-target`, `ds-comment-draft-anchor`.

### 4.2 Code cell — `span.ds-code`

| Attribute | Value |
|---|---|
| `data-comment-code` | `"1"` |
| `data-comment-side` | `left` \| `right` |
| `data-comment-file` | path (old path for the left side) |
| `data-comment-line` | integer |

Read by: `codeForNode`, `currentSelectionContext`, `focusedRowContext`,
`commentRows`, `openSymbolInVSCode`, and the one-side-only selection CSS
(`body.ds-selecting-left .ds-code[data-comment-side="right"]{user-select:none}`).

Cell structure (also load-bearing for the annotation geometry, which queries
`.ds-cell-l .ds-code` / `.ds-cell-r .ds-code`):
`span.ds-cell[.ds-cell-l|.ds-cell-r|.ds-cell-single][.ds-cell-empty]
[.ds-cell-add|.ds-cell-del|.ds-cell-paired|.ds-cell-untoured]`
> `span.ds-no` (line number) + `span.ds-sign[.ds-sign-add|.ds-sign-del]` +
`span.ds-code` + optional `span.ds-untoured-tag` ("UNEXPLAINED").
Split rows put `span.ds-celldiv[aria-hidden=true]` between the two cells.

### 4.3 Tokens inside `.ds-code`

| Attribute | Emitted when |
|---|---|
| `data-vscode-symbol` | right/after side, non-keyword identifier |
| `data-vscode-column` | 1-based column of that token |

### 4.4 Hunk gap

`div.ds-hunkgap[.is-expandable][.ds-hunkgap-split]` with
`data-gap`, `data-gap-file`, `data-gap-from`, `data-gap-to` (integer or `eof`),
`data-gap-chunk`; buttons `button.ds-gapbtn[data-expand="up|down|all"]`.
Runtime: `aria-busy`, `.is-error`, injected `.ds-gaperror[role=alert]`.

### 4.5 Context response wrapper (`/api/diff/context`)

`div[data-ctx-rows][data-from][data-to]` wrapping the rows. The client throws
"Unexpected context response" if `data-ctx-rows` is absent.

### 4.6 Annotations and callouts (inside the split story diff)

* `script[type="application/json"][data-annotations]` — `{ moves: [{ id, kind, tag?,
  before: {local, file?, range?, targetStep?}, after: {...}, arrow }] }`.
* `div.ds-annot-callout[data-annot-callout=<moveId>][data-move-id=<moveId>][role=note]`,
  optionally with `div.ds-annot-route[data-cross-file-role="source|destination"]`.
  Both are presentational only — no JS reads them.
* `button.ds-annot-dest[data-move-target-step?][data-move-target-file][data-move-target-line]`
  — read by `onClick` to jump to a step or open the target file.
* `div.ds-sr-only[data-annotation-summary]` — the screen-reader equivalent of the
  decorative SVG.
* Client-painted `svg.ds-annot[aria-hidden=true]` appended to `.ds-diffbody`.

**Count:** 8 attributes on the row element itself (7 server-rendered + 1 runtime),
4 on `.ds-code`, 2 on tokens → **14 in the row subtree**; **30 distinct `data-*`
attributes** across the whole injected-diff-HTML contract when gaps (6), the context
wrapper (3), and annotations/callouts (7) are included.

---

## 5. Every interaction

### 5.1 Delegated click handler — `onClick(e)` on `document`
Order matters: the handler returns after the first match. Listed in source order.

| # | Selector | Effect |
|---|---|---|
| — | not inside `.ds-story-tune` | closes any open story-repair `<details>` |
| 1 | `[data-vscode-symbol]` **+ Cmd/Ctrl** | `preventDefault`; POST `/api/editor/open` |
| 2 | `[data-review-reload]` | `location.reload()` |
| 3 | `[data-move-target-file]` | `setActive(targetStep)` if `data-move-target-step > 0`, else `openMoveTargetFile(file, line)` |
| 4 | `[data-selection-comment]` | close menu, `openComposer(ctx.anchorRow,'change',ctx)` |
| — | click outside an open `[data-selection-menu]` | closes it |
| 5 | `[data-sidebar-toggle]` | compact → open/close overlay; desktop → `setSidebarCollapsed(!collapsed)` |
| 6 | `[data-sidebar-scrim]` | `closeCompactSidebar(true)` |
| 7 | `[data-view]` | `setView(value)` |
| 8 | `[data-review-tab-select]` | `selectReviewTab(tab,false)` |
| 9 | `[data-goto-review]` | `gotoReview(section, data-goto-excluded)` |
| 10 | `[data-file-filter]` | `setFileFilter()` |
| 11 | `[data-next-unviewed]` | `nextUnviewedFile()` |
| 12 | `[data-retry-file-panel]` | reset the panel stub and `loadFilePanel()` |
| 13 | `[data-retry-story-step]` | restore `data-step-lazy` and `loadStoryStep(i, cb)` |
| 14–17 | `[data-drift-open]` / `[data-drift-close]` / `[data-drift-back]` / `[data-drift-file]` | drift drawer open / close / back to list / load file |
| 18 | `[data-drift-retry]` | clear `data-drift-loaded` and reload the active drift file |
| 19 | `[data-challenge-check]` | `saveChallengeChecks()` |
| 20 | `[data-goto-comment]` | `gotoComment(id)` — jumps to the code |
| 21–23 | `[data-edit-comment]` / `[data-edit-cancel]` / `[data-edit-save]` | open / close / save the queued-comment editor |
| 24 | `[data-remove-comment]` | `window.confirm` then DELETE |
| 25 | `[data-comment-launcher]` (the in-diff pin) | `gotoQueuedComment(data-queued-comment-id)` → Review ▸ Comments |
| 26 | `[data-resume-review]` | `restoreReviewPosition()` |
| 27–29 | `[data-shortcuts-open]` / `[data-shortcuts-close]` / `[data-command]` | palette open / close / run command |
| 30–33 | `[data-story-choice]`, `[data-story-scope-action]`, `[data-story-ext]`, `input[data-story-file]` | storyless generator controls |
| 34 | `[data-generate-story]` | `generateStory(btn)` |
| 35 | `[data-reload-diff]` | busy state then `location.reload()` in a rAF |
| 36 | `[data-rail-beat]` | if its step is active, `selectStoryFocus(step, group, true)`; collapse compact sidebar |
| 37 | `[data-beat-move]` | `movePanelBeat(panel, ±1)` |
| 38 | `[data-open-full-diff]` | Files view + select that file |
| 39 | `[data-open-all-files]` | Files view |
| 40 | `[data-story-beat]` | `selectStoryFocus(panelIndex, focusGroup, true)` |
| 41–42 | `[data-aloud-stop]` / `[data-readaloud]` | `stopReadAloud()` / `toggleReadAloud()` |
| 43 | `[data-viewed-toggle]` | `toggleViewed(panel file)` |
| 44 | `.ds-fileitem` | Files view + `selectFile(index)` + collapse compact sidebar |
| 45 | `[data-copy-comments]` | `copyComments()` (re-fetches `/api/comments` first) |
| 46–47 | `[data-change-prev]` / `[data-change-next]` | `jumpRelativeChange(holder, ∓1)` |
| 48 | `[data-expand]` | `expandGap(btn)` |
| 49 | `[data-mode]` | mark `data-mode-user-set` on a story holder, `setMode(btn)` |
| 50 | `[data-exclusions-ack]` | `setExclusionsAcknowledged(checked)` |
| 51 | `[data-inspect-excluded]` | toggle or lazily fetch the excluded-file preview |
| 52 | `[data-goto-step]` | close drift drawer, Story view, `setActive(n)` |
| 53 | `[data-goto-file]` | close drift drawer, Files view, `selectFileByPath()` |
| 54 | `[data-explain]` | `repairStory('explain', {file, line})` |
| 55 | `[data-story-repair]` | `repairStory(action, {file, stepId})`, close the `<details>` |
| 56 | `.ds-stepcard` | `setActive(data-step-index)` |

### 5.2 Selection and comment creation
* `mousedown` (`trackSelectionSide`): a right-click or Ctrl+left-click sets a 500 ms
  "context menu pending" flag; a plain left click on a `[data-comment-code]` cell
  adds `ds-selecting-left` / `ds-selecting-right` to `<body>`, which
  `user-select: none`s the *other* side. Clears any cached selection context.
* `mouseup` (`releaseSelectionSide`): on the next tick, caches
  `currentSelectionContext()` and the selection client rects.
* `selectionchange` (`clearCollapsedSelection`): drops the cache when the selection
  collapses (unless a context menu is pending).
* `currentSelectionContext()` builds
  `{anchorRow, file, line, side, step, selectedText, selection:{startLine,endLine,
  startColumn,endColumn}}`. It **returns null** if the selection crosses sides,
  crosses files, or touches a cell without a line number. `selectedText` is the
  per-cell slices joined by `\n`. Columns come from `indexOf` within the cell text.
* `contextmenu` (`openSelectionMenu`): only fires when the pointer is inside a cached
  selection rect (±2px). `preventDefault`s and positions
  `.ds-selection-menu` clamped 8px inside the viewport.
* `focusedRowContext()` is the keyboard path: the focused `.ds-row`/`.ds-urow`, whole
  line as `selectedText`, columns `1..len+1`.
* `openComposer(row, flavor, ctx)` inserts
  `section.ds-composer[data-comment-side][role=region][aria-label="New review comment
  on file, line N"][tabindex=-1]` **as the next sibling of the anchor row**, marks the
  row `ds-comment-draft-anchor`, focuses the textarea with `preventScroll`, then
  `revealComposer()` scrolls it into view accounting for sticky toolbars.
* Composer contents: a `role=radiogroup` of three flavors (`change` "Fix request",
  `question` "Question", `nit` "Note") with roving tabindex and arrow-key movement;
  a textarea with `aria-keyshortcuts="Meta+Enter Control+Enter Meta+Shift+Enter
  Control+Shift+Enter"`; and two actions — **Copy** (`.ds-btn-solid`, primary, never
  persists) and **Add to queue** (`.ds-ghost`, the only writing action).
* Draft payload: `{file, line, side, step, type, body, selectedText, selection, status:'open'}`.

### 5.3 Comment editing / deletion
* Edit: `[data-edit-comment]` unhides `[data-comment-editor]`, hides
  `.ds-feedback-message`, adds `is-editing`, focuses the textarea.
* Save: PATCH `/api/comments/<id>` with `{type, body}`; on success
  `replaceComment` → `syncFeedbackCards` → `syncCommentPins` → `refreshCount` → toast.
* Cancel: re-hides the editor and resets the textarea/flavor from the cached comment.
* Remove: `window.confirm('Remove this queued comment?')` then DELETE; on success the
  comment is dropped from `allComments` and every surface resyncs.
* Any mutation of a `change`-type comment calls `noteBlockingFeedbackMutation` →
  `refreshReviewState()`.

### 5.4 Comment pins in the diff
`mountCommentPins(scope)` removes existing `[data-comment-launcher]` pins in scope,
then appends one `button.ds-comment-pin[data-comment-launcher][data-queued-comment-id]`
per row that any queued comment matches (matching on file + line + side across
`[data-comment-code]`), labelled "Open N queued review comment(s)". Called after
every lazy insertion and every comment refresh.

### 5.5 Cmd/Ctrl-click to VS Code
`openSymbolInVSCode(symbol)`: walks up to `[data-comment-code]`, **requires
`data-comment-side === 'right'`**, reads file/line from the cell and column from
`data-vscode-column`, POSTs `{file, line, column}` to
`reviewPageUrl('/api/editor/open')`. Server validates against the lease and the
bounded file list, builds `vscode://file/<abs path>:<line>:<column>` (rejecting
absolute or `..` paths and non-positive line/column), and opens it externally.
Success → toast "Opening implementation in VS Code…"; failure → error toast.
Oracle: `editor-bridge.test.mjs`.

### 5.6 File expand / collapse and review marks
* Directory `<details class="ds-filetree-dir">` are native disclosures, open by default.
  `applyFileFilters()` hides a directory whose visible leaves are all hidden.
* `selectFile(i)` runs `runWorkspaceTransition('file', dir, update)`, toggles panel
  `hidden` and item `is-active`, then `loadFilePanel(panel)` → `applyFilesMode` →
  `jumpToFirstChange`, resets `#ds-file-detail.scrollTop`, and saves the position.
* Reviewed marks are **hash-bound**: `viewedFiles[path] === reviewHashForFile(path)`.
  `reviewHashForFile` reads `data-review-hash` from the rail item *and* the panel and
  returns `''` if they conflict. `invalidateChangedViewed()` drops any entry whose
  hash no longer matches. `toggleViewed` refuses (with a toast) when no hash is known.
* `syncViewed()` writes `is-viewed`/`is-reviewed` classes, `data-reviewed`,
  `aria-pressed`, `aria-label` ("Mark `<file>` reviewed/unreviewed"),
  `title` ("Mark reviewed (V)"), the button label, and "n of m reviewed".

### 5.7 Change navigation
`changeRows(holder)` = `.ds-row-add, .ds-row-del` inside the *visible* diff root.
`jumpToChange` sets `data-change-index` on the holder, clears `is-change-jump` and
`aria-current` from all rows, marks the target, scrolls it to the vertical centre
(`scrollReviewRowVertically`, never `scrollIntoView` — that would scroll horizontally),
and optionally focuses it. `updateChangeNav` also runs `prepareSplitDivider`,
`syncViewed`, updates `[data-change-count]` (`aria-live=polite`, `aria-atomic=true`),
and hides `[data-change-nav]` when there is nothing to walk.

### 5.8 Drags
| Drag | Start | Move | End |
|---|---|---|---|
| Sidebar width | `mousedown` on `[data-sidebar-resizer]` (un-collapses, `body.ds-sidebar-resizing`) | `mousemove` → rAF → `setSidebarWidth(x, false)` | `mouseup` → final width, persist `ds-sidebar-width` |
| Split divider | `mousedown` on `.ds-celldiv` (`body.ds-resizing`) | `mousemove` → rAF → `--ds-split` + `scheduleAnnotations` | `mouseup` → persist `ds-split` |

Both use `mouse*` events (not pointer events) and both batch writes through
`requestAnimationFrame` — asserted by `motion-regressions.test.mjs:67`.

### 5.9 Hovers
* Filmstrip node hover/focus → tooltip + dock magnification (see 2.4).
* `[data-vscode-symbol]` hover → `cursor: alias`, underline reveal, `--accent-soft`
  background (`editor-bridge.test.mjs:27`).
* Hunk-gap buttons fade in on hover, but are **always visible** on
  `(hover:none),(pointer:coarse)` and for `.ds-hunkgap-split .ds-gapbtn-context`.

---

## 6. Keyboard shortcuts

**20 distinct bindings.** Global handler is `onKey(e)` on `document` (`page-assets.ts:3514`);
scoped handlers are noted.

| # | Key | Scope | Effect |
|---|---|---|---|
| 1 | `Escape` | global, cascading | 1st: close an open `.ds-story-tune` and focus its summary. 2nd: remove the inline composer (restoring focus). 3rd: close the top modal (command palette or drift drawer). Else: close the selection menu, and on compact screens close the sidebar overlay. |
| 2 | `?` | global, not in text entry | Open the command palette |
| 3 | `Tab` / `Shift+Tab` | inside a modal | Focus trap: wrap first↔last of `modalFocusables(root)`; pull focus in if it escaped |
| 4 | `/` | global, not in text entry | Switch to Files and focus `[data-file-search]` |
| 5 | `c` / `C` | global, not in text entry | Open the composer for the current selection, else for the focused row. Advertised on every row via `aria-keyshortcuts="C"` |
| 6 | `←` `→` `↑` `↓` `Home` `End` | focused `[data-story-choice]` | Roving radiogroup for depth / writer / quality (storyless) — focuses **and clicks** |
| 7 | `←` `→` `Home` `End` | focused `[data-review-tab-select]` | Roving, wrapping walk of the Review sub-tabs |
| 8 | `←` `→` `Home` `End` | focused `.ds-tab[data-view]` | Roving, wrapping walk of Story/Files/Review (N-way, not a 2-way flip) |
| 9 | `←` `→` | focused `[data-sidebar-resizer]` | Un-collapse and resize ±16px (persisted) |
| 10 | `←` `→` | focused `[data-rail-beat]` | Move rail beat selection, re-centring the diff |
| 11 | `←` `→` | focused `[data-story-beat]` | Move beat selection; at a boundary crosses into the next/previous step via `focusStoryStepBoundary` |
| 12 | `←` `→` | global, narration active or a speech cursor exists | `moveSpeechBeat(±1)` — while paused it moves the cursor **silently** and stays paused |
| 13 | `←` `→` | global, Story view, `active > 0` | `movePanelBeat(activePanel, ±1)` |
| 14 | `←` `→` `n` `N` `p` `P` `[` `]` | global, not in text entry | `handleChangeShortcut` — previous/next changed row in the active diff holder, focusing the row |
| 15 | `j` | global, not in text entry, not Review view | Next file (Files) or next step (Story) |
| 16 | `k` | same | Previous file / previous step |
| 17 | `v` / `V` | global, Files view, not in text entry | Toggle the current file reviewed |
| 18 | `Space` (`' '`, `Spacebar`, `code === 'Space'`) | global, not in text entry, and either the target is the read-aloud button or is not a keyboard control | Toggle read aloud (starts as well as pauses). On the button itself it defers to native activation so it does not fire twice |
| 19 | `Cmd/Ctrl + Enter` | composer textarea | **Copy** the draft (the default action) |
| 20 | `Cmd/Ctrl + Shift + Enter` | composer textarea | **Add to queue** |

Plus, scoped: the composer flavor radiogroup takes `← → ↑ ↓ Home End`
(`moveComposerRadio`), and the split divider takes `← →` (±4, Shift ±10), `Home` (22),
`End` (78) — see 3.2. `.ds-celldiv` advertises
`aria-keyshortcuts="ArrowLeft ArrowRight Home End"`.

`isTextEntryTarget` = contentEditable, `INPUT`, `TEXTAREA`, `SELECT`.
`isKeyboardControlTarget` = `BUTTON`, `A`, or `[role=button|link|separator]`.
Ordering note: `←`/`→` is consumed by the **first** of #10, #11, #12, #13, #14 that
matches; the change-jump shortcut is last, so a focused beat wins over change navigation
(`render-page.test.mjs:1793`).

---

## 7. Client state

### 7.1 In-memory (module-scope vars in the single IIFE)
Navigation: `active`, `total`, `visited{}`, `selectedFile`, `stepPanels`, `stepCards`,
`filePanels`, `fileItems`, `tourView`/`filesView`/`reviewView`.
Focus: `storyFocusIndex`, `storyFocusGroup`, `voiceFocusIndex`, `voiceFocusGroup`,
`voiceFocusTimers[]`, `voiceSequenceToken`, `focusScrollTimer`, `focusScrollFrame`.
Selection: `selectionContext`, `selectionRects[]`, `selectionContextMenuPending`.
Comments: `allComments` (seeded from `#ds-initial-comments`), `agentBusy`.
Filters: `activeFileFilter`, `fileSearchQuery`, `fileSearchMatches`,
`fileSearchRequest`, `fileSearchTimer`.
Layout: `sidebarResizing`, `sidebarResizeFrame/ClientX`, `splitBody`, `splitHolder`,
`splitResizeFrame/ClientX`, `annotationFrame`, `annotationObserver`, `stickyObserver`,
`filmProgressObserver`, `filmTooltipTarget`, `filmMagnifyFrame`, `filmPointerX`.
Modals: `modalStack[]`, `modalBackgroundSnapshots[]`, `sidebarReturnFocus`,
`commandReturnFocus`, `composerReturnFocus`.
Position: `restoringReviewPosition`, `reviewSaveTimer`, `reviewPositionReady`.
Coverage: `coverageResolved`, `coveragePromise`, `trustLoadPromise`.
Drift: `driftRequestAbort`, `driftRequestToken`, `driftLayoutMode`.
Live: `liveEventSource`, `liveDisconnectTimer`, `liveOriginalStoryFreshness`,
`liveIssues{}`, `liveGenerations{}`, `liveDismissed{}`, `storyReloadTimer`.
Narration: ~24 `aloud*` vars plus `aloudSequence[]`, `currentSpeechStep/Unit/Manual`.
Diff: `viewedFiles{}` (path → reviewHash).
Motion: `workspaceTransition`, `workspaceFallbackTimer`, `workspaceTransitionToken`.
Mermaid: `mermaidModulePromise`, `mermaidRenderId`.

Per-node state stashed as JS properties (not attributes): `panel._dsStepCallbacks`,
`button._dsDriftHtml` / `_dsDriftLayout`, `root._dsHideTimer` / `_dsShowFrame` /
`_dsReturnFocus`, `divider._dsSplitKeyboard`, `box._dsAnchorRow`.

### 7.2 Storage — **9 keys, all `localStorage`. No `sessionStorage` anywhere.**

| Key | Scoping | Value |
|---|---|---|
| `ds-theme` | global (owned by `src/theme.ts`) | `light` \| `dark` \| `system` |
| `ds-sidebar-collapsed` | global | `'0'` \| `'1'` |
| `ds-sidebar-width` | global | integer px |
| `ds-split` | global | percentage (22–78) |
| `ds-files-mode` | global | `diff` \| `split` \| `full` (All-files panels only) |
| `ds-viewed:<data-viewed-scope>` | per repo+scope | `{path: reviewHash}` (legacy `string[]` arrays are migrated on read) |
| `ds-review-ui:<data-review-scope>:<data-story-key>` | **per scope + story** | `{view, step, file, scroll, reviewTab}` |
| `ds-challenge:<data-review-scope>:<data-current-diff-hash>` | per scope + diff | `{checkId: 1}` |
| `ds-exclusions-ack:<data-review-scope>:<data-current-diff-hash>` | per scope + diff | `'1'` |

Every read and write is wrapped in `try/catch` — storage failure must stay non-fatal.

### 7.3 URL
The review page **never** touches `history.pushState`/`replaceState` and reads no
query parameters client-side. Server-side, `/repo/<name>/review` and
`/repo/<name>/diff` accept the scope query handled by `resolveScope` (`base`, `head`,
etc.) and `/review?story=…` legacy redirects. There is no hash routing.
`reviewPageUrl(path)` builds every API URL relative to `location.href` and appends
`?page=<token>`. **[INFERENCE]** Nothing about view / step / file selection is
reflected in the URL, so deep links into a step do not exist today.

### 7.4 The page lease
`data-review-page-token` is an opaque `randomBytes(18).toString('base64url')` token
issued per rendered page (`issueReviewPageLease`, `src/session.ts:70`), stored in the
session as an LRU map bounded by `REVIEW_PAGE_LEASE_LIMIT` with
`REVIEW_PAGE_LEASE_TTL_MS` renewed on every use. The lease records repo, base, head,
change fingerprint, scope key, mode, story identity, story path, story fingerprint,
and **per-file fingerprints**.

`validateReviewPageLease(session, token, file?)` re-checks all of that against a live
read and returns `409` with `{error, detail, reloadRequired: true}` when anything moved:
"This review page is no longer active." / "The repository changed…" / "The guided review
changed…" / "The review scope changed…" / "The change moved after this review page
loaded." A whole-review fingerprint mismatch is still served if the *requested file's*
fingerprint is unchanged — so an unrelated edit does not break the panel you asked for.
`sendLeasedHtml` re-checks the race signature *after* rendering.

Client side: any `!r.ok` sets `err.reloadRequired = (status === 409)`, and every error
surface then renders a `[data-review-reload]` "Reload review" button plus the message
"The review changed while this page was open. Reload to continue safely."
Oracle: `diff-client.test.mjs:80`.

---

## 8. Lazy loading and API calls

| Endpoint | When | Response | Insertion |
|---|---|---|---|
| `GET /api/review/step-panel?index=N&page=` | `loadStoryStep(i)` — on activation and as a **prefetch of `i+1`**; also from narration warming | **HTML fragment**: a whole `<section class="ds-step">` | Parsed into a `<template>`, validated to have class `ds-step`, then `panel.replaceWith(fresh)`; `stepPanels` re-queried; `mountCommentPins`, `adoptStepDocks`, `renderConceptDiagrams`, `updateChangeNav`, re-apply `ds-split` |
| `GET /api/diff/file-panel?file=&page=` | `loadFilePanel(panel)` from `selectFile` / retry / `openMoveTargetFile` | **HTML fragment**: `renderFilePanelContent` inner markup | `panel.innerHTML = html`, then `mountCommentPins`, `updateChangeNav`, `refreshComments`, `applyFilesMode`, `jumpToFirstChange` |
| `GET /api/diff/split?file=&page=` | `setMode` → `loadSplit` for an All-files panel with no `data-loaded` | **HTML fragment**: `renderSplitHunks` | `splitInner.innerHTML`, `mountThreads`, `updateChangeNav`, `jumpToFirstChange` |
| `GET /api/fullfile?file=&page=` | `setMode('full')` → `loadFull` | **HTML fragment**: `renderFullFile` | same shape as split |
| `GET /api/diff/context?file=&from=&to=&layout=&page=` | `expandGap` | **HTML fragment**: `<div data-ctx-rows data-from data-to>` rows | Children moved before/after the gap; gap narrowed or removed |
| `GET /api/review/trust?page=` | `setView('review')` and `gotoReview()` (once; the in-flight promise is shared) | **HTML fragment**: a full `[data-trust-evidence]` block | Parsed with `DOMParser`, `host.innerHTML = next.innerHTML`, `data-trust-pending="0"`, then `applyCoverageVerdict` from `data-trust-uncovered` |
| `GET /api/review/coverage?page=` | `scheduleCoverageResolve()` in `init()` (idle callback, 2 s timeout / 400 ms fallback) | **JSON** `{uncovered, storyless}` | `applyCoverageVerdict()` rewrites the pill and the Coverage tab flag |
| `GET /api/review/file-search?q=&page=` | `searchFilesLazily` — 180 ms debounce, min 2 chars | **JSON** `{query, files[]}` | Populates `fileSearchMatches`, then `applyFileFilters()`; stale responses dropped by request token and query equality |
| `GET /api/review/excluded-file?file=&page=` | `[data-inspect-excluded]` click (cached after first load) | **HTML fragment**: head + `<pre class="ds-excluded-code">` bounded to 500 lines | `preview.innerHTML`, `data-loaded="1"` |
| `GET /api/story-drift/file?observation=&file=&layout=&page=` | `loadDriftFile` (abortable, token-guarded, cached per button+layout) | **HTML fragment**: `renderUnifiedHunks` or `renderSplitHunks` | `preview.innerHTML` |
| `GET /api/review-state?page=` | `refreshReviewState()` — on SSE open, `review-state-changed`, and after every comment refresh | **JSON** `ReviewStateSummary` | Writes `data-feedback-health`, compares `currentDiffHash`, `setLiveIssue('diff', …)`, `refreshCount()` |
| `GET /api/comments?page=` | `refreshComments()` in `init()`, on SSE open, on `comments-changed`, after a file panel loads, and before Copy-all | **JSON** `Comment[]` | Replaces `allComments`; resyncs pins, cards, file flags, counts |
| `POST /api/comments?page=` | composer "Add to queue" | **JSON** the created comment | `replaceComment`, close composer, resync |
| `PATCH /api/comments/<id>?page=` | queued-card Save | **JSON** the updated comment | `replaceComment`, resync |
| `DELETE /api/comments/<id>?page=` | queued-card Remove | 200/err | Drop locally, resync |
| `POST /api/editor/open?page=` | Cmd/Ctrl-click a symbol | **JSON** `{ok}` or `{error}` | Toast only |
| `GET /api/events?page=` | `startLiveEvents()` | **SSE** stream (see section 9) | Drives banners and refreshes |
| `GET /api/agents` | `repairStory()` and the storyless generator | **JSON** `{agents[], skills}` | Fills the writer radiogroup |
| `GET /api/codex/models` | writer = codex | **JSON** model list | Fills the quality radiogroup |
| `POST /api/skills/update` | `#storySkillUpdateBtn` | **JSON** | Toast |
| `GET/POST /api/aloud/{status,speak,prepare,control}` | narration (**no `page` token**) | **JSON** | Narration state |
| `POST /api/aloud/control` via `navigator.sendBeacon` | `pagehide` | — | Stops narration when the page goes away |

### 8.1 HTML vs JSON in the rewrite

**Must stay HTML** (diff rows are server-rendered by design — `highlight.ts`,
`intra-line.ts`, `diff-render.ts` keep emitting them):
`/api/diff/split`, `/api/fullfile`, `/api/diff/context`, and the diff *bodies* inside
`/api/diff/file-panel`, `/api/review/step-panel`, `/api/story-drift/file`.

**Should become JSON** (they are chrome, not code):
* `/api/review/step-panel` — should return `{step: StepView, comments}` and let React
  render the header, beat dock, toolbar, and concept body, with only the two diff
  inners as HTML strings. The current response is a whole `<section>` the client has
  to sniff (`fresh.classList.contains('ds-step')`).
* `/api/diff/file-panel` — should return `{file: FileView, unifiedHtml}` so React owns
  the head, mode toggle, reviewed button, and change nav.
* `/api/review/trust` — should return `TrustView + exclusions + divergent files`.
  It is currently HTML that the client re-parses with `DOMParser` purely to read
  `data-trust-uncovered` off the wrapper.
* `/api/review/excluded-file` — should return `{side, startLine, lines[]}`.
* `/api/story-drift/file` — chrome-free already; keep the diff body as HTML but
  return `{note, html}`.

Already JSON and unchanged: `/api/review/coverage`, `/api/review/file-search`,
`/api/review-state`, `/api/comments*`, `/api/editor/open`, `/api/agents`.

---

## 9. Live / streaming

`src/live.ts` serves **Server-Sent Events**, not NDJSON: `Content-Type:
text/event-stream; charset=utf-8`, `Cache-Control: no-store`, `Connection: keep-alive`,
an opening `retry: 1500`, and frames of the form `event: <type>\ndata: <json>\n\n`.

`GET /api/events?page=<token>` resolves the lease; a **dead lease returns HTTP 204**,
which tells `EventSource` to stop reconnecting.

Event types (`LiveEventType`):

| Event | Payload | Client effect |
|---|---|---|
| `state` (sent immediately on connect) | `{fingerprint, diffChanged, storyChanged}` | `setLiveIssue('diff', …)`, `setLiveIssue('story', …)` |
| `comments-changed` | `{}` | `refreshComments()` |
| `review-state-changed` | `{}` | `refreshReviewState()` |
| `story-changed` | `{}` | `setLiveIssue('story', true)` → `data-story-freshness="stale"` on `<body>` and on `[data-review-status]`, `refreshCount()`, and **schedules an automatic reload in 10 s** with a cancellable toast |
| `story-synced` | `{}` | `setLiveIssue('story', false)` → restores the original freshness, hides the reload toast |
| `diff-changed` | `{}` | `setLiveIssue('diff', true)` → `data-live-diff-stale="1"`, banner |
| `diff-synced` | `{}` | clears the diff issue and `refreshReviewState()` |

Server plumbing: one `WatchGroup` per repo with `fs.watch` on `.diffstory/` and
`.diffstory/stories/`, a **200 ms** debounce per invalidation kind, a **4 000 ms**
poll fallback recomputing the diff fingerprint per `(base, head)` scope, and a
**15 000 ms** heartbeat. Watched files: `comments.json` → `comments-changed`,
`review-state.json` → `review-state-changed`, `story.json` / legacy / `stories/*` →
story invalidation.

Client lifecycle: `source.onopen` clears the disconnect timer and immediately
`refreshComments()` + `refreshReviewState()`. `source.onerror` waits **4 000 ms**
before showing the "Live updates interrupted." banner, so a transient reconnect
never flashes it. `pagehide` closes the stream; `pageshow` with `event.persisted`
(bfcache restore) reopens it, because `EventSource.close()` is terminal.

Banner dismissal is per *generation*: `liveDismissed[kind] = liveGenerations[kind]`,
so a later re-fire of the same kind shows the banner again.

---

## 10. Performance-critical behaviour — **must be preserved**

1. **Bounded file index.** `boundedReviewIndex()` drops `binary`, `large`,
   `generated`, and `metadataOnly` files from the rendered diff DOM entirely. They
   remain in the exact scope, are surfaced in the Coverage tab's Exclusions section,
   and require an acknowledgement before the page can read clean. Never widen this.
2. **Every story step is a lazy stub.** With `fileIndex` present, `renderPage`
   renders `lazyStepPanel()` for all steps. Only the Overview is inline. A 300-step
   story's initial HTML therefore contains 300 tiny `<section>`s, not 300 highlighted
   diffs.
3. **Speech cache in the stubs.** Each stub carries an `.ds-sr-only
   [data-step-speech-cache]` block so narration can plan the whole story without
   loading a panel. Dropping this forces 300 fetches to start playback.
4. **Rail compaction over 10 steps.** `storyRail()` switches to `<details>` chapters
   and drops every beat tree. The comment cites ~1 MB of narration in the sidebar for
   a real 245-step story.
5. **Every file panel is a lazy stub**, and its split body is a *second* lazy fetch.
   Only the active panel is not `hidden`.
6. **Single-step prefetch, never more.** `setActive` prefetches exactly `i+1`;
   `warmSpeechSequence` warms at most **2** more steps ahead. No bulk preloading.
7. **Coverage is deferred past first paint.** `scheduleCoverageResolve()` uses
   `requestIdleCallback(…, {timeout: 2000})` with a 400 ms `setTimeout` fallback,
   because the verdict costs a whole-diff read on the server. The pill honestly says
   "Checking coverage…" until then and **never** silently reads clean.
8. **Trust evidence is fetched once**, and `trustLoadPromise` is shared so
   `gotoReview()` chains onto the in-flight request instead of scrolling to a node
   about to be replaced.
9. **Debounces:** review-position save 90 ms; file search 180 ms (min 2 chars, plus
   a client-side substring prefilter over `data-filter-path` before any request);
   Aloud prepare dwell 1000 ms; live-server invalidation 200 ms.
10. **rAF batching** for both drags (sidebar and split divider) and for annotation
    repaints (`scheduleAnnotations`) and filmstrip magnification.
11. **Observer discipline.** `ResizeObserver`s for sticky metrics, filmstrip
    progress, and annotation geometry are each single-instance and `disconnect()`ed
    before re-observing; the sticky observer's callback deliberately never
    re-observes (it would never settle).
12. **`hidden` everywhere instead of unmounting.** Views, panels, step sections, and
    the three diff inners are toggled with the `hidden` attribute. The active-panel
    query `visibleDiffRoot()` depends on it.
13. **Abortable, token-guarded requests** for narration, drift, and file search;
    stale responses are dropped rather than applied.
14. **Server-side lease snapshot cache** — `reviewPageSnapshots` (max 16) lets a lazy
    request validate without re-reading the whole diff, and
    `reviewPageRaceSignature` re-stats only the live files.

**What is *not* there today (and would be new work, not a regression):** there is no
`content-visibility`, no `contain-intrinsic-size`, no `IntersectionObserver`, and no
virtualization or windowing of diff rows. A single very large *bounded* file still
renders every row. If the React rewrite adds virtualization it must not break the
`[data-step-focus]` / `data-move` measurement passes, which read live
`getBoundingClientRect()` on rows.

**Hard constraint for the rewrite:** items 1–13 above must all survive. The one that
is easiest to lose and most expensive to lose is (2)+(3) — a React port that
naively renders `steps.map(<Step/>)` with real content re-creates the 1 MB DOM the
current code spent effort avoiding.

---

## 11. Accessibility contracts

Anything asserted in `test/render-accessibility.test.mjs` is a **hard requirement**;
`diff-client.test.mjs`, `comments-client.test.mjs`, and
`ui-layout-regressions.test.mjs` add more.

**Asserted by `render-accessibility.test.mjs`:**
* No `data-feedback-filter` anywhere (no comment status-filter lifecycle).
* `role="group" aria-label="Comment type"` on the queued-card flavor controls.
* `data-edit-body rows="3" aria-label="Edit review comment"` on the edit textarea.
* `data-copy-comments="queued"`.
* `#storyReviewerNote` carries `aria-labelledby="storyReviewerNoteLabel"` and
  `aria-describedby="storyReviewerNoteHelp"`, with the label text
  "What should this change accomplish?".
* Command dialog: `class="ds-command" role="dialog" aria-modal="true"
  aria-labelledby="ds-command-title" aria-describedby="ds-command-description"
  tabindex="-1"`; `#ds-command-title` = "Commands";
  `#ds-command-description` = "Keyboard-first review without hidden magic.";
  the scrim is a `<div … aria-hidden="true">` and **must not** be a `<button>`
  (it would join the modal tab loop); a close button with
  `aria-label="Close commands"`; `class="ds-command-list" role="group"
  aria-label="Review commands"`.

**Roles and landmarks:** `header`, `aside[aria-label="Review navigation"]`, `main`,
three `[role=tabpanel]` views with `aria-labelledby`, a `[role=tablist]` for the view
switcher and another for the Review sub-tabs, `[role=region][aria-label="<file> story
diff"]` per step diff, `[role=note]` for hotspot flags and annotation callouts,
`[role=menu]`/`[role=menuitem]` for the selection menu, `[role=separator]` for both
resizers, `[role=radiogroup]`/`[role=radio]` for depth/writer/quality and the composer
flavors, `[role=dialog][aria-modal=true]` for the palette and drift drawer.

**Live regions:** `#ds-toast` (`status`→`alert`, `polite`→`assertive` for errors,
`aria-relevant="additions text"`), `.ds-live-banner` (`status`, polite, atomic),
`[data-story-focus-status]` (polite, atomic — cleared then re-set on a tick so the
same text re-announces), `[data-change-count]` (polite, atomic),
`[data-drift-selected-path]` (polite), `[data-story-agent-state]` (polite),
`#storyScopeCount`'s `<strong aria-live="polite">`, and `role="status"` on every
loading placeholder / `role="alert"` on every error placeholder.

**Row semantics:** every commentable row is `role="group" tabindex="-1"
aria-keyshortcuts="C"` with a composed `aria-label` naming the action, side, line,
file, and content. Change-jump sets `aria-current="true"` on exactly one row.

**Focus management:**
* `modalStack` + `modalBackgroundSnapshots`: opening a modal sets `aria-hidden="true"`
  and `inert` on every non-modal `body > *` (except `<script>`/`<style>`), snapshotting
  and restoring the prior values. `body.ds-noscroll` locks scroll.
* `focusModalRoot` focuses the first focusable, else the `[role=dialog]`.
* `restoreModalFocus` returns focus to the opener if it is still in the document and
  not inert; otherwise to the next modal down the stack.
* Compact sidebar: `.ds-main` and `.ds-reviewchrome-main` get `inert`; the scrim
  becomes focusable; focus returns to the toggle on close.
* `focusViewEntry(view)`: Story → the selected beat, else the first beat, else the
  Start button / concept-next / the filmstrip node; Review → the selected sub-tab
  (unless `gotoReview` is about to focus a section); Files → the Files tab, falling
  back to the search input. Entering Files from a click deliberately does **not**
  steal focus.
* The composer restores focus to `composerReturnFocus` on cancel/Escape.
* `focusElementWithoutScroll` uses `focus({preventScroll:true})` with a fallback.

**Toggle state:** `aria-pressed` on mode buttons, viewed toggles, beats, rail beats,
drift files, and the read-aloud button; `aria-expanded` on the sidebar toggle and the
drift trigger; `aria-selected` + roving `tabindex` on both tablists;
`aria-busy` on lazily loading panels, gaps, and the read-aloud button.

**Screen-reader-only equivalents:** `[data-annotation-summary]` describes the
decorative annotation SVG in prose; `[data-speech-concept]` mirrors the concept
narration; the hotspot flag prefixes "Author-flagged hotspot: ".

**Decorative:** `aria-hidden="true"` on `.ds-celldiv` (until one is promoted to the
separator), all icon spans, `.ds-filmnode-num`, `[data-filmthread-tooltip]`, the
review-tab flag, and the command scrim.

---

## 12. Animations

Anything asserted in `test/motion-regressions.test.mjs` is a **hard requirement**.

**Timing scale** (from `sharedTokens()` in `src/theme.ts`, asserted exactly):
`--motion-ease-out: cubic-bezier(0.23,1,0.32,1)`,
`--motion-ease-in-out: cubic-bezier(0.77,0,0.175,1)`,
`--motion-ease-drawer: cubic-bezier(0.32,0.72,0,1)`,
`--motion-duration-press: 120ms`, `--motion-duration-fast: 150ms`,
`--motion-duration-ui: 200ms`, `--motion-duration-progress: 250ms`,
`--motion-duration-spatial: 340ms`.

**Workspace handoffs** — `runWorkspaceTransition(kind, direction, update)`:
* Reduced motion → run `update()` synchronously, no animation.
* No `document.startViewTransition` → `runWorkspaceFallback`: add
  `is-workspace-entering` + `data-ds-enter-direction` to the newly visible surface,
  cleared by a timer (210 ms for `mode`, 350 ms otherwise).
* Otherwise: `skipTransition()` any in-flight transition, stamp
  `data-ds-motion="<kind>"` and `data-ds-motion-direction="1|0|-1"` on `<html>`,
  run `document.startViewTransition(update)`, and clear the attributes on
  `finished` (guarded by `workspaceTransitionToken`).
* Kinds in use: `view` (`setView`), `file` (`selectFile`), `step` (`activateStep`),
  `mode` (`setMode`, direction 0).
* CSS: `view-transition-name: ds-workspace-surface` on the visible surface,
  `::view-transition-old/new(ds-workspace-surface)` with
  `ds-workspace-{old,new}-{next,prev,fade}` keyframes at
  `--motion-duration-spatial` / `--motion-ease-drawer`.
* `ds-review-chrome-in` / `ds-review-layout-in` must **not** use `both` fill.

**Change-jump marker** — one stable class, no keyframes, no cleanup timer:
`.ds-row.is-change-jump,.ds-urow.is-change-jump{box-shadow:inset 0 0 0 1px var(--accent-blue)}`.
The previous marker is removed (along with `aria-current`) when the next jump happens.
Asserted: no `dsChangeJump` keyframe, no `setTimeout` clearing it, no `1300`.

**Focus scrolling** — `centerFocusRows` cancels any pending timer/frame, filters to
rendered rows (`!closest(row,'[hidden]') && getClientRects().length > 0`), picks the
midpoint of the rendered candidates, waits 120 ms (0 if instant), then a rAF, then
`scrollTo({behavior: instant||prefersReducedMotion() ? 'auto' : 'smooth'})`.
`scrollReviewRowVertically` in `DIFF_JS` mirrors this. **`scrollIntoView` is banned**
(it scrolls horizontal ancestors and shoves the diff sideways).

**Read-aloud transport** — static masked-SVG glyphs, never animated. Pause draws
exactly two rounded bars whose gap is wider than a bar.
`.ds-readaloud.is-speaking .ds-readaloud-ico{animation:none;box-shadow:0 0 0 3px var(--accent-soft)}`.
`.ds-narration-stop` is absolutely positioned **above** the play button
(`bottom: calc(100% + 14px); left: 0; width: 62px; height: 32px`, `z-index: 13`)
with `::after{content:"Stop"}`. `.ds-row.is-voice-focus` / `.ds-urow.is-voice-focus`
carry **no** `animation` and no `filter`.

**Drawers** — scrim `opacity` over `--motion-duration-ui`/`--motion-ease-out`;
panel `translateX(100%) → 0` over `--motion-duration-progress`/`--motion-ease-drawer`.
`showDrawerRoot` clears any pending hide timer, unhides, activates the modal, adds
`is-open` in a rAF, focuses on a tick. `hideDrawerRoot` removes `is-open`,
deactivates, and re-hides after `prefersReducedMotion() ? 200 : 250` ms.

**Reading progress** — `.ds-readhead-fill` is `width:100%; transform:scaleX(0);
transform-origin:left center; transition:transform var(--motion-duration-progress)
var(--motion-ease-in-out)`, driven by `pf.style.transform='scaleX('+ratio+')'`.
Setting `style.width` is forbidden.

**Instant surfaces** — `.ds-composer` and `.ds-feedback-card` must have **no**
`animation` and no `transition`.

**Filmstrip** — dock magnification via `--ds-dock-scale` / `--ds-dock-lift`
(smoothstep over 96px), disabled under reduced motion and coarse pointers;
`--thread-pct` fill measured from the active node.

**Other keyframes:** `ds-body-in` (mode swap in a file panel), `ds-review-pop-in`,
`ds-tri-spin` (pending pill, disabled under reduced motion), `dsPulse`,
`dsReloadSpin`, `dsShimmer` (skeletons `.ds-sk`, disabled under reduced motion),
`dsSpin`.

**Reduced-motion contract:** toast keeps opacity only; `.ds-readhead-fill`
transition off; `.ds-readaloud.is-loading .ds-readaloud-ico` and `.ds-composer`
animation off; `.ds-live-banner` transition off; voice-focus rows
`animation:none!important; filter:none!important`; the progress panel's spinners off.
Status feedback is kept, movement removed.

---

## 13. Mermaid rendering (the one client-side HTML injection point)

Pipeline, in `page-assets.ts:1146–1198`:

1. **Server** emits, inside a concept step's `<figure class="ds-concept-diagram"
   data-concept-diagram>`:
   * `div[data-mermaid-output][role=img][aria-label="<caption text>"]` with a
     "Drawing the mental model…" placeholder,
   * `pre[data-mermaid-source] hidden` containing the **HTML-escaped** source,
   * `<figcaption>` with the sanitized caption HTML,
   * `<details data-mermaid-fallback>` with the escaped source as `<pre><code>`.
2. **`mermaidModule()`** dynamically `import()`s `/assets/mermaid.esm.min.mjs` —
   same-origin, served by `sendMermaidBrowserAsset` with
   `Content-Type: text/javascript`, `Cache-Control: public, max-age=3600`. The CSP
   is `script-src 'self' 'unsafe-inline'`, so no CDN is reachable. Initialised once
   with `{startOnLoad:false, securityLevel:'strict', htmlLabels:false,
   suppressErrorRendering:true, maxTextSize:8000, maxEdges:120,
   theme: dark?'dark':'default', flowchart:{htmlLabels:false, useMaxWidth:true}}`.
3. **`renderConceptDiagrams(panel)`** guards on `data-render-state` (so a figure is
   rendered at most once), sets it to `loading`, calls
   `mermaid.render('ds-mermaid-' + (++mermaidRenderId), text)`.
4. **`sanitizeMermaidSvg(svg)`** — the security boundary:
   * Parses with `new DOMParser().parseFromString(svg, 'image/svg+xml')`.
   * **Rejects** anything whose document element is not local-name `svg` in the
     `http://www.w3.org/2000/svg` namespace (`throw new Error('invalid diagram SVG')`).
   * **Removes** every `script`, `foreignObject`, `iframe`, `object`, `embed`,
     `image`, and `a` element.
   * **Removes** any `<style>` whose text contains `@import`, `javascript:`, `data:`,
     or `http(s):`.
   * For the root and every descendant, removes: any attribute whose name starts with
     `on`; any `href`/`xlink:href` not starting with `#`; any attribute whose **value**
     matches `javascript:|data:|https?:`; and any `style` containing `url(` that is not
     `url(#…)`.
   * Re-serialises with `XMLSerializer` and returns a string.
5. **Insertion:** `output.innerHTML = sanitizeMermaidSvg(result.svg)`, then
   `data-render-state="ready"`.
6. **Failure:** `data-render-state="error"`, `is-error` class, the output becomes the
   plain-text sentence "The diagram could not be drawn. Its caption and source are
   preserved below.", and the fallback `<details>` is forced open. The caption and the
   escaped source therefore always survive.
7. **Theme changes:** a `ds-theme-change` document listener nulls
   `mermaidModulePromise`, clears `data-render-state`/`is-error`/output on every
   figure, and re-renders — so the diagram follows light/dark.

Render triggers: `activateStep` (`renderConceptDiagrams(ap)`), the step-panel lazy
load, and the theme-change listener.

**Security properties to preserve verbatim in the rewrite:** the XML-namespace check,
the element blocklist (note `image` and `a` are blocked, not just `script`), the
`on*` attribute strip, the scheme check on *every* attribute value, the `url()`
restriction in `style`, the `@import` check in `<style>`, and the reparse-then-
serialize round trip. Mermaid's own `securityLevel: 'strict'` + `htmlLabels: false`
is defence in depth, not the boundary. Note that `render.ts`'s header comment names
this as "the one client-side HTML insertion" — but in practice the client also does
`innerHTML` with **server-produced** fragments from the lazy endpoints (section 8),
which are trusted because they come from the same origin under a validated lease.

---

## Proposed React component tree

```
<ReviewApp>                                  data from #__DIFFSTORY_DATA__ (ReviewModel + page facts)
├── <ReviewProviders>                        lease/token, view state, comments store, live SSE,
│                                            reading-position store, motion prefs
│
├── <ReviewChrome>                           header  — custom (beUI has no app bar)
│   ├── <SidebarToggle/>                     beui motion/button
│   ├── <CloseStoryLink/>                    plain <a>
│   ├── <TitleBlock/>                        custom
│   ├── <ViewTabs/>                          beui motion/morphing-tabs  (Story | Files | Review)
│   │   └── <ReviewTabBadge/>                beui motion/animated-badge + animated-number
│   ├── <ThemeToggle/>                       beui motion/theme-toggle (already wired to ds-theme)
│   └── <ReloadDiffButton/>                  beui motion/button (stateful variant)
│
├── <LiveBanner/>                            beui motion/notification-stack  (single-slot)
├── <StoryReloadToast/>                      beui motion/animated-toast-stack
├── <ToastHost/>                             beui motion/animated-toast-stack
├── <ProgressPanelHost/>                     existing ProgressPanel (other agent's surface)
│
├── <ReviewLayout>                           CSS grid, --ds-rail-width
│   ├── <Sidebar>                            custom shell (beui has no resizable rail)
│   │   ├── <ResumeReviewButton/>            beui motion/button
│   │   ├── <OverviewCard/>                  custom
│   │   ├── <ReadingProgress/>               beui motion/scroll-progress (repurposed) — must keep scaleX
│   │   ├── <FileToolbar>                    beui motion/input (search) + motion/popover (filter menu)
│   │   ├── <StoryRail>                      custom
│   │   │   ├── <RailChapter/>               beui motion/bouncy-accordion  (>10-step compaction)
│   │   │   ├── <StepCard/>                  custom
│   │   │   └── <RailBeatList/>              custom
│   │   ├── <FileTree/>                      custom (beui table/ is tabular, not a tree)
│   │   └── <SidebarResizer/>                custom (role=separator + keyboard)
│   │
│   └── <MainViews>
│       ├── <StoryView>
│       │   ├── <OverviewPanel/>             custom; <DriftTrigger/> → beui motion/tooltip
│       │   │   └── <StoryGenerator/>        (storyless) beui motion/{select,checkbox,input,button}
│       │   ├── <StepPanelList>              renders lazy stubs; only the active panel mounts content
│       │   │   ├── <CodeStepPanel>
│       │   │   │   ├── <StepHeader/>         custom; <RepairMenu/> → beui motion/popover
│       │   │   │   ├── <HotspotFlag/>        beui agents/agent-disclosure (note tier)
│       │   │   │   ├── <DiffToolbar/>        beui motion/morphing-tabs (Unified|Split|Full)
│       │   │   │   ├── <ChangeNav/>          beui motion/overflow-actions + number-ticker
│       │   │   │   └── <DiffSurface/>        ***dangerouslySetInnerHTML*** + one delegated handler
│       │   │   │       └── <AnnotationLayer/> custom SVG painter (rAF + ResizeObserver)
│       │   │   ├── <ConceptStepPanel>
│       │   │   │   ├── <ConceptBody/>        dangerouslySetInnerHTML (server-sanitized narrative)
│       │   │   │   └── <MermaidFigure/>      custom (sanitizeMermaidSvg must be ported verbatim)
│       │   │   └── <StepSkeleton/>           beui agents/loading-states (thinking-shimmer)
│       │   └── <FilmstripDock>               beui motion/dock  (magnification is native to it)
│       │       ├── <NarrationTransport/>     custom (Aloud state machine)
│       │       ├── <DockStage><BeatDock/>    custom — replaces the DOM-adoption hack with a portal
│       │       └── <FilmThread/>             beui motion/dock + motion/tooltip
│       │
│       ├── <FilesView>
│       │   └── <FilePanel>                   one mounted at a time
│       │       ├── <FilePanelHead/>          custom + <ViewedToggle/> → beui motion/switch
│       │       ├── <ModeTabs/>               beui motion/morphing-tabs
│       │       └── <DiffSurface/>            ***dangerouslySetInnerHTML***
│       │
│       └── <ReviewView>
│           ├── <ReviewSummary/>              custom + <TrustPill/> (custom, six states)
│           ├── <ReviewTabs/>                 beui motion/tabs
│           ├── <CoveragePanel>
│           │   ├── <CoverageStats/>          beui motion/animated-number
│           │   ├── <UnexplainedSection/>     beui motion/bouncy-accordion + agents/citations
│           │   ├── <StagedStateSection/>     beui agents/approval-card (blocking tone)
│           │   └── <ExclusionsSection/>      beui motion/checkbox + agents/tool-result (preview)
│           ├── <CommentQueuePanel>
│           │   └── <FeedbackCard/>           beui agents/citations (anchor badge) + motion/button
│           ├── <ChallengePanel/>             beui motion/checkbox
│           └── <ActionsPanel/>               beui motion/button
│
├── <DriftDrawer/>                            beui motion/drawer
├── <CommandPalette/>                         beui motion/command-palette
├── <SelectionMenu/>                          beui motion/context-menu
└── <CommentComposer/>                        portal, anchored after the row — custom
```

**Where beUI does not fit (build custom):**
* The **diff surface** itself. It stays server HTML; no beUI component participates.
  `agents/file-diff` is a *presentational* diff renderer with its own line model and
  cannot host our rows — do not try to reconcile the two.
* `agents/code-block` / `agents/agent-code` are unwired for highlighting (the vendor
  README's `highlightedHtml` seam). Useful for the concept-step fenced code and the
  excluded-file preview, **not** for diff rows.
* **Resizable sidebar** and **resizable split divider** — no beUI equivalent; both
  have real ARIA separator contracts.
* **File tree** — `motion/table` is a virtualized data table, not a tree.
* **Trust pill** — a six-state verdict control with its own precedence; custom.
* **Filmstrip thread fill** (`--thread-pct` measured from a rendered node centre) —
  `motion/dock` gives magnification but not the progress rail.
* **Beat dock adoption** — today the dock is physically moved into the island. In
  React this should become a **portal**, which is strictly better; but `beatHost` /
  `beatPanel` logic must be replaced by explicit props, not deleted.
* **Narration transport** — the Aloud intent state machine (intent vs observation) is
  application logic, not a component.
* **Workspace view transitions** — `document.startViewTransition` with the
  `data-ds-motion` / `data-ds-motion-direction` attribute protocol. Motion 11 has no
  equivalent; keep the existing implementation and its reduced-motion fallback.
* **Modal background inerting** (`modalStack` + snapshots) — beUI's drawer/popover do
  not inert the rest of the document; port the existing stack.

---

## At risk in the rewrite — ranked

1. **The `[data-step-speech-cache]` block in lazy step stubs.**
   It is `sr-only`, invisible, and looks like dead markup — but it is the only reason
   narration can plan a 300-step story without fetching 300 panels. Losing it turns
   "Play" into a stampede of requests. *Why it's missed:* nothing visual changes when
   you delete it, and no test renders a 300-step story.

2. **The per-story reading-position key.**
   `ds-review-ui:<scope>:<storyKey>` — the `storyKey` half was added by commit 2156520
   precisely because the scope-only key replayed one story's position into another.
   A rewrite that "cleans up" the key into a scope-only one silently reintroduces the
   bug. *Why it's missed:* the wrong behaviour only appears when two stories share one
   `base..head`, which never happens in a single-story test fixture.
   (`comments-client.test.mjs:155` guards the *string*, not the behaviour.)

3. **The full `data-*` contract on rows, especially `data-move`, `data-step-focus`,
   and `data-step`.**
   `data-file`/`data-line`/`data-side` are obvious; `data-move` (annotation geometry),
   `data-step-focus` (beat focus groups), and the regex-injected `data-step` on
   *unified* story rows are not. Dropping `data-step` breaks comment→step attribution
   silently; dropping `data-step-focus` makes every beat highlight the whole hunk.
   *Why it's missed:* they are consumed by measurement code, not by click handlers, so
   nothing throws.

4. **Keyboard-shortcut precedence for `←`/`→`.**
   Five handlers compete for the arrow keys in a specific order (rail beat → story
   beat → speech beat → panel beat → change navigation), and `Space` has a two-branch
   guard so it does not double-fire on the read-aloud button. A React rewrite that
   attaches per-component key handlers will get the precedence wrong and produce
   "arrow keys jump changes instead of beats" — the exact regression
   `render-page.test.mjs:1793` exists to prevent.

5. **The 409 / `reloadRequired` lease path on *every* lazy request.**
   Six endpoints, each with an inline error surface that must offer "Reload review"
   rather than "Retry" when the lease is stale. It is easy to write a generic React
   fetch hook that renders one generic error and loses the distinction — which means a
   reviewer retries forever against a dead lease, or worse, sees stale evidence.

6. **Honest coverage pending state.** The `is-unknown` pill, `data-trust-uncovered=""`
   meaning "no verdict", and `markCoverageUnavailable()` all exist so the page never
   calls an unchecked change "covered". A rewrite that defaults `uncovered` to `0`
   turns an unknown into a green check.

7. **Hash-bound reviewed marks.** `viewedFiles[path] === reviewHashForFile(path)`, the
   conflict guard when the rail and the panel disagree, and the legacy `string[]`
   migration. Simplifying to a `Set<path>` makes a mark survive a code change.

8. **Selection constrained to one diff side**, including the `body.ds-selecting-*`
   `user-select:none` CSS and the null-returning guards in
   `currentSelectionContext()`. Losing it produces comments whose `selectedText`
   interleaves before and after code.

9. **Mermaid sanitizer completeness** — specifically the `image` and `a` element
   removal, the scheme check on *every* attribute value (not just `href`), and the
   `url(` check in `style`. A "simplified" sanitizer that only strips `<script>` and
   `on*` is a real XSS hole at the one client-side injection point.

10. **`scrollIntoView` is banned.** `scrollReviewRowVertically` / `centerFocusRows`
    exist because `scrollIntoView` scrolls horizontal ancestors and shoves the split
    diff sideways. Any React helper that reaches for `scrollIntoView` reintroduces it.

11. **Dock adoption / `beatHost` indirection.** The beat dock lives in the island but
    belongs to a step. If the rewrite renders it inside the step panel again, the
    "one bar, not two" island design regresses and the dock scrolls with the diff.

12. **`aria-keyshortcuts="C"` and the row `aria-label` composition.** Purely
    server-side strings, easy to drop when the row renderer is "tidied".

13. **Per-generation live-banner dismissal.** `liveDismissed[kind] ===
    liveGenerations[kind]` — a naive `dismissed: boolean` makes the banner never
    return after the first dismissal, so the reviewer stops being told the diff moved.

14. **The 4-second grace before the "disconnected" banner** and the
    `pageshow`/`persisted` reopen. Without them the banner flashes on every transient
    drop, and a bfcache restore leaves the page silently stale.

15. **`data-mode-user-set`.** One attribute that stops `applyResponsiveStoryMode` from
    fighting a reviewer who deliberately chose Split on a narrow screen.
