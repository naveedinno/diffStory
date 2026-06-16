# Interactive Agent Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the reviewer trigger the agent from the review page — submit a comment/question, watch the agent answer and edit code live, and see the reply land inline — replacing the manual `/address-review` round-trip.

**Architecture:** Reuse the `address-review` skill verbatim. A new `POST /api/address` endpoint drives the user's agent headlessly (`claude`/`codex`) with a prompt that invokes that skill on the targeted comments. The agent writes replies + code edits exactly as today; the server only streams its output (NDJSON over a chunked response) to the browser and re-reads `comments.json` when done. A single-flight lock allows one run at a time.

**Tech Stack:** TypeScript (ES2022, `tsc`), Node built-ins only (`http`, `child_process`). Client is vanilla ES5-style JS embedded as a template-literal string (`PAGE_JS`) — **no arrow functions, no template literals, no `async/await`** inside it. Tests: `node:test` + `node:assert/strict`, run against `dist/` via `npm test`.

> **Client gotcha (read before Task 6):** the client JS lives inside a `` ` ``-delimited template literal in `src/page-assets.ts`. To emit a backslash escape (e.g. split on a newline) you must double it: write `'\\n'` in the source so the generated JS contains `'\n'`. A bare `'\n'` would put a real newline inside a JS string literal and break the build.

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `src/agent.ts` | Detect + drive the agent | **Modify** — add `addressPrompt`, `streamCommand`, `parseClaudeStreamLine`, `parseCodexStreamLine`, `streamAgent`, `AgentEvent` |
| `src/server.ts` | HTTP server + JSON API | **Modify** — add `POST /api/address`, single-flight lock, `currentDiff` helper |
| `src/render.ts` | Server-side HTML | **Modify** — per-comment "Ask agent" button, "Address all open" button, agent-console element |
| `src/page-assets.ts` | Client CSS + JS | **Modify** — console styles + the streaming client logic |
| `test/agent.test.mjs` | Agent unit tests | **Modify** — cover the pure additions |

Spawn (`streamAgent`) and the HTTP wiring stay integration-only, consistent with `runAgent` and the (untested) `server.ts`. The valuable, fiddly logic — the prompt and the stream parsers — is pure and unit-tested.

---

## Task 1: `addressPrompt()` — the instruction handed to the agent

**Files:**
- Modify: `src/agent.ts` (add after `storyPrompt`, ~line 42)
- Test: `test/agent.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add to `test/agent.test.mjs`. Update the import on line 3 to include `addressPrompt`:

```js
import { onPath, storyPrompt, agentCommand, addressPrompt } from '../dist/agent.js';
```

Append these tests:

