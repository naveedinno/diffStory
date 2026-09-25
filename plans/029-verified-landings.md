# 029 — Verified landings: a `landing` field the checker proves and the app shows

> **For agentic workers:** Use superpowers:executing-plans (or
> superpowers:subagent-driven-development) to run this plan task by task.
> Steps use checkbox (`- [ ]`) syntax. Read `plans/README.md` → "Story quality
> campaign → Rules for every executor" before starting.

**Goal:** Make "where am I" structural instead of prose-only. Each code step
gets an optional `landing`:

- `symbol`: what is on screen;
- `calledBy`: who reaches it, by name, or `role` (who plus the gating
  check) for an external entry point;
- `when`: when it runs.

The checker verifies the callers against the repository. The app shows the
facts as one line under the step title: "`_capRate()` · RateMath.sol · called
by `settleFunding()` · once per market".

**Why:** Two prompt-only iterations (v2, v2.1) did not move judged landing:
the judge scored it 3 in 16 of 18 stories across three skill versions.
v2.1's file names arrived, but vague callers survived ("every review page,
route, and history card"). `eval/GOAL.md`'s stop rule says two iterations
that move nothing mean the gap is structural. Wording can ask an agent to
name a caller; only a check can make it go and find one. The judges who
preferred the baseline cited "verified callers".

**Architecture:**

1. Type and validator (`src/types.ts`, `src/tour.ts`).
2. `src/landing-verify.ts`, a read-only `git grep` co-occurrence check, wired
   into the bundled checker. Every caller must be a symbol, and some file must
   mention both it and the step's symbol. A role's gate must be written in the
   step's file.
3. A `landing-field-missing` lint warning. Agents fix warnings reliably, which
   is how the field gets adopted.
4. Server-rendered line under the step title (`view-model.ts`, `render.ts`,
   `review.css`); it is not narrated, because the first beat already speaks it.
5. Skill text and schema reference.

**Tech stack:** TypeScript, Node ≥ 20, git, `node --test`.

**Spec:** `eval/AFTER-V21-2026-09.md`, `plans/026-story-format-backlog.md`
(the "caller peek" idea), `docs/research/story-corpus-audit-2026-09.md`.

## Global constraints

- Precondition: the skill text digests to `bb48cab2c58d7e4a` (plan 023 Task 0
  command); `main` and `story-quality-campaign` are at or after `cc06082`.
- After Task 5 the skill digests to `8351620ffbeeb81b`, with `SKILL.md`
  hashing to `b4f13f2fd4e4` and `references/schema.md` to `b3fb8e801d56`.
- `landing` stays optional in the validator, so old stories keep loading. The
  checker only *warns* when it is missing, and *errors* only when a present
  landing is false.
- Verified in a scratch copy on 2026-09-25: a full build plus
  `node --test test/*.test.mjs` passed 830 of 831. The one failure was the
  scratch copy's missing `CONTRIBUTING.md`, not this code.
- Every "old" block must match exactly once; if not, stop and report.
- No billed eval runs in this plan.

## Review focus

- `git grep` exits 1 on no match. `filesMentioning` must treat that as
  "no files", not as an error.
- Fixed-head stories must be verified at `head` (a caller that only exists in
  the working tree must fail there). Working-tree stories must see untracked
  files (`--untracked`).
- The landing line is server HTML: every value goes through `esc()`.
- A deleted-file step (`range` `[0, 0]`) is skipped by verification and by the lint.

---

### Task 1: Type and validator

**Files:** `src/types.ts`, `src/tour.ts`, `test/tour.test.mjs`

- [ ] **Step 1: Failing tests.** Append to `test/tour.test.mjs`:

````js
test('landing is optional and validates symbol, callers, role, and when', () => {
  const tour = (landing) => ({
    version: 3,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w', landing }],
  });
  assert.deepEqual(validateTour(tour(undefined)), []);
  assert.deepEqual(validateTour(tour({ symbol: '_capRate()', calledBy: ['settleFunding()'], when: 'once per market' })), []);
  assert.deepEqual(validateTour(tour({ symbol: 'relayBatch()', role: { who: 'relayer', gate: 'onlyRole(RELAYER_ROLE)' } })), []);
  assert.ok(validateTour(tour('nope')).includes('steps[0].landing must be an object'));
  assert.ok(validateTour(tour({ calledBy: ['a()'] })).includes('steps[0].landing.symbol is required'));
  assert.ok(validateTour(tour({ symbol: 'f()' })).some((e) => e.startsWith('steps[0].landing needs calledBy')));
  assert.ok(validateTour(tour({ symbol: 'f()', calledBy: [] })).includes('steps[0].landing.calledBy must list 1 to 3 callers'));
  assert.ok(validateTour(tour({ symbol: 'f()', calledBy: ['a', 'b', 'c', 'd'] })).includes('steps[0].landing.calledBy must list 1 to 3 callers'));
  assert.ok(validateTour(tour({ symbol: 'f()', role: {} })).includes('steps[0].landing.role.who is required'));
  assert.ok(validateTour(tour({ symbol: '<b>f</b>', calledBy: ['a()'] })).some((e) => e.startsWith('steps[0].landing.symbol')));
});

