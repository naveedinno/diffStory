# Copy findings
Scope inspected: picker, stories, change, review (Story, All files, Review), progress panel, shared nav and menus, server-rendered step and file panels, API error strings. Read client/entry, client/shared, client/surfaces, src/highlight.ts, src/render.ts, src/server.ts error and title strings, src/tour.ts load errors. Viewed screens/picker-desktop-dark.png, screens/picker-modal-desktop-dark.png, screens/stories-desktop-dark.png, screens/change-desktop-dark.png, screens/change-mobile-dark.png, screens/review-desktop-dark.png, screens/review-step-desktop-dark.png, screens/diff-desktop-dark.png.
Not inspected: story-authored prose (generated data, not product copy), concept page iframe bodies (generated), beUI vendored strings (excluded), CLI output (out of scope), ProgressPanel live run states rendered (not captured, all strings read in code). Translation catalogue sweep does not apply, the app is English-only with no catalogue.
Score: 3/4, steady voice and mostly honest errors, with terminology drift and a few wrong labels

## Findings

### COPY-1: Recovery notice names a control that does not exist
- Rule: 10. Errors say what happened and how to fix it
- Severity: MEDIUM
- Confidence: high
- Locations: `client/surfaces/change/ChangeApp.tsx:178`, `client/surfaces/change/FileSummary.tsx:187`
- Evidence: notice reads `That review couldn't be loaded.` plus `Open the diff viewer below, then generate a fresh story from the Story tab.` The control below is labeled `Review {reviewCount}` with aria `Start review of {reviewCount}`. Nothing on the page is called a diff viewer.
- Fix: in `ChangeApp.tsx`, replace `Open the diff viewer below` with `Start the review below`, so the instruction matches the `Review N files` control.
- Why: the notice is the only explanation for a broken story, and its first step points at a name the reader cannot find.
- Verified: yes (source plus screens/change-desktop-dark.png shows the `Review 3 files` control; the notice state itself was not captured)
- Systemic: no

### COPY-2: Symbol tooltip names VS Code even when Zed is selected
- Rule: 2. One voice, flexible tone
- Severity: MEDIUM
- Confidence: medium
- Locations: `src/highlight.ts:82`, `client/shared/editor-menu.tsx:14`
- Evidence: every navigable identifier carries `title="Open implementation in VS Code (Command/Ctrl-click)"`. The editor menu offers Zed and VS Code, the engine opens the preferred editor, and nothing rewrites this title. A Zed user reads VS Code on every symbol.
- Fix: in `src/highlight.ts`, render `title="Open implementation in your editor (Command/Ctrl-click)"`, or have the engine rewrite the title from the stored preference.
- Why: the label states the wrong application for every Zed user, which invites doubt about which app a click will open.
- Verified: yes (code; no engine rewrite found for `data-vscode-symbol` titles)
- Systemic: no

### COPY-3: Failed open and remove toasts give no cause, step, or retry
- Rule: 10. Errors say what happened and how to fix it
- Severity: MEDIUM
- Confidence: medium
- Locations: `client/surfaces/picker/PickerApp.tsx:131`, `client/surfaces/picker/PickerApp.tsx:150`
- Evidence: open failure shows `Could not open that path.` or `Could not reach the server.` and remove failure shows `Could not remove repository.`, each with only a dismiss control. The sibling restore failure in the same file pairs `Could not restore {name}. Try again.` with a `Try again` button.
- Fix: give both toasts the restore treatment, a `Try again` action that re-runs the request, matching the existing `restoreRepo` pattern.
- Why: a failed request should pair the failure with its recovery verb instead of leaving retry undiscoverable.
- Verified: yes (code)
- Systemic: no

