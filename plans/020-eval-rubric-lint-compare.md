# 020 — Measure what the audit found: lint in the eval, rubric v2, blind A/B, corpus report

> **For agentic workers:** Use superpowers:executing-plans (or
> superpowers:subagent-driven-development) to run this plan task by task.
> Steps use checkbox (`- [ ]`) syntax. Read `plans/README.md` → "Story quality
> campaign → Rules for every executor" before starting.

**Goal:** Make the eval able to see the failures the corpus audit found, so
plans 023–025 can be judged by numbers:

1. deterministic lint counts in every mechanical score;
2. five research-backed judge dimensions (landing, listenability, rationale depth,
   concreteness, newcomer coverage);
3. a `compare` command for blind A/B judging with swapped order (the method
   the July experiment used by hand);
4. a read-only corpus report over real stories in `~/Codes`.

**Architecture:** All in `scripts/eval-stories.mjs` plus one new script,
`scripts/story-corpus-report.mjs`. Both import the plan-016 lint from `dist/`.

**Tech stack:** Node ≥ 20 ESM scripts, `node --test`.

**Spec:** `docs/research/story-corpus-audit-2026-09.md` (sections 3, 5 "LLM-judge research", 7).

## Global constraints

- Depends on plans 016 (lint) and 019 (`caseRepo`, `gitIn`).
- `test/eval-cases.test.mjs` pins `function markdownResidue`,
  `markdownResidue: markdownResidue(tour)`, the `'md residue'` column, and the
  phrases "Zero Markdown residue" and "not comparable" in `eval/GOAL.md`. Keep
  all of them.
- Nothing in this plan spends agent runs. Do not run `generate`, `judge`,
  `all`, or `compare` here; plan 021 does, with the user's go-ahead.
- Verified in a scratch copy on 2026-09-25: `node --check` passes, the eval
  unit tests pass (11/11), and the corpus report ran over `~/Codes` (53
  stories; 18 pass basic validation, the contract, and lint errors).

## Review focus

- The judge prompt grows by five dimensions: the mean's denominator changes, so
  GOAL.md must say that runs before this plan are not comparable.
- `compare` must count a vote only when both orders agree ("split" otherwise).
- `caseLines` reads files from the case repo at `head` with `git show`; a file
  deleted at `head` returns null, and the import-highlight lint then skips it.

---

### Task 1: Lint counts in the mechanical score

**Files:**
- Modify: `scripts/eval-stories.mjs`
- Test: `test/eval-cases.test.mjs`

**Interfaces:**
- Produces: `export function summarizeLint(findings): { errors: number; warnings: number; byRule: Record<string, number> }`;
  `mechanical.lint` (that shape, or `null` when basic validation failed).

- [ ] **Step 1: Failing test** (append to `test/eval-cases.test.mjs`):

```js
test('summarizeLint counts errors, warnings, and rules', async () => {
  const { summarizeLint } = await import('../scripts/eval-stories.mjs');
  assert.deepEqual(
    summarizeLint([{ rule: 'a', severity: 'error' }, { rule: 'a', severity: 'warning' }, { rule: 'b', severity: 'warning' }]),
    { errors: 1, warnings: 2, byRule: { a: 2, b: 1 } },
  );
});
```

- [ ] **Step 2: Run** `npm run build && node --test test/eval-cases.test.mjs` — expected: FAIL.

- [ ] **Step 3: Implement.**

(a) Add the import after the `computeCoverage` import:

```js
import { lintStory, MARKDOWN_RESIDUE } from '../dist/story-lint.js';
```

(b) Delete the local `const MARKDOWN_RESIDUE = [ … ];` array (7 entries). Keep
its doc comment by moving it onto `function markdownResidue(tour)`. The
patterns now come from `src/story-lint.ts`, so the eval and the checker
cannot drift.

(c) Directly above the comment `// Mechanical scores are free and objective: the app's own gates.`, add:

```js
/** Post-change lines of a case file, read from the case repo at `head` (cached). */
function caseLines(c) {
  const cache = new Map();
  return (file) => {
    if (!cache.has(file)) {
      try {
        cache.set(file, gitIn(caseRepo(c), 'show', `${c.head}:${file}`).split('\n'));
      } catch {
        cache.set(file, null);
      }
    }
    return cache.get(file);
  };
}

/** Lint findings folded into counts: the eval tracks rules, not every place. */
export function summarizeLint(findings) {
  const byRule = {};
  for (const f of findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
  return {
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    byRule,
  };
}
```