test('concept steps cannot carry a landing', () => {
  const body = Array.from({ length: 70 }, (_, i) => `word${i}`).join(' ');
  const tour = {
    version: 3, title: 'T', summary: '',
    steps: [
      { id: 'c1', order: 1, title: 'Model', kind: 'concept', body: `<p>${body}</p>`, preparesFor: ['s1'], landing: { symbol: 'x', calledBy: ['y'] } },
      { id: 's1', order: 2, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' },
    ],
  };
  assert.ok(validateTour(tour).some((e) => e.includes('landing')));
});
````

- [ ] **Step 2: Run** `npm run build && node --test test/tour.test.mjs`. Expected: the two new tests FAIL.

- [ ] **Step 3: Implement.** Apply these five replacements.

In `src/types.ts`, replace:

````text
export interface CodeTourStepBase extends TourStepBase {
````

with:

````text
/**
 * Where a code step's camera lands, as facts the story checker verifies:
 * the symbol on screen, who reaches it by name (or, for an external entry
 * point, the role and the check that gates it), and when. Plain text.
 */
export interface StepLanding {
  /** The symbol on screen as a reviewer would search for it: "_capRate()", ".ds-main". */
  symbol: string;
  /** 1-3 functions, handlers, tests, or components that reach it, by name. */
  calledBy?: string[];
  /** For an external entry point with no calling function: who calls it, and the gate. */
  role?: { who: string; gate?: string };
  /** When it runs: "once per market, after the config is picked". */
  when?: string;
}

export interface CodeTourStepBase extends TourStepBase {
````

In `src/types.ts`, replace:

````text
  /** Step id to return to afterwards (the B -> A jump back). */
  returnsTo?: string;
}
````

with:

````text
  /** Step id to return to afterwards (the B -> A jump back). */
  returnsTo?: string;
  /** Verified "where am I" facts; rendered under the step title. */
  landing?: StepLanding;
}
````

In `src/tour.ts`, replace:

````text
  "calls",
  "returnsTo",
] as const;
const CONCEPT_MIN_WORDS = 60;
````

with:

````text
  "calls",
  "returnsTo",
  "landing",
] as const;
const CONCEPT_MIN_WORDS = 60;
````

In `src/tour.ts`, replace:

````text
function validateCodeStep(
  step: Record<string, unknown>,
````

with:

````text
/** A landing states where the camera is, as plain-text facts the checker verifies. */
function validateLanding(value: unknown, where: string, errors: string[]): void {
  if (value === undefined) return;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.push(`${where} must be an object`);
    return;
  }
  const landing = value as Record<string, unknown>;
  const text = (field: unknown, name: string, max: number, required: boolean) => {
    if (field === undefined) {
      if (required) errors.push(`${name} is required`);
      return;
    }
    if (typeof field !== "string" || !field.trim()) {
      errors.push(`${name} must be a non-empty string`);
      return;
    }
    if (field.length > max) errors.push(`${name} must be at most ${max} characters`);
    validateNarrative(field, name, "text", errors);
  };
  text(landing.symbol, `${where}.symbol`, 80, true);
  text(landing.when, `${where}.when`, 80, false);
  if (landing.calledBy !== undefined) {
    if (!Array.isArray(landing.calledBy) || landing.calledBy.length === 0 || landing.calledBy.length > 3) {
      errors.push(`${where}.calledBy must list 1 to 3 callers`);
    } else {
      landing.calledBy.forEach((caller, i) => text(caller, `${where}.calledBy[${i}]`, 80, true));
    }
  }
  if (landing.role !== undefined) {
    if (typeof landing.role !== "object" || landing.role === null || Array.isArray(landing.role)) {
      errors.push(`${where}.role must be an object`);
    } else {
      const role = landing.role as Record<string, unknown>;
      text(role.who, `${where}.role.who`, 40, true);
      text(role.gate, `${where}.role.gate`, 80, false);
    }
  }
  if (landing.calledBy === undefined && landing.role === undefined) {
    errors.push(`${where} needs calledBy (who calls it, by name) or role (who reaches an external entry point)`);
  }
}

