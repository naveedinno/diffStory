# Experience findings
Scope inspected: picker (PickerApp, RecentRepos, FolderBrowser, SkillBanner, Hero), stories (StoriesApp, StoryRow, RemoveStoryDialog, EmptyHistory), change (ChangeApp, ScopeCard, RefPicker, refs, FileSummary), review (ReviewApp, ReviewView, StoryView, Sidebar, review-engine.js, progress-host), progress (ProgressPanel, state, use-progress-run), shared (nav, api, theme-menu, editor-menu, use-modal), server scope and change rendering (src/scope.ts, src/server.ts changeScreen, src/git.ts resolveBase) where it determines rendered UI, and screens review-desktop-dark, change-desktop-dark, stories-desktop-dark plus the runtime.md capture table.
Not inspected: none. Every rule was checked. Interaction states the capture pass did not reach (composer, generation runs, dialogs open) were inspected in code rather than in screenshots.
Score: 2/4, strong state coverage with one data loss gap and silent scope substitution

## Findings

### EXP-1: Comment drafts are discarded without asking
- Rule: 5. Forms validate at the right moment
- Severity: HIGH
- Confidence: high
- Locations: `client/surfaces/review/engine/review-engine.js:3187`, `client/surfaces/review/engine/review-engine.js:3197`, `client/surfaces/review/engine/review-engine.js:3838`
- Evidence: the close button runs `close.onclick=function(){removeComposer(box,true);};`, opening a second composer starts with `removeComposer(null,false)`, and Escape runs `removeComposer(inlineComposer,true)`. `removeComposer` removes the node unconditionally, nothing stashes the textarea, and no `beforeunload` guard exists, so typed comment text is lost on Escape, on the close button, on starting another comment, and on reload or navigation.
- Fix: in the engine's composer code, read the textarea before removal and, when it holds text, stash `{anchor, flavor, text}` and restore it when a composer opens on the same anchor again. Add a `beforeunload` guard while a dirty composer is mounted, following the existing `pagehide` listener style for the live event source.
- Why: rule 5 requires typed input to survive navigation and an ask before unsaved changes are dropped. A reviewer who presses Escape or reloads mid comment loses the whole note with no recovery.
- Verified: yes (code inspection of all three dismissal paths and the localStorage key list, which holds no composer draft)
- Systemic: yes

### EXP-2: Unknown scope refs are silently replaced with no error state
- Rule: 1. Every data surface has its states
- Severity: MEDIUM
- Confidence: high
- Locations: `src/scope.ts:48`, `src/scope.ts:63`, `src/git.ts:123`
- Evidence: `commitScope` runs `const commit = isCommitRef(repo, requested) ? requested : 'HEAD';`, `branchScope` falls back to `currentBranch(repo) ?? 'HEAD'` for an unknown branch and drops an unknown parent, and `resolveBase` returns the default base when `rev-parse --verify` fails. No notice is attached, so `?scope=commit&commit=ma` renders the latest commit while the URL still names the unknown ref.
- Fix: when the requested ref does not resolve, pass the existing `notice` argument of `changeScreen` (src/server.ts) with the unknown ref named and the substituted scope stated, for example that `ma` is not a known ref so the page shows the latest commit. Render it in the amber notice `ChangeApp` already paints above the scope controls.
- Why: rule 1 requires an error state that says what failed. A reviewer can read the wrong scope believing it is the one requested, and the URL disagrees with the page.
- Verified: yes (code inspection of the resolution chain and the payload, which carries no unknown ref signal)
- Systemic: yes

### EXP-3: Ref fields navigate while typing and destroy in progress input
- Rule: 5. Forms validate at the right moment
- Severity: MEDIUM
- Confidence: high
- Locations: `client/surfaces/change/ScopeCard.tsx:307`, `client/surfaces/change/ScopeCard.tsx:412`
- Evidence: `onChange` calls `commit(next, 700)`, and `scheduleNavTo` assigns `window.location.href` after the delay unless the URL is unchanged. A 700ms pause mid word navigates to a partial ref, the new page rebuilds the field from the resolved scope, and the typed text is gone. Combined with EXP-2, the landing page silently shows a different scope.
- Fix: stop navigating from `onChange`. Navigate on row choice, Enter, and blur commit, which the `wire()` helper already distinguishes, and only auto navigate a typed value that matches a ref from the cached `/api/refs` list.
- Why: rule 5 requires typed input to survive re-renders and navigation. Pausing to think in a ref field currently costs the whole entry.
- Verified: yes (code inspection of the debounce, the same URL guard, and the state initialisers that rebuild fields from payload)
- Systemic: no

