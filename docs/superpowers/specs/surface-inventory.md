# diffStory surface inventory (pre-React-rewrite)

Date: 2026-08-09
Status: Reference document for the beUI/React rewrite
(`2026-08-09-beui-react-rewrite-design.md`)

**Purpose.** `src/picker.ts`, `src/story-picker.ts`, `src/change-page.ts`,
`src/progress-ui.ts`, `src/page-assets.ts` and most of `src/render.ts` are about
to be deleted. This file records the behaviour they contain so it can be
re-implemented rather than rediscovered. It is a reference, not prose.

**Conventions used below**

- `CONFIRMED` — read directly out of source or asserted by a test.
- `INFERRED` — my reading, not directly asserted anywhere. Verify before relying on it.
- `TEST-LOCKED` — an existing test asserts it; the assertion will be rewritten, but
  the *behaviour* is a hard requirement.

**Scope note.** The four assigned surfaces are covered in full. The review page
(`render.ts` + `PAGE_CSS`/`PAGE_JS`) is only covered where it is genuinely shared
(theme, nav, tokens, toasts) or where it *hosts* the progress panel. The review
page needs its own inventory; §6 of "At risk" flags that.

**Correction to the brief.** `/api/events` is **Server-Sent Events**, not NDJSON
(`text/event-stream`, `event:`/`data:` frames, consumed with `EventSource`). NDJSON
is the *progress* stream — the response body of `POST /api/generate` and
`POST /api/story/repair`, consumed by `runProgress()`. Two different protocols.

---

## 1. Repo picker — `src/picker.ts`

Route: `GET /repos` (also the fallback body for `/`, `/change`, `/review` when no
repo is open — `server.ts:pickerStub()`).
Render entry: `renderPicker(recents: RecentRow[], home: string, now: number)`.
Data: `recentRowsForPicker(home)` → `{ path, name, isGit, hasTour, currentBranch,
changedFiles, lastOpened }[]`.

### 1.1 Layout & elements (visual order)

1. `<body class="ds-map-bg">` — fixed dot-grid backdrop, masked to fade out
   downward (`threadAtmosphereStyles()`).
2. `<main class="wrap" id="pickerMain">` — `width:min(820px,100%)`, flex column.
   **This element is the modal's inert background target.**
3. **Hero** (`.hero.reveal.d1`, `min-height:168px`, bottom hairline):
   - `HERO_THREAD` — animated Thread-Path SVG backdrop, `position:absolute`,
     `z-index:0`, `pointer-events:none`.
   - `.head` — brand mark SVG (34×34) + wordmark `diff`(muted)/`Story`(bold) +
     kicker `the story of this change` (mono, uppercase, `.22em` tracking, accent).
     Sits on a solid `--bg` plate so the thread reads as passing *behind* it.
   - `themeControl()` pushed right (`margin-left:auto`), also on a solid plate
     (`box-shadow:0 0 0 6px var(--bg)`).
4. **Repositories section** (`.manager.reveal.d2`, `margin-bottom:56px`):
   - `.section-head`: `<h2>Repositories</h2>` + `#quickAddBtn`
     (pill, accent fill, plus icon + label "Add repository";
     `aria-label="Add repository"`, `title="Add repository"`).
   - `#recent` — the stack.
   - `#skillWarn` (`.launchwarn`, `hidden` by default) — text span
     `#skillWarnText` (`role="status" aria-live="polite" aria-atomic="true"`) +
     `#skillUpdateBtn` "Update skills".
   - `#msg` — `<p class="sr-only" role="status">`. **Screen-reader only.** All
     open/remove feedback goes here and is invisible to sighted users. `INFERRED`
     that this is deliberate; it is definitely current behaviour.
5. **Modal** `#scrim` — see §1.3.
6. `<template id="ico-folder">`, `<template id="ico-go">` — cloned by JS.

**Repo row** (`.repo-row`, grid `minmax(0,1fr) 44px`):
- `button.repo-card[data-open=<abs path>]`:
  - `.lg-num` — zero-padded ordinal (`01`, `02`…), mono, `--numeral` colour,
    `aria-hidden`. Missing rows use `--numeral-dim`. Numbering is continuous
    across available → missing (missing rows start at `available.length + i`).
  - `.tile` — 38×38 rounded folder icon, accent-soft bg. Missing → neutral fill.
  - `.card-body`: `.name` (ellipsised) + optional status pill; `.path`
    (home-relative, middle-truncated at 46 chars → `first16…last27`, mono,
    `title=` holds the full path); `.card-meta` — branch (with branch glyph),
    `N changed file(s)`, relative time, joined by `·` separators.
  - `.chev` right chevron.
- `button.remove-btn[data-remove-repo=<abs path>]` — 44px trash button,
  `title="Remove from recent repositories"`,
  `aria-label="Remove <name> from recent repositories"`. Hover → red tint.

**Status pill.** Only one exists: `Missing` (`.pill-missing`, red) when
`!isGit`. `pill-ready`/`pill-none` CSS exists but is dead — tour status was
deliberately removed ("Tour status is an internal concept and confused users").

**Relative time** (`relativeTime`): `just now` (<60 s) → `N min ago` → `N hr ago`
→ `yesterday` → `N days ago`.

**Missing group.** Non-git recents collapse into
`<details class="missing-group">` with summary
`<span data-missing-count>N unavailable workspace(s)</span> ⌄`. The chevron
rotates 180° when open. `.repo-row-missing` sets `opacity:.68`.

**Empty state** (no recents at all): dashed-border card, folder glyph in a 52px
tile, "No repositories yet", "Point diffStory at any local Git repository — it
reads the working tree directly, nothing is uploaded."

### 1.2 Interactions

| Trigger | Effect |
|---|---|
| Click `.repo-card` | `open(path)` → `#msg` = "Opening…" → `POST /api/repo/open {path}`. On 2xx: `location.href = d.route` (fallback `'/repo/'+encodeURIComponent(basename)+'/stories'` — TEST-LOCKED). On error: `#msg` red + `d.error` or "Could not open that path." Fetch rejection → "Could not reach the server." |
| Click `.remove-btn` | `preventDefault` + `stopPropagation`, button `disabled=true` + `aria-busy="true"`, `DELETE /api/repos/recent {path}`. Success → remove `.repo-row` from DOM, `syncRecentUi()`, `#msg` = "Removed from recent repositories." Failure → re-enable, clear `aria-busy`, red `#msg`. Handlers are bound **per button**, not delegated (TEST-LOCKED: `doesNotMatch(/e\.target\.closest\('button\[data-remove-repo\]'\)/)` — a delegated handler broke on WebKit nested targets). |
| `syncRecentUi()` | Recounts `.repo-row` inside `.missing-group`; removes the whole `<details>` when it hits 0; else rewrites the count label with correct pluralisation. If **no** `.repo-row` remains anywhere, replaces `#recent` innerHTML with the empty state (rebuilt client-side from the `ico-folder` template). TEST-LOCKED. |
| Page load | `POST`-less `GET /api/agents` → `showSkillState(d.skills)`. Failures are swallowed silently. |
| `showSkillState` | Three branches: `legacyInstalled` → "review-tour was renamed to diffstory-storyteller. Update skills to remove the retired copy and finish migration." (TEST-LOCKED); `current` → hide the whole warning; otherwise → "Story-generation skill is installed but does not match this app…" (if `installed`) or "Story-generation skill was not found in ~/.agents, ~/.claude, or ~/.codex…". |
| Click `#skillUpdateBtn` | disable, label → "Updating…", status → "Installing bundled diffStory skills locally…", `POST /api/skills/update`. Success → `showSkillState(d.skills)`. Failure → re-enable, label "Try again", text "Could not update skills. Run scripts/install-skills.sh from this repo, or re-run the diffStory installer." |
| Click `#quickAddBtn` | `openModal(e)` |

### 1.3 Folder-browser modal (`#scrim`)

`role="dialog" aria-modal="true" aria-label="Choose a repository folder"
tabindex="-1" hidden`. TEST-LOCKED in `picker.test.mjs`.

Structure: `.sheet` (max 560px, `max-height:76vh`)
1. `.sheet-head` — "Choose a repository" + `#fsClose` (`aria-label="Close"`, `✕`).
2. `#crumbs` — breadcrumb trail, rebuilt on every `render()`. Root is always `/`.
   Non-current segments are `<button>`; the current segment is a `<span>` with
   `aria-current="location"` (TEST-LOCKED). Separator `<span class="crumb-sep">/`.
3. `.fssearch` — `#fsSearch` `type="search" role="combobox"
   aria-autocomplete="list" aria-haspopup="listbox" aria-expanded
   aria-controls="fslist" aria-label="Filter folders in this location"`
   placeholder `Filter folders`; `#fsClear` clear button
   (`aria-label="Clear folder filter"`, `hidden` when empty — both `hidden`
   attribute *and* `.show` class, so it also leaves the tab ring, TEST-LOCKED);
   `#fsSearchStatus` `.sr-only role="status" aria-live="polite"`.
4. `#fslist` `role="listbox" aria-label="Folders in this location"`.
5. `.sheet-foot` — `#footPath` (current absolute path, mono, ellipsised) +
   `#openHere` primary button.

**`browse(path)`** — resets search/filter/selection state, sets
`#fsSearchStatus` = "Loading folders…" and `#fslist` = "Loading…", then
`GET /api/fs[?path=…]` → `render(listing)`. Error → both nodes read
"Could not read that folder." (TEST-LOCKED both strings).
Listing shape (`fs-browse.ts:listDirs`): `{ path, parent, isGit, entries:
[{name, path, isGit}] }`, directories only, dotfiles filtered out, `localeCompare`
sorted. `?path` omitted ⇒ server uses `home`.

**`render(l)`** — sets `cur`/`curGit`, rebuilds crumbs, copies `entries`,
`renderEntries()`, sets `#footPath`, and sets `#openHere`
`disabled = !curGit` with label `Open this folder` / `Not a git repo`.
If the scrim is already `.show`, re-focuses `#fsSearch`.