### COPY-4: Wrap toggle flips its accessible name to the negative
- Rule: 9. Settings describe the ON state
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/review/engine/review-engine.js:211`, `src/render.ts:102`
- Evidence: the server renders the toggle with visible label `Wrap` and `aria-label="Wrap long lines"`. The engine then sets `aria-label` to `Disable line wrapping` whenever `aria-pressed` is true, so the spoken name says the negative while the visible label still says `Wrap`.
- Fix: in `setLineWrap`, keep `Wrap long lines` stable and let `aria-pressed` carry the state.
- Why: a pressed toggle whose name says Disable reads as a double negative, and here the two modalities disagree.
- Verified: yes (code; SSR default versus engine flip)
- Systemic: no

### COPY-5: Story and review name the same object interchangeably
- Rule: 2. One voice, flexible tone
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/stories/RemoveStoryDialog.tsx:117`, `client/surfaces/stories/RemoveStoryDialog.tsx:157`, `client/surfaces/stories/StoryRow.tsx:235`, `client/surfaces/stories/StoryRow.tsx:274`, `client/surfaces/review/engine/review-engine.js:3316`
- Evidence: the remove dialog asks `Remove this review?` but its button says `Remove story`. A history row pairs the `Resume review` pill with a `Remove story` tooltip. The generator CTA reads `Generate compact story` in brief mode but `Generate guided review` and `Generate deep review` in the other two.
- Fix: use one noun per object. Suggested: dialog title `Remove this story?` to match its button and body, and `Generate compact story`, `Generate guided story`, `Generate deep story` for the three depths.
- Why: adjacent controls should not make the reader wonder whether a story and a review are different things.
- Verified: yes (code)
- Systemic: yes

### COPY-6: Queued feedback is notes in some places and comments in others
- Rule: 2. One voice, flexible tone
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/stories/StoriesApp.tsx:164`, `client/surfaces/stories/StoryRow.tsx:194`, `client/surfaces/review/ReviewApp.tsx:136`, `client/surfaces/review/ReviewApp.tsx:488`, `client/surfaces/review/Sidebar.tsx:559`
- Evidence: the history header counts `open notes` while each row counts `queued comments`. The Review tab reads `N queued comments` in its accessible name but `Unresolved notes` on its badge. The file filter says `Comments`.
- Fix: standardize the queued feedback feature on `comments` (the majority term and the API term). Suggested: `open comments`, `Unresolved comments`. Keep the intro `Review notes` disclosure, which holds hotspots and context, not queued items.
- Why: one count with two names reads as two different queues.
- Verified: yes (code plus screens/stories-desktop-dark.png)
- Systemic: yes

### COPY-7: Side files is system vocabulary with no explanation
- Rule: 4. Plain words in the user's vocabulary
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/stories/story-state.ts:57`, `client/surfaces/stories/story-state.ts:73`, `client/surfaces/review/ReviewApp.tsx:144`, `client/surfaces/review/ReviewApp.tsx:215`, `client/surfaces/review/StoryView.tsx:88`
- Evidence: details read `2 side files also changed` and `Story current, 2 side files changed`, and the drift drawer tags rows `Story` or `Side`. Nothing says what a side file is a side of.
- Fix: say what it means, for example `2 files outside the story also changed`, and retag drawer rows `Story` and `Outside story`.
- Why: readers should not need the drift model to parse a status line.
- Verified: yes (code)
- Systemic: yes

### COPY-8: Git is capitalized in some strings and lowercase in others
- Rule: 8. One capitalization policy
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/picker/FolderBrowser.tsx:462`, `client/surfaces/change/ChangeApp.tsx:160`, `client/surfaces/change/RefPicker.tsx:381`, `client/surfaces/change/refs.ts:102`, `client/surfaces/review/ReviewView.tsx:291`, `src/server.ts:812`
- Evidence: `Not a git repo`, `Set the exact git scope`, `Available git references`, `reading local git refs`, `part of the git change`, `Not a git repository.` Contrast `local Git repository` in `client/surfaces/picker/RecentRepos.tsx:296` and `Git's index` in `client/surfaces/review/ReviewView.tsx:266`.
- Fix: use `Git` in all six locations.
- Why: the product name keeps one spelling everywhere else, and DESIGN_MEMORY.md writes `Git provides evidence`.
- Verified: yes (code plus screens/picker-modal-desktop-dark.png and screens/change-desktop-dark.png)
- Systemic: yes

