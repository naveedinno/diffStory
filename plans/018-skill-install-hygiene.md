# 018 — No stale storyteller skill survives an install

> **For agentic workers:** Use superpowers:executing-plans (or
> superpowers:subagent-driven-development) to run this plan task by task.
> Steps use checkbox (`- [ ]`) syntax. Read `plans/README.md` → "Story quality
> campaign → Rules for every executor" before starting.

**Goal:** Make every install path refresh every agent's copy of the skill, and
make "is the skill current?" compare the whole skill folder. Today
`~/.codex/skills/diffstory-storyteller/SKILL.md` is a 2026-08-03 copy with no
Landing rule, and Codex writes most perps stories. `install-skills.sh` never
touches `~/.codex`, and both `skillStatus` and the eval harness compare only
`SKILL.md`. Once the skill has `references/` and `scripts/`, a stale reference
file or checker bundle would go unnoticed.

**Architecture:** A `skillDirDigest(dir)` helper in `src/repo-setup.ts` (sorted
relative paths + normalized text, SHA-256). `skillStatus` and
`scripts/eval-stories.mjs` compare digests. `install-skills.sh` refreshes any
existing Claude or Codex copy by default and gains `--codex`.

**Tech stack:** TypeScript, POSIX sh, `node --test`.

**Spec:** `docs/research/story-corpus-audit-2026-09.md` (finding 4).

## Global constraints

- `skillStatus(home, expected)` keeps its signature: `expected` is still the
  path of a `SKILL.md`; its folder is what gets digested.
- The install script never creates `~/.claude/skills` or `~/.codex/skills` on
  its own. It refreshes them only if a copy already exists there, or if you
  pass `--claude` / `--codex`.
- Verified in a scratch copy on 2026-09-25: the existing repo-setup tests
  pass unchanged with the digest, and the stale-Codex refresh works.

## Review focus

- A folder with only `SKILL.md` (every existing test) must digest-compare
  exactly as the old text comparison did.
- `.DS_Store` and CRLF line endings must not make a copy look stale.
- The install script must keep removing the retired `review-tour` and
  `address-review` folders in every target it touches.

---

### Task 1: Digest the whole skill folder

**Files:**
- Modify: `src/repo-setup.ts`
- Test: `test/repo-setup.test.mjs`

**Interfaces:**
- Produces: `export function skillDirDigest(dir: string): string` (hex SHA-256).

- [ ] **Step 1: Write failing tests.** Add `skillDirDigest` to the existing
  import from `'../dist/repo-setup.js'` at the top of `test/repo-setup.test.mjs`,
  then append:

```js
test('skillStatus compares the whole skill folder, not just SKILL.md', () => {
  const home = tmp();
  const bundleDir = join(home, 'bundle', 'diffstory-storyteller');
  const installedDir = join(home, '.claude', 'skills', 'diffstory-storyteller');
  for (const dir of [bundleDir, installedDir]) {
    mkdirSync(join(dir, 'references'), { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), 'same core');
  }
  writeFileSync(join(bundleDir, 'references', 'schema.md'), 'new schema');
  writeFileSync(join(installedDir, 'references', 'schema.md'), 'old schema');
  assert.equal(skillStatus(home, join(bundleDir, 'SKILL.md')).agents.claude.current, false);
  writeFileSync(join(installedDir, 'references', 'schema.md'), 'new schema');
  assert.equal(skillStatus(home, join(bundleDir, 'SKILL.md')).agents.claude.current, true);
  rmSync(home, { recursive: true, force: true });
});

test('skillDirDigest ignores .DS_Store and line-ending noise', () => {
  const home = tmp();
  const a = join(home, 'a');
  const b = join(home, 'b');
  mkdirSync(a);
  mkdirSync(b);
  writeFileSync(join(a, 'SKILL.md'), 'line one\nline two\n');
  writeFileSync(join(b, 'SKILL.md'), 'line one\r\nline two');
  writeFileSync(join(b, '.DS_Store'), 'junk');
  assert.equal(skillDirDigest(a), skillDirDigest(b));
  rmSync(home, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm run build && node --test test/repo-setup.test.mjs`
