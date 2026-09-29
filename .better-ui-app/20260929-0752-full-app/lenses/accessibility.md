# Accessibility findings
Scope inspected: client/entry, client/shared, client/surfaces (picker, stories, change, review, progress), client/styles.css, review markup in src/render.ts and src/diff-render.ts, review-engine.js keyboard and focus behavior, runtime.md and screens (review-focus-skiplink, review-focus-midpass, review-desktop-dark, diff-mobile-dark, change-mobile-dark, picker-modal-desktop-dark).
Not inspected: live screen-reader announcement runs (no screen reader in this environment), forced-colors rendering (no emulation run), ProgressPanel run states and comment composer queue interactions (not captured, runtime.md), reduced-motion transition behavior (not exercised, MOT owns), diff view at 320px (not captured), client/vendor/beui internals (excluded).
Score: 2/4, solid foundation with real focus and naming gaps to fix.

## Findings

### A11Y-1: Selected controls lose their focus ring in dark theme
- Rule: 3. Visible focus
- Severity: HIGH (Trigger: A keyboard-reachable control with no visible focus indicator)
- Confidence: high
- Locations: `client/surfaces/review/review.css:1378`, `client/surfaces/review/review.css:656`, `client/surfaces/review/review.css:273`, `client/surfaces/review/review.css:601`
- Evidence: the generic ring is unlayered `button:focus-visible` at specificity (0,1,1) (`review.css:1289`: `button:focus-visible,a:focus-visible,summary:focus-visible{outline:none;box-shadow:var(--shadow-focus)}`). Each of these resting rules beats it and sets its own shadow or none: `:root .ds-reviewchrome-utilities .ds-tab.is-active{...box-shadow:0 1px 2px rgba(0,0,0,.25)}`, `.ds-fileitem.is-active{background:var(--fill-2);box-shadow:inset 0 0 0 1px var(--accent-line)}`, `.ds-stepcard.is-intro{...box-shadow:none}`, `.ds-composer-tab.is-active{...box-shadow:0 1px 3px rgba(0,0,0,.18)}`. None has its own `:focus-visible` rule, and the layered global ring in `client/styles.css:52` loses to all unlayered rules. Light theme tabs are exempt (own rule at `review.css:1092`).
- Fix: give each its own unlayered focus rule in review.css, following the existing `.ds-modetoggle button:focus-visible` pattern, for example `.ds-tab.is-active:focus-visible{outline:2px solid var(--accent-blue);outline-offset:2px}` and the same shape for `.ds-fileitem.is-active`, `.ds-stepcard.is-intro`, `.ds-composer-tab.is-active`.
- Why: keyboard users tab onto the active Story tab, the selected file, the intro step card, and the active comment-type radio and see no focus change. The active Story tab case is confirmed in runtime.md (Tab stop 3 shows only the resting shadow).
- Verified: yes (runtime.md keyboard observation for the tab; specificity analysis in code for all four)
- Systemic: yes

### A11Y-2: Reading path is hidden from screen readers
- Rule: 2. Accessible names everywhere
- Severity: HIGH (Trigger: hides content from assistive technology)
- Confidence: high
- Locations: `client/surfaces/review/StoryView.tsx:116`
- Evidence: `<p className="ds-intro-reading" aria-label={...}>` with children `<span aria-hidden="true">` for the separator and the whole visible path. `aria-label` on a role-less paragraph is ignored by screen readers, and the `aria-hidden` spans are removed from the tree, so only the change-type label remains.
- Fix: keep the visible text aria-hidden and add a project `ds-sr-only` span with the spoken sentence, for example `<span className="ds-sr-only">. Reading path: {spoken}</span>`, and remove the `aria-label` from the `p`.
- Why: screen-reader users miss the reading-order guidance ("A, then B, then C") on the review overview, which is the entry point of the guided flow.
- Verified: yes (code; ARIA name computation for generic elements plus aria-hidden removal)
- Systemic: no

### A11Y-3: No focus indicator in forced-colors mode
- Rule: 16. Other user preferences
- Severity: HIGH (Trigger: A keyboard-reachable control with no visible focus indicator)
- Confidence: medium
- Locations: `client/styles.css:52`, `client/surfaces/review/review.css:1289`, `client/generated/theme.css:217`
- Evidence: every focus ring in the app is `box-shadow` (`:focus-visible{outline:none;box-shadow:var(--shadow-focus)}` plus per-component copies), and a repo-wide search finds zero `forced-colors` handling. Forced-colors mode does not render box-shadow, while `outline:none` still applies, so no keyboard focus indicator survives. Only `.ds-concept-diagram-tools button:focus-visible` (real `outline`, `review.css:1209`) and `.ds-modetoggle button:focus-visible` (`review.css:784`) keep a drawn ring.
- Fix: append one unlayered rule at the end of review.css and shared.css: `@media (forced-colors:active){:focus-visible{outline:2px solid Highlight;outline-offset:2px}}`, and confirm it wins over the component-level `outline:none` rules.
- Why: keyboard users in Windows High Contrast or any forced-colors setting cannot see where focus is anywhere in the app.
- Verified: no (needs a forced-colors emulation run; mechanism follows documented platform behavior)
- Systemic: yes

