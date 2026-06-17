# App Review-Flow Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app an honest front door — a "Your change" screen that shows your current change (pure git, no AI) with a clearly-labeled "Generate guided review" button — so opening a repo with no tour lands on that screen instead of an error page, and the agent only ever runs from an explicit click.

**Architecture:** Add one new server-rendered screen. `summarizeChange()` (pure git) describes the current change; `renderChangePage()` renders the Apple-styled screen with a scope switcher and a Generate button that streams `POST /api/generate` into a small cancelable console, navigating into the review on success. `GET /` routes repo-with-no-story to this screen instead of the error page. The picker drops its internal "tour status" pill. Everything else (folder browser, review page, agent console with Stop, generate backend, `/api/refs`) is reused.

**Tech Stack:** TypeScript (ESM, `node >= 20`), Node built-ins only. Tests: `node:test` + `node:assert/strict`, importing from compiled `dist/`. No new dependencies. `dist/` is committed (rebuild + commit it with every `src/` change).

---

## File Structure

**Create:**
- `src/change-view.ts` — `summarizeChange(repo, base?, head?)` → `ChangeSummary` (pure git: files + line counts + base label). One responsibility: describe the current change.
- `src/change-page.ts` — `renderChangePage(summary, opts)` → the "Your change" HTML screen. Self-contained, escaped, Apple-HIG, with the scope switcher + Generate console script.
- `test/change-view.test.mjs`, `test/change-page.test.mjs`, `test/change-route.test.mjs`.

**Modify:**
- `src/git.ts` — add `numstat()` (per-file +/− counts via `git diff --numstat`).
- `src/server.ts` — `GET /` routing: apply scope query params, route no-story → change page; add imports.
- `src/picker.ts` — `statusPill()` drops "Tour ready / No tour" (keeps "Missing").

**Build order:** change-view (data) → change-page (screen) → server routing → picker pill. Each ends green with a rebuilt `dist/` committed.

---

## Task 1: `summarizeChange` + `numstat`

**Files:**
- Modify: `src/git.ts`
- Create: `src/change-view.ts`, `test/change-view.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `test/change-view.test.mjs`:

```js
// Unit tests for summarizeChange (the "Your change" data). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { summarizeChange } from '../dist/change-view.js';

function repo() {
  const d = mkdtempSync(join(tmpdir(), 'ds-chg-'));
  const g = (args) => execFileSync('git', args, { cwd: d });
  g(['init', '-q']);
  g(['config', 'user.email', 't@e.st']);
  g(['config', 'user.name', 'T']);
  writeFileSync(join(d, 'a.txt'), 'one\n');
  g(['add', '.']);
  g(['commit', '-qm', 'init']);
  return d;
}

