# Story-Shaped Progress + Generating-State Takeover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace tool-spam progress with an honest milestone spine + live agent narration + changed-file counts in the shared ProgressPanel, and make the change page's story tab become a full-width progress stage while a story generates.

**Architecture:** The app-owned progress protocol (`src/progress.ts`) gains two story phases, a `>>` note-line parser, and a stateful file-event enricher. The story prompt (`src/agent.ts`) orders the agent to print exact `>>` phase markers and notes. The server (`src/server.ts`) parses those from `text` events into phase/narration events and enriches file events against the diff scope. The shared panel (`src/progress-ui.ts`) renders a workflow-specific milestone strip + a narration line, and gains a full-width `stage` variant that the change page mounts into the story tab intro during generation (`src/page-assets.ts`).

**Tech Stack:** TypeScript compiled with `tsc` (Node >= 20), zero-dependency HTTP server, client JS delivered as template-literal strings, `node --test` tests in `test/*.test.mjs` importing from `dist/`.

**Spec:** `docs/superpowers/specs/2026-07-03-story-progress-takeover-design.md`

## Global Constraints

- `npm test` runs `npm run build` first; tests import from `../dist/*.js`, never from `src/`.
- Every commit that touches `src/` MUST also `git add dist` (GitHub installs have no build step — repo rule).
- Client-side code inside `progressPanelScript()` / `PAGE_JS` template strings is ES5-style: `var`, `function`, string concatenation — no arrow functions, no template literals, no `const/let`.
- Honest progress only: milestones advance only on parsed markers or observed evidence; no fake percentages or timers.
- Exact marker strings (case-insensitive match, trimmed): `>> Recovering the why`, `>> Designing the reading path`, `>> Writing the steps`.
- UI follows the existing Apple-HIG styling in the panel/page CSS: reuse the existing CSS custom properties (`--pp-*`, `--line-soft`, etc.); do not invent new color literals beyond what the panel already defines.
- New phases `recovering_why` and `designing_path` order as: `… → agent_running → reading_changes → recovering_why → designing_path → writing_output → …`.

---

### Task 1: Protocol — new phases + command-evidence inference

**Files:**
- Modify: `src/progress.ts` (Phase union ~line 6, `PHASE_LABELS` ~line 49, `PHASE_ORDER` ~line 66, `observedPhase` ~line 139)
- Test: `test/progress.test.mjs`

**Interfaces:**
- Produces: `Phase` union now includes `'recovering_why'` and `'designing_path'`; `PHASE_LABELS.recovering_why === 'Recovering the why'`, `PHASE_LABELS.designing_path === 'Designing the reading path'`; `observedPhase(commandEvent('git log …'), false) === 'recovering_why'`. Later tasks (server, panel) rely on these exact phase names.

- [ ] **Step 1: Write the failing tests**

Append to `test/progress.test.mjs`:

```js
test('story phases slot between reading and writing, with labels', () => {
  assert.ok(phaseRank('reading_changes') < phaseRank('recovering_why'));
  assert.ok(phaseRank('recovering_why') < phaseRank('designing_path'));
  assert.ok(phaseRank('designing_path') < phaseRank('writing_output'));
  assert.equal(PHASE_LABELS.recovering_why, 'Recovering the why');
  assert.equal(PHASE_LABELS.designing_path, 'Designing the reading path');
});

test('observedPhase proves recovering_why on intent-evidence commands only', () => {
  assert.equal(observedPhase(commandEvent('git log --oneline -15 main..HEAD'), false), 'recovering_why');
  assert.equal(observedPhase(commandEvent('gh pr view --json title,body'), false), 'recovering_why');
  assert.equal(observedPhase(commandEvent('git diff --stat'), false), null);
  assert.equal(observedPhase(commandEvent('npm test'), false), null);
});
```

