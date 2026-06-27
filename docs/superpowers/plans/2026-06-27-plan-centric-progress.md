# Plan-centric agent progress — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the noisy phase/timeline/raw-dump progress panel with one that renders the agent's own `TodoWrite` plan as the centerpiece — done items recede, the active item is lit with a live "now" line — plus a plain-language lifecycle label and honest liveness.

**Architecture:** Add one `plan` event to the existing app-owned progress protocol; stop discarding `TodoWrite` in the agent classifier and emit the checklist instead; rewrite the shared `ProgressPanel` string-builder module to render that checklist with a graceful single-line fallback when no plan exists. The server spine and honesty rules are untouched — the new event passes straight through `runWorkflow`.

**Tech Stack:** TypeScript compiled to `dist/` via `tsc`; Node's built-in test runner (`node --test test/*.test.mjs`). The panel is a self-contained string-builder module (CSS + HTML fragment + browser script), no framework, no dependencies.

## Global Constraints

- **Rebuild and commit `dist/`** with every `src/` change — github installs have no build step. Build command: `npm run build`.
- **Honest progress only** (from the 2026-06-23 design): never fabricate. The plan reflects real `TodoWrite` calls; the live line reflects real tool events; liveness reflects the real child process + heartbeat. No backward phase movement; preflight failures stay non-200 blocked states.
- **Apple system look:** SF system fonts, system colors (`#0a84ff` blue, `#30d158` green, `#ff6961` red), 0.5px hairlines. The rewrite restyles within this language — no new design system.
- **Copy:** sentence case, plain language, no jargon. Lifecycle words: "Preparing…", "Writing your review" / "Addressing comments", "Checking the result…", "Review ready" / "Comments addressed", "Stopped", "Couldn't finish", "Cannot start".
- **Pre-existing uncommitted changes** in `src/server.ts`, `src/render.ts`, `src/page-assets.ts`, `test/change-route.test.mjs`, `test/render-page.test.mjs` (and their `dist/`) are unrelated story/diff work. Leave them intact; do not revert or fold them into these commits.
- **Preserve the `ProgressPanel` public surface** consumed by callers in `src/change-page.ts` and `src/page-assets.ts`: constructor `new ProgressPanel(root, opts)` where `opts` may have `onStop`, `onClose`, `onDone(status, result)`; returned object must keep `start()`, `handle(ev)`, `finish(status, result)`, `blocked(err)`, `showFoot(node)`, `els`, `root`. Root selector stays `.ds-pp`; the reload button class stays `.ds-pp-reload`. `runProgress(panel, url, payload, ctrl)` stays byte-for-byte the same.

---

### Task 1: Add the `plan` event to the progress protocol

