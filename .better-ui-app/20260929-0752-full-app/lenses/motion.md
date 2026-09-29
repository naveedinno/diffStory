# Motion findings
Scope inspected: client/entry, client/shared, client/surfaces (picker, stories, change, review, progress), client/styles.css, review motion in client/surfaces/review/engine/review-engine.js, server motion strings in src/theme.ts and src/shell.ts, runtime.md plus the screens inventory (rest states only, no slowed replay).
Not inspected: slowed-replay feel (no 10 percent speed capture exists, runtime.md lists one real time webm, so all timing is judged from code), split divider and rail drag feel (not captured, code uses rAF batching per test/motion-regressions.test.mjs), rule 17 multimodal (no product sounds or haptics found in scope).
Score: 3/4, a strong tokened system with full reduced motion coverage and fixable deviations.

## Findings

### MOT-1: RefPicker exit uses an ease-in curve
- Rule: 2 Easing by job (also 4, exits mirror entrances)
- Severity: MEDIUM
- Frequency: occasional
- Confidence: high
- Locations: `client/surfaces/change/RefPicker.tsx:392`, `client/surfaces/change/RefPicker.tsx:391`, `client/surfaces/change/RefPicker.tsx:53`
- Evidence: exit `: { duration: 0.18, ease: [0.68, 0, 0.77, 0] }` against entrance `{ duration: 0.24, ease: EASE_SIGNAL_OUT }` where `EASE_SIGNAL_OUT = [0.23, 1, 0.32, 1]`. The exit curve starts flat, which is the ease-in shape rule 2 bans.
- Fix: mirror the entrance curve, for example `: { duration: 0.16, ease: EASE_SIGNAL_OUT }`.
- Why: ease-in starts slow at the exact moment the user is watching, so a short exit feels sluggish, and reversible transitions should mirror their easing.
- Verified: yes (code inspection; feel not verified, no slowed replay exists)
- Systemic: no

### MOT-2: Bouncy accordion springs on frequent disclosures
- Rule: 1 Purpose and frequency decide (also 7, bounce only after momentum)
- Severity: MEDIUM
- Frequency: frequent
- Confidence: high
- Locations: `client/surfaces/change/FileSummary.tsx:207`, `client/surfaces/picker/RecentRepos.tsx:345`
- Evidence: both sites render `<BouncyAccordion`, whose springs carry bounce 0.26 to 0.38 over about 0.5s. The brief classes accordion expand and collapse as frequent, where the budget is removal or at most a 100 to 150ms opacity or color change, and the product personality is calm and precise.
- Fix: use a non-overshooting disclosure at these two adoption sites, such as a native details element or a height tween on the drawer token like ScopeCard panelMotion. The vendored component itself is out of scope; the finding is the adoption choice.
- Why: bounce without flick momentum on a frequent control breaks the calm instrument feel, and one bouncy component in a crisp product is a finding on its own.
- Verified: yes (code inspection; feel not verified, no slowed replay exists)
- Systemic: yes

### MOT-3: Filmstrip dock magnifies with overshoot over 260ms
- Rule: 1 Purpose and frequency decide (also 7, default to no overshoot)
- Severity: MEDIUM
- Frequency: frequent (pointer proximity; also fires on keyboard focus through focus-visible)
- Confidence: high
- Locations: `client/surfaces/review/review.css:1179`
- Evidence: `.ds-filmnode-num{...transform:translateY(var(--ds-dock-lift)) scale(var(--ds-dock-scale));transform-origin:center bottom;will-change:transform;transition:transform 260ms cubic-bezier(.34,1.56,.64,1),color ...}`. The curve overshoots (1.56) and the duration is 260ms on hover and on every focus stop.
- Fix: shorten to the frequent budget with the house curve, for example `transition:transform 150ms var(--motion-ease-out),...`, and drop `will-change` or scope it to hover and focus only.
- Why: frequent motion gets at most a short flat change, overshoot is reserved for momentum after a flick, and keyboard traversal through the filmstrip replays this on every stop.
- Verified: yes (code inspection; feel not verified, no slowed replay exists; a reduced motion path exists, so no escalation)
- Systemic: no