function validateCodeStep(
  step: Record<string, unknown>,
````

In `src/tour.ts`, replace:

````text
  if (step.returnsTo !== undefined && typeof step.returnsTo !== "string") {
    errors.push(`${where}.returnsTo must be a string`);
  }
  if (
    storyFiles &&
````

with:

````text
  if (step.returnsTo !== undefined && typeof step.returnsTo !== "string") {
    errors.push(`${where}.returnsTo must be a string`);
  }
  validateLanding(step.landing, `${where}.landing`, errors);
  if (
    storyFiles &&
````

- [ ] **Step 4: Run** `npm run build && node --test test/tour.test.mjs` — expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/tour.ts test/tour.test.mjs dist/types.js dist/tour.js
git commit -m "feat: validate an optional landing on code steps"
```

### Task 2: Verify landings against the repository, in the checker

**Files:** Create `src/landing-verify.ts`, `test/landing-verify.test.mjs`;
modify `src/story-check.ts`, `test/story-check.test.mjs`; regenerate the
checker bundle.

- [ ] **Step 1: Failing tests.** Create `test/landing-verify.test.mjs`:

````js
// Landing verification against a real repository: callers must share a file
// with the symbol, gates must be written in the step's file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { landingSearchName, verifyLandings } from '../dist/landing-verify.js';

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'ds-landing-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  writeFileSync(join(dir, 'rate.ts'), 'export function capRate(rate: number, cap: number) {\n  return Math.min(rate, cap);\n}\n');
  writeFileSync(join(dir, 'settle.ts'), "import { capRate } from './rate';\nexport function settleFunding(rate: number) {\n  return capRate(rate, 100);\n}\n");
  writeFileSync(join(dir, 'relay.sol'), 'function relayBatch(bytes calldata ops) external onlyRole(RELAYER_ROLE) {\n}\n');
  git('add', '.');
  git('commit', '-qm', 'base');
  return { dir, git };
}

const tourWith = (file, landing, head) => ({
  version: 3, title: 'T', summary: 's', ...(head ? { head, base: 'HEAD~0' } : {}),
  steps: [{ id: 's1', order: 1, title: 't', kind: 'changed', file, range: [1, 1], why: 'w', landing }],
});

test('landingSearchName keeps the searchable part of a symbol', () => {
  assert.equal(landingSearchName('settleFunding()'), 'settleFunding');
  assert.equal(landingSearchName('GaslessLayer.relayBatch(bytes)'), 'relayBatch');
  assert.equal(landingSearchName('Foo::bar'), 'bar');
  assert.equal(landingSearchName('.ds-main'), '.ds-main');
});

test('a real caller passes; a description, an invented caller, and the symbol itself fail', () => {
  const { dir } = repo();
  try {
    assert.deepEqual(verifyLandings(dir, tourWith('rate.ts', { symbol: 'capRate()', calledBy: ['settleFunding()'] })).errors, []);
    const vague = verifyLandings(dir, tourWith('rate.ts', { symbol: 'capRate()', calledBy: ['every review page'] })).errors;
    assert.match(vague[0], /is a description, not a symbol/);
    const invented = verifyLandings(dir, tourWith('rate.ts', { symbol: 'capRate()', calledBy: ['ghostCaller()'] })).errors;
    assert.match(invented[0], /no file in the repository mentions both it and "capRate"/);
    const self = verifyLandings(dir, tourWith('rate.ts', { symbol: 'capRate()', calledBy: ['capRate()'] })).errors;
    assert.match(self[0], /is the symbol itself/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the symbol must be in the step file, and a role gate must be written there', () => {
  const { dir } = repo();
  try {
    assert.match(verifyLandings(dir, tourWith('settle.ts', { symbol: 'missingThing()', calledBy: ['settleFunding()'] })).errors[0], /does not appear in settle.ts/);
    assert.deepEqual(verifyLandings(dir, tourWith('relay.sol', { symbol: 'relayBatch()', role: { who: 'relayer', gate: 'onlyRole(RELAYER_ROLE)' } })).errors, []);
    assert.match(verifyLandings(dir, tourWith('relay.sol', { symbol: 'relayBatch()', role: { who: 'relayer', gate: 'onlyOwner' } })).errors[0], /role.gate "onlyOwner" does not appear/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fixed-head stories are verified at head; working-tree stories include untracked files', () => {
  const { dir, git } = repo();
  try {
    const head = git('rev-parse', 'HEAD').trim();
    assert.deepEqual(verifyLandings(dir, tourWith('rate.ts', { symbol: 'capRate()', calledBy: ['settleFunding()'] }, head)).errors, []);
    writeFileSync(join(dir, 'keeper.ts'), "import { capRate } from './rate';\nexport function runKeeper() { return capRate(1, 2); }\n");
    assert.deepEqual(verifyLandings(dir, tourWith('rate.ts', { symbol: 'capRate()', calledBy: ['runKeeper()'] })).errors, [], 'untracked caller counts in the working tree');
    assert.ok(verifyLandings(dir, tourWith('rate.ts', { symbol: 'capRate()', calledBy: ['runKeeper()'] }, head)).errors.length, 'but not at a head where it does not exist');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
````

and append to `test/story-check.test.mjs`:

````js
test('landing callers are verified by the checker', () => {
  withRepo(({ dir }) => {
    writeFileSync(join(dir, 'settle.ts'), "import { capRate } from './app';\nexport function settleFunding() { return capRate(1, 2); }\n");
    const good = goodStory();
    good.steps[0].landing = { symbol: 'capRate()', calledBy: ['settleFunding()'] };
    writeFileSync(join(dir, '.diffstory/story.json'), JSON.stringify(good));
    const ok = run(dir);
    assert.doesNotMatch(ok.out, /landing/);
    const vague = goodStory();
    vague.steps[0].landing = { symbol: 'capRate()', calledBy: ['every settlement path'] };
    writeFileSync(join(dir, '.diffstory/story.json'), JSON.stringify(vague));
    const r = run(dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /is a description, not a symbol/);
  });
});
````

- [ ] **Step 2: Run** `node --test test/landing-verify.test.mjs` — expected: FAIL (module missing).

- [ ] **Step 3: Create `src/landing-verify.ts`:**

````ts
// Verifies a code step's `landing` against the repository: the symbol appears
// in the step's file, every named caller shares a file with the symbol, and a
// role's gate is written in the step's file. Read-only and deterministic. It
// cannot prove a call, but a vague caller ("every review page") or an invented
// one cannot pass, which is what the judges kept asking for: verified callers.
import { execFileSync } from "node:child_process";
import { readWholeFile } from "./git.js";
import { orderedSteps } from "./tour.js";
import { isCodeStep, type Tour } from "./types.js";

const SYMBOL_NAME = /^[.#]?[A-Za-z_$][\w$-]*$/;

/** The name to search for: "GaslessLayer.relayBatch()" -> "relayBatch"; ".ds-main" stays. */
export function landingSearchName(raw: string): string {
  const name = raw.trim().replace(/\(.*\)\s*$/, "").trim();
  if (/^[.#]/.test(name)) return name;
  const parts = name.split(/::|\./).filter(Boolean);
  return parts.at(-1) ?? name;
}

/** Files (at `head`, or in the working tree including untracked files) that mention `name` as a word. */
function filesMentioning(
  repo: string,
  name: string,
  head: string | undefined,
  cache: Map<string, Set<string>>,
): Set<string> {
  const cached = cache.get(name);
  if (cached) return cached;
  const args = head
    ? ["grep", "-l", "-w", "-F", "-e", name, head, "--"]
    : ["grep", "--untracked", "-l", "-w", "-F", "-e", name];
  let out = "";
  try {
    out = execFileSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    out = ""; // git grep exits 1 when nothing matches
  }
  const prefix = head ? `${head}:` : "";
  const files = new Set(
    out
      .split("\n")
      .filter(Boolean)
      .map((line) => (prefix && line.startsWith(prefix) ? line.slice(prefix.length) : line)),
  );
  cache.set(name, files);
  return files;
}

export function verifyLandings(repo: string, tour: Tour): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cache = new Map<string, Set<string>>();
  for (const step of orderedSteps(tour)) {
    if (!isCodeStep(step) || !step.landing || step.range[0] === 0) continue;
    const where = `steps[${step.id}].landing`;
    const { symbol, calledBy = [], role } = step.landing;
    const lines = readWholeFile(repo, step.file, tour.head);
    const fileText = lines ? lines.join("\n") : null;
    const symbolName = landingSearchName(symbol);
    if (fileText !== null && !fileText.includes(symbolName)) {
      errors.push(`${where}.symbol "${symbol}" does not appear in ${step.file}`);
    }
    const symbolFiles = filesMentioning(repo, symbolName, tour.head, cache);
    calledBy.forEach((caller, index) => {
      const name = landingSearchName(caller);
      if (!SYMBOL_NAME.test(name)) {
        errors.push(
          `${where}.calledBy[${index}] "${caller}" is a description, not a symbol; name the calling function, handler, test, or component`,
        );
        return;
      }
      if (name === symbolName) {
        errors.push(`${where}.calledBy[${index}] "${caller}" is the symbol itself`);
        return;
      }
      const callerFiles = filesMentioning(repo, name, tour.head, cache);
      if (![...callerFiles].some((file) => symbolFiles.has(file))) {
        errors.push(
          `${where}.calledBy[${index}] "${caller}": no file in the repository mentions both it and "${symbolName}"`,
        );
      }
    });
    const gate = role?.gate?.replace(/\s+/g, " ").trim();
    if (gate && fileText !== null && !fileText.replace(/\s+/g, " ").includes(gate)) {
      errors.push(`${where}.role.gate "${role?.gate}" does not appear in ${step.file}`);
    }
  }
  return { errors, warnings };
}
````

- [ ] **Step 4: Wire it into the checker.**

In `src/story-check.ts`, replace:

````text
import { verifyLogicMoves } from "./logic-moves.js";
````

with:

````text
import { verifyLandings } from "./landing-verify.js";
import { verifyLogicMoves } from "./logic-moves.js";
````

In `src/story-check.ts`, replace:

````text
  report.moveWarnings.push(...moves.warnings);
````

with:

````text
  report.moveWarnings.push(...moves.warnings);
  report.errors.push(...verifyLandings(repo, tour).errors);
````

- [ ] **Step 5: Run** `npm run build && node --test test/landing-verify.test.mjs test/story-check.test.mjs`
  — expected: PASS, including the bundle-freshness test.

- [ ] **Step 6: Commit**

```bash
git add src/landing-verify.ts src/story-check.ts test/landing-verify.test.mjs test/story-check.test.mjs \
  dist/landing-verify.js dist/story-check.js skills/diffstory-storyteller/scripts/check-story.mjs
git commit -m "feat: the story checker verifies landing callers against the repository"
```

### Task 3: Warn when a code step has no landing

**Files:** `src/story-lint.ts`, `test/story-lint.test.mjs`; regenerate the bundle.

- [ ] **Step 1: Tests.** In `test/story-lint.test.mjs`, the shared `step()`
  builder gets a default landing so existing "no findings" tests stay
  meaningful. Replace:

````text
    beats: [{ text: `This is <code>${name}()</code>, called by the router on every request; it now rejects stale input.`, highlights: [[10, 12]] }],
    ...over,
````

with:

````text
    beats: [{ text: `This is <code>${name}()</code>, called by the router on every request; it now rejects stale input.`, highlights: [[10, 12]] }],
    landing: { symbol: `${name}()`, calledBy: ['router()'] },
    ...over,
````

Then append:

````js
test('landing-field-missing: code steps without a landing warn once, grouped', () => {
  const bare = (over = {}) => step({ landing: undefined, ...over });
  const f = lintStory(story([bare(), bare(), step()]));
  const hit = f.find((x) => x.rule === 'landing-field-missing');
  assert.equal(hit?.severity, 'warning');
  assert.match(hit.message, /^2 code steps have no landing field/);
  const exempt = story([step({ landing: undefined, tags: ['sweep'] }), step({ landing: undefined, file: 'docs/guide.md' }), step({ landing: undefined, file: 'config/app.json' })]);
  assert.ok(!has(lintStory(exempt), 'landing-field-missing'));
});
````

Run `npm run build && node --test test/story-lint.test.mjs`. Expected: the new test FAILS.

- [ ] **Step 2: Implement.** Apply these three replacements.

In `src/story-lint.ts`, replace:

````text
const PROSE_FILE = /\.(md|mdx|markdown|txt|rst|adoc)$/i;
````

with:

````text
const PROSE_FILE = /\.(md|mdx|markdown|txt|rst|adoc)$/i;
const CONFIG_FILE = /\.(json|ya?ml|toml|ini|env|lock)$/i;
````

In `src/story-lint.ts`, replace:

````text
  lintChapters(steps, add);
````

with:

````text
  lintLandingField(code, add);
  lintChapters(steps, add);
````

In `src/story-lint.ts`, replace:

````text
function lintChapters(steps: TourStep[], add: Add): void {
````

with:

````text
function lintLandingField(code: CodeTourStep[], add: Add): void {
  const missing = code
    .filter(
      (step) =>
        !step.landing &&
        !isSweep(step) &&
        !PROSE_FILE.test(step.file) &&
        !CONFIG_FILE.test(step.file) &&
        step.range[0] !== 0,
    )
    .map((step) => step.id);
  if (!missing.length) return;
  add(
    "landing-field-missing",
    "warning",
    stepList(missing),
    `${missing.length} code step${missing.length === 1 ? " has" : "s have"} no landing field.`,
    "Add `landing` to each: the symbol on screen, who calls it by name (`calledBy`) or the role and gate of an external entry point, and when. The checker verifies callers against the repository.",
  );
}

function lintChapters(steps: TourStep[], add: Add): void {
````

- [ ] **Step 3: Run** `npm run build && node --test test/story-lint.test.mjs test/story-check.test.mjs` — expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/story-lint.ts test/story-lint.test.mjs dist/story-lint.js skills/diffstory-storyteller/scripts/check-story.mjs
git commit -m "feat: lint code steps that have no landing"
```

### Task 4: Show the landing under the step title

**Files:** `src/view-model.ts`, `src/render.ts`, `client/surfaces/review/review.css`, `test/review-page.test.mjs`

- [ ] **Step 1: Failing test.** Append to `test/review-page.test.mjs` (it already
  imports `buildReviewModel`, `renderStoryStepPanel`, `test`, and `assert`):

````js
test('a code step with a landing renders the "where am I" line, escaped', () => {
  const tour = {
    version: 3,
    title: 't',
    summary: 's',
    steps: [
      {
        id: 's1', order: 1, title: 'c', file: 'src/a.ts', range: [1, 2], kind: 'changed',
        why: 'I changed this so the next helper receives the value it needs.',
        landing: { symbol: 'capRate()', calledBy: ['settleFunding()', 'runKeeper()'], when: 'once per market, while rate < cap & fresh' },
      },
      {
        id: 's2', order: 2, title: 'd', file: 'src/b.sol', range: [1, 1], kind: 'changed',
        why: 'I changed this so relayers pass the new argument.',
        landing: { symbol: 'relayBatch()', role: { who: 'relayer', gate: 'onlyRole(RELAYER_ROLE)' } },
      },
    ],
  };
  const hunk = { oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: [
    { type: 'del', content: 'old', oldNo: 1 }, { type: 'add', content: 'new1', newNo: 1 }, { type: 'add', content: 'new2', newNo: 2 },
  ] };
  const files = [
    { oldPath: 'src/a.ts', newPath: 'src/a.ts', status: 'modified', hunks: [hunk] },
    { oldPath: 'src/b.sol', newPath: 'src/b.sol', status: 'modified', hunks: [hunk] },
  ];
  const model = buildReviewModel(process.cwd(), tour, files, undefined, {});
  const first = renderStoryStepPanel(process.cwd(), model, [], 0);
  assert.match(first, /<p class="ds-landing" aria-label="Where this step is">/);
  assert.match(first, /<code class="ds-landing-symbol">capRate\(\)<\/code>/);
  assert.match(first, /<span class="ds-landing-file">a\.ts<\/span>/);
  assert.match(first, /called by <code>settleFunding\(\)<\/code>, <code>runKeeper\(\)<\/code>/);
  assert.match(first, /<span class="ds-landing-when">once per market, while rate &lt; cap &amp; fresh<\/span>/, 'plain text is escaped');
  const second = renderStoryStepPanel(process.cwd(), model, [], 1);
  assert.match(second, /called by the relayer through <code>onlyRole\(RELAYER_ROLE\)<\/code>/);
  const bare = buildReviewModel(process.cwd(), { ...tour, steps: [{ ...tour.steps[0], landing: undefined }] }, files, undefined, {});
  assert.doesNotMatch(renderStoryStepPanel(process.cwd(), bare, [], 0), /ds-landing/);
});
````

Run `npm run build && node --test --test-name-pattern="where am I" test/review-page.test.mjs`. Expected: FAIL.

- [ ] **Step 2: Implement.** Apply these five replacements.

In `src/view-model.ts`, replace:

````text
  why: Narrative;
  /** Author-declared distrust reason when this step is a story hotspot. */
  hotspot?: Narrative;
  health: StepHealthView;
````

with:

````text
  why: Narrative;
  /** Verified "where am I" facts, shown under the step title. */
  landing?: {
    symbol: string;
    /** Basename of the step's file. */
    file: string;
    calledBy: string[];
    role?: { who: string; gate?: string };
    when?: string;
  };
  /** Author-declared distrust reason when this step is a story hotspot. */
  hotspot?: Narrative;
  health: StepHealthView;
````

In `src/view-model.ts`, replace:

````text
    why: narrative(step.why ?? '', 'inline'),
    hotspot,
    health: stepHealth(step, viewport, focusGroups),
````

with:

````text
    why: narrative(step.why ?? '', 'inline'),
    ...(step.landing
      ? {
          landing: {
            symbol: narrativeText(step.landing.symbol),
            file: step.file.split('/').pop() ?? step.file,
            calledBy: (step.landing.calledBy ?? []).map((caller) => narrativeText(caller)),
            ...(step.landing.role
              ? {
                  role: {
                    who: narrativeText(step.landing.role.who),
                    ...(step.landing.role.gate ? { gate: narrativeText(step.landing.role.gate) } : {}),
                  },
                }
              : {}),
            ...(step.landing.when ? { when: narrativeText(step.landing.when) } : {}),
          },
        }
      : {}),
    hotspot,
    health: stepHealth(step, viewport, focusGroups),
````

In `src/render.ts`, replace:

````text
          ${storyRepairMenu(s, true)}
        </div>
      </div>
    </div>
    ${
      s.hotspot
````

with:

````text
          ${storyRepairMenu(s, true)}
        </div>
      </div>
      ${landingLine(s)}
    </div>
    ${
      s.hotspot
````

In `src/render.ts`, replace:

````text
function moveRangeLabel(file: string, [start, end]: [number, number]): string {
````

with:

````text
/** "Where am I": the symbol on screen, its file, who reaches it, and when. Not narrated. */
function landingLine(s: CodeStepView): string {
  const landing = s.landing;
  if (!landing) return "";
  const parts = [
    `<code class="ds-landing-symbol">${esc(landing.symbol)}</code>`,
    `<span class="ds-landing-file">${esc(landing.file)}</span>`,
  ];
  if (landing.calledBy.length) {
    parts.push(
      `<span class="ds-landing-callers">called by ${landing.calledBy.map((caller) => `<code>${esc(caller)}</code>`).join(", ")}</span>`,
    );
  } else if (landing.role) {
    parts.push(
      `<span class="ds-landing-callers">called by the ${esc(landing.role.who)}${
        landing.role.gate ? ` through <code>${esc(landing.role.gate)}</code>` : ""
      }</span>`,
    );
  }
  if (landing.when) parts.push(`<span class="ds-landing-when">${esc(landing.when)}</span>`);
  return `<p class="ds-landing" aria-label="Where this step is">${parts.join(
    '<span class="ds-landing-sep" aria-hidden="true">·</span>',
  )}</p>`;
}

function moveRangeLabel(file: string, [start, end]: [number, number]): string {
````

In `client/surfaces/review/review.css`, replace:

````text
.ds-step-titlerow{display:flex;align-items:center;gap:10px;margin-bottom:9px}
````

with:

````text
.ds-step-titlerow{display:flex;align-items:center;gap:10px;margin-bottom:9px}
.ds-landing{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px;margin:-3px 0 9px;font-size:12.5px;line-height:1.5;color:var(--muted)}
.ds-landing code{font-family:var(--mono);font-size:12px;color:var(--text)}
.ds-landing-symbol{font-weight:600}
.ds-landing-sep{color:var(--dim)}
````

- [ ] **Step 3: Run** `npm run build && node --test test/review-page.test.mjs` — expected: PASS.

- [ ] **Step 4: Commit** (check `git status --short` for the exact client CSS
  output the build changed, and stage it by path):

```bash
git add src/view-model.ts src/render.ts client/surfaces/review/review.css test/review-page.test.mjs dist/view-model.js dist/render.js
git status --short   # also stage the rebuilt client stylesheet under dist/client/ by exact path
git commit -m "feat: show a verified landing line under each story step title"
```

### Task 5: Teach the field in the skill and the schema docs

**Files:** `skills/diffstory-storyteller/SKILL.md`,
`skills/diffstory-storyteller/references/schema.md`, `docs/story-schema.md`,
`test/agent.test.mjs`

- [ ] **Step 1: Pin it first.** In `test/agent.test.mjs`:

In `test/agent.test.mjs`, replace:

````text
    'a landing beat usually needs 20-40',
  ]) {
````

with:

````text
    'a landing beat usually needs 20-40',
    'Landing field: record the same facts',
    'a vague caller cannot pass',
  ]) {
````

Run `node --test test/agent.test.mjs`. Expected: FAIL.

- [ ] **Step 2: Apply these six replacements.**

In `skills/diffstory-storyteller/SKILL.md`, replace:

````text
  never skipped. A landing is a clause, not a paragraph, but a complete one:
  never bolt a landing sentence onto an existing beat, and never pad it with
  "Look at lines …".
````

with:

````text
  never skipped. A landing is a clause, not a paragraph, but a complete one:
  never bolt a landing sentence onto an existing beat, and never pad it with
  "Look at lines …".
- Landing field: record the same facts in the step's `landing` so the app can
  show them and the checker can verify them:
  `"landing": { "symbol": "_capRate()", "calledBy": ["settleFunding()"], "when": "once per market" }`.
  For an external entry point with no calling function, name the role and the
  check that gates it: `"role": { "who": "relayer", "gate": "onlyRole(RELAYER_ROLE)" }`.
  The checker rejects a caller that no file in the repository mentions
  together with the symbol, so a vague caller cannot pass.
````

In `skills/diffstory-storyteller/references/schema.md`, replace:

````text
  fileless primers placed immediately before dependent code; same rule.
````

with:

````text
  fileless primers placed immediately before dependent code; same rule.
- Optional `landing` on code steps (never on concept steps): `symbol`
  (required), `calledBy` (1-3 names) or `role` (`who`, optional `gate`), and
  optional `when`; plain text, each at most 80 characters (`role.who` 40). The
  checker verifies that each caller shares a file with the symbol and that a
  gate is written in the step's file. The app shows it under the step title.
````

In `skills/diffstory-storyteller/references/schema.md`, replace:

````text
| every `title`, `moves[].label`, `moves[].hidden.tag`, `storyScope.reviewerNote` | plain text — no tags at all |
````

with:

````text
| every `title`, `moves[].label`, `moves[].hidden.tag`, `storyScope.reviewerNote`, `landing.*` | plain text — no tags at all |
````

In `skills/diffstory-storyteller/references/schema.md`, replace:

````text
      "calls": ["s2"],
````

with:

````text
      "landing": { "symbol": "settleFunding()", "role": { "who": "keeper" }, "when": "once per epoch" },
      "calls": ["s2"],
````

In `skills/diffstory-storyteller/references/schema.md`, replace:

````text
      "calls": ["s3"],
````

with:

````text
      "landing": { "symbol": "_capRate()", "calledBy": ["settleFunding()"], "when": "once per market" },
      "calls": ["s3"],
````

In `docs/story-schema.md`, replace:

````text
| `verification[].check` | What the author ran, as the reviewer would type it. At most 120 characters; rendered in the review-notes verification list. |
````

with:

````text
| `verification[].check` | What the author ran, as the reviewer would type it. At most 120 characters; rendered in the review-notes verification list. |
| `steps[].landing.symbol`, `.calledBy[]`, `.role.who`, `.role.gate`, `.when` | Verified "where am I" facts shown under the step title. At most 80 characters each (`role.who` 40); callers must be symbols the checker can find alongside `symbol`. |
````

- [ ] **Step 3: Verify the bytes.**

```bash
cd skills/diffstory-storyteller && for f in SKILL.md references/schema.md; do printf "%s  %s\n" "$(shasum -a 256 $f | cut -c1-12)" "$f"; done; cd -
```

Expected: `b4f13f2fd4e4  SKILL.md` and `b3fb8e801d56  references/schema.md`.
Plan 023's Task 0 digest command must now print `8351620ffbeeb81b`.

- [ ] **Step 4: Run** `npm test` — expected: all pass.

- [ ] **Step 5: Try it on a real story** (read-only; any repo with a recent
  story works). The checker should report `landing-field-missing` as a warning:

```bash
cd ~/Codes/blockchain/symmio/perps-core-2 && node ~/Codes/blockchain/symmio/SmartDiffChecker/skills/diffstory-storyteller/scripts/check-story.mjs | grep -A 2 "landing-field-missing"; cd -
```

- [ ] **Step 6: Commit and install**

```bash
git add skills/diffstory-storyteller/SKILL.md skills/diffstory-storyteller/references/schema.md docs/story-schema.md test/agent.test.mjs
git commit -m "feat: storyteller records a verified landing on every code step"
sh scripts/install-skills.sh --claude --codex
```

Then run plan 018 Task 4 Step 2. Expected: three `current` lines.

In a final commit, mark 029 as DONE in the `plans/README.md` table.

## Report back

Commits per task, the hashes and digest printed in Task 5, the output of Task
5 Step 5, the install check, and any deviation from the plan text.