Expected: FAIL (`skillDirDigest` is not exported; the folder test reports `current: true`).

- [ ] **Step 3: Implement.** In `src/repo-setup.ts`:

Replace the `node:fs` import line with:

```ts
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
```

In `skillStatus`, replace the first line of the body
(`const expectedText = readNormalized(expected);`) with:

```ts
  // Compare the whole skill folder (SKILL.md, references/, scripts/), not just
  // SKILL.md: a stale reference file or checker bundle teaches the old skill too.
  const expectedDigest = existsSync(expected) ? skillDirDigest(dirname(expected)) : null;
```

and replace the `const current = …` line inside `skillRoots.map(…)` with:

```ts
    const current = installed && expectedDigest != null && skillDirDigest(dirname(path)) === expectedDigest;
```

Append at the end of the file:

```ts
/**
 * Content digest of a skill folder: every file's relative path and normalized
 * text, in sorted order. Two folders with the same digest teach the same skill.
 */
export function skillDirDigest(dir: string): string {
  const files: string[] = [];
  const walk = (rel: string) => {
    for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue;
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) files.push(child);
    }
  };
  walk('');
  const hash = createHash('sha256');
  for (const file of files.sort()) {
    hash.update(`${file}\0${readNormalized(join(dir, file)) ?? ''}\0`);
  }
  return hash.digest('hex');
}
```

- [ ] **Step 4: Build and test**

