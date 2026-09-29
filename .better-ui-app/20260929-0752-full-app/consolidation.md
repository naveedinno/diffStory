# Consolidation (2026-09-29)
Run: .better-ui-app/20260929-0752-full-app. Raw findings: 84 (7 HIGH, 23 MEDIUM, 54 LOW).

## Merged (3)
- A11Y-8 (theme control clipped at mobile) merged into LAY-2. Same chrome-overflow root cause at 375px, confirmed in screens/diff-mobile-dark.png (the clipped circle is Reload, the theme toggle renders). LAY owns clipping at supported sizes other than 320px/200% zoom. The 320px diff-view gap moved to Verification as Not verified.
- VIS-3 (reduced-transparency fallback misses blurred surfaces) merged into A11Y-14. Same selector list at review.css:1348; A11Y owns transparency preferences. Combined fix covers all three backdrop-filter users (filmthread tooltip, diagram tools button, diagram gesture).
- COPY-16 (queued comment removal uses native OK dialog) merged into EXP-8. Same window.confirm at review-engine.js:3201; EXP owns destructive-action safety. COPY wording point kept in the Why cell.

## Dropped (1 finding + handoff adjudications)
- TYP-8 dropped: the lens declared it non-actionable ("no action recommended... not as a request"). A rem migration is out of review scope.
- VIS to COL handoff (light picker islands dissolve): dropped, unconfirmed. screens/picker-desktop-light.png shows legible rows, numerals, paths, and delete controls; no failing pair demonstrated and COL measured token pairs pass.
- TYP to A11Y handoff (h1 brand lockup, h2 page title): dropped under the A11Y rule 7 exemption. Heading-level convention with no demonstrated concrete navigation or comprehension impact; page title is the first heading in main content.
- TYP to COPY handoff (shorter RefPicker meta): dropped. No wording defect demonstrated; truncation mechanics covered by TYP-3.
- A11Y to COPY handoff (Regenerate link context): dropped. The link sits inside its describing freshness status, destination clear in context.
- MOT to A11Y handoff (infinite decorative loops): dropped. Thread pulse, shimmer, and breathe loops are decorative, reduced-motion gated, and carry no content; a pause control would be disproportionate.
- COL to VIS handoff (folder icon color): dropped as adjudicated. VIS rejected it (balanced in stills).
- LAY to TYP handoff (truncation mechanics): dropped as adjudicated inside TYP-3.
- A11Y to COL handoff (ring contrast): not a finding. Recorded as a verification note on the A11Y-1 fix.
- A11Y to MOT and EXP to MOT handoffs (reduced-motion transitions unexercised): recorded under Verification as Not verified. MOT confirmed reduced paths exist in code.
- A11Y to LAY and LAY to A11Y handoffs (320px diff capture, 200% CTA reachability): recorded under Verification as Not verified.
- EXP to A11Y handoff (focus ring): merged into A11Y-1. Dirty-confirm focus note kept for fix mode.

## Corrected during consolidation
- A11Y-7: the "no accessible name" half was wrong. review-engine.js:3692 sets aria-label on the blame popover. Kept as a focus-indicator finding (MEDIUM) with missing aria-modal folded into the fix.
- A11Y-1 fix: changed from a 2px outline to the project box-shadow ring idiom. An outline would contradict the brief and VIS-4.
- MOT-5 fix: re-scoped to in-scope files (theme-menu.tsx wrapper, src/theme.ts bootstrap). client/vendor/beui/lib/use-theme.ts is excluded vendor code.
- EXP-10 location corrected to FolderBrowser.tsx:136 (the setView call).

## Added from handoffs (2)
- A11Y-15 LOW: "Review N" visible label vs "Start review of N" accessible name at FileSummary.tsx:187. Confirmed in code.
- TYP-9 LOW: "Could not start." vs "Could not start" terminal period at run-progress.ts:44 vs state.ts:438. Confirmed in code.

## Severity review
- All 7 HIGHs confirmed, including triggers T2 (A11Y-1, A11Y-3), T6 (COL-1). A11Y-3 and the COL-1 ratios rest partly on unemulated runtime behavior and are labeled accordingly, but the mechanisms are code-verified and the triggers hold.
- COL-2 stays MEDIUM: numerals duplicate title order (redundant, not body/control text), so trigger T6 does not attach, and the COL lens severity for non-misleading theme/token failures applies.
- No motion HIGHs: no feel-breakers in the constant class and no reduced-motion ignorance found. MOT-3/MOT-6 frequent-class deviations stay MEDIUM per the frequency table.

## Final
82 findings: 7 HIGH, 22 MEDIUM, 53 LOW. Main table holds 7 HIGH + 22 MEDIUM (29, under the 30 cap). Appendix holds 53 LOWs. Scores: A11Y 2, LAY 2, TYP 3, COL 2, COPY 3, VIS 3, MOT 3, EXP 2. Overall 20/32. Verdict: Block.