**`renderEntries()`** — case-insensitive `indexOf` substring filter on
`en.name`. Filtered-empty message: `No folders match “<query>”.`; unfiltered
empty: `No subfolders here.` Each row is a
`<button class="fsrow" tabIndex="-1" role="option" aria-selected id="fs-entry-N">`
containing a folder glyph, the name, and either a green `repo` badge (`isGit`)
or a chevron. Status text: `N folder(s) shown.`

**Row activation** (`activateEntry`): `isGit` → `open(path)` (leaves the page);
otherwise → `browse(path)` (descend).

**`mouseenter`** on a row → `selectEntry(index, false)` (hover moves the
active-descendant, without scrolling).

**`#openHere`** click → `open(cur)` only when `curGit`.

**Scrim click** — closes only when `e.target === scrim` (not a child).

### 1.4 Keyboard — repo picker

Scope: `#fsSearch` `keydown`.

| Key | Effect |
|---|---|
| `ArrowDown` / `ArrowUp` | `moveSelection(±1)`, **wrapping** (`(i+d+n)%n`); from `-1` jumps to first/last. `preventDefault`. Scrolls selection into view (`block:'nearest'`). |
| `Home` / `End` | Select first / last entry, scroll into view. `preventDefault`. |
| `Enter` | Activate `filteredEntries[selectedIndex]` when `selectedIndex >= 0`. |
| `Escape` | `preventDefault` + `stopPropagation` + `closeModal()`. |

Scope: `document` `keydown` → `trapModalFocus`.

| Key | Effect |
|---|---|
| `Escape` | `closeModal()` (no-op when `scrim.hidden`). |
| `Tab` / `Shift+Tab` | Focus trap. `modalFocusables()` = `button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])` inside the scrim, minus `hidden`, `aria-hidden="true"`, and `tabindex="-1"` nodes — **listbox options are deliberately excluded from the tab ring** (TEST-LOCKED). Empty set → `preventDefault` + focus the scrim itself. Wraps first↔last, and pulls focus back in if it has escaped the scrim. |

Typing anything else in the field fires `input` → `selectedIndex = value.trim() ? 0 : -1` then `renderEntries()`.

**No global keyboard shortcuts exist on the picker outside the modal.** No
`/`, no `?`. `INFERRED` gap, not a deliberate design record.

### 1.5 Client-side state — repo picker

In-memory only: `cur` (current dir), `curGit`, `entries`, `filteredEntries`,
`selectedIndex`, `modalTrigger` (focus-restore target), `modalCloseTimer`.

- **localStorage:** only `ds-theme` (shared, §5.1).
- **sessionStorage:** none.
- **URL:** none. No query params, no hash, no `pushState`. Navigation is a full
  `location.href` assignment.
- Recents persistence is entirely server-side (`~/.diffstory` recents store via
  `/api/repos/recent`), not client storage.

### 1.6 Live/streaming — repo picker

None. No `EventSource`, no polling. The page is a static snapshot; a repo whose
`isGit` flips while the page is open will not update.

### 1.7 Animations & transitions — repo picker

