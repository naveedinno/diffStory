# Color findings
Scope inspected: canonical tokens in src/theme.ts and client/generated/theme.css, client/styles.css, client/shared/shared.css, client/surfaces/review/review.css, all client surfaces (picker, stories, change, review, progress) for color literals and accent or status usage, theme switching in src/theme.ts and src/concept-page.ts, plus light and dark captures in screens/ (review, review-step, diff, change, picker, stories at desktop, tablet and mobile).
Not inspected: ProgressPanel run states, comment composer, concept diagram steps, narration-active state (none captured, see runtime.md); rule 14 across cultures (product is English-only with no locale catalogue, per brief.md).
Score: 2/4, strong canonical system but review-surface light ink fails AA.

## Findings

### COL-1: Small review-surface text uses the fill accent as ink and fails AA in light theme
- Rule: 9. Measure the rendered pair (also 5. A token only in its role)
- Severity: HIGH (Trigger: body or control text whose rendered contrast pair fails its required ratio)
- Confidence: high
- Locations: `client/surfaces/review/review.css:497`, `client/surfaces/review/review.css:804`, `client/surfaces/review/review.css:329`, `client/surfaces/review/review.css:372`, `client/surfaces/review/review.css:507`, `client/surfaces/review/review.css:845`, `client/surfaces/review/review.css:961`, `client/surfaces/review/review.css:1102`
- Evidence: `--accent-blue:var(--accent)` at review.css:63, used as small text color in eight rules while the light fill `#0072d6` reads below 4.5:1 on its rendered backgrounds: `.ds-why-label` 10.5px at 4.36:1 on the accent 7% why-block tint over white, `.ds-diffhead-label.ds-blue` 10.5px at 4.23:1 on `--gutter-hi` (`--surface-2`), `.ds-evolution-copy button` 11px at 4.23:1 on `--panel2`, `.ds-storyscope-edit` at 4.23:1 on `--panel2`, `.ds-beat-index` 11px at 4.06:1 on the accent 12% tint over white, `.ds-annot-here-right` 9.5px at 4.31:1 on the accent 8% tint over white, `.ds-moved-tag` 10px at 3.94:1 on the accent 14% tint over white, `.ds-stepcard.is-active .ds-num` 12px at 4.13:1 on `--fill-2` over rail white. Dark theme passes at 8:1 and above, so this is light-only.
- Fix: use the ink token the palette already provides for exactly this job, for example `.ds-why-label{...color:var(--accent-text)...}` and the same `var(--accent-blue)` to `var(--accent-text)` swap for text color in the other seven rules. Remeasured `#005cae` clears AA on every one of these backgrounds (5.49 to 6.07:1), matching the existing `.ds-beatnav-current b` and `.ds-railbeat.is-active .ds-railbeat-text` pattern.
- Why: the codebase already documents that the fill is not an ink (src/theme.ts comment on the 4.20:1 reading) and fixed the same bug for tabs; these eight rules are the remaining instances of the fill borrowed out of role, and light-theme readers get small labels below the AA floor the repo tests enforce for token pairs.
- Verified: yes (WCAG ratios computed with a script from declared token values and parent backgrounds read in review.css; light-theme rendering confirmed in screens/review-desktop-light.png, screens/review-step-desktop-light.png and screens/diff-desktop-light.png)
- Systemic: yes

### COL-2: Dim step numerals fall below the 3:1 floor in both themes
- Rule: 9. Measure the rendered pair
- Severity: MEDIUM
- Confidence: high
- Locations: `client/surfaces/review/review.css:1102`, `client/surfaces/picker/RecentRepos.tsx:165`
- Evidence: `.ds-num{...color:var(--numeral-dim)}` renders 12px rail numerals at 1.62:1 in light (`#c3ccd9` on rail `--surface` white) and 1.77:1 in dark (`#3a4250` on `#14171c`); unavailable-workspace numerals in RecentRepos render at 1.43:1 light and 1.71:1 dark. The team already judged this token unfit for wayfinding in `client/surfaces/change/ChangeApp.tsx:101` but the rail and unavailable-row numerals still use it.
- Fix: render rail numerals in `var(--text-3)` (5.57:1 light, 9.09:1 dark on the same backgrounds, still visibly dimmer than titles), or lift `--numeral-dim` until it clears 3:1 in both themes and remeasure.
- Why: numerals duplicate title order so they are redundant, but at 1.4 to 1.8:1 they are effectively invisible rather than quiet, and they miss even the large-text and graphics floor in both themes.
- Verified: yes (computed ratios from token values and rail background in review.css; unavailable rows were collapsed in screens/picker-tablet-dark.png so that instance is code-verified only)
- Systemic: no

### COL-3: Hard-coded amber ink duplicates the on-amber token
- Rule: 15. Audit before restructuring
- Severity: LOW
- Confidence: high
- Locations: `client/surfaces/review/review.css:500`
- Evidence: `.ds-step-health-mark{...background:var(--amber);color:#211700;...}` spells `#211700` where the canonical `--on-amber` (`#241600` dark, `#ffffff` light) exists for the same job.
- Fix: `.ds-step-health-mark{...color:var(--on-amber);...}`.
- Why: two values for one role drift apart; the literal also skips the light-theme `#ffffff` ink the token carries.
- Verified: yes (read in review.css; both values pass on amber at 9.5:1 or better, so this is consolidation, not contrast)
- Systemic: no

