# Comments in the All-files view — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let reviewers leave line comments in the All-files view (Full-file and Diff sub-modes), with each comment anchored to `(file, line)` and cross-surfaced into every view that shows that line.

**Architecture:** Demote the comment's `step` field to optional so a comment is fundamentally a `(file, line)` annotation. Emit `data-file`/`data-line` + the `+` button in the two All-files row renderers, key thread placement by `(file, line)`, and add an idempotent client `mountThreads` that injects each comment into any view where its line appears.

**Tech Stack:** TypeScript → `dist/` via `tsc`; Node built-in test runner (`node --test test/*.test.mjs`). Renderers are pure string builders; the panel/page client is a string-built browser script.

## Global Constraints

- **Always rebuild and commit `dist/`** with every `src/` change in the same commit — github installs have no build step. Build: `npm run build`.
- **New tests go in NEW files only.** `test/render-page.test.mjs` and `test/change-route.test.mjs` carry unrelated uncommitted WIP — do NOT add to or `git add` them (a stage would sweep the WIP into the commit). Node globs `test/*.test.mjs`, so new files are picked up by `npm test`.
- A comment's identity is `(file, line)`; `step` is an optional Story-view placement hint only. The agent / `/address-review` flow acts on `file:line` and must stay untouched.
- Apple/dark review-UI look is unchanged; reuse existing classes (`.ds-addcomment`, `.ds-thread`, `.ds-comment`, `.ds-row`, `.ds-urow`).
- Commentable-line policy: Full-file → every line present in the file (`newNo` defined); Diff (unified) → new-side lines only (`type !== 'del'`); Story → unchanged.

---

### Task 1: Make `step` optional in the comment model

**Files:**
- Modify: `src/types.ts` (the `Comment` interface, ~line 71-85)
- Modify: `src/comments.ts` (`NewComment` interface line 28-34; `addComment` line 37-60)
- Test: `test/comments.test.mjs` (NEW file)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Comment.step?: string`; `NewComment.step?: string`; `addComment` succeeds with no `step` and stores the key only when a non-empty `step` is given.

- [ ] **Step 1: Write the failing test** — create `test/comments.test.mjs`:

```js
// Unit tests for the comment store. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addComment, loadComments } from '../dist/comments.js';

function tmpRepo() { return mkdtempSync(join(tmpdir(), 'cmt-')); }

