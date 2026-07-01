# Add-comment vs Ask-now Send Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the reviewer explicit control over when the agent runs — an "Add" button that saves a comment/message without triggering the agent, an "Ask now" button that saves and runs immediately, and a visible "Send all (N)" button to fire every queued comment in one pass.

**Architecture:** Purely a client + server-render change; no API changes. Both composers (`buildComposer`, `buildThreadComposer` in the client, and their `commentHtml` counterpart) get two buttons. "Add" simply skips the client's follow-up `sendToAgent` call. "Send all (N)" surfaces the existing `sendToAgent('all')` batch path as a visible, counted button in the review header.

**Tech Stack:** TypeScript → `tsc` → `dist/`; Node's built-in test runner; a zero-dependency HTTP server; a hand-rolled client script embedded as the `PAGE_JS`/`PAGE_CSS` strings in `src/page-assets.ts`; server HTML in `src/render.ts`.

## Global Constraints

- **Tests import compiled output** from `../dist/*.js`, so every red/green step is `npm run build && node --test test/<file>.test.mjs`. There is no way to test `src/` directly.
- **Commit `dist/` with `src/`** (github installs have no build step). Each task's commit stages the specific rebuilt `dist/*.js` it changed. The working tree is currently CLEAN, so stage only the task's own files — do not `git add -A`.
- **No server/API changes.** `POST /api/comments`, `POST /api/comments/:id/message`, and `POST /api/address` already exist and behave correctly; "Add" = save and stop, "Ask now"/"Send all" = save then call the agent.
- **Interaction rules:** Enter in the chat box = Ask now (Shift+Enter = newline). "Add" is an explicit button click. Empty text sends nothing.
- **Client test convention:** `test/comments-client.test.mjs` asserts on `PAGE_JS`/`PAGE_CSS` *source substrings* — match that style.
- **UI:** reuse existing button classes (`ds-ghost` for secondary, `ds-btn ds-btn-solid` for primary) and CSS variables; no new design language.

---

### Task 1: Thread chat composer — Add + Ask now

Split the thread chat box's single "Send" into "Add" (save only) + "Ask now" (save + run), in both the client (`buildThreadComposer`) and the server render (`commentHtml`), and thread a `run` flag through `sendThreadMessage`.

