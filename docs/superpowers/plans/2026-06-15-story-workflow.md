# Story Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename "tour" → "story", let `diffstory init` choose git-tracking, make the story replayable from a committed PR, and add `diffstory story` to generate it via the user's agent.

**Architecture:** Three thin additions over the existing zero-dep TS CLI. A filename resolver keeps old repos working. Two small new modules — `repo-setup.ts` (gitignore + skills check) and `agent.ts` (detect + run claude/codex headless) — keep the new logic isolated and unit-testable. `cli.ts` wires the new `init` behaviour and `story` command, reusing the existing `prompt.ts` selector.

**Tech Stack:** TypeScript (Node built-ins only), `node:test` for tests, `node:child_process` `spawnSync` for the agent CLIs.

---

## File structure

- `src/config.ts` — add `STORY_FILENAME`, `LEGACY_STORY_FILENAME`, `storyPath()`, `resolveStoryPath()`; drop `TOUR_FILENAME`/`tourPath`.
- `src/repo-setup.ts` *(new)* — `setGitignore(repo, mode)` and `skillsInstalled(home)`. Pure FS, no CLI deps.
- `src/agent.ts` *(new)* — `availableAgents()`, `storyPrompt(baseLabel)`, `runAgent(agent, repo, prompt)`.
- `src/cli.ts` — resolver usage; `--commit/--local/--agent/--no-serve` args; rewritten `cmdInit`; new `cmdStory`; "story" wording in help/guides.
- `src/server.ts` — load via `resolveStoryPath`.
- `src/tour.ts` — error message wording ("story").
- `examples/demo.mjs` — write `.diffstory/story.json` (+ a `base`).
- `skills/review-tour/SKILL.md` — write `story.json`, set `base`.
- `skills/address-review/SKILL.md` — `story.json` wording.
- Tests: `test/story-path.test.mjs`, `test/repo-setup.test.mjs`, `test/agent.test.mjs`.

> Internal identifiers (`TourStep`, `loadTour`, `tour` vars) stay as-is — not user-facing.

---

## Phase 1 — Rename tour → story (with fallback)

### Task 1: Filename resolver in config

**Files:**
- Modify: `src/config.ts`
- Test: `test/story-path.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// test/story-path.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storyPath, resolveStoryPath } from '../dist/config.js';

function tmpRepo() {
  const d = mkdtempSync(join(tmpdir(), 'ds-cfg-'));
  mkdirSync(join(d, '.diffstory'), { recursive: true });
  return d;
}

test('storyPath points at .diffstory/story.json', () => {
  const d = tmpRepo();
  assert.equal(storyPath(d), join(d, '.diffstory', 'story.json'));
  rmSync(d, { recursive: true, force: true });
});

test('resolveStoryPath prefers story.json', () => {
  const d = tmpRepo();
  writeFileSync(join(d, '.diffstory', 'story.json'), '{}');
  writeFileSync(join(d, '.diffstory', 'review-tour.json'), '{}');
  assert.equal(resolveStoryPath(d), join(d, '.diffstory', 'story.json'));
  rmSync(d, { recursive: true, force: true });
});

test('resolveStoryPath falls back to legacy review-tour.json', () => {
  const d = tmpRepo();
  writeFileSync(join(d, '.diffstory', 'review-tour.json'), '{}');
  assert.equal(resolveStoryPath(d), join(d, '.diffstory', 'review-tour.json'));
  rmSync(d, { recursive: true, force: true });
});

test('resolveStoryPath defaults to story.json when neither exists', () => {
  const d = tmpRepo();
  assert.equal(resolveStoryPath(d), join(d, '.diffstory', 'story.json'));
  rmSync(d, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm run build && node --test test/story-path.test.mjs`
Expected: FAIL — `storyPath`/`resolveStoryPath` not exported.

- [ ] **Step 3: Implement in `src/config.ts`**

Replace the `TOUR_FILENAME` constant and `tourPath` function. Add `existsSync` to the imports (`import { join } from 'node:path'` stays; add `import { existsSync } from 'node:fs'`).

