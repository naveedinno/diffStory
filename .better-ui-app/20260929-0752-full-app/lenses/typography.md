# Typography findings
Scope inspected: client/entry, client/shared, client/surfaces (picker, stories, change, review, progress), client/styles.css, client/generated/theme.css, src/theme.ts font and type tokens, src/shell.ts document lang, and run screenshots (desktop, tablet, mobile, 200 percent zoom, 320px) for picker, stories, change, review overview, review step, and diff.
Not inspected: ProgressPanel run states (not captured, noted in runtime.md, finding TYP-5 is code only), concept diagram steps (not captured), motion lens Frequency column (typography lens only).
Score: 3/4, sound fundamentals with two medium issues on mobile input size and scale drift.

## Findings

### TYP-1: text inputs under 16px trigger iOS zoom on mobile
- Rule: 15. Inputs at 16px on mobile
- Severity: MEDIUM
- Confidence: high
- Locations: `client/surfaces/picker/FolderBrowser.tsx:381`, `client/surfaces/change/ScopeCard.tsx:169`, `client/surfaces/change/ScopeCard.tsx:170`, `client/surfaces/review/review.css:243`, `client/surfaces/review/review.css:376`, `client/surfaces/review/review.css:387`, `client/surfaces/review/review.css:1288`
- Evidence: `"pl-[35px] text-[13px] leading-[34px] text-text"` (folder filter); `"h-7 pr-0 pl-[22px] font-mono text-[13.5px] font-semibold text-text"` (ref fields); `.ds-file-search input{...font-size:12px}`, `.ds-storyfile-search input{...font-size:12px}`, `.ds-field-note textarea{...font-size:12.5px}`, `.ds-queue-edit textarea{...font-size:12.5px}`. No `sm:` size-up or scale compensation at any site. Mobile screenshots confirm these inputs render (screens/picker-modal-desktop-dark.png shows the filter; review search is in every diff sidebar).
- Fix: per rule 15 the project picks one approach, do not choose silently. Either size up on mobile (`text-[13px] sm:text-[13px] text-base` ordered mobile first, that is `text-base sm:text-[13px]`), or keep `font-size: 16px` with a scale transform that preserves the designed size. Review.css inputs need the same treatment in plain CSS with a coarse-pointer or max-width media query.
- Why: iOS Safari zooms the whole page when a focused input is under 16px, which disorients reviewers on phones. The app ships mobile layouts, so this is a real flow, not an edge case.
- Verified: yes (code grep across all surfaces plus screenshots showing the inputs in place; actual iOS zoom behavior not exercised, no device in this run).
- Systemic: yes

### TYP-2: utility surfaces drift off the type scale
- Rule: 4. Fewer fonts, sizes and weights
- Severity: MEDIUM
- Confidence: high
- Locations: `client/generated/theme.css:182`, `client/surfaces/picker/Hero.tsx:25`, `client/surfaces/picker/PickerApp.tsx:206`, `client/surfaces/stories/EmptyHistory.tsx:21`, `client/surfaces/change/FileSummary.tsx:112`, `client/surfaces/picker/RecentRepos.tsx:180`, `client/surfaces/stories/StoryRow.tsx:151`, `client/surfaces/stories/StoryRow.tsx:171`, `client/surfaces/stories/StoriesApp.tsx:146`, `client/surfaces/progress/Milestones.tsx:49`
- Evidence: the scale defines `--text-xs: 10px; --text-sm: 11px; --text-md: 12.5px; --text-base: 13px; --text-lg: 16px; --text-xl: 20px; --text-2xl: 26px`. Usage adds one-off steps: `text-[24px]` (brand lockup), `max-[480px]:text-[21px]`, `text-[22px]`, `text-[19px]`, `text-[15px]`, `text-[15.5px]`, `text-[13.5px]` (used 8 times), `text-[11.5px]` (19 times), `text-[10.5px]` (8 times), `text-[8.5px]`. The change page alone renders 10.5, 11, 11.5, 12.5, 13, 13.5, 15, 26, and 28px steps with near duplicates side by side (11 with 11.5, 13 with 13.5).
- Fix: map each role back onto the scale in the project's Tailwind idiom, for example row titles to `text-base` (13px) or `text-lg` (16px), card descriptions to `text-md` (12.5px), empty-state headings to `text-xl` (20px). Where a half step is genuinely load bearing, add it to the scale in `src/theme.ts` and regenerate the bridge instead of inlining another arbitrary value.
- Why: rule 4 names more than 5 sizes on one screen, near-duplicate sizes, and one-off values outside the scale as the smell that the scale has stopped making decisions. The hierarchy still reads correctly in screenshots, so the cost today is consistency and maintenance, not legibility.
- Verified: yes (class audit plus screens/change-desktop-dark.png, screens/stories-desktop-dark.png, screens/picker-desktop-dark.png showing coherent but off-scale rendering).
- Systemic: yes

