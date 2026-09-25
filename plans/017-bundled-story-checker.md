# 017 — Bundle a story checker (and ledger) into the skill folder

> **For agentic workers:** Use superpowers:executing-plans (or
> superpowers:subagent-driven-development) to run this plan task by task.
> Steps use checkbox (`- [ ]`) syntax. Read `plans/README.md` → "Story quality
> campaign → Rules for every executor" before starting.

**Goal:** Give every agent a way to verify its own story before handing it
back: `node <skill-dir>/scripts/check-story.mjs` runs the app's own contract
validators, the coverage gate against the real git diff, logic-move
verification, and the plan-016 lints, and prints grouped, actionable output.
`--ledger` prints every changed range the story must claim, with the
enclosing function for orientation.

**Architecture:** Library `src/story-check.ts` (pure functions over a repo
path) plus a thin CLI `src/story-check-cli.ts`. esbuild bundles the CLI and
everything it imports into one dependency-free file,
`skills/diffstory-storyteller/scripts/check-story.mjs` (~110 kB). It ships
with the skill through `install-skills.sh`, the app's `updateSkills`, and the
Claude plugin, because all three copy the whole skill folder. The bundle is
generated and committed, like `dist/`.

**Tech stack:** TypeScript, esbuild (already a devDependency), Node ≥ 20.

**Spec:** `docs/research/story-corpus-audit-2026-09.md` (findings 1–2, decision D1).

## Global constraints

- Depends on plans 014 (`src/logic-moves.ts`, `filesForStoryCoverage` in
  `coverage.ts`), 015 (`verification`), and 016 (`src/story-lint.ts`).
- Read-only: the checker must never write to the repository or run a git
  command that mutates state.
- It is **not** a diffStory CLI: no `bin` entry in `package.json`, no install
  step, nothing on PATH. `test/release-readiness.test.mjs` already asserts
  `pkg.bin === undefined` and that the skill never says `diffstory check`.
- Exit codes: 0 ready, 1 not ready, 2 usage or setup error.
- The code below was compiled against this repo's strict `tsconfig.json`, and
  all 12 tests passed on 2026-09-25, including a run against a real story in
  another repo. Paste it as-is. If `tsc` disagrees, the repo moved: fix the
  smallest thing and say so in your report.

## Review focus

- A story whose `base` ref no longer exists: `resolveBase` falls back to the
  review base; the report's `Diff:` line must show which diff was used.
- Very large ledgers (a long-lived branch diffed against `main` can list
  900+ files): the ledger must still print; agents pass `--base`/`--include`.
- `--json` output must stay valid JSON even when the story is unreadable.
- Scoped stories: a changed file owned by no story is reported once, not per
  story.

---

### Task 1: Checker library and CLI

**Files:**
- Create: `src/story-check.ts`
- Create: `src/story-check-cli.ts`

**Interfaces:**
- Consumes: `validateTour`, `validateGeneratedTour`, `validateNewGeneratedStory`
  (`tour.ts`); `getDiff`, `readWholeFile`, `resolveBase` (`git.ts`);
  `parseUnifiedDiff`, `changedRanges` (`diff.ts`); `computeCoverage`,
  `filesForStoryCoverage`, `stalePointers` (`coverage.ts`); `verifyLogicMoves`
  (`logic-moves.ts`); `lintStory` (`story-lint.ts`); `enclosingScopeLabel`
  (`enclosing-scope.ts`).
- Produces: `runStoryCheck(repo, storyPath): StoryCheckReport`,
  `reportReady(report, strict?)`, `formatReport(report, strict?)`,
  `storyLedger(repo, opts)`, `formatLedger(ledger)`, `unownedFiles(repo, tours)`,
  `globToRegExp(glob)`.

- [ ] **Step 1: Create `src/story-check.ts`** with exactly this content:

