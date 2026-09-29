# Layout findings
Scope inspected: brief.md, runtime.md, and 19 dark-theme captures across picker, stories, change, review overview, story step, and raw diff at desktop, tablet, mobile, 320px, and 200 percent zoom. Light-theme captures were not opened because layout is token driven and theme independent. Code sweeps covered physical direction properties, breakpoints and container queries, fixed sizes on text containers, safe-area insets, separators and gaps, modal and panel structure, and the review chrome, file panel head, filmstrip, and dock in client and in src/render.ts.
Not inspected: ProgressPanel run states, comment composer and queue, RefPicker open state, RemoveStoryDialog, editor and theme menus open, narration-active dock, concept and code-focus story steps, empty and error states (none captured, runtime.md lists them as not captured). No dir=rtl render was available, so RTL mirroring was judged from code only. Reduced-motion transitions and CLS were not instrumented.
Score: 2/4, strong spacing system and breakpoints, but two actions are unreachable at supported widths.

## Findings

### LAY-1: Files toolbar clips the view mode toggle at tablet widths
- Rule: 13. Plan for growth and clipping (also 12. Hold structure until it breaks)
- Severity: HIGH
- Confidence: high
- Locations: `client/surfaces/review/review.css:616`, `client/surfaces/review/review.css:1053`, `client/surfaces/review/review.css:1058`, `src/render.ts:880`
- Evidence: screens/diff-tablet-dark.png shows the Unified pill cut at the right viewport edge with Split and Full file unreachable. The head is `display:flex` with no wrap: `.ds-filepanel-head{...display:flex;align-items:center;gap:10px;padding:10px 16px;...}`. Wrapping only exists inside `@media (max-width:720px)`, so at a 768px viewport with the 240px rail open the panel is about 490px wide and the seven head children overflow with no scroll and no cue.
- Fix: wrap by container width instead of viewport width. `.ds-filedetail` already sets `container-type:inline-size` (review.css:613), and the step toolbar already uses this pattern (`@container (max-width:420px)` at review.css:521). Move the flex-wrap and order rules from the 720px block into an equivalent `@container` rule on the file detail container so the rail-open tablet layout wraps too.
- Why: a viewport breakpoint cannot see the rail state, so the toolbar breaks where the content breaks, not where the preset expects. Split and Full file are unreachable with zero cue at a supported width.
- Verified: yes (capture plus code)
- Systemic: no

### LAY-2: Storyless review chrome clips the Reload action at 375px
- Rule: 13. Plan for growth and clipping
- Severity: HIGH
- Confidence: high
- Locations: `client/surfaces/review/ReviewApp.tsx:497`, `client/surfaces/review/review.css:1360`, `client/surfaces/review/review.css:1363`, `client/surfaces/review/review.css:1428`
- Evidence: screens/diff-mobile-dark.png shows a second circle half visible past the right viewport edge. By elimination it is Reload: the storyless diff view renders it (ReviewApp.tsx:498), its label hides below 900px (review.css:1413), and below 470px the editor toggle and title are hidden (review.css:1428) leaving mobile nav (88px), tabs (about 226px), theme (44px) and Reload (44px) plus gaps and padding, roughly 418px in a 375px bar. Every child is flex none and the bar has no overflow handling, so the last action clips.
- Fix: at the 470px breakpoint let `.ds-reviewchrome-utilities` scroll horizontally with a hidden scrollbar (`overflow-x:auto; scrollbar-width:none`) so trailing actions stay reachable instead of clipping. Alternative: move Reload into the rail menu at narrow widths.
- Why: a critical action parked at the clip-prone trailing edge of fixed chrome is unreachable at a supported mobile width, with no cue that it exists.
- Verified: yes (capture plus code)
- Systemic: no