Run: `npm run build && node --test test/repo-setup.test.mjs test/app-server.test.mjs`
Expected: PASS (all existing tests unchanged, plus the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/repo-setup.ts test/repo-setup.test.mjs dist/repo-setup.js
git commit -m "fix: judge skill freshness by the whole skill folder"
```

### Task 2: The eval harness measures the whole installed folder

**Files:**
- Modify: `scripts/eval-stories.mjs` (`checkInstalledSkill`, ~line 66)

- [ ] **Step 1: Change `checkInstalledSkill`.** Keep `skillInstallState` exactly
  as it is (`test/eval-cases.test.mjs` pins it); feed it digests instead of
  SKILL.md text. Add `skillDirDigest` to the script's imports from
  `../dist/repo-setup.js` (add the import line if the script has none from that
  module), then replace the body of `checkInstalledSkill` with:

```js
function checkInstalledSkill() {
  const repoDir = join(root, 'skills', 'diffstory-storyteller');
  const target = join(process.env.HOME ?? '', '.claude', 'skills', 'diffstory-storyteller');
  const installed = existsSync(join(target, 'SKILL.md')) ? skillDirDigest(target) : null;
  const state = skillInstallState(skillDirDigest(repoDir), installed);
  if (state.ok) return;
  console.error(
    `\n✖ The installed diffstory-storyteller skill is ${state.reason}:\n` +
    `    ${target}\n` +
    `  The agent reads that copy (SKILL.md, references/, scripts/), so this run would score the wrong skill.\n` +
    `  Fix it first:  sh scripts/install-skills.sh --claude\n`,
  );
  process.exit(1);
}
```

- [ ] **Step 2: Run** `npm run build && node --test test/eval-cases.test.mjs` — expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/eval-stories.mjs
git commit -m "fix: eval refuses a stale installed skill folder, not just SKILL.md"
```

### Task 3: `install-skills.sh` refreshes every existing copy

**Files:**
- Modify: `scripts/install-skills.sh`
- Create: `test/install-skills.test.mjs`

- [ ] **Step 1: Write the failing test.** Create `test/install-skills.test.mjs`:

```js
// install-skills.sh must leave no stale storyteller copy behind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/install-skills.sh', import.meta.url));
const SKILL = fileURLToPath(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url));
const install = (home, ...args) => spawnSync('sh', [SCRIPT, ...args], { env: { ...process.env, HOME: home }, encoding: 'utf8' });

test('default install refreshes an existing stale Codex copy and creates no new agent dirs', () => {
  const home = mkdtempSync(join(tmpdir(), 'ds-install-'));
  const codex = join(home, '.codex', 'skills', 'diffstory-storyteller');
  mkdirSync(codex, { recursive: true });
  writeFileSync(join(codex, 'SKILL.md'), 'stale');
  const r = install(home);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(codex, 'SKILL.md'), 'utf8'), readFileSync(SKILL, 'utf8'));
  assert.ok(existsSync(join(home, '.agents', 'skills', 'diffstory-storyteller', 'SKILL.md')));
  assert.equal(existsSync(join(home, '.claude')), false);
  rmSync(home, { recursive: true, force: true });
});

test('--codex installs into ~/.codex/skills even when absent', () => {
  const home = mkdtempSync(join(tmpdir(), 'ds-install-'));
  assert.equal(install(home, '--codex').status, 0);
  assert.ok(existsSync(join(home, '.codex', 'skills', 'diffstory-storyteller', 'SKILL.md')));
  rmSync(home, { recursive: true, force: true });
});

test('--help documents --codex', () => {
  assert.match(install(tmpdir(), '--help').stdout, /--codex/);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --test test/install-skills.test.mjs`
Expected: FAIL (the Codex copy stays `stale`; `--codex` is an unknown argument).

- [ ] **Step 3: Edit `scripts/install-skills.sh`.**

Replace the two usage lines

```sh
#   ./scripts/install-skills.sh            Install to ~/.agents/skills (Zed Agent, Codex, Cursor, …)
#   ./scripts/install-skills.sh --claude   Also install to ~/.claude/skills (Claude Code)
```

with

```sh
#   ./scripts/install-skills.sh            Install to ~/.agents/skills, and refresh any existing
#                                          copy in ~/.claude/skills or ~/.codex/skills
#   ./scripts/install-skills.sh --claude   Also install to ~/.claude/skills (Claude Code)
#   ./scripts/install-skills.sh --codex    Also install to ~/.codex/skills (Codex CLI)
```

Change `usage() { sed -n '3,12p' …` to `usage() { sed -n '3,14p' …` (the header
grew by two lines; check that `--help` prints through the `--help` line).

After `CLAUDE=0` add `CODEX=0`. In the `case`, after `--claude) CLAUDE=1 ;;` add
`    --codex) CODEX=1 ;;`.

Replace

```sh
  install_into "$HOME/.agents/skills"
  [ "$CLAUDE" = "1" ] && install_into "$HOME/.claude/skills"
```

with

```sh
  install_into "$HOME/.agents/skills"
  # Refresh every existing copy too: an agent reads only its own directory, so a
  # stale copy left behind there keeps teaching the old skill.
  if [ "$CLAUDE" = "1" ] || [ -d "$HOME/.claude/skills/diffstory-storyteller" ]; then
    install_into "$HOME/.claude/skills"
  fi
  if [ "$CODEX" = "1" ] || [ -d "$HOME/.codex/skills/diffstory-storyteller" ]; then
    install_into "$HOME/.codex/skills"
  fi
```

And after the `~/.claude/skills  ->` echo line add:

```sh
echo "  ~/.codex/skills   ->  Codex CLI"
```

- [ ] **Step 4: Run** `node --test test/install-skills.test.mjs` — expected: PASS.
  Then `sh scripts/install-skills.sh --help` and confirm every option line prints.

- [ ] **Step 5: Commit**

```bash
git add scripts/install-skills.sh test/install-skills.test.mjs
git commit -m "fix: install-skills refreshes every existing agent copy and supports --codex"
```

### Task 4: Refresh this machine (one-time, report only)

- [ ] **Step 1:** Run `sh scripts/install-skills.sh --claude --codex`.
- [ ] **Step 2:** Confirm all three copies match the repo:

```bash
node --input-type=module -e "
import { skillDirDigest } from './dist/repo-setup.js';
const home = process.env.HOME;
const want = skillDirDigest('skills/diffstory-storyteller');
for (const d of ['.agents', '.claude', '.codex']) console.log(d, skillDirDigest(home + '/' + d + '/skills/diffstory-storyteller') === want ? 'current' : 'STALE');
"
```

Expected: three `current` lines. Paste the output into your report. (No commit.)
