# diffStory Desktop — Phase 1: Backend Shell Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the diffStory server repo-agnostic so it can run as a standalone app — boot with no repo, show a picker, open a repo at runtime, list recents, expose refs, and generate a tour on demand — all drivable in a browser before any UI or Tauri work.

**Architecture:** The server currently binds one fixed repo via a `ServeOptions` closure. We replace that with a small mutable `Session { repo, base, head }` that endpoints read and the new `/api/repo/open` and `/api/repo/close` endpoints mutate. New pure modules (`recents`, `repo-state`, `session`, an `agentPreflight` helper) hold the testable logic; the HTTP layer stays thin. A new `diffstory app` command boots the server with `repo: null`.

**Tech Stack:** TypeScript (ESM, `node >= 20`), Node built-ins only (`http`, `child_process`, `fs`). Tests: `node:test` + `node:assert/strict`, importing from compiled `dist/` (the `test` script runs `npm run build` first). No new dependencies.

---

## File Structure

**Create:**
- `src/recents.ts` — global recents store at `~/.diffstory/recents.json` (read/add/list). Pure `addRecent` + FS wrappers, `home` injectable for tests.
- `src/repo-state.ts` — `inspectRepo(repo)` → `{ path, name, isGit, hasTour, currentBranch, changedFiles }`. Composed from existing `git.ts`/`config.ts`.
- `src/session.ts` — `Session` type + `createSession`/`openSession`/`closeSession`.
- `test/recents.test.mjs`, `test/repo-state.test.mjs`, `test/session.test.mjs`, `test/agent-preflight.test.mjs`, `test/app-server.test.mjs`.

**Modify:**
- `src/agent.ts` — add the pure `agentPreflight` guard helper (reused by address + generate).
- `src/server.ts` — session-based handlers; nullable repo; new endpoints (recent/open/close/refs/generate); `serve()` returns the `http.Server` and accepts `port: 0`; picker stub at `GET /`.
- `src/cli.ts` — add the `app` command + help text.

**Build order:** recents → repo-state → session + server refactor → endpoints + integration test → agentPreflight + generate → picker stub + `app` command. Each task ends green with a commit.

---

## Task 1: Recents store

**Files:**
- Create: `src/recents.ts`
- Test: `test/recents.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `test/recents.test.mjs`:

```js
// Unit tests for the global recents store. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addRecent, loadRecents, recordRecent } from '../dist/recents.js';

test('addRecent moves an existing path to the front and dedupes', () => {
  const list = [
    { path: '/a', lastOpened: 1 },
    { path: '/b', lastOpened: 2 },
  ];
  const next = addRecent(list, '/a', 9);
  assert.deepEqual(next, [
    { path: '/a', lastOpened: 9 },
    { path: '/b', lastOpened: 2 },
  ]);
});

test('addRecent caps the list length, newest first', () => {
  let list = [];
  for (let i = 1; i <= 15; i++) list = addRecent(list, `/r${i}`, i, 12);
  assert.equal(list.length, 12);
  assert.equal(list[0].path, '/r15');
  assert.equal(list[11].path, '/r4');
});

