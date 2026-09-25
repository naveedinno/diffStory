# 025 — Measure the v2 skill against the baseline, then decide

> **For agentic workers:** This is an operations plan: it runs the eval, a
> blind A/B, and the corpus report, then writes one results file. It changes
> no product code and no skill text. Read `plans/README.md` → "Story quality
> campaign → Rules for every executor" before starting.

**Goal:** Find out whether plans 022–024 made stories better, using the same
cases, rubric, judge, and generator as the plan-021 baseline, and record a
decision the next iteration can act on.

**Spec:** `docs/research/story-corpus-audit-2026-09.md` (section 7, success criteria)
and `eval/GOAL.md` ("Rules the loop follows").

## Preconditions (check, do not fix)

- `eval/BASELINE-2026-09.md` exists (plan 021 ran).
- Plans 022, 023, 024 are merged, and plan 023's digest check printed
  `362c7f6b52b15920`.
- **The user said go.** About 24 billed `claude` runs: 6 generations, 6
  judgings, and 12 compare calls. Two to four hours. If you were not
  explicitly told to run it, stop and ask.

## Steps

- [ ] **Step 1: Install the skill being measured, everywhere**

```bash
npm run build
sh scripts/install-skills.sh --claude --codex
```

Then run plan 018 Task 4 Step 2. Expected: three `current` lines.

- [ ] **Step 2: Generate and judge**

```bash
node scripts/eval-stories.mjs all --label after-v2-2026-09 --parallel 2 --timeout 90
```

Re-run single cases that died of "retries exhausted" (infrastructure, not the skill).

- [ ] **Step 3: Blind A/B against the baseline**

```bash
node scripts/eval-stories.mjs compare --a baseline-2026-09 --b after-v2-2026-09
```

- [ ] **Step 4: Real-world corpus**

```bash
node scripts/story-corpus-report.mjs | tail -25
node scripts/story-corpus-report.mjs --since "$(git log -1 --format=%cs -- skills/diffstory-storyteller/SKILL.md)"
```

The second run shows only stories written since the v2 skill landed. It may
be empty right after merging; that is fine, and you should say so.

- [ ] **Step 5: Write `eval/AFTER-V2-2026-09.md`** with exactly these sections:

```md
# Storyteller v2 vs baseline — measured <date>

## Side by side (per case)

| case | mean (base → v2) | landing | listenability | rationale_depth | newcomer_coverage | lint E | lint W | uncovered | val errors | steps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
<one row per case; each cell "base → v2">

## Blind A/B (both orders; only agreeing votes count)

<the tally line and table from eval/results/compare-baseline-2026-09-vs-after-v2-2026-09/report.md>

## Against the campaign's success criteria

<for each of the four criteria in docs/research/story-corpus-audit-2026-09.md section 7:
 MET / NOT MET, with the number that decides it>

## Real-world corpus

<the "N of M" line now vs the baseline file's line; stories since v2, if any>

## Decision

<one of the three outcomes below, with the evidence line that decided it>
```

- [ ] **Step 6: Decide, using exactly one of these rules**

1. **Ship.** No mechanical regression (validation errors and uncovered do not
   rise in any case, lint errors do not rise in any case), **and** the A/B
   prefers v2 in at least 4 of 6 cases. Update `eval/HANDOVER.md` with a
   dated "Storyteller v2 (2026-09)" section summarizing the result and linking
   both files.
2. **Regression.** Any mechanical regression. Do not edit the skill here.
   Name the case, the failing gate, and the lint rule or contract error that
   rose, and add it under "## Follow-ups" in `plans/README.md` as a one-line
   item for the next planning pass.
3. **No clear win.** No regression, but fewer than 4 A/B wins. Record which
   dimensions moved and which did not. Per `eval/GOAL.md`, the next iteration
   changes ONE thing. Name the single most promising lever (for example
   "landing examples in references/examples.md") under "## Follow-ups".

- [ ] **Step 7: Commit**

```bash
git add eval/AFTER-V2-2026-09.md eval/HANDOVER.md plans/README.md
git commit -m "docs: storyteller v2 measured against the 2026-09 baseline"
```

(Stage only the files you actually changed.)

## Report back

The decision, the A/B tally, the per-case `landing` and `listenability` scores
(base → v2), and lint errors per case (base → v2).