### A11Y-4: Toasts vanish after 4.2 seconds, errors included
- Rule: 15. Timed content and autoplay
- Severity: MEDIUM
- Confidence: high
- Locations: `client/surfaces/review/engine/review-engine.js:3578`, `client/surfaces/review/ReviewApp.tsx:596`
- Evidence: `toastTimer=setTimeout(function(){...toastEl.classList.remove('is-show');...},4200)` applies to both tones, and error callers are real flows (`toast(...,'error')` for failed comment save at `:3191`, copy failure at `:3603`, aloud failure at `:1791`). The region itself is stable (`#ds-toast`, `role="status"`), so structure is fine; only timing and persistence fail.
- Fix: keep the stable `#ds-toast` region, raise the polite timeout to at least 5000 ms, and do not auto-dismiss the error tone: leave error text until the next toast or an explicit dismiss, in the engine's existing `toast()` shape.
- Why: sighted users who read slowly lose error messages before finishing them, and a 4.2 second toast is below the 5 second floor for timed content.
- Verified: yes (code; durations and error call sites read directly)
- Systemic: no

### A11Y-5: Filmstrip has no roving tabindex
- Rule: 4. Full keyboard support
- Severity: MEDIUM
- Confidence: high
- Locations: `client/surfaces/review/StoryView.tsx:655`, `client/surfaces/review/StoryView.tsx:667`
- Evidence: every filmstrip node is a plain `<button>` in natural tab order (Overview plus one per step; 18 in the captured story, and `client/surfaces/review/Sidebar.tsx:17` cites a real 245-step story). The engine handles filmstrip hover, scroll, and tooltip only, with no arrow-key walk, unlike rail beats (`moveRailBeat`) and tabs (arrow walk at `review-engine.js:3883`).
- Fix: copy the existing tab roving pattern: active node `tabIndex={0}`, the rest `-1`, ArrowLeft and ArrowRight move and focus, Home and End jump, in `review-engine.js` beside the view-tab walk.
- Why: keyboard users must Tab through every step button of a long story to pass the filmstrip, which makes the constant review-step traversal meaningfully harder.
- Verified: yes (code; markup plus absence of key handling)
- Systemic: no

### A11Y-6: File-tree reviewed and unexplained badges are not perceivable to assistive technology
- Rule: 13. Color is never the only signal
- Severity: MEDIUM
- Confidence: high
- Locations: `client/surfaces/review/Sidebar.tsx:338`, `client/surfaces/review/Sidebar.tsx:342`, `client/surfaces/review/Sidebar.tsx:383`, `client/surfaces/review/engine/review-engine.js:2694`
- Evidence: the reviewed check is `<span className="ds-fileitem-viewed" aria-hidden="true">✓</span>` and `syncViewed()` only toggles classes and `data-reviewed`, never the accessible name. The unexplained flag is a bare `▲` glyph with a hover-only `title`, unlike the tab flag which is `aria-hidden` with its count folded into `reviewTabLabel()`.
- Fix: in `syncViewed()`, append the state to each file button's accessible name the way `reviewTabLabel()` already composes the Review tab, for example `aria-label="<file>, reviewed"` and `", <n> unexplained changes"`, and mark both glyph spans `aria-hidden="true"`.
- Why: screen-reader users cannot tell reviewed from unreviewed files or find unexplained files in the tree, while sighted users get both from the badges.
- Verified: yes (code)
- Systemic: no

### A11Y-7: Blame popover has no accessible name and no focus indicator
- Rule: 5. Trap and restore focus
- Severity: MEDIUM
- Confidence: high
- Locations: `client/surfaces/review/engine/review-engine.js:3687`, `client/surfaces/review/engine/review-engine.js:3701`, `client/surfaces/review/review.css:967`
- Evidence: `blamePop.setAttribute('role','dialog')` with `tabIndex=-1` but no `aria-label`, `aria-labelledby`, or `aria-modal`; the title is a plain `span.ds-blame-title` with no id. Focus is moved into it on open (`blamePop.focus()`), while `.ds-blame-pop:focus{outline:none}` removes the outline and its resting `box-shadow:var(--shadow)` beats the layered global ring, so the focused container shows no indicator.
- Fix: point `aria-labelledby` at the blame title (give the title span an id in `openBlame`), and either drop the `:focus{outline:none}` rule or add the standard `box-shadow:var(--shadow-focus)` ring beside it.
- Why: screen-reader users hear an unnamed dialog, and sighted keyboard users get no visible confirmation of where focus landed. Escape and focus return already work.
- Verified: yes (code)
- Systemic: no

