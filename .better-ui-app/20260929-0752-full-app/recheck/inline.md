# Recheck (inline, all lenses)

Lens subagents for the recheck never started (all 8 sat `deferred` in the
capacity queue, same stall as the fix waves), so the recheck ran inline:
every HIGH and MEDIUM fix re-opened in code, every LOW re-opened or
grep-pinned, changed lines scanned for regressions per lens rules, affected
screens recaptured (41/41, zero console errors).

## Corrections made during recheck (5)

1. A11Y-3 was ineffective on the review surface. The `forced-colors` rules in
   `styles.css`/`shared.css` are specificity 0-1-0; the review.css
   `outline:none` focus rules they must beat are unlayered 0-2-0 up to 0-4-0
   (`:root`-qualified tab rule), and review.css had no copy at all. Added the
   block at `review.css:1496-1500` with `!important`, scoped to
   forced-colors mode only. Verified by emulation (computed 2px solid
   outline on the focused Story tab, `screens/review-forced-colors.png`).
2. COL-1 class: 6 more small-text `accent-blue` uses failed AA in light and
   the lens had not cited them (intro `.ds-num` 4.13:1 on fill-2, intro
   active 4.19:1 on accent-soft, comment-pin 4.23:1 on material, plus
   depthchoice-meta in card-active state and two state-inconsistent
   siblings). Swapped all six to `accent-text` (5.75-6.68:1). Left:
   concept-eyebrow (~4.8 pass), `.ds-band-pair` (SVG fill, not text),
   `.ds-badge-concept` (dead rule, no markup).
3. VIS-1 was ineffective: two later rules beat the fixed base rule, the
   opening-scene 12px override and a same-specificity 10px override that
   wins file-wide. Both now pill. Confirmed visually in recaptures.
4. LAY-3: `.ds-brand margin-left:-8px` was never in the sweep allowlist and
   is directional alignment. Now `margin-inline-start`. Other physical
   keeps audited and defensible (numeric align, side-anchored callouts and
   composer, gutter geometry, glyph optical offset, sticky offsets inside
   LTR-pinned code content).
5. VIS-2 never applied: plan 023 delegated it to plan 020, which never
   carried it (orphan by process, not by scan). Applied now
   (`RecentRepos.tsx:258`); picker recapture shows ghost deletes.

## Regression scan

- Orphan audit: every finding ID owns at least one plan mention except
  A11Y-14 (fixed inline without a plan; verified present) and the VIS-2
  delegation above (now fixed).
- Cascade audit on review.css HIGH/MEDIUM fixes: A11Y-1 rules (0-4-0 and
  0-2-0 `:focus-visible`) beat the two later resting `.ds-tab.is-active`
  rules; no later rule touches the other three selectors.
- A11Y-12 shortcut toggle, EXP-9 `replaceState`, MOT-14 exit, EXP-8 dialog
  idiom all present; `window.confirm` count is zero.
- No new findings opened by the fixes. Zero regressions.

## Runtime evidence

- `recheck/capture.mjs`: full matrix recaptured, 41/41 ok, no console
  errors. Keyboard pass confirms the A11Y-1 tab case live.
- `review-forced-colors.png`: forced-colors emulation with computed-style
  probe (review tab and picker CTA both compute 2px solid outlines).
- Checks: typecheck clean, build clean, 878 tests pass.