TEST-LOCKED in `picker.test.mjs` ("picker motion connects the page and folder
sheet without overriding reduced motion").

| Thing | Motion |
|---|---|
| `.reveal` sections | `@keyframes up` — `translateY(7px)`+`opacity:0` → none, `var(--motion-duration-spatial)` (340 ms) `var(--motion-ease-out)`, `backwards`. Stagger `.d1 .02s`, `.d2 .07s`. (`.d3 .12s`, `.d4 .17s` are defined but currently unused.) Wrapped in `@media (prefers-reduced-motion:no-preference)`. |
| `.repo-card` | `transform`/`background`/`border-color` at `--motion-duration-fast` (150 ms). `:active{transform:scale(.992)}`. |
| `.btn` | `background` fast + `transform` press (120 ms); `:active{scale(.97)}`. |
| `.scrim` | `opacity` 200 ms + `visibility 0s linear 200ms`; `.show` sets `transition-delay:0s`. |
| `.sheet` | `transform-origin:50% 0`, from `translateY(12px) scale(.975)` + `opacity:0` → none, `transform` at `--motion-duration-spatial` with `--motion-ease-drawer`, `opacity` at `--motion-duration-ui`. |
| Hero thread | `ds-thread-draw` 1.4 s (stroke-dashoffset 100→0, .15 s delay), `ds-thread-nodes-in` .5 s at 1.2 s, `ds-thread-pulse` **11 s linear, 2 s delay, infinite, backwards** — the pulse timing is TEST-LOCKED verbatim. |
| Theme menu | `ds-anchored-pop` — clip-path wipe from the top-right + `translateY(-4px) scale(.96)`, `--motion-duration-ui`. |

**Reduced motion:** `.scrim`/`.sheet` transitions off, `.scrim.show .sheet`
lands at final transform/opacity, `.btn:active` transform off; thread pulse
`display:none`, thread nodes fixed at `opacity:.62`. The
`modalCloseTimer` also collapses to `0 ms` instead of `210 ms`.

**Open/close choreography (subtle, easy to break):**
- `openModal`: bail if already open and not mid-close; cancel a pending close
  timer; capture `modalTrigger` from `e.currentTarget` (else `document.activeElement`);
  `scrim.hidden=false`; inert the background; `aria-expanded="true"`;
  `browse(null)`; focus the search; **then** `requestAnimationFrame(() => scrim.classList.add('show'))`
  — the rAF is what makes the transition actually run. TEST-LOCKED.
- `closeModal`: bail if already hidden or mid-close; remove `.show`; un-inert;
  clear the search value; `aria-expanded="false"`; drop `aria-activedescendant`;
  hide `#fsClear`; **restore focus to `modalTrigger`**; then a `210 ms` (or `0 ms`
  under reduced motion) timer sets `scrim.hidden=true` — but only if `.show` was
  not re-added meanwhile. TEST-LOCKED.

### 1.8 Accessibility contracts — repo picker

All TEST-LOCKED unless noted.

- `#scrim`: `role="dialog"`, `aria-modal="true"`, `aria-label`, `tabindex="-1"`,
  `hidden` initially.
- `setModalBackground(true)` sets **both** `inert` and `aria-hidden="true"` on
  `#pickerMain`; `false` removes both.
- Full `Tab`/`Shift+Tab` trap; options excluded via the `tabindex!=='-1'` filter.
- Focus restore to the opening trigger on close.
- Combobox pattern: `role="combobox"` + `aria-autocomplete="list"` +
  `aria-haspopup="listbox"` + `aria-expanded` + `aria-controls="fslist"` +
  `aria-activedescendant` pointing at `fs-entry-N`.
- `#fslist` `role="listbox"`; rows `role="option"` + `aria-selected` maintained
  on every selection change.
- Live regions: `#fsSearchStatus` (polite, folder counts + load/error),
  `#skillWarnText` (polite, atomic), `#msg` (`role="status"`, sr-only).
- Breadcrumb current segment: `aria-current="location"`.
- Icon-only mobile "Add repository" keeps its `aria-label` (the label span is
  `display:none` under 760 px).
- `@media (prefers-contrast:more)` promotes borders on `.repo-card`,
  `.remove-btn`, `.ghost`, `input[type=search]`, `.sheet`, `.launchwarn` to
  `--label`.

### 1.9 Responsive — repo picker

| Breakpoint | Changes |
|---|---|
| `≤760px` | `.wrap` padding 24/16; hero `min-height:128px`; `.manager` bottom margin 40px; **`.add-btn span{display:none}`** (icon-only). |
| `≤480px` | Hero `align-items:center`, `min-height:0`; **hero thread hidden**; brand mark 28×28; `h2` 21px; `.repo-row` becomes `display:block` with `position:relative`; `.repo-card` gets `padding-right:54px`; **`.lg-num` hidden**; `.remove-btn` becomes an absolutely-positioned 34×34 overlay at top-right `z-index:2` with a `-5px` inset `::after` hit-slop (TEST-LOCKED). |

---

## 2. Story picker / Review history — `src/story-picker.ts`

Route: `GET /repo/<name>/stories` (`server.ts:407`).
Render entry: `renderStoryPicker({ repoName, routeBase, stories, now })`.
Data: `listStoryMetadata(repo)` normally, `listStories(repo)` when
`?evidence=refresh` — the difference is that the metadata projection **skips the
live diff/drift pass** (`liveEvidence:false`), which changes the badges (see below).
Sorted newest-updated first, tie-broken by id.

### 2.1 Layout & elements

1. `navBar({ home:'/repos', crumbs:[{repoName → routeBase+'/change'}, {'Review history'}],
   right: <a class="nv-act" href="…/stories?evidence=refresh"
   title="Recompute live diff and drift evidence for every saved review">Refresh evidence</a> })`.
2. `body::before` dot-grid backdrop (inlined here, not `ds-map-bg`).
3. `<main class="wrap">` — `width:min(960px,100%)`.
4. `.page-head`:
   - `.kicker` = repo name (mono, uppercase).
   - `.page-title-row` = `<h1>Review history</h1>` + `<a class="start-review"
     href="…/change">Start review</a>` — TEST-LOCKED that these are grouped and
     that exactly **one** "Start review" exists on the page.
   - `.sub` = "Resume a saved review when you need its scope or its notes."
   - `.history-status` (right, only when ≥1 story has open comments):
     `<b>N</b> review(s) has/have open notes` — TEST-LOCKED wording (it counts
     *reviews*, not notes).
5. Either `.stories-panel` (`aria-labelledby="saved-reviews-title"`) with
   `<h2 id="saved-reviews-title">N saved review(s)</h2>` and `#storyList`,
   **or** the empty state.

**Story row** (`<article class="story-row state-<cls>">`, optional `.row-bad`):
- `<a class="row-main" href="<routeBase>/review?story=<id>">` — grid
  `24px minmax(0,1fr) auto`, `min-height:132px`:
  - `.row-num` — `01`, `02`… `aria-hidden`, mono, `--numeral`. TEST-LOCKED.
  - `.row-body`:
    - `.row-head`: `.row-title` (from `narrativeText(s.title) || s.id`,
      single-line ellipsis) + `.badge` (state label).
    - `.row-sum`: 2-line clamp, `narrativeText(s.summary) || 'No summary yet.'`,
      or `s.error` / "This story file could not be read." when invalid.
    - `.session-facts`: `<b>liveFiles||files</b> files` ·
      (only when `liveEvidence`) `<b class="plus">+A</b> <b class="minus">−D</b>` ·
      `<b>max(0, steps-primers)</b> code stops[ + N primer(s)]` ·
      (only when non-zero) `<b>N</b> queued comment(s)`. Separated by left
      hairlines, not dots.
    - `.row-foot`: `.chip` scope label (with `title=` = the raw git command when
      present) · state detail · relative time.
  - `.resume` pill: "Resume review" + chevron.
- `<button class="row-del" data-delete-story=<id> data-story-title=<title>
  title="Remove story" aria-label="Remove <title>">` — absolutely positioned
  34×34 at top-right, `z-index:2`, `-4px` hit-slop. TEST-LOCKED geometry.

**State machine** (order matters — first match wins):

| Condition | Label | class | Detail |
|---|---|---|---|
| `!valid` | `Needs repair` | `bad` | "Story file cannot be read" |
| `!liveEvidence` | `Saved` | `saved` | "Open to inspect current review evidence" |
| `openComments` | `In review` | `feedback` | "N open note(s) waiting" |
| `freshness==='stale'` | `Story changed` | `warn` | "N story file(s) changed[ · N side file(s) also changed]" or "Regenerate the story for the current diff" |
| `freshness==='unverified'` | `Verify scope` | `warn` | "Regenerate to establish a scope-aware baseline" |
| else | `Current` | `ready` | "Story current · N side file(s) changed" or "Story matches its captured scope" |

Note `state-saved` has **no** badge colour rule — it falls through to the default
`--l2`/`--fill` badge. `INFERRED` that this is intentional (neutral), not a bug.

**Empty state:** `.empty` (dashed, max 460px, left-aligned), story mark glyph in
a 48px tile, `<h2>No saved reviews</h2>`, "Start from the current diff. A guided
story will appear here when you save one." The `Start review` link still exists
in the header. TEST-LOCKED.

### 2.2 Interactions

| Trigger | Effect |
|---|---|
| Click `.row-main` | Plain link navigation to `…/review?story=<id>`. Server side: `applyStoryChoice` sets `session.selectedStory`, clears `session.base/head`, and **persists the selection** via `recordStorySelection(home, repo, id)` so a restart resumes it. `?story=new` selects the storyless change view. |
| Click `.row-del` | Delegated on `#storyList`. `preventDefault` + `stopPropagation`, then **`window.confirm('Remove "<title>" from this repo?')`**. On confirm: disable the button, `DELETE /api/stories {id}`. Success → remove the `<article>`; if no `.story-row` remains, **`location.reload()`** (to render the empty state server-side). Failure → re-enable + **`window.alert(message)`**. |
| Click `Refresh evidence` | Full navigation to `?evidence=refresh`, which re-renders with `listStories()` (expensive live pass). |
| Click `Start review` / breadcrumb repo name | Navigate to `<routeBase>/change`. |
| Click nav wordmark | `/repos`. |

Server-side side effects of delete: removes the story file; clears the persisted
story selection if it pointed at this id; clears `session.selectedStory` and sets
`session.chooseStory` if the session was on it.

### 2.3 Keyboard — story picker

**None of its own.** The only key handling on this page is the shared theme-menu
handler (§5.1). Rows are anchors and buttons, so native `Tab`/`Enter`/`Space`
apply. There is no list-level arrow navigation, no `Delete` shortcut, no `/`
search. `CONFIRMED` by reading the whole file.

### 2.4 Client-side state — story picker

- In-memory: none beyond the delegated handler closure.
- localStorage: `ds-theme` only.
- sessionStorage: none.
- URL: `?evidence=refresh` is the only param the page itself produces. Outbound
  links carry `?story=<id>`.
- Persisted-across-sessions state lives server-side: the last-selected story per
  repo (`recordStorySelection`/`recallStorySelection`), restored on session start
  by `restoreStorySelection`.

### 2.5 Live/streaming — story picker

None. Snapshot only; needs a manual reload or `?evidence=refresh`.

### 2.6 Animations & transitions — story picker

TEST-LOCKED ("review history uses the shared spatial tier and keeps reduced
motion static").

- `.wrap` — `history-page-in` (`translateY(7px)`→none) at
  `--motion-duration-spatial` `--motion-ease-out` `backwards`.
- `.story-row` — `history-row-in` (`translateY(5px)`→none), same duration/easing.
  **Note: no per-row stagger** — every row animates simultaneously.
- `.story-row` transitions `border-color`, `box-shadow` (fast).
- `.row-main` transitions `background-color` (fast); `:hover` → `--fill-1`;
  `:active` → `--fill-2`.
- `.resume svg` transitions `transform` fast/ease-out; `.row-main:hover .resume svg`
  → `translateX(2px)`; `.row-main:hover .resume` background mixes 72% accent-soft
  with surface.
- `.row-del` transitions border/background/colour (fast) + transform (press);
  `:active{scale(.94)}`.
- **Explicitly absent** (TEST-LOCKED `doesNotMatch`): no `ds-thread-layer` /
  `ds-atmosphere-thread` in the history header, and no `state-rail` partial-edge
  status strip.
- Reduced motion: transitions off for `.row-main`, `.row-del`, `.start-review`,
  `.resume svg`; active/hover transforms off. (The two entrance keyframes live
  inside `no-preference`, so they don't run either.)

### 2.7 Accessibility contracts — story picker

- `.stories-panel` `aria-labelledby="saved-reviews-title"`.
- `.history-status` `aria-label="Review history status"`.
- `.row-num` `aria-hidden="true"`.
- `.row-del` `aria-label="Remove <title>"` + `title`.
- `.story-row:focus-within` sets an accent border; `.row-main:focus-visible`
  uses an **inset** 3px accent-soft ring (outset would be clipped by the card's
  `overflow:hidden`).
- Nav breadcrumb: current segment `aria-current="page"`; `<nav aria-label="Breadcrumb">`.
- `@media (prefers-contrast:more)` → `.story-row`, `.row-del` borders to `--label`.
- **Gap:** deletion uses native `confirm()`/`alert()`. Faithful replacement means
  either keeping the native dialogs or building an accessible confirm dialog —
  a silent behaviour change if a React version just deletes optimistically.

### 2.8 Responsive — story picker

| Breakpoint | Changes |
|---|---|
| `≤760px` | `.wrap` padding 22/16; `.page-head` top-aligned; `.row-main` grid drops the third column (`24px minmax(0,1fr)`), padding `16px 19px 15px`; `.row-head{padding-right:44px}` reserves *only the title row* for the delete button (TEST-LOCKED — the old full-height gutter was removed); `.resume` moves to `grid-column:2`, `justify-self:start`. |
| `≤560px` | `.page-head{display:block}`; `.history-status` gets `margin-top:14px`; `.empty{max-width:none}`. |
| `≤460px` | `.row-head` becomes a column (title above badge); `.row-title` becomes a 2-line clamp instead of single-line ellipsis; `.session-facts` line-height 1.65 and tighter padding; `.row-foot` becomes a 2-column grid with the `·` pseudo-separators removed and explicit cell placement (scope chip top-left, time top-right, detail spanning row 2). |
| Nav `≤560px` | `.nv-word` hidden (mark only), tighter padding. |

---

## 3. Change / scope page — `src/change-page.ts`

Route: `GET /repo/<name>/change` (and `/change` → redirect).
Render entry: `renderChangePage(sum: ChangeSummary, opts)`.
Query params consumed server-side by `resolveScope`: `scope`, `base`, `head`,
`commit`. `?scope=auto` clears the session scope.

### 3.1 Layout & elements

1. `navBar({ home:'/repos', crumbs:[{repoName → …/change}, {'Scope'}],
   right: <button id="reloadBtn" class="nv-act" title="Re-read the working tree
   and rebuild the diff" aria-label="Reload current scope">↻ <span
   class="reload-label">Reload</span></button> + <a class="nv-act nv-history"
   href="…/stories">History</a> })`. TEST-LOCKED that History is present and that
   the old "Review sessions" label is gone.
2. `body.ds-map-bg` dot backdrop. `<main class="wrap">` max 960px.
3. `.session-head`:
   - `.lede` — left: `.eyebrow` "Review session", `<h1>Choose what to review</h1>`,
     paragraph "Set the exact git scope, confirm the changed files, then start
     with the real diff. A guided story stays optional."
   - right: `.scope-metrics` (`aria-label="Current scope summary"`) — three
     `.metric` columns: total files, `+added`, `−removed`. Hidden below 980 px.
   - `.review-path` (`role="list" aria-label="Review workflow"`) — four
     `role="listitem"` stages `01 Scope` / `02 Read` / `03 Resolve` / `04 Decide`,
     with **exactly three** `<b aria-hidden="true">` connectors (TEST-LOCKED).
     Stage 01 has `class="active"` and `aria-current="step"`. Numerals are Space
     Grotesk in `--numeral-dim` (TEST-LOCKED — not circled badges).
4. `.notice` (only when `opts.notice`): amber, "**That review couldn't be
   loaded.** \<message\> Open the diff viewer below, then generate a fresh story
   from the Story tab."
5. `.layout` grid, single column:
   - `<section class="card scope-card" aria-label="Review scope">`:
     - `.sopts` (`role="group" aria-label="Review scope"`), 3 equal columns:
       - `<a class="sopt" href="…/change?scope=uncommitted">` — "Uncommitted" /
         "Working tree vs HEAD". Gets `aria-current="true"` when active.
       - `<button class="sopt" data-open-panel="commit" aria-controls="commitPanel"
         aria-expanded>` — "Single commit" / "Parent → selected commit".
       - `<button class="sopt" data-open-panel="compare" aria-controls="comparePanel"
         aria-expanded>` — "Compare any refs" / "Source → target, any branch or commit".
       - Active segment gets `.on` (accent-soft fill). Open-but-not-selected gets
         `.is-open` — a **separate** state so opening a panel never lies about the
         URL-backed selection (TEST-LOCKED: `doesNotMatch(/classList.remove\('on'\)/)`).
     - `#commitPanel` (`.refpanel[data-panel="commit"]`) — one `<label class="refrow">`
       "Commit" + `<input id="commitRef" data-picker="commit" role="combobox" …
       placeholder="HEAD or a commit SHA" value="<head ?? HEAD>">`, plus
       `.refhint` "Shows that commit against its first parent; root commits are
       shown against the empty tree."
     - `#comparePanel` (`.refpanel[data-panel="compare"]`) — two equal editor
       cells with a `.cmparrow` `→` between: "Source *older*" → `#cmpBase`
       (`data-picker="base"`), "Target *newer*" → `#cmpHead` (`data-picker="head"`).
       Both `role="combobox" aria-controls="refPicker"`, placeholder
       "branch, tag, or commit". TEST-LOCKED that the labels are Source/Target,
       **not** From/To.
     - **Scope summary** (rendered *below* the panels — TEST-LOCKED ordering, so
       the top of the layout stays anchored while the summary changes):
       - compare mode → `.scope-current.scope-current-split
         role="group" aria-label="Selected comparison"` with two `.scope-side`
         cells (`aria-label="Source: X"` / `"Target: Y"`) and a circular arrow.
         **CSS-hidden while the compare panel is open**
         (`#comparePanel:not([hidden]) + .scope-current-split{display:none}`) so
         the same two refs aren't shown twice. TEST-LOCKED.
       - otherwise → `.scope-current-single aria-label="Selected review scope"`
         with a kicker (`Selected scope` / `Selected commit` / `Selected comparison`)
         and the human scope label, single-line ellipsised.
     - `#refPicker` `.refpicker role="listbox" aria-label="Available git
       references" hidden` — `position:fixed`, positioned by JS.
   - `<section class="file-card" aria-label="Changed files">`.

**File summary card** (`hasChanges`):
- `.fsum` header: `<b>N</b> review file(s)[ · N generated]`, `+A −D`, and
  `<a class="openreview" href="<routeBase>/diff[?base=&head=]"
  aria-label="Start review of N file(s)">Review N files →</a>`.
- `.files` list (`max-height:min(58vh,620px)`, scrollable), one `.frow` per file:
  `.fp` path (dir in `--l3`, basename in `--label`, `title` = full path) +
  `.bar` (42×7 add/del proportion bar, `aria-hidden`; binary → 45° hatch
  `.bar-bin`) + `.fc` stat (`+N` / `−N`, or "binary / metadata" / "metadata").
- **Generated-output split**: paths matching
  `^(dist|build|coverage|out|target)/` or
  `(^|/)(*.generated.*|package-lock.json|yarn.lock|pnpm-lock.yaml)$` move into a
  collapsed `<details class="generated">` labelled "Generated output — N file(s) ⌄",
  indented and tinted. TEST-LOCKED that generated files stay out of the primary list.

**Empty state** (`!hasChanges`): `✓ working tree clean` (mono, add-green),
`<h2>Nothing to review</h2>`, "Pick another scope above, or make a change. When
your agent writes code, the changes appear here.", then two actions —
`<button onclick="location.reload()">Re-check</button>` and
`<a href="…/stories">Review history →</a>`.

### 3.2 Interactions

| Trigger | Effect |
|---|---|
| Click `#reloadBtn` | Disable the button, `location.reload()`. |
| Click `.sopt[data-open-panel]` | `showPanel(name)`: sets `hidden` on all `[data-panel]` except the named one; clears `.is-open` + `aria-expanded="false"` on every `[data-open-panel]`; sets `.is-open` + `aria-expanded="true"` on the clicked one; calls `ensureRefs()`. **Does not navigate.** |
| Click `.sopt` "Uncommitted" | Plain link → `?scope=uncommitted`. |
| Focus a `[data-picker]` input | `openPicker(input, '')` — opens `#refPicker` with an empty query. |
| Click a `[data-picker]` input | `openPicker(input, lastQuery)`. |
| Type in a `[data-picker]` input | Removes `data-worktree`, `openPicker(input, value)` → live substring filter over `value+label+meta+kind`, lowercased. Also schedules a **debounced navigation** (700 ms). |
| `focusout` on a picker input | If the next focus target is inside `#refPicker`, keep open; else `setTimeout(0)` re-check of `document.activeElement`, then `closePicker()`. |
| `mouseenter` a `.refpick-row` | `setActiveIndex(i, false)`. |
| `mousedown` a `.refpick-row` | `preventDefault()` — keeps focus on the input so `focusout` doesn't fire. **Load-bearing.** |
| Click a `.refpick-row` | `chooseRef(value)`: sets the input value (or `Working tree` + `data-worktree="1"` for `__WORKTREE__`), clears the stored query, **dispatches a bubbling `change` Event**, closes the picker. The `change` listener then navigates immediately. |
| `mousedown` anywhere else | Closes the picker unless the target is the picker, inside it, or the active input. |
| `resize` / capturing `scroll` | `placePicker()` re-anchors the fixed picker. |
| Change on `#commitRef` | `scheduleNavTo(commitUrl(), 0)` → `<routeBase>/change?scope=commit&commit=<encoded>` (defaults to `HEAD`). |
| Input on `#commitRef` | Same URL, 700 ms debounce. |
| Change/input on `#cmpBase`/`#cmpHead` | `compareUrl()` → `<routeBase>/change?base=<b>[&head=<h>]`. **Returns `''` (no navigation) when base is empty.** Head is omitted when `data-worktree="1"` or the literal value is `Working tree`. TEST-LOCKED with four explicit cases. |
| `scheduleNavTo` guard | Never navigates when the computed URL equals `location.pathname + location.search` — prevents a reload loop after the page comes back with the same scope. TEST-LOCKED. |

**Ref data.** `ensureRefs()` fetches `GET /api/refs` **once** (memoised via
`loaded` + a shared in-flight `refsPromise`); errors reset both flags so a retry
is possible. Response: `{ current, branches:[{name,kind}], commits:[{sha,subject,
refs,committedAt,committedAtLabel,committedAtRelative}] }`; bare-string branches
are normalised to `{name, kind:'branch'}`. Called on panel open, on picker open,
and on load when a panel is already visible.

**Option sets per input** (TEST-LOCKED per-field):
- Not yet loaded → a single non-selectable row "Loading refs… / reading local git refs".
- `data-picker="commit"` → `HEAD` (meta "current HEAD") then all commits.
- `data-picker="head"` → `Working tree` (`__WORKTREE__`, meta "HEAD plus
  uncommitted edits") then branches then commits.
- `data-picker="base"` → branches then commits. **No worktree pseudo-row.**
- Commit meta line = `committedAtLabel|committedAt` · `committedAtRelative` ·
  `subject|refs|'commit'`, blank parts dropped.
- Row layout: `.refpick-main` (mono value) / `.refpick-meta` / `.refpick-kind`
  (uppercase `branch`/`remote`/`commit`/`head`/`worktree`).
- Empty result → `.refpick-empty` "No matching refs".

**Picker placement** (`placePicker`, all values load-bearing): width =
`clamp(260, inputWidth, viewportWidth-24)`; left clamped to `[12, viewport-w-12]`;
`maxHeight = clamp(140, 260, viewportHeight-24)`; top = `inputBottom + 7`, flipped
to `inputTop - 7 - h` if it would overflow, then clamped to ≥12 px.

**Initial active index** (`renderPicker`): finds the option whose `value` equals
the input's trimmed value, *or* the `__WORKTREE__` row when the input carries
`data-worktree="1"`; falls back to index 0 when rows exist.

### 3.3 Keyboard — change page

Scope: each `[data-picker]` input.

| Key | Effect |
|---|---|
| `Escape` | Only when this input owns the picker: `preventDefault` + `stopPropagation` + `closePicker()`. |
| `ArrowDown` / `ArrowUp` | `preventDefault`. If the picker isn't open for this input, open it (and stop). Otherwise `setActiveIndex(activeIndex ± 1, scroll:true)` — **clamped, not wrapping** (differs from the repo picker, which wraps). |
| `Home` / `End` | `preventDefault`, first / last option, scroll into view. |
| `Enter` | When this input owns the picker and the active row has a value: `preventDefault` + `chooseRef(value)` → navigation. |

**Nothing else.** No page-level shortcuts, no `?`. `CONFIRMED`.
Reduced-motion, contrast and viewport behaviour do not change key handling.

### 3.4 Client-side state — change page

In-memory: `loaded`, `loadingRefs`, `refsPromise`, `refData{current,branches,commits}`,
`activeInput`, `activeRows`, `activeIndex`, `refQueries` (a **`WeakMap`** of
input → last typed query, so the query survives close/reopen), `autoScopeTimer`,
`panels`.

- **localStorage / sessionStorage: none.** The change page persists nothing
  client-side except the shared `ds-theme`.
- **URL is the state store.** `?scope=uncommitted`, `?scope=commit&commit=<ref>`,
  `?base=<ref>[&head=<ref>]`, `?scope=auto`. Every scope change is a **full page
  navigation** (`location.href = …`) — no `pushState`, no history API, no partial
  re-render. Back/forward work because each scope is a real URL.
- The resolved scope is mirrored onto the **server session** (`session.base`,
  `session.head`) by `changeScreen()`, which is what the `/diff` and `/review`
  routes then read.
- `data-worktree="1"` on `#cmpHead` is a DOM-attribute flag distinguishing "the
  literal string *Working tree*" from "a ref someone typed".

### 3.5 Live/streaming — change page

None. `EventSource` is never opened here. TEST-LOCKED that the page does **not**
embed the progress panel (`doesNotMatch(/ds-pp-plan|function ProgressPanel|
new ProgressPanel|run_done/)`). Freshness is manual: `#reloadBtn`, `Re-check`,
or a scope navigation.

### 3.6 Animations & transitions — change page

TEST-LOCKED ("change page keeps ref navigation stable while preserving anchored
picker motion") — the *absences* are as load-bearing as the presences:

- **Present:** `.refpicker:not([hidden])` → `change-picker-in` at
  `--motion-duration-ui` `--motion-ease-out` `backwards`:
  `opacity:0`, `clip-path:inset(0 0 100% round 10px)`, `translateY(-4px) scale(.985)`
  → fully revealed. Wrapped in `no-preference`.
- **Deliberately absent (TEST-LOCKED `doesNotMatch`):**
  - `.wrap{animation:change-page-in…}` — the whole page must **not** replay an
    entrance after every ref navigation. This is the single most important
    motion decision on this surface.
  - `.refpanel:not([hidden]){animation:change-panel-in…}` — the selected scope
    panel must not clip-and-re-enter.
  - `ds-scope-thread` / `ds-thread-layer` — no decorative thread here.
  - `scope-current-mark` / `.scope-side:before` / `.sopt:before` — no
    partial-edge accent strips.
- Transitions: `.sopt` (background, border-color, transform, box-shadow),
  `:active{scale(.985)}`; `.openreview` (background + transform),
  `:active{scale(.97)}`.
- Reduced motion: `.sopt, .openreview{transition:none}` and their `:active`
  transforms are removed. TEST-LOCKED.

### 3.7 Accessibility contracts — change page

- Exactly **3** `role="combobox"` fields, each with `aria-autocomplete="list"`,
  `aria-haspopup="listbox"`, `aria-expanded`, and `aria-controls="refPicker"`.
  All three counts are TEST-LOCKED.
- One shared `#refPicker role="listbox" aria-label="Available git references"`.
  **No `<datalist>`** — TEST-LOCKED.
- `aria-activedescendant` on the active input, pointing at
  `ref-option-<inputId>-<i>`; rows carry `role="option"` + `aria-selected` +
  `tabIndex=-1`.
- `aria-expanded` kept in sync on both the disclosure buttons
  (`aria-controls="commitPanel"` / `"comparePanel"`) and the comboboxes.
- `role="group"` labels: `Review scope` on `.sopts`, `Selected comparison` on
  the split summary; `aria-label` on both sections and both scope sides
  (`Source: <ref>` / `Target: <ref>`).
- `.review-path` is `role="list"` with `role="listitem"` children and
  `aria-current="step"` on stage 01.
- `.openreview` has an explicit `aria-label="Start review of N files"` — the
  visible text is the same count but the label spells out the verb.
- `#reloadBtn` `aria-label="Reload current scope"` (its text label disappears
  below 480 px).
- `@media (prefers-contrast:more)` promotes borders on `.card`, `.sopt`,
  `.refpanel`, inputs, compare rows, `.cmparrow`, both scope summaries,
  `.notice`, `.metric`, `.review-path`.
- Focus rings: 3px `--accent-soft` box-shadow on `.sopt`, `.openreview`,
  `.generated summary`, inputs; compare `.refrow:focus-within` gets both a
  border colour change and the ring.

### 3.8 Responsive — change page

| Breakpoint | Changes |
|---|---|
| `≤1080px` | `.sopts` → 2 columns. |
| `≤980px` | `.sopts` → 2 columns; **`.scope-metrics{display:none}`** (the +/−/files ledger disappears entirely); both sections forced to `grid-column:1`. |
| `≤700px` | All `.refpanel` variants → single column; `.cmparrow` hidden; compare rows keep `min-height:72px`. |
| `≤600px` | `.wrap` padding 20/14; `.lede{display:block}` and `h1` grows to 28px; `.review-path` goes to `font-size:0` for inactive stages (numerals only) with only `.active` keeping its 10.5px label (TEST-LOCKED); `.sopts` returns to **3** columns at 6px gap with `.sopt-t{display:none}` and centred 44px-high tiles (TEST-LOCKED); split summary tightens to `24px` arrow; `.bar` 34px; `.fc` min-width 70px; `.fdir{max-width:48%}`; `.openreview` becomes full-width. |
| `≤480px` | `.reload-label{display:none}` (icon-only reload); `.nv-history` padding tightens. |

---

## 4. Progress panel — `src/progress-ui.ts`

Three string builders: `progressPanelStyles()`, `progressPanelMarkup(variant)`,
`progressPanelScript()` (defines globals `ProgressPanel` and `runProgress`).

**Where it actually lives.** Only the review page embeds it
(`render.ts:280` styles, `:348` `<div id="ds-agentpanel">` + markup with
`variant:'floating'`, `:438` script). The change page explicitly does not
(TEST-LOCKED). It is nonetheless a distinct surface with its own lifecycle.

### 4.1 Variants

| `data-variant` | Layout |
|---|---|
| `floating` | `position:fixed; right:18px; bottom:18px; width:min(460px, 100vw-36px); max-height:min(72vh,580px); z-index:50; box-shadow:0 18px 50px rgba(0,0,0,.5)`. The default and the parked home. |
| `inline` | `margin-top:20px`, `max-height:min(66vh,580px)`, in flow. Built and styled but **not currently mounted anywhere** — `INFERRED` legacy from when the change page hosted generation. |
| `stage` | `margin-top:28px`, `max-height:none`; larger title (11.5px), milestones, and note (14px). Applied at runtime by `mountPanelInStage()` in PAGE_JS, which moves the *same* node into `#ds-storystage` inside the review page's story intro. `restoreAgentPanel()` moves it back and resets it to `floating` + `hidden`. |

**The panel is a singleton node that gets re-parented and re-classed.** Any React
port must reproduce "one panel, three placements" or accept a behaviour change.

### 4.2 Layout & elements (DOM order)

```
.ds-pp[data-variant][hidden]
  span.ds-pp-announcer          role=status aria-live=polite aria-atomic=true (visually hidden)
  .ds-pp-head
    span.ds-pp-spin             aria-hidden, hidden       — 13px ring spinner
    span.ds-pp-title            "Preparing…"              — mono, uppercase, .14em, accent
    span.ds-pp-agent            ""                        — chip, :empty{display:none}, max 220px ellipsis
    span.ds-pp-flex             spacer
    button.ds-pp-stop           "Stop"   [data-pp-stop]  hidden
    button.ds-pp-close          "Close"  [data-pp-close] hidden
  .ds-pp-sub > span.ds-pp-repo  ""  — mono, :empty{display:none}, overflow-wrap:anywhere
  ol.ds-pp-miles                hidden   — milestone thread
  .ds-pp-note                   hidden   — narration, 13px prose
  ol.ds-pp-plan                 ""       — the agent's TodoWrite plan; :empty{display:none}; scrollable
  .ds-pp-now                    hidden   — mono activity line (used only when there is no plan)
  .ds-pp-live                   hidden   — dot + state text + elapsed timer + "N of M done"
  .ds-pp-error                  role=alert aria-atomic=true, hidden — icon + title + detail
  details.ds-pp-details         hidden — <summary>Technical details</summary><pre.ds-pp-raw>
  .ds-pp-foot                   hidden — caller-injected action buttons
```

All region names, the announcer attributes, the `role="timer" aria-live="off"`
elapsed field with its visually-hidden "Elapsed " prefix, `role="alert"`,
`data-pp-stop`/`data-pp-close`, `ds-pp-miles`, `ds-pp-note` and the
`Technical details` summary are TEST-LOCKED for **both** variants.

**Colours are self-contained and dark-only.** `--pp-bg:#14171c`,
`--pp-elev:#1e232b`, `--pp-text:#eef1f5`, `--pp-muted`/`--pp-faint:#98a2b3`,
`--pp-blue:#3fb2ff`, `--pp-warn:#ffb224`, `--pp-err:#ff6b62`, `--pp-ok:#3ddc97`.
`@media (prefers-color-scheme:light)` only *lightens the ink slightly*
(`--pp-bg:#181b20`) — **the panel stays dark in light mode by design.**
TEST-LOCKED that a `prefers-color-scheme: dark` block exists. It borrows
`--radius-island`, `--radius-pill`, `--fill-1` from the host page with literal
fallbacks.

### 4.3 Milestones

`MILES.guided_review` (and `detailed_audit`, aliased to the same array):

| Label | Phases |
|---|---|
| Preparing | `idle`, `preflight`, `resolving_context`, `preparing_prompt`, `starting_agent`, `agent_running` |
| Recovering the why | `reading_changes`, `recovering_why` |
| Designing the reading path | `designing_path` |
| Writing the story | `writing_output` |
| Checking the result | `validating_output`, `applying_results` |
| Ready | `complete` |

`advanceMiles(phase)` is **monotonic** — `if (i > mileIdx)` — so a late-arriving
earlier phase never rewinds the display. Each advance announces the milestone
label. TEST-LOCKED that the three narrative labels exist verbatim.

Rendering: `is-done` before the index, `is-active` (or `is-error` when
`mileFailed`) at it, `is-pending` after. The `::before` connector line is accent
for done+active, `--pp-line` otherwise; the first node has no connector.

### 4.4 Event handling (`panel.handle(ev)`)

Every event first calls `opts.onEvent(ev)` if provided (TEST-LOCKED).

| `ev.type` | Effect |
|---|---|
| `run_started` | `workflow = ev.workflow`; title = `WORK[workflow]` ("Writing your review") or `ev.label` or "Working…"; load and render milestones at index 0; `setLive('Working',0)`; announce the title. |
| `context` | `.ds-pp-agent` = `Agent[· model]` with the agent name capitalised; `.ds-pp-repo` = `repoName[ · base → head|working tree][ · N comment(s)]`; clears any stale `title`. |
| `phase` | `advanceMiles(ev.phase)`. Additionally, `validating_output`/`applying_results` set the title to "Checking the result…" and live state to "Checking" (announced only when there are no milestones — otherwise the milestone already announced). |
| `plan` | `renderPlan(ev.items)` — rebuilds `<ol>` from `{text,status}`; `done` gets `✓` and increments the counter; `active` gets a pulsing `●` **plus a nested `.ds-pp-step-now` span** that becomes the target for subsequent activity text; `pending` gets `○`. Scrolls to the bottom. Sets `.ds-pp-live-count` = "N of M done". Hides `.ds-pp-now`. |
| `file` / `command` / `tool` | `setCurrent(ev.label)` — clipped to 120 chars, whitespace-collapsed. Goes into the active plan step's `now` span when a plan exists, else into `.ds-pp-now`. |
| `activity` | `kind==='narration'` → `setNote(label)` (clipped to 220, shown in `.ds-pp-note`); anything else → `setCurrent`. |
| `text` | `appendRaw(ev.data)` into `<pre>`, capped at **200 000 chars** (older text dropped, prefixed with `…`), auto-scrolled. If there is **no plan**, the first line also becomes the current activity — **unless it starts with `>>`**, which would duplicate the narration/phase events. TEST-LOCKED. |
| `heartbeat` | `setLive(curState, ev.quietMs)` — appends " · quiet Ns" only when quiet ≥ 8 s. Never announces. TEST-LOCKED silent. |
| `warning` | `appendRaw('[warn] ' + label + '\n')`. Nothing visible. |
| `error` | `showError(ev)` — reveals `.ds-pp-error`, title = `label` or "The run failed", detail = `detail`, and `technicalDetail` **replaces** the raw log. TEST-LOCKED that `error` does *not* also `appendRaw`. |
| `run_done` | `finish(ev.status, ev.result)`. |

Unknown types are ignored.

### 4.5 Lifecycle

**`start()`** — unhide the root, `t0 = Date.now()`, clear `is-finished`, reset
every field (workflow, plan, milestones, error, announcer, raw log, foot,
details), show spinner + Stop, hide Close, title "Preparing…", show the live row,
start a **1 s interval** that only updates the elapsed field, `setLive('Preparing',0)`,
`announce('Preparing')`.

**`finish(status, result)`** — stop the timer, add `is-finished` (which freezes
the milestone-dot pulse, TEST-LOCKED), hide spinner + Stop, show Close.
Title resolution:
- `result.delivery === 'desktop'` and complete → **"Sent to ChatGPT"**, live text
  "Message delivered".
- complete → `DONE[workflow]` = "Review ready" (fallback "Done"); milestones jump
  to `miles.length` (all done).
- `stopped` → "Stopped".
- otherwise → `FAIL[workflow]` = "Generation failed" (fallback "Couldn't finish");
  `mileFailed = true` and the current milestone renders `is-error`.

Live row gets `is-done` or `is-error`. Announces only on complete/stopped.
If it failed with no prior `error` event, synthesises
`{label:'The connection to the agent ended', detail:'Try again. If it keeps
failing, reopen diffStory and check the technical details.'}`. On any failure with
non-empty raw output, reveals `<details>` **collapsed** (`open=false`,
TEST-LOCKED). Calls `opts.onDone(status, result)`.

**`blocked(err)`** — unhide, stop the timer, hide spinner + Stop, show Close,
title "Cannot start", live row `is-error` with the error label, `showError`,
`opts.onBlocked(err)`.

**Public API returned:** `{ root, els, start, handle, finish, blocked, showFoot(node), error() }`.
`showFoot` unhides `.ds-pp-foot`, clears it, appends one node. `error()` returns
the last error object. TEST-LOCKED that `showFoot` and `error()` survive.

**Elapsed formatting:** `<60 → "Ns"`, else `"Mm Ss"`.

### 4.6 `runProgress(panel, url, payload, ctrl)`

`POST url` with JSON body and an optional `AbortSignal`.
- `!r.ok || !r.body` → try to parse the JSON error body → `panel.blocked(json)`;
  unparseable → `panel.blocked({label:'Could not start.'})`.
- Otherwise reads `r.body.getReader()` with a `TextDecoder`, splits the buffer on
  `\n`, keeps the trailing partial line, `JSON.parse`es each complete line and
  feeds it to `panel.handle`. **Malformed lines are silently skipped** (`continue`).
  On `done`, a non-empty trailing buffer gets one last parse attempt inside a
  `try`.
- `catch` → `panel.finish('stopped', {})` if the signal aborted, else
  `panel.finish('failed', {})`.

This is the **NDJSON** path. Endpoints: `POST /api/generate`,
`POST /api/story/repair`.

### 4.7 Callers (review page, `page-assets.ts`)

**Story generation** (`:3290–3356`):
- Mounts into `stage` variant inside the story intro when one exists, else the
  floating home.
- Payload: `{base, head, agent, model, mode, includedFiles, reviewerNote}`.
- `onStop` → `AbortController.abort()`.
- `onClose` → `restoreForm()` (un-busy, restore the intro, re-enable the button).
- `onBlocked` → `showRecovery(err)`.
- `onDone`: complete + `result.storyWritten` + a review URL → `location.href` to
  the review; `stopped` → restore the form; otherwise → `showRecovery(panel.error())`.
- `showRecovery` hides Close and injects a two-button foot:
  - Codex model failure (`/Codex needs an update for/`) → **"Change model"** +
    **"Retry after updating"** (both reload the Codex model list first).
  - Otherwise → **"Try again"** (re-runs) + **"Review settings"** (restores the
    form and focuses the story-mode radio).
  - Focuses the primary button if focus is nowhere meaningful.

**Story repair** (`:3020–3037`): guards on `agentBusy` with a toast, checks
`GET /api/agents` for claude/codex (preferring codex), forces the `floating`
variant, `POST /api/story/repair {action, agent, file?, line?, stepId?}`, and on
success injects a single **"Reload story"** button (`data-reload-diff`) into the
foot.

### 4.8 Keyboard — progress panel

**None.** No `keydown` handler exists in `progress-ui.ts`. `Stop` and `Close` are
plain buttons (native `Enter`/`Space`). There is **no `Escape`-to-close**, and the
floating panel is **not a modal** — it does not trap focus and does not inert the
page behind it. `CONFIRMED`. Note this before "improving" it in React: making it
a dialog would be a behaviour change, not a port.

### 4.9 Client-side state — progress panel

All in-memory, per-instance closure: `miles`, `mileIdx`, `mileFailed`,
`workflow`, `hasPlan`, `planTotal`, `planDone`, `activeNow` (the DOM node the
next activity line writes into), `curState`, `lastError`, `lastAnnouncement`
(dedupe guard), `t0`, `timer`.

- **No localStorage, no sessionStorage, no URL state.** A reload loses the run
  view entirely (the run itself continues server-side; the page has no way to
  re-attach). `CONFIRMED`.
- The `<details open>` state is not persisted.

### 4.10 Live/streaming — progress panel

The panel *is* the streaming surface. NDJSON over a `fetch` POST body reader
(§4.6). It never touches `/api/events`. Progress events are defined in
`src/progress.ts` (`ProgressEvent` union) and the panel's `handle()` is the
mirror of that union — the two must stay in sync.

Server-side enrichment worth preserving in the UI's expectations:
- `createFileEnricher` rewrites file labels to
  `Reading changed files · 3 of 8 · src/a.ts` — the panel just prints it.
- `parseAgentNoteLine` turns `>> Recovering the why` into a `phase` event and any
  other `>> …` into a `narration` activity (clipped at 300 chars server-side).
- `heartbeatEvent(quietMs)` is what drives the "quiet Ns" suffix.

### 4.11 Animations & transitions — progress panel

- `.ds-pp-spin` — `ds-pp-spin .7s linear infinite` (rotate 360°).
- `ds-pp-pulse` (`0/100%{opacity:1} 50%{opacity:.35}`), used at three speeds:
  active plan mark `1.2s`, live dot `1.6s`, active milestone dot `1.1s`.
- `.ds-pp-live.is-error .ds-pp-live-dot` and `.is-done` → `animation:none`,
  error dot turns red.
- `.ds-pp.is-finished .ds-pp-mile-dot{animation:none}` — TEST-LOCKED.
- **Reduced motion (TEST-LOCKED verbatim):**
  `.ds-pp-spin, .ds-pp-step.is-active .ds-pp-mark::before, .ds-pp-live-dot,
  .ds-pp-mile.is-active .ds-pp-mile-dot { animation:none!important }`,
  plus the spinner border becomes solid accent and both pulsing marks are pinned
  to `opacity:1` so they stay legible.
- No entrance/exit transition on the panel itself — it just flips `hidden`.

### 4.12 Accessibility contracts — progress panel

All TEST-LOCKED.

- `.ds-pp-announcer` is the **only** live region: `role="status" aria-live="polite"
  aria-atomic="true"`, visually hidden. The panel root must **never** get
  `aria-live` (`doesNotMatch(/root\.setAttribute\('aria-live'/)`) — the whole
  thing updates continuously and would flood a screen reader.
- Announcements are restricted to: `Preparing`, the work title on `run_started`,
  each milestone label, "Checking the result" (only when there are no
  milestones), and the finish title on complete/stopped. **Heartbeats, file,
  command, tool and text events are silent** — explicitly asserted.
- `announce()` dedupes against `lastAnnouncement` and collapses whitespace.
- Elapsed: `role="timer" aria-live="off"` with a visually-hidden `Elapsed ` label
  — the 1 s tick must not announce. TEST-LOCKED that `tick()` only calls
  `setElapsed()`.
- `.ds-pp-error` is `role="alert" aria-atomic="true"`.
- `.ds-pp-spin` and `.ds-pp-mile-dot`-adjacent decoration are `aria-hidden`.
- Focus-visible rings (3px, 12% accent mix) on Stop, Close, and foot buttons.
- **Not** a dialog: no `role="dialog"`, no `aria-modal`, no focus trap, no
  focus restore. Deliberate — `INFERRED`, but consistent with it being a
  non-blocking floating status surface.

### 4.13 Responsive — progress panel

Single breakpoint, `@media (max-width:520px)`, TEST-LOCKED:
`.ds-pp-head` becomes a 3-column grid (`auto minmax(0,1fr) auto`) with
`row-gap:6px`; the spinner sits at 1/1, the title at 2/1, the agent chip drops to
2/2 (`justify-self:start`, `max-width:100%`); `.ds-pp-flex` is hidden; Stop/Close
span both rows in column 3.

Width is otherwise fluid via `min(460px, calc(100vw - 36px))`.
`.ds-pp-agent` ellipsises; `.ds-pp-repo` uses `overflow-wrap:anywhere`. Both
TEST-LOCKED.

---

## 5. Cross-cutting

### 5.1 Theme (`src/theme.ts`)

Present on **all four** surfaces (picker inlines `themeControl()` in its hero;
story picker and change page get it via `navBar()`; the progress panel is
theme-independent by design).

**Bootstrap script** (`themeBootstrapScript()`) is inlined in `<head>` **before
page CSS** on every page — must stay inline to prevent FOUC (the design doc
already calls this out).

- Storage key: **`ds-theme`**. Values: `'light'`, `'dark'`, or *absent* (= system).
  `system` is stored as removal, not as the string `'system'`.
- `apply(mode)` sets `data-theme` (**resolved** light/dark, never `system`),
  `data-theme-mode` (the raw preference), `documentElement.style.colorScheme`,
  and rewrites `<meta data-ds-theme-color>` to `#0a0c0f` / `#edf0f4`.
- Fires a `ds-theme-change` `CustomEvent` on `document` with
  `{detail:{theme, mode}}` — **only when the resolved value actually changed**.
  PAGE_JS listens for this (e.g. mermaid re-render). A React port must keep the
  event or find every listener.
- Reacts to `matchMedia('(prefers-color-scheme: dark)')` changes while in
  `system` mode.
- Reacts to `window` `storage` events for key `ds-theme` — **theme changes
  propagate across open tabs.** Easy to lose.
- Reads are wrapped in `try/catch` (private-mode / disabled storage).

**Control** (`themeControl()`): a 34×34 pill toggle
(`aria-haspopup="menu" aria-expanded`, `aria-label`/`title` = "Color theme: System|Light|Dark",
`::after{inset:-6px}` hit-slop) with three icon spans toggled by `hidden`, plus a
`role="menu"` popover containing three `role="menuitemradio"` buttons with
`aria-checked` and a `✓` glyph revealed by `[aria-checked="true"]`.

**Keyboard (theme menu — the only keyboard on story picker and, besides the ref
combobox, on the change page):**

| Key | Scope | Effect |
|---|---|---|
| `Escape` | open theme menu | close and return focus to the toggle |
| `ArrowDown` / `ArrowUp` | open theme menu | move focus between the three items, **wrapping** |
| `Home` / `End` | open theme menu | first / last item |

Opening the menu focuses the currently-checked item. Clicking a choice saves,
applies, closes, and returns focus to the toggle. A `document` `mousedown`
listener closes any `.ds-theme-wrap` the click was outside of. Opening one menu
closes every other one on the page.

### 5.2 Design tokens (`sharedTokens()`)

Emitted verbatim into every page's `<style>`. The single source of truth the
design doc plans to bridge into Tailwind `@theme`.

- 12 self-hosted `@font-face` rules from `/assets/fonts/*.woff2` — IBM Plex Sans
  400/500/600/700, IBM Plex Mono 400/500/600/700, Space Grotesk 500/600/700, all
  `font-display:swap`. Same-origin to satisfy `font-src 'self'`.
- Dark is the `:root` default (no-script fallback); `:root[data-theme="light"]`
  overrides.
- Motion scale (TEST-LOCKED exact values in `motion-regressions.test.mjs`):
  `--motion-ease-out:cubic-bezier(0.23,1,0.32,1)`,
  `--motion-ease-in-out:cubic-bezier(0.77,0,0.175,1)`,
  `--motion-ease-drawer:cubic-bezier(0.32,0.72,0,1)`,
  `--motion-duration-press:120ms`, `-fast:150ms`, `-ui:200ms`,
  `-progress:250ms`, `-spatial:340ms`.
- Geometry: `--radius-sm:8px --radius:12px --radius-lg:18px --radius-island:26px
  --radius-pill:999px`, `--control-h:34px --control-h-lg:40px`,
  `--rail-width:316px`.
- Type scale, tracking (`--tracking-kicker:.14em`, `--tracking-tight:-.02em`,
  `--tracking-numeral:-.03em`), spacing `--sp-1..--sp-10`.
- `--app-*` compatibility aliases (change page depends on these; TEST-LOCKED
  that `--app-bg:` and `--elev:var(--app-elev)` appear).
- Comment worth preserving: `--text-3` is deliberately *lighter* than the mockup
  to hold WCAG AA 4.5:1 on elevated surfaces. Do not "sync" it back down.

### 5.3 Nav chrome (`src/nav.ts`)

Used by story picker and change page (not the picker, not the panel).

- `<header class="ds-nav">` — `position:sticky; top:10px; z-index:30; height:50px;
  margin:10px 12px 0`, island radius.
- Wordmark link → `home` (default `/repos`), `title="Home — your repositories"`,
  `aria-label="Home"`.
- `<nav aria-label="Breadcrumb">` with `/` separators (`aria-hidden`); the last
  crumb (or any without `href`) renders as a `<span aria-current="page">`.
- `.nv-spacer`, then `themeControl()`, then the page's `right` HTML slot.
- Action classes `.nv-act` (tonal) / `.nv-pri` (accent), `--control-h` tall, pill.
- Transitions on background/transform/box-shadow at `--motion-duration-press`;
  `:active{scale(.97)}`; removed under reduced motion.
- `≤560px`: tighter padding/margins, `.nv-word{display:none}` (mark only),
  `.nv-act` padding 10px.
- `prefers-contrast:more` → nav and action borders to `--nv-fg`.

Server-side navigation guarantees (TEST-LOCKED in `home-navigation.test.mjs`):
the logo returns home **without** re-running git inspection on the open repo;
repo and story navigation do not synchronously repeat git inspection; closing a
story leaves the next repo entry on review history; visiting home does not strand
a review restored from browser history.

### 5.4 Toasts / notifications

There are **three unrelated notification mechanisms**, and only one is shared:

1. **Review page toast** (`PAGE_JS toast(msg, tone)`, `#ds-toast`): swaps
   `role` between `status`/`alert` and `aria-live` between `polite`/`assertive`
   based on `tone==='error'`; clears text, then sets it inside a
   `requestAnimationFrame` (so a repeated identical message re-announces);
   auto-hides after **4200 ms**, then clears text and resets attributes after a
   further 220 ms. Guarded by a `toastSequence` counter against races.
   Under reduced motion: `animation:none!important; transform:translateX(-50%);
   transition:opacity 200ms ease` (TEST-LOCKED).
2. **Picker** `#msg` — a `role="status"` **sr-only** paragraph. Sighted users get
   no confirmation for "Opening…" / "Removed from recent repositories."
3. **Story picker** — native `window.confirm()` / `window.alert()`.

**There is no shared toast component.** A React port that unifies them is an
improvement, but it changes three behaviours at once; do it knowingly.

Also global on the review page: the `data-live-banner` stale-diff banner and the
`data-story-reload-toast` "story changed, reloading in 10 s" toast with a cancel
action (`scheduleStoryReload` → `location.reload()` after **10 000 ms**).

### 5.5 Error handling patterns

Consistent shape across the JSON APIs: `{ error: string }` with a 4xx/5xx status.
Client pattern used on every surface:

```js
fetch(...).then(r => r.json().catch(() => ({})).then(d => { if (!r.ok) throw new Error(d.error || fallback); return d; }))
```

- Picker: red `#msg`, distinguishing server errors from "Could not reach the server."
- Story picker: `alert()` + re-enable the button.
- Change page: `/api/refs` failure is **silent** — `loaded` stays false and the
  picker shows the "Loading refs…" row forever until a retry succeeds.
- Progress panel: `blocked()` for pre-stream failures, `showError()` for in-stream
  `error` events, a synthesised connection error for a stream that just ends.
- Review page: HTTP **409** is special — it means the page's lease is stale
  ("The review changed while this page was open. Reload to continue safely.") and
  swaps the retry affordance for a **Reload review** button. Lazy-loaded diff
  fragments all go through `reviewLazyText`/`reviewLazyMessage`/`reviewLazyAction`.
- Uncaught server exceptions render `errorPage(message)` with status 500.

### 5.6 Live events (`/api/events`) — review page only

Server: `src/live.ts` `LiveEventHub`, SSE with `retry: 1500`, `: ping` heartbeat.
Event types: `state`, `comments-changed`, `review-state-changed`,
`story-changed`, `story-synced`, `diff-changed`, `diff-synced`.
Driven by `fs.watch` on `<repo>/.diffstory` and `.diffstory/stories`, debounced
(`LIVE_DEBOUNCE_MS`), with a polling fallback (`LIVE_POLL_MS`) that also
re-attaches dropped watchers and re-computes the git fingerprint per
`(base, head)` scope. Clients are keyed by a review-page lease token; an expired
lease closes the stream.

Client (`PAGE_JS startLiveEvents`): requires `data-review-page-token` on `<body>`;
opens `EventSource('/api/events?page=<token>')`.
- `onopen` → clear the disconnect banner, `refreshComments()`, `refreshReviewState()`.
- `onerror` → a **4000 ms** grace timer before showing "Live updates interrupted."
  (the server's own retry is 1500 ms; without the grace it flashes on every blip).
- `state` → sets both diff and story staleness from the payload.
- `story-changed` → marks stale **and schedules an automatic reload in 10 s**
  with a cancellable toast; `story-synced` cancels it.
- `diff-changed`/`diff-synced` → toggle `data-live-diff-stale` on `<body>` and
  refresh counts; `diff-synced` also refreshes review state.
- `pagehide` closes the stream; `pageshow` with `e.persisted` **reopens** it
  (`EventSource.close()` is terminal, so a bfcache restore would otherwise be
  silently dead). Easy to lose.
- Banner priority is a fixed list: `diff` outranks `disconnected`; `story` has no
  banner entry (it uses the reload toast instead). Dismissals are tracked per
  *generation* so a re-occurrence re-shows a previously dismissed banner.

**None of the four assigned surfaces consume SSE.** If the rewrite adds live
updates to the picker or change page, that is new behaviour.

### 5.7 Global keyboard map (review page, `PAGE_JS onKey` + `DIFF_JS handleChangeShortcut`)

Included for completeness — this is where "shortcuts get lost in a rewrite" bites
hardest. `isTextEntryTarget()` gates almost everything.

| Key | Scope | Effect |
|---|---|---|
| `Escape` | global, cascading | 1st: close an open `.ds-story-tune` details (focus its summary). 2nd: cancel the inline `.ds-composer`. 3rd: close the top modal (command palette / drift drawer). Else: close the selection menu; on compact screens, close the sidebar. |
| `?` | not in a text field | Open the command palette. |
| `Tab` / `Shift+Tab` | inside any modal | Focus trap over `modalFocusables(modalRoot)`, wrapping, pulling focus back in if it escaped. |
| `/` | not in a text field | `setView('files')` + focus `[data-file-search]`. |
| `c` / `C` | not in a text field | Open the comment composer on the current text selection or the focused row. |
| `Arrow*` / `Home` / `End` | focused `[data-story-choice]` in a `role=radiogroup` | Wrapping radio walk (focus + click). |
| `←` `→` `Home` `End` | focused `[data-review-tab-select]` | Wrapping review-tablist walk. |
| `←` `→` `Home` `End` | focused `.ds-tab[data-view]` | Wrapping N-way view-tab walk (`setView` + focus). |
| `←` / `→` | focused `[data-sidebar-resizer]` | Un-collapse and resize the rail by ±16 px, persisted. |
| `←` / `→` | focused `[data-rail-beat]` | Move the rail beat. |
| `←` / `→` | focused `[data-story-beat]` | Move the story beat. |
| `←` / `→` | global | `moveSpeechBeat(±1)` (narration), then panel beats when the tour view is open past step 0. |
| `←` `→` `n` `N` `p` `P` `[` `]` | not in a text field, a change-holder present | `handleChangeShortcut` — jump to next/previous changed row in the active file panel or diff, **wrapping**, with focus. Sets `data-change-index` on the holder, marks the row `is-change-jump` + `aria-current`. |
| `j` / `k` | not in a text field, not the Review view | Next/previous file (files view) or step (tour view). |
| `v` / `V` | not in a text field, files view visible | Toggle "viewed" on the selected file. |
| `Space` (`' '`, `code==='Space'`, `'Spacebar'`) | not in a text field, not on another keyboard control | Toggle read-aloud. **Explicitly starts narration, not just pauses** — a fixed bug worth not re-introducing. When the target *is* the read-aloud button, it defers to native activation to avoid a double toggle. |
| `Cmd/Ctrl+Enter` | comment composer textarea | Copy the draft. |
| `Cmd/Ctrl+Shift+Enter` | comment composer textarea | Queue the comment. Advertised via `aria-keyshortcuts="Meta+Enter Control+Enter Meta+Shift+Enter Control+Shift+Enter"`. |
| `Arrow*` `Home` `End` | comment-flavour radiogroup | Wrapping radio walk. |

The command palette documents a *subset*: `J / K`, `/`, `V`, `Space`, plus a
footer strip `← →` "changes / narration", `C` "comment selection", `?` "commands".
**`n/p/[/]` are undocumented in the UI** — grep, don't read the palette.

### 5.8 Complete storage-key inventory

| Key | Scope | Written by | Contents |
|---|---|---|---|
| `ds-theme` | all surfaces | `theme.ts` | `'light'` / `'dark'`; removed for system |
| `ds-sidebar-width` | review page | `page-assets.ts:1501` | rail width px |
| `ds-sidebar-collapsed` | review page | `page-assets.ts:1208` | collapse flag |
| `ds-split` | review page | `diff-assets.ts:397`, `page-assets.ts:3670` | before/after divider percentage |
| `ds-files-mode` | review page | `diff-assets.ts:484` | `unified` / `split` / `full` |
| `ds-review-ui:<reviewScope|viewedScope>:<storyKey>` | review page | `page-assets.ts:2594` | **JSON reading position, per story** — the "saved reading position" behaviour. Key composed from `data-review-scope` (falling back to `data-viewed-scope`) and `data-story-key`, so each story keeps its own position. |
| `ds-challenge:<reviewScope>:<currentDiffHash>` | review page | `page-assets.ts:2935` | JSON map of ticked adversarial-review checkboxes; **invalidated by diff hash** |
| `ds-exclusions-ack:<reviewScope>:<currentDiffHash>` | review page | `page-assets.ts:3380` | `'1'` when excluded files are acknowledged; also diff-hash-scoped |

**8 distinct keys, 3 of them composite/dynamic.** No `sessionStorage` anywhere.
Every read and write is `try/catch`-wrapped.

### 5.9 URL / history state

- **No `history.pushState` or `replaceState` anywhere in the codebase.** All
  navigation is `location.href = …` or a real `<a href>`. Confirmed by grep.
- No hash routing.
- Query params in use: `?scope=`, `?base=`, `?head=`, `?commit=` (change page),
  `?story=<id|new>` (review entry), `?evidence=refresh` (story picker),
  `?page=<lease token>` (every review-page API call, injected by `reviewPageUrl()`),
  `?file=` (lazy diff fragments), `?ref=` (`/api/refs`), `?path=` (`/api/fs`).
- Route shape: `/repos`, `/repo/<name>/change`, `/repo/<name>/stories`,
  `/repo/<name>/diff`, `/repo/<name>/review`. Bare `/change` and `/review`
  redirect into the repo-named route; with no repo open they render the picker.

### 5.10 Shared media-query vocabulary

Used consistently across all four surfaces — a React port should keep the same
three axes, not just the width breakpoints:

- `@media (prefers-reduced-motion: no-preference)` — where entrance animations
  are *added*. The default (no query) state is static.
- `@media (prefers-reduced-motion: reduce)` — where transitions/transforms are
  *removed*, usually with `!important`.
- `@media (prefers-contrast: more)` — promotes hairline borders to `--label`/`--nv-fg`
  on cards, buttons, inputs and sheets. Present on picker, story picker, change
  page and nav. **Not** present on the progress panel.
- `@media (prefers-color-scheme: dark|light)` — only in the progress panel, which
  opts out of the `data-theme` system entirely.

Width breakpoints are **not** shared: picker uses 760/480, story picker 760/560/460,
change page 1080/980/700/600/480, progress panel 520, nav 560. Ten distinct values
across five files. A React port with a single scale will change layout at some
widths; that is probably fine, but it is a change.

### 5.11 Atlas coverage (ground truth for visual diffing)

`scripts/capture-ui-atlas.mjs` drives a real server against a deterministic
fixture repo. Viewports: `desktop 1440×960`, `tablet 920×820`, `mobile 390×844`.

**Important caveat:** of the four surfaces, the atlas currently shoots only
**desktop**:

| Shot | Surface | Theme | Viewport |
|---|---|---|---|
| `picker-recent` | repo picker | dark | desktop |
| `history-populated` | story picker | dark | desktop |
| `change-populated` | change page | light | desktop |
| `change-empty` | change page (empty) | dark | desktop |
| `raw-diff` | diff viewer | dark | desktop |

Tablet and mobile shots exist **only for the review page**. The progress panel has
**no atlas shot at all**. So the atlas is a weaker safety net for these four
surfaces than the design doc implies — it will not catch a broken picker modal on
mobile or a regressed progress panel at any width.

---

## 6. At risk in the rewrite

Ranked by (likelihood of being dropped) × (cost of dropping it).

1. **The `ds-review-ui:<scope>:<storyKey>` per-story reading position.**
   A composite key built from three `<body>` data attributes, written by a
   scroll-throttled saver and read by a restore pass that has to run *after*
   layout. The most recent commit in this repo (`2156520 fix: keep each story's
   saved reading position to itself`) exists precisely because this was wrong
   once. A React port that stores "the" scroll position will silently regress it
   again.

2. **The undocumented change-navigation keys `n` / `p` / `[` / `]`.**
   They live in `diff-assets.ts:handleChangeShortcut`, not in `PAGE_JS`, and the
   command palette only advertises `← →`. Anyone porting shortcuts by reading the
   palette will lose four of them. `j`/`k`/`v` are documented; `?`, `/`, `c`,
   `Space` are documented; these four are not.

3. **Progress-panel announcement discipline.**
   Six tests exist solely to assert what does *not* announce: heartbeats, file,
   command, tool and text events are silent, `tick()` only writes the elapsed
   field, the root never becomes a live region. The natural React instinct —
   `aria-live="polite"` on the status panel — is exactly the thing every one of
   those tests forbids. It would turn a 60-second run into hundreds of
   screen-reader interruptions.

4. **The `>>` echo suppression in the progress panel's `text` handler.**
   One `if (ln.indexOf('>>') !== 0)` guard. Without it, every narration line
   appears twice — once as prose in `.ds-pp-note`, once as mono in the activity
   line. Trivially dropped, immediately visible, and there is a memory note in
   this repo about `>>`-adjacent strings tripping tests.

5. **The picker modal's open/close choreography.**
   Four separate load-bearing details: the `requestAnimationFrame` before adding
   `.show` (without it there is no transition), the `210 ms`/`0 ms` close timer
   before setting `hidden` (without it the exit animation is cut), the
   `modalCloseTimer` re-entrancy guards on both `openModal` and `closeModal`, and
   the `inert` + `aria-hidden` pair on `#pickerMain`. A React port using a
   library's `<Dialog>` will get the a11y right and quietly change the timing —
   and probably lose the `tabindex!=='-1'` filter that keeps listbox options out
   of the tab ring.

**Also at risk, just below the line:**

6. **The `ds-theme-change` `CustomEvent` and the cross-tab `storage` listener.**
   Theme is easy to port; these two side channels are easy to forget. Something
   on the review page listens for the event.

7. **`pageshow`/`pagehide` EventSource reopen.** `EventSource.close()` is
   terminal, so a bfcache restore without the reopen leaves a page that looks
   live and isn't.

8. **The change page's "no page-entrance animation" rule.** Three
   `doesNotMatch` assertions protect it. Since every scope change is a full
   navigation, adding a page-level entrance makes the ref picker feel broken —
   which is why it was removed. A fresh React app will almost certainly animate
   its mount.

9. **`scheduleNavTo`'s same-URL guard.** Without it, the change page navigates to
   the URL it is already on and loops.

10. **`prefers-contrast: more`.** Present on four files, entirely invisible in
    normal development, and trivially dropped.

11. **The progress panel is not a dialog.** No focus trap, no `Escape`. Making it
    one is a reasonable improvement but changes behaviour while an agent run is
    in flight.

12. **The three-way notification split** (sr-only `#msg`, `confirm`/`alert`,
    `toast`). Unifying them is right; doing it accidentally means the picker
    starts showing visible toasts and the story picker stops asking before
    deleting.