(d) In `mechanicalScores`, directly after `markdownResidue: markdownResidue(tour),` add:

```js
    // Deterministic craft lints (src/story-lint.ts); skipped when the story
    // failed basic validation, like the generated profile above.
    lint: validationErrors.length ? null : summarizeLint(lintStory(tour, { readLines: caseLines(c) })),
```

(e) In `judge(c)`, directly above the comment
`// Loud, because it is invisible everywhere else: this story validates clean and`, add:

```js
  if (mechanical.lint) {
    const top = Object.entries(mechanical.lint.byRule).sort((x, y) => y[1] - x[1]).slice(0, 4);
    console.log(
      `  lint: ${mechanical.lint.errors} errors, ${mechanical.lint.warnings} warnings` +
      (top.length ? ` (${top.map(([rule, n]) => `${rule} x${n}`).join(', ')})` : ''),
    );
  }
```

(f) In `report(results)`: add `'lint E', 'lint W',` right after `'md residue',`
in `header`, and in each row, right after the `markdownResidue?.length ?? 0,`
entry, add:

```js
    r.mechanical.lint?.errors ?? '-',
    r.mechanical.lint?.warnings ?? '-',
```

In the per-case section template, add a line after `- worst step: …`:

```js
- lint: ${r.mechanical.lint ? `${r.mechanical.lint.errors} errors, ${r.mechanical.lint.warnings} warnings ${JSON.stringify(r.mechanical.lint.byRule)}` : 'skipped (story failed basic validation)'}
```

(It goes inside the existing template literal, before the `${RUBRIC.map(…)}` part, followed by `\n`.)

- [ ] **Step 4: Run** `npm run build && node --check scripts/eval-stories.mjs && node --test test/eval-cases.test.mjs` — expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/eval-stories.mjs test/eval-cases.test.mjs
git commit -m "feat: eval reports deterministic story lint counts"
```

### Task 2: Judge rubric v2

**Files:**
- Modify: `scripts/eval-stories.mjs` (`RUBRIC`), `eval/GOAL.md`
- Test: `test/eval-cases.test.mjs`

- [ ] **Step 1: Failing test** (append):

```js
test('judge rubric v2 scores landing, listenability, rationale, concreteness, newcomer coverage', () => {
  const harness = readFileSync(new URL('../scripts/eval-stories.mjs', import.meta.url), 'utf8');
  for (const key of ['landing', 'listenability', 'rationale_depth', 'concreteness', 'newcomer_coverage']) {
    assert.match(harness, new RegExp(`\\['${key}',`), `rubric is missing ${key}`);
  }
  assert.match(harness, /'compare'/, 'the blind pairwise compare command exists');
});
```

(The `'compare'` assertion stays red until Task 3.)

- [ ] **Step 2: Implement.** In `RUBRIC`, directly before the `['markup_judgment', …]` entry, insert:

```js
  // Added 2026-09 from the corpus audit and the research in
  // docs/research/story-corpus-audit-2026-09.md. Adding dimensions changes the
  // mean's denominator: re-baseline before comparing (eval/GOAL.md).
  ['landing', 'Read only the FIRST beat of every code step, aloud, with no code. 5 = each names the symbol on screen (function, rule, test) in <code>, who reaches it and when, then the change, and every new chapter opens by saying what the previous one settled; 3 = most land, some open on the change or on "Now/Here/It"; 1 = the listener is dropped into code with no orientation, or landings are boilerplate glued to every beat ("Look at lines 17 through 22").'],
  ['listenability', 'Heard, not read. 5 = one idea per beat, short sentences with the new information at the end, identifiers introduced once and reused, openings that vary; 3 = occasional overload or a repeated sentence frame; 1 = long nested sentences, stacked identifiers, or one template repeated across steps.'],
  ['rationale_depth', 'Reviewers most often ask "why this and not the obvious alternative?" and "is this needed?". 5 = at each non-obvious choice the story answers both where the choice is visible; 3 = the why appears only at story level; 1 = what-only narration.'],
  ['concreteness', '5 = every logic change carries one concrete trace (an input and what now happens to it, or old vs new behavior in words); 3 = some; 1 = abstractions only ("improves robustness").'],
  ['newcomer_coverage', 'A reviewer who knows the goal but not this codebase. 5 = every domain term, role, or state the code relies on is taught before it is needed (a primer, a context step, or one clause in a landing); 3 = one or two terms left unexplained; 1 = jargon throughout ("single close", "uncapped amount") with no help.'],