test('summarizeChange lists changed files with line counts', () => {
  const d = repo();
  writeFileSync(join(d, 'a.txt'), 'one\ntwo\n'); // uncommitted: +1 line
  try {
    const s = summarizeChange(d);
    assert.equal(s.hasChanges, true);
    assert.equal(s.totalChanged, 1);
    assert.equal(s.files[0].path, 'a.txt');
    assert.equal(s.files[0].added, 1);
    assert.equal(s.files[0].removed, 0);
    assert.equal(typeof s.baseLabel, 'string');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('summarizeChange reports no changes for a clean tree', () => {
  const d = repo();
  try {
    assert.equal(summarizeChange(d).hasChanges, false);
    assert.equal(summarizeChange(d).totalChanged, 0);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../dist/change-view.js'`.

- [ ] **Step 3: Add `numstat` to `src/git.ts`**

Add at the end of `src/git.ts` (it already has `git`/`tryGit` helpers and `DIFF_CONTEXT_LINES` import):

```ts
/**
 * Per-file added/removed line counts for the change (`git diff --numstat`).
 * Binary files report `-`/`-`, which we surface as null. Used by the change summary.
 */
export function numstat(
  repo: string,
  base: string,
  head?: string,
): Array<{ path: string; added: number | null; removed: number | null }> {
  const args = ['diff', '--numstat', '--no-color', base];
  if (head) args.push(head);
  args.push('--');
  const out = tryGit(repo, args);
  if (!out) return [];
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const added = parts[0] === '-' ? null : Number(parts[0]);
      const removed = parts[1] === '-' ? null : Number(parts[1]);
      return { path: parts.slice(2).join('\t'), added, removed };
    });
}
```

- [ ] **Step 4: Implement `src/change-view.ts`**

```ts
// The data behind the "Your change" screen: what changed, against what base.
// Pure composition over git.ts — no agent, no side effects.
import { resolveBase, describeBase, numstat } from './git.js';

export interface ChangeFile {
  path: string;
  added: number | null;
  removed: number | null;
}

export interface ChangeSummary {
  base: string;
  baseLabel: string;
  files: ChangeFile[];
  totalChanged: number;
  hasChanges: boolean;
}

/** Describe the current change. `base`/`head` override the smart default (resolveBase). */
export function summarizeChange(repo: string, base?: string, head?: string): ChangeSummary {
  const resolved = resolveBase(repo, base);
  const files = numstat(repo, resolved, head);
  return {
    base: resolved,
    baseLabel: describeBase(repo, resolved),
    files,
    totalChanged: files.length,
    hasChanges: files.length > 0,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — both new tests pass; the 50 existing tests still pass (52 total).

- [ ] **Step 6: Commit**

```bash
npm run build
git add src/git.ts src/change-view.ts test/change-view.test.mjs dist/git.js dist/change-view.js
git commit -m "feat(change): summarizeChange — the 'Your change' data (files + counts)"
```

---

## Task 2: `renderChangePage` (Screen 2)

**Files:**
- Create: `src/change-page.ts`, `test/change-page.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `test/change-page.test.mjs`:

```js
// Unit tests for the "Your change" screen renderer. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderChangePage } from '../dist/change-page.js';

const withChanges = {
  base: 'abc123',
  baseLabel: 'main (abc123)',
  files: [{ path: 'src/api.ts', added: 12, removed: 3 }],
  totalChanged: 1,
  hasChanges: true,
};

test('renderChangePage shows the change, the base label, and the Generate action', () => {
  const html = renderChangePage(withChanges, { repoName: 'demo' });
  assert.ok(html.includes('src/api.ts'));
  assert.ok(html.includes('main (abc123)'));
  assert.ok(html.includes('Generate guided review'));
  assert.ok(html.toLowerCase().includes('nothing starts until you click'));
});

test('renderChangePage escapes file paths and shows an empty-change guard', () => {
  const html = renderChangePage(
    { base: 'x', baseLabel: 'x', files: [{ path: '<script>x', added: 1, removed: 0 }], totalChanged: 1, hasChanges: true },
    { repoName: 'd' },
  );
  assert.ok(html.includes('&lt;script&gt;x'));
  assert.ok(!html.includes('<script>x'));

  const empty = renderChangePage(
    { base: 'x', baseLabel: 'main', files: [], totalChanged: 0, hasChanges: false },
    { repoName: 'd' },
  );
  assert.ok(empty.toLowerCase().includes('nothing to review'));
  assert.ok(!empty.includes('Generate guided review'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../dist/change-page.js'`.

- [ ] **Step 3: Implement `src/change-page.ts`**

```ts
// The "Your change" screen — the app's honest front door. Pure git, NO agent runs
// here. Shows the current change + a scope switcher, and a single "Generate guided
// review" button that streams POST /api/generate into a small cancelable console and
// navigates into the review on success. Self-contained; all server values escaped.
import { APP_BRAND } from './config.js';
import type { ChangeSummary } from './change-view.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function count(n: number | null, sign: string): string {
  return n == null ? '' : `<span class="${sign === '+' ? 'add' : 'del'}">${sign}${n}</span>`;
}

export function renderChangePage(sum: ChangeSummary, opts: { repoName: string; base?: string; head?: string }): string {
  const rows = sum.files
    .map(
      (f) =>
        `<div class="frow"><span class="fp" title="${esc(f.path)}">${esc(f.path)}</span>` +
        `<span class="fc">${count(f.added, '+')} ${count(f.removed, '−')}</span></div>`,
    )
    .join('');

  const action = sum.hasChanges
    ? `<button class="gen" id="genBtn" type="button" data-base="${esc(opts.base ?? '')}" data-head="${esc(opts.head ?? '')}">Generate guided review</button>
       <p class="gennote">Runs your local Claude / Codex to write the walkthrough — about a minute. Nothing starts until you click.</p>`
    : `<div class="empty">Nothing to review against ${esc(sum.baseLabel)}. Make a change, or pick another scope.</div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(APP_BRAND)} — your change</title>
<style>
:root{--bg:#f5f5f7;--elev:#fff;--label:#1d1d1f;--l2:#6e6e73;--l3:#8e8e93;--hair:rgba(0,0,0,.1);--sep:rgba(0,0,0,.08);
  --blue:#007aff;--blue2:#0067d6;--add:#1d7d3f;--del:#c4271f;--fill:rgba(120,120,128,.12);--con:#1e1e21;--cont:#e8e8ec;--conl:rgba(255,255,255,.1)}
@media (prefers-color-scheme:dark){:root{--bg:#1c1c1e;--elev:#2c2c2e;--label:#f5f5f7;--l2:#aeaeb2;--l3:#8e8e93;--hair:rgba(255,255,255,.12);
  --sep:rgba(255,255,255,.1);--blue:#0a84ff;--blue2:#3395ff;--add:#30d158;--del:#ff6961;--fill:rgba(120,120,128,.24)}}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--label);min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.wrap{max-width:680px;margin:0 auto;padding:52px 24px 72px}
h1{font-size:26px;font-weight:700;letter-spacing:-.02em;margin:0}
.what{color:var(--l2);font-size:15px;margin:10px 0 28px;line-height:1.45}
.card{background:var(--elev);border:.5px solid var(--hair);border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.04);overflow:hidden}
.scope{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:13px 15px;border-bottom:.5px solid var(--sep);font-size:13px;color:var(--l2)}
.scope b{color:var(--label);font-weight:590}
.slink{font:inherit;font-size:12.5px;color:var(--blue);background:none;border:none;cursor:pointer;padding:3px 7px;border-radius:7px;text-decoration:none}
.slink:hover{background:var(--fill)}
.cmplist{display:flex;flex-wrap:wrap;gap:4px;padding:0 15px 12px}
.cmplist a{font-size:12px;color:var(--blue);background:var(--fill);border-radius:7px;padding:3px 8px;text-decoration:none}
.files{max-height:46vh;overflow:auto}
.frow{display:flex;align-items:center;gap:10px;padding:9px 15px;border-bottom:.5px solid var(--sep);font-size:13px}
.frow:last-child{border-bottom:none}
.fp{flex:1;min-width:0;font-family:"SF Mono",ui-monospace,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fc{font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:12px;flex:none}
.add{color:var(--add)}.del{color:var(--del);margin-left:5px}
.gen{margin-top:22px;height:42px;padding:0 20px;font:inherit;font-size:15px;font-weight:600;color:#fff;background:var(--blue);border:none;border-radius:11px;cursor:pointer;box-shadow:0 1px 2px rgba(0,40,120,.18);letter-spacing:-.01em}
.gen:hover{background:var(--blue2)}.gen:active{transform:scale(.99)}.gen:disabled{opacity:.5;cursor:default}
.gennote{color:var(--l3);font-size:12.5px;margin:9px 2px 0;line-height:1.4}
.empty{padding:30px 16px;text-align:center;color:var(--l2);font-size:14px}
.gencon{margin-top:20px;background:var(--con);border:.5px solid var(--conl);border-radius:12px;overflow:hidden}
.genhd{display:flex;align-items:center;gap:9px;padding:11px 13px;border-bottom:.5px solid var(--conl);font-size:12.5px;font-weight:600;color:var(--cont)}
.genspin{width:13px;height:13px;border-radius:50%;border:2px solid var(--conl);border-top-color:var(--blue);animation:gs .7s linear infinite;flex:none}
@keyframes gs{to{transform:rotate(360deg)}}
.genstop{margin-left:auto;font:inherit;font-size:12px;font-weight:550;color:var(--cont);background:transparent;border:.5px solid var(--conl);border-radius:7px;padding:5px 11px;cursor:pointer}
.genbody{margin:0;padding:11px 13px;max-height:34vh;overflow:auto;font:11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#9a9aa3;white-space:pre-wrap;word-break:break-word}
</style></head>
<body>
<main class="wrap">
  <h1>${esc(APP_BRAND)}</h1>
  <p class="what">The agent that wrote your change walks you through it — in the order the code actually flows, not by filename.</p>
  <div class="card">
    <div class="scope">
      <span>Reviewing <b>${esc(sum.baseLabel)}</b></span>
      <span style="flex:1"></span>
      <a class="slink" href="/?scope=auto">Whole change</a>
      <a class="slink" href="/?base=HEAD">Uncommitted</a>
      <button class="slink" id="cmpBtn" type="button">Compare…</button>
    </div>
    <div class="cmplist" id="cmplist" hidden></div>
    ${sum.hasChanges ? `<div class="files">${rows}</div>` : ''}
  </div>
  ${action}
  <div class="gencon" id="gencon" hidden>
    <div class="genhd"><span class="genspin"></span><span>Writing your guided review…</span><button class="genstop" id="genstop" type="button">Stop</button></div>
    <pre class="genbody" id="genbody"></pre>
  </div>
</main>
<script>
(function(){
  var cmp=document.getElementById('cmpBtn'),cl=document.getElementById('cmplist');
  if(cmp)cmp.addEventListener('click',function(){
    if(!cl.hidden){cl.hidden=true;return;}
    cl.hidden=false;cl.textContent='Loading…';
    fetch('/api/refs').then(function(r){return r.json();}).then(function(d){
      cl.textContent='';
      (d.branches||[]).concat((d.commits||[]).map(function(c){return c.sha;})).slice(0,24).forEach(function(ref){
        var a=document.createElement('a');a.href='/?base='+encodeURIComponent(ref);a.textContent=ref;cl.appendChild(a);
      });
      if(!cl.children.length)cl.textContent='No other refs.';
    }).catch(function(){cl.textContent='Could not load refs.';});
  });
  var gen=document.getElementById('genBtn');
  if(!gen)return;
  gen.addEventListener('click',function(){
    gen.disabled=true;
    var con=document.getElementById('gencon');con.hidden=false;
    var body=document.getElementById('genbody');body.textContent='Warming up — your agent is reading the change…';
    var stop=document.getElementById('genstop');
    var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
    stop.onclick=function(){if(ctrl)ctrl.abort();};
    var hint=true,NL=String.fromCharCode(10);
    var payload={base:gen.getAttribute('data-base')||undefined,head:gen.getAttribute('data-head')||undefined};
    fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctrl?ctrl.signal:undefined})
      .then(function(r){
        if(!r.ok||!r.body){return r.json().then(function(j){body.textContent=(j&&j.error)||'Could not start.';},function(){body.textContent='Could not start.';});}
        var rd=r.body.getReader(),dec=new TextDecoder(),buf='';
        function clr(){if(hint){hint=false;body.textContent='';}}
        function pump(){return rd.read().then(function(res){
          if(res.done)return;
          buf+=dec.decode(res.value,{stream:true});var parts=buf.split(NL);buf=parts.pop();
          for(var i=0;i<parts.length;i++){var ln=parts[i];if(!ln.trim())continue;var ev;try{ev=JSON.parse(ln);}catch(e){continue;}
            if(ev.type==='text'){clr();body.textContent+=ev.data||'';}
            else if(ev.type==='tool'){clr();body.textContent+=NL+(ev.data||'')+NL;}
            else if(ev.type==='error'){clr();body.textContent+=NL+(ev.data||'');}
            else if(ev.type==='done'){if(ev.storyWritten){location.href='/';return;}}
            body.scrollTop=body.scrollHeight;}
          return pump();
        });}
        return pump();
      })
      .then(function(){ var sp=document.querySelector('.genspin'); if(sp)sp.style.display='none'; gen.disabled=false; })
      .catch(function(){
        var sp=document.querySelector('.genspin');if(sp)sp.style.display='none';
        if(ctrl&&ctrl.signal.aborted)body.textContent+=NL+'Stopped.';else body.textContent+=NL+'Something went wrong.';
        gen.disabled=false;
      });
  });
})();
</script>
</body></html>`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — the change-page tests pass (54 total).

- [ ] **Step 5: Commit**

```bash
npm run build
git add src/change-page.ts test/change-page.test.mjs dist/change-page.js
git commit -m "feat(change): the 'Your change' screen — change summary + Generate console"
```

---

## Task 3: Route `GET /` to the change screen

**Files:**
- Modify: `src/server.ts`
- Create: `test/change-route.test.mjs`

- [ ] **Step 1: Write the failing integration test**

Create `test/change-route.test.mjs`:

```js
// Integration test: opening a repo with no tour lands on the "Your change" screen
// (NOT an error page), and no agent is started. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { serve } from '../dist/server.js';

function repoWithChange() {
  const d = mkdtempSync(join(tmpdir(), 'ds-cr-'));
  const g = (a) => execFileSync('git', a, { cwd: d });
  g(['init', '-q']); g(['config', 'user.email', 't@e.st']); g(['config', 'user.name', 'T']);
  writeFileSync(join(d, 'a.txt'), 'one\n'); g(['add', '.']); g(['commit', '-qm', 'init']);
  writeFileSync(join(d, 'a.txt'), 'one\ntwo\n'); // uncommitted change, no tour
  return d;
}

async function boot() {
  const server = serve({ repo: null, port: 0, open: false });
  await once(server, 'listening');
  return { server, base: `http://localhost:${server.address().port}` };
}

test('opening a no-tour repo lands on the change screen, not an error', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = repoWithChange();
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: repo }),
    });
    const html = (await (await fetch(`${base}/`)).text());
    assert.ok(html.includes('Generate guided review'), 'shows the Generate action');
    assert.ok(html.includes('a.txt'), 'shows the changed file');
    assert.ok(!html.includes("Couldn't build the review"), 'is not the error page');
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
Expected: FAIL — `GET /` currently calls `renderReview`, which throws on the missing tour and returns the error page, so `includes('Generate guided review')` fails.

- [ ] **Step 3: Add imports to `src/server.ts`**

Add below the existing `import { renderPicker } from './picker.js';` line:

```ts
import { renderChangePage } from './change-page.js';
import { summarizeChange } from './change-view.js';
import { basename } from 'node:path';
```

- [ ] **Step 4: Replace the `GET /` handler in `src/server.ts`**

Find this block in `handle()`:

```ts
    if (method === 'GET' && url.pathname === '/') {
      if (session.repo == null) return sendHtml(res, pickerStub());
      return sendHtml(res, renderReview(session));
    }
```

Replace it with:

```ts
    if (method === 'GET' && url.pathname === '/') {
      if (session.repo == null) return sendHtml(res, pickerStub());
      applyScope(session, url.searchParams);
      if (existsSync(resolveStoryPath(session.repo))) return sendHtml(res, renderReview(session));
      return sendHtml(res, renderChange(session));
    }
```

- [ ] **Step 5: Add the `applyScope` and `renderChange` helpers to `src/server.ts`**

Add next to `pickerStub()`:

```ts
/** Apply a scope choice from the Your-change switcher (?scope=auto | ?base= | ?head=). */
function applyScope(session: Session, params: URLSearchParams): void {
  if (params.get('scope') === 'auto') {
    session.base = undefined;
    session.head = undefined;
    return;
  }
  const base = params.get('base');
  const head = params.get('head');
  if (base) session.base = base;
  if (head) session.head = head;
}

/** The "Your change" screen for a repo that has no tour yet. */
function renderChange(session: Session): string {
  const repo = session.repo as string;
  return renderChangePage(summarizeChange(repo, session.base, session.head), {
    repoName: basename(repo),
    base: session.base,
    head: session.head,
  });
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — the no-tour repo now renders the change screen; the existing app-server test (opens a repo but never re-requests `/`) is unaffected; all suites green (55 total).

- [ ] **Step 7: Manual smoke**

Run: `node dist/cli.js app --no-open --port 7788` (background it), then in another shell:
`curl -s -X POST localhost:7788/api/repo/open -H 'content-type: application/json' -d "{\"path\":\"$PWD\"}" >/dev/null && curl -s localhost:7788/ | grep -o "Generate guided review" | head -1`
Expected: prints `Generate guided review` (this repo has uncommitted changes + no committed tour). Kill the server after.

- [ ] **Step 8: Commit**

```bash
npm run build
git add src/server.ts test/change-route.test.mjs dist/server.js
git commit -m "feat(server): no-tour repo opens the 'Your change' screen, not an error"
```

---

## Task 4: Drop the tour-status pill from the picker

**Files:**
- Modify: `src/picker.ts`

- [ ] **Step 1: Replace `statusPill` in `src/picker.ts`**

Find:

```ts
function statusPill(r: RecentRow): string {
  if (!r.isGit) return `<span class="pill pill-missing">Missing</span>`;
  if (r.hasTour) return `<span class="pill pill-ready">Tour ready</span>`;
  return `<span class="pill pill-none">No tour</span>`;
}
```

Replace with:

```ts
function statusPill(r: RecentRow): string {
  // Tour status is an internal concept and confused users — don't surface it here.
  // Only flag a recent whose folder is gone / no longer a git repo.
  if (!r.isGit) return `<span class="pill pill-missing">Missing</span>`;
  return '';
}
```

- [ ] **Step 2: Build and run the suite**

Run: `npm test`
Expected: PASS — 55 total, 0 failures. The app-server test asserts the picker contains "pick a repo" / "open by path" (unaffected); no test asserts the tour pill.

- [ ] **Step 3: Manual check**

Run: `node dist/cli.js app --no-open --port 7789` (background), then `curl -s localhost:7789/ | grep -c "No tour"` → expect `0`. Kill the server.

- [ ] **Step 4: Commit**

```bash
npm run build
git add src/picker.ts dist/picker.js
git commit -m "feat(picker): drop the Tour ready / No tour pill (internal concept)"
```

---

## Self-Review

**1. Spec coverage:**

| Spec item | Task |
|---|---|
| Screen 2 "Your change" — change summary, pure git | Tasks 1, 2 |
| One-line "what is this" intro | Task 2 (`.what`) |
| Smart default base + label | Task 1 (`resolveBase`/`describeBase`) |
| Scope switcher (uncommitted / since commit / vs branch) via `/api/refs` | Task 2 (switcher) + Task 3 (`applyScope`) |
| Generate button + "nothing starts until you click" copy | Task 2 |
| Generate streams `/api/generate` into a cancelable console, navigates on success | Task 2 (`genBtn` script, `storyWritten` → `location.href='/'`) |
| Empty-change guard | Task 2 |
| Routing: no story → Screen 2 (not error); story → review | Task 3 |
| Agent never runs from opening a repo | Task 3 test (asserts no agent start; `GET /` only renders) |
| Picker drops tour pill | Task 4 |
| `dist/` rebuilt + committed each task | every task's commit step |

Out-of-scope items (multi-tour, stale-tour detection, status A/M/D badges) are intentionally excluded per the spec.

**2. Placeholder scan:** No "TBD/handle appropriately". The Generate console JS is complete; the empty-change guard is concrete.

**3. Type consistency:** `ChangeSummary` / `ChangeFile` are defined in Task 1 and consumed identically in Task 2 (`renderChangePage`) and Task 3 (`renderChange`). `numstat` returns `{path, added, removed}` used by `summarizeChange`. `renderChangePage(sum, {repoName, base?, head?})` is called with exactly that shape in Task 3. The NDJSON event contract (`text`/`tool`/`error`/`done` with `storyWritten`) matches `runGenerate` in `server.ts`. `applyScope`/`renderChange` use `session.base`/`session.head`, consistent with the `Session` type.

---

## Verification (end of plan)

- `npm test` — all suites green (existing 50 + change-view, change-page, change-route).
- Manual: `node dist/cli.js app`, open a repo where you have uncommitted changes and no committed tour → lands on the Your-change screen; click "Generate guided review" → console streams, then the review opens. Open a repo that already has a tour → goes straight to the review (regression check).
- `git status` clean; `dist/` committed.
```
