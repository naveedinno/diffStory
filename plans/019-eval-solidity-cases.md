# 019 — Eval cases from the repos stories are actually written for

> **For agentic workers:** Use superpowers:executing-plans (or
> superpowers:subagent-driven-development) to run this plan task by task.
> Steps use checkbox (`- [ ]`) syntax. Read `plans/README.md` → "Story quality
> campaign → Rules for every executor" before starting.

**Goal:** Let an eval case live in another local repository, and add two
frozen Solidity cases from `perps-core3`, where most real stories are written.
All four existing cases are TypeScript changes to diffStory itself.

**Architecture:** Cases gain an optional `repo` (absolute or `~/…`) and
`optional: true`. For an external repo, the harness makes a
`git clone --shared --no-checkout` into `.eval-worktrees/<id>` and detaches at
`head`. That reads the source repo's objects and never writes to its `.git`.
In-repo cases keep using `git worktree`, now detached at the case's `head`
instead of `HEAD`, so the files on disk match the post-change state an agent
would really see. Cases whose repo is missing on this machine are skipped
with a notice.

**Tech stack:** Node ≥ 20 ESM script (`scripts/eval-stories.mjs`), `node --test`.

**Spec:** `docs/research/story-corpus-audit-2026-09.md` (section 7, success criteria).

## Global constraints

- Never write into the external repository: no `worktree add`, no `checkout`,
  no `fetch` there. Only `clone --shared` from it, plus read-only `git diff`
  and `git show` against it.
- Frozen ranges stay immutable: `base` is always `X^`, `head` is `X`.
- Keep `excludePaths` containing `dist/*` (the shape test requires it).
- Detaching in-repo worktrees at `head` changes what the agent sees on disk.
  That is intended, and plan 021 re-baselines every case anyway. Say so in
  `eval/README.md`.

## Review focus

- A missing external repo must skip the case, not crash the run or `npm test`.
- `caseDiff` and the judge must read the diff from the case's own repo.
- Cleanup removes the clone on success, failure, and Ctrl-C (the existing
  `finally` + signal handlers call `tree.cleanup()`).

---

### Task 1: Repo-aware harness

**Files:**
- Modify: `scripts/eval-stories.mjs`
- Test: `test/eval-cases.test.mjs`

**Interfaces:**
- Produces: `export function caseRepo(c): string` (absolute path of the case's repository).

- [ ] **Step 1: Write failing tests** (append to `test/eval-cases.test.mjs`; it
  already imports from `../scripts/eval-stories.mjs` — add `caseRepo` to that
  destructuring):

```js
import { homedir } from 'node:os';
import { join } from 'node:path';

test('caseRepo resolves this repo by default and ~/ paths for external cases', () => {
  assert.equal(caseRepo({ id: 'x' }), join(fileURLToPath(new URL('.', import.meta.url)), '..'));
  assert.equal(caseRepo({ id: 'x', repo: '~/Codes/other' }), join(homedir(), 'Codes/other'));
  assert.equal(caseRepo({ id: 'x', repo: '/abs/path' }), '/abs/path');
});

test('external-repo cases are optional, because the repo is machine-specific', () => {
  for (const c of cases.filter((c) => c.repo)) {
    assert.equal(c.optional, true, `${c.id} names repo ${c.repo}, so it must set optional: true`);
  }
});
```

(Put the two `import` lines at the top of the file with the others.)

- [ ] **Step 2: Run** `node --test test/eval-cases.test.mjs` — expected: FAIL (`caseRepo` is not exported).

- [ ] **Step 3: Implement in `scripts/eval-stories.mjs`.**

Add to the imports: `import { homedir } from 'node:os';`

Replace the existing `git` and `caseDiff` functions with:

```js
/** The repository a case's refs live in: this repo unless the case names another. */
export function caseRepo(c) {
  if (!c.repo) return root;
  return c.repo.startsWith('~/') ? join(homedir(), c.repo.slice(2)) : c.repo;
}

function gitIn(cwd, ...gitArgs) {
  const r = spawnSync('git', gitArgs, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${gitArgs.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

function git(...gitArgs) {
  return gitIn(root, ...gitArgs);
}

function caseDiff(c) {
  return gitIn(caseRepo(c), 'diff', `${c.base}..${c.head}`, '--', ...(c.excludePaths ?? []).map((p) => `:(exclude)${p}`));
}
```

Replace the body of `makeWorktree(c)` with:

```js
function makeWorktree(c) {
  const path = join(root, '.eval-worktrees', c.id);
  rmSync(path, { recursive: true, force: true });
  if (c.repo) {
    // Another repository: clone it (sharing its object store, read-only)
    // instead of adding a worktree, so the harness never writes into that
    // repo's .git. Detach at the case head so files on disk are post-change.
    gitIn(root, 'clone', '--quiet', '--shared', '--no-checkout', caseRepo(c), path);
    gitIn(path, 'checkout', '--quiet', '--detach', c.head);
    return {
      path,
      storyFile: join(path, '.diffstory', 'story.json'),
      cleanup: () => rmSync(path, { recursive: true, force: true }),
    };
  }
  // A worktree killed mid-run stays registered in .git/worktrees even after its
  // directory is gone, and `worktree add` then refuses the path. Prune first so
  // an interrupted run never blocks the next one.
  git('worktree', 'prune');
  // Detached at the case head, so the files the agent reads are the
  // post-change files, as they are when an agent has just made the change.
  git('worktree', 'add', '--detach', '--quiet', path, c.head);
  return {
    path,
    storyFile: join(path, '.diffstory', 'story.json'),
    cleanup: () => {
      try {
        git('worktree', 'remove', '--force', path);
      } catch {
        rmSync(path, { recursive: true, force: true });
      }
    },
  };
}
```

Replace the `selected` computation near the top:

```js
const requested = onlyCases.length ? cases.filter((c) => onlyCases.includes(c.id)) : cases;
// External-repo cases only run on machines that have that repo.
const unavailable = requested.filter((c) => c.repo && !existsSync(caseRepo(c)));
const selected = requested.filter((c) => !unavailable.includes(c));
```

Keep the existing `if (!selected.length) { … process.exit(1); }` check, but
change its message to say which cases were skipped for a missing repo:

```js
if (!selected.length) {
  const skipped = unavailable.length ? ` (skipped for a missing repo: ${unavailable.map((c) => c.id).join(', ')})` : '';
  console.error(`No runnable cases match ${onlyCases.join(', ') || 'the case list'}${skipped}. Known: ${cases.map((c) => c.id).join(', ')}`);
  process.exit(1);
}
```

Careful: that top-level check runs when `test/eval-cases.test.mjs` imports
the module. It is only reachable if *every* case is unavailable, which cannot
happen because the in-repo cases have no `repo`.

In the main block, right after the `Cases:` log line, add:

```js
  for (const c of unavailable) console.log(`Skipping ${c.id}: ${c.repo} is not on this machine.`);
```

- [ ] **Step 4: Run** `npm run build && node --test test/eval-cases.test.mjs` — expected: PASS.
  Also run `node --check scripts/eval-stories.mjs` — expected: no output.

- [ ] **Step 5: Commit**

```bash
git add scripts/eval-stories.mjs test/eval-cases.test.mjs
git commit -m "feat: eval cases can live in another local repository"
```

### Task 2: Add two frozen Solidity cases

**Files:**
- Modify: `eval/cases.json`

- [ ] **Step 1: Confirm the refs exist on this machine** (read-only):

```bash
R=~/Codes/blockchain/symmio/perps-core3
git -C $R cat-file -e 2c4ba5fa^{commit} && git -C $R cat-file -e f1b4fe42^{commit} && echo refs-ok
git -C $R show --stat --format='%h %s' 2c4ba5fa | head -14
git -C $R show --stat --format='%h %s' f1b4fe42 | head -20
```

Expected: `refs-ok`, then "feat(gasless-layer): allow owners to withdraw
wallet funds" (10 files) and "fix(gasless): harden recovery and refine public
API" (16 files). If the repo is missing, still add the cases (they are
optional) and say in your report that they could not be verified here.