### A11Y-8: Theme control is clipped at mobile width
- Rule: 14. Zoom, reflow and text resize
- Severity: MEDIUM
- Confidence: medium
- Locations: `screens/diff-mobile-dark.png`
- Evidence: in the 375px All-files capture the circular theme control at the top-right chrome edge is cut off by the viewport. The 320px captures cover review overview and change scope only, so the diff view at 320px is unmeasured.
- Fix: owned by LAY (chrome overflow at small widths); a11y needs the control fully visible and operable at 320px with no horizontal page scroll.
- Why: a clipped control is harder to see and hit, and clipping at 375px usually means worse at 320px.
- Verified: no (screenshot shows clipping at 375px; 320px diff view still needs a capture)
- Systemic: no

### A11Y-9: aria-label on role-less divs and spans is ignored
- Rule: 2. Accessible names everywhere
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/StoryView.tsx:232`, `client/surfaces/review/StoryView.tsx:392`, `client/surfaces/review/Sidebar.tsx:97`, `client/surfaces/change/ScopeCard.tsx:663`, `client/surfaces/change/ScopeCard.tsx:670`, `client/surfaces/change/ScopeCard.tsx:679`
- Evidence: `aria-label` sits on plain `div` and `span` elements (`ds-intro-utility`, `ds-storyscope-actions`, `ds-railbeats`, two summary slots, the selected-scope summary). Without a landmark, widget, or group role, assistive technology ignores the label; here the content stays readable, so nothing is hidden.
- Fix: add `role="group"` where the label adds context, or delete the `aria-label` where the content speaks for itself.
- Why: dead labels mislead future readers of the code into thinking the region is named, and add nothing for users.
- Verified: yes (code)
- Systemic: yes

### A11Y-10: Mobile scrim is a focusable button hidden from assistive technology
- Rule: 1. Native elements first
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/Sidebar.tsx:610`
- Evidence: `<button className="ds-rail-scrim" ... aria-label="Close review navigation" aria-hidden="true" tabIndex={-1} />`. When the rail opens on small screens this visible close control stays out of the tab order and the accessibility tree.
- Fix: remove `aria-hidden` and `tabIndex={-1}` so it joins the modal tab loop like the drawer scrim pattern, or replace it with a non-focusable `div` since the sidebar toggle and Escape already close the rail.
- Why: `aria-hidden` must never sit on a focusable element; equivalents exist (sidebar toggle, Escape), so impact is limited to an inconsistent dismissal path.
- Verified: yes (code)
- Systemic: no

### A11Y-11: Theme and editor menus do not open on ArrowDown or ArrowUp
- Rule: 4. Full keyboard support
- Severity: LOW
- Confidence: high
- Locations: `client/shared/theme-menu.tsx:105`, `client/shared/editor-menu.tsx:124`
- Evidence: both toggles wire `onClick` only, with arrow-key handling confined to the open menu (`onMenuKeyDown`). The menu-button pattern also opens on ArrowDown (first item) and ArrowUp (last item).
- Fix: add an `onKeyDown` on each toggle that opens on ArrowDown and ArrowUp, reusing the existing open effect that focuses the checked item.
- Why: arrow-key users must discover Enter or Space; a small deviation in an otherwise complete menu keyboard model.
- Verified: yes (code)
- Systemic: no

