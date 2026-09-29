# 004: Fix review-surface contrast pairs
- Findings: COL-1, COL-2, COL-3, COL-5
- Severity: HIGH
- Wave: 2 (review.css chain, runs after plan 003)
- Owned files: client/surfaces/review/review.css

## Problem
- COL-1: eight small-text rules use the fill `var(--accent-blue)` (`#0072d6` in light) as ink, rendering 3.94 to 4.36:1 in light theme: `.ds-why-label` (:497), `.ds-diffhead-label.ds-blue` (:804), `.ds-evolution-copy button` (:329), `.ds-storyscope-edit` (:372), `.ds-beat-index` (:507), `.ds-annot-here-right` (:845), `.ds-moved-tag` (:961), `.ds-stepcard.is-active .ds-num` (:1102). The ink token `var(--accent-text)` (`#005cae` light, `#62c2ff` dark) already exists for this job.
- COL-2 (CSS half): `.ds-num{...color:var(--numeral-dim)}` (:1102) renders 12px rail numerals at 1.62:1 light / 1.77:1 dark. (RecentRepos half is plan 020.)
- COL-3: `.ds-step-health-mark{...background:var(--amber);color:#211700;...}` (:500) hard-codes ink where `--on-amber` (`#241600` dark, `#ffffff` light) exists.
- COL-5 (CSS half): the `@media (prefers-contrast:more)` block (:1349) retunes `--line` and containers only; no text tier widens. (ChangeApp half is plan 018.)

## Target
- All eight COL-1 rules use `color:var(--accent-text)` for text (fills and non-text uses of `--accent-blue` untouched). Recomputed pairs clear 4.5:1 (report cites 5.49 to 6.07:1; re-verify by computing each pair and report the values).
- `.ds-num` uses `color:var(--text-3)` (5.57:1 light, 9.09:1 dark; re-verify and report).
- `.ds-step-health-mark` uses `color:var(--on-amber)`.
- Contrast block: inside `@media (prefers-contrast:more)`, extend the existing `:root{...}` override to lift dim tiers toward `--text` (set `--dim`, `--muted`, `--text-2` to `color-mix(in srgb, var(--text) 78%, transparent)` or nearer until body/label pairs clear preferred APCA; report the before/after values for one pair per tier). Keep hue, change lightness only.

## Repo conventions
- Canonical tokens in `src/theme.ts`; review.css aliases one-directional onto them (header comment). Ink pattern exemplar: `.ds-beatnav-current b` and `.ds-railbeat.is-active .ds-railbeat-text` already use `var(--accent-text)`.

## Steps
1. Swap `var(--accent-blue)` to `var(--accent-text)` for the `color` property in the eight listed rules only.
2. Change `.ds-num` color to `var(--text-3)`.
3. Change `.ds-step-health-mark` color to `var(--on-amber)`.
4. Extend the `:root` override inside the `prefers-contrast:more` block with the dim-tier lifts; compute and report one pair per tier.

## Boundaries
- Edit only the owned files.
- Add no dependencies. Change lightness, keep hue; do not change any brand color.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`, plus the contrast assertions in `node --test test/render-page.test.mjs` if runnable alone.
- Look: light-theme review, step, and diff screens; small labels legible, rail numerals quiet but visible.
- Done when: build passes; all eight swaps present; reported recomputed ratios all clear their thresholds.