### TYP-3: truncated labels with no hover fallback
- Rule: 12. Truncate without losing content
- Severity: LOW
- Confidence: high
- Locations: `client/shared/nav.tsx:118`, `client/surfaces/change/RefPicker.tsx:429`, `client/surfaces/change/RefPicker.tsx:430`, `client/surfaces/picker/FolderBrowser.tsx:427`, `client/surfaces/picker/FolderBrowser.tsx:441`, `client/surfaces/picker/RecentRepos.tsx:180`
- Evidence: `"max-w-[42ch] truncate ... whitespace-nowrap"` on breadcrumb links and current page with no `title` or Tooltip (runtime.md notes mobile breadcrumbs collapse to initials, visible in screens/stories-mobile-dark.png); RefPicker rows `<span className="min-w-0 truncate font-mono text-[12.5px] ...">{row.label}</span>` and `{row.meta}` with no fallback; folder entry names and the current-path footer truncate with no fallback; repo row names truncate while only the path below them gets a Tooltip (`client/surfaces/picker/RecentRepos.tsx:196`). Passes that show the intended pattern: FileSummary rows carry `title={file.path}` (`client/surfaces/change/FileSummary.tsx:59`), ScopeCard values use Tooltip (`client/surfaces/change/ScopeCard.tsx:257`), StoryRow titles resolve by navigating to the review itself.
- Fix: wrap each site in the existing beUI Tooltip with the full string as content, following the ScopeCard `TOOLTIP_SURFACE` pattern. Breadcrumb current-page spans can use a plain `title` since they are not interactive.
- Why: ref names, folder names, and repo names distinguish between near identical siblings, so the hidden tail can be the deciding characters. Each case has a partial escape hatch (selection, navigation, wider viewport), which keeps this LOW rather than HIGH.
- Verified: yes (code audit; mobile truncation visible in screens/stories-mobile-dark.png and screens/change-mobile-dark.png).
- Systemic: no

