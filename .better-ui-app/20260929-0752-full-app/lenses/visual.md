# Visual findings
Scope inspected: full app UI in dark and light at desktop, tablet, and mobile. Viewed 25 stills at full size: picker (desktop dark/light, tablet dark, mobile dark), folder-browser modal, stories (desktop dark/light, tablet dark, mobile dark), change scope (desktop dark/light, tablet dark, mobile dark), review overview (desktop dark/light, tablet dark, mobile dark), review step 1 (desktop dark/light, mobile dark), raw diff (desktop dark/light, mobile dark), and the skip-link focus still. Squint-checked focal hierarchy on each screen and compared shared components (primary buttons, icon buttons, delete affordances, kickers, numerals, pills, tooltips, scrims) across screens. Code sweeps covered radius, shadow, backdrop-filter, icon stroke/size/set, RTL, image outlines, and reduced-transparency handling across client/ and src/ (excluding client/vendor/beui internals and dist/).
Not inspected: hover states (no hover captures exist); ProgressPanel run states, comment composer and queue, RefPicker open state, RemoveStoryDialog, theme and editor menus open, narration-active state, concept-diagram and concept-document steps, and empty, error, and loading states (none captured, see runtime.md Not captured); slowed-down motion timing (MOT owns it).
Score: 3/4, polished token-driven system with one visible primary-button drift and minor polish gaps.

## Findings

### VIS-1: Primary CTA has two shapes, the review intro is a rect while every other primary is a pill
- Rule: 13. Components stay consistent
- Severity: MEDIUM
- Confidence: high
- Locations: `client/surfaces/review/review.css:323`, `client/surfaces/review/review.css:147`, `client/surfaces/change/FileSummary.tsx:193`, `client/surfaces/picker/PickerApp.tsx:221`, `client/surfaces/stories/StoriesApp.tsx:138`
- Evidence: screens/review-desktop-dark.png (Start the walkthrough renders as a 12px rounded rect) against screens/change-desktop-dark.png (Review 3 files), screens/picker-desktop-dark.png (Add repository), screens/stories-desktop-dark.png (Start review), which all render as full pills. Code: `.ds-intro-start{...padding:14px 22px;border-radius:12px;...}` at review.css:323, while the review surface's own button base is `.ds-btn{...border-radius:var(--radius-pill);...}` at review.css:147 and the other primaries use `rounded-full bg-accent ... text-on-accent` (FileSummary.tsx:193, PickerApp.tsx:221, StoriesApp.tsx:138). Even the skip link reveals as a pill (screens/review-focus-skiplink.png), so the intro CTA is the lone rect.
- Fix: give the intro CTA the shared pill radius in the project's own token, keeping its hero padding and stacked sub-line: in `client/surfaces/review/review.css:323` change `border-radius:12px` to `border-radius:var(--radius-pill)`. If the rect is deliberate for the two-line hero variant, record it as an intentional exception so later screens do not copy it by accident.
- Why: the same component (solid accent primary with a trailing arrow, the focal action of its screen) must share one shape. The odd one out reads as a different component tier and breaks the otherwise consistent pill idiom.
- Verified: yes (stills plus code quotes above)
- Systemic: yes