```ts
export const STORY_FILENAME = 'story.json';
export const LEGACY_STORY_FILENAME = 'review-tour.json';

export function storyPath(repo: string): string {
  return join(repo, DATA_DIR, STORY_FILENAME);
}
export function legacyStoryPath(repo: string): string {
  return join(repo, DATA_DIR, LEGACY_STORY_FILENAME);
}
/** Path to load: story.json if present, else legacy review-tour.json, else story.json. */
export function resolveStoryPath(repo: string): string {
  const p = storyPath(repo);
  if (existsSync(p)) return p;
  const legacy = legacyStoryPath(repo);
  return existsSync(legacy) ? legacy : p;
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `node --test test/story-path.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config.ts test/story-path.test.mjs
git commit -m "feat: story.json filename resolver with review-tour.json fallback"
```

### Task 2: Point readers at the resolver

**Files:**
- Modify: `src/cli.ts` (imports line 19; `cmdServe` 58/62; `cmdCheck` 164; `cmdInit` 191), `src/server.ts` (loadReview)

- [ ] **Step 1: Update `src/cli.ts` import** — change `tourPath` to `storyPath, resolveStoryPath`:

```ts
import { APP_NAME, APP_BRAND, DATA_DIR, DEFAULT_PORT, dataDir, storyPath, resolveStoryPath } from './config.js';
```

- [ ] **Step 2: `cmdServe`** — use the resolver:

```ts
async function cmdServe(a: Args): Promise<void> {
  ensureRepo(a.dir);
  const sp = resolveStoryPath(a.dir);
  if (!existsSync(sp)) {
    printNoStoryGuide();
    return;
  }
  loadTour(sp); // validates; throws a friendly message if malformed
  const sel = await chooseDiff(a.dir, a);
  serve({ repo: a.dir, port: a.port, baseOverride: sel.base, headOverride: sel.head, open: a.open });
}
```

- [ ] **Step 3: `cmdCheck`** — line 164 `const tour = loadTour(tourPath(a.dir));` → `const tour = loadTour(resolveStoryPath(a.dir));`

- [ ] **Step 4: `cmdInit`** — line 191 `const tp = tourPath(a.dir);` → `const tp = storyPath(a.dir);` (init always writes the new name).

- [ ] **Step 5: `src/server.ts`** — in `loadReview`, `loadTour(tourPath(opts.repo))` → `loadTour(resolveStoryPath(opts.repo))`; update the import to pull `resolveStoryPath` from `./config.js` (replace `tourPath`).

- [ ] **Step 6: Build + full tests**

Run: `npm test`
Expected: PASS (all suites, including story-path).

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts src/server.ts
git commit -m "refactor: load the story via resolveStoryPath everywhere"
```

### Task 3: "Story" wording + demo + skills

**Files:**
- Modify: `src/cli.ts` (`printNoStoryGuide`, help, init next-steps, `TEMPLATE_TOUR`→`TEMPLATE_STORY`), `src/tour.ts` (error text), `examples/demo.mjs`, `skills/review-tour/SKILL.md`, `skills/address-review/SKILL.md`

- [ ] **Step 1: Rename `printNoTourGuide`→`printNoStoryGuide`** and rewrite its body to lead with the new command:

```ts
/** Shown when there's no story yet — tells the reviewer exactly how to make one. */
function printNoStoryGuide(): void {
  console.log(`
${APP_BRAND}: there's no review story in this repo yet.

Generate one with your agent in one step:

    ${APP_NAME} story

Or ask your agent directly:  Claude Code  /diffstory:review-tour   ·   Codex  $review-tour
It writes the reading plan to ${DATA_DIR}/story.json. Then run "${APP_NAME} serve" to view it.

No agent? Run "${APP_NAME} init" to scaffold a starter plan you can edit by hand.
`);
}
```

- [ ] **Step 2:** In `src/cli.ts`, replace the remaining `review-tour.json` mentions in `printHelp` (line 219, 253) with `story.json`, and add a `story` row under COMMANDS (full text added in Task 8). Rename `TEMPLATE_TOUR`→`TEMPLATE_STORY` and add `"base": "main",` after `"summary"` in the template.

- [ ] **Step 3:** `src/tour.ts` — the `loadTour` "No tour found" message → `No review story found at ${path}. Run "${APP_NAME}"...`. Keep it generic: `No review story found at ${path}.` (drop the skill reference; the CLI prints the guide).

- [ ] **Step 4:** `examples/demo.mjs` — change both `write('.diffstory/review-tour.json', TOUR)` → `write('.diffstory/story.json', TOUR)`, and add `"base": "main",` to the `TOUR` JSON after its `"summary"` line.