- [ ] **Step 2: Append to the `cases` array in `eval/cases.json`:**

```json
    {
      "id": "sol-feature-wallet-withdraw",
      "note": "Solidity feature, Solidity-only scope the way the user reviews: owners withdraw wallet funds from GaslessLayer (contract, interface, fee-quote library, mock). Exercises landing on unfamiliar contract code, a new external entry point, and access-control hotspots.",
      "repo": "~/Codes/blockchain/symmio/perps-core3",
      "optional": true,
      "base": "2c4ba5fa^",
      "head": "2c4ba5fa",
      "mode": "detailed",
      "excludePaths": ["dist/*", "abis/*", "docs/*", "scripts/*", "test/*"],
      "timeoutMinutes": 60
    },
    {
      "id": "sol-fix-recovery-api",
      "note": "Solidity bug-fix with its tests and deploy scripts: harden GaslessLayer recovery and refine the public API (16 files incl. interface split, fee-quote library, upgrade script, behavior tests). Exercises tests-next-to-behavior, interface/implementation pairing, and chapter seams across contract/script/test.",
      "repo": "~/Codes/blockchain/symmio/perps-core3",
      "optional": true,
      "base": "f1b4fe42^",
      "head": "f1b4fe42",
      "mode": "guided",
      "excludePaths": ["dist/*", "abis/*", "docs/*", ".env.example"],
      "timeoutMinutes": 90
    }
```

- [ ] **Step 3: Run** `node --test test/eval-cases.test.mjs` — expected: PASS.

- [ ] **Step 4: Dry-check the clone path without spending agent runs** (no
  `claude` call; this only exercises clone + diff):

```bash
node --input-type=module -e "
import { caseRepo } from './scripts/eval-stories.mjs';
import { spawnSync } from 'node:child_process';
const c = { id: 'sol-feature-wallet-withdraw', repo: '~/Codes/blockchain/symmio/perps-core3', base: '2c4ba5fa^', head: '2c4ba5fa' };
const d = spawnSync('git', ['diff', '--stat', c.base + '..' + c.head, '--', ':(exclude)abis/*', ':(exclude)docs/*', ':(exclude)scripts/*', ':(exclude)test/*'], { cwd: caseRepo(c), encoding: 'utf8' });
console.log(d.stdout);"
git -C ~/Codes/blockchain/symmio/perps-core3 worktree list
```

Expected: a stat listing only `contracts/…` files, and a `worktree list` that
is unchanged from before (the harness added nothing to that repo).

- [ ] **Step 5: Commit**

```bash
git add eval/cases.json
git commit -m "test: add two frozen Solidity eval cases from perps-core3"
```

### Task 3: Document it

**Files:** Modify `eval/README.md` (section "Adding a case")

- [ ] **Step 1:** Append to "## Adding a case":

```md
A case may live in another local repository: set `"repo"` (absolute or
`~/…`) and `"optional": true`. The harness clones it with
`git clone --shared --no-checkout` into `.eval-worktrees/<id>` and detaches at
`head`; it never writes to that repository. Cases whose repo is missing on
this machine are skipped with a notice. Since 2026-09, in-repo worktrees are
also detached at the case `head` (previously `HEAD`), so what the agent reads
on disk is the post-change code; results from before that change are not
comparable.
```

- [ ] **Step 2:** Commit: `git add eval/README.md && git commit -m "docs: explain external-repo eval cases"`