### MOT-4: Read-aloud wave animates width
- Rule: 11 Performance
- Severity: MEDIUM
- Frequency: occasional
- Confidence: high
- Locations: `client/surfaces/review/review.css:1401`
- Evidence: `.ds-readaloud-wave{...transition:width var(--motion-duration-ui) var(--motion-ease-out),opacity ...,transform ...}` with `.ds-readaloud.is-active .ds-readaloud-wave{width:20px;...}`.
- Fix: keep the width change instant and animate only opacity and transform, or reveal with clip-path or scaleX instead of width.
- Why: width triggers layout on every frame; transform and opacity are the composited pair.
- Verified: yes (code inspection; jank not measured)
- Systemic: no

### MOT-5: Theme switch lets every color transition fire
- Rule: 14 Theme switches
- Severity: MEDIUM
- Frequency: occasional
- Confidence: medium
- Locations: `client/shared/theme-menu.tsx:136`, `client/vendor/beui/lib/use-theme.ts:54`, `src/theme.ts:77`
- Evidence: choosing a mode calls `setTheme(mode)`, and both apply paths (the repo-written use-theme.ts, not a vendored file, and the vanilla bootstrap in src/theme.ts) write data-theme with no transition suppression, while many elements carry color transitions (segment tiles, beUI Button transition-colors, ds-tab).
- Fix: suppress per-element transitions during the swap in both apply paths: inject `*,*::before,*::after{transition:none!important}`, change the theme, force a reflow, remove the override on the next frame.
- Why: flipping the theme recolors nearly every element at once, so each color transition fires together and the switch smears.
- Verified: no (needs a theme-flip capture; rest-state screenshots cannot show it)
- Systemic: yes

### MOT-6: Resume pill hover animates max-width over 200ms
- Rule: 1 Purpose and frequency decide (also 11, no layout properties)
- Severity: MEDIUM
- Frequency: frequent
- Confidence: high
- Locations: `client/surfaces/stories/StoryRow.tsx:239`, `client/surfaces/stories/StoryRow.tsx:226`
- Evidence: detail span uses `transition-[max-width,opacity,transform] duration-[var(--motion-duration-ui)]` with `group-hover:max-w-[150px]`, and the pill lifts `-translate-y-px` over the same 200ms. Story row hover and selection are frequent per the brief.
- Fix: reveal the detail with opacity and transform only at a fixed width (fade, clip, or slide), and shorten the hover motion to 150ms or less.
- Why: max-width animates layout every frame, and frequent hover allows at most a 100 to 150ms opacity or color change.
- Verified: yes (code inspection; feel not verified, no slowed replay exists)
- Systemic: no

### MOT-7: NumberTicker rolls run 450 to 500ms
- Rule: 3 Duration budgets (also 16, perceived speed)
- Severity: LOW
- Frequency: occasional
- Confidence: medium
- Locations: `client/surfaces/progress/ProgressPanel.tsx:345`, `client/surfaces/picker/RecentRepos.tsx:352`
- Evidence: `<NumberTicker value={state.planDone} startOnView={false} duration={0.45} stagger={0} />` and `<NumberTicker value={missing.length} duration={0.5} startOnView={false} ... />`.
- Fix: set duration to 0.25 to 0.3 at both sites.
- Why: small interface motion stays under 300ms, and a shorter roll says the same thing faster.
- Verified: yes (code inspection; feel not verified, no slowed replay exists)
- Systemic: yes

### MOT-8: Unavailable-workspaces count rolls up on page load
- Rule: 9 Entrances, exits and stagger
- Severity: LOW
- Frequency: rare
- Confidence: high
- Locations: `client/surfaces/picker/RecentRepos.tsx:352`
- Evidence: the ticker arms immediately (`startOnView={false}`) and rolls from 0 to N on every page load. The house rejects exactly this twice: StoriesApp notes a ticker would count up from zero on every navigation (StoriesApp.tsx:158), and ChangeApp refuses mount-animating counters (ChangeApp.tsx:23).
- Fix: render a static count, or ActionSwapRollText as StoriesApp does for the same situation.
- Why: elements already in their default state do not animate on page load.
- Verified: yes (code inspection)
- Systemic: no