### EXP-4: Folder read failure has no retry
- Rule: 1. Every data surface has its states
- Severity: MEDIUM
- Confidence: high
- Locations: `client/surfaces/picker/FolderBrowser.tsx:401`
- Evidence: the error branch renders only `<div className="p-[26px] text-center text-[13px] text-text-3">{READ_ERROR}</div>`. A transient failure (permissions, a dropped server connection) leaves the reviewer with no path forward except closing the sheet and starting over.
- Fix: keep the last requested path in a ref when `browse()` runs, and render a Try again button beside `READ_ERROR` that calls `browse()` with that path, in the existing ghost button idiom.
- Why: rule 1 requires an error state that says how to recover, with a retry when a retry can help. Reading a local folder is exactly retryable.
- Verified: yes (code inspection; error and loading states were not in the capture set)
- Systemic: no

### EXP-5: Ref suggestions fail to a permanent loading row
- Rule: 1. Every data surface has its states
- Severity: MEDIUM
- Confidence: high
- Locations: `client/surfaces/change/RefPicker.tsx:73`, `client/surfaces/change/refs.ts:102`
- Evidence: `loadRefs` catches failure with `inflightRefs = null; return null;`, and `optionsFor` returns `[option("", "Loading refs…", "reading local git refs", "")]` whenever data is null. The listbox then shows "Loading refs…" forever with no error and no retry control. A retry only happens implicitly the next time the listbox opens.
- Fix: track the load failure in `useRefPicker` state and render an error row plus a Retry row in `RefListbox` that reruns `loadRefs`. Keep the silent first attempt, but do not present a failed load as an ongoing one.
- Why: rule 1 requires an error state with a retry. A reviewer with a failing refs endpoint sees a control that looks busy but will never resolve.
- Verified: yes (code inspection)
- Systemic: no

### EXP-6: File content search failure silently narrows results
- Rule: 1. Every data surface has its states
- Severity: MEDIUM
- Confidence: high
- Locations: `client/surfaces/review/engine/review-engine.js:3100`, `client/surfaces/review/engine/review-engine.js:3072`
- Evidence: the search catch runs `fileSearchMatches={};applyFileFilters();`, so a failed `/api/review/file-search` request drops every content match while the query stays. When no path matches either, the sidebar reports "No matching files", which reads as a true empty result rather than a backend failure.
- Fix: on search failure keep the previous matches and render one inline note near the file search field that content search is unavailable and only name matches are shown. The existing debounced request already retries on the next keystroke.
- Why: rule 1 requires errors and partial results to be marked. Unmarked degradation lets a reviewer conclude no file matches when the search never ran.
- Verified: yes (code inspection of the catch and the filter predicate)
- Systemic: no

### EXP-7: Coverage evidence failure names no recovery inline
- Rule: 1. Every data surface has its states
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/engine/review-engine.js:2891`, `client/surfaces/review/engine/review-engine.js:2937`
- Evidence: the trust catch writes only the message (`Could not calculate coverage.`) with a Reload button solely for the lease conflict case. Re-entering the Review tab does refetch, and the pill says "Coverage unchecked · open to retry", but the error block itself offers no action and never names that path.
- Fix: use the existing `reviewLazyAction` helper so a transient trust failure renders a Retry button that calls `loadTrustEvidence`, matching the step panel, file panel, and drift preview errors.
- Why: rule 1 asks the error to say how to recover. The recovery hint exists but sits in a different component from the failure.
- Verified: yes (code inspection)
- Systemic: no

### EXP-8: Queued comment removal uses a native confirm unlike story removal
- Rule: 8. Consistency and familiarity
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/engine/review-engine.js:3201`, `client/surfaces/stories/RemoveStoryDialog.tsx:117`
- Evidence: comment removal runs `if(!window.confirm('Remove this queued comment?'))return;`, while story removal opens a custom dialog titled "Remove this review?" that names the consequence and scope, focuses Cancel, and keeps a failed delete open with its reason. The native prompt names neither the comment nor its anchor and cannot be retried in place.
- Fix: replace the native confirm with the dialog idiom from `RemoveStoryDialog`, naming the file and line anchor, or at minimum name the consequence and anchor in the confirm text so the two destructive paths read as one product.
- Why: rule 8 requires things that look alike to behave alike, and rule 4 asks a confirmation to name consequence and scope. Two delete paths with different weight teach two different lessons about safety.
- Verified: yes (code inspection)
- Systemic: no