### VIS-2: Delete affordance is a full-height island on the picker and a ghost circle on stories
- Rule: 13. Components stay consistent
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/picker/RecentRepos.tsx:247`, `client/surfaces/stories/StoryRow.tsx:294`
- Evidence: screens/picker-desktop-dark.png shows each repo row with a full-row-height `bg-surface-2` island holding the trash icon (`rounded-[var(--radius-island)] border border-transparent bg-surface-2`, RecentRepos.tsx:247). screens/stories-desktop-dark.png shows a 34px transparent ghost circle overlaid in the card corner (`rounded-full border border-transparent bg-transparent`, StoryRow.tsx:294). Both use the same `Trash2` glyph at 15px and 1.9 stroke with the same `hover:bg-del-soft hover:text-danger-text` treatment, so the glyph matches but the button weight, shape, and placement differ. The sidecar geometry on the picker is forced (the row itself is a button, so delete must live outside it, and the compact overlay geometry is test-locked), but the opaque island fill is unforced and gives a rarely used destructive action the same tonal weight as the row.
- Fix: keep the picker sidecar geometry untouched and converge tonally on the ghost treatment: in `client/surfaces/picker/RecentRepos.tsx:247` change `bg-surface-2` to `bg-transparent` so the resting state matches the stories delete (the existing `hover:bg-del-soft` already matches).
- Why: one action, one visual weight. The drift also spends emphasis against the brief's own avoid list (equal emphasis on every control) by granting delete island status on one surface and ghost status on another.
- Verified: yes (stills plus code quotes above)
- Systemic: no

### VIS-3: Reduced-transparency fallback covers chrome that never blurs and misses the two surfaces that do
- Rule: 10. Materials and depth
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/review.css:1186`, `client/surfaces/review/review.css:1209`, `client/surfaces/review/review.css:1215`, `client/surfaces/review/review.css:1348`
- Evidence: an exhaustive sweep finds exactly three `backdrop-filter` users in scope: `.ds-filmthread-tooltip` (`backdrop-filter:blur(14px) saturate(125%)`, review.css:1186), `.ds-concept-diagram-tools button` (`backdrop-filter:blur(12px)`, review.css:1209), and `.ds-concept-diagram-gesture` (`backdrop-filter:blur(12px)`, review.css:1215). The `@media (prefers-reduced-transparency:reduce)` block at review.css:1348 lists `.ds-top,.ds-drawer,.ds-toast,.ds-dock,.ds-filmthread.is-storyless`, none of which use `backdrop-filter`, so the fallback is vestigial where it applies and absent where blur actually renders. No other surface uses backdrop-filter (modal scrims are opaque dimming layers, which is correct), and no translucent surface stacks on another.
- Fix: extend the existing reduced-transparency block in the project's own idiom: add `.ds-filmthread-tooltip, .ds-concept-diagram-tools button, .ds-concept-diagram-gesture` to the review.css:1348 selector list so they fall back to an opaque `var(--panel3)` or `var(--material)` background with `backdrop-filter:none`, matching the pattern already written there.
- Why: users who ask for reduced transparency still get blurred floating surfaces, while the fallback guards elements that never blur. Small surfaces, small harm, but the fix is one selector list.
- Verified: yes (exhaustive backdrop-filter sweep compared against the fallback selector list in the same file; these states are not in the captures, so the on-screen effect under emulation is unconfirmed)
- Systemic: no