```

- [ ] **Step 3: Update `eval/GOAL.md`.** Under "## Exit criteria", add a sixth
  criterion, and under "### Baselines before 2026-07-29 are not comparable",
  add a paragraph:

```md
6. **Lint-clean.** Zero lint *errors* (`copied-beat`, `line-pointer`,
   `markdown-residue`, `mermaid-label`) in every case, from
   `src/story-lint.ts`. Warnings are reported, not gated.
```

```md
### Baselines before rubric v2 (2026-09) are not comparable either

Rubric v2 adds `landing`, `listenability`, `rationale_depth`, `concreteness`,
and `newcomer_coverage` (14 dimensions instead of 9), and in-repo worktrees now
detach at the case head. Re-baseline (plan 021) before comparing anything.
```

- [ ] **Step 4: Run** `node --test test/eval-cases.test.mjs` — expected: the
  rubric assertions pass, and the `'compare'` assertion still fails.

- [ ] **Step 5: Commit**

```bash
git add scripts/eval-stories.mjs eval/GOAL.md test/eval-cases.test.mjs
git commit -m "feat: judge rubric v2 scores landing, listenability, rationale, concreteness, newcomer coverage"
```

### Task 3: Blind pairwise `compare` command

**Files:** Modify `scripts/eval-stories.mjs`, `eval/README.md`

- [ ] **Step 1: Add the compare functions** directly above `function report(results) {`:

```js
/** Blind A/B prompt. Order is swapped on the second call to cancel position bias. */
function comparePrompt(c, first, second, diff) {
  const truncated = diff.length > 60000 ? `${diff.slice(0, 60000)}\n[diff truncated at 60000 chars]` : diff;
  return [
    'Two AI-written "diffStory" review stories explain the SAME code change. Pick the one that would help a reviewer who knows the goal but not this code understand the change and find its risks faster.',
    'Weigh: landing (each step says where we are and who calls it before what changed), rationale (why this and not the obvious alternative), concreteness, risk calibration (honest, specific doubts), listenability (it is read aloud), and truth to the diff.',
    'Do NOT prefer a story for being longer or more detailed; prefer the one a reviewer would rather follow. A story that invents behavior the diff does not show loses.',
    '',
    'Reply with STRICT JSON only, no markdown fences: {"winner":"A"|"B"|"tie","why":"one sentence","landing":"A|B|tie","rationale":"A|B|tie","listenability":"A|B|tie"}',
    '',
    `Change note: ${c.note}`,
    '',
    '--- STORY A ---',
    first,
    '',
    '--- STORY B ---',
    second,
    '',
    '--- THE ACTUAL DIFF ---',
    truncated,
  ].join('\n');
}

async function compareCase(c, labelA, labelB) {
  const read = (l) => {
    const file = join(root, 'eval', 'results', l, c.id, 'story.json');
    return existsSync(file) ? readFileSync(file, 'utf8') : null;
  };
  const a = read(labelA);
  const b = read(labelB);
  if (!a || !b) {
    console.log(`\n▶ compare ${c.id} — missing a story (${!a ? labelA : labelB}), skipping`);
    return null;
  }
  const dir = join(root, 'eval', 'results', `compare-${labelA}-vs-${labelB}`, c.id);
  mkdirSync(dir, { recursive: true });
  const diff = caseDiff(c);
  console.log(`\n▶ compare ${c.id}: ${labelA} vs ${labelB} (both orders, model ${judgeModel})`);
  const ask = async (first, second, log) =>
    parseJudgeOutput((await runClaude({
      cliArgs: ['-p', comparePrompt(c, first, second, diff), '--model', judgeModel],
      logPath: join(dir, log),
      activity: 'comparing',
    })).out);
  const forward = await ask(a, b, 'a-first.log');
  const backward = await ask(b, a, 'b-first.log');
  const vote = (r, aFirst) => (r.winner === 'tie' ? 'tie' : (r.winner === 'A') === aFirst ? labelA : labelB);
  const votes = [vote(forward, true), vote(backward, false)];
  const result = { case: c.id, votes, agreed: votes[0] === votes[1] ? votes[0] : 'split', why: [forward.why, backward.why] };
  writeFileSync(join(dir, 'compare.json'), JSON.stringify(result, null, 2));
  console.log(`  ✓ ${result.agreed === 'split' ? `split (${votes.join(' / ')})` : `prefers ${result.agreed}`}`);
  return result;
}

function compareReport(results, labelA, labelB) {
  const done = results.filter(Boolean);
  const count = (who) => done.filter((r) => r.agreed === who).length;
  const md = [
    `# Blind comparison — ${labelA} vs ${labelB}`,
    '',
    `Judge: ${judgeModel}. Each case is judged twice with the story order swapped; only agreeing votes count.`,
    '',
    `**${labelB}** preferred in ${count(labelB)}, **${labelA}** in ${count(labelA)}, tie in ${count('tie')}, split in ${count('split')} of ${done.length} cases.`,
    '',
    '| case | A-first vote | B-first vote | agreed |',
    '| --- | --- | --- | --- |',
    ...done.map((r) => `| ${r.case} | ${r.votes[0]} | ${r.votes[1]} | ${r.agreed} |`),
    '',
    ...done.map((r) => `## ${r.case}\n\n- A first: ${r.why[0]}\n- B first: ${r.why[1]}\n`),
  ].join('\n');
  const out = join(root, 'eval', 'results', `compare-${labelA}-vs-${labelB}`, 'report.md');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, md);
  console.log(`\n${labelB} preferred in ${count(labelB)} of ${done.length} cases. Report: ${out}`);
}
```

- [ ] **Step 2: Wire the command.** In the main block, change the command check to:

```js
  if (!['generate', 'judge', 'all', 'compare'].includes(command)) {
    console.error(`Unknown command "${command}". Use: generate | judge | all | compare`);
```

and directly before `if (command !== 'judge') checkInstalledSkill();` insert:

```js
  if (command === 'compare') {
    const labelA = flag('a');
    const labelB = flag('b');
    if (!labelA || !labelB) {
      console.error('compare needs --a <label> --b <label>: two existing result labels under eval/results/.');
      process.exit(1);
    }
    const results = [];
    for (const c of selected) results.push(await compareCase(c, labelA, labelB));
    compareReport(results, labelA, labelB);
    console.log(`\nDone in ${elapsed()}.`);
    process.exit(0);
  }
```

Also add a usage line to the header comment at the top of the file:
`//   node scripts/eval-stories.mjs compare --a baseline --b after   # blind A/B, both orders`.

- [ ] **Step 3: Run** `node --check scripts/eval-stories.mjs && node --test test/eval-cases.test.mjs` — expected: PASS (all).

- [ ] **Step 4: Document** in `eval/README.md` under "## Running":

```md
node scripts/eval-stories.mjs compare --a baseline --b after   # blind A/B per case
```

and one paragraph: "`compare` asks the judge which of two stories for the
same case helps a reviewer more. It asks twice, with the order swapped, and
counts a vote only when both orders agree, because LLM judges favor position
and length (Zheng et al. 2023). It spends two judge runs per case."

- [ ] **Step 5: Commit**

```bash
git add scripts/eval-stories.mjs eval/README.md
git commit -m "feat: blind pairwise story comparison with swapped order"
```

### Task 4: Corpus report over real stories

**Files:** Create `scripts/story-corpus-report.mjs`; modify `eval/README.md`

- [ ] **Step 1: Create `scripts/story-corpus-report.mjs`:**

```js
#!/usr/bin/env node
// Lints every diffStory story under the given roots (default ~/Codes) and
// prints a Markdown report: basic validity, generation-contract errors, and
// lint findings by rule. No coverage check: a story's diff has usually moved
// on since it was written. Read-only.
//
//   npm run build
//   node scripts/story-corpus-report.mjs [root ...] [--since YYYY-MM-DD]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { validateGeneratedTour, validateTour } from '../dist/tour.js';
import { lintStory } from '../dist/story-lint.js';

const args = process.argv.slice(2);
const sinceAt = args.indexOf('--since');
const since = sinceAt >= 0 ? Date.parse(args[sinceAt + 1]) : 0;
if (sinceAt >= 0 && Number.isNaN(since)) {
  console.error('--since needs a date like 2026-09-25');
  process.exit(2);
}
const roots = args.filter((a, i) => !a.startsWith('--') && i !== sinceAt + 1);
if (!roots.length) roots.push(join(homedir(), 'Codes'));

// Heavy or duplicate trees: dependencies, build output, eval/agent worktrees.
const SKIP = new Set(['node_modules', 'dist', 'build', 'target', 'out', 'worktrees', 'vendor', 'lib']);

function* storyFiles(dir, depth = 0) {
  if (depth > 7) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const path = join(dir, entry.name);
    if (entry.name === '.diffstory') {
      const single = join(path, 'story.json');
      if (existsSync(single)) yield single;
      const scoped = join(path, 'stories');
      if (existsSync(scoped)) {
        for (const name of readdirSync(scoped).sort()) if (name.endsWith('.json')) yield join(scoped, name);
      }
      continue;
    }
    if (entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
    yield* storyFiles(path, depth + 1);
  }
}

const rows = [];
const totals = {};
for (const root of roots) {
  for (const file of storyFiles(root)) {
    if (statSync(file).mtimeMs < since) continue;
    const repo = file.slice(0, file.indexOf('/.diffstory/'));
    const name = `${relative(root, repo) || '.'} :: ${file.slice(repo.length + 12)}`;
    let tour;
    try {
      tour = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      rows.push({ name, note: 'unreadable JSON' });
      continue;
    }
    for (const step of tour?.steps ?? []) if (step?.kind === 'deleted') step.kind = 'changed';
    const basic = validateTour(tour);
    if (basic.length) {
      rows.push({ name, version: tour?.version, steps: tour?.steps?.length ?? 0, basic: basic.length });
      continue;
    }
    const contract = validateGeneratedTour(tour).length;
    const readLines = (f) => {
      const p = join(repo, f);
      return existsSync(p) ? readFileSync(p, 'utf8').split('\n') : null;
    };
    const findings = lintStory(tour, { readLines });
    const byRule = {};
    for (const f of findings) {
      const key = `${f.severity === 'error' ? 'E' : 'W'} ${f.rule}`;
      byRule[key] = (byRule[key] ?? 0) + 1;
      totals[key] = (totals[key] ?? 0) + 1;
    }
    rows.push({
      name,
      version: tour.version,
      steps: tour.steps.length,
      basic: 0,
      contract,
      errors: findings.filter((f) => f.severity === 'error').length,
      warnings: findings.filter((f) => f.severity === 'warning').length,
      top: Object.entries(byRule).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} x${v}`).join(', '),
    });
  }
}