### MOT-9: Theme toggle press dips to 0.94
- Rule: 5 Press feedback
- Severity: LOW
- Frequency: occasional
- Confidence: high
- Locations: `src/theme.ts:45`, `client/shared/shared.css:313`
- Evidence: both copies carry `.ds-theme-toggle:active{transform:scale(.94)}`, below the house 0.95 to 0.98 band that every beUI pressScale call site honors.
- Fix: use scale(0.97) in both copies.
- Why: anything below 0.95 reads exaggerated, and the toggle should match the press band used everywhere else.
- Verified: yes (code inspection)
- Systemic: yes

### MOT-10: RefPicker animates with main-thread shorthands during load
- Rule: 11 Performance
- Severity: LOW
- Frequency: occasional
- Confidence: low
- Locations: `client/surfaces/change/RefPicker.tsx:358`
- Evidence: the shown and concealed states animate Motion `y` and `scale` shorthands plus filter blur and clipPath while refs fetch and the list renders. ProgressPanel documents the alternative for the same situation: a full transform string because shorthands are not hardware accelerated (ProgressPanel.tsx:153).
- Fix: animate one transform string for the move, and keep either the clip-path or the blur, not both.
- Why: Motion x, y and scale shorthands run on the main thread and drop frames when the page is busy.
- Verified: no (needs frame measurement while the ref list loads)
- Systemic: no

### MOT-11: Icon swaps miss the specified cross-fade values
- Rule: 10 Contextual icon swaps
- Severity: LOW
- Frequency: occasional
- Confidence: high
- Locations: `client/surfaces/review/review.css:1401`, `client/surfaces/review/review.css:192`
- Evidence: the transport morph runs `ds-transport-morph 220ms cubic-bezier(.34,1.56,.64,1)` from `scale(.58) rotate(-18deg)` with no blur, and the copy action swaps from `scale(.45) rotate(-24deg)` with no blur. Rule 10 fixes scale 0.25 to 1, opacity 0 to 1, blur(4px) to 0, spring duration 0.3 bounce 0.
- Fix: cross-fade both swaps with the specified opacity, filter and scale values and drop the rotation and overshoot.
- Why: fixed icon-swap values keep every state change reading the same way across the product.
- Verified: yes (code inspection; feel not verified, no slowed replay exists)
- Systemic: yes

### MOT-12: Viewed check enters from scale 0.72
- Rule: 4 Origin and physicality
- Severity: LOW
- Frequency: frequent
- Confidence: medium
- Locations: `client/surfaces/review/review.css:1027`
- Evidence: `.ds-fileitem-viewed{...opacity:0;transform:scale(.72);transition:opacity var(--motion-duration-fast) ease,transform ...}`.
- Fix: start the entrance at scale(.95) with opacity, or use opacity alone.
- Why: entrances start at 0.95 to 0.97 scale combined with opacity, never from near nothing.
- Verified: yes (code inspection; feel not verified, no slowed replay exists)
- Systemic: no

### MOT-13: Signal easing curves are hand-typed in four places
- Rule: 15 Cohesion and tokens
- Severity: LOW
- Frequency: occasional
- Confidence: high
- Locations: `client/surfaces/change/RefPicker.tsx:53`, `client/surfaces/change/ScopeCard.tsx:121`, `client/surfaces/progress/ProgressPanel.tsx:163`, `client/surfaces/progress/ProgressPanel.tsx:170`, `client/surfaces/progress/Milestones.tsx:63`
- Evidence: `[0.23, 1, 0.32, 1]` appears three times, `[0.32, 0.72, 0, 1]` once, and `ease-[cubic-bezier(.23,1,.32,1)]` once, each restating the src/theme.ts tokens. Drift has already started: the vendored EASE_OUT is [0.16,1,0.3,1].
- Fix: add one shared module, for example client/shared/motion.ts, exporting the Signal curves for Motion props and Tailwind arbitrary values, mirroring src/theme.ts.
- Why: hand-typed curves that almost match are one consolidation finding, and tokens are what keep easing coherent.
- Verified: yes (code inspection)
- Systemic: yes