```ts
// The bundled story checker: the app's own contract validators, the coverage
// gate against the real git diff, logic-move verification, and the
// deterministic prose lints, runnable without the app. Agents run it from the
// skill folder (`node <skill-dir>/scripts/check-story.mjs`); it is bundled by
// scripts/build-skill-checker.mjs. It is not a diffStory CLI: nothing is
// installed, and it only reads.
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { changedRanges, parseUnifiedDiff } from "./diff.js";
import { enclosingScopeLabel } from "./enclosing-scope.js";
import { getDiff, readWholeFile, resolveBase } from "./git.js";
import { computeCoverage, filesForStoryCoverage, stalePointers } from "./coverage.js";
import { verifyLogicMoves } from "./logic-moves.js";
import { lintStory, type LintFinding } from "./story-lint.js";
import { validateGeneratedTour, validateNewGeneratedStory, validateTour } from "./tour.js";
import { isCodeStep, type DiffFile, type Tour } from "./types.js";

export interface StoryCheckReport {
  /** Story path relative to the repository. */
  story: string;
  /** The diff the story was measured against, e.g. "main..working tree". */
  diffLabel: string;
  /** Contract failures: the app would reject the story or flag unexplained changes. */
  errors: string[];
  /** Prose and structure lint findings (errors and warnings). */
  findings: LintFinding[];
  /** Soft logic-move doubts from the move verifier. */
  moveWarnings: string[];
  /** Changed-range coverage, when the diff could be read. */
  coverage: { claimed: number; total: number } | null;
  /** The parsed story when it passed basic validation. */
  tour?: Tour;
}

export interface LedgerRange {
  range: [number, number];
  /** Nearest enclosing function/class/rule line, when one can be found. */
  scope?: string;
}

export interface LedgerFile {
  file: string;
  status: DiffFile["status"];
  test: boolean;
  ranges: LedgerRange[];
}

export interface StoryLedger {
  diffLabel: string;
  files: LedgerFile[];
}

const TEST_PATH =
  /(^|\/)(tests?|__tests__|specs?)\/|\.(test|spec)\.[cm]?[jt]sx?$|\.t\.sol$|_test\.(go|py|rs)$|(^|\/)test_[^/]+\.py$|Tests?\.(java|kt|swift|cs)$/i;

/** True when no contract error and no lint error remain (and, if strict, no warning). */
export function reportReady(report: StoryCheckReport, strict = false): boolean {
  if (report.errors.length) return false;
  if (report.findings.some((f) => f.severity === "error")) return false;
  if (strict && (report.findings.length || report.moveWarnings.length)) return false;
  return true;
}

function canonicalizeDeletedKind(parsed: unknown): void {
  const steps = (parsed as { steps?: unknown })?.steps;
  if (!Array.isArray(steps)) return;
  for (const step of steps) {
    if (step && typeof step === "object" && (step as { kind?: unknown }).kind === "deleted") {
      (step as { kind: string }).kind = "changed";
    }
  }
}

/** Check one story file against the repository it lives in. */
export function runStoryCheck(repo: string, storyPath: string): StoryCheckReport {
  const story = relative(repo, storyPath) || storyPath;
  const report: StoryCheckReport = {
    story,
    diffLabel: "",
    errors: [],
    findings: [],
    moveWarnings: [],
    coverage: null,
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(storyPath, "utf8"));
  } catch (error) {
    report.errors.push(`${story} is not readable JSON: ${(error as Error).message}`);
    return report;
  }
  canonicalizeDeletedKind(parsed);
  const basic = validateTour(parsed);
  if (basic.length) {
    // The app refuses to load this story; deeper checks would only add noise.
    report.errors.push(...basic);
    return report;
  }
  const tour = parsed as Tour;
  report.tour = tour;
  report.errors.push(
    ...(tour.version === 3 ? validateNewGeneratedStory(tour) : validateGeneratedTour(tour)),
  );
  if (/(^|\/)\.diffstory\/stories\//.test(story) && !tour.storyScope?.includedFiles?.length) {
    report.errors.push("stories under .diffstory/stories/ need storyScope.includedFiles");
  }

  const base = resolveBase(repo, tour.base);
  report.diffLabel = `${tour.base ?? base}..${tour.head ?? "working tree"}`;
  let files: DiffFile[] = [];
  try {
    files = filesForStoryCoverage(tour, parseUnifiedDiff(getDiff(repo, base, tour.head)));
  } catch (error) {
    report.errors.push(`could not read the diff ${report.diffLabel}: ${(error as Error).message}`);
  }
  const coverage = computeCoverage(tour, files);
  report.coverage = { claimed: coverage.fullyClaimedChangedRanges, total: coverage.totalChangedRanges };
  for (const change of coverage.unclaimed) {
    report.errors.push(
      `unexplained change: ${change.file} ${change.range[0]}-${change.range[1]} is not claimed by any changed/new-file step`,
    );
  }
  for (const step of stalePointers(tour, files)) {
    const file = isCodeStep(step) ? step.file : "?";
    report.errors.push(
      `stale step ${step.id}: its range or ranges do not match changed code in ${file} (re-read the post-change file and fix the line numbers)`,
    );
  }
  const moves = verifyLogicMoves(repo, tour);
  report.errors.push(...moves.errors);
  report.moveWarnings.push(...moves.warnings);
  report.findings = lintStory(tour, {
    readLines: (file) => readWholeFile(repo, file, tour.head),
  });
  return report;
}

/** Changed files a set of scoped stories leaves to nobody (same base/head only). */
export function unownedFiles(repo: string, tours: Tour[]): string[] {
  if (tours.length < 2) return [];
  const key = (t: Tour) => `${t.base ?? ""}..${t.head ?? ""}`;
  if (new Set(tours.map(key)).size !== 1) return [];
  const owned = new Set(tours.flatMap((t) => t.storyScope?.includedFiles ?? []));
  const excluded = new Set(tours.flatMap((t) => t.storyScope?.excludedFiles ?? []));
  const base = resolveBase(repo, tours[0].base);
  return parseUnifiedDiff(getDiff(repo, base, tours[0].head))
    .map((f) => f.newPath)
    .filter((path) => !owned.has(path) && !excluded.has(path));
}

/** Minimal glob: `**` spans directories, `*` and `?` stay inside one segment. */
export function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") {
      const slash = glob[i + 2] === "/";
      out += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (ch === "*") out += "[^/]*";
    else if (ch === "?") out += "[^/]";
    else out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

/** Every changed range a story must claim, with the enclosing scope for orientation. */
export function storyLedger(
  repo: string,
  opts: { base?: string; head?: string; include?: string[]; exclude?: string[] } = {},
): StoryLedger {
  const base = resolveBase(repo, opts.base);
  const include = (opts.include ?? []).map(globToRegExp);
  const exclude = (opts.exclude ?? []).map(globToRegExp);
  const files = parseUnifiedDiff(getDiff(repo, base, opts.head)).filter(
    (f) =>
      (!include.length || include.some((re) => re.test(f.newPath))) &&
      !exclude.some((re) => re.test(f.newPath)),
  );
  return {
    diffLabel: `${opts.base ?? base}..${opts.head ?? "working tree"}`,
    files: files.map((f) => {
      const lines = f.status === "deleted" ? null : readWholeFile(repo, f.newPath, opts.head);
      return {
        file: f.newPath,
        status: f.status,
        test: TEST_PATH.test(f.newPath),
        ranges: changedRanges(f).map((range) => {
          const scope = lines && range[0] > 0 ? enclosingScopeLabel(lines, range[0]) : undefined;
          return scope ? { range, scope } : { range };
        }),
      };
    }),
  };
}

export function formatLedger(ledger: StoryLedger): string {
  const total = ledger.files.reduce((n, f) => n + f.ranges.length, 0);
  const out = [
    `Changed ranges for ${ledger.diffLabel}: ${ledger.files.length} files, ${total} ranges.`,
    "Every range must be claimed by a changed/new-file step (range, or top-level ranges on a tagged sweep).",
    "",
  ];
  for (const f of ledger.files) {
    const tags = [f.status !== "modified" ? f.status : "", f.test ? "test" : ""].filter(Boolean).join(", ");
    out.push(`${f.file}${tags ? `  (${tags})` : ""}`);
    if (f.status === "deleted") {
      out.push("  whole file deleted: use range, viewport, and highlights of [0, 0]");
      continue;
    }
    for (const r of f.ranges) {
      const span = `${r.range[0]}-${r.range[1]}`.padEnd(11);
      out.push(`  ${span}${r.scope ? `in ${r.scope}` : ""}`);
    }
  }
  return out.join("\n");
}

function groupFindings(findings: LintFinding[]): Array<{ rule: string; items: LintFinding[] }> {
  const groups = new Map<string, LintFinding[]>();
  for (const f of findings) groups.set(f.rule, [...(groups.get(f.rule) ?? []), f]);
  return [...groups].map(([rule, items]) => ({ rule, items }));
}

function formatGroup(rule: string, items: LintFinding[]): string[] {
  const places = items.map((f) => f.where);
  const shown = places.slice(0, 6).join(", ") + (places.length > 6 ? `, … (${places.length} places)` : "");
  const lines = [`  - [${rule}] ${items.length > 1 ? `x${items.length} at ` : "at "}${shown}`];
  lines.push(`      ${items[0].message}`);
  lines.push(`      fix: ${items[0].fix}`);
  return lines;
}

export function formatReport(report: StoryCheckReport, strict = false): string {
  const lintErrors = report.findings.filter((f) => f.severity === "error");
  const warnings = report.findings.filter((f) => f.severity === "warning");
  const errorCount = report.errors.length + lintErrors.length;
  const out = [`diffStory story check: ${report.story}`];
  if (report.diffLabel) {
    const cov = report.coverage ? ` · coverage ${report.coverage.claimed}/${report.coverage.total} changed ranges claimed` : "";
    out.push(`Diff: ${report.diffLabel}${cov}`);
  }
  if (errorCount) {
    out.push("", `ERRORS (${errorCount}) — the story is not ready until these are fixed`);
    for (const e of report.errors) out.push(`  - ${e}`);
    for (const g of groupFindings(lintErrors)) out.push(...formatGroup(g.rule, g.items));
  }
  if (warnings.length || report.moveWarnings.length) {
    const groups = groupFindings(warnings);
    out.push(
      "",
      `WARNINGS (${groups.length + (report.moveWarnings.length ? 1 : 0)} rules, ${warnings.length + report.moveWarnings.length} places) — fix, or be able to say why the rule does not apply here`,
    );
    for (const g of groups) out.push(...formatGroup(g.rule, g.items));
    for (const w of report.moveWarnings) out.push(`  - [move] ${w}`);
  }
  const ready = reportReady(report, strict);
  out.push(
    "",
    ready
      ? `RESULT: READY — 0 errors, ${warnings.length + report.moveWarnings.length} warnings`
      : `RESULT: NOT READY${strict && !errorCount ? " (strict: warnings count)" : ""} — ${errorCount} errors, ${warnings.length + report.moveWarnings.length} warnings`,
  );
  return out.join("\n");
}
```