**Files:**
- Modify: `src/progress.ts` (event union near line 30-42; add helper near the other `*Event` helpers)
- Test: `test/progress.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `type PlanStatus = 'pending' | 'active' | 'done'`
  - `interface PlanItem { text: string; status: PlanStatus }`
  - `{ type: 'plan'; items: PlanItem[] }` added to the `ProgressEvent` union
  - `planEvent(items: PlanItem[]): ProgressEvent`

- [ ] **Step 1: Write the failing test**

Add to `test/progress.test.mjs` (extend the import from `../dist/progress.js` to include `planEvent`):

```js
test('planEvent carries the agent checklist verbatim', () => {
  assert.deepEqual(
    planEvent([
      { text: 'Read the diff', status: 'done' },
      { text: 'Drafting the story', status: 'active' },
      { text: 'Check coverage', status: 'pending' },
    ]),
    {
      type: 'plan',
      items: [
        { text: 'Read the diff', status: 'done' },
        { text: 'Drafting the story', status: 'active' },
        { text: 'Check coverage', status: 'pending' },
      ],
    },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && node --test test/progress.test.mjs`
Expected: FAIL — `planEvent` is not exported (import is `undefined`, call throws).

- [ ] **Step 3: Add the types, union member, and helper**

In `src/progress.ts`, add the types above the `ProgressEvent` union (near line 17 with the other `type` aliases):

```ts
export type PlanStatus = 'pending' | 'active' | 'done';
export interface PlanItem { text: string; status: PlanStatus }
```

Add this member to the `ProgressEvent` union (e.g. right after the `tool` line):

```ts
  | { type: 'plan'; items: PlanItem[] }
```

Add the helper alongside the other `*Event` functions:

```ts
export function planEvent(items: PlanItem[]): ProgressEvent {
  return { type: 'plan', items };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build && node --test test/progress.test.mjs`
Expected: PASS (all tests in the file, including the new one).

- [ ] **Step 5: Commit**

```bash
git add src/progress.ts dist/progress.js test/progress.test.mjs
git commit -m "feat(progress): add plan event to the progress protocol"
```

---

### Task 2: Emit the agent's plan from `TodoWrite` instead of discarding it

**Files:**
- Modify: `src/agent.ts` (import block near line 7; `classifyTool` `TodoWrite` case at line 222-223; add `planItems` helper)
- Test: `test/agent.test.mjs`

**Interfaces:**
- Consumes: `planEvent`, `PlanItem`, `PlanStatus` from `./progress.js` (Task 1).
- Produces:
  - `planItems(todos: any): PlanItem[]` (exported, pure, unit-tested)
  - `classifyTool('TodoWrite', input)` now returns a `plan` event

- [ ] **Step 1: Write the failing tests**

In `test/agent.test.mjs`, extend the import from `../dist/agent.js` to include `planItems`. Replace the existing `TodoWrite` assertion (currently around line 163, expecting `{ type: 'activity', kind: 'plan', label: 'Updating the plan' }`) with:

```js
  assert.deepEqual(
    classifyTool('TodoWrite', {
      todos: [
        { content: 'Read the diff', activeForm: 'Reading the diff', status: 'completed' },
        { content: 'Draft the story', activeForm: 'Drafting the story', status: 'in_progress' },
        { content: 'Check coverage', activeForm: 'Checking coverage', status: 'pending' },
      ],
    }),
    {
      type: 'plan',
      items: [
        { text: 'Read the diff', status: 'done' },
        { text: 'Drafting the story', status: 'active' },
        { text: 'Check coverage', status: 'pending' },
      ],
    },
  );
```

Add a dedicated test for the helper's edge cases:

```js
test('planItems maps statuses, prefers activeForm for the active item, drops empties', () => {
  assert.deepEqual(
    planItems([{ content: 'a', activeForm: 'doing a', status: 'in_progress' }]),
    [{ text: 'doing a', status: 'active' }],
  );
  // Non-active items use content even if activeForm is present.
  assert.deepEqual(
    planItems([{ content: 'a', activeForm: 'doing a', status: 'completed' }]),
    [{ text: 'a', status: 'done' }],
  );
  // Unknown/missing status falls back to pending; missing activeForm falls back to content.
  assert.deepEqual(
    planItems([{ content: 'b', status: undefined }]),
    [{ text: 'b', status: 'pending' }],
  );
  // Non-array input and empty-text items are dropped.
  assert.deepEqual(planItems(undefined), []);
  assert.deepEqual(planItems([{ content: '   ', status: 'pending' }]), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: FAIL — `planItems` is not exported; the `TodoWrite` case still returns the old activity event.

- [ ] **Step 3: Implement `planItems` and rewire the `TodoWrite` case**

In `src/agent.ts`, extend the existing import from `./progress.js` (currently imports `fileEvent, commandEvent, activityEvent, toolEvent, textEvent` plus `type ProgressEvent`) to also import the plan pieces:

```ts
import {
  type ProgressEvent, type PlanItem, type PlanStatus,
  fileEvent, commandEvent, activityEvent, toolEvent, textEvent, planEvent,
} from './progress.js';
```

Add the helper above `classifyTool`:

```ts
/** Normalize a TodoWrite `todos` array into the agent's plan checklist. */
export function planItems(todos: any): PlanItem[] {
  if (!Array.isArray(todos)) return [];
  return todos
    .map((t): PlanItem => {
      const status: PlanStatus =
        t?.status === 'in_progress' ? 'active' : t?.status === 'completed' ? 'done' : 'pending';
      const raw = status === 'active' ? (t?.activeForm ?? t?.content) : t?.content;
      return { text: String(raw ?? '').trim(), status };
    })
    .filter((i) => i.text);
}
```

Replace the `TodoWrite` case in `classifyTool` (line 222-223):

```ts
    case 'TodoWrite':
      return planEvent(planItems(input?.todos));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/agent.ts dist/agent.js test/agent.test.mjs
git commit -m "feat(agent): emit the agent's TodoWrite plan as a plan event"
```

---

### Task 3: Rewrite the progress panel to be plan-centric

**Files:**
- Modify (full rewrite of all three exported builders): `src/progress-ui.ts`
- Test: `test/progress-ui.test.mjs`

**Interfaces:**
- Consumes: `plan` events (Task 1/2) and the existing `run_started`, `context`, `phase`, `file`, `command`, `activity`, `tool`, `text`, `heartbeat`, `warning`, `error`, `run_done` events.
- Produces: same three exports — `progressPanelStyles()`, `progressPanelMarkup(variant)`, `progressPanelScript()` — with the preserved `ProgressPanel`/`runProgress` public surface (see Global Constraints).

New markup regions (replacing `ds-pp-phase`, `ds-pp-phase-label`, `ds-pp-meta`, `ds-pp-timeline`, `ds-pp-rawwrap`/`ds-pp-rawhd`):
- `.ds-pp-title` — lifecycle label (kept)
- `.ds-pp-agent`, `.ds-pp-repo` — kept
- `.ds-pp-plan` (`<ol>`) — the checklist
- `.ds-pp-now` — standalone fallback "now" line (hidden when nested under an active step)
- `.ds-pp-live` / `.ds-pp-live-tx` / `.ds-pp-live-count` — footer liveness row
- `.ds-pp-details` (`<details>`) wrapping `.ds-pp-raw` — failure-only raw output
- `.ds-pp-foot` — kept (blocked detail + `showFoot` reload button)

- [ ] **Step 1: Write the failing tests**

Replace the body of the two existing tests in `test/progress-ui.test.mjs` (`markup exposes the panel regions for both variants` and `script defines ProgressPanel and handles every event type`) with:

```js
test('markup exposes the plan-centric regions for both variants', () => {
  for (const variant of ['inline', 'floating']) {
    const m = progressPanelMarkup(variant);
    assert.match(m, /ds-pp-title/);
    assert.match(m, /ds-pp-agent/);
    assert.match(m, /ds-pp-repo/);
    assert.match(m, /ds-pp-plan/);
    assert.match(m, /ds-pp-now/);
    assert.match(m, /ds-pp-live/);
    assert.match(m, /ds-pp-raw/);
    assert.match(m, /data-pp-stop/);
    assert.match(m, /data-pp-close/);
    assert.match(m, new RegExp(`data-variant="${variant}"`));
    // The old noisy regions are gone.
    assert.doesNotMatch(m, /ds-pp-timeline/);
    assert.doesNotMatch(m, /ds-pp-phase-label/);
  }
});

test('script defines ProgressPanel and handles every event type incl. plan', () => {
  const s = progressPanelScript();
  assert.match(s, /function ProgressPanel/);
  assert.match(s, /function runProgress/);
  for (const t of [
    'run_started', 'context', 'phase', 'plan', 'file', 'command',
    'activity', 'tool', 'text', 'heartbeat', 'warning', 'error', 'run_done',
  ]) {
    assert.ok(s.includes(`'${t}'`), `script should handle ${t}`);
  }
  assert.match(s, /blocked/);
  assert.match(s, /quiet/);
  // Preserved public surface used by callers.
  assert.match(s, /showFoot/);
  assert.match(s, /ds-pp-reload|reload/);
});
```

Keep the existing `styles target the panel and adapt to dark mode` test as-is (it only checks `.ds-pp` and a `prefers-color-scheme` rule, both still present).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run build && node --test test/progress-ui.test.mjs`
Expected: FAIL — markup still has `ds-pp-timeline`/`ds-pp-phase-label`; script does not handle `'plan'`.

- [ ] **Step 3: Replace `src/progress-ui.ts` with the plan-centric implementation**

Replace the entire file with:

```ts
// One shared live-progress panel for every agent run, embedded by both the change
// screen (inline variant) and the review screen (floating variant). It renders the
// agent's OWN plan (from TodoWrite) as the centerpiece: done items recede, the single
// active item is lit and carries a live "what's happening now" line. A plain-language
// lifecycle label (Preparing → Writing your review → Checking the result → Review ready)
// and honest liveness sit in the header/footer. Raw agent output is captured but only
// surfaced as a Details disclosure on failure. Exports three string builders: CSS, an
// HTML fragment, and a browser script defining a global ProgressPanel + runProgress.

/** Self-contained styles (own CSS custom properties so it looks identical on both screens). */
export function progressPanelStyles(): string {
  return `
.ds-pp{--pp-bg:#1c1c1e;--pp-elev:#2c2c2e;--pp-text:#f2f2f7;--pp-muted:#9a9aa3;--pp-faint:#6e6e73;
  --pp-line:rgba(255,255,255,.12);--pp-blue:#0a84ff;--pp-warn:#ff9f0a;--pp-err:#ff6961;--pp-ok:#30d158;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;color:var(--pp-text);
  background:var(--pp-bg);border:.5px solid var(--pp-line);border-radius:14px;overflow:hidden;letter-spacing:-.01em}
@media (prefers-color-scheme:light){.ds-pp{--pp-bg:#1e1e21;--pp-elev:#2a2a2e;--pp-muted:#a6a6ad;--pp-faint:#8a8a90}}
.ds-pp[data-variant="floating"]{position:fixed;right:18px;bottom:18px;width:min(460px,calc(100vw - 36px));max-height:min(72vh,580px);display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.5);z-index:50}
.ds-pp[data-variant="inline"]{margin-top:20px;display:flex;flex-direction:column;max-height:min(66vh,580px)}
.ds-pp[data-variant][hidden]{display:none}
.ds-pp-head{display:flex;align-items:center;gap:9px;padding:12px 14px;border-bottom:.5px solid var(--pp-line)}
.ds-pp-spin{width:13px;height:13px;border-radius:50%;border:2px solid var(--pp-line);border-top-color:var(--pp-blue);animation:ds-pp-spin .7s linear infinite;flex:none}
.ds-pp-spin[hidden]{display:none}
@keyframes ds-pp-spin{to{transform:rotate(360deg)}}
.ds-pp-title{font-size:14px;font-weight:650}
.ds-pp-agent{font-size:11.5px;color:var(--pp-muted);background:var(--pp-elev);border:.5px solid var(--pp-line);border-radius:6px;padding:2px 7px}
.ds-pp-agent:empty{display:none}
.ds-pp-flex{flex:1}
.ds-pp-stop,.ds-pp-close{font:inherit;font-size:12px;font-weight:550;color:var(--pp-text);background:transparent;border:.5px solid var(--pp-line);border-radius:7px;padding:5px 11px;cursor:pointer}
.ds-pp-stop[hidden],.ds-pp-close[hidden]{display:none}
.ds-pp-sub{padding:9px 14px 2px}
.ds-pp-repo{font-size:11.5px;color:var(--pp-muted);font-family:"SF Mono",ui-monospace,Menlo,monospace}
.ds-pp-repo:empty{display:none}
.ds-pp-plan{list-style:none;margin:0;padding:6px 14px 4px;overflow:auto;flex:1;min-height:40px}
.ds-pp-plan:empty{display:none}
.ds-pp-step{display:flex;align-items:flex-start;gap:10px;padding:5px 0}
.ds-pp-mark{flex:none;width:16px;height:16px;border-radius:50%;box-sizing:border-box;margin-top:1px;display:flex;align-items:center;justify-content:center;font-size:11px}
.ds-pp-step.is-done .ds-pp-mark{background:var(--pp-ok);color:#0b2a14}
.ds-pp-step.is-active .ds-pp-mark{border:2px solid var(--pp-blue)}
.ds-pp-step.is-active .ds-pp-mark::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--pp-blue);animation:ds-pp-pulse 1.1s ease-in-out infinite}
.ds-pp-step.is-pending .ds-pp-mark{border:1.5px solid rgba(255,255,255,.22)}
.ds-pp-step-tx{font-size:13px;line-height:1.4}
.ds-pp-step.is-done .ds-pp-step-tx{color:var(--pp-faint)}
.ds-pp-step.is-active .ds-pp-step-tx{color:var(--pp-text);font-weight:560}
.ds-pp-step.is-pending .ds-pp-step-tx{color:var(--pp-muted)}
.ds-pp-step-now{display:block;font-size:11.5px;color:var(--pp-faint);font-family:"SF Mono",ui-monospace,Menlo,monospace;margin-top:2px;word-break:break-word}
.ds-pp-step-now:empty{display:none}
.ds-pp-now{padding:8px 14px;font-size:12.5px;color:var(--pp-muted);font-family:"SF Mono",ui-monospace,Menlo,monospace;word-break:break-word;overflow:auto;flex:1;min-height:24px}
.ds-pp-now[hidden]{display:none}
.ds-pp-live{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:.5px solid var(--pp-line);font-size:11.5px;color:var(--pp-faint);font-variant-numeric:tabular-nums}
.ds-pp-live[hidden]{display:none}
.ds-pp-live-dot{width:6px;height:6px;border-radius:50%;background:var(--pp-ok);flex:none;animation:ds-pp-pulse 1.6s ease-in-out infinite}
.ds-pp-live.is-error .ds-pp-live-dot{background:var(--pp-err);animation:none}
.ds-pp-live.is-done .ds-pp-live-dot{animation:none}
.ds-pp-live-count{margin-left:auto}
@keyframes ds-pp-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.ds-pp-details{border-top:.5px solid var(--pp-line);padding:8px 14px 10px}
.ds-pp-details[hidden]{display:none}
.ds-pp-details>summary{font-size:10.5px;color:var(--pp-faint);cursor:pointer;text-transform:uppercase;letter-spacing:.04em}
.ds-pp-raw{margin:6px 0 0;max-height:160px;overflow:auto;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--pp-faint);white-space:pre-wrap;word-break:break-word}
.ds-pp-foot{padding:10px 14px;border-top:.5px solid var(--pp-line);font-size:12px;color:var(--pp-text);display:flex;align-items:center;gap:9px}
.ds-pp-foot[hidden]{display:none}
.ds-pp-foot .ds-pp-reload{font:inherit;font-size:12px;font-weight:650;color:#fff;background:var(--pp-blue);border:none;border-radius:8px;padding:6px 11px;cursor:pointer}
`;
}

/** The panel markup fragment; \`variant\` only sets the outer positioning class. */
export function progressPanelMarkup(variant: 'inline' | 'floating'): string {
  return `<div class="ds-pp" data-variant="${variant}" hidden aria-live="polite">
  <div class="ds-pp-head">
    <span class="ds-pp-spin" aria-hidden="true" hidden></span>
    <span class="ds-pp-title">Preparing…</span>
    <span class="ds-pp-agent"></span>
    <span class="ds-pp-flex"></span>
    <button class="ds-pp-stop" data-pp-stop hidden>Stop</button>
    <button class="ds-pp-close" data-pp-close hidden>Close</button>
  </div>
  <div class="ds-pp-sub"><span class="ds-pp-repo"></span></div>
  <ol class="ds-pp-plan"></ol>
  <div class="ds-pp-now" hidden></div>
  <div class="ds-pp-live" hidden><span class="ds-pp-live-dot" aria-hidden="true"></span><span class="ds-pp-live-tx">Starting…</span><span class="ds-pp-live-count"></span></div>
  <details class="ds-pp-details" hidden><summary>Details</summary><pre class="ds-pp-raw"></pre></details>
  <div class="ds-pp-foot" hidden></div>
</div>`;
}

/** Browser script: defines a global ProgressPanel(root, opts) driven by progress events. */
export function progressPanelScript(): string {
  return `
function ProgressPanel(root, opts){
  opts = opts || {};
  var NL = String.fromCharCode(10);
  function q(sel){ return root.querySelector(sel); }
  var els = {
    title:q('.ds-pp-title'), agent:q('.ds-pp-agent'), repo:q('.ds-pp-repo'), spin:q('.ds-pp-spin'),
    plan:q('.ds-pp-plan'), now:q('.ds-pp-now'), live:q('.ds-pp-live'),
    liveTx:q('.ds-pp-live-tx'), liveCount:q('.ds-pp-live-count'),
    details:q('.ds-pp-details'), raw:q('.ds-pp-raw'), foot:q('.ds-pp-foot'),
    stop:q('[data-pp-stop]'), close:q('[data-pp-close]')
  };
  var WORK={guided_review:'Writing your review',detailed_audit:'Writing your review',address:'Addressing comments'};
  var DONE={guided_review:'Review ready',detailed_audit:'Review ready',address:'Comments addressed'};
  var workflow='', hasPlan=false, planTotal=0, planDone=0, activeNow=null, curState='Working';
  var t0=0, timer=null;
  function elapsed(){ var s=Math.round((Date.now()-t0)/1000); return s<60?(s+'s'):(Math.floor(s/60)+'m '+(s%60)+'s'); }
  function setLive(state, quietMs){
    if(!els.liveTx)return;
    var q2=(typeof quietMs==='number')?Math.round(quietMs/1000):0;
    els.liveTx.textContent=(state||'Working')+' · '+elapsed()+(q2>=8?(' · quiet '+q2+'s'):'');
  }
  function tick(){ setLive(curState,0); }
  function clip(s,n){ s=String(s||'').replace(/\\s+/g,' ').trim(); return s.length>n?s.slice(0,n)+'…':s; }
  function firstLine(s){ s=String(s||''); var i=s.indexOf(NL); return i>=0?s.slice(0,i):s; }
  function setCurrent(text){
    var t=clip(text,120); if(!t)return;
    if(activeNow){ activeNow.textContent=t; if(els.now)els.now.hidden=true; }
    else if(els.now){ els.now.textContent=t; els.now.hidden=false; }
  }
  function renderPlan(items){
    if(!els.plan||!items||!items.length)return;
    hasPlan=true; planTotal=items.length; planDone=0; activeNow=null;
    els.plan.textContent=''; if(els.now)els.now.hidden=true;
    for(var i=0;i<items.length;i++){
      var it=items[i]||{}; var st=it.status||'pending';
      var li=document.createElement('li'); li.className='ds-pp-step is-'+st;
      var mk=document.createElement('span'); mk.className='ds-pp-mark';
      if(st==='done'){ mk.textContent='✓'; planDone++; }
      var tx=document.createElement('span'); tx.className='ds-pp-step-tx'; tx.textContent=it.text||'';
      li.appendChild(mk); li.appendChild(tx);
      if(st==='active'){ var now=document.createElement('span'); now.className='ds-pp-step-now'; tx.appendChild(now); activeNow=now; }
      els.plan.appendChild(li);
    }
    els.plan.scrollTop=els.plan.scrollHeight;
    if(els.liveCount)els.liveCount.textContent=planDone+' of '+planTotal+' done';
  }
  function agentChip(agent,model){ var a=agent?(agent.charAt(0).toUpperCase()+agent.slice(1)):'Agent'; return model?(a+' · '+model):a; }
  function repoLine(ev){
    var p=ev.repoName||'';
    if(ev.base){ p+=' · '+ev.base+' → '+(ev.head||'working tree'); }
    if(typeof ev.targetCount==='number'){ p+=' · '+ev.targetCount+' '+(ev.targetCount===1?'comment':'comments'); }
    return p;
  }
  function start(){
    root.hidden=false; t0=Date.now();
    workflow=''; hasPlan=false; planTotal=0; planDone=0; activeNow=null; curState='Working';
    if(els.spin)els.spin.hidden=false;
    if(els.stop)els.stop.hidden=false;
    if(els.close)els.close.hidden=true;
    if(els.title)els.title.textContent='Preparing…';
    if(els.plan)els.plan.textContent='';
    if(els.now){els.now.textContent='';els.now.hidden=true;}
    if(els.raw)els.raw.textContent='';
    if(els.details)els.details.hidden=true;
    if(els.foot){els.foot.hidden=true; els.foot.textContent='';}
    if(els.live){els.live.hidden=false; els.live.className='ds-pp-live';}
    if(els.liveCount)els.liveCount.textContent='';
    if(timer)clearInterval(timer); timer=setInterval(tick,1000); setLive('Preparing',0);
  }
  function stopTimer(){ if(timer){clearInterval(timer);timer=null;} }
  function handle(ev){
    if(!ev||!ev.type)return;
    switch(ev.type){
      case 'run_started':
        workflow=ev.workflow||'';
        if(els.title)els.title.textContent=WORK[workflow]||ev.label||'Working…';
        curState='Working'; setLive('Working',0); break;
      case 'context':
        if(els.agent)els.agent.textContent=agentChip(ev.agent,ev.model);
        if(els.repo)els.repo.textContent=repoLine(ev); break;
      case 'phase':
        if(ev.phase==='validating_output'||ev.phase==='applying_results'){
          if(els.title)els.title.textContent='Checking the result…';
          curState='Checking'; setLive('Checking',0);
        } break;
      case 'plan': renderPlan(ev.items); break;
      case 'file': setCurrent(ev.label); break;
      case 'command': setCurrent(ev.label); break;
      case 'activity': setCurrent(ev.label); break;
      case 'tool': setCurrent(ev.label); break;
      case 'text':
        if(els.raw){ els.raw.textContent+=ev.data||''; els.raw.scrollTop=els.raw.scrollHeight; }
        if(!hasPlan){ var ln=clip(firstLine(ev.data),120); if(ln)setCurrent(ln); } break;
      case 'heartbeat': setLive(curState, ev.quietMs); break;
      case 'warning': if(els.raw)els.raw.textContent+='[warn] '+(ev.label||'')+NL; break;
      case 'error': if(els.raw)els.raw.textContent+='[error] '+(ev.label||'')+(ev.detail?(' — '+ev.detail):'')+NL; break;
      case 'run_done': finish(ev.status, ev.result||{}); break;
    }
  }
  function finish(status, result){
    stopTimer();
    if(els.spin)els.spin.hidden=true;
    if(els.stop)els.stop.hidden=true;
    if(els.close)els.close.hidden=false;
    var ok=(status==='complete');
    if(els.title)els.title.textContent=ok?(DONE[workflow]||'Done'):(status==='stopped')?'Stopped':"Couldn't finish";
    if(els.now)els.now.hidden=true;
    if(els.live){
      els.live.className='ds-pp-live '+(ok?'is-done':'is-error');
      if(els.liveTx)els.liveTx.textContent=(ok?'Done':(status==='stopped')?'Stopped':'Failed')+' · '+elapsed();
    }
    if(!ok && els.details && els.raw && els.raw.textContent.trim()) els.details.hidden=false;
    if(opts.onDone)opts.onDone(status, result||{});
  }
  function blocked(err){
    root.hidden=false; stopTimer();
    if(els.spin)els.spin.hidden=true;
    if(els.stop)els.stop.hidden=true;
    if(els.close)els.close.hidden=false;
    if(els.title)els.title.textContent='Cannot start';
    if(els.live){ els.live.hidden=false; els.live.className='ds-pp-live is-error';
      if(els.liveTx)els.liveTx.textContent=(err&&err.label)||'Blocked'; if(els.liveCount)els.liveCount.textContent=''; }
    if(els.foot){ els.foot.hidden=false; els.foot.textContent=(err&&err.detail)||(err&&err.label)||'Blocked.'; }
  }
  if(els.stop)els.stop.addEventListener('click',function(){ if(opts.onStop)opts.onStop(); });
  if(els.close)els.close.addEventListener('click',function(){ if(opts.onClose)opts.onClose(); else root.hidden=true; });
  return { root:root, els:els, start:start, handle:handle, finish:finish, blocked:blocked,
           showFoot:function(node){ if(els.foot){els.foot.hidden=false; els.foot.textContent=''; els.foot.appendChild(node);} } };
}

/** Drive one agent run: POST the payload, stream NDJSON into the panel, stage blocked/stopped/failed. */
function runProgress(panel, url, payload, ctrl){
  var NL=String.fromCharCode(10);
  return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctrl?ctrl.signal:undefined})
    .then(function(r){
      if(!r.ok||!r.body){
        return r.json().then(function(j){ panel.blocked(j||{label:'Could not start.'}); },
                            function(){ panel.blocked({label:'Could not start.'}); });
      }
      var rd=r.body.getReader(),dec=new TextDecoder(),buf='';
      function pump(){return rd.read().then(function(res){
        if(res.done){ if(buf.trim()){try{panel.handle(JSON.parse(buf));}catch(e){}} return; }
        buf+=dec.decode(res.value,{stream:true});var parts=buf.split(NL);buf=parts.pop();
        for(var i=0;i<parts.length;i++){var ln=parts[i];if(!ln.trim())continue;var ev;try{ev=JSON.parse(ln);}catch(e){continue;}panel.handle(ev);}
        return pump();
      });}
      return pump();
    })
    .catch(function(){
      if(ctrl&&ctrl.signal.aborted)panel.finish('stopped',{});
      else panel.finish('failed',{});
    });
}
`;
}
```

Note on the escaped regex: inside the returned template literal, `clip` uses `/\\s+/g` so the compiled browser string contains a literal `\s+`. Keep the double backslash.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run build && node --test test/progress-ui.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progress-ui.ts dist/progress-ui.js test/progress-ui.test.mjs
git commit -m "feat(progress-ui): plan-centric panel — agent checklist, live line, honest liveness"
```

---

### Task 4: Fix dependent tests and verify the whole build

The panel rewrite removed markup tokens (`ds-pp-timeline`, `ds-pp-phase-label`, `ds-pp-rawwrap`, "Raw agent output") that other tests assert against. Find and fix every reference, then run the full suite.

**Files:**
- Modify (only the assertions that reference removed tokens): `test/render-page.test.mjs`, `test/change-page.test.mjs`, and any other test the sweep below flags. Leave the unrelated in-progress edits in `render-page.test.mjs` / `change-route.test.mjs` untouched.

- [ ] **Step 1: Find every stale reference**

Run: `grep -rn "ds-pp-timeline\|ds-pp-phase-label\|ds-pp-phase\b\|ds-pp-rawwrap\|ds-pp-meta\|Raw agent output\|Updating the plan" test/`
Expected: a small list (e.g. `test/render-page.test.mjs` asserting `/ds-pp-timeline/`). Note each file:line.

- [ ] **Step 2: Update each flagged assertion**

For an assertion that the panel markup renders, swap the removed token for a current one. Example — in `test/render-page.test.mjs`, the line `assert.match(html, /ds-pp-timeline/);` becomes:

```js
  assert.match(html, /ds-pp-plan/);
```

Apply the analogous swap (`ds-pp-phase-label` → `ds-pp-title`, `ds-pp-meta` → `ds-pp-live`) for any other flagged line. Do not touch assertions unrelated to the panel.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS — all files green. (`npm test` runs `npm run build` first, so `dist/` is fresh.)

- [ ] **Step 4: Confirm dist is rebuilt and staged**

Run: `git status --porcelain dist/`
Expected: `dist/progress.js`, `dist/agent.js`, `dist/progress-ui.js` reflect the new code (already committed in Tasks 1-3). If `npm test`'s build produced any further `dist/` deltas for these three files, stage them. Do not stage the pre-existing unrelated `dist/server.js` / `dist/render.js` / `dist/page-assets.js` edits.

- [ ] **Step 5: Commit**

```bash
git add test/render-page.test.mjs test/change-page.test.mjs
git commit -m "test: update panel assertions for the plan-centric markup"
```

---

## Manual verification (after Task 4)

Tests cover the string builders and the protocol, but the panel's runtime behavior is best confirmed live. Run the app against a repo with a real change and watch one generate run:

- The checklist appears once the agent calls `TodoWrite`; done items recede, the active item is lit and shows a live file/command line under it.
- Before the first plan, a single calm "now" line shows instead of an empty checklist.
- The footer reads "Working · <elapsed>" with the count, and ends on "Review ready" / "Done".
- Force a failure (e.g. point at a repo with no agent installed) and confirm the blocked state and, for a mid-run failure, the Details disclosure exposing raw output.

Use the `run` skill or `npm run dev` to launch.

## Self-review notes

- **Spec coverage:** plan event (Task 1) ✓; stop discarding TodoWrite (Task 2) ✓; plan-centric panel with live line, lifecycle label, fallback, failure-only raw (Task 3) ✓; server pass-through (no change needed — `runWorkflow.send` JSON-stringifies any event, confirmed) ✓; dist rebuild + dependent tests (Task 4) ✓.
- **Standalone-line fallback when a plan has no active item:** handled — `renderPlan` leaves `activeNow=null` when no item is `active`, so `setCurrent` writes to `.ds-pp-now` (shown) rather than nesting.
- **Type consistency:** `PlanItem`/`PlanStatus`/`planEvent` defined in Task 1 are consumed by `planItems`/`classifyTool` in Task 2 with identical shapes; the panel reads `ev.items[i].{text,status}` matching `PlanItem`.
```