### VIS-4: Concept-diagram tool focus uses a 2px outline instead of the shared 3px soft ring
- Rule: 13. Components stay consistent
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/review.css:1209`, `client/surfaces/review/review.css:106`, `client/shared/shared.css:229`
- Evidence: `.ds-concept-diagram-tools button:focus-visible{outline:2px solid var(--accent-blue);outline-offset:2px}` (review.css:1209) against the shared idiom used everywhere else: `:focus-visible{outline:none;box-shadow:var(--shadow-focus)}` (review.css:106, review.css:121, and equivalents throughout review.css) and `box-shadow: 0 0 0 3px var(--accent-soft)` (client/shared/shared.css:229-233). The brief locks the 3px accent-soft box-shadow ring with no outline.
- Fix: in `client/surfaces/review/review.css:1209` replace the focus-visible declaration with `outline:none;box-shadow:var(--shadow-focus)` to match the shared state treatment.
- Why: one set of state treatments. A differently shaped focus ring on one toolbar reads as a different interaction model, even though it remains visible.
- Verified: no (concept-diagram steps are not in the captures; needs that step rendered with keyboard focus on a diagram tool to confirm on screen)
- Systemic: no

## Considered but rejected
| Location | Candidate | Rejected because |
|---|---|---|
| FileSummary.tsx:193, StoryRow.tsx:224, review.css:323 | Trailing-arrow buttons use symmetric padding instead of 2px less on the icon side (rule 3) | No visible imbalance in any capture at full size; the play triangle already carries its 2px optical offset (review.css:1393 `margin-left:2px`), and `.ds-back` already tightens its icon side (review.css:118, 8px vs 11px). The system shows optical care, not neglect. |
| RecentRepos.tsx:176, FolderBrowser.tsx:425 | Folder icons at 1.7 stroke beside semibold titles where rule 6 suggests 2px | The folders read as secondary markers inside tinted chips, not as text-weight companions, and look balanced in the picker and modal stills. |
| PickerApp.tsx:223, RecentRepos.tsx:114, StoryRow.tsx:234 | Icon render sizes off the 16/20/24 grid (13, 14, 15px) (rule 8) | Lucide is a 24-grid library so every size scales; the smallest glyphs are simple shapes and render crisply in the captures (branch meta, chevrons, plus). One library, one convention, no mush. |
| RefPicker.tsx:399, ProgressPanel.tsx:96, StoryRow.tsx:228, review.css:745 | Overlay shadows are bespoke per component rather than scale steps (rule 4) | Every overlay pairs an appropriate shadow with its surface, and islands stay flat with borders reserved for structure and state, per the brief. No single copied shadow, no depth faked with borders. |
| RecentRepos.tsx:221, FileSummary.tsx:198 | Directional icons without an RTL flip (rule 9) | The app never sets `dir="rtl"` (English-only, no locale catalogue per the brief), so flip rules would be dead code. |
| All screens | Tracked uppercase mono kicker above headings (rule 12) | Explicitly required by the brief and brand direction (mono kickers, tracking kicker). Exempt. |
| Review, change, stories CTAs | Arrow appended to buttons (rule 12) | Arrows appear only on forward-navigation actions (Start, Review, All files), not on every button, and read as directional affordance rather than decoration. |
| Picker rows 01-06, story rows 01-04 | Zero-padded numerals on lists that are not sequences (rule 12) | The Thread-Ledger numeral system is the product's brand identity per the brief, not a template default. Exempt. |
| All screens | Content in identical rounded islands (rule 12 SaaS card kit) | Islands on a deeper page background are the brief's direction, executed with restraint and no gradient washes. Exempt. |
| Hero.tsx:15, brand.tsx:56 | ThreadBackdrop renders as a floating line fragment in the picker masthead (rule 11) | Intentional brand atmosphere (dim base plus travelling pulse), masked behind solid plates, hidden below 480px. Quiet in every still, never competes with the Add action or the list. |
| ScopeCard.tsx:103, ScopeCard.tsx:182, FolderBrowser.tsx:419 | Nested island and panel radii do not satisfy outer equals inner plus padding arithmetically (rule 2) | No pinching is visible in any still. RefPicker rows are exactly concentric (6 plus 6 equals 12), scope tiles are within a pixel (9 plus 4 against 12), and bands with wide margins read as separate surfaces. |
| screens/stories-desktop-dark.png | Eight identical accent Resume pills compete, no single focal point (rule 1) | Hierarchy holds: the solid Start review outranks the soft Resume pills, and squint order lands on the heading and primary first. |
| review.css:1156 | Persistent dock carries a large shadow though the direction says shadow only on overlays (rule 4) | The dock reads as a floating island over the code panel, which is what the islands direction asks chrome to do. |
| All picker, change, stories stills | Dotted page background texture (rule 11) | Quiet, uniform, and clearly subordinate. Flat surfaces with no gradients or glass, per the direction. |
| review.css:147-191 | Review surface keeps its own hand stylesheet instead of Tailwind (rule 13) | Forced by server-rendered diff markup, and it still shares the canonical tokens, pill radius, kickers, numerals, and focus ring. Drift is limited to VIS-1 and VIS-4. |

## Handoffs
- COL: picker repo rows and trash sidecars nearly dissolve into the page background in the light theme (screens/picker-desktop-light.png), while the same islands read clearly in dark. Cause looks like light-theme surface token values, which COL owns.
- LAY: a top-right control on the raw diff screen appears clipped at the viewport edge on mobile (screens/diff-mobile-dark.png, also noted in runtime.md).
- LAY: long code lines in the mobile story step clip horizontally with no wrap (screens/review-step-mobile-dark.png, also noted in runtime.md).
- A11Y: the active Story tab shows no distinct focus ring at tab stop 3 of the review keyboard pass (runtime.md keyboard observation), while the other eight stops show the blue ring.