### COPY-9: Acknowledgement uses UK spelling in a US-spelled product
- Rule: 1. Learn the existing voice first
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/ReviewView.tsx:315`, `src/render.ts:1021`
- Evidence: `Bound to this exact diff; a code change clears the acknowledgement.` The product writes `Color theme` and `behavior` elsewhere.
- Fix: `acknowledgment` in both the React and server mirrors.
- Why: one spelling policy across the product.
- Verified: yes (code)
- Systemic: no

### COPY-10: History row facts have no singular form
- Rule: 4. Plain words in the user's vocabulary
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/stories/StoryRow.tsx:180`, `client/surfaces/stories/StoryRow.tsx:189`, `client/surfaces/stories/StoryRow.tsx:247`
- Evidence: facts render `{n} files`, `{n} code stops`, and the glance detail renders `{n} files, {n} stops` with no singular branch, so a one-file story reads `1 files` and `1 code stops`.
- Fix: route all three through the surface `plural()` helper, as the primers fact already does.
- Why: wrong plurals read as broken strings, and the helper exists one import away.
- Verified: yes (code; no single-file row was captured)
- Systemic: no

### COPY-11: Excluded-only escape is hardcoded to the singular
- Rule: 4. Plain words in the user's vocabulary
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/StoryView.tsx:704`
- Evidence: the storyless escape button always reads `Review excluded file`, even when `excludedFiles` holds several.
- Fix: pluralize on `payload.excludedFiles.length`, for example `Review {n} excluded files`.
- Why: the label miscounts whenever more than one file is excluded.
- Verified: yes (code; the excluded-only state was not captured)
- Systemic: no

### COPY-12: Generator CTA sublabel ships without its count
- Rule: 4. Plain words in the user's vocabulary
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/StoryView.tsx:576`, `client/surfaces/review/engine/review-engine.js:3324`
- Evidence: the server renders `{plural(filesChanged, "file")} selected`, and this surface `plural()` returns only the noun, so first paint reads `files selected, gaps are flagged as Unexplained`. The engine later rewrites it to `N selected files`.
- Fix: render the count server-side to match the engine string, `{filesChanged} {plural(filesChanged, "file")} selected`.
- Why: the shipped sentence is missing its number until the engine runs.
- Verified: yes (code)
- Systemic: no

### COPY-13: Coverage copy switches between you and the reviewer
- Rule: 3. Speak to the reader as you
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/review/ReviewView.tsx:250`, `client/surfaces/review/ReviewView.tsx:266`, `src/render.ts:1010`
- Evidence: the staged note says `which version you intend to commit` while the coverage foot says `Excluded files remain a separate reviewer responsibility` (and the plural variant for the storyless view).
- Fix: keep the reader as you, for example `You still need to inspect excluded files before deciding.` Apply to the server mirror too.
- Why: one screen should not switch perspective mid-page.
- Verified: yes (code)
- Systemic: no

### COPY-14: Diagram help has a grammar slip
- Rule: 4. Plain words in the user's vocabulary
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/engine/review-engine.js:428`
- Evidence: `Open fullscreen to drag the diagram, scroll to zoom, or use the keyboard arrow, plus, minus, and zero keys.`
- Fix: `Open fullscreen to drag the diagram, scroll to zoom, or use the arrow, plus, minus, and zero keys.`
- Why: `the keyboard arrow` should be `the arrow keys`.
- Verified: yes (code)
- Systemic: no

### COPY-15: Repair menu promises each decision its own local camera
- Rule: 4. Plain words in the user's vocabulary
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/review/Sidebar.tsx:53`, `src/render.ts:370`
- Evidence: `Split into smaller stops` carries the detail `Give each decision its own local camera.` Camera is scene machinery, not reviewer vocabulary.
- Fix: `Give each decision its own stop.` Apply to the server mirror too.
- Why: the detail should say what the reviewer gets, not how scenes work.
- Verified: yes (code)
- Systemic: no

### COPY-16: Queued comment removal confirms through a native OK dialog
- Rule: 5. Buttons name the action
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/review/engine/review-engine.js:3201`
- Evidence: `removeQueuedComment` calls `window.confirm('Remove this queued comment?')`, so the answers are the browser OK and Cancel. The app already replaced this exact pattern with a labeled dialog for story removal.
- Fix: confirm in place with `Remove comment` and `Cancel`, following the RemoveStoryDialog pattern.
- Why: OK never repeats the consequence, and the native dialog is the one confirm in the app that still uses it.
- Verified: yes (code; the queue was not captured with comments)
- Systemic: no

