# 028 — Measure v2.1 (full landings) against v2 and the baseline, then decide

> **For agentic workers:** This is an operations plan: it runs the eval, two
> blind A/B comparisons, and writes one results file. It changes no product
> code and no skill text, except the revert described under rule 3. Read
> `plans/README.md` → "Story quality campaign → Rules for every executor"
> before starting.

**Goal:** Find out whether plan 027's single lever (complete landings: file and
caller by name, no compression pressure on the landing beat) moved the
dimension it targets, without losing what v2 won (full coverage, zero lint
findings). Then keep it, ship it, or revert it by a fixed rule.

**Spec:** `eval/AFTER-V2-2026-09.md` (the v2 numbers this plan compares
against) and `eval/GOAL.md` ("change ONE thing per iteration").

## Preconditions (check, do not fix)

- Plan 027 is merged. The skill text digests to `bb48cab2c58d7e4a`
  (plan 023 Task 0 command), and all three installed copies are current
  (plan 018 Task 4 Step 2).
- `eval/results/baseline-2026-09/` and `eval/results/after-v2-2026-09/` both
  exist on this machine, each with six `story.json` files. The compares read them.
- **Same runner as before:** every eval command passes `--runner muse`
  (generator and judge `muse-spark-1.3-contributor`). If Muse is unavailable,
  stop and report. Never switch runners.
- **The user said go.** About 36 billed Muse runs: 6 generations, 6 judgings,
  and two compares of 12 each. Three to five hours. If you were not explicitly
  told to run it, stop and ask.

## Steps

- [ ] **Step 1: Generate and judge**

```bash
npm run build
node scripts/eval-stories.mjs all --runner muse --label after-v21-2026-09 --parallel 2 --timeout 90
```

Re-run a case that died of an infrastructure error (retries exhausted,
transport or stream error) once, with the same flags plus `--case <id>`.

- [ ] **Step 2: Blind A/B against v2 (isolates the lever)**

```bash
node scripts/eval-stories.mjs compare --runner muse --a after-v2-2026-09 --b after-v21-2026-09
```

- [ ] **Step 3: Blind A/B against the baseline (the campaign's bar)**

```bash
node scripts/eval-stories.mjs compare --runner muse --a baseline-2026-09 --b after-v21-2026-09
```

- [ ] **Step 4: Landing check from the stories themselves** (no billed runs).
  This prints, per case, the first beat of the first four code steps for v2
  and v2.1, so the results file can quote what actually changed:

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
for (const c of ['bugfix-review-ui','small-feature-walkthrough-stage','refactor-one-shot-notes','medium-feature-rail-numerals','sol-feature-wallet-withdraw','sol-fix-recovery-api']) {
  for (const l of ['after-v2-2026-09','after-v21-2026-09']) {
    const t = JSON.parse(readFileSync('eval/results/' + l + '/' + c + '/story.json', 'utf8'));
    const code = t.steps.filter((s) => s.kind !== 'concept');
    console.log('\n== ' + c + ' / ' + l);
    for (const s of code.slice(0, 4)) console.log('  - ' + strip(s.beats?.[0]?.text ?? '').slice(0, 200));
  }
}"
```

- [ ] **Step 5: Write `eval/AFTER-V21-2026-09.md`** with exactly these sections:

```md
# Storyteller v2.1 (full landings) — measured <date> (runner muse, muse-spark-1.3-contributor)

## Side by side (per case): baseline → v2 → v2.1

| case | mean | landing | listenability | newcomer_coverage | lint E | lint W | uncovered | steps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
<one row per case; each cell "base → v2 → v2.1"; baseline and v2 numbers come
 from eval/BASELINE-2026-09.md and eval/AFTER-V2-2026-09.md>

Means: overall <b → v2 → v2.1>; landing <3.17 → 3.17 → n>; listenability <… → 2.83 → n>.

## Blind A/B

v2.1 vs v2: <tally line and table from eval/results/compare-after-v2-2026-09-vs-after-v21-2026-09/report.md>
v2.1 vs baseline: <tally line and table from eval/results/compare-baseline-2026-09-vs-after-v21-2026-09/report.md>

## What the landings say now

<for two cases, one v2 first beat and the matching v2.1 first beat, verbatim from Step 4>

## Decision

<one of the rules below, and the numbers that decided it>
```

- [ ] **Step 6: Decide, using exactly one of these rules** (evaluate them in order)

1. **Ship v2.1.** No mechanical regression against v2 (in every case,
   uncovered, validation errors, and lint errors stay at 0), **and** judged
   `landing` mean ≥ 3.67 (v2: 3.17), **and** v2.1 vs baseline prefers v2.1 in
   ≥ 4 of 6 cases. Update `eval/HANDOVER.md` with a dated
   "Storyteller v2.1 (2026-09)" section linking this file.
2. **Keep v2.1, iterate.** No mechanical regression, and either the landing
   mean rose by ≥ 0.5 or v2.1 vs v2 prefers v2.1 in ≥ 4 of 6, but rule 1's
   baseline bar is missed. Keep the change. Under "## Follow-ups" in
   `plans/README.md`, name the next single lever. The candidate the v2
   judges already named is voice: "monotonous I-statements".
3. **Revert.** Any mechanical regression, or the landing mean did not rise
   and v2.1 vs v2 prefers v2 in ≥ 4 of 6. Revert plan 027's two commits with
   `git revert --no-edit <task-2 commit> <task-1 commit>` (newest first), run
   `npm test`, reinstall with `sh scripts/install-skills.sh --claude --codex`,
   and record the result under "## Follow-ups". Never use reset or checkout.
4. **Inconclusive.** Anything else (for example, the landing mean rose by less
   than 0.5 and the A/B split). Keep the change, since it is not worse, and
   record under "## Follow-ups" that the lever needs a larger case set to judge.

- [ ] **Step 7: Commit**

```bash
git add eval/AFTER-V21-2026-09.md plans/README.md
git commit -m "docs: storyteller v2.1 measured against v2 and the baseline"
```

(Also stage `eval/HANDOVER.md` if rule 1 applied. A revert under rule 3 makes
its own commits first.) In the same commit, mark 027 and 028 as DONE in the
`plans/README.md` table.

## Report back

The rule that applied and its evidence line, both A/B tallies, per-case
`landing` and `listenability` (v2 → v2.1), the uncovered and lint columns
(v2 → v2.1), and two before/after landing quotes.