```js
test('addressPrompt targets specific ids via the address-review skill', () => {
  const p = addressPrompt(['c_a', 'c_b']);
  assert.ok(p.includes('address-review'));
  assert.ok(p.includes('c_a, c_b'));
  assert.ok(p.includes('.diffstory/comments.json'));
  assert.ok(p.includes('Do not ask questions'));
});

test('addressPrompt handles the all-open case', () => {
  const p = addressPrompt('all');
  assert.ok(p.includes('every comment whose status is "open"'));
  assert.ok(p.includes('address-review'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: build fails or tests fail — `addressPrompt` is not exported.

- [ ] **Step 3: Implement `addressPrompt`**

In `src/agent.ts`, add immediately after the `storyPrompt` function (after line 42):

```ts
/** Instruct the agent to address review comments via the address-review skill. */
export function addressPrompt(target: string[] | 'all'): string {
  const scope =
    target === 'all'
      ? 'every comment whose status is "open"'
      : `the comments with these ids: ${target.join(', ')}`;
  return (
    `Use the diffStory address-review skill to address ${scope} in ${DATA_DIR}/comments.json.\n\n` +
    `Act by type for each one:\n` +
    `- change → make the requested edit; if you genuinely disagree, leave "status" as "open" and make your case in "reply".\n` +
    `- question → read the code at its file:line, then answer concretely in "reply".\n` +
    `- nit → apply it if quick and reasonable; otherwise explain the trade-off in "reply".\n\n` +
    `For every comment you handle: set "status" to "addressed" and write a specific "reply" — name the ` +
    `function or file you changed, or give your answer. Preserve every other field and never delete a comment.\n\n` +
    `If your edits moved code, re-run the diffStory review-tour skill so ${DATA_DIR}/story.json line ranges ` +
    `stay correct, then run "diffstory check" until coverage is clean.\n\n` +
    `Do not ask questions. Make the changes directly.`
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: PASS (all tests, including the existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/agent.ts dist/agent.js test/agent.test.mjs
git commit -m "feat(agent): addressPrompt — drive address-review skill on targeted comments"
```

---

## Task 2: Stream command + line parsers (pure, testable)

**Files:**
- Modify: `src/agent.ts` (add after `addressPrompt`)
- Test: `test/agent.test.mjs`

- [ ] **Step 1: Write the failing tests**

Update the import on line 3 of `test/agent.test.mjs` to add the new names:

```js
import {
  onPath, storyPrompt, agentCommand, addressPrompt,
  streamCommand, parseClaudeStreamLine, parseCodexStreamLine,
} from '../dist/agent.js';
```

Append:

```js
test('streamCommand uses stream-json for claude and exec for codex', () => {
  assert.deepEqual(streamCommand('claude', 'GO'), [
    'claude',
    ['-p', 'GO', '--output-format', 'stream-json', '--verbose',
     '--permission-mode', 'acceptEdits', '--model', 'sonnet'],
  ]);
  assert.deepEqual(streamCommand('codex', 'GO'), ['codex', ['exec', '--full-auto', 'GO']]);
  assert.deepEqual(streamCommand('codex', 'GO', 'gpt-5')[1], ['exec', '--full-auto', '--model', 'gpt-5', 'GO']);
});

test('parseClaudeStreamLine extracts assistant text and tool notices', () => {
  const textLine = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }] } });
  assert.deepEqual(parseClaudeStreamLine(textLine), [{ type: 'text', data: 'Hello' }]);

  const toolLine = JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'src/x.ts' } }] },
  });
  assert.deepEqual(parseClaudeStreamLine(toolLine), [{ type: 'tool', data: '✏️ Edit src/x.ts' }]);
});

test('parseClaudeStreamLine ignores non-JSON, empty, and non-assistant lines', () => {
  assert.deepEqual(parseClaudeStreamLine('not json'), []);
  assert.deepEqual(parseClaudeStreamLine(''), []);
  assert.deepEqual(parseClaudeStreamLine(JSON.stringify({ type: 'system', subtype: 'init' })), []);
});