### COL-4: ProgressPanel carries a parallel hard-coded palette on the OS scheme switch
- Rule: 10. Dark mode is tuned, not mirrored (also 1. Match the project's color system)
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/progress/ProgressPanel.tsx:78`, `client/surfaces/progress/ProgressPanel.tsx:84`, `client/surfaces/progress/ProgressPanel.tsx:87`
- Evidence: `PALETTE` pins `--pp-bg:#14171c`, `--pp-elev:#1e232b`, `--pp-text:#eef1f5`, `--pp-muted:#98a2b3`, `--pp-blue:#3fb2ff`, `--pp-err:#ff6b62`, `--pp-ok:#3ddc97` as literals duplicating `--surface`, `--surface-3`, `--text`, `--del`, `--add`, and near-duplicating `--accent` (`#49b7ff`) and `--text-3` (`#b1b9c6`); the only adaptation is `[@media(prefers-color-scheme:light)]` overrides while the app switches on `data-theme`.
- Fix: keep the deliberate dark-always floor but alias the values onto canonical tokens, for example `[--pp-bg:var(--surface)] [--pp-elev:var(--surface-3)] [--pp-blue:var(--accent)]`, and drop the OS-scheme branch or key it off `data-theme` so one mechanism owns every surface.
- Why: the panel is intentionally a dark console in both themes, so nothing renders half-themed today, but the literals have already drifted (`#3fb2ff` vs `#49b7ff`) and the second switching mechanism will surprise the next editor.
- Verified: yes (read in ProgressPanel.tsx; panel states were not captured, so the dark-always rendering is code-verified only)
- Systemic: no

### COL-5: Increased-contrast variant widens borders only, text gaps unremeasured
- Rule: 11. An increased-contrast variant
- Severity: LOW
- Confidence: medium
- Locations: `client/surfaces/review/review.css:1349`, `client/surfaces/change/ChangeApp.tsx:179`
- Evidence: the `prefers-contrast:more` block retunes `--line` and a few containers, and Tailwind surfaces use `contrast-more:border-text` border swaps; no text tier widens its foreground or background gap by the required 15 points of perceived lightness, and nothing remeasures under the variant.
- Fix: under the variant, lift the dim text tiers toward `--text` (or deepen the surfaces behind them) until body and label pairs clear the preferred APCA thresholds, then assert one pair per tier the way test/theme.test.mjs asserts the default pairs.
- Why: base pairs already pass AA, so current impact is low, but the variant as shipped does not do what the rule requires and its benefit is unverified.
- Verified: yes (read the contrast blocks and utility usage; no contrast-variant capture exists to compare against)
- Systemic: no

## Considered but rejected
| Location | Candidate | Rejected because |
|---|---|---|
| `client/surfaces/change/ChangeApp.tsx:153`, `client/surfaces/picker/Hero.tsx`, review intro kicker | Static kickers set in accent ink | Deliberate brand voice, mono uppercase micro treatment reads as eyebrow rather than link in every capture, and DESIGN_MEMORY blesses signal-blue eyebrows. |
| All screens | Competing filled actions | Each captured view fills exactly one action (Review 3 files, Start the walkthrough, Add repository); nav and peer actions stay neutral. |
| `client/surfaces/review/review.css:63` | Second alias grammar (`--panel2`, `--dim`, `--accent-blue`) | Sanctioned one-directional aliasing onto canonical tokens per the file header and src/theme.ts; checked, no var cycles. |
| `src/concept-page.ts:38` | Parallel `--ds-*` token set | iframe isolation boundary, values mirror canonical tokens and sync via postMessage at concept-page.ts:50; justified duplication. |
| `src/brand.ts:63` | Favicon `prefers-color-scheme` and `#3fb2ff` | Brand mark, exempt. |
| `client/surfaces/review/review.css:438`, `:595`, `:856` | Gradients in default sRGB space | Interpolation space is a look, not a defect; no large low-contrast gradient bands in captures. |
| `src/theme.ts:188` | White on `#0072d6` fill, `#06121c` on `#49b7ff` | Measured 4.80:1 light and 8.55:1 dark; both pass. |
| `src/theme.ts:164`, `:201` | Syntax token set | All six tokens measured 5.72:1 or better in dark and 6.17:1 or better in light; repo tests cover tints too. |
| `client/surfaces/review/review.css:355`, `:357`, `:510` | `--accent-blue` fills and white-surface ink | Badge, marker fills and `.ds-depthchoice-meta` on white measure 4.80:1 or better; pass. |
| `client/surfaces/review/review.css:916` | `.ds-band-pair` minimap bands | Thin graphics at about 4.2:1 clear the 3:1 graphics floor. |
| `client/surfaces/review/review.css:1179` | Filmstrip numerals | Mixed `text-2` 72% with numeral-dim, legible in screens/review-step-desktop-light.png. |
| `src/server.ts:3701` | Hard-coded error-page colors | Out of scope (not review markup). |
| Gamut | P3 or oklch handling | No P3 or oklch values found by search; hex plus rgba plus color-mix in srgb throughout, so there is no fallback gap. |

## Handoffs
- VIS: folder-icon color uses `text-accent` at `client/surfaces/picker/RecentRepos.tsx:173` and `client/surfaces/picker/FolderBrowser.tsx:424`; icon-color contrast is the visual lens call.
- A11Y: COL-1 and COL-2 contrast failures, plus the COL-5 increased-contrast gap, for the conformance judgement on which requirement applies.