const cell = (v) => (v === undefined ? '-' : String(v).replace(/\|/g, '\\|'));
console.log(`# Story corpus report\n\n${rows.length} stories under ${roots.join(', ')}${since ? ` modified since ${args[sinceAt + 1]}` : ''}.\n`);
console.log('| story | v | steps | basic errors | contract errors | lint E | lint W | top findings |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) {
  console.log(`| ${cell(r.name)} | ${cell(r.version)} | ${cell(r.steps)} | ${cell(r.basic ?? r.note)} | ${cell(r.contract)} | ${cell(r.errors)} | ${cell(r.warnings)} | ${cell(r.top)} |`);
}
console.log('\n## Totals by rule\n');
for (const [rule, n] of Object.entries(totals).sort((a, b) => b[1] - a[1])) console.log(`- ${rule}: ${n}`);
const clean = rows.filter((r) => r.basic === 0 && r.contract === 0 && r.errors === 0).length;
console.log(`\n${clean} of ${rows.length} stories pass basic validation, the generation contract, and lint errors.`);
```

- [ ] **Step 2: Run it** (read-only):

```bash
npm run build
node scripts/story-corpus-report.mjs --since 2026-09-01 | head -20
node scripts/story-corpus-report.mjs | tail -3
```

Paste the last line of each run into your report. On 2026-09-25 the full run
said "18 of 53 stories pass …"; your number may differ if stories changed.

- [ ] **Step 3: Document** in `eval/README.md`: a short "## Real-world corpus"
  section: what it measures (validity, contract, lint; no coverage), how to
  run it, and that `--since <date>` shows only stories written after a skill
  change.

- [ ] **Step 4: Commit**

```bash
git add scripts/story-corpus-report.mjs eval/README.md
git commit -m "feat: corpus report lints every local diffStory story"
```