test('parseCodexStreamLine forwards non-empty lines as text', () => {
  assert.deepEqual(parseCodexStreamLine('working on it'), [{ type: 'text', data: 'working on it' }]);
  assert.deepEqual(parseCodexStreamLine('   '), []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: FAIL — the new exports don't exist.

- [ ] **Step 3: Implement the command builder, parsers, and the event type**

In `src/agent.ts`, add after `addressPrompt`:

```ts
/** A normalized event from a streaming agent run. */
export type AgentEvent =
  | { type: 'text'; data: string }
  | { type: 'tool'; data: string };

/** The streaming command + args for an agent. Flags verified against each CLI's --help. */
export function streamCommand(agent: Agent, prompt: string, model?: string): [string, string[]] {
  if (agent === 'claude') {
    return [
      'claude',
      ['-p', prompt, '--output-format', 'stream-json', '--verbose',
       '--permission-mode', 'acceptEdits', '--model', model ?? DEFAULT_CLAUDE_MODEL],
    ];
  }
  const args = ['exec', '--full-auto'];
  if (model) args.push('--model', model);
  args.push(prompt);
  return ['codex', args];
}

/** Parse one line of Claude's --output-format stream-json into events (non-JSON → none). */
export function parseClaudeStreamLine(line: string): AgentEvent[] {
  const s = line.trim();
  if (!s) return [];
  let obj: any;
  try { obj = JSON.parse(s); } catch { return []; }
  if (obj?.type !== 'assistant' || !Array.isArray(obj.message?.content)) return [];
  const out: AgentEvent[] = [];
  for (const block of obj.message.content) {
    if (block?.type === 'text' && block.text) {
      out.push({ type: 'text', data: block.text });
    } else if (block?.type === 'tool_use') {
      const f = block.input?.file_path ?? block.input?.path ?? '';
      out.push({ type: 'tool', data: `✏️ ${block.name}${f ? ' ' + f : ''}` });
    }
  }
  return out;
}

/** Codex exec streams human-readable text; forward non-empty lines as text. */
export function parseCodexStreamLine(line: string): AgentEvent[] {
  const s = line.replace(/\s+$/, '');
  return s.trim() ? [{ type: 'text', data: s }] : [];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/agent.ts dist/agent.js test/agent.test.mjs
git commit -m "feat(agent): streaming command + claude/codex line parsers"
```

---

## Task 3: `streamAgent()` — spawn and stream events (integration-only)

**Files:**
- Modify: `src/agent.ts` (add after the parsers)

No unit test — the spawn is integration-only, exactly like `runAgent`. The parsers it relies on are covered by Task 2.

- [ ] **Step 1: Implement `streamAgent`**

In `src/agent.ts`, add after `parseCodexStreamLine`:

```ts
function lineParser(agent: Agent): (line: string) => AgentEvent[] {
  return agent === 'claude' ? parseClaudeStreamLine : parseCodexStreamLine;
}

/**
 * Spawn the agent and stream normalized events as output arrives, calling `onEvent`
 * per parsed event. Resolves with the exit-ok flag and captured output (used for a
 * failure tail). The spawn itself is integration-only — the parsers are unit-tested.
 */
export function streamAgent(
  agent: Agent,
  repo: string,
  prompt: string,
  onEvent: (e: AgentEvent) => void,
  model?: string,
): Promise<{ ok: boolean; output: string }> {
  const [cmd, args] = streamCommand(agent, prompt, model);
  const parse = lineParser(agent);
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let buf = '';
    const feed = (b: Buffer) => {
      const text = b.toString();
      output += text;
      if (output.length > 200_000) output = output.slice(-200_000); // cap memory
      buf += text;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const ln of lines) for (const e of parse(ln)) onEvent(e);
    };
    child.stdout?.on('data', feed);
    child.stderr?.on('data', feed);
    child.on('error', (e) => resolve({ ok: false, output: `${output}\n${String(e)}` }));
    child.on('close', (code) => {
      if (buf) for (const e of parse(buf)) onEvent(e); // flush the last partial line
      resolve({ ok: code === 0, output });
    });
  });
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/agent.ts dist/agent.js
git commit -m "feat(agent): streamAgent — spawn an agent and stream parsed events"
```

---

## Task 4: `POST /api/address` endpoint + single-flight lock

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Add the agent imports**

In `src/server.ts`, after the existing import block (after line 20, the `import type { DiffFile, Tour }` line), add:

```ts
import { availableAgents, streamAgent, addressPrompt, type AgentEvent } from './agent.js';
```

- [ ] **Step 2: Add the single-flight lock**

In `src/server.ts`, immediately after `export function serve(opts: ServeOptions): void {`'s sibling — i.e. at module scope just below the imports — add:

```ts
// Only one agent run at a time: concurrent runs editing the same working tree would collide.
let agentBusy = false;
```

- [ ] **Step 3: Add the route**

In `handle()`, add this block right after the `POST /api/comments` block (after line 75, before the `PATCH` block):

```ts
    if (method === 'POST' && url.pathname === '/api/address') {
      if (agentBusy) return sendJson(res, 409, { error: 'An agent run is already in progress.' });
      return readBody(req, (body) => runAddress(res, opts, body));
    }
```

- [ ] **Step 4: Add `runAddress`, `currentDiff`, and `tailLines`**

In `src/server.ts`, add these functions after `renderFullFileResponse` (after line 144):

```ts
/** Raw `git diff` text for the current review scope — used to detect agent code edits. */
function currentDiff(opts: ServeOptions): string {
  try {
    const tour = loadTour(resolveStoryPath(opts.repo));
    const base = resolveBase(opts.repo, opts.baseOverride ?? tour.base);
    return getDiff(opts.repo, base, opts.headOverride);
  } catch {
    return '';
  }
}

function tailLines(s: string, n: number): string {
  return s.trimEnd().split('\n').slice(-n).join('\n');
}

/**
 * Drive the user's agent to address review comments and stream its output as NDJSON
 * (one JSON event per line: {type:'text'|'tool'|'error'|'done', ...}). Reuses the
 * address-review skill — the agent writes replies + edits code itself.
 */
function runAddress(res: ServerResponse, opts: ServeOptions, body: string): void {
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

  const agents = availableAgents();
  if (agents.length === 0) {
    return sendJson(res, 400, { error: 'No agent CLI found (looked for "claude" and "codex").' });
  }
  const agent = agents[0];

  agentBusy = true;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  const before = currentDiff(opts);
  const send = (e: object) => {
    try {
      res.write(JSON.stringify(e) + '\n');
    } catch {
      /* client disconnected */
    }
  };

  streamAgent(agent, opts.repo, addressPrompt(target), (e: AgentEvent) => send(e))
    .then(({ ok, output }) => {
      const codeChanged = currentDiff(opts) !== before;
      if (!ok) send({ type: 'error', data: tailLines(output, 30) });
      send({ type: 'done', ok, codeChanged });
    })
    .catch((err) => send({ type: 'error', data: String(err) }))
    .finally(() => {
      res.end();
      agentBusy = false;
    });
}
```

- [ ] **Step 5: Verify it builds**

Run: `npm run build`
Expected: no TypeScript errors. (`loadTour`, `resolveBase`, `getDiff`, `resolveStoryPath`, `sendJson`, `readBody`, `ServerResponse` are already imported/defined in this file.)

- [ ] **Step 6: Commit**

```bash
git add src/server.ts dist/server.js
git commit -m "feat(server): POST /api/address streams a live address-review run"
```

---

## Task 5: Server-rendered UI — buttons + agent console

**Files:**
- Modify: `src/render.ts`

- [ ] **Step 1: Add the per-comment "Ask agent" button**

In `src/render.ts`, in `commentHtml`, replace the actions block (lines 536-539):

```ts
      <div class="ds-comment-actions">
        <button class="ds-ghost" data-resolve>${resolved ? 'Reopen' : 'Resolve'}</button>
        <button class="ds-ghost ds-del" data-delete>Delete</button>
      </div>
```

with:

```ts
      <div class="ds-comment-actions">
        ${
          c.status !== 'resolved'
            ? '<button class="ds-ghost ds-send" data-send title="Ask your agent to answer or fix this — the reply appears right here">Ask agent</button>'
            : ''
        }
        <button class="ds-ghost" data-resolve>${resolved ? 'Reopen' : 'Resolve'}</button>
        <button class="ds-ghost ds-del" data-delete>Delete</button>
      </div>
```

- [ ] **Step 2: Add the "Address all open" button to the header**

In `src/render.ts`, in the `.ds-status` block, replace lines 87-90:

```ts
    <span class="ds-open" id="ds-open-count" title="Review comments still awaiting a reply or resolution"><span class="ds-dot ds-dot-amber"></span><b>${openCount}</b> open ${plural(
      openCount,
      'comment',
    )}</span>
```

with (adds the button right after the open-count span):

```ts
    <span class="ds-open" id="ds-open-count" title="Review comments still awaiting a reply or resolution"><span class="ds-dot ds-dot-amber"></span><b>${openCount}</b> open ${plural(
      openCount,
      'comment',
    )}</span>
    <button class="ds-addall" data-address-all${openCount ? '' : ' disabled'} title="Have your agent address every open comment and reply right here">Address all open</button>
```

- [ ] **Step 3: Add the agent-console element**

In `src/render.ts`, insert this block immediately after `</header>` (after line 130, before the blank line and `<div class="ds-layout">`):

```ts
<div class="ds-agentconsole" id="ds-agentconsole" hidden aria-live="polite">
  <div class="ds-ac-head">
    <span class="ds-ac-spin" aria-hidden="true"></span>
    <span class="ds-ac-title">Agent is working…</span>
    <span class="ds-flex"></span>
    <button class="ds-ghost ds-ac-close" data-ac-close hidden>Close</button>
  </div>
  <pre class="ds-ac-body" id="ds-ac-body"></pre>
  <div class="ds-ac-foot" id="ds-ac-foot" hidden></div>
</div>
```

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/render.ts dist/render.js
git commit -m "feat(render): Ask-agent + Address-all buttons and the agent console shell"
```

---

## Task 6: Client logic — stream, render, patch

**Files:**
- Modify: `src/page-assets.ts` (CSS section ~line 364 and the `PAGE_JS` IIFE ~lines 468-792)

> Reminder: inside `PAGE_JS` use `var`/`function`, string concatenation, and **`'\\n'`** for newline splits. No arrow functions, no template literals.

- [ ] **Step 1: Add the CSS**

In `src/page-assets.ts`, in the CSS string, immediately after the `.ds-comment-actions{...}` rule (line 364), add:

```css
.ds-send{color:var(--accent-blue)}
.ds-addall{font:inherit;font-size:11.5px;font-weight:600;color:var(--accent-blue);background:rgba(10,132,255,0.10);border:1px solid var(--line);padding:4px 10px;border-radius:7px;cursor:pointer}
.ds-addall:disabled{opacity:.45;cursor:default}
.ds-agentconsole{position:fixed;right:18px;bottom:18px;width:min(440px,calc(100vw - 36px));max-height:min(60vh,520px);display:flex;flex-direction:column;
  background:var(--material);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);
  border:1px solid var(--line);border-radius:13px;box-shadow:var(--shadow);z-index:90;overflow:hidden}
.ds-ac-head{display:flex;align-items:center;gap:9px;padding:11px 13px;border-bottom:1px solid var(--line-soft);font-size:12.5px;font-weight:600;color:var(--text)}
.ds-ac-spin{width:13px;height:13px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--accent-blue);animation:ds-spin .7s linear infinite;flex:none}
@keyframes ds-spin{to{transform:rotate(360deg)}}
.ds-ac-body{margin:0;padding:11px 13px;overflow:auto;flex:1;font:11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);white-space:pre-wrap;word-break:break-word}
.ds-ac-foot{padding:10px 13px;border-top:1px solid var(--line-soft);font-size:12px;color:var(--text);display:flex;align-items:center;gap:9px}
```

- [ ] **Step 2: Declare the new state and add the Send button to client-built comments**

In `PAGE_JS`, change line 470 from:

```js
  var API='/api/comments';