- [ ] **Step 2: Create `src/story-check-cli.ts`** with exactly this content:

```ts
// Command-line entry for the bundled story checker. See story-check.ts.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  formatLedger,
  formatReport,
  reportReady,
  runStoryCheck,
  storyLedger,
  unownedFiles,
  type StoryCheckReport,
} from "./story-check.js";

const HELP = `Usage: node check-story.mjs [story.json ...] [options]

Checks a diffStory story against the app's own contract, the real git diff,
and the storyteller's prose lints. Run it from inside the repository.

  (no story)        check .diffstory/story.json, or every .diffstory/stories/*.json
  --ledger          print the changed ranges a story must claim, with enclosing scopes
  --base <ref>      ledger only: diff base (default: the repository's review base)
  --head <ref>      ledger only: fixed head (default: working tree)
  --include <glob>  ledger only: limit to matching files (repeatable)
  --repo <dir>      repository root (default: git root of the current directory)
  --json            machine-readable output
  --strict          warnings also fail the check
  -h, --help        show this help

Ledger includes/excludes default to includeGlobs/excludeGlobs from
.diffstory/preferences.json when that file exists.

Exit status: 0 ready, 1 not ready, 2 usage or setup error.`;

interface Args {
  stories: string[];
  ledger: boolean;
  base?: string;
  head?: string;
  include: string[];
  repo?: string;
  json: boolean;
  strict: boolean;
  help: boolean;
}

interface Preferences {
  defaultMode?: string;
  includeGlobs?: string[];
  excludeGlobs?: string[];
  notes?: string;
}

function parseArgs(argv: string[]): Args | string {
  const args: Args = { stories: [], ledger: false, include: [], json: false, strict: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${a} needs a value`);
      return v;
    };
    try {
      if (a === "-h" || a === "--help") args.help = true;
      else if (a === "--ledger") args.ledger = true;
      else if (a === "--json") args.json = true;
      else if (a === "--strict") args.strict = true;
      else if (a === "--base") args.base = value();
      else if (a === "--head") args.head = value();
      else if (a === "--include") args.include.push(value());
      else if (a === "--repo") args.repo = value();
      else if (a.startsWith("-")) return `unknown option: ${a}`;
      else args.stories.push(a);
    } catch (error) {
      return (error as Error).message;
    }
  }
  return args;
}

function gitRoot(cwd: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function readPreferences(repo: string): Preferences {
  const path = join(repo, ".diffstory", "preferences.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Preferences;
  } catch (error) {
    console.error(`check-story: ignoring unreadable .diffstory/preferences.json (${(error as Error).message})`);
    return {};
  }
}

function defaultStories(repo: string): string[] {
  const single = join(repo, ".diffstory", "story.json");
  if (existsSync(single)) return [single];
  const dir = join(repo, ".diffstory", "stories");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => join(dir, name));
}

function main(argv: string[]): number {
  const args = parseArgs(argv);
  if (typeof args === "string") {
    console.error(`check-story: ${args}\n\n${HELP}`);
    return 2;
  }
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  const repo = args.repo ? resolve(args.repo) : gitRoot(process.cwd());
  if (!repo) {
    console.error("check-story: not inside a git repository (use --repo <dir>)");
    return 2;
  }
  const prefs = readPreferences(repo);
  if (args.ledger) {
    const ledger = storyLedger(repo, {
      base: args.base,
      head: args.head,
      include: args.include.length ? args.include : prefs.includeGlobs ?? [],
      exclude: prefs.excludeGlobs ?? [],
    });
    console.log(args.json ? JSON.stringify(ledger, null, 2) : formatLedger(ledger));
    return 0;
  }
  const stories = args.stories.length ? args.stories.map((p) => resolve(p)) : defaultStories(repo);
  if (!stories.length) {
    console.error(
      "check-story: no story found. Write .diffstory/story.json (or .diffstory/stories/<slug>.json) first.",
    );
    return 2;
  }
  const reports: StoryCheckReport[] = stories.map((path) => runStoryCheck(repo, path));
  const tours = reports.flatMap((r) => (r.tour ? [r.tour] : []));
  const unowned = stories.length > 1 && tours.length === reports.length ? unownedFiles(repo, tours) : [];
  const ready = reports.every((r) => reportReady(r, args.strict)) && unowned.length === 0;
  if (args.json) {
    console.log(
      JSON.stringify(
        { ready, unownedFiles: unowned, reports: reports.map(({ tour: _tour, ...rest }) => rest) },
        null,
        2,
      ),
    );
  } else {
    console.log(reports.map((r) => formatReport(r, args.strict)).join("\n\n"));
    if (unowned.length) {
      console.log(
        `\nUNOWNED FILES (${unowned.length}) — changed, but in no story's storyScope.includedFiles or excludedFiles:\n` +
          unowned.map((f) => `  - ${f}`).join("\n"),
      );
    }
  }
  return ready ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

(No commit yet — Task 2 adds the bundle and its tests.)

### Task 2: Bundle into the skill folder, with end-to-end tests

**Files:**
- Create: `scripts/build-skill-checker.mjs`
- Modify: `package.json` (`scripts.build`, new `scripts["build:skill-checker"]`)
- Create (generated): `skills/diffstory-storyteller/scripts/check-story.mjs`
- Create: `test/story-check.test.mjs`
- Modify: `test/release-readiness.test.mjs`

- [ ] **Step 1: Write the end-to-end tests first.** Create `test/story-check.test.mjs`
  (`readFileSync` and `build` are imported now for Task 3's test):

```js
// The bundled checker, run exactly as an agent runs it: node <skill>/scripts/check-story.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { build } from 'esbuild';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CHECKER = fileURLToPath(new URL('../skills/diffstory-storyteller/scripts/check-story.mjs', import.meta.url));

/** A repo on `main` with one committed file and an uncommitted edit on line 10. */
function repoWithChange() {
  const dir = mkdtempSync(join(tmpdir(), 'ds-check-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  const lines = Array.from({ length: 30 }, (_, i) => `export const v${i + 1} = ${i + 1};`);
  writeFileSync(join(dir, 'app.ts'), lines.join('\n') + '\n');
  git('add', '.');
  git('commit', '-qm', 'base');
  lines[9] = 'export function capRate(rate: number, cap: number) { return Math.min(rate, cap); }';
  writeFileSync(join(dir, 'app.ts'), lines.join('\n') + '\n');
  mkdirSync(join(dir, '.diffstory'));
  return { dir, lines };
}

function goodStory(over = {}) {
  return {
    version: 3,
    mode: 'brief',
    title: 'Cap the funding rate',
    summary: 'One helper caps the rate before settlement.',
    base: 'main',
    intent: {
      goal: 'Rates above the market cap reached settlement.',
      design: 'Settlement already calls one per-market helper; capRate() now clamps there, so every market settles at or below its cap.',
      sources: ['conversation'],
    },
    storyArc: { changeType: 'bug-fix', shape: 'cause-effect', readingPath: 'helper -> cap' },
    steps: [{
      id: 's1', order: 1, kind: 'changed', title: 'capRate() clamps the rate at the cap',
      file: 'app.ts', range: [10, 10], viewport: [5, 15], highlights: [[10, 10]],
      why: 'Rules out a rate above the cap reaching settlement.',
      beats: [{ text: 'This is <code>capRate()</code>, the helper settlement calls per market; it clamps the rate at the cap.', highlights: [[10, 10]] }],
    }],
    ...over,
  };
}

function run(dir, ...args) {
  const r = spawnSync(process.execPath, [CHECKER, ...args], { cwd: dir, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}

function withRepo(fn) {
  const repo = repoWithChange();
  try { fn(repo); } finally { rmSync(repo.dir, { recursive: true, force: true }); }
}

test('--help prints usage and exits 0', () => {
  withRepo(({ dir }) => {
    const r = run(dir, '--help');
    assert.equal(r.code, 0);
    assert.match(r.out, /Usage: node check-story\.mjs/);
  });
});

test('a valid, fully covered story is READY', () => {
  withRepo(({ dir }) => {
    writeFileSync(join(dir, '.diffstory/story.json'), JSON.stringify(goodStory()));
    const r = run(dir);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /RESULT: READY/);
    assert.match(r.out, /coverage 1\/1 changed ranges claimed/);
  });
});

test('an unclaimed change is an error', () => {
  withRepo(({ dir, lines }) => {
    lines[24] = 'export const v25 = 2500;';
    writeFileSync(join(dir, 'app.ts'), lines.join('\n') + '\n');
    writeFileSync(join(dir, '.diffstory/story.json'), JSON.stringify(goodStory()));
    const r = run(dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /unexplained change: app\.ts 25-25/);
  });
});

test('basic contract failures stop the check early', () => {
  withRepo(({ dir }) => {
    writeFileSync(join(dir, '.diffstory/story.json'), JSON.stringify(goodStory({ storyArc: 'mixed' })));
    const r = run(dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /storyArc must be an object/);
  });
});

test('lint errors fail the check and name the rule', () => {
  withRepo(({ dir }) => {
    const story = goodStory();
    story.steps[0].why = 'Uses **bold** Markdown.';
    writeFileSync(join(dir, '.diffstory/story.json'), JSON.stringify(story));
    const r = run(dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /\[markdown-residue\]/);
  });
});

test('warnings pass by default and fail with --strict', () => {
  withRepo(({ dir }) => {
    const story = goodStory();
    story.steps[0].beats[0].text = 'The helper clamps the rate at the cap before settlement.';
    writeFileSync(join(dir, '.diffstory/story.json'), JSON.stringify(story));
    assert.equal(run(dir).code, 0);
    const strict = run(dir, '--strict');
    assert.equal(strict.code, 1);
    assert.match(strict.out, /landing-missing-symbol/);
  });
});

test('--json reports machine-readable results', () => {
  withRepo(({ dir }) => {
    writeFileSync(join(dir, '.diffstory/story.json'), JSON.stringify(goodStory()));
    const r = run(dir, '--json');
    const parsed = JSON.parse(r.out);
    assert.equal(parsed.ready, true);
    assert.equal(parsed.reports[0].story, '.diffstory/story.json');
    assert.deepEqual(parsed.reports[0].errors, []);
  });
});

test('--ledger lists every changed range with its file', () => {
  withRepo(({ dir }) => {
    const r = run(dir, '--ledger');
    assert.equal(r.code, 0);
    assert.match(r.out, /app\.ts/);
    assert.match(r.out, /10-10/);
    const json = JSON.parse(run(dir, '--ledger', '--json').out);
    assert.deepEqual(json.files[0].ranges[0].range, [10, 10]);
  });
});

test('--ledger honors includeGlobs from .diffstory/preferences.json', () => {
  withRepo(({ dir }) => {
    writeFileSync(join(dir, '.diffstory/preferences.json'), JSON.stringify({ includeGlobs: ['**/*.sol'] }));
    const json = JSON.parse(run(dir, '--ledger', '--json').out);
    assert.deepEqual(json.files, []);
  });
});

test('no story is a setup error (exit 2)', () => {
  withRepo(({ dir }) => {
    const r = run(dir);
    assert.equal(r.code, 2);
    assert.match(r.out, /no story found/);
  });
});

test('scoped stories under .diffstory/stories/ need storyScope', () => {
  withRepo(({ dir }) => {
    mkdirSync(join(dir, '.diffstory/stories'));
    writeFileSync(join(dir, '.diffstory/stories/cap.json'), JSON.stringify(goodStory()));
    const r = run(dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /need storyScope\.includedFiles/);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --test test/story-check.test.mjs`
Expected: FAIL — the bundle does not exist yet.

- [ ] **Step 3: Create `scripts/build-skill-checker.mjs`:**

```js
// Bundles the story checker (src/story-check-cli.ts and everything it imports)
// into one dependency-free file that ships inside the storyteller skill folder,
// so any agent can run `node <skill-dir>/scripts/check-story.mjs` with no
// install step. Run as part of `npm run build`.
import { build } from 'esbuild';
import { chmod, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = resolve(root, 'skills/diffstory-storyteller/scripts/check-story.mjs');

await build({
  entryPoints: [resolve(root, 'src/story-check-cli.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  legalComments: 'none',
  logLevel: 'warning',
  banner: {
    js: '#!/usr/bin/env node\n// GENERATED by scripts/build-skill-checker.mjs from src/story-check*.ts. Do not edit; run npm run build.',
  },
});
await chmod(outfile, 0o755);
console.log(`  skill checker          ${((await stat(outfile)).size / 1024).toFixed(1)} kB`);
```

- [ ] **Step 4: Wire it into the build.** In `package.json` `scripts`:

- change `"build"` to
  `"tsc && npm run build:browser-assets && npm run build:client && npm run build:skill-checker"`
- add `"build:skill-checker": "node scripts/build-skill-checker.mjs"`

Do not touch `scripts.check`, `scripts.test`, or `scripts["release:check"]`
(release-readiness pins them).

- [ ] **Step 5: Pin the bundle in release-readiness.** In
  `test/release-readiness.test.mjs`, at the end of the test named
  `'DiffStory is UI-only and distributed skills never direct users to a CLI'`, add:

```js
  // The bundled checker ships inside the skill folder and is run with node;
  // it is not an installed CLI and has no package alias.
  const checker = read('skills/diffstory-storyteller/scripts/check-story.mjs');
  assert.ok(checker.startsWith('#!/usr/bin/env node\n// GENERATED by scripts/build-skill-checker.mjs'));
  assert.doesNotMatch(read('package.json'), /check-story/);
```

(`package.json` gains `build-skill-checker`, never `check-story`, so the last
assertion holds.)

- [ ] **Step 6: Build and run**

Run: `npm run build && node --test test/story-check.test.mjs test/release-readiness.test.mjs`
Expected: PASS.

- [ ] **Step 7: Try it on this repo** (read-only):

```bash
node skills/diffstory-storyteller/scripts/check-story.mjs --help
node skills/diffstory-storyteller/scripts/check-story.mjs --ledger --base HEAD~1 --head HEAD | head -20
```

Paste both outputs into your report.

- [ ] **Step 8: Full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add src/story-check.ts src/story-check-cli.ts scripts/build-skill-checker.mjs package.json \
  skills/diffstory-storyteller/scripts/check-story.mjs test/story-check.test.mjs test/release-readiness.test.mjs \
  dist/story-check.js dist/story-check-cli.js
git status --short
git commit -m "feat: bundle a story checker and change ledger into the storyteller skill"
```

### Task 3: Keep the bundle from going stale

**Files:** Modify `test/story-check.test.mjs`

- [ ] **Step 1: Add a freshness test** (append). It rebuilds the bundle into a
  temp file and compares bytes. That way, editing `src/story-*.ts` without
  rebuilding fails the tests instead of shipping an old checker.

```js
test('the committed checker bundle matches its sources', async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'ds-bundle-')), 'check-story.mjs');
  const script = readFileSync(new URL('../scripts/build-skill-checker.mjs', import.meta.url), 'utf8');
  const banner = script.match(/js: '([^']+)'/)[1].replace(/\\n/g, '\n');
  await build({
    entryPoints: [fileURLToPath(new URL('../src/story-check-cli.ts', import.meta.url))],
    outfile: out, bundle: true, platform: 'node', format: 'esm', target: 'node20',
    legalComments: 'none', logLevel: 'silent', banner: { js: banner },
  });
  assert.equal(readFileSync(out, 'utf8'), readFileSync(CHECKER, 'utf8'), 'run npm run build and commit skills/diffstory-storyteller/scripts/check-story.mjs');
});
```

- [ ] **Step 2: Run** `npm run build && node --test test/story-check.test.mjs` — expected: PASS.
  If it fails right after a clean build, print the first two lines of both
  files and fix the banner regex in the test, not the build script.

- [ ] **Step 3: Commit**

```bash
git add test/story-check.test.mjs
git commit -m "test: fail when the bundled story checker is stale"
```