test('loadRecents returns [] for a missing or corrupt file', () => {
  const home = mkdtempSync(join(tmpdir(), 'ds-rec-'));
  try {
    assert.deepEqual(loadRecents(home), []);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('recordRecent round-trips through a temp home', () => {
  const home = mkdtempSync(join(tmpdir(), 'ds-rec-'));
  try {
    recordRecent(home, '/x', 5);
    recordRecent(home, '/y', 6);
    const list = loadRecents(home);
    assert.equal(list[0].path, '/y');
    assert.equal(list[1].path, '/x');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../dist/recents.js'`.

- [ ] **Step 3: Implement `src/recents.ts`**

```ts
// A small global store of recently-opened repos, kept at ~/.diffstory/recents.json
// (distinct from each repo's local .diffstory/ data dir). The pure `addRecent`
// reducer is unit-tested; the FS wrappers take `home` so tests can use a temp dir.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { DATA_DIR } from './config.js';

export interface RecentEntry {
  path: string;
  lastOpened: number;
}

const DEFAULT_CAP = 12;

/** Path to the global recents file under a given home directory. */
export function recentsFile(home: string): string {
  return join(home, DATA_DIR, 'recents.json');
}

/** Pure: put `path` at the front with `now`, drop any prior copy, cap the length. */
export function addRecent(
  list: RecentEntry[],
  path: string,
  now: number,
  cap = DEFAULT_CAP,
): RecentEntry[] {
  const rest = list.filter((e) => e.path !== path);
  return [{ path, lastOpened: now }, ...rest].slice(0, cap);
}

/** Read the recents list; tolerate a missing or corrupt file by returning []. */
export function loadRecents(home: string): RecentEntry[] {
  const file = recentsFile(home);
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? (parsed as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

/** Write the recents list, creating ~/.diffstory/ if needed. */
export function saveRecents(home: string, list: RecentEntry[]): void {
  const file = recentsFile(home);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(list, null, 2), 'utf8');
}

/** Load, push `path` to the front, persist, and return the new list. */
export function recordRecent(home: string, path: string, now: number): RecentEntry[] {
  const next = addRecent(loadRecents(home), path, now);
  saveRecents(home, next);
  return next;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — the 4 recents tests pass; existing tests unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/recents.ts test/recents.test.mjs
git commit -m "feat(recents): global recently-opened-repos store"
```

---

## Task 2: Repo inspection

**Files:**
- Create: `src/repo-state.ts`
- Test: `test/repo-state.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `test/repo-state.test.mjs`:

```js
// Unit tests for inspectRepo (the per-repo summary the picker shows). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspectRepo } from '../dist/repo-state.js';

function gitRepo() {
  const d = mkdtempSync(join(tmpdir(), 'ds-state-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  execFileSync('git', ['config', 'user.email', 't@e.st'], { cwd: d });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: d });
  writeFileSync(join(d, 'README.md'), '# hi\n');
  execFileSync('git', ['add', '.'], { cwd: d });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: d });
  return d;
}

test('inspectRepo reports a non-git directory', () => {
  const d = mkdtempSync(join(tmpdir(), 'ds-state-'));
  try {
    const s = inspectRepo(d);
    assert.equal(s.isGit, false);
    assert.equal(s.hasTour, false);
    assert.equal(s.name, basename(d));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('inspectRepo detects a git repo and a present tour', () => {
  const d = gitRepo();
  try {
    let s = inspectRepo(d);
    assert.equal(s.isGit, true);
    assert.equal(s.hasTour, false);
    assert.equal(typeof s.changedFiles, 'number');

    mkdirSync(join(d, '.diffstory'), { recursive: true });
    writeFileSync(join(d, '.diffstory', 'story.json'), '{}');
    s = inspectRepo(d);
    assert.equal(s.hasTour, true);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../dist/repo-state.js'`.

- [ ] **Step 3: Implement `src/repo-state.ts`**

```ts
// The summary the picker needs for one repo: is it a git repo, does it have a
// tour, what's the branch, how many files differ from the default base. Pure
// composition over git.ts/config.ts so it's cheap to call for a recents list.
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { isGitRepo, resolveBase, getDiff, currentBranch } from './git.js';
import { parseUnifiedDiff } from './diff.js';
import { resolveStoryPath } from './config.js';

export interface RepoState {
  path: string;
  name: string;
  isGit: boolean;
  hasTour: boolean;
  currentBranch: string | null;
  changedFiles: number;
}

export function inspectRepo(repo: string): RepoState {
  const isGit = isGitRepo(repo);
  // resolveStoryPath returns the (non-existent) default path when no tour exists,
  // so existsSync is a correct presence check for either story.json or the legacy file.
  const hasTour = existsSync(resolveStoryPath(repo));
  let changedFiles = 0;
  let branch: string | null = null;
  if (isGit) {
    branch = currentBranch(repo);
    try {
      const base = resolveBase(repo);
      changedFiles = parseUnifiedDiff(getDiff(repo, base)).filter((f) => f.hunks.length).length;
    } catch {
      changedFiles = 0;
    }
  }
  return { path: repo, name: basename(repo), isGit, hasTour, currentBranch: branch, changedFiles };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — both inspectRepo tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/repo-state.ts test/repo-state.test.mjs
git commit -m "feat(repo-state): inspectRepo summary for the picker"
```

---

## Task 3: Session + server refactor

Make the server hold a mutable session instead of a fixed repo. This is the backbone change: existing endpoints now read `session.repo`/`session.base`/`session.head`, `serve()` returns the `http.Server` and accepts `port: 0`, and `GET /` returns a stub picker page when no repo is open. Existing `diffstory serve` behavior is preserved.

**Files:**
- Create: `src/session.ts`, `test/session.test.mjs`
- Modify: `src/server.ts` (full rewrite below)

- [ ] **Step 1: Write the failing session test**

Create `test/session.test.mjs`:

```js
// Unit tests for the mutable review session. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, openSession, closeSession } from '../dist/session.js';

test('createSession carries the initial repo/base/head', () => {
  const s = createSession({ repo: '/r', base: 'main', head: 'feat' });
  assert.equal(s.repo, '/r');
  assert.equal(s.base, 'main');
  assert.equal(s.head, 'feat');
});

test('openSession sets the repo and resets base/head', () => {
  const s = createSession({ repo: null, base: 'x', head: 'y' });
  openSession(s, '/new');
  assert.equal(s.repo, '/new');
  assert.equal(s.base, undefined);
  assert.equal(s.head, undefined);
});

test('closeSession clears everything', () => {
  const s = createSession({ repo: '/r', base: 'main' });
  closeSession(s);
  assert.equal(s.repo, null);
  assert.equal(s.base, undefined);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../dist/session.js'`.

- [ ] **Step 3: Implement `src/session.ts`**

```ts
// The one mutable thing the server holds: which repo is open and what to diff.
// Single-window app → one session is enough, and matches the existing
// "one agent run at a time" invariant.
export interface Session {
  repo: string | null;
  base?: string;
  head?: string;
}

export function createSession(init: { repo: string | null; base?: string; head?: string }): Session {
  return { repo: init.repo, base: init.base, head: init.head };
}

/** Open a repo: set it and clear any prior base/head selection. */
export function openSession(s: Session, repo: string): void {
  s.repo = repo;
  s.base = undefined;
  s.head = undefined;
}

/** Close the current repo, returning to the picker. */
export function closeSession(s: Session): void {
  s.repo = null;
  s.base = undefined;
  s.head = undefined;
}
```

- [ ] **Step 4: Rewrite `src/server.ts` to be session-based**

Replace the entire contents of `src/server.ts` with:

```ts
// Tiny HTTP server over Node built-ins. The page is re-rendered on every GET, so
// refreshing reflects the current diff and tour with no watch process. The repo
// is held in a mutable Session, so the same server can boot empty (app/picker
// mode) and switch repos at runtime via /api/repo/open.
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { spawn } from 'node:child_process';
import { loadTour } from './tour.js';
import { resolveBase, getDiff, describeBase, readWholeFile } from './git.js';
import { parseUnifiedDiff } from './diff.js';
import { computeCoverage } from './coverage.js';
import { renderPage, renderFullFile } from './render.js';
import { buildFullFileRows } from './view-model.js';
import {
  loadComments,
  addComment,
  deleteComment,
  setCommentStatus,
  type NewComment,
} from './comments.js';
import { resolveStoryPath, APP_NAME, APP_BRAND } from './config.js';
import type { DiffFile, Tour } from './types.js';
import { availableAgents, streamAgent, addressPrompt, type AgentEvent } from './agent.js';
import { createSession, type Session } from './session.js';

// Only one agent run at a time: concurrent runs editing the same working tree would collide.
let agentBusy = false;

export interface ServeOptions {
  repo: string | null;
  port: number;
  baseOverride?: string;
  headOverride?: string;
  open: boolean;
}

export function serve(opts: ServeOptions): Server {
  const session = createSession({
    repo: opts.repo,
    base: opts.baseOverride,
    head: opts.headOverride,
  });
  const server = createServer((req, res) => handle(req, res, session));

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${opts.port} is in use. Try: ${APP_NAME} serve --port ${opts.port + 1}`);
    } else {
      console.error(`Server error: ${err.message}`);
    }
    process.exit(1);
  });

  server.listen(opts.port, () => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : opts.port;
    const url = `http://localhost:${port}/`;
    if (session.repo == null) {
      console.log(`\n  ${APP_BRAND} app ready → ${url}`);
      console.log(`  pick a repo to review (or open one you've used before).\n`);
    } else {
      console.log(`\n  ${APP_BRAND} review ready → ${url}`);
      console.log(`  reviewing ${resolveStoryPath(session.repo)}`);
      console.log(`  comments save as you go; click "Ask agent" or "Address all open" to get replies live.\n`);
    }
    console.log(`  Ctrl-C to stop.\n`);
    if (opts.open) openBrowser(url);
  });

  return server;
}

function noRepo(res: ServerResponse): void {
  sendJson(res, 409, { error: 'No repo is open.' });
}

function handle(req: IncomingMessage, res: ServerResponse, session: Session): void {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = req.method ?? 'GET';

  try {
    if (method === 'GET' && url.pathname === '/') {
      if (session.repo == null) return sendHtml(res, pickerStub());
      return sendHtml(res, renderReview(session));
    }
    if (method === 'GET' && url.pathname === '/api/fullfile') {
      return sendHtml(res, renderFullFileResponse(session, url.searchParams.get('file') ?? ''));
    }
    if (method === 'GET' && url.pathname === '/api/comments') {
      if (!session.repo) return noRepo(res);
      return sendJson(res, 200, loadComments(session.repo));
    }
    if (method === 'POST' && url.pathname === '/api/comments') {
      if (!session.repo) return noRepo(res);
      const repo = session.repo;
      return readBody(req, (body) => {
        try {
          const input = JSON.parse(body) as NewComment;
          sendJson(res, 201, addComment(repo, input));
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
      });
    }
    if (method === 'POST' && url.pathname === '/api/address') {
      return readBody(req, (body) => runAddress(res, session, body));
    }
    if (method === 'PATCH' && url.pathname.startsWith('/api/comments/')) {
      if (!session.repo) return noRepo(res);
      const repo = session.repo;
      const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length));
      return readBody(req, (body) => {
        try {
          const { status } = JSON.parse(body || '{}') as { status?: string };
          const updated = setCommentStatus(repo, id, status ?? '');
          if (updated) sendJson(res, 200, updated);
          else sendJson(res, 404, { error: 'no such comment' });
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
      });
    }
    if (method === 'DELETE' && url.pathname.startsWith('/api/comments/')) {
      if (!session.repo) return noRepo(res);
      const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length));
      const ok = deleteComment(session.repo, id);
      res.statusCode = ok ? 204 : 404;
      res.end();
      return;
    }
    res.statusCode = 404;
    res.end('Not found');
  } catch (e) {
    sendHtml(res, errorPage((e as Error).message), 500);
  }
}

// Phase 1 placeholder; replaced by the real picker page in Task 6.
function pickerStub(): string {
  return `<!doctype html><meta charset="utf-8"><title>${APP_BRAND}</title><body><p>Pick a repo — the picker UI lands in Phase 2.</p></body>`;
}

interface ReviewData {
  tour: Tour;
  base: string;
  files: DiffFile[];
}

function loadReview(session: Session): ReviewData {
  if (!session.repo) throw new Error('No repo is open.');
  const repo = session.repo;
  const tour = loadTour(resolveStoryPath(repo));
  const base = resolveBase(repo, session.base ?? tour.base);
  const files = parseUnifiedDiff(getDiff(repo, base, session.head));
  return { tour, base, files };
}

function renderReview(session: Session): string {
  const repo = session.repo as string;
  const { tour, base, files } = loadReview(session);
  return renderPage({
    repo,
    tour,
    files,
    baseLabel: describeBase(repo, base),
    comments: loadComments(repo),
  });
}

/** The lazily-loaded "Full file" side-by-side view for one file. */
function renderFullFileResponse(session: Session, file: string): string {
  if (!session.repo) return `<div class="ds-diffnote">No repo is open.</div>`;
  if (!file) return `<div class="ds-diffnote">No file requested.</div>`;
  const repo = session.repo;
  const { tour, files } = loadReview(session);

  const allowed = new Set<string>([...files.map((f) => f.newPath), ...tour.steps.map((s) => s.file)]);
  if (!allowed.has(file)) return `<div class="ds-diffnote">That file isn't part of this change.</div>`;

  const df = files.find((f) => f.newPath === file);
  const newLines = readWholeFile(repo, file) ?? [];
  const ranges = computeCoverage(tour, files)
    .uncovered.filter((u) => u.file === file)
    .map((u) => u.range);
  const rows = buildFullFileRows(df, newLines, ranges);
  return renderFullFile(rows, { file, newFile: df?.status === 'added' });
}

/** Raw `git diff` text for the current review scope — used to detect agent code edits. */
function currentDiff(session: Session): string {
  try {
    if (!session.repo) return '';
    const repo = session.repo;
    const tour = loadTour(resolveStoryPath(repo));
    const base = resolveBase(repo, session.base ?? tour.base);
    return getDiff(repo, base, session.head);
  } catch {
    return '';
  }
}

function tailLines(s: string, n: number): string {
  return s.trimEnd().split('\n').slice(-n).join('\n');
}

/** Drive the user's agent to address review comments and stream NDJSON events. */
function runAddress(res: ServerResponse, session: Session, body: string): void {
  let input: { commentIds?: string[]; all?: boolean };
  try {
    input = JSON.parse(body || '{}');
  } catch {
    return sendJson(res, 400, { error: 'invalid JSON' });
  }
  const target: string[] | 'all' = input.all
    ? 'all'
    : Array.isArray(input.commentIds)
      ? input.commentIds
      : [];
  if (target !== 'all' && target.length === 0) {
    return sendJson(res, 400, { error: 'no comments specified' });
  }

  if (agentBusy) return sendJson(res, 409, { error: 'An agent run is already in progress.' });
  if (!session.repo) return noRepo(res);
  const agents = availableAgents();
  if (agents.length === 0) {
    return sendJson(res, 400, { error: 'No agent CLI found (looked for "claude" and "codex").' });
  }
  const agent = agents[0];
  const repo = session.repo;

  agentBusy = true;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  const before = currentDiff(session);
  const send = (e: object) => {
    try {
      res.write(JSON.stringify(e) + '\n');
    } catch {
      /* client disconnected */
    }
  };

  streamAgent(agent, repo, addressPrompt(target), (e: AgentEvent) => send(e))
    .then(({ ok, output }) => {
      const codeChanged = currentDiff(session) !== before;
      if (!ok) send({ type: 'error', data: tailLines(output, 30) });
      send({ type: 'done', ok, codeChanged });
    })
    .catch((err) => send({ type: 'error', data: String(err) }))
    .finally(() => {
      res.end();
      agentBusy = false;
    });
}

function readBody(req: IncomingMessage, done: (body: string) => void): void {
  let data = '';
  req.on('data', (chunk) => {
    data += chunk;
    if (data.length > 1_000_000) req.destroy(); // 1MB guard
  });
  req.on('end', () => done(data));
}

function sendHtml(res: ServerResponse, html: string, status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function errorPage(message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${APP_BRAND} — error</title>
<style>body{background:#0e0f13;color:#e7e8ec;font:15px/1.6 system-ui;padding:60px;max-width:70ch;margin:auto}
code{background:#16181d;padding:2px 6px;border-radius:4px}h1{color:#f85149}</style></head>
<body><h1>Couldn't build the review</h1><pre><code>${escapeText(message)}</code></pre>
<p>Fix the issue above and refresh. Most often the tour is missing or malformed — re-run <code>/review-tour</code>.</p>
</body></html>`;
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* opening the browser is best-effort */
  }
}
```

- [ ] **Step 5: Update the two existing `serve()` callers in `src/cli.ts`**

`serve()` now requires `repo: string | null`. The existing calls already pass a string, so they keep working — but confirm both call sites compile. They are in `cmdServe` (around line 79) and `cmdStory` (around line 302):

```ts
serve({ repo: a.dir, port: a.port, baseOverride: sel.base, headOverride: sel.head, open: a.open });
```

No change needed (a string satisfies `string | null`). This step is a read-only verification.

- [ ] **Step 6: Build and run the full suite**

Run: `npm test`
Expected: PASS — session tests pass; recents/repo-state/agent/coverage/diff/tour/view-model/story-path suites still pass; TypeScript compiles with no errors.

- [ ] **Step 7: Manual smoke — existing flow still works**

Run in a repo that has a tour (or this repo after `diffstory story`): `node dist/cli.js serve --no-open`
Expected: logs "review ready → http://localhost:7777/"; `curl -s localhost:7777/ | head` returns the review HTML. Ctrl-C to stop.

- [ ] **Step 8: Commit**

```bash
git add src/session.ts test/session.test.mjs src/server.ts
git commit -m "refactor(server): hold a mutable Session; nullable repo; return the http.Server"
```

---

## Task 4: Repo endpoints (recent / open / close / refs) + integration test

**Files:**
- Modify: `src/server.ts`
- Test: `test/app-server.test.mjs`

- [ ] **Step 1: Write the failing integration test**

Create `test/app-server.test.mjs`:

```js
// Integration test: boot the app server (no repo) and drive the repo endpoints
// over HTTP. Uses a temp HOME so recents never touch the real ~/.diffstory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { serve } from '../dist/server.js';

function gitRepo() {
  const d = mkdtempSync(join(tmpdir(), 'ds-app-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  execFileSync('git', ['config', 'user.email', 't@e.st'], { cwd: d });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: d });
  writeFileSync(join(d, 'README.md'), '# hi\n');
  execFileSync('git', ['add', '.'], { cwd: d });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: d });
  return d;
}

async function boot() {
  const server = serve({ repo: null, port: 0, open: false });
  await once(server, 'listening');
  const { port } = server.address();
  return { server, base: `http://localhost:${port}` };
}

test('app server drives picker → open → refs → recent → close', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = gitRepo();
  const { server, base } = await boot();
  try {
    const root = await fetch(`${base}/`);
    assert.equal(root.status, 200);
    assert.ok((await root.text()).toLowerCase().includes('pick a repo'));

    assert.equal((await fetch(`${base}/api/refs`)).status, 409);

    const opened = await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    assert.equal(opened.status, 200);
    const state = await opened.json();
    assert.equal(state.isGit, true);
    assert.equal(state.hasTour, false);

    const refs = await (await fetch(`${base}/api/refs`)).json();
    assert.ok(Array.isArray(refs.branches));
    assert.ok(Array.isArray(refs.commits));

    const recent = await (await fetch(`${base}/api/repos/recent`)).json();
    assert.ok(recent.some((r) => r.path === repo));

    assert.equal((await fetch(`${base}/api/repo/close`, { method: 'POST' })).status, 200);
    assert.equal((await fetch(`${base}/api/refs`)).status, 409);

    // opening a non-git path is rejected
    const bad = await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: tmpHome }),
    });
    assert.equal(bad.status, 400);
  } finally {
    server.close();
    process.env.HOME = realHome;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `/api/refs` returns 404 (route not implemented), so the first `409` assertion fails.

- [ ] **Step 3: Add the endpoint imports to `src/server.ts`**

Add to the existing imports near the top (after the `./git.js` import line):

```ts
import { resolveBase, getDiff, describeBase, readWholeFile, listBranches, listRecentCommits, currentBranch } from './git.js';
```

Add these new imports below the `createSession` import:

```ts
import { openSession, closeSession } from './session.js';
import { inspectRepo } from './repo-state.js';
import { recordRecent, loadRecents } from './recents.js';
import { homedir } from 'node:os';
```

- [ ] **Step 4: Add a recents-listing helper to `src/server.ts`**

Add near `pickerStub()`:

```ts
/** The recents list, each entry enriched with its current repo state for the picker. */
function listRecentRepos() {
  return loadRecents(homedir()).map((e) => ({ ...inspectRepo(e.path), lastOpened: e.lastOpened }));
}
```

- [ ] **Step 5: Add the four routes inside `handle()`**

Insert these blocks in `handle()` immediately after the `GET /` block:

```ts
    if (method === 'GET' && url.pathname === '/api/repos/recent') {
      return sendJson(res, 200, listRecentRepos());
    }
    if (method === 'POST' && url.pathname === '/api/repo/open') {
      return readBody(req, (body) => {
        let path = '';
        try {
          path = String((JSON.parse(body || '{}') as { path?: string }).path ?? '');
        } catch {
          return sendJson(res, 400, { error: 'invalid JSON' });
        }
        if (!path || !isGitRepo(path)) {
          return sendJson(res, 400, { error: 'Not a git repository.' });
        }
        openSession(session, path);
        recordRecent(homedir(), path, nowMs());
        sendJson(res, 200, inspectRepo(path));
      });
    }
    if (method === 'POST' && url.pathname === '/api/repo/close') {
      closeSession(session);
      return sendJson(res, 200, { ok: true });
    }
    if (method === 'GET' && url.pathname === '/api/refs') {
      if (!session.repo) return noRepo(res);
      return sendJson(res, 200, {
        current: currentBranch(session.repo),
        branches: listBranches(session.repo),
        commits: listRecentCommits(session.repo),
      });
    }
```

Add `isGitRepo` to the `./git.js` import list (it now reads):

```ts
import { isGitRepo, resolveBase, getDiff, describeBase, readWholeFile, listBranches, listRecentCommits, currentBranch } from './git.js';
```

Add this small clock helper next to `tailLines` (isolated so a future test can stub it):

```ts
function nowMs(): number {
  return Date.now();
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — the app-server integration test passes end to end; all prior suites stay green.

- [ ] **Step 7: Commit**

```bash
git add src/server.ts test/app-server.test.mjs
git commit -m "feat(server): repo endpoints — recent, open, close, refs"
```

---

## Task 5: agentPreflight guard + generate endpoint

Add a pure guard shared by the address and generate runs, then the streaming `/api/generate` endpoint that drives the agent to write a tour (reusing `streamAgent` + `storyPrompt`).

**Files:**
- Modify: `src/agent.ts`, `src/server.ts`
- Test: `test/agent-preflight.test.mjs`

- [ ] **Step 1: Write the failing preflight test**

Create `test/agent-preflight.test.mjs`:

```js
// Unit tests for the shared agent-run guard. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentPreflight } from '../dist/agent.js';

test('agentPreflight blocks when an agent is already running', () => {
  const r = agentPreflight({ repo: '/r', busy: true, agents: ['claude'] });
  assert.deepEqual(r, { ok: false, status: 409, error: 'An agent run is already in progress.' });
});

test('agentPreflight blocks when no repo is open', () => {
  const r = agentPreflight({ repo: null, busy: false, agents: ['claude'] });
  assert.deepEqual(r, { ok: false, status: 409, error: 'No repo is open.' });
});

test('agentPreflight blocks when no agent CLI is installed', () => {
  const r = agentPreflight({ repo: '/r', busy: false, agents: [] });
  assert.deepEqual(r, {
    ok: false,
    status: 400,
    error: 'No agent CLI found (looked for "claude" and "codex").',
  });
});

test('agentPreflight passes and returns the chosen agent', () => {
  const r = agentPreflight({ repo: '/r', busy: false, agents: ['codex', 'claude'] });
  assert.deepEqual(r, { ok: true, agent: 'codex' });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `agentPreflight` is not exported from `../dist/agent.js`.

- [ ] **Step 3: Add `agentPreflight` to `src/agent.ts`**

Append to `src/agent.ts`:

```ts
/** Result of the shared pre-run guard for any agent run (address or generate). */
export type Preflight =
  | { ok: true; agent: Agent }
  | { ok: false; status: number; error: string };

/** Guard a would-be agent run: one-at-a-time, a repo open, an agent installed. */
export function agentPreflight(a: { repo: string | null; busy: boolean; agents: Agent[] }): Preflight {
  if (a.busy) return { ok: false, status: 409, error: 'An agent run is already in progress.' };
  if (!a.repo) return { ok: false, status: 409, error: 'No repo is open.' };
  if (a.agents.length === 0) {
    return { ok: false, status: 400, error: 'No agent CLI found (looked for "claude" and "codex").' };
  }
  return { ok: true, agent: a.agents[0] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — the 4 preflight tests pass.

- [ ] **Step 5: Use `agentPreflight` in `runAddress` and add the generate imports**

In `src/server.ts`, update the agent import to include `agentPreflight`, `storyPrompt`, and `resolveStoryPath` usage. The agent import line becomes:

```ts
import { availableAgents, streamAgent, addressPrompt, storyPrompt, agentPreflight, type AgentEvent } from './agent.js';
```

Add `existsSync` to read whether the story landed after generation:

```ts
import { existsSync } from 'node:fs';
```

Replace the guard block in `runAddress` (the `if (agentBusy) … const agent = agents[0]; const repo = session.repo;` section) with:

```ts
  const pre = agentPreflight({ repo: session.repo, busy: agentBusy, agents: availableAgents() });
  if (!pre.ok) return sendJson(res, pre.status, { error: pre.error });
  const agent = pre.agent;
  const repo = session.repo as string;
```

- [ ] **Step 6: Add the streaming generate runner to `src/server.ts`**

Add next to `runAddress`:

```ts
/** Drive the agent to write a tour for the current repo, streaming NDJSON like address. */
function runGenerate(res: ServerResponse, session: Session, body: string): void {
  let input: { base?: string; head?: string } = {};
  try {
    input = JSON.parse(body || '{}');
  } catch {
    return sendJson(res, 400, { error: 'invalid JSON' });
  }

  const pre = agentPreflight({ repo: session.repo, busy: agentBusy, agents: availableAgents() });
  if (!pre.ok) return sendJson(res, pre.status, { error: pre.error });
  const agent = pre.agent;
  const repo = session.repo as string;

  session.base = input.base;
  session.head = input.head;
  const base = resolveBase(repo, input.base);

  agentBusy = true;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  const send = (e: object) => {
    try {
      res.write(JSON.stringify(e) + '\n');
    } catch {
      /* client disconnected */
    }
  };

  streamAgent(agent, repo, storyPrompt(input.base ?? base, input.head), (e: AgentEvent) => send(e))
    .then(({ ok, output }) => {
      const storyWritten = existsSync(resolveStoryPath(repo));
      if (!ok && !storyWritten) send({ type: 'error', data: tailLines(output, 30) });
      send({ type: 'done', ok: ok && storyWritten, storyWritten });
    })
    .catch((err) => send({ type: 'error', data: String(err) }))
    .finally(() => {
      res.end();
      agentBusy = false;
    });
}
```

- [ ] **Step 7: Route `POST /api/generate` inside `handle()`**

Insert after the `POST /api/address` block:

```ts
    if (method === 'POST' && url.pathname === '/api/generate') {
      return readBody(req, (body) => runGenerate(res, session, body));
    }
```

- [ ] **Step 8: Add a generate-guard assertion to the integration test**

In `test/app-server.test.mjs`, before `server.close()` in the `try` block, add:

```ts
    // generate without a repo open → 409 (no spawn)
    const gen = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(gen.status, 409);
```

This runs after the `close` above, so no repo is open and the guard returns 409 without launching an agent — deterministic regardless of whether `claude`/`codex` is installed.

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS — preflight tests pass, address still works through the shared guard, the generate guard assertion passes.

- [ ] **Step 10: Commit**

```bash
git add src/agent.ts test/agent-preflight.test.mjs src/server.ts test/app-server.test.mjs
git commit -m "feat(server): /api/generate streams a tour run; shared agentPreflight guard"
```

---

## Task 6: Picker stub page + `diffstory app` command

Give `GET /` a real (if minimal) page that lists recents and can open a repo, and add the `diffstory app` command that boots the server with no repo. The polished Apple-HIG picker is Phase 2 — this stub just makes the whole flow drivable from a browser.

**Files:**
- Create: `src/picker.ts`
- Modify: `src/server.ts`, `src/cli.ts`
- Test: `test/app-server.test.mjs` (extend root assertion)

- [ ] **Step 1: Implement `src/picker.ts`**

```ts
// Phase-1 picker page: a dependency-free, self-contained stub that lists recent
// repos and lets you open one by path. Phase 2 replaces this with the real,
// Apple-HIG styled front door. All dynamic text is escaped server-side.
import { APP_BRAND } from './config.js';

interface RecentRow {
  path: string;
  name: string;
  hasTour: boolean;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderPickerStub(recents: RecentRow[]): string {
  const rows = recents.length
    ? recents
        .map(
          (r) =>
            `<li><button data-open="${esc(r.path)}">${esc(r.name)}</button> ` +
            `<small>${esc(r.path)}${r.hasTour ? ' · has tour' : ' · no tour'}</small></li>`,
        )
        .join('')
    : '<li><em>No recent repos yet.</em></li>';

  return `<!doctype html><html><head><meta charset="utf-8"><title>${APP_BRAND}</title>
<style>body{font:15px/1.6 system-ui;max-width:60ch;margin:60px auto;padding:0 16px}
h1{font-size:20px}ul{list-style:none;padding:0}li{margin:8px 0}button{cursor:pointer}
small{color:#666}input{width:60%}</style></head>
<body>
<h1>${APP_BRAND} — pick a repo</h1>
<p>Open a repo to review (the full picker UI arrives in Phase 2).</p>
<h2>Recent</h2>
<ul id="recent">${rows}</ul>
<h2>Open by path</h2>
<input id="path" placeholder="/absolute/path/to/repo" />
<button id="openBtn">Open</button>
<p id="msg"></p>
<script>
async function open(path){
  const msg=document.getElementById('msg'); msg.textContent='Opening…';
  const r=await fetch('/api/repo/open',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path})});
  if(r.ok){ location.href='/'; } else { const e=await r.json().catch(()=>({})); msg.textContent=e.error||'Could not open that path.'; }
}
document.getElementById('recent').addEventListener('click',(e)=>{
  const b=e.target.closest('button[data-open]'); if(b) open(b.getAttribute('data-open'));
});
document.getElementById('openBtn').addEventListener('click',()=>open(document.getElementById('path').value.trim()));
</script>
</body></html>`;
}
```

- [ ] **Step 2: Wire the picker into `src/server.ts`**

Add the import beside the other render imports:

```ts
import { renderPickerStub } from './picker.js';
```

Replace the placeholder `pickerStub()` function body so it renders from recents:

```ts
function pickerStub(): string {
  return renderPickerStub(loadRecents(homedir()).map((e) => {
    const s = inspectRepo(e.path);
    return { path: s.path, name: s.name, hasTour: s.hasTour };
  }));
}
```

- [ ] **Step 3: Update the integration test's root assertion**

In `test/app-server.test.mjs`, change the root-body assertion to match the real stub copy:

```ts
    const rootText = (await root.text()).toLowerCase();
    assert.ok(rootText.includes('pick a repo'));
    assert.ok(rootText.includes('open by path'));
```

- [ ] **Step 4: Run the test to verify the page renders**

Run: `npm test`
Expected: PASS — root returns the stub containing "pick a repo" and "open by path".

- [ ] **Step 5: Add the `app` command to `src/cli.ts`**

Add a `cmdApp` function (near `cmdServe`, around line 70):

```ts
async function cmdApp(a: Args): Promise<void> {
  // App mode: boot the server with no repo — the picker chooses one at runtime.
  serve({ repo: null, port: a.port, open: a.open });
}
```

Add the dispatch case in `main()` (next to the other cases):

```ts
      case 'app':
        await cmdApp(args);
        break;
```

- [ ] **Step 6: Add `app` to the help text in `src/cli.ts`**

In `printHelp()`, in the `COMMANDS` block, add a line above the `story` line:

```ts
  ${APP_NAME} app       Open the standalone app — pick a repo, then review (no repo needed up front).
```

- [ ] **Step 7: Build and manual-smoke the `app` command**

Run: `npm run build && node dist/cli.js app --no-open`
Expected: logs "diffStory app ready → http://localhost:7777/". In another shell: `curl -s localhost:7777/ | grep -i "pick a repo"` returns the heading. `curl -s -X POST localhost:7777/api/repo/open -H 'content-type: application/json' -d "{\"path\":\"$PWD\"}"` returns this repo's state JSON. Ctrl-C to stop.

- [ ] **Step 8: Commit**

```bash
git add src/picker.ts src/server.ts src/cli.ts test/app-server.test.mjs
git commit -m "feat(app): diffstory app command + picker stub page"
```

---

## Self-Review

**1. Spec coverage** (against `2026-06-16-diffstory-desktop-design.md`, Layer 1):

| Spec item | Task |
|---|---|
| `Session { repo, base?, head? }` mutable model | Task 3 |
| `diffstory app` command, no repo required | Task 6 |
| `GET /` → picker when no repo, else review | Tasks 3, 6 |
| `GET /api/repos/recent` with `{path, hasTour, …}` | Task 4 |
| `POST /api/repo/open` (validate, set session, recents) | Task 4 |
| `POST /api/repo/close` | Task 4 |
| `GET /api/refs` (branches/commits/current) | Task 4 |
| `POST /api/generate` (stream, single-flight, reuse storyPrompt) | Task 5 |
| Existing endpoints read from session | Task 3 |
| Recents persistence at `~/.diffstory/recents.json` | Task 1 |
| Generation reuses `streamAgent` + `storyPrompt` | Task 5 |
| Single-flight guards generate + address | Task 5 (`agentPreflight`) |
| No-agent path returns a clear error | Task 5 |

Layers 2 (picker UI) and 3 (Tauri) are out of scope for this plan by design — they are separate plans.

**2. Placeholder scan:** No "TBD/TODO/handle appropriately". The `pickerStub` is an intentional, named Phase-1 stub, replaced with real code in Task 6 — not a placeholder.

**3. Type consistency:** `Session` shape is identical across `session.ts`, `server.ts`, and tests. `agentPreflight` returns `{ ok, agent }` / `{ ok, status, error }` and is consumed identically in `runAddress` and `runGenerate`. `inspectRepo`'s `RepoState` is the shape returned by `/api/repo/open` and (spread with `lastOpened`) by `/api/repos/recent`. `serve()` returns `http.Server` and is awaited via the `'listening'` event in the integration test. NDJSON event shape (`{type:'text'|'tool'|'error'|'done'}`) matches the existing address contract and the client parser in `render.ts`.

---

## Verification (end of phase)

- `npm test` — all suites green (existing + recents, repo-state, session, agent-preflight, app-server).
- Manual: `node dist/cli.js app --no-open`, open `http://localhost:7777/`, open this repo by path, confirm it either renders the review (if a tour exists) or the error page pointing to `/review-tour` (if not).
- Manual: `node dist/cli.js serve --no-open` still works unchanged (regression check).

## Out of scope (later phases)

- **Phase 2:** the real Apple-HIG picker UI (repo detail screen, base picker fed by `/api/refs`, the in-app Generate panel reusing the agent console shell).
- **Phase 3:** Tauri shell — spawn `node dist/cli.js app`, native folder dialog → `/api/repo/open`, package to `.app`/`.dmg`.