### LAY-3: Physical direction properties throughout, layout will not mirror for RTL
- Rule: 5. Logical properties and RTL mirroring
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/review.css:104`, `client/surfaces/review/review.css:160`, `client/surfaces/review/review.css:203`, `client/surfaces/review/review.css:233`, `client/surfaces/review/review.css:240`, `client/surfaces/review/review.css:248`, `client/surfaces/review/review.css:488`, `client/surfaces/review/review.css:539`, `client/surfaces/review/review.css:650`, `client/surfaces/review/review.css:671`, `client/surfaces/review/review.css:680`, `client/shared/nav.tsx:94`, `client/surfaces/picker/Hero.tsx:17`, `client/surfaces/picker/Hero.tsx:35`, `client/surfaces/picker/FolderBrowser.tsx:381`, `client/surfaces/picker/FolderBrowser.tsx:419`, `client/surfaces/picker/RecentRepos.tsx:154`, `client/surfaces/stories/StoryRow.tsx:60`, `client/surfaces/change/ScopeCard.tsx:110`, `client/surfaces/change/FileSummary.tsx:61`, `client/surfaces/change/FileSummary.tsx:79`, `client/surfaces/progress/Elapsed.tsx:42`
- Evidence: samples include `margin-left:-8px` (review.css:104), `.ds-tab:first-child{border-left:none}` (review.css:233), `.ds-spine{position:absolute;left:34px;...}` (review.css:248), `-ml-3.5 ... pr-4 pl-3.5` (Hero.tsx:17), `border-l ... first:pl-0` (StoryRow.tsx:60), `text-left` rows (ScopeCard.tsx:110, FolderBrowser.tsx:419). A sweep for margin-left, padding-right, left, right, text-align left, and the ml, mr, pl, pr, and text-left Tailwind forms returns dozens of matches in every surface.
- Fix: convert direction-dependent declarations to logical properties (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align:start`, `border-inline-start`, and the `ms`, `me`, `ps`, `pe`, `start`, `end`, `text-start` utilities). Keep physical properties for genuinely physical geometry such as the toast `left:50%` centering (review.css:730) and the rail resizer edge (review.css:224).
- Why: under dir=rtl nothing mirrors, so any future localization or RTL user gets a broken reading order. Severity stays LOW because English-only with no dir handling is the app stated convention, so this is future debt rather than a live break.
- Verified: yes (code sweep; no dir=rtl render was available to confirm visually)
- Systemic: yes

### LAY-4: Fixed bottom UI ignores safe-area insets
- Rule: 11. Content bleeds, controls float
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/review/review.css:730`, `client/surfaces/progress/ProgressPanel.tsx:96`
- Evidence: `.ds-toast{position:fixed;left:50%;bottom:26px;...}` and the floating panel `fixed right-[18px] bottom-[18px] ...`. The only safe-area use in the app is the picker undo toast at `client/surfaces/picker/PickerApp.tsx:62` (`bottom-[calc(16px+env(safe-area-inset-bottom))]`), so the convention exists but these two fixed elements miss it.
- Fix: follow the picker precedent in the same idiom: `bottom:calc(26px + env(safe-area-inset-bottom))` for the toast, and `right-[calc(18px+env(safe-area-inset-right))] bottom-[calc(18px+env(safe-area-inset-bottom))]` for the floating panel.
- Why: on phones with a home indicator or curved corners, fixed bottom UI without the inset can sit under system chrome. Impact is limited to transient elements on notched phones.
- Verified: no (needs a notched-device or simulated-safe-area capture; static code only)
- Systemic: no

## Considered but rejected
| Location | Candidate | Rejected because |
|---|---|---|
| `client/surfaces/stories/StoriesApp.tsx:119`, `client/surfaces/picker/Hero.tsx:14` | Page header hairline paired with 22px gaps | 1px low-contrast section dividers are the project stated token idiom and read quietly in captures |
| Surfaces-wide `gap-[7px]`, `gap-[11px]`, `px-[19px]`, `text-[13.5px]` and similar | Off-scale arbitrary spacing values | Each surface is internally consistent and captures show coherent rhythm; deliberate optical tuning inside an established compact density |
| `client/surfaces/review/review.css:1417`, `client/surfaces/review/review.css:1428` | Chrome gaps shrink to 2 to 5px on mobile | Compact professional chrome with distinct 44px targets; target size itself belongs to A11Y |
| screens/review-step-mobile-dark.png | Code lines clip horizontally in the step view | Cut glyphs are the standard scroll cue, and the Wrap toggle plus horizontal scroll are provided |
| screens/change-tablet-dark.png | Metrics ledger hidden below the breakpoint | Identical counts are duplicated in the FileSummary header, so nothing is lost |
| `client/surfaces/stories/StoryRow.tsx:171` | Summary clamped to two lines with no expander | Preview pattern; the full review is one tap away through the card link, which is the expansion path |
| `client/surfaces/review/review.css:1174` | Filmstrip hides its scrollbars | The next node peeks past the edge and the dock prev/next arrows give an explicit cue, confirmed in screens/review-step-mobile-dark.png |
| screens/diff-mobile-dark.png toolbar | File head control rows at 375px | The 720px wrap block works: controls reflow to two ordered rows with nothing clipped |

## Handoffs
- A11Y: the LAY-2 root cause also clips Reload at 320px, and 320px plus 200 percent zoom belong to accessibility. Confirm target sizes in the 470px chrome where gaps shrink to 2px (review.css:1428), and confirm the Start CTA stays reachable at 200 percent zoom where runtime.md reports it below the fold.
- TYP: title and description truncation mechanics at narrow widths (StoryRow.tsx:151, StoryRow.tsx:171, FileSummary dir and file split). Layout holds via ellipsis; the mechanics are typography owned.