### A11Y-12: Global single-key shortcuts cannot be turned off, and Space starts narration
- Rule: 4. Full keyboard support
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/engine/review-engine.js:3853`, `client/surfaces/review/engine/review-engine.js:3925`
- Evidence: `?`, `/`, `b`, `c`, `j`, `k`, `v` fire document-wide outside text fields with no off or remap switch, and Space on any non-control target calls `toggleReadAloud()` instead of scrolling the page.
- Fix: document-first at minimum (the palette already lists Space); ideally gate the single-key layer behind a user toggle or require a modifier-free focus scope, and leave Space to scroll when narration has never started.
- Why: speech-input users can trigger actions mid-dictation, and keyboard users lose the standard Space-to-scroll key to an audio startle.
- Verified: yes (code)
- Systemic: no

### A11Y-13: Moved-line jump chips and line-number blame targets are below the 24px floor
- Rule: 12. Hit areas and touch
- Severity: LOW
- Confidence: medium
- Locations: `src/diff-render.ts:61`, `src/diff-render.ts:109`, `client/surfaces/review/review.css:963`
- Evidence: `.ds-moved-tag` is a button at 10px type with no vertical padding (about 15px tall), and `.ds-no` blame targets are one code row tall (about 20px). Consecutive moved lines and every-line blame targets stack closer than the 24px spacing circle, so the spacing exception does not save them. Keyboard (focus ring, `b` key) and names are fine.
- Fix: add vertical padding to `.ds-moved-tag` toward a 24px height, and accept line numbers as-is or widen the gutter click target with an invisible `::after` extension that stops before neighboring rows.
- Why: touch and coarse-pointer users can mis-tap adjacent moved-line chips or blame the wrong line.
- Verified: no (sizes read from code; needs pointer-geometry measurement on device)
- Systemic: no

### A11Y-14: Two blurred surfaces keep backdrop-filter under reduced transparency
- Rule: 16. Other user preferences
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/review.css:1186`, `client/surfaces/review/review.css:1209`
- Evidence: the `prefers-reduced-transparency:reduce` block (`review.css:1348`) solidifies the top bar, drawer, toast, and dock, but `.ds-filmthread-tooltip` and `.ds-concept-diagram-tools button` keep `backdrop-filter:blur(...)`. Both sit over mostly opaque backgrounds, so impact is small.
- Fix: add the two selectors to the existing reduce block with `background:var(--panel3);backdrop-filter:none;-webkit-backdrop-filter:none`.
- Why: users who asked for reduced transparency still get blurred glass on the filmstrip tooltip and diagram tools.
- Verified: yes (code)
- Systemic: no

## Considered but rejected
| Location | Candidate | Rejected because |
|---|---|---|
| `client/surfaces/review/review.css:451` | `.ds-reviewpanel:focus-visible{outline:none}` hides focus | No competing unlayered shadow, so the global ring still draws. |
| `client/surfaces/review/review.css:227` | `.ds-rail-resizer:focus-visible{outline:none}` hides focus | The `::after` accent bar at `:226` is the visible indicator, and arrows resize. |
| `client/surfaces/review/review.css:784` | Active split/unified toggle loses its ring | It has its own real `outline` focus rule that also survives forced-colors. |
| `client/surfaces/review/review.css:1092` | Light-theme tabs lose their ring | Light tabs have their own inset focus rule; only dark is affected (A11Y-1). |
| `client/surfaces/review/StoryView.tsx:564` | Generate button disabled until valid | The persistent sub-label next to it states the reason ("N selected files", "Waiting for an available local writer"), and files default to checked. |
| `client/surfaces/review/review.css:739` area | 22px gap buttons fail target size | Single control per gap side, so the 24px spacing circle touches no other target; exempt. |
| `client/surfaces/review/StoryView.tsx:203` | Link inside `role="status"` freshness notice | Static content met in reading order; the label does not hide the Regenerate link. |
| `client/shared/quiet.ts` | Stripping vendored live regions hides announcements | Deliberate contract; each surface keeps exactly one owned announcer. |
| `client/surfaces/review/ReviewView.tsx:305` | Excluded-file preview has no loading announcer | Preview loads on explicit button press and focus context stays put. |
| `client/surfaces/change/ScopeCard.tsx:494` | Selected scope only visual on segment tiles | The summary group below states the selected scope as text. |
| `client/surfaces/review/ReviewApp.tsx:591` | Right-click selection menu is pointer-only | The `C` key opens the same composer from the keyboard. |
| `client/surfaces/review/ReviewApp.tsx:157` | Drift scrim is a clickable div | Keyboard users get Escape and the close button; the scrim needs no role. |
| `src/shell.ts:293` | Viewport meta blocks zoom | It is `width=device-width, initial-scale=1` with no cap; 200% zoom verified holding. |
| `client/surfaces/review/engine/review-engine.js:133` | Story auto-reload steals the page | 10 second window with a named Cancel button and a polite announcement. |

## Handoffs
- COL: measure the `--shadow-focus` ring against every background it crosses, including the active tab fill and code-row tints (A11Y-1 fix must keep contrast).
- LAY: fix the clipped theme control at small widths and capture the diff view at 320px (A11Y-8); confirm filmstrip node spacing if roving tabindex lands (A11Y-5).
- MOT: reduced-motion transition behavior was not dynamically exercised (runtime.md); confirm step transitions degrade to crossfade or nothing.
- COPY: the "Regenerate" link inside the freshness status relies on nearby text for context; confirm the wording carries its purpose.
- EXP: confirm toast persistence expectations for error versus success before A11Y-4 changes timings.