- [ ] **Step 5:** `skills/review-tour/SKILL.md` — replace `.diffstory/review-tour.json` with `.diffstory/story.json` throughout; add a bullet: *Set `"base"` to the ref you diffed against (e.g. the PR's target branch) so reviewers replay against the same base.*

- [ ] **Step 6:** `skills/address-review/SKILL.md` — replace `review-tour.json` with `story.json`; keep `comments.json` references.

- [ ] **Step 7: Build + demo smoke**

Run: `DIFFSTORY_DEMO_DIR=/tmp/ds-demo DIFFSTORY_DEMO_NO_SERVE=1 npm run demo`
Expected: builds, writes `/tmp/ds-demo/.diffstory/story.json`, `diffstory check` runs (exit 1 on the seeded uncovered hunk). Then `rm -rf /tmp/ds-demo`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: rename tour -> story (file, wording, demo, skills)"
```

---

## Phase 2 — `init` git-tracking + skills check + base

### Task 4: `repo-setup.ts` (gitignore + skills check)

**Files:**
- Create: `src/repo-setup.ts`
- Test: `test/repo-setup.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// test/repo-setup.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setGitignore, skillsInstalled } from '../dist/repo-setup.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'ds-rs-'));

test('local mode ignores the whole .diffstory dir', () => {
  const d = tmp();
  setGitignore(d, 'local');
  const gi = readFileSync(join(d, '.gitignore'), 'utf8');
  assert.ok(gi.includes('.diffstory/'));
  assert.ok(!gi.includes('.diffstory/comments.json'));
  rmSync(d, { recursive: true, force: true });
});

test('shared mode ignores only comments.json', () => {
  const d = tmp();
  setGitignore(d, 'shared');
  const gi = readFileSync(join(d, '.gitignore'), 'utf8');
  assert.ok(gi.includes('.diffstory/comments.json'));
  assert.ok(!/^\.diffstory\/$/m.test(gi));
  rmSync(d, { recursive: true, force: true });
});

test('switching modes is idempotent (one diffstory line)', () => {
  const d = tmp();
  writeFileSync(join(d, '.gitignore'), 'node_modules/\n');
  setGitignore(d, 'local');
  setGitignore(d, 'shared');
  setGitignore(d, 'shared');
  const gi = readFileSync(join(d, '.gitignore'), 'utf8');
  assert.equal((gi.match(/\.diffstory/g) || []).length, 1);
  assert.ok(gi.includes('node_modules/'));
  rmSync(d, { recursive: true, force: true });
});

test('skillsInstalled detects ~/.agents/skills/review-tour', () => {
  const home = tmp();
  assert.equal(skillsInstalled(home), false);
  mkdirSync(join(home, '.agents', 'skills', 'review-tour'), { recursive: true });
  writeFileSync(join(home, '.agents', 'skills', 'review-tour', 'SKILL.md'), '');
  assert.equal(skillsInstalled(home), true);
  rmSync(home, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run it, expect failure** — `node --test test/repo-setup.test.mjs` → FAIL (module missing).

- [ ] **Step 3: Implement `src/repo-setup.ts`**

```ts
// Per-repo setup: choose how .diffstory/ is tracked in git, and check the
// producer skill is installed for some agent. Pure FS; no CLI dependencies.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './config.js';

const SHARED_LINE = `${DATA_DIR}/comments.json`;
const LOCAL_LINE = `${DATA_DIR}/`;

/**
 * Edit the repo's .gitignore for the chosen tracking mode (idempotent):
 *  - 'shared': only comments.json is ignored (story.json stays tracked).
 *  - 'local' : the whole .diffstory/ dir is ignored.
 */
export function setGitignore(repo: string, mode: 'shared' | 'local'): void {
  const path = join(repo, '.gitignore');
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split('\n') : [];
  const kept = lines.filter((l) => l.trim() !== SHARED_LINE && l.trim() !== LOCAL_LINE);
  while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
  kept.push(mode === 'shared' ? SHARED_LINE : LOCAL_LINE);
  writeFileSync(path, kept.join('\n') + '\n', 'utf8');
}

/** True if the diffStory producer skill is installed for any agent. */
export function skillsInstalled(home: string): boolean {
  return (
    existsSync(join(home, '.agents', 'skills', 'review-tour', 'SKILL.md')) ||
    existsSync(join(home, '.claude', 'skills', 'review-tour', 'SKILL.md'))
  );
}
```

- [ ] **Step 4: Run the test, expect pass** — `node --test test/repo-setup.test.mjs` → PASS (4).

- [ ] **Step 5: Commit**

```bash
git add src/repo-setup.ts test/repo-setup.test.mjs
git commit -m "feat: repo-setup — gitignore tracking modes + skills check"
```

### Task 5: Wire `init`

**Files:**
- Modify: `src/cli.ts` (`Args`, `parseArgs`, `cmdInit`, imports)

- [ ] **Step 1: Add args** — in `Args` add `commit?: boolean` and `local?: boolean`; in `parseArgs` add `else if (t === '--commit') a.commit = true;` and `else if (t === '--local') a.local = true;`.

- [ ] **Step 2: Imports** — add to the cli.ts imports: `import { setGitignore, skillsInstalled } from './repo-setup.js';` and `import { homedir } from 'node:os';` and add `select, createPrompt, isInteractive` are already imported from `./prompt.js`.

- [ ] **Step 3: Rewrite `cmdInit`** (make it `async`):

```ts
async function cmdInit(a: Args): Promise<void> {
  mkdirSync(dataDir(a.dir), { recursive: true });
  const tp = storyPath(a.dir);
  if (!existsSync(tp)) {
    writeFileSync(tp, TEMPLATE_STORY, 'utf8');
    console.log(`Created ${tp}`);
  } else {
    console.log(`${tp} already exists — leaving it untouched.`);
  }

  const mode = await chooseTracking(a);
  if (mode) {
    setGitignore(a.dir, mode);
    console.log(
      mode === 'shared'
        ? `Tracking: story.json is committed (travels with your PR); comments stay local.`
        : `Tracking: ${DATA_DIR}/ is git-ignored (local only).`,
    );
  }

  if (!skillsInstalled(homedir())) {
    console.log(`\nNote: the diffStory agent skills aren't installed yet. Get them with:`);
    console.log(`  curl -fsSL https://raw.githubusercontent.com/naveedinno/diffStory/main/scripts/install.sh | sh`);
  }

  console.log(`\nNext:  ${APP_NAME} story    (generate the review with your agent, then view it)`);
}

async function chooseTracking(a: Args): Promise<'shared' | 'local' | null> {
  if (a.commit) return 'shared';
  if (a.local) return 'local';
  if (!isInteractive()) return null;
  const rl = createPrompt();
  try {
    return await select<'shared' | 'local'>(
      rl,
      `How should ${DATA_DIR}/ be tracked in git?`,
      [
        { label: 'Share via git', hint: 'commit story.json so PR reviewers can replay it', value: 'shared' },
        { label: 'Keep it local', hint: `add ${DATA_DIR}/ to .gitignore`, value: 'local' },
      ],
      0,
    );
  } finally {
    rl.close();
  }
}
```

- [ ] **Step 4: Make `main()` await init** — change `case 'init': cmdInit(args); break;` to `case 'init': await cmdInit(args); break;`.

- [ ] **Step 5: Build + manual smoke**

Run:
```bash
npm run build
node dist/cli.js init --dir /tmp/ds-init --local 2>&1 || true   # /tmp/ds-init must be a git repo
```
Setup/teardown:
```bash
rm -rf /tmp/ds-init && mkdir /tmp/ds-init && git -C /tmp/ds-init init -q
node dist/cli.js init --dir /tmp/ds-init --local
grep -q '.diffstory/' /tmp/ds-init/.gitignore && echo "local OK"
node dist/cli.js init --dir /tmp/ds-init --commit
grep -q '.diffstory/comments.json' /tmp/ds-init/.gitignore && echo "shared OK"
rm -rf /tmp/ds-init
```
Expected: prints "local OK" then "shared OK".

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts
git commit -m "feat: diffstory init asks share-via-git vs local, checks skills"
```

---

## Phase 3 — `diffstory story` (agent-driven)

### Task 6: `agent.ts` (detect + prompt + run)

**Files:**
- Create: `src/agent.ts`
- Test: `test/agent.test.mjs`

- [ ] **Step 1: Write the failing test** (pure parts only — not the real spawn)

```js
// test/agent.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onPath, storyPrompt, agentCommand } from '../dist/agent.js';

test('onPath finds sh, not a bogus command', () => {
  assert.equal(onPath('sh'), true);
  assert.equal(onPath('definitely-not-a-real-cmd-xyz'), false);
});

test('storyPrompt names the base and the output file', () => {
  const p = storyPrompt('main (abc123)');
  assert.ok(p.includes('main (abc123)'));
  assert.ok(p.includes('.diffstory/story.json'));
});

test('agentCommand builds headless invocations', () => {
  assert.deepEqual(agentCommand('claude', 'GO'), ['claude', ['-p', 'GO', '--permission-mode', 'acceptEdits']]);
  assert.deepEqual(agentCommand('codex', 'GO'), ['codex', ['exec', '--full-auto', 'GO']]);
});
```

- [ ] **Step 2: Run it, expect failure** — `node --test test/agent.test.mjs` → FAIL.

- [ ] **Step 3: Implement `src/agent.ts`**

```ts
// Detect and drive the user's coding agent (Claude Code / Codex) headlessly to
// generate the story. The spawn itself is integration-only; the pure helpers
// (onPath, storyPrompt, agentCommand) are unit-tested.
import { spawnSync } from 'node:child_process';
import { DATA_DIR } from './config.js';

export type Agent = 'claude' | 'codex';

export function onPath(cmd: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
}

export function availableAgents(): Agent[] {
  return (['claude', 'codex'] as Agent[]).filter(onPath);
}

export function storyPrompt(baseLabel: string): string {
  return (
    `Use the diffStory review-tour skill to create a review story for the current change in this repo. ` +
    `Diff against: ${baseLabel}. Write the reading plan to ${DATA_DIR}/story.json, set its "base" field ` +
    `to "${baseLabel}", and cover every changed hunk. Do not ask questions — generate it directly.`
  );
}

/** The headless command + args for an agent. Flags verified against each CLI's --help. */
export function agentCommand(agent: Agent, prompt: string): [string, string[]] {
  return agent === 'claude'
    ? ['claude', ['-p', prompt, '--permission-mode', 'acceptEdits']]
    : ['codex', ['exec', '--full-auto', prompt]];
}

/** Run the agent in `repo`, streaming its output. Returns whether it exited 0. */
export function runAgent(agent: Agent, repo: string, prompt: string): boolean {
  const [cmd, args] = agentCommand(agent, prompt);
  return spawnSync(cmd, args, { cwd: repo, stdio: 'inherit' }).status === 0;
}
```

- [ ] **Step 4: Run the test, expect pass** — `node --test test/agent.test.mjs` → PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/agent.ts test/agent.test.mjs
git commit -m "feat: agent module — detect claude/codex, build headless story command"
```

### Task 7: `story` command

**Files:**
- Modify: `src/cli.ts` (`Args`, `parseArgs`, new `cmdStory`, `main` switch, imports)

- [ ] **Step 1: Args + parse** — add `agent?: string` and `noServe?: boolean` to `Args`; in `parseArgs` add `else if (t === '--agent') a.agent = argv[++i];` and `else if (t === '--no-serve') a.noServe = true;`.

- [ ] **Step 2: Imports** — add `import { availableAgents, runAgent, storyPrompt, type Agent } from './agent.js';`

- [ ] **Step 3: Implement `cmdStory`**

```ts
async function cmdStory(a: Args): Promise<void> {
  ensureRepo(a.dir);
  const base = resolveBase(a.dir, a.base);
  const baseLabel = describeBase(a.dir, base);

  const agent = await pickAgent(a);
  if (!agent) {
    console.log(`\nNo agent CLI found (looked for "claude" and "codex").`);
    printNoStoryGuide();
    return;
  }

  console.log(`\n${APP_BRAND}: generating the story with ${agent} — base ${baseLabel}…\n`);
  console.log(`(${agent} runs with auto-approve so it can write ${DATA_DIR}/story.json)\n`);
  const ok = runAgent(agent, a.dir, storyPrompt(baseLabel));

  if (!ok || !existsSync(storyPath(a.dir))) {
    console.error(`\nCouldn't generate the story automatically.`);
    printNoStoryGuide();
    return;
  }
  console.log(`\n✓ Story written to ${storyPath(a.dir)}`);

  if (a.noServe) {
    console.log(`Run "${APP_NAME} serve" to view it.`);
    return;
  }
  serve({ repo: a.dir, port: a.port, baseOverride: a.base, headOverride: a.head, open: a.open });
}

async function pickAgent(a: Args): Promise<Agent | null> {
  if (a.agent === 'claude' || a.agent === 'codex') return a.agent;
  const found = availableAgents();
  if (found.length === 0) return null;
  if (found.length === 1) return found[0];
  if (!isInteractive()) return found[0];
  const rl = createPrompt();
  try {
    return await select<Agent>(
      rl,
      'Which agent should write the story?',
      found.map((f) => ({ label: f, value: f })),
      0,
    );
  } finally {
    rl.close();
  }
}
```

- [ ] **Step 4: Switch** — in `main`, add `case 'story': await cmdStory(args); break;`.

- [ ] **Step 5: Build + smoke (no real agent call)**

Run:
```bash
npm run build
# In a repo with no agent on PATH-ish: force the no-agent path by clearing PATH agents is hard;
# instead verify the command is wired and errors cleanly outside a git repo:
node dist/cli.js story --dir /tmp 2>&1 | head -3
```
Expected: prints the "not a git repository" error (proves the command routes through `cmdStory`/`ensureRepo`). Full agent run is verified manually in Task 9.

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts
git commit -m "feat: diffstory story — generate the story via your agent, then serve"
```

### Task 8: Help + README

**Files:**
- Modify: `src/cli.ts` (`printHelp`), `README.md`

- [ ] **Step 1:** In `printHelp`, rewrite the top WORKFLOW step 2 to lead with `${APP_NAME} story`, and add to COMMANDS:

```
  ${APP_NAME} story     Generate the story with your agent (claude/codex), then open it.
```
Add to OPTIONS: `  --agent <claude|codex>  Which agent generates the story` and `  --no-serve       (story) generate only, don't open the page`. Replace `review-tour.json` mentions with `story.json`.

- [ ] **Step 2:** `README.md` — in the loop/usage section, replace the "ask your agent … then serve" two-step with `diffstory story`, and add a short "Reviewing a teammate's PR" note: `git checkout <pr-branch> && diffstory serve`. Mention `diffstory init` choosing shared vs local.

- [ ] **Step 3: Build + help check**

Run: `npm run build && node dist/cli.js help`
Expected: shows `diffstory story` in COMMANDS, `--agent`/`--no-serve` in OPTIONS, no `review-tour.json` left.

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts README.md
git commit -m "docs: story command + reviewer-replay in help and README"
```

### Task 9: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite** — `npm test` → all green.

- [ ] **Step 2: Reviewer-replay smoke** (no agent needed):

```bash
rm -rf /tmp/ds-demo && DIFFSTORY_DEMO_DIR=/tmp/ds-demo DIFFSTORY_DEMO_NO_SERVE=1 npm run demo
test -f /tmp/ds-demo/.diffstory/story.json && echo "story.json written"
node dist/cli.js serve --dir /tmp/ds-demo --no-open --base HEAD~0 >/tmp/ds.log 2>&1 &
sleep 1; curl -s -o /dev/null -w "serve HTTP %{http_code}\n" http://localhost:7777/ ; kill %1 2>/dev/null
rm -rf /tmp/ds-demo
```
Expected: "story.json written" and "serve HTTP 200".

- [ ] **Step 3: Live `diffstory story`** (manual, real agent — run by the user/maintainer in a repo with uncommitted changes):

```bash
diffstory story --no-serve     # then: diffstory serve
```
Expected: the agent writes `.diffstory/story.json` with a `base`, and `serve` renders it.

- [ ] **Step 4: Update the installed copy + commit nothing** — `git -C ~/.diffstory/src pull` so the maintainer's CLI has the new commands.

---

## Self-review

**Spec coverage:** rename → Tasks 1–3; `init` git choice → Task 5 (+repo-setup Task 4); skills check → Task 5; base recorded → Task 3 (skill/demo) + Task 6 (prompt sets it); reviewable replay → Task 8/9; `story` command + agent detection + fallback + auto-serve → Tasks 6–7. All spec sections covered.

**Placeholders:** none — every new module and test has complete code; wiring steps show the exact edit.

**Type consistency:** `Agent` type defined in Task 6 and used in Task 7; `setGitignore(repo, 'shared'|'local')` consistent across Tasks 4–5; `storyPath`/`resolveStoryPath` defined Task 1, used Tasks 2/5/7; `agentCommand`/`runAgent`/`storyPrompt` signatures match between Task 6 definition and Task 7 use.