### TYP-4: utility headings and descriptions lack balance and pretty wrapping
- Rule: 10. Wrap deliberately
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/change/ChangeApp.tsx:156`, `client/surfaces/change/ChangeApp.tsx:159`, `client/surfaces/stories/StoriesApp.tsx:125`, `client/surfaces/stories/StoriesApp.tsx:146`, `client/surfaces/picker/PickerApp.tsx:206`, `client/surfaces/stories/EmptyHistory.tsx:21`, `client/surfaces/stories/EmptyHistory.tsx:22`, `client/surfaces/change/FileSummary.tsx:112`, `client/surfaces/change/FileSummary.tsx:114`
- Evidence: page headings (`Choose what to review`, `Review history`, `Repositories`, `No saved reviews`, `Nothing to review`) and their one to two line descriptions use no `text-balance` or `text-pretty`. The only `text-pretty` in utility surfaces is the picker status line (`client/surfaces/picker/PickerApp.tsx:85`). The review stylesheet already does this correctly (`.ds-intro-title` uses `text-wrap:balance`, ledes use `text-wrap:pretty`), so the utility surfaces are inconsistent with the established pattern.
- Fix: add `text-balance` to the headings and `text-pretty` to the descriptions, for example `className="m-0 font-display text-[26px] font-bold tracking-[-.02em] text-balance"`.
- Why: two-line titles split unevenly and short descriptions strand single words on the last line at narrow widths. Current copy mostly fits one line, so the gain is small today and protective as copy changes.
- Verified: yes (code audit plus mobile screenshots showing single-line headings where the utilities would be no-ops for now).
- Systemic: no

### TYP-5: italic emphasis renders as synthesized faux italic
- Rule: 2. Load the faces the design uses
- Severity: LOW
- Confidence: medium
- Locations: `src/theme.ts:131`, `client/surfaces/review/review.css:534`, `client/surfaces/review/review.css:1012`
- Evidence: all eleven `@font-face` blocks declare `font-style:normal` only (Plex Sans 400 to 700, Plex Mono 400 to 700, Space Grotesk 500 to 700), while the review surface requests italics in story prose (`.ds-md em{font-style:italic}`) and code comments (`.ds-code .tk-c{...font-style:italic}`). Requested weights 550, 650, 750, 800, and 900 resolve to the nearest loaded static face by font matching and are not a finding.
- Fix: add Plex Sans italic 400/600 and Plex Mono italic 400 faces to `src/theme.ts` (self-hosted woff2 under assets/fonts, never Google Fonts per the CSP note in brief.md) and regenerate the theme bridge. If the brand prefers no italics, restyle `em` to semibold instead.
- Why: browsers fake missing italics by skewing the roman, which smears letterforms in story prose, the surface reviewers read most. Text stays readable, so this is polish, not breakage.
- Verified: no (code only; story markdown emphasis is not visible in the captured screenshots, and no render comparison of faux versus true italic was made).
- Systemic: no

### TYP-6: underlines lack descender and metrics tuning
- Rule: 14. Underlines from the font
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/change/ScopeCard.tsx:611`, `client/surfaces/review/review.css:965`, `client/surfaces/review/review.css:1013`, `client/surfaces/review/review.css:1266`, `client/surfaces/review/review.css:1267`
- Evidence: `className="font-semibold text-accent-text underline-offset-2 hover:underline"` and `.ds-intro-freshness a{...text-decoration:underline;text-underline-offset:3px}` plus three more plain underlines. No site sets `text-decoration-skip-ink`, `text-underline-position: from-font`, or `text-decoration-thickness: from-font`. No underline animates anything but color, so no separate-element rebuild is needed.
- Fix: in utilities add `decoration-from-font underline-offset-2` (Tailwind maps `decoration-from-font` to thickness) and in review.css add `text-decoration-skip-ink:auto;text-underline-position:from-font;text-decoration-thickness:from-font` to the underlined links.
- Why: untuned underlines sit on the browser default and can clip descenders in link text. Few links underline at all in this app, so impact is isolated.
- Verified: yes (code audit; the affected links are hover or secondary states not prominent in screenshots).
- Systemic: no