### COPY-17: Bulk reviewed toast reads marked reviewed
- Rule: 4. Plain words in the user's vocabulary
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/engine/review-engine.js:3115`
- Evidence: `toast('Every visible file is marked reviewed')`.
- Fix: `All visible files marked reviewed`.
- Why: `is marked reviewed` is ungrammatical as a result sentence.
- Verified: yes (code)
- Systemic: no

### COPY-18: Document titles are lowercase where headings are sentence case
- Rule: 8. One capitalization policy
- Severity: LOW
- Confidence: medium
- Locations: `src/server.ts:1284`, `src/server.ts:1490`, `src/server.ts:1333`
- Evidence: tab titles render `diffStory, pick a repo`, `diffStory, choose review scope`, and `{repo} review history`, while the pages head `Repositories`, `Choose what to review`, and `Review history`. The review tab already uses sentence case (`Reviewing the diff`).
- Fix: `Pick a repository`, `Choose review scope`, `{repo} Review history`.
- Why: tab titles should match the sentence case and terms of the pages they name.
- Verified: yes (code)
- Systemic: no

### COPY-19: Review history is named three ways from the pages around it
- Rule: 7. Links describe their destination
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/review/ReviewView.tsx:552`, `client/surfaces/change/ChangeApp.tsx:138`
- Evidence: the actions panel links `Saved reviews` with the desc `Open older review sessions for this repository.` The change nav links `History`. Both land on the page headed `Review history`, and `sessions` is otherwise the current session kicker, not saved items.
- Fix: title the action `Review history` with `Open an earlier saved review for this repository.` Rename the nav link to `Review history` if space allows, else keep `History` as the documented short form.
- Why: a link should carry the name of the page it opens.
- Verified: yes (code plus screens/change-desktop-dark.png)
- Systemic: no

### COPY-20: Editor choice details restate the editor name
- Rule: 14. One job per element
- Severity: LOW
- Confidence: medium
- Locations: `client/shared/editor-menu.tsx:14`
- Evidence: rows read `Zed, Workspace and exact source line with Zed` and `VS Code, Workspace and exact source line with VS Code`.
- Fix: one shared detail, for example `Opens the workspace at the exact source line`.
- Why: the detail repeats the label instead of saying what the choice does.
- Verified: yes (code; the menu open state was not captured)
- Systemic: no

### COPY-21: Missing repos are workspaces in one place only
- Rule: 2. One voice, flexible tone
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/picker/RecentRepos.tsx:353`
- Evidence: the disclosure reads `{n} unavailable {workspace, workspaces}` while the page otherwise says repositories, recent repositories, and `Remove from recent repositories`.
- Fix: `{n} unavailable {repository, repositories}`.
- Why: one list should not rename its items inside a disclosure.
- Verified: yes (code plus screens/picker-desktop-dark.png, which shows `1 unavailable workspace`)
- Systemic: no

### COPY-22: Empty state says Re-check where the nav says Reload
- Rule: 2. One voice, flexible tone
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/change/FileSummary.tsx:126`, `client/surfaces/change/ScopeCard.tsx:746`
- Evidence: the clean tree empty state offers `Re-check` while the nav on the same screen offers `Reload`. Both run `window.location.reload()`.
- Fix: label the empty state button `Reload` to match the nav.
- Why: one action on one screen should keep one name.
- Verified: yes (code; the empty state was not captured)
- Systemic: no

### COPY-23: Read aloud command explains itself as narration
- Rule: 2. One voice, flexible tone
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/review/ReviewApp.tsx:264`
- Evidence: the palette row pairs the title `Toggle read aloud` with the detail `Pause or resume narration`, while the transport reads `Play story` and `Stop narration`.
- Fix: detail `Pause or resume read aloud`, keeping one noun for the feature.
- Why: the title and its own detail should not use different names.
- Verified: yes (code; the palette was not captured)
- Systemic: no

### COPY-24: API errors mix lowercase fragments with full sentences
- Rule: 8. One capitalization policy
- Severity: LOW
- Confidence: medium
- Locations: `src/server.ts:635`, `src/server.ts:1229`, `src/comments.ts:180`
- Evidence: `invalid JSON`, `no such comment`, and `comment body is required` surface through toasts and status lines next to sentence case strings such as `Missing story id.` and `Could not open that path.`
- Fix: sentence case with a period, for example `Invalid JSON.`, `No such comment.`, `Comment body is required.`
- Why: error strings share the same toast styles, so they should share one shape.
- Verified: yes (code)
- Systemic: no

### COPY-25: Viewed command detail is written in system terms
- Rule: 4. Plain words in the user's vocabulary
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/review/ReviewApp.tsx:258`
- Evidence: `Toggle current file reviewed` carries the detail `Bind completion to this exact file diff.`
- Fix: `Mark this file reviewed for this exact diff.`
- Why: reviewers think in marked files, not bound completion.
- Verified: yes (code; the palette was not captured)
- Systemic: no