test('addComment persists a comment with no step (All-files annotation)', () => {
  const repo = tmpRepo();
  try {
    const c = addComment(repo, { file: 'a.ts', line: 12, type: 'change', body: 'hi' });
    assert.equal(c.file, 'a.ts');
    assert.equal(c.line, 12);
    assert.equal(c.status, 'open');
    assert.ok(!('step' in c), 'step should be absent when not provided');
    const all = loadComments(repo);
    assert.equal(all.length, 1);
    assert.ok(!('step' in all[0]));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('addComment keeps step when provided (Story annotation)', () => {
  const repo = tmpRepo();
  try {
    const c = addComment(repo, { step: 's1', file: 'a.ts', line: 3, type: 'nit', body: 'x' });
    assert.equal(c.step, 's1');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('addComment ignores an empty step string', () => {
  const repo = tmpRepo();
  try {
    const c = addComment(repo, { step: '', file: 'a.ts', line: 1, type: 'change', body: 'x' });
    assert.ok(!('step' in c));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('addComment still requires file and a non-empty body', () => {
  const repo = tmpRepo();
  try {
    assert.throws(() => addComment(repo, { file: '', line: 1, type: 'change', body: 'x' }), /file/);
    assert.throws(() => addComment(repo, { file: 'a.ts', line: 1, type: 'change', body: '  ' }), /body/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && node --test test/comments.test.mjs`
Expected: FAIL — the no-step and empty-step cases throw `comment step is required`.

- [ ] **Step 3: Make `step` optional in `src/types.ts`**

Change the `Comment` interface `step` field (line 73-74) from:

```ts
  /** Step the comment was left on (anchors it even if line numbers drift). */
  step: string;
```

to:

```ts
  /** Optional Story-view placement hint; absent for comments left in the All-files view. A comment is anchored by (file, line). */
  step?: string;
```

- [ ] **Step 4: Make `step` optional in `src/comments.ts`**

Change `NewComment` (line 28-34) so `step` is optional:

```ts
export interface NewComment {
  step?: string;
  file: string;
  line: number;
  type: string;
  body: string;
}
```

Replace `addComment` (line 37-60) with — drop the step-required throw, build the comment without `step`, then attach `step` only when a non-empty string is given:

```ts
/** Validate + persist a new comment. Returns the stored comment or throws. */
export function addComment(repo: string, input: NewComment): Comment {
  if (!input || typeof input.body !== 'string' || !input.body.trim()) {
    throw new Error('comment body is required');
  }
  if (typeof input.file !== 'string' || !input.file) throw new Error('comment file is required');
  const type = TYPES.includes(input.type as CommentType) ? (input.type as CommentType) : 'change';

  const comment: Comment = {
    id: nextId(),
    file: input.file,
    line: Number.isFinite(input.line) ? Math.trunc(input.line) : 0,
    type,
    body: input.body.trim(),
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  if (typeof input.step === 'string' && input.step) comment.step = input.step;

  const comments = loadComments(repo);
  comments.push(comment);
  saveComments(repo, comments);
  return comment;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run build && node --test test/comments.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full suite, then commit**

Run: `npm test`
Expected: all green.

```bash
git add src/types.ts dist/types.js src/comments.ts dist/comments.js test/comments.test.mjs
git commit -m "feat(comments): make step optional — a comment is a (file,line) annotation"
```

(If `dist/types.js` is unchanged because the edit was type-only, just omit it from the `git add` — types erase at compile time.)

---

### Task 2: Emit commentable rows in the All-files renderers; key threads by (file, line)

**Files:**
- Modify: `src/render.ts` — `threadFor` (line 586-590), `sbsRow` thread callsite (line 528), `unifiedRow` (line 691-699) + its two callsites (line 660 in `filePanel`, line 739 in `trustCard`), `fullRow` (line 781-784) + `renderFullFile` body (line 777)
- Test: `test/comments-render.test.mjs` (NEW file)

**Interfaces:**
- Consumes: `Comment.file`/`Comment.line` (Task 1).
- Produces: `unifiedRow(row, file)` and `fullRow(row, file)` now take a `file` argument; commentable rows carry `data-file`/`data-line` + a `.ds-addcomment` button; `threadFor(file, line, comments)` filters by `(file, line)`.

- [ ] **Step 1: Write the failing test** — create `test/comments-render.test.mjs`:

```js
// Comments rendering across views. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPage, renderFullFile } from '../dist/render.js';

const tour = {
  version: 1, title: 't', summary: 's',
  steps: [{ id: 's1', order: 1, title: 'c', file: 'a.ts', range: [1, 2], kind: 'changed',
            why: 'I changed this so the next helper receives the value it needs.' }],
};
const files = [{
  oldPath: 'a.ts', newPath: 'a.ts', status: 'modified',
  hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: [
    { type: 'del', content: 'old', oldNo: 1 },
    { type: 'add', content: 'new1', newNo: 1 },
    { type: 'add', content: 'new2', newNo: 2 },
  ] }],
}];

test('renderFullFile makes every current-file line commentable', () => {
  const rows = [
    { type: 'ctx', oldNo: 1, newNo: 1, content: 'line one' },
    { type: 'add', newNo: 2, content: 'line two' },
  ];
  const html = renderFullFile(rows, { file: 'a.ts', newFile: false });
  assert.match(html, /data-file="a\.ts" data-line="1"/);
  assert.match(html, /data-file="a\.ts" data-line="2"/);
  assert.match(html, /ds-addcomment/);
});

test('all-files diff rows are commentable on the new side, not on deletions', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /ds-urow ds-row-add[^>]*data-file="a\.ts" data-line="1"/);
  assert.match(html, /data-line="2"/);
  // A pure deletion row must not be commentable (no anchor attribute) in any view.
  assert.doesNotMatch(html, /ds-row-del[^>]*data-file=/);
});

test('a comment renders by (file,line) with no step (cross-surfaced into Story)', () => {
  const comments = [{ id: 'c1', file: 'a.ts', line: 1, type: 'change',
                      body: 'NEEDS_FIX_HERE', status: 'open', createdAt: '2026-01-01T00:00:00Z' }];
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments });
  assert.match(html, /NEEDS_FIX_HERE/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && node --test test/comments-render.test.mjs`
Expected: FAIL — full-file rows have no `data-line`/`ds-addcomment`; the unified add row has no anchor; the no-step comment doesn't render (thread keyed by step).

- [ ] **Step 3: Key `threadFor` by (file, line)**

Replace `threadFor` (line 586-590):

```ts
function threadFor(file: string, line: number, comments: Comment[]): string {
  const here = comments.filter((c) => c.file === file && c.line === line);
  if (!here.length) return '';
  return `<div class="ds-thread">${here.map(commentHtml).join('')}</div>`;
}
```

Update its caller in `sbsRow` (line 528) from `threadFor(s.id, row.newNo!, comments)` to:

```ts
  const thread = commentable ? threadFor(s.file, row.newNo!, comments) : '';
```

- [ ] **Step 4: Make `fullRow` emit commentable anchors**

Replace `fullRow` (line 781-784):

```ts
function fullRow(row: SbsRow, file: string): string {
  const cells = `${cell('left', row)}<span class="ds-celldiv"></span>${cell('right', row)}`;
  const commentable = row.newNo !== undefined;
  const attrs = commentable ? ` data-file="${esc(file)}" data-line="${row.newNo}"` : '';
  const plus = commentable ? '<button class="ds-addcomment" title="Comment on this line">+</button>' : '';
  return `<div class="ds-row ds-row-${row.type}"${attrs}>${cells}${plus}</div>`;
}
```

Update `renderFullFile`'s body line (line 777) to pass the file:

```ts
  const body = rows.map((r) => fullRow(r, opts.file)).join('');
```

- [ ] **Step 5: Make `unifiedRow` emit commentable anchors**

Replace `unifiedRow` (line 691-699):

```ts
function unifiedRow(row: UnifiedRow, file: string): string {
  const sign = row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' ';
  const flag = row.untoured ? '<span class="ds-untoured-tag">UNEXPLAINED</span>' : '';
  const commentable = row.type !== 'del' && row.no !== undefined;
  const attrs = commentable ? ` data-file="${esc(file)}" data-line="${row.no}"` : '';
  const plus = commentable ? '<button class="ds-addcomment" title="Comment on this line">+</button>' : '';
  return `<div class="ds-urow ds-row-${row.type}${row.untoured ? ' is-untoured' : ''}"${attrs}><span class="ds-no">${
    row.no ?? ''
  }</span><span class="ds-sign ds-sign-${row.type}">${sign}</span><span class="ds-code">${
    highlight(row.content) || ' '
  }</span>${flag}${plus}</div>`;
}
```

Update both `unifiedRow` callsites to pass the file:
- In `filePanel` (line 660), `hunk.map(unifiedRow).join('')` → `hunk.map((r) => unifiedRow(r, f.file)).join('')`.
- In `trustCard` (line 739), `u.rows.map(unifiedRow).join('')` → `u.rows.map((r) => unifiedRow(r, u.file)).join('')`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run build && node --test test/comments-render.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 7: Run the full suite, then commit**

Run: `npm test`
Expected: all green (existing render-page tests still pass — the Story `+`/attrs are unchanged; only thread keying moved from step to file, which is equivalent for single-step files).

```bash
git add src/render.ts dist/render.js test/comments-render.test.mjs
git commit -m "feat(render): commentable rows in All-files views; key threads by (file,line)"
```

---

### Task 3: Client — mount threads by (file,line), cross-surface, recognize `.ds-urow`

**Files:**
- Modify: `src/page-assets.ts` — `patchComment` (line 1271-1278), `refreshComments` (line 1279-1284), `loadFull` (line 1158-1162), `buildComposer` submit (line 1208-1215), `deleteComment` (line 1239+), the `+` click handler (line 1351), and add `mountThreads`/`syncThreads`/`allComments` near `threadAfter` (line 1167); add an init `refreshComments()` call
- Test: `test/comments-client.test.mjs` (NEW file)

**Interfaces:**
- Consumes: commentable rows with `data-file`/`data-line` (Task 2); the relaxed `POST /api/comments` (Task 1).
- Produces: client behavior only — no exported API change. `PAGE_JS` gains `mountThreads`, `syncThreads`, `allComments`; the `+` handler accepts `.ds-urow`.

- [ ] **Step 1: Write the failing test** — create `test/comments-client.test.mjs`:

```js
// The review-page client wiring for cross-view comments. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_JS } from '../dist/page-assets.js';

test('client defines thread mounting and a comment cache', () => {
  assert.match(PAGE_JS, /function mountThreads\(/);
  assert.match(PAGE_JS, /function syncThreads\(/);
  assert.match(PAGE_JS, /var allComments\s*=/);
});

test('the + handler accepts All-files unified rows', () => {
  assert.match(PAGE_JS, /closest\(t,'\.ds-row,\.ds-urow'\)/);
});

test('refreshComments caches the list and re-syncs threads', () => {
  // The fetch(API) handler stores the list into allComments and calls syncThreads.
  assert.match(PAGE_JS, /allComments\s*=\s*list/);
  assert.match(PAGE_JS, /syncThreads\(\)/);
});

test('a freshly loaded full file gets its threads mounted', () => {
  assert.match(PAGE_JS, /mountThreads\(fullInner\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && node --test test/comments-client.test.mjs`
Expected: FAIL — none of `mountThreads`, the `.ds-urow` selector, or the cache exist yet.

- [ ] **Step 3: Add `allComments` + `mountThreads` + `syncThreads`**

In `src/page-assets.ts`, immediately after `threadAfter` (ends line 1171), insert:

```js
  var allComments=[];
  function mountThreads(scope){
    if(!scope)return;
    var rows=$all('[data-line]',scope);
    for(var i=0;i<rows.length;i++){
      var row=rows[i],file=row.getAttribute('data-file'),line=row.getAttribute('data-line');
      if(!file||line==null)continue;
      for(var j=0;j<allComments.length;j++){
        var c=allComments[j];
        if(c.file!==file||String(c.line)!==String(line))continue;
        var th=threadAfter(row);
        if(!$('.ds-comment[data-comment-id="'+c.id+'"]',th))th.appendChild(buildComment(c));
      }
    }
  }
  function syncThreads(){ mountThreads(document); }
```

`mountThreads` is idempotent (it skips a comment already shown by id), so running it over `document` — which includes the server-rendered Story threads — never duplicates.

- [ ] **Step 4: Cache the list and sync in `refreshComments`**

Replace `refreshComments` (line 1279-1284):

```js
  function refreshComments(){
    fetch(API).then(function(r){return r.json();}).then(function(list){
      if(Array.isArray(list)){allComments=list;list.forEach(patchComment);}
      syncThreads();
      refreshCount();
    }).catch(function(){});
  }
```

- [ ] **Step 5: Make `patchComment` update every copy of a comment**

Replace `patchComment` (line 1271-1278) so resolve/reply updates reach cross-surfaced duplicates — iterate all matching wraps instead of the first:

```js
  function patchComment(c){
    var wraps=$all('.ds-comment[data-comment-id="'+c.id+'"]');
    for(var i=0;i<wraps.length;i++){
      var wrap=wraps[i];
      wrap.setAttribute('data-status',c.status);wrap.className='ds-comment status-'+c.status;
      var sb=$('.ds-statusbadge',wrap);if(sb){sb.textContent='';sb.appendChild(el('span','ds-dot'));sb.appendChild(document.createTextNode(STATUS[c.status]||'Open'));}
      if(c.reply){wrap.setAttribute('data-hasreply','1');ensureReply(wrap,c.reply);}
      var rb=$('[data-resolve]',wrap);if(rb)rb.textContent=c.status==='resolved'?'Reopen':'Resolve';
      var snd=$('[data-send]',wrap);if(snd)snd.style.display=(c.status==='resolved')?'none':'';
    }
  }
```

- [ ] **Step 6: Mount threads after a full file loads**

In `loadFull` (line 1158-1162), add a `mountThreads` call after injecting the HTML. Replace the `.then` body:

```js
    fetch('/api/fullfile?file='+encodeURIComponent(file)).then(function(r){return r.text();}).then(function(html){fullInner.innerHTML=html;mountThreads(fullInner);}).catch(function(){fullInner.removeAttribute('data-loaded');fullInner.innerHTML='<div class="ds-diffnote">Could not load the full file.</div>';});
```

- [ ] **Step 7: Cross-surface a newly added comment**

In `buildComposer`'s submit success (line 1211-1214), push to the cache and re-sync so the new comment appears in every view showing that line. Replace the `.then(function(c){...})` body:

```js
        .then(function(c){
          if(!c||!c.id){submit.disabled=false;return;}
          allComments.push(c);removeComposer(box);syncThreads();refreshCount();sendToAgent([c.id]);
        }).catch(function(){submit.disabled=false;});
```

(`syncThreads` mounts the new comment on the authored row and any other view showing it; the explicit `threadAfter(row).appendChild` is dropped — `syncThreads` covers it.)

- [ ] **Step 8: Remove every copy on delete**

Replace `deleteComment` (line 1239-1246) so a delete drops the comment from the cache and removes all DOM copies (cross-surfaced duplicates), cleaning up now-empty threads:

```js
  function deleteComment(wrap){
    if(!wrap)return;var id=wrap.getAttribute('data-comment-id');
    fetch(API+'/'+encodeURIComponent(id),{method:'DELETE'}).then(function(){
      allComments=allComments.filter(function(x){return x.id!==id;});
      $all('.ds-comment[data-comment-id="'+id+'"]').forEach(function(n){
        var th=n.parentNode;
        if(n.parentNode)n.parentNode.removeChild(n);
        if(th&&th.classList&&th.classList.contains('ds-thread')&&!th.children.length&&th.parentNode)th.parentNode.removeChild(th);
      });
      refreshCount();
    }).catch(function(){});
  }
```

- [ ] **Step 9: Teach the `+` handler about `.ds-urow`**

In the global click handler (line 1351), change:

```js
    b=closest(t,'.ds-addcomment');if(b){var row=closest(t,'.ds-row');if(row)openComposer(row);return;}
```

to:

```js
    b=closest(t,'.ds-addcomment');if(b){var row=closest(t,'.ds-row,.ds-urow');if(row)openComposer(row);return;}
```

`openComposer`/`buildComposer` already work on any row with `data-line`; `buildComposer` reads `data-step` which is absent in All-files rows, and the relaxed server (Task 1) accepts the resulting `step:null`.

- [ ] **Step 10: Populate the cache on initial load**

The page renders Story threads server-side, but the comment cache and the All-files Diff rows need an initial sync. The review-page IIFE has an `init()` that runs on load (wired at the bottom: `if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);`). Inside `init()` there is a `refreshCount();` call (around line 1445). Add a `refreshComments();` call right after it:

```js
    refreshCount();
    refreshComments();
```

`refreshComments` populates `allComments` and calls `syncThreads()`, so the All-files Diff rows (and any pre-existing comments) mount on load. (`refreshCount` stays — `refreshComments` also calls it, but the extra call is idempotent and keeps the diff minimal.)

- [ ] **Step 11: Run tests to verify they pass**

Run: `npm run build && node --test test/comments-client.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 12: Run the full suite, then commit**

Run: `npm test`
Expected: all green.

```bash
git add src/page-assets.ts dist/page-assets.js test/comments-client.test.mjs
git commit -m "feat(review): comment in All-files — mount threads by (file,line), cross-surfaced"
```

---

## Manual verification (after Task 3)

Tests cover the string builders and the model; the live cross-view behavior needs a real run. Launch the app (`npm run dev` or the `run` skill) on a repo with a change, open a generated review, then:

- In **All files → Full file**, hover any line → a `+` appears → click it → composer opens → submit. The comment appears inline.
- Switch that file to **Diff** and to the **Story** view — the same comment shows on that line (cross-surfaced), once.
- Resolve it in one view → the badge updates in the other. Delete it → it disappears from both.
- Confirm `comments.json` holds the All-files comment with `file`+`line` and no `step`.

## Self-review notes

- **Spec coverage:** optional `step` (T1) ✓; All-files commentable rows in Full-file + Diff (T2 fullRow/unifiedRow) ✓; thread keying by (file,line) for cross-surfacing (T2 threadFor/sbsRow + T3 mountThreads) ✓; client mount/`.ds-urow`/composer step-null (T3) ✓; server no-logic-change (addComment already called by the route) ✓; dist rebuilt per task ✓.
- **WIP safety:** all three new tests are new files; no edit to `render-page.test.mjs`/`change-route.test.mjs`.
- **Type consistency:** `unifiedRow(row, file)` and `fullRow(row, file)` signatures updated at every callsite (filePanel, trustCard, renderFullFile); `threadFor(file, line, comments)` updated at its sole caller `sbsRow`; `Comment.step?`/`NewComment.step?` consumed consistently by `addComment` and the renderers (which read `c.file`/`c.line`, never `c.step` for placement).
