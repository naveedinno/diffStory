# 021 — Baseline: measure the current skill before changing it

> **For agentic workers:** This is an operations plan: it runs the eval and
> writes one summary file. It changes no product code and no skill text.
> Read `plans/README.md` → "Story quality campaign → Rules for every executor"
> before starting.

**Goal:** Record where the *current* storyteller skill stands on all six eval
cases, with rubric v2 and the lint, before plans 022–025 change the skill.
Without this baseline, the campaign cannot tell whether it helped.

**Spec:** `docs/research/story-corpus-audit-2026-09.md` (section 7).

## Preconditions (check, do not fix)

- Plans 014–020 are merged. `git log --oneline | head -20` shows their commits.
- The skill folder is unchanged since plan 018. Confirm with
  `git log --oneline -3 -- skills/diffstory-storyteller/SKILL.md`: the newest
  commit must be `9a88ea0` (the explicit-only trigger fix, 2026-09-25). The `scripts/` bundle
  from plan 017 is expected.
- **The user said go.** This plan starts about 12 billed `claude` runs
  (6 generations + 6 judgings) and takes 1–3 hours. If you were not explicitly
  told to run it, stop here and ask.

## Steps

- [ ] **Step 1: Build and install the exact skill being measured**

```bash
npm run build
sh scripts/install-skills.sh --claude
node --input-type=module -e "
import { skillDirDigest } from './dist/repo-setup.js';
console.log(skillDirDigest('skills/diffstory-storyteller') === skillDirDigest(process.env.HOME + '/.claude/skills/diffstory-storyteller') ? 'installed skill matches' : 'MISMATCH');"
```

Expected: `installed skill matches`.

- [ ] **Step 2: Run the baseline** (two lanes; the slow cases have their own timeouts)

```bash
node scripts/eval-stories.mjs all --label baseline-2026-09 --parallel 2 --timeout 90
```

If a case fails with "retries exhausted", that is infrastructure, not the
skill: re-run only that case with
`node scripts/eval-stories.mjs all --label baseline-2026-09 --case <id>`.
If a Solidity case is skipped because `~/Codes/blockchain/symmio/perps-core3`
is missing, note it and continue.

- [ ] **Step 3: Real-world corpus snapshot**

```bash
node scripts/story-corpus-report.mjs > /tmp/corpus-baseline.md
tail -12 /tmp/corpus-baseline.md
```

- [ ] **Step 4: Write `eval/BASELINE-2026-09.md`** (committed; results under
  `eval/results/` are git-ignored, so this file is the durable record)

It must contain exactly these sections, filled from the run:

```md
# Baseline — storyteller skill as of 9a88ea0, measured <date>

## Eval (rubric v2, judge sonnet, generator sonnet)

<the full table from eval/results/baseline-2026-09/report.md>

Overall mean: <n> across <k> cases.
Cases skipped or failed: <list with reason, or "none">.

## Lint profile per case

| case | lint errors | lint warnings | top 3 rules |
| --- | --- | --- | --- |
<one row per case, from judge.json → mechanical.lint>

## Real-world corpus (scripts/story-corpus-report.mjs, all of ~/Codes)

<the "N of M stories pass …" line and the "Totals by rule" list>

## Worst step per case (judge's words)

<one line per case: case id — worstStep>
```

- [ ] **Step 5: Commit**

```bash
git add eval/BASELINE-2026-09.md
git commit -m "docs: baseline story-quality measurement before the skill rewrite"
```

## Report back

Paste the overall mean, the per-case `landing` and `listenability` scores, the
lint-error count per case, and the corpus "N of M" line.