## Considered but rejected

| Location | Candidate | Rejected because |
|---|---|---|
| `client/surfaces/change/ChangeApp.tsx:160`, `client/surfaces/review/StoryView.tsx:472` | `The real diff`, `start with the real diff` | Intentional product stance, diff is ground truth, used consistently |
| `client/surfaces/review/ReviewView.tsx:72`, `client/surfaces/stories/story-state.ts:66` | `kept lazy`, `diff DOM`, `bounded renderer`, `bounded preview`, `scope-aware baseline` | Established developer vocabulary, explained where it first appears, used consistently |
| `client/surfaces/review/engine/review-engine.js:2688` | `review fingerprint` in the mark reviewed toast | Precise cause for a developer audience, names why the action is unavailable |
| `client/surfaces/review/StoryView.tsx:245`, `client/surfaces/review/StoryView.tsx:292` | `Where I'd distrust this first`, `What I ran` | Deliberate author voice, labeled `Author-flagged` at the source |
| `client/surfaces/picker/RecentRepos.tsx:285`, `client/surfaces/stories/EmptyHistory.tsx:13` | Empty states carry no button of their own | Each sits directly under its header action (`Add repository`, `Start review`) and the text echoes it |
| `client/surfaces/review/ReviewView.tsx:474`, engine composer `Copy` | `Copy all`, `Copy` without an object | Object is adjacent in both cases, and the queue button has the full accessible name |
| Engine `buildComposer` placeholder | Placeholder as the only visible field text | The `New comment` heading plus file and line anchor label the region, and the field has an accessible name |
| `client/shared/api.ts:107`, `client/shared/api.ts:114` | `The request failed.`, `Something went wrong.` defaults | Unreachable in practice, every caller passes a fallback or ignores the message |
| `client/surfaces/picker/FolderBrowser.tsx:85` | `Could not read that folder.` has no retry | The crumb trail stays visible and is the retry |
| `client/surfaces/change/RefPicker.tsx:403` | `No matching refs` names no query | The query sits in the field directly above the listbox |
| Engine sidebar, viewed, fullscreen toggles | Action labels on pressed toggles | Established codebase pattern with agreeing modalities, only the wrap toggle diverges (see COPY-4) |
| Engine repair toasts | `No Claude or Codex CLI found on PATH.`, `Could not start story repair.` | Transient toasts, retry is re-invoking, cause is specific for the audience |
| `client/surfaces/change/FileSummary.tsx:179` | `3 review files` header | Echoes the adjacent `Review N files` action, meaning is clear in context |
| `client/surfaces/review/StoryView.tsx:358` | `Optional, recommended` on the intent field | Honest compact pattern, optional but worth filling |
| `client/surfaces/review/ReviewApp.tsx:289`, `client/surfaces/review/ReviewApp.tsx:257` | `without hidden magic`, `Keep the review moving` | Light brand voice in non-critical palette spots |
| `src/tour.ts:1120` | Raw parse errors inside the change notice | Framed by the fixed what and recovery lines, appropriate for a developer tool |
| Composer and card errors | `your comment` versus `the comment` mix | Both read clearly, no user impact |
| Palette footer `C comment selection` versus `Comment selected code` | Verb form differs from the menu item | Conventional shortcut legend brevity |
| Story content prose in `.diffstory/story.json` | Step wording, summaries | Generated data, not product copy |
| `client/shared/nav.tsx:91` | `Home, your repositories` possessive | Isolated hover text, warm and harmless |

## Handoffs

- A11Y: `Review N files` visible label versus `Start review of N files` accessible name at `client/surfaces/change/FileSummary.tsx:187`, the accessible name does not contain the visible label.
- TYP: terminal period differs between `Could not start.` in `client/surfaces/progress/run-progress.ts:44` and `Could not start` in `client/surfaces/progress/state.ts:438`.