```

to:

```js
  var API='/api/comments';
  var ADDRESS_API='/api/address';
  var agentBusy=false;
```

Then in `buildComment` (lines 635-637), change:

```js
    var actions=el('div','ds-comment-actions');
    var rb=el('button','ds-ghost',c.status==='resolved'?'Reopen':'Resolve');rb.setAttribute('data-resolve','');actions.appendChild(rb);
    var db=el('button','ds-ghost ds-del','Delete');db.setAttribute('data-delete','');actions.appendChild(db);
```

to:

```js
    var actions=el('div','ds-comment-actions');
    if(c.status!=='resolved'){var snd=el('button','ds-ghost ds-send','Ask agent');snd.setAttribute('data-send','');actions.appendChild(snd);}
    var rb=el('button','ds-ghost',c.status==='resolved'?'Reopen':'Resolve');rb.setAttribute('data-resolve','');actions.appendChild(rb);
    var db=el('button','ds-ghost ds-del','Delete');db.setAttribute('data-delete','');actions.appendChild(db);
```

- [ ] **Step 3: Add the agent-console + streaming functions**

In `PAGE_JS`, add these functions right before `function refreshCount(){` (line 695):

```js
  function acEl(){return $('#ds-agentconsole');}
  function acOpen(){
    var c=acEl();if(!c)return;c.hidden=false;
    var body=$('#ds-ac-body');if(body)body.textContent='';
    var foot=$('#ds-ac-foot');if(foot){foot.hidden=true;foot.textContent='';}
    var t=$('.ds-ac-title',c);if(t)t.textContent='Agent is working…';
    var sp=$('.ds-ac-spin',c);if(sp)sp.hidden=false;
    var cl=$('[data-ac-close]',c);if(cl)cl.hidden=true;
  }
  function acAppend(s){var body=$('#ds-ac-body');if(!body)return;body.textContent+=s;body.scrollTop=body.scrollHeight;}
  function acFinish(ok,codeChanged){
    var c=acEl();if(!c)return;
    var sp=$('.ds-ac-spin',c);if(sp)sp.hidden=true;
    var t=$('.ds-ac-title',c);if(t)t.textContent=ok?'Done':'Agent run failed';
    var cl=$('[data-ac-close]',c);if(cl)cl.hidden=false;
    if(ok&&codeChanged){
      var foot=$('#ds-ac-foot');
      if(foot){foot.hidden=false;foot.textContent='';foot.appendChild(document.createTextNode('Code changed. '));
        var btn=el('button','ds-btn ds-btn-solid','Reload to see the new diff');
        btn.onclick=function(){location.reload();};foot.appendChild(btn);}
    }
  }
  function setBusy(b){
    agentBusy=b;
    $all('[data-send]').forEach(function(s){s.disabled=b;});
    var aa=$('[data-address-all]');if(aa)aa.disabled=b||collectOpenIds().length===0;
  }
  function collectOpenIds(){
    return $all('.ds-comment.status-open').map(function(w){return w.getAttribute('data-comment-id');});
  }
  function ensureReply(wrap,text){
    var card=$('.ds-comment-card',wrap);if(!card)return;
    var r=$('.ds-reply',card);
    if(!r){
      r=el('div','ds-reply');
      r.appendChild(el('span','ds-reply-av','◈'));
      var main=el('div','ds-reply-main');
      var who=el('div','ds-reply-who');who.appendChild(el('span','ds-reply-name',BRAND));who.appendChild(el('span','ds-ai-badge','AI'));
      main.appendChild(who);
      main.appendChild(el('div','ds-reply-body'));
      r.appendChild(main);
      var actions=$('.ds-comment-actions',card);
      card.insertBefore(r,actions||null);
    }
    var rb=$('.ds-reply-body',r);if(rb)rb.textContent=text;
  }
  function patchComment(c){
    var wrap=$('.ds-comment[data-comment-id="'+c.id+'"]');if(!wrap)return;
    wrap.setAttribute('data-status',c.status);wrap.className='ds-comment status-'+c.status;
    var sb=$('.ds-statusbadge',wrap);if(sb){sb.textContent='';sb.appendChild(el('span','ds-dot'));sb.appendChild(document.createTextNode(STATUS[c.status]||'Open'));}
    if(c.reply){wrap.setAttribute('data-hasreply','1');ensureReply(wrap,c.reply);}
    var rb=$('[data-resolve]',wrap);if(rb)rb.textContent=c.status==='resolved'?'Reopen':'Resolve';
    var snd=$('[data-send]',wrap);if(snd)snd.style.display=(c.status==='resolved')?'none':'';
  }
  function refreshComments(){
    fetch(API).then(function(r){return r.json();}).then(function(list){
      if(Array.isArray(list))list.forEach(patchComment);
      refreshCount();
    }).catch(function(){});
  }
  function handleEvent(ev,result){
    if(!ev||!ev.type)return;
    if(ev.type==='text'){acAppend(ev.data||'');}
    else if(ev.type==='tool'){acAppend('\\n'+(ev.data||'')+'\\n');}
    else if(ev.type==='error'){acAppend('\\n'+(ev.data||'')+'\\n');result.ok=false;}
    else if(ev.type==='done'){result.ok=!!ev.ok;result.codeChanged=!!ev.codeChanged;}
  }
  function pump(reader,dec,buf,result){
    return reader.read().then(function(res){
      if(res.done){
        if(buf.trim()){try{handleEvent(JSON.parse(buf),result);}catch(e){}}
        return result;
      }
      buf+=dec.decode(res.value,{stream:true});
      var parts=buf.split('\\n');buf=parts.pop();
      for(var i=0;i<parts.length;i++){var ln=parts[i];if(!ln.trim())continue;try{handleEvent(JSON.parse(ln),result);}catch(e){}}
      return pump(reader,dec,buf,result);
    });
  }
  function sendToAgent(ids){
    if(agentBusy)return;
    var payload=ids==='all'?{all:true}:{commentIds:ids};
    var result={ok:false,codeChanged:false};
    setBusy(true);acOpen();
    fetch(ADDRESS_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      .then(function(r){
        if(r.status===409){acAppend('Another agent run is already in progress.');return null;}
        if(!r.ok||!r.body){
          return r.json().then(function(j){acAppend((j&&j.error)||'Could not start the agent run.');return null;},
                               function(){acAppend('Could not start the agent run.');return null;});
        }
        return pump(r.body.getReader(),new TextDecoder(),'',result);
      })
      .then(function(res){
        if(res){acFinish(result.ok,result.codeChanged);if(result.ok)refreshComments();}
        else{acFinish(false,false);}
        setBusy(false);
      })
      .catch(function(err){acAppend('\\n'+String(err));acFinish(false,false);setBusy(false);});
  }
```

- [ ] **Step 4: Keep "Address all open" in sync in `refreshCount`**

In `refreshCount` (lines 695-700), after the line that updates `#ds-open-count b`, add the address-all sync. Change:

```js
  function refreshCount(){
    var openN=$all('.ds-comment').length-$all('.ds-comment.status-resolved').length;
    var b=$('#ds-open-count b');if(b){b.textContent=openN;if(b.nextSibling)b.nextSibling.nodeValue=' open '+(openN===1?'comment':'comments');}
    var approve=$('[data-verdict="approve"]'),pill=$('.ds-trustpill'),clean=pill&&pill.classList.contains('is-clean');
    if(approve)approve.disabled=!(openN===0&&clean);
  }
```

to:

```js
  function refreshCount(){
    var openN=$all('.ds-comment').length-$all('.ds-comment.status-resolved').length;
    var b=$('#ds-open-count b');if(b){b.textContent=openN;if(b.nextSibling)b.nextSibling.nodeValue=' open '+(openN===1?'comment':'comments');}
    var approve=$('[data-verdict="approve"]'),pill=$('.ds-trustpill'),clean=pill&&pill.classList.contains('is-clean');
    if(approve)approve.disabled=!(openN===0&&clean);
    var aa=$('[data-address-all]');if(aa&&!agentBusy)aa.disabled=openN===0;
  }
```

- [ ] **Step 5: Wire the click handlers**

In `onClick` (after line 726, the `[data-delete]` handler), add:

```js
    b=closest(t,'[data-send]');if(b){if(b.disabled)return;var cm=closest(b,'.ds-comment');if(cm)sendToAgent([cm.getAttribute('data-comment-id')]);return;}
    b=closest(t,'[data-address-all]');if(b){if(b.disabled)return;sendToAgent('all');return;}
    b=closest(t,'[data-ac-close]');if(b){var ac=acEl();if(ac)ac.hidden=true;return;}
```

- [ ] **Step 6: Update the now-stale "/address-review" copy**

In `buildComposer` (line 652), change the placeholder:

```js
    var ta=el('textarea','ds-composer-ta');ta.placeholder='Leave a comment on this line… '+BRAND+' replies when you run /address-review.';ta.rows=3;
```

to:

```js
    var ta=el('textarea','ds-composer-ta');ta.placeholder='Leave a comment on this line… then Ask agent to get a reply right here.';ta.rows=3;
```

In `verdict` (lines 704-705), change:

```js
    if(openN>0)toast(openN+' open '+(openN===1?'comment':'comments')+' saved to .diffstory/comments.json — run /address-review in your agent to hand them back.');
    else toast('No open comments yet. Leave notes on the lines, then run /address-review to hand them to the agent.');
```

to:

```js
    if(openN>0)toast(openN+' open '+(openN===1?'comment':'comments')+'. Click “Address all open” to have your agent reply right here.');
    else toast('No open comments yet. Leave notes on the lines, then Ask agent to get a reply right here.');
```

- [ ] **Step 7: Build and verify no errors**

Run: `npm run build && node --test test/*.test.mjs`
Expected: build succeeds; all unit tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/page-assets.ts dist/page-assets.js
git commit -m "feat(page): live streaming agent loop — Ask agent, Address all, inline replies"
```

---

## Task 7: End-to-end verification

**Files:** none (manual verification)

- [ ] **Step 1: Build and run the unit suite**

Run: `npm test`
Expected: build succeeds; every test passes.

- [ ] **Step 2: Launch the demo and exercise the UI**

Run: `npm run demo`
Expected: the review page opens. Confirm:
- Each open comment shows an **Ask agent** button; the header shows **Address all open** (disabled when 0 open).
- Leaving a new comment shows an **Ask agent** button on it.

- [ ] **Step 3: Trigger a live run (requires `claude` or `codex` on PATH)**

In a repo with a real change + story and an agent installed:

Run: `node dist/cli.js serve` (or `diffstory serve`), leave a `question` comment, click **Ask agent**.
Expected:
- The agent console appears bottom-right and streams text/✏️ tool lines.
- On completion the spinner stops, **Close** appears, the comment flips to **Addressed**, and the agent's **reply** shows inline.
- If the agent edited code, a **"Reload to see the new diff"** button appears in the console foot.

- [ ] **Step 4: Verify the lock and the no-agent path**

- With a run in progress, confirm **Ask agent** / **Address all** are disabled (single-flight).
- On a machine with no `claude`/`codex`, click **Ask agent**: the console shows *"No agent CLI found…"* and unlocks.

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "fix: address findings from interactive-agent-loop verification"
```

---

## Self-Review

**Spec coverage:**
- Per-comment Send → Task 5 (button) + Task 6 (handler). ✓
- Address all open → Task 5 (button) + Task 6 (handler, `sendToAgent('all')`). ✓
- Answer + edit code → reuses address-review via `addressPrompt` (Task 1); endpoint runs it (Task 4). ✓
- Live streaming → `streamAgent` + parsers (Tasks 2-3), NDJSON endpoint (Task 4), client `pump`/console (Task 6). ✓
- Inline reply patch → `patchComment`/`ensureReply` + `refreshComments` (Task 6). ✓
- Reload-on-code-change → `currentDiff` diff before/after (Task 4) → `done.codeChanged` → `acFinish` reload button (Task 6). ✓
- Single-flight lock → `agentBusy` + 409 (Task 4) + client `setBusy` (Task 6). ✓
- No-agent / failure handling → `availableAgents` 400 + `error` event with output tail (Task 4). ✓
- Tests for pure logic → Tasks 1-2. ✓

**Placeholder scan:** none — every step has full code.

**Type/name consistency:** `AgentEvent`, `streamCommand`, `parseClaudeStreamLine`, `parseCodexStreamLine`, `streamAgent`, `addressPrompt` used identically across agent.ts/server.ts/tests. Client `sendToAgent`/`pump`/`handleEvent`/`patchComment`/`ensureReply`/`acOpen`/`acAppend`/`acFinish`/`setBusy`/`collectOpenIds`/`refreshComments` are all defined in Task 6 and referenced consistently. Endpoint path `/api/address` matches `ADDRESS_API`. Event shape `{type,data}` + `{type:'done',ok,codeChanged}` consistent server↔client.

**Out of scope (per spec):** free-form ask box, multi-turn memory, cancel-mid-run.