### TYP-7: milestone labels sit below the scale floor
- Rule: 16. Size floors
- Severity: LOW
- Confidence: low
- Locations: `client/surfaces/progress/Milestones.tsx:49`, `client/surfaces/progress/Milestones.tsx:50`
- Evidence: `"font-mono text-[8.5px] tracking-[0.05em] uppercase"` with `compact && "text-[9.5px]"`. The scale floor is `--text-xs: 10px`, and rule 16 rarely goes below 12px. The labels are meaningful (the file header calls the strip the run's only honest progress indicator) and stay in the accessibility tree, though state is also carried by segment fill and the panel live region. Review surface 9px kickers are label-style overlines and covered by the lens exemption, so they are not filed.
- Fix: raise to `text-xs` (10px) at the same tracking, and confirm the six-node rail still fits its panel at 320px before shipping.
- Why: 8.5px mono caps strain sighted readers and fall outside the project's own scale. Kept LOW because the panel was not captured in this run, so the rendered impact is unverified, and because segment position plus announcements carry the state redundantly.
- Verified: no (code only; ProgressPanel states were not captured per runtime.md).
- Systemic: no

### TYP-8: pixel sizing does not follow the user default font size
- Rule: 20. Respect the user's text size
- Severity: LOW
- Confidence: high
- Locations: `client/generated/theme.css:182`, `client/surfaces/review/review.css:83`
- Evidence: the type scale is fixed pixels (`--text-xs: 10px` through `--text-2xl: 26px`) and utility classes hardcode more pixels (`text-[13px]`, `text-[11.5px]`); review.css sets `font-size:14px` on body with pixel sizes throughout. A larger browser default font size leaves this text unchanged. Browser zoom scales everything and held up at 200 percent (screens/review-zoom200-dark.png) and 320px with zero overflow, so the gap is default-font-size users only.
- Fix: no action recommended in this review. A future pass could move the scale to rem rooted at the browser default. Filed so the limitation is on record, not as a request.
- Why: readers who set a larger default size get no benefit in this app. Impact is narrow because zoom works, and a rem migration touches every surface.
- Verified: yes (token audit plus zoom and 320px screenshots).
- Systemic: yes

## Considered but rejected
| Location | Candidate | Rejected because |
|---|---|---|
| `client/surfaces/picker/Hero.tsx:25` with `client/surfaces/picker/PickerApp.tsx:206` | h2 Repositories (26px) renders larger than h1 brand lockup (24px) | Different sections, not parent and child. The visual hierarchy is correct (page title dominates brand), and heading levels belong to A11Y. |
| `client/surfaces/review/review.css` (25 plus distinct px sizes) | Rule 4 scale smell on the review surface | Dense diff and code interface with a deliberate compact scale, which the lens exempts. Utility-surface drift is filed separately as TYP-2. |
| `client/surfaces/review/review.css:114,122,173,970,1001,1179,1408` (`line-height:1`) and `:1037` (`line-height:16px`) | Tight or fixed leading | Every `line-height:1` sits on an icon glyph, keycap, or single digit, and the 16px value is a single-line nowrap pill. No wrapping text uses tight leading. |
| `client/surfaces/review/review.css:1102,1266,1385` (`font-size:8px`) | Sub-floor micro text | All three size icon glyphs (readaloud icon, freshness marker), not reading text. |
| `client/surfaces/review/review.css:125` (`.ds-kicker` 9px) and similar 9 to 9.5px overlines | Sub-floor small text | Label-style overlines smaller than body, explicitly exempt. |
| `client/surfaces/review/review.css:1179` (filmstrip numerals, proportional) | Missing tabular figures | Static display numerals, explicitly exempt. All changing values checked (beat counts, rail counts, elapsed time, story stats, scope metrics, hunk pager) use tabular figures or mono. |
| `client/surfaces/review/StoryView.tsx` story prose measure | 820px intro wrap exceeds 75ch at 16px | No long-form text exists. The widest paragraphs are two-line ledes that read comfortably in screenshots. |
| `client/styles.css:44` plus `client/surfaces/review/review.css:83` | Duplicate font smoothing | Same root body element, same values, harmless. No per-component smoothing exists. |

## Handoffs
- A11Y: picker h1 is the brand lockup while the page title is an h2 at `client/surfaces/picker/Hero.tsx:25` and `client/surfaces/picker/PickerApp.tsx:206`; levels versus visual hierarchy is yours.
- COPY: RefPicker truncated rows at `client/surfaces/change/RefPicker.tsx:429` may also want shorter meta strings; words are yours.