**Files:**
- Modify: `src/page-assets.ts` (`buildThreadComposer`, `sendThreadMessage`, `setBusy`, the click delegation, the Enter keydown handler)
- Modify: `src/render.ts` (`commentHtml`'s `.ds-thread-composer` block)
- Test: `test/comments-client.test.mjs`, `test/comments-render.test.mjs`

**Interfaces:**
- Consumes: existing `sendToAgent(ids)`, `patchComment`, `refreshCount`, `toast`, `allComments`, `API`, `agentBusy`, `closest`, `el`, `$`, `$all`, `BRAND`.
- Produces: `sendThreadMessage(wrap, run)` — POSTs the message; only calls `sendToAgent([id])` when `run` is truthy. Thread composer emits a `[data-thread-add]` button (Add) and the existing `[data-thread-send]` button (relabeled "Ask now").

- [ ] **Step 1: Write the failing client tests**

Add to `test/comments-client.test.mjs`:

```js
test('the thread composer offers Add (save only) and Ask now (save + run)', () => {
  assert.match(PAGE_JS, /function buildThreadComposer\(/);
  assert.match(PAGE_JS, /data-thread-add/);
  assert.match(PAGE_JS, /'Ask now'/);
  // sendThreadMessage gates the agent run on the `run` flag:
  assert.match(PAGE_JS, /function sendThreadMessage\(wrap,run\)/);
  assert.match(PAGE_JS, /if\(run\)sendToAgent\(\[id\]\)/);
  // delegation: Add => run=false, Ask now => run=true
  assert.match(PAGE_JS, /\[data-thread-add\]'\);if\(b\)\{sendThreadMessage\(closest\(b,'\.ds-comment'\),false\)/);
  assert.match(PAGE_JS, /\[data-thread-send\]'\);if\(b\)\{sendThreadMessage\(closest\(b,'\.ds-comment'\),true\)/);
  // Enter sends via the run path
  assert.match(PAGE_JS, /sendThreadMessage\(closest\(ta,'\.ds-comment'\),true\)/);
});
```

- [ ] **Step 2: Write the failing render test**

Add to `test/comments-render.test.mjs`:

```js
test('server-rendered thread composer has Add and Ask now buttons', () => {
  const html = commentHtml({
    id: 'c9', file: 'a.ts', line: 1, type: 'question',
    body: 'q?', status: 'open', createdAt: '2026-01-01T00:00:00Z',
  });
  assert.match(html, /data-thread-add/);
  assert.match(html, /data-thread-send/);
  assert.match(html, />Ask now</);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run build && node --test test/comments-client.test.mjs test/comments-render.test.mjs`
Expected: FAIL — `data-thread-add` absent; `sendThreadMessage(wrap,run)` signature not present; "Ask now" not present.

- [ ] **Step 4: Update `buildThreadComposer` (client)**

In `src/page-assets.ts`, replace `buildThreadComposer` with:

```js
  function buildThreadComposer(c){
    var box=el('div','ds-thread-composer');
    var ta=el('textarea','ds-thread-ta');ta.placeholder='Reply to '+BRAND+'…';ta.rows=1;
    ta.setAttribute('data-thread-ta','');
    var add=el('button','ds-ghost ds-thread-add','Add');
    add.setAttribute('data-thread-add','');add.title='Save without sending to the agent';
    var send=el('button','ds-btn ds-btn-solid ds-thread-send','Ask now');
    send.setAttribute('data-thread-send','');
    if(agentBusy){ta.disabled=true;send.disabled=true;add.disabled=true;}
    box.appendChild(ta);box.appendChild(add);box.appendChild(send);
    return box;
  }
```

- [ ] **Step 5: Refactor `sendThreadMessage` to take `run`**

In `src/page-assets.ts`, change the signature and gate the agent run:

```js
  function sendThreadMessage(wrap,run){
    if(!wrap)return;
    var id=wrap.getAttribute('data-comment-id');
    var ta=$('[data-thread-ta]',wrap);if(!ta)return;
    var text=ta.value.trim();if(!text)return;
    if(run&&agentBusy){toast('The agent is already working; wait for it to finish.');return;}
    ta.value='';
    fetch(API+'/'+encodeURIComponent(id)+'/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text})})
      .then(function(r){if(!r.ok)throw 0;return r.json();})
      .then(function(updated){
        var found=false;
        for(var i=0;i<allComments.length;i++){if(allComments[i].id===id){allComments[i]=updated;found=true;break;}}
        if(!found)allComments.push(updated);
        patchComment(updated);refreshCount();
        if(run)sendToAgent([id]);
      }).catch(function(){toast('Could not send your message.');});
  }
```

- [ ] **Step 6: Update the click delegation and Enter handler**

In `src/page-assets.ts`, find the existing delegation line:

```js
    b=closest(t,'[data-thread-send]');if(b){sendThreadMessage(closest(b,'.ds-comment'));return;}
```

Replace it with the two-mode routing:

```js
    b=closest(t,'[data-thread-add]');if(b){sendThreadMessage(closest(b,'.ds-comment'),false);return;}
    b=closest(t,'[data-thread-send]');if(b){sendThreadMessage(closest(b,'.ds-comment'),true);return;}
```

In the Enter keydown listener, change the call from `sendThreadMessage(closest(ta,'.ds-comment'))` to:

```js
      e.preventDefault();sendThreadMessage(closest(ta,'.ds-comment'),true);
```

- [ ] **Step 7: Disable Add in `setBusy`**

In `src/page-assets.ts`, in `setBusy`, after the existing `$all('[data-thread-send]')...` line add:

```js
    $all('[data-thread-add]').forEach(function(s){s.disabled=b;});
```

- [ ] **Step 8: Update the server-rendered composer**

In `src/render.ts`, in `commentHtml`, replace the `.ds-thread-composer` block:

```ts
      <div class="ds-thread-composer">
        <textarea class="ds-thread-ta" data-thread-ta placeholder="Reply to ${esc(APP_BRAND)}…" rows="1"></textarea>
        <button class="ds-ghost ds-thread-add" data-thread-add title="Save without sending to the agent">Add</button>
        <button class="ds-btn ds-btn-solid ds-thread-send" data-thread-send>Ask now</button>
      </div>
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm run build && node --test test/comments-client.test.mjs test/comments-render.test.mjs`
Expected: PASS. If a pre-existing test asserted the old thread button text (`>Send<` in the composer), update it to `>Ask now<`.

- [ ] **Step 10: Commit**

```bash
git add src/page-assets.ts dist/page-assets.js src/render.ts dist/render.js test/comments-client.test.mjs test/comments-render.test.mjs
git commit -m "feat: thread chat box offers Add (save) and Ask now (save + run)"
```

---

### Task 2: New-comment composer — Add comment + Ask now

Split the selection composer's single "Send" into "Add comment" (save only) and "Ask now" (save + run), so a reviewer can stack comments without firing the agent.

**Files:**
- Modify: `src/page-assets.ts` (`buildComposer`)
- Test: `test/comments-client.test.mjs`

**Interfaces:**
- Consumes: existing `sendToAgent`, `allComments`, `removeComposer`, `syncThreads`, `refreshCount`, `API`, `el`, `$all`.
- Produces: the new-comment composer emits an "Add comment" (`ds-composer-add`) button and an "Ask now" button; a shared `submitComment(run)` inner helper POSTs the comment and calls `sendToAgent([c.id])` only when `run` is truthy.

- [ ] **Step 1: Write the failing test**

Add to `test/comments-client.test.mjs`:

```js
test('the new-comment composer offers Add comment (save only) and Ask now', () => {
  assert.match(PAGE_JS, /function buildComposer\(/);
  assert.match(PAGE_JS, /ds-composer-add/);
  assert.match(PAGE_JS, /'Add comment'/);
  assert.match(PAGE_JS, /'Ask now'/);
  // shared helper gates the run on a flag; Add => false, Ask now => true
  assert.match(PAGE_JS, /function submitComment\(run\)/);
  assert.match(PAGE_JS, /if\(run\)sendToAgent\(\[c\.id\]\)/);
  assert.match(PAGE_JS, /submitComment\(false\)/);
  assert.match(PAGE_JS, /submitComment\(true\)/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build && node --test test/comments-client.test.mjs`
Expected: FAIL — `submitComment` / `ds-composer-add` / "Add comment" absent.

- [ ] **Step 3: Rewrite the composer's action bar**

In `src/page-assets.ts`, in `buildComposer`, replace the block that builds `submit` and its `onclick` (from `var submit=el('button','ds-btn ds-btn-solid','Send');` through the `bar.appendChild(cancel);bar.appendChild(submit);` line) with:

```js
    function submitComment(run){
      var body=ta.value.trim();if(!body)return;
      add.disabled=true;ask.disabled=true;
      fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:file,line:Number(line),side:side,step:step,type:state.flavor,body:body,selectedText:selectedText,selection:ctx.selection})})
        .then(function(r){return r.json();}).then(function(c){
          if(!c||!c.id){add.disabled=false;ask.disabled=false;return;}
          allComments.push(c);removeComposer(box);syncThreads();refreshCount();
          if(run)sendToAgent([c.id]);
        }).catch(function(){add.disabled=false;ask.disabled=false;});
    }
    var add=el('button','ds-ghost ds-composer-add','Add comment');
    add.title='Save without sending to the agent';
    add.onclick=function(){submitComment(false);};
    var ask=el('button','ds-btn ds-btn-solid','Ask now');
    ask.onclick=function(){submitComment(true);};
    bar.appendChild(cancel);bar.appendChild(add);bar.appendChild(ask);
```

(The `cancel` button declaration directly above stays as-is; `add`/`ask` are declared here after `submitComment` so their `disabled` toggles are in scope.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run build && node --test test/comments-client.test.mjs`
Expected: PASS. If a pre-existing test asserted the composer's old `'Send'` button, update it to `'Ask now'`.

- [ ] **Step 5: Commit**

```bash
git add src/page-assets.ts dist/page-assets.js test/comments-client.test.mjs
git commit -m "feat: new-comment composer offers Add comment (save) and Ask now"
```

---

### Task 3: Visible "Send all (N)" batch button

Surface the existing `sendToAgent('all')` batch path as a visible, live-counted button in the review header, next to the open-comments count.

**Files:**
- Modify: `src/render.ts` (the `.ds-status` header block — add the button)
- Modify: `src/page-assets.ts` (click delegation, `refreshCount`, `setBusy`, `PAGE_CSS`)
- Test: `test/comments-render.test.mjs`, `test/comments-client.test.mjs`

**Interfaces:**
- Consumes: existing `sendToAgent('all')`, `collectOpenIds`, `refreshCount`, `setBusy`, `openCount` (server render), `$`, `$all`, `closest`.
- Produces: a `#ds-send-all` button carrying `data-send-all`, label `Send all (<b>N</b>)`, hidden when N === 0; clicking runs `sendToAgent('all')`.

- [ ] **Step 1: Write the failing render test**

Add to `test/comments-render.test.mjs` (the existing `tour`/`files` fixtures at the top of the file plus one open comment give `openCount = 1`):

```js
test('review header shows a Send all button when there are open comments', () => {
  const comments = [{ id: 'c1', file: 'a.ts', line: 1, type: 'change',
    body: 'x', status: 'open', createdAt: '2026-01-01T00:00:00Z' }];
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments });
  assert.match(html, /data-send-all/);
  assert.match(html, /Send all/);
});
```

- [ ] **Step 2: Write the failing client test**

Add to `test/comments-client.test.mjs`:

```js
test('the Send all button runs the batch and tracks the open count', () => {
  // click delegation fires the existing batch path
  assert.match(PAGE_JS, /\[data-send-all\]'\);if\(b\)\{if\(b\.disabled\)return;sendToAgent\('all'\)/);
  // refreshCount updates the counted label + hidden state
  assert.match(PAGE_JS, /ds-send-all/);
  assert.match(PAGE_JS, /sa\.hidden=openN===0/);
  // setBusy disables it during a run
  assert.match(PAGE_JS, /\[data-send-all\]'\)/);
  assert.match(PAGE_CSS, /\.ds-send-all/);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run build && node --test test/comments-render.test.mjs test/comments-client.test.mjs`
Expected: FAIL — `data-send-all` absent from render and client.

- [ ] **Step 4: Add the button to the server header**

In `src/render.ts`, in the `.ds-status` block, immediately after the `</span>` that closes the `#ds-open-count` span (and before `${trustPill}`), add:

```ts
    <button class="ds-btn ds-btn-solid ds-send-all" id="ds-send-all" data-send-all title="Send every open comment to the agent in one run"${openCount ? '' : ' hidden'}>Send all (<b>${openCount}</b>)</button>
```

- [ ] **Step 5: Wire the click delegation (client)**

In `src/page-assets.ts`, next to the existing `[data-address-all]` delegation line, add:

```js
    b=closest(t,'[data-send-all]');if(b){if(b.disabled)return;sendToAgent('all');return;}
```

- [ ] **Step 6: Update `refreshCount` and `setBusy` (client)**

In `src/page-assets.ts`, in `refreshCount`, after the `#ds-open-count` update line add:

```js
    var sa=$('#ds-send-all');if(sa){var sab=$('b',sa);if(sab)sab.textContent=openN;sa.hidden=openN===0;if(!agentBusy)sa.disabled=openN===0;}
```

In `setBusy`, after the `[data-address-all]` line add:

```js
    var sall=$('[data-send-all]');if(sall)sall.disabled=b||collectOpenIds().length===0;
```

- [ ] **Step 7: Add CSS**

In `src/page-assets.ts` `PAGE_CSS`, near the `.ds-open` rule add:

```css
.ds-send-all{padding:8px 12px;font-size:12px}
.ds-send-all b{font-variant-numeric:tabular-nums;font-weight:700}
.ds-send-all[hidden]{display:none}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run build && node --test test/comments-render.test.mjs test/comments-client.test.mjs`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/render.ts dist/render.js src/page-assets.ts dist/page-assets.js test/comments-render.test.mjs test/comments-client.test.mjs
git commit -m "feat: visible Send all (N) button surfaces the batch send"
```

---

### Task 4: Full suite + final verification

Confirm the whole feature holds together and nothing regressed.

**Files:** none new — verification only.

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: PASS for every `test/*.test.mjs`. If a previously-passing test broke because it asserted an old single-button label (e.g. a composer `'Send'` button, or a header snapshot), fix the expectation to match the new Add/Ask-now/Send-all markup and re-run until green.

- [ ] **Step 2: Confirm dist is in sync and the tree is clean**

Run: `git status --short`
Expected: empty (all `dist/` rebuilt output committed with its `src/`, nothing stray). If `git status` shows uncommitted `dist/*.js`, the build drifted — rebuild, and `git add` + commit the specific dist files with message `chore: rebuild dist`.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Run: `npm run build && node dist/cli.js` (open the printed URL). Leave a comment with **Add comment** and confirm no agent run starts and the header shows **Send all (1)**; add another, confirm it reads **Send all (2)**; click **Send all** and confirm one agent run addresses both. In a thread, type and hit **Add** (no run), then **Ask now** (runs); confirm Enter triggers Ask now.

---

## Self-Review

**Spec coverage:**
- Two buttons on both composers (Add / Ask now) → Task 1 (thread) + Task 2 (new comment). ✅
- Add = save only, Ask now = save + run → `run` flag in `sendThreadMessage` (T1) and `submitComment` (T2). ✅
- Enter = Ask now → Task 1 Step 6. ✅
- Visible "Send all (N)" in the header reusing `sendToAgent('all')`, shown when N>0 → Task 3. ✅
- Server render parity (thread composer + header button) → Task 1 Step 8, Task 3 Step 4. ✅
- No server/API changes → confirmed; no task touches `src/server.ts`. ✅
- dist committed with src → every task commit + Task 4 Step 2. ✅
- Tests for both composers + Send-all, client + render → Tasks 1–3. ✅

**Placeholder scan:** No TBD/TODO; every code step shows the actual code and every verify step shows the command + expected result.

**Type/attribute consistency:** `data-thread-add`, `data-thread-send`, `data-send-all`, `ds-composer-add`, `ds-send-all`, `submitComment(run)`, `sendThreadMessage(wrap,run)`, and `#ds-send-all` are used identically across the tasks that define and consume them. Enter handler and both delegation handlers all route through `sendThreadMessage(wrap, run)` with the same signature defined in Task 1.