### EXP-9: Review position lives in storage, not the URL
- Rule: 6. Wayfinding
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/engine/review-engine.js:2042`, `client/surfaces/review/engine/review-engine.js:984`
- Evidence: `currentReviewPosition` persists `{view, step, file, scroll, reviewTab}` to localStorage, and `setView` writes no URL state. Reload restores the main position, but the file search query and active file filter are not in the key, and no view, file, or step can be linked or shared.
- Fix: mirror view, file, and step into the query string with `history.replaceState` on change and read it on load, keeping the localStorage resume as the fallback. This codebase already avoids `pushState` for these transitions, so replace keeps Back behaving.
- Why: rule 6 asks URLs to reflect meaningful state so reload and share keep it. Reload mostly works, share does not, and filters reset.
- Verified: yes (code inspection of the resume key and the absence of URL writes)
- Systemic: no

### EXP-10: Folder navigation flashes back to a spinner
- Rule: 7. Perceived speed
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/picker/FolderBrowser.tsx:132`
- Evidence: `browse()` calls `setView({ kind: "loading" })` before every fetch, replacing the current listing with the "Loading…" row even when descending one level from a fully rendered list.
- Fix: keep the previous listing mounted at reduced opacity with a small loading row while the fetch runs, per the rule 7 refetch pattern, and only show the full loading view on the first open.
- Why: rule 7 asks refetches to keep previous content visible so navigation feels continuous. The current flash makes every descent read as a blank restart.
- Verified: no (code inspection only; folder navigation timing was not captured on video)
- Systemic: no

## Considered but rejected
| Location | Candidate | Rejected because |
|---|---|---|
| `client/surfaces/picker/RecentRepos.tsx:285`, `client/surfaces/stories/EmptyHistory.tsx:13` | Empty states carry no inline next action | Deliberate and reasoned: the primary action stays in the section header on both surfaces so the empty state is never the only path, and it is always visible beside the empty panel. |
| `client/surfaces/review/engine/review-engine.js:2937` | Coverage failure recovery is undiscoverable | The pill reads "Coverage unchecked · open to retry" and opening the Review tab refetches, so a recovery path with guidance exists. Kept only as LOW EXP-7 for the inline gap. |
| `client/surfaces/picker/SkillBanner.tsx:87` | Silent `/api/agents` failure | Deliberate: the picker's job is opening repositories, and a supplementary banner must not block or alarm. Failure renders nothing, which is the correct degradation here. |
| `client/surfaces/review/StoryView.tsx:360` | Reviewer note textarea has no unsaved guard | One optional field in a one shot setup panel. Harm is low and a confirm on every navigation away would punish the common path. |
| `client/surfaces/review/ReviewView.tsx:165` | Coverage pill pending state | Honest unknown ("Checking coverage…") that settles after first paint instead of defaulting to green. This is the pattern done right. |
| `client/surfaces/picker/PickerApp.tsx:50` | Status toast never auto dismisses | Undo stays until dismissed, which exceeds the rule's timing floor and suits a removal undo. No harm found. |
| `client/surfaces/review/engine/progress-host.tsx:22` | Close hidden during recovery | Deliberate: closing mid recovery would strand the reviewer with no story and no explanation. Agency is preserved through Stop and the footer actions. |

## Handoffs
- LAY: the top right control in screens/diff-mobile-dark.png and screens/diff-mobile-light.png renders clipped at the viewport edge. If that control owns a flow action, reviewers on narrow screens may lose a path. Location screens/diff-mobile-dark.png.
- A11Y: runtime.md notes the active Story tab shows no distinct focus ring at tab stop 3. Wayfinding depends on that ring being visible. Location screens/review-focus-midpass.png.
- A11Y: any dirty confirm added for EXP-1 needs focus management and an announcement plan, which that lens owns.
- MOT: reduced motion rest states render byte identical, but animated transitions under reduce were not exercised (runtime.md). MOT owns whether movement remains.
- COPY: error and empty wording (for example "Could not read that folder") could name the failing object. Structure is covered here, wording belongs there.