### MOT-14: Removed story row vanishes with no exit (additive)
- Rule: 18 Missed opportunities
- Severity: LOW
- Frequency: occasional
- Confidence: medium
- Locations: `client/surfaces/stories/StoriesApp.tsx:75`
- Evidence: `setStories((rows) => rows.filter((row) => row.id !== story.id))` drops the row instantly, so siblings jump with no transition.
- Fix: this is additive, so optional. Wrap the list in AnimatePresence with `initial={false}` and give removed rows an exit of opacity plus a small fixed move, or add a layout animation so siblings glide.
- Why: content teleports where a brief transition would prevent a jarring change.
- Verified: no (needs a delete interaction capture)
- Systemic: no

## Considered but rejected

| Location | Candidate | Rejected because |
|---|---|---|
| `client/shared/use-modal.ts:38`, `client/shared/shared.css:177` | 210ms close timer against a 340ms sheet transition | The eased exit is front-loaded and near settled by 210ms, and the 200ms scrim completes, so the cut is imperceptible. |
| `client/shared/shared.css:315`, `client/surfaces/review/review.css:1302` | Keyframe entrances on theme, editor, story-tune and filefilter menus | Entrance-only animation with no exit to retarget, backwards fill, and a documented house pattern. |
| `client/surfaces/progress/ProgressPanel.tsx:230`, `client/surfaces/stories/StoriesApp.tsx:161` | ActionSwapText width morph | Vendor-owned and excluded; the morph is the component purpose, and a reduced path exists. |
| `client/surfaces/stories/StoryRow.tsx:154`, `client/surfaces/change/FileSummary.tsx:103` | AnimatedBadge layout spring under reduced motion | Vendor-owned transition prop that usage sites cannot change. |
| `client/shared/shared.css:73` | 11s thread pulse loop | Documented deliberate brand decision pinned verbatim by motion tests, and removed under reduced motion. |
| `client/surfaces/change/ScopeCard.tsx:460` | Height animation on disclosure panels | Rule 6 endorses animated expand and collapse, the drawer ease fits, and the reduced path is instant. |
| `client/surfaces/change/RefPicker.tsx:358` | Missing transform-origin on the listbox | Scale delta is 1.5 percent so the origin is imperceptible, and the clip-path gives the directional reveal. |
| `client/surfaces/picker/PickerApp.tsx:50` | StatusToast appears instantly | Instant appearance is calm and compliant; no rule requires toast animation. |
| `client/surfaces/review/review.css:231` | ds-tab 160ms color transition | Color-only and 10ms over the frequent color budget, within tolerance. |
| `client/surfaces/progress/Milestones.tsx:63` | 500ms segment fill | Progress indication with static labels, no table row covers fills, and reduced-gated. |
| `client/surfaces/review/review.css:1291` | Chrome plus layout dual entrance | One orchestration 35ms apart, compliant with rule 9. |
| `client/surfaces/review/engine/review-engine.js:629` | Workspace view transitions | Interruptible through skipTransition, instant under reduced motion, and covered by regression tests. |
| `client/surfaces/review/engine/review-engine.js:612` | Film magnification gating | Disabled under reduced motion and on coarse pointers, compliant with rules 12 and 13. |
| `client/surfaces/review/engine/review-engine.js:3166` | Command palette opens instantly | Constant class correctly has no animation. |
| `client/surfaces/stories/StoryRow.tsx:259` and similar | Hover nudges and lifts | Behind hover:hover and pointer:fine with reduced overrides, compliant with rule 13. |
| Whole scope | transition:all, ease-in keyword, scale(0) | Swept; none found in scope. |
| `client/surfaces/review/review.css:183` | dsPulse keyframes | Defined but with no usage found; dead code with no user impact. |
| Buttons, segments, nav actions | Press scales 0.96 to 0.98 | All within the 0.95 to 0.98 band. |

## Handoffs

- A11Y: infinite loops exist (thread pulse at `client/shared/shared.css:75`, text shimmer at `client/surfaces/progress/ActivityText.tsx:75` and `client/surfaces/picker/SkillBanner.tsx:124`, segment breathe at `client/surfaces/progress/Milestones.tsx:68`, live-dot and plan pulses). All have reduced motion paths and none moves content, but autoplay and timed-content policy is the A11Y call.