Also extend the existing `'PHASE_LABELS covers every phase'` test: add `'recovering_why', 'designing_path'` to its phase list (after `'reading_changes'`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -A 3 "story phases\|recovering_why"`
Expected: FAIL — `phaseRank: unknown phase "recovering_why"` (RangeError) and label assertions failing.

- [ ] **Step 3: Implement in `src/progress.ts`**

Extend the `Phase` union (insert after `'reading_changes'`):

```ts
export type Phase =
  | 'idle' | 'preflight' | 'resolving_context' | 'preparing_prompt'
  | 'starting_agent' | 'agent_running' | 'reading_changes'
  | 'recovering_why' | 'designing_path' | 'writing_output'
  | 'validating_output' | 'applying_results' | 'complete' | 'failed' | 'stopped';
```

Add to `PHASE_LABELS` (after `reading_changes`):

```ts
  recovering_why: 'Recovering the why',
  designing_path: 'Designing the reading path',
```

Update `PHASE_ORDER`:

```ts
const PHASE_ORDER: Phase[] = [
  'idle', 'preflight', 'resolving_context', 'preparing_prompt', 'starting_agent',
  'agent_running', 'reading_changes', 'recovering_why', 'designing_path',
  'writing_output', 'validating_output', 'applying_results', 'complete',
];
```

Extend `observedPhase` — insert the command branch before the `activity` branch:

```ts
export function observedPhase(event: ProgressEvent, isTargetWrite: boolean): Phase | null {
  if (event.type === 'file') {
    if (event.action === 'read') return 'reading_changes';
    if (isTargetWrite) return 'writing_output';
    return null;
  }
  // Intent-evidence commands (the story prompt's Phase 1) prove the agent is
  // recovering the why; keep the pattern narrow so ordinary git use doesn't match.
  if (event.type === 'command' && /\bgit log\b|\bgh pr view\b/.test(event.command)) {
    return 'recovering_why';
  }
  if (event.type === 'activity' && event.kind === 'search') return 'reading_changes';
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS (including the previously-passing spine tests — the monotonic order still ends in `complete`).

- [ ] **Step 5: Commit**

```bash
git add src/progress.ts test/progress.test.mjs dist
git commit -m "feat: recovering_why and designing_path phases with command-evidence inference"
```

---

### Task 2: Protocol — `>>` agent-note parser

**Files:**
- Modify: `src/progress.ts` (append after `observedPhase`)
- Test: `test/progress.test.mjs`

**Interfaces:**
- Consumes: `phaseEvent`, `activityEvent` (existing), phases from Task 1.
- Produces: `parseAgentNoteLine(line: string): ProgressEvent | null` and `noteEventsFromText(data: string): ProgressEvent[]`. Exact markers (case-insensitive, trimmed) return `phaseEvent('recovering_why' | 'designing_path' | 'writing_output')`; any other `>> text` returns `activityEvent('narration', text)` clipped to 300 chars; non-`>>` lines return null. The server (Task 5) calls `noteEventsFromText` on every `text` event.

- [ ] **Step 1: Write the failing tests**

Append to `test/progress.test.mjs` (add `parseAgentNoteLine, noteEventsFromText` to the import list at the top):

```js
test('parseAgentNoteLine maps exact markers to phases, other notes to narration', () => {
  assert.deepEqual(parseAgentNoteLine('>> Recovering the why'), phaseEvent('recovering_why'));
  assert.deepEqual(parseAgentNoteLine('  >> designing the reading path'), phaseEvent('designing_path'));
  assert.deepEqual(parseAgentNoteLine('>> Writing the steps'), phaseEvent('writing_output'));
  assert.deepEqual(
    parseAgentNoteLine('>> Goal: enable keepers to cap the fee'),
    activityEvent('narration', 'Goal: enable keepers to cap the fee'),
  );
  assert.equal(parseAgentNoteLine('Reading src/x.ts'), null);
  assert.equal(parseAgentNoteLine('>>'), null);
  assert.equal(parseAgentNoteLine('>>   '), null);
  assert.equal(parseAgentNoteLine(''), null);
});

test('parseAgentNoteLine clips runaway narration to 300 chars', () => {
  const long = '>> ' + 'x'.repeat(400);
  const e = parseAgentNoteLine(long);
  assert.equal(e.type, 'activity');
  assert.equal(e.label.length, 301); // 300 + ellipsis
  assert.ok(e.label.endsWith('…'));
});

test('noteEventsFromText scans multi-line chunks and skips plain prose', () => {
  const evs = noteEventsFromText('thinking about it\n>> Recovering the why\n>> Goal: X\nplain line');
  assert.equal(evs.length, 2);
  assert.equal(evs[0].type, 'phase');
  assert.equal(evs[0].phase, 'recovering_why');
  assert.deepEqual(evs[1], activityEvent('narration', 'Goal: X'));
  assert.deepEqual(noteEventsFromText('no notes here'), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -B1 -A3 "parseAgentNoteLine\|noteEventsFromText"`
Expected: FAIL — build error or `parseAgentNoteLine is not a function` (named export missing).

- [ ] **Step 3: Implement in `src/progress.ts`**

Append after `observedPhase`:

```ts
// Exact phase markers the story prompt tells the agent to print (matched
// case-insensitively after trimming). Anything else after ">> " is narration.
const NOTE_MARKERS: Array<[string, Phase]> = [
  ['recovering the why', 'recovering_why'],
  ['designing the reading path', 'designing_path'],
  ['writing the steps', 'writing_output'],
];

const NARRATION_CAP = 300;

/**
 * Parse one stdout line as an agent note: ">> <marker>" advances a phase,
 * ">> <anything else>" is live narration for the panel. Non-note lines → null.
 */
export function parseAgentNoteLine(line: string): ProgressEvent | null {
  const m = /^\s*>>\s*(.+?)\s*$/.exec(line);
  if (!m) return null;
  const text = m[1];
  const low = text.toLowerCase();
  for (const [marker, phase] of NOTE_MARKERS) {
    if (low === marker) return phaseEvent(phase);
  }
  const clipped = text.length > NARRATION_CAP ? text.slice(0, NARRATION_CAP) + '…' : text;
  return activityEvent('narration', clipped);
}

/** All note events found in a (possibly multi-line) agent text chunk. */
export function noteEventsFromText(data: string): ProgressEvent[] {
  const out: ProgressEvent[] = [];
  for (const line of data.split('\n')) {
    const e = parseAgentNoteLine(line);
    if (e) out.push(e);
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progress.ts test/progress.test.mjs dist
git commit -m "feat: parse '>>' agent notes into phase and narration events"
```

---

### Task 3: Protocol — file-scope enricher (repo-relative paths + honest counts)

**Files:**
- Modify: `src/progress.ts` (file event type ~line 39, append enricher after Task 2's code)
- Test: `test/progress.test.mjs`

**Interfaces:**
- Consumes: the `file` ProgressEvent shape.
- Produces: `interface FileScope { repoPath: string; changedFiles: string[] }` and `createFileEnricher(scope: FileScope): (ev: ProgressEvent) => ProgressEvent`. File events gain optional `rel?: string; changedIndex?: number; changedTotal?: number` and a rewritten `label`. Non-file events pass through by reference. The server (Task 5) wraps every outgoing event with this.

- [ ] **Step 1: Write the failing tests**

Append to `test/progress.test.mjs` (add `createFileEnricher` to the import list):

```js
test('createFileEnricher relativizes paths and counts distinct changed-file reads', () => {
  const enrich = createFileEnricher({ repoPath: '/repo', changedFiles: ['src/a.ts', 'src/b.ts'] });
  const e1 = enrich(fileEvent('read', 'Read', '/repo/src/a.ts'));
  assert.equal(e1.rel, 'src/a.ts');
  assert.equal(e1.changedIndex, 1);
  assert.equal(e1.changedTotal, 2);
  assert.equal(e1.label, 'Reading changed files · 1 of 2 · src/a.ts');
  // Re-reading the same file does not inflate the count.
  assert.equal(enrich(fileEvent('read', 'Read', '/repo/src/a.ts')).changedIndex, 1);
  assert.equal(enrich(fileEvent('read', 'Read', '/repo/src/b.ts')).changedIndex, 2);
  // A read given repo-relative (agent cwd = repo) still matches.
  const enrich2 = createFileEnricher({ repoPath: '/repo', changedFiles: ['src/a.ts'] });
  assert.equal(enrich2(fileEvent('read', 'Read', 'src/a.ts')).changedIndex, 1);
  // Context reads outside the scope stay plain but repo-relative.
  const ctx = enrich(fileEvent('read', 'Read', '/repo/docs/notes.md'));
  assert.equal(ctx.label, 'Reading docs/notes.md');
  assert.equal(ctx.changedIndex, undefined);
  // Writes are labeled relative but never counted as changed-file reads.
  const w = enrich(fileEvent('write', 'Write', '/repo/src/a.ts'));
  assert.equal(w.changedIndex, undefined);
  assert.equal(w.label, 'Writing src/a.ts');
  // Non-file events pass through by reference.
  const t = textEvent('x');
  assert.equal(enrich(t), t);
});

test('createFileEnricher with an empty scope only relativizes', () => {
  const enrich = createFileEnricher({ repoPath: '/repo', changedFiles: [] });
  const e = enrich(fileEvent('read', 'Read', '/repo/src/a.ts'));
  assert.equal(e.label, 'Reading src/a.ts');
  assert.equal(e.changedTotal, undefined);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -B1 -A3 "createFileEnricher"`
Expected: FAIL — `createFileEnricher is not a function`.

- [ ] **Step 3: Implement in `src/progress.ts`**

Extend the `file` member of the `ProgressEvent` union:

```ts
  | { type: 'file'; label: string; rawTool: string; target: string; action: FileAction;
      rel?: string; changedIndex?: number; changedTotal?: number }
```

Append after `noteEventsFromText`:

```ts
export interface FileScope {
  repoPath: string;
  changedFiles: string[];
}

function relPath(target: string, repoPath: string): string {
  const root = repoPath.endsWith('/') ? repoPath : repoPath + '/';
  return target.startsWith(root) ? target.slice(root.length) : target;
}

function matchChanged(rel: string, changed: string[]): string | null {
  for (const c of changed) {
    if (rel === c || rel.endsWith('/' + c)) return c;
  }
  return null;
}

/**
 * Stateful enricher for file events: rewrites targets repo-relative and counts
 * distinct changed files the agent has read, so the panel can say "3 of 8"
 * honestly. Every other event passes through untouched.
 */
export function createFileEnricher(scope: FileScope): (ev: ProgressEvent) => ProgressEvent {
  const seen = new Set<string>();
  return (ev) => {
    if (ev.type !== 'file') return ev;
    const rel = relPath(ev.target, scope.repoPath);
    const verb = ev.action === 'read' ? 'Reading' : ev.action === 'write' ? 'Writing' : 'Editing';
    const hit = ev.action === 'read' ? matchChanged(rel, scope.changedFiles) : null;
    if (!hit) return { ...ev, rel, label: `${verb} ${rel}` };
    seen.add(hit);
    return {
      ...ev,
      rel,
      changedIndex: seen.size,
      changedTotal: scope.changedFiles.length,
      label: `Reading changed files · ${seen.size} of ${scope.changedFiles.length} · ${rel}`,
    };
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progress.ts test/progress.test.mjs dist
git commit -m "feat: file-scope enricher with repo-relative paths and changed-file counts"
```

---

### Task 4: Prompt — require live `>>` markers and notes

**Files:**
- Modify: `src/agent.ts` (the `storyPrompt` "Work in three phases" line, ~line 92)
- Test: `test/agent.test.mjs`

**Interfaces:**
- Consumes: marker strings defined in Global Constraints (must match Task 2's `NOTE_MARKERS` exactly).
- Produces: `storyPrompt(...)` output contains the marker instructions.

- [ ] **Step 1: Write the failing test**

Append to `test/agent.test.mjs` (`storyPrompt` is already imported there):

```js
test('storyPrompt requires live >> phase markers and notes', () => {
  const p = storyPrompt('main');
  assert.match(p, /">> Recovering the why"/);
  assert.match(p, /">> Designing the reading path"/);
  assert.match(p, /">> Writing the steps"/);
  assert.match(p, /starting with ">> "/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -B1 -A3 "phase markers"`
Expected: FAIL — pattern not found in the prompt.

- [ ] **Step 3: Implement in `src/agent.ts`**

Replace the line:

```ts
    `Work in three phases, in order. Phases 1 and 2 produce short visible notes in your output before any JSON; only phase 3 writes the file.\n\n` +
```

with:

```ts
    `Work in three phases, in order. Phases 1 and 2 produce short visible notes in your output before any JSON; only phase 3 writes the file.\n\n` +
    `Live progress notes (streamed to the reviewer while you work):\n` +
    `- Announce each phase as you enter it by printing its marker alone on its own line, exactly: ">> Recovering the why", then ">> Designing the reading path", then ">> Writing the steps".\n` +
    `- Print every phase note as its own line starting with ">> " — for example ">> Goal: enable keepers to cap the fee" or ">> Arc: the cap is stored, then enforced, then tested".\n` +
    `- Keep each note to one short, concrete sentence. These lines are shown live in the review UI, so no filler and no markdown.\n\n` +
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (existing storyPrompt tests must still pass — the change is purely additive).

- [ ] **Step 5: Commit**

```bash
git add src/agent.ts test/agent.test.mjs dist
git commit -m "feat: story prompt streams '>>' phase markers and live notes"
```

---

### Task 5: Server — wire notes + enricher into the workflow spine

**Files:**
- Modify: `src/server.ts` — imports (~line 48 and ~line 57), `WorkflowSpec` (~line 631), `runWorkflow` (~line 686), `runGenerate` (~line 950), `runAddress` spec (~line 880)

**Interfaces:**
- Consumes: `noteEventsFromText`, `createFileEnricher`, `FileScope` from `src/progress.ts`; `numstat` from `src/git.ts` (already exported: `numstat(repo, base, head?)` → `Array<{ path, added, removed }>`).
- Produces: NDJSON streams now carry enriched file labels, `narration` activity events, and `recovering_why` / `designing_path` phase events. No API shape changes.

- [ ] **Step 1: Extend imports and `WorkflowSpec`**

In the `./progress.js` import (line ~57), add `noteEventsFromText, createFileEnricher` and the type `FileScope`. In the `./git.js` import, add `numstat` if not present.

Add to `WorkflowSpec`:

```ts
  /** Optional file scope: relativize file-event paths and count distinct changed-file reads. */
  fileScope?: FileScope;
```

- [ ] **Step 2: Enrich and parse in `runWorkflow`**

Before `streamAgent(...)`, create the enricher:

```ts
  const enrich = spec.fileScope ? createFileEnricher(spec.fileScope) : (e: ProgressEvent) => e;
```

Replace the `onEvent` callback body:

```ts
    (ev) => {
      lastActivity = nowMs();
      const out = enrich(ev);
      send(out);
      const ph = observedPhase(out, spec.isTargetWrite(out));
      if (ph) advance(ph);
      if (out.type === 'text') {
        for (const note of noteEventsFromText(out.data)) {
          if (note.type === 'phase') advance(note.phase, note.label);
          else send(note);
        }
      }
    },
```

- [ ] **Step 3: Pass the scope from `runGenerate` and `runAddress`**

In `runGenerate`, after `const excludePaths = noiseFiles(repo, promptBase, promptHead);` add:

```ts
  // The exact changed files the review shows (noise subtracted), so file-read
  // progress can honestly say "3 of 8 changed files".
  const changedFiles = numstat(repo, promptBase, promptHead)
    .map((f) => f.path)
    .filter((p) => !excludePaths.includes(p));
```

and add to the `runWorkflow` spec object:

```ts
    fileScope: { repoPath: repo, changedFiles },
```

In `runAddress`'s spec object, add (relative paths only — no changed-file counting for address runs):

```ts
    fileScope: { repoPath: addressCtx.runRepo, changedFiles: [] },
```

- [ ] **Step 4: Build and run the full suite**

Run: `npm test`
Expected: PASS — all existing server/app tests still green (the stream additions are purely additive events).

- [ ] **Step 5: Commit**

```bash
git add src/server.ts dist
git commit -m "feat: stream narration, story phases, and changed-file counts from the workflow spine"
```

---

### Task 6: Panel — milestone strip, narration line, stage variant

**Files:**
- Modify: `src/progress-ui.ts` (styles, markup, script)
- Test: `test/progress-ui.test.mjs`

**Interfaces:**
- Consumes: `phase` events (names from Task 1), `activity` events with kind `'narration'` (Task 2), enriched file labels (Task 3, arrive pre-composed in `ev.label`).
- Produces: panel DOM regions `.ds-pp-miles` (milestone strip) and `.ds-pp-note` (narration); CSS for `data-variant="stage"`. Callers still use `ProgressPanel(root, opts)` / `runProgress(...)` unchanged; Task 7 sets `data-variant="stage"` on the existing panel node.

- [ ] **Step 1: Write the failing tests**

In `test/progress-ui.test.mjs`, extend the markup test with:

```js
    assert.match(m, /ds-pp-miles/);
    assert.match(m, /ds-pp-note/);
```

extend the script test with:

```js
  assert.match(s, /ds-pp-mile/);
  assert.match(s, /'narration'/);
  assert.ok(s.includes('Recovering the why'));
  assert.ok(s.includes('Designing the reading path'));
  assert.ok(s.includes('Writing the story'));
```

and extend the styles test with:

```js
  assert.match(css, /data-variant="stage"/);
  assert.match(css, /ds-pp-miles/);
  assert.match(css, /ds-pp-note/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -B1 -A3 "ds-pp-miles\|narration\|stage"`
Expected: FAIL on the three extended tests.

- [ ] **Step 3: Add styles**

In `progressPanelStyles()`, append before the closing backtick:

```css
.ds-pp-miles{list-style:none;display:flex;flex-wrap:wrap;gap:6px 14px;margin:0;padding:10px 14px 2px}
.ds-pp-miles[hidden]{display:none}
.ds-pp-mile{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--pp-faint)}
.ds-pp-mile-dot{flex:none;width:7px;height:7px;border-radius:50%;border:1.5px solid rgba(255,255,255,.25);box-sizing:border-box}
.ds-pp-mile.is-done{color:var(--pp-muted)}
.ds-pp-mile.is-done .ds-pp-mile-dot{background:var(--pp-ok);border-color:var(--pp-ok)}
.ds-pp-mile.is-active{color:var(--pp-text);font-weight:600}
.ds-pp-mile.is-active .ds-pp-mile-dot{background:var(--pp-blue);border-color:var(--pp-blue);animation:ds-pp-pulse 1.1s ease-in-out infinite}
.ds-pp-note{padding:10px 14px 2px;font-size:13px;line-height:1.45;color:var(--pp-text)}
.ds-pp-note[hidden]{display:none}
.ds-pp[data-variant="stage"]{margin-top:28px;display:flex;flex-direction:column;max-height:none}
.ds-pp[data-variant="stage"] .ds-pp-title{font-size:15px}
.ds-pp[data-variant="stage"] .ds-pp-miles{padding:12px 16px 4px;gap:8px 16px}
.ds-pp[data-variant="stage"] .ds-pp-mile{font-size:12.5px}
.ds-pp[data-variant="stage"] .ds-pp-note{font-size:14px;padding:12px 16px 4px}
```

- [ ] **Step 4: Add markup regions**

In `progressPanelMarkup()`, insert between the `.ds-pp-sub` div and the `.ds-pp-plan` ol:

```html
  <ol class="ds-pp-miles" hidden></ol>
  <div class="ds-pp-note" hidden></div>
```

- [ ] **Step 5: Extend the script**

In `progressPanelScript()`:

a) Add to the `els` map: `miles:q('.ds-pp-miles'), note:q('.ds-pp-note'),`

b) After the `WORK`/`DONE` maps, add the milestone definitions and state:

```js
  var MILES={
    guided_review:[
      {label:'Preparing',phases:['idle','preflight','resolving_context','preparing_prompt','starting_agent','agent_running']},
      {label:'Recovering the why',phases:['reading_changes','recovering_why']},
      {label:'Designing the reading path',phases:['designing_path']},
      {label:'Writing the story',phases:['writing_output']},
      {label:'Checking the result',phases:['validating_output','applying_results']},
      {label:'Ready',phases:['complete']}
    ],
    address:[
      {label:'Preparing',phases:['idle','preflight','resolving_context','preparing_prompt','starting_agent','agent_running']},
      {label:'Working the comments',phases:['reading_changes','recovering_why','designing_path','writing_output','applying_results']},
      {label:'Checking',phases:['validating_output']},
      {label:'Done',phases:['complete']}
    ]
  };
  MILES.detailed_audit=MILES.guided_review;
  var miles=null, mileIdx=-1;
```

c) Add render/advance/note helpers (near `renderPlan`):

```js
  function renderMiles(){
    if(!els.miles||!miles)return;
    els.miles.hidden=false; els.miles.textContent='';
    for(var i=0;i<miles.length;i++){
      var li=document.createElement('li');
      li.className='ds-pp-mile '+(i<mileIdx?'is-done':i===mileIdx?'is-active':'is-pending');
      var dot=document.createElement('span'); dot.className='ds-pp-mile-dot';
      var tx=document.createElement('span'); tx.textContent=miles[i].label;
      li.appendChild(dot); li.appendChild(tx);
      els.miles.appendChild(li);
    }
  }
  function advanceMiles(phase){
    if(!miles)return;
    for(var i=0;i<miles.length;i++){
      if(miles[i].phases.indexOf(phase)>=0){ if(i>mileIdx){mileIdx=i;renderMiles();} return; }
    }
  }
  function setNote(text){
    var t=clip(text,220); if(!t||!els.note)return;
    els.note.textContent=t; els.note.hidden=false;
  }
```

d) In `start()`, reset the new state (with the other resets):

```js
    miles=null; mileIdx=-1;
    if(els.miles){els.miles.textContent='';els.miles.hidden=true;}
    if(els.note){els.note.textContent='';els.note.hidden=true;}
```

e) In `handle()`, update three cases:

```js
      case 'run_started':
        workflow=ev.workflow||'';
        if(els.title)els.title.textContent=WORK[workflow]||ev.label||'Working…';
        miles=MILES[workflow]||null; mileIdx=miles?0:-1; if(miles)renderMiles();
        curState='Working'; setLive('Working',0); break;
```

```js
      case 'phase':
        advanceMiles(ev.phase);
        if(ev.phase==='validating_output'||ev.phase==='applying_results'){
          if(els.title)els.title.textContent='Checking the result…';
          curState='Checking'; setLive('Checking',0);
        } break;
```

```js
      case 'activity':
        if(ev.kind==='narration')setNote(ev.label);
        else setCurrent(ev.label);
        break;
```

f) In `finish()`, after computing `ok`, mark the strip complete on success:

```js
    if(ok&&miles){ mileIdx=miles.length; renderMiles(); }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, including the untouched existing panel tests.

- [ ] **Step 7: Commit**

```bash
git add src/progress-ui.ts test/progress-ui.test.mjs dist
git commit -m "feat: milestone strip, narration line, and stage variant in the shared progress panel"
```

---

### Task 7: Change page — story-tab takeover during generation

**Files:**
- Modify: `src/page-assets.ts` — the story-generation client code (`generateStory` ~line 1959 and neighbors)

**Interfaces:**
- Consumes: `ProgressPanel`, `runProgress`, `restoreAgentPanel()` (resets `data-variant` to `floating` and re-homes the node), `acRoot()`, `setBusy()`, `el(tag, cls, text)`, `$(sel, root)` — all existing in `PAGE_JS`.
- Produces: during a run the panel node mounts full-width inside `.ds-step.is-intro .ds-introwrap` as `data-variant="stage"`; the intro title/eyebrow/lede swap to generating copy; the facts grid and storygen card hide. Everything restores on stop/failure via `onClose` or a "Try again" foot button. Completion still navigates to the review URL.

- [ ] **Step 1: Add the takeover helpers**

In `PAGE_JS`, next to `storyGenEls()`, add:

```js
  var storyIntroSaved=null;
  function storyIntroEls(){
    var wrap=document.querySelector('.ds-step.is-intro .ds-introwrap');
    if(!wrap)return null;
    return {
      wrap:wrap,
      title:$('.ds-intro-title',wrap),
      lede:$('.ds-intro-lede',wrap),
      eyebrow:$('.ds-intro-eyebrow span',wrap),
      facts:$('.ds-intro-facts',wrap),
      card:$('.ds-storygen-card',wrap)
    };
  }
  function mountPanelInStage(e){
    var node=acRoot(); if(!node)return null;
    node.setAttribute('data-variant','stage');
    var mount=document.getElementById('ds-storystage');
    if(!mount){
      mount=document.createElement('div'); mount.id='ds-storystage';
      e.wrap.insertBefore(mount,e.card||null);
    }
    mount.appendChild(node);
    return node;
  }
  function setStoryGenerating(on){
    var e=storyIntroEls(); if(!e)return;
    if(on){
      if(!storyIntroSaved)storyIntroSaved={
        title:e.title?e.title.textContent:'',
        lede:e.lede?e.lede.textContent:'',
        eyebrow:e.eyebrow?e.eyebrow.textContent:''
      };
      if(e.title)e.title.textContent='Writing the story of this change';
      if(e.eyebrow)e.eyebrow.textContent='Story in progress';
      if(e.lede)e.lede.textContent='Keep reading the diff under All files — the story will land here when it is ready.';
      if(e.facts)e.facts.hidden=true;
      if(e.card)e.card.hidden=true;
    }else{
      if(storyIntroSaved){
        if(e.title)e.title.textContent=storyIntroSaved.title;
        if(e.lede)e.lede.textContent=storyIntroSaved.lede;
        if(e.eyebrow)e.eyebrow.textContent=storyIntroSaved.eyebrow;
      }
      if(e.facts)e.facts.hidden=false;
      if(e.card)e.card.hidden=false;
    }
  }
```

- [ ] **Step 2: Rewrite `generateStory` to use the stage**

Replace the body of `generateStory(btn)` with:

```js
  function generateStory(btn){
    if(agentBusy){toast('The agent is already working — wait for it to finish.');return;}
    restoreAgentPanel();
    var intro=storyIntroEls();
    var root=intro?mountPanelInStage(intro):acRoot();
    if(!root)return;
    if(intro)setStoryGenerating(true);
    var reviewUrl=btn.getAttribute('data-review-url')||'';
    var e=storyGenEls();
    var model=e.modelSel?e.modelSel.value:'';
    var payload={
      base:btn.getAttribute('data-base')||undefined,
      head:btn.getAttribute('data-head')||undefined,
      agent:e.agentSel&&e.agentSel.value?e.agentSel.value:undefined,
      model:model||undefined,
      mode:e.modeSel&&e.modeSel.value?e.modeSel.value:undefined
    };
    var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
    acAbort=ctrl;
    function restoreForm(){
      setStoryGenerating(false); restoreAgentPanel();
      btn.disabled=false; setBusy(false); acAbort=null;
    }
    var panel=new ProgressPanel(root,{
      onStop:function(){ if(acAbort)acAbort.abort(); },
      onClose:function(){ restoreForm(); },
      onBlocked:function(){ setBusy(false); acAbort=null; btn.disabled=false; },
      onDone:function(status,result){
        setBusy(false); acAbort=null; btn.disabled=false;
        if(status==='complete'&&result&&result.storyWritten&&reviewUrl){location.href=reviewUrl;return;}
        if(status==='stopped'){restoreForm();return;}
        var again=el('button','ds-pp-reload','Try again');
        again.onclick=function(){ restoreForm(); };
        panel.showFoot(again);
      }
    });
    btn.disabled=true; setBusy(true); panel.start();
    runProgress(panel,'/api/generate',payload,ctrl);
  }
```

Note: `restoreAgentPanel()` already resets `data-variant` to `floating`, hides the node, and re-homes it under `#ds-agentpanel` — no new restore logic needed for the panel itself.

- [ ] **Step 3: Build and run the suite**

Run: `npm test`
Expected: PASS (this task is client-string-only; existing page tests must stay green).

- [ ] **Step 4: Verify in the browser**

From a repo with a diff (this repo works — it has changes on main vs an older ref):

```bash
node dist/cli.js
```

Open the printed URL, pick a scope with changes, open the Story tab (storyless), then:
1. Click **Generate story** — the form must disappear, the title must swap to "Writing the story of this change", the lede must point at All files, and the full-width stage panel must show the milestone strip with "Preparing" active.
2. Switch to **All files** — the diff must remain fully readable during the run.
3. Back on the story tab, press **Stop** — a "Try again" foot button must appear; clicking it must restore the form, title, lede, and facts exactly.
4. If an agent is available, let a run go long enough to see: milestone advancing on `>>` markers, a narration line in text type, and "Reading changed files · n of N · path" in the small activity line.
5. On completion, the page must navigate to the review as before.

- [ ] **Step 5: Commit**

```bash
git add src/page-assets.ts dist
git commit -m "feat: story tab becomes a full-width progress stage while generating"
```

---

### Task 8: End-to-end verification

**Files:**
- No new files; fixes only if verification finds issues.

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Full-run browser pass**

Repeat Task 7 Step 4 with a real agent run end-to-end (Claude or Codex, brief mode for speed). Confirm:
- Milestones advance in order and never move backwards.
- Narration lines appear as the agent prints `>>` notes; if the agent forgets them, the strip still advances on evidence (git log command, file reads, story.json write) — never a frozen "Preparing".
- The review screen's floating panel (open an existing review, use "Send to agent" on a comment or regenerate) shows the same milestone strip + narration with no layout breakage in the floating variant.

- [ ] **Step 3: Commit any fixes and rebuild dist**

```bash
git add -A src dist test
git commit -m "fix: post-verification adjustments to story progress"
```

(Skip the commit if verification found nothing.)
