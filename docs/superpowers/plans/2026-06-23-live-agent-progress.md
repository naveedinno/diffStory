# Live Agent Progress Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every agent-driven workflow (generate guided review, generate detailed audit, address one/all comments) an app-owned live-progress layer so a user can always tell what's running, on which repo/scope, with which agent, what phase it's in, what it last did, whether it's alive, and whether it failed/stopped/completed.

**Architecture:** A new pure `src/progress.ts` defines a normalized `ProgressEvent` NDJSON protocol plus helpers. `src/agent.ts` normalizes Claude/Codex stream output into those events and stages startup-vs-execution failures. `src/server.ts` gains a shared `runWorkflow` core that emits the app-owned spine (run_started → context → phases → heartbeat → run_done) around `streamAgent`, with structured preflight blocking. A new `src/progress-ui.ts` ships one shared client panel (styles + markup + a global `ProgressPanel`) embedded by both the change screen and the review screen.

**Tech Stack:** TypeScript compiled with `tsc` to `dist/` (NodeNext, ES2022). Node built-in `node:http` server, no framework. Node built-in test runner (`node --test`), assertions via `node:assert/strict`. Frontend is hand-written vanilla JS embedded as template strings (no bundler).

## Global Constraints

- **Commit a rebuilt `dist/` with every `src/` change.** GitHub installs have no build step. `npm test` runs `npm run build` first, so building happens automatically before tests; the commit must `git add` the changed `dist/*.js` alongside `src/`.
- **Tests import from `dist/`, not `src/`** (e.g. `import { ... } from '../dist/agent.js'`). A new module is only importable after `npm run build`.
- **Clean cutover:** the app is the only consumer of the NDJSON stream. Do NOT keep the old `{type:'text'|'tool'}` / `{type:'done'}` event shapes alive for back-compat — server emit and frontend consume change together.
- **Honest progress only:** never invent a phase from prose or a timer. App-owned phases come from real lifecycle milestones; finer phases advance only on observed events; heartbeats reflect the live child process.
- **Apple-HIG styling:** the progress panel follows the existing system-font, system-color, light/dark look already used by `change-page.ts` and `page-assets.ts`.
- **Run a single test file** with `npm run build && node --test test/<name>.test.mjs`. Run everything with `npm test`.

---

## File Structure

**New files**
- `src/progress.ts` — `ProgressEvent` union, `Phase`/`ErrorStage`/`Workflow`/`RunContext` types, event-helper constructors, `PHASE_LABELS`, `phaseRank`, `observedPhase`. Pure.
- `src/progress-ui.ts` — `progressPanelStyles()`, `progressPanelMarkup(variant)`, `progressPanelScript()` (defines global `ProgressPanel`). Pure string builders.
- `test/progress.test.mjs`, `test/progress-ui.test.mjs`.

**Modified files**
- `src/agent.ts` — replace `AgentEvent` with `ProgressEvent`; add `classifyTool`; parsers return `ProgressEvent[]`; `streamAgent` returns a `failure` discriminator; enrich `agentPreflight`.
- `src/server.ts` — shared `runWorkflow` core; rewrite `runGenerate`/`runAddress`; heartbeat; staged errors; structured preflight blocking.
- `src/change-page.ts` — embed shared panel styles/markup/script; rewrite the generate fetch loop to drive `ProgressPanel`.
- `src/render.ts` — replace `#ds-agentconsole` inner markup with the shared panel; inject panel styles + script.
- `src/page-assets.ts` — rewrite the address console wiring (`acOpen`/`acAppend`/`acFinish`/`handleEvent`/`sendToAgent`) to drive `ProgressPanel`.
- Tests: `test/agent.test.mjs`, `test/agent-preflight.test.mjs`, `test/app-server.test.mjs`, `test/change-page.test.mjs`, `test/render-page.test.mjs`.

---

## Task 1: Progress protocol module (`src/progress.ts`)

**Files:**
- Create: `src/progress.ts`
- Test: `test/progress.test.mjs`

**Interfaces:**
- Consumes: nothing (pure, no imports).
- Produces:
  - Types: `Phase`, `ErrorStage`, `Workflow` (`'guided_review'|'detailed_audit'|'address'`), `FileAction` (`'read'|'edit'|'write'`), `ActivityKind` (`'narration'|'search'|'plan'|'web'|'task'|'other'`), `RunStatus` (`'complete'|'failed'|'stopped'`), `RunContext`, `ProgressEvent`.
  - Constants: `PHASE_LABELS: Record<Phase,string>`.
  - Functions: `phaseRank(phase: Phase): number`; `observedPhase(event: ProgressEvent, isTargetWrite: boolean): Phase | null`; helpers `runStarted`, `contextEvent`, `phaseEvent`, `fileEvent`, `commandEvent`, `activityEvent`, `toolEvent`, `textEvent`, `heartbeatEvent`, `warningEvent`, `errorEvent`, `doneEvent` — all returning `ProgressEvent`.

- [ ] **Step 1: Write the failing test**

Create `test/progress.test.mjs`:

```js
// Unit tests for the app-owned progress protocol. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASE_LABELS, phaseRank, observedPhase,
  runStarted, contextEvent, phaseEvent, fileEvent, commandEvent,
  activityEvent, toolEvent, textEvent, heartbeatEvent, warningEvent,
  errorEvent, doneEvent,
} from '../dist/progress.js';

test('runStarted and contextEvent carry workflow + context fields', () => {
  assert.deepEqual(runStarted('guided_review', 'Generating guided review'), {
    type: 'run_started', workflow: 'guided_review', label: 'Generating guided review',
  });
  const ctx = contextEvent({
    repoName: 'SmartDiffChecker', repoPath: '/r', workflow: 'detailed_audit',
    agent: 'claude', model: 'opus', base: 'main', head: 'working tree',
    scopeLabel: 'Uncommitted', targetCount: undefined,
  });
  assert.equal(ctx.type, 'context');
  assert.equal(ctx.repoName, 'SmartDiffChecker');
  assert.equal(ctx.agent, 'claude');
  assert.equal(ctx.model, 'opus');
  assert.equal(ctx.base, 'main');
});

test('phaseEvent fills the default label and keeps detail optional', () => {
  assert.deepEqual(phaseEvent('reading_changes'), {
    type: 'phase', phase: 'reading_changes', label: PHASE_LABELS.reading_changes,
  });
  const e = phaseEvent('writing_output', 'Writing the story', 'story.json');
  assert.deepEqual(e, {
    type: 'phase', phase: 'writing_output', label: 'Writing the story', detail: 'story.json',
  });
});

test('PHASE_LABELS covers every phase', () => {
  for (const p of [
    'idle', 'preflight', 'resolving_context', 'preparing_prompt', 'starting_agent',
    'agent_running', 'reading_changes', 'writing_output', 'validating_output',
    'applying_results', 'complete', 'failed', 'stopped',
  ]) {
    assert.equal(typeof PHASE_LABELS[p], 'string');
    assert.ok(PHASE_LABELS[p].length > 0);
  }
});

test('phaseRank is monotonic along the spine and sinks terminal failures', () => {
  assert.ok(phaseRank('preflight') < phaseRank('agent_running'));
  assert.ok(phaseRank('agent_running') < phaseRank('writing_output'));
  assert.ok(phaseRank('writing_output') < phaseRank('complete'));
  assert.ok(phaseRank('failed') >= phaseRank('complete'));
  assert.ok(phaseRank('stopped') >= phaseRank('complete'));
});

test('file/command/activity/tool/text helpers build readable labels', () => {
  assert.deepEqual(fileEvent('read', 'Read', 'src/x.ts'), {
    type: 'file', action: 'read', rawTool: 'Read', target: 'src/x.ts', label: 'Reading src/x.ts',
  });
  assert.equal(fileEvent('write', 'Write', 'a/story.json').label, 'Writing a/story.json');
  const cmd = commandEvent('git   diff --stat');
  assert.equal(cmd.type, 'command');
  assert.equal(cmd.command, 'git diff --stat');
  assert.equal(cmd.label, '$ git diff --stat');
  assert.deepEqual(activityEvent('search', 'Grep foo'), { type: 'activity', kind: 'search', label: 'Grep foo' });
  assert.deepEqual(toolEvent('DoThing x', 'DoThing', 'x'), { type: 'tool', label: 'DoThing x', rawTool: 'DoThing', target: 'x' });
  assert.deepEqual(textEvent('hi'), { type: 'text', data: 'hi' });
});

test('heartbeat/warning/error/done helpers carry their fields', () => {
  assert.deepEqual(heartbeatEvent(7000), { type: 'heartbeat', quietMs: 7000 });
  assert.deepEqual(warningEvent('No files changed', 'answered only'), {
    type: 'warning', label: 'No files changed', detail: 'answered only',
  });
  assert.deepEqual(errorEvent('preflight', 'No repository is open', 'Pick one first.'), {
    type: 'error', stage: 'preflight', label: 'No repository is open', detail: 'Pick one first.',
  });
  assert.deepEqual(doneEvent('complete', { storyWritten: true }), {
    type: 'run_done', status: 'complete', result: { storyWritten: true },
  });
  assert.deepEqual(doneEvent('stopped'), { type: 'run_done', status: 'stopped' });
});

test('observedPhase proves reading on reads/searches and writing on target writes only', () => {
  assert.equal(observedPhase(fileEvent('read', 'Read', 'a.ts'), false), 'reading_changes');
  assert.equal(observedPhase(activityEvent('search', 'Grep x'), false), 'reading_changes');
  assert.equal(observedPhase(fileEvent('write', 'Write', 'a.ts'), false), null);
  assert.equal(observedPhase(fileEvent('write', 'Write', 'story.json'), true), 'writing_output');
  assert.equal(observedPhase(fileEvent('edit', 'Edit', 'a.ts'), true), 'writing_output');
  assert.equal(observedPhase(textEvent('hello'), true), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build && node --test test/progress.test.mjs`
Expected: FAIL — `Cannot find module '../dist/progress.js'` (module not created yet).

- [ ] **Step 3: Write the implementation**

Create `src/progress.ts`:

```ts
// The app-owned live-progress protocol. Every agent workflow streams these
// normalized events as NDJSON; the app owns the spine (run_started, context,
// phase, heartbeat, run_done) and agent output only enriches it. Pure module:
// helpers are timestamp-free and deterministic, so they unit-test cleanly.

export type Phase =
  | 'idle' | 'preflight' | 'resolving_context' | 'preparing_prompt'
  | 'starting_agent' | 'agent_running' | 'reading_changes' | 'writing_output'
  | 'validating_output' | 'applying_results' | 'complete' | 'failed' | 'stopped';

export type ErrorStage =
  | 'preflight' | 'startup' | 'execution' | 'validation' | 'output_missing';

export type Workflow = 'guided_review' | 'detailed_audit' | 'address';
export type FileAction = 'read' | 'edit' | 'write';
export type ActivityKind = 'narration' | 'search' | 'plan' | 'web' | 'task' | 'other';
export type RunStatus = 'complete' | 'failed' | 'stopped';

export interface RunContext {
  repoName: string;
  repoPath: string;
  workflow: Workflow;
  agent: string;
  model?: string;
  base?: string;
  head?: string;
  scopeLabel?: string;
  targetCount?: number;
}

export type ProgressEvent =
  | { type: 'run_started'; workflow: Workflow; label: string }
  | ({ type: 'context' } & RunContext)
  | { type: 'phase'; phase: Phase; label: string; detail?: string }
  | { type: 'heartbeat'; quietMs: number }
  | { type: 'run_done'; status: RunStatus; result?: Record<string, unknown> }
  | { type: 'file'; label: string; rawTool: string; target: string; action: FileAction }
  | { type: 'command'; label: string; command: string }
  | { type: 'activity'; kind: ActivityKind; label: string; detail?: string }
  | { type: 'tool'; label: string; rawTool: string; target?: string }
  | { type: 'text'; data: string }
  | { type: 'warning'; stage?: string; label: string; detail?: string }
  | { type: 'error'; stage: ErrorStage; label: string; detail?: string };

/** Default human labels for each phase; callers may override per emit. */
export const PHASE_LABELS: Record<Phase, string> = {
  idle: 'Idle',
  preflight: 'Checking preconditions',
  resolving_context: 'Resolving the change',
  preparing_prompt: 'Preparing the prompt',
  starting_agent: 'Starting the agent',
  agent_running: 'Agent is working',
  reading_changes: 'Reading the change',
  writing_output: 'Writing output',
  validating_output: 'Validating output',
  applying_results: 'Applying results',
  complete: 'Done',
  failed: 'Failed',
  stopped: 'Stopped',
};

// Monotonic ordering so the displayed phase never moves backward.
const PHASE_ORDER: Phase[] = [
  'idle', 'preflight', 'resolving_context', 'preparing_prompt', 'starting_agent',
  'agent_running', 'reading_changes', 'writing_output', 'validating_output',
  'applying_results', 'complete',
];

export function phaseRank(phase: Phase): number {
  if (phase === 'failed' || phase === 'stopped') return PHASE_ORDER.length;
  const i = PHASE_ORDER.indexOf(phase);
  return i < 0 ? 0 : i;
}

export function runStarted(workflow: Workflow, label: string): ProgressEvent {
  return { type: 'run_started', workflow, label };
}

export function contextEvent(ctx: RunContext): ProgressEvent {
  return { type: 'context', ...ctx };
}

export function phaseEvent(phase: Phase, label?: string, detail?: string): ProgressEvent {
  return { type: 'phase', phase, label: label ?? PHASE_LABELS[phase], ...(detail ? { detail } : {}) };
}

export function fileEvent(action: FileAction, rawTool: string, target: string): ProgressEvent {
  const verb = action === 'read' ? 'Reading' : action === 'write' ? 'Writing' : 'Editing';
  return { type: 'file', action, rawTool, target, label: `${verb} ${target}` };
}

export function commandEvent(command: string, label?: string): ProgressEvent {
  const c = command.replace(/\s+/g, ' ').trim();
  const short = c.length > 100 ? c.slice(0, 100) + '…' : c;
  return { type: 'command', command: c, label: label ?? (short ? `$ ${short}` : '$ …') };
}

export function activityEvent(kind: ActivityKind, label: string, detail?: string): ProgressEvent {
  return { type: 'activity', kind, label, ...(detail ? { detail } : {}) };
}

export function toolEvent(label: string, rawTool: string, target?: string): ProgressEvent {
  return { type: 'tool', label, rawTool, ...(target ? { target } : {}) };
}

export function textEvent(data: string): ProgressEvent {
  return { type: 'text', data };
}

export function heartbeatEvent(quietMs: number): ProgressEvent {
  return { type: 'heartbeat', quietMs };
}

export function warningEvent(label: string, detail?: string, stage?: string): ProgressEvent {
  return { type: 'warning', label, ...(detail ? { detail } : {}), ...(stage ? { stage } : {}) };
}

export function errorEvent(stage: ErrorStage, label: string, detail?: string): ProgressEvent {
  return { type: 'error', stage, label, ...(detail ? { detail } : {}) };
}

export function doneEvent(status: RunStatus, result?: Record<string, unknown>): ProgressEvent {
  return { type: 'run_done', status, ...(result ? { result } : {}) };
}

/**
 * The phase an agent-derived event *proves* we've reached, or null. The server
 * passes isTargetWrite (it knows the run's output path), keeping this pure.
 */
export function observedPhase(event: ProgressEvent, isTargetWrite: boolean): Phase | null {
  if (event.type === 'file') {
    if (event.action === 'read') return 'reading_changes';
    if (isTargetWrite) return 'writing_output';
    return null;
  }
  if (event.type === 'activity' && event.kind === 'search') return 'reading_changes';
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run build && node --test test/progress.test.mjs`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/progress.ts dist/progress.js test/progress.test.mjs
git commit -m "feat(progress): app-owned progress event protocol"
```

---

## Task 2: Normalize agent stream into progress events (`src/agent.ts`)

**Files:**
- Modify: `src/agent.ts` (`AgentEvent` removal, `classifyTool`, parsers, `streamAgent`)
- Test: `test/agent.test.mjs`

**Interfaces:**
- Consumes from Task 1: `ProgressEvent`, `fileEvent`, `commandEvent`, `activityEvent`, `toolEvent`, `textEvent`.
- Produces: `classifyTool(name: string, input: any): ProgressEvent`; `parseClaudeStreamLine(line: string): ProgressEvent[]`; `parseCodexStreamLine(line: string): ProgressEvent[]`; `interface StreamResult { ok: boolean; output: string; failure?: 'startup' | 'execution' }`; `streamAgent(agent, repo, prompt, onEvent: (e: ProgressEvent) => void, model?, signal?): Promise<StreamResult>`. `toolSummary` stays exported unchanged.

- [ ] **Step 1: Write the failing test**

In `test/agent.test.mjs`, update the import line to add `classifyTool` and remove nothing else:

```js
import {
  onPath, storyPrompt, normalizeStoryMode, agentCommand, addressPrompt,
  streamCommand, parseClaudeStreamLine, parseCodexStreamLine, toolSummary, classifyTool,
} from '../dist/agent.js';
```

Replace the existing `parseClaudeStreamLine extracts assistant text and tool notices` test and the `parseCodexStreamLine forwards non-empty lines as text` test with these (and add the `classifyTool` test):

```js
test('classifyTool maps tools to the most specific progress event', () => {
  assert.deepEqual(classifyTool('Read', { file_path: 'src/x.ts' }),
    { type: 'file', action: 'read', rawTool: 'Read', target: 'src/x.ts', label: 'Reading src/x.ts' });
  assert.deepEqual(classifyTool('Write', { file_path: 'a/story.json' }),
    { type: 'file', action: 'write', rawTool: 'Write', target: 'a/story.json', label: 'Writing a/story.json' });
  assert.deepEqual(classifyTool('Edit', { file_path: 'src/y.ts' }),
    { type: 'file', action: 'edit', rawTool: 'Edit', target: 'src/y.ts', label: 'Editing src/y.ts' });
  const bash = classifyTool('Bash', { command: 'git   diff --stat' });
  assert.equal(bash.type, 'command');
  assert.equal(bash.command, 'git diff --stat');
  assert.deepEqual(classifyTool('Grep', { pattern: 'foo' }),
    { type: 'activity', kind: 'search', label: 'Grep foo' });
  assert.deepEqual(classifyTool('TodoWrite', {}),
    { type: 'activity', kind: 'plan', label: 'Updating the plan' });
  const unknown = classifyTool('MysteryTool', { path: 'p' });
  assert.equal(unknown.type, 'tool');
  assert.equal(unknown.rawTool, 'MysteryTool');
});

test('parseClaudeStreamLine yields text and classified tool events', () => {
  const textLine = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }] } });
  assert.deepEqual(parseClaudeStreamLine(textLine), [{ type: 'text', data: 'Hello' }]);

  const toolLine = JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'src/x.ts' } }] },
  });
  assert.deepEqual(parseClaudeStreamLine(toolLine),
    [{ type: 'file', action: 'edit', rawTool: 'Edit', target: 'src/x.ts', label: 'Editing src/x.ts' }]);
});

test('parseClaudeStreamLine ignores non-JSON, empty, and non-assistant lines', () => {
  assert.deepEqual(parseClaudeStreamLine('not json'), []);
  assert.deepEqual(parseClaudeStreamLine(''), []);
  assert.deepEqual(parseClaudeStreamLine(JSON.stringify({ type: 'system', subtype: 'init' })), []);
});

test('parseCodexStreamLine forwards prose as text and $-lines as commands', () => {
  assert.deepEqual(parseCodexStreamLine('working on it'), [{ type: 'text', data: 'working on it' }]);
  assert.deepEqual(parseCodexStreamLine('   '), []);
  const cmd = parseCodexStreamLine('$ npm test');
  assert.equal(cmd.length, 1);
  assert.equal(cmd[0].type, 'command');
  assert.equal(cmd[0].command, 'npm test');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: FAIL — `classifyTool` is not exported and the old parser tests now assert the new shapes.

- [ ] **Step 3: Write the implementation**

In `src/agent.ts`, replace the import block at the top — change line `import type { StoryMode } from './types.js';` region to also import the progress helpers (add directly under the existing imports):

```ts
import {
  type ProgressEvent, fileEvent, commandEvent, activityEvent, toolEvent, textEvent,
} from './progress.js';
```

Delete the `AgentEvent` type (the `/** A normalized event from a streaming agent run. */ export type AgentEvent = ...` block) and replace the parser + classify + streamAgent section. Keep `toolSummary` as-is. The replacement:

```ts
/** A readable one-line summary of a tool call for the activity feed. */
export function toolSummary(name: string, input: any): string {
  if (name === 'Bash') {
    const cmd = String(input?.command ?? '').replace(/\s+/g, ' ').trim();
    return cmd ? `$ ${cmd.length > 100 ? cmd.slice(0, 100) + '…' : cmd}` : '$ …';
  }
  const target = input?.file_path ?? input?.path ?? input?.pattern ?? '';
  return target ? `${name} ${target}` : name;
}

/** Normalize one agent tool call into the most specific progress event. */
export function classifyTool(name: string, input: any): ProgressEvent {
  const file = input?.file_path ?? input?.path;
  switch (name) {
    case 'Read':
      return file ? fileEvent('read', name, String(file)) : toolEvent(name, name);
    case 'Write':
      return file ? fileEvent('write', name, String(file)) : toolEvent(name, name);
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return file ? fileEvent('edit', name, String(file)) : toolEvent(name, name);
    case 'Bash':
      return commandEvent(String(input?.command ?? ''));
    case 'Grep':
    case 'Glob':
      return activityEvent('search', toolSummary(name, input));
    case 'TodoWrite':
      return activityEvent('plan', 'Updating the plan');
    case 'WebFetch':
    case 'WebSearch':
      return activityEvent('web', toolSummary(name, input));
    case 'Task':
      return activityEvent('task', 'Running a subtask');
    default:
      return toolEvent(toolSummary(name, input), name, file ? String(file) : undefined);
  }
}

/** Parse one line of Claude's stream-json into normalized events (non-JSON → none). */
export function parseClaudeStreamLine(line: string): ProgressEvent[] {
  const s = line.trim();
  if (!s) return [];
  let obj: any;
  try {
    obj = JSON.parse(s);
  } catch {
    return [];
  }
  if (obj?.type !== 'assistant' || !Array.isArray(obj.message?.content)) return [];
  const out: ProgressEvent[] = [];
  for (const block of obj.message.content) {
    if (block?.type === 'text' && block.text) out.push(textEvent(block.text));
    else if (block?.type === 'tool_use') out.push(classifyTool(block.name, block.input));
  }
  return out;
}

/** Codex exec streams human-readable text; forward prose, promote `$ cmd` lines. */
export function parseCodexStreamLine(line: string): ProgressEvent[] {
  const s = line.replace(/\s+$/, '');
  if (!s.trim()) return [];
  const m = s.match(/^\s*\$\s+(.+)$/);
  if (m) return [commandEvent(m[1])];
  return [textEvent(s)];
}

function lineParser(agent: Agent): (line: string) => ProgressEvent[] {
  return agent === 'claude' ? parseClaudeStreamLine : parseCodexStreamLine;
}

/** Result of a streaming agent run; `failure` stages spawn vs non-zero-exit. */
export interface StreamResult {
  ok: boolean;
  output: string;
  failure?: 'startup' | 'execution';
}

/**
 * Spawn the agent and stream normalized events as output arrives, calling `onEvent`
 * per parsed event. Resolves with ok/output and a `failure` discriminator the server
 * uses to stage errors. The spawn itself is integration-only — parsers are unit-tested.
 */
export function streamAgent(
  agent: Agent,
  repo: string,
  prompt: string,
  onEvent: (e: ProgressEvent) => void,
  model?: string,
  signal?: AbortSignal,
): Promise<StreamResult> {
  const [cmd, args] = streamCommand(agent, prompt, model);
  const parse = lineParser(agent);
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], signal });
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
    child.on('error', (e) => resolve({ ok: false, output: `${output}\n${String(e)}`, failure: 'startup' }));
    child.on('close', (code) => {
      if (buf) for (const e of parse(buf)) onEvent(e); // flush the last partial line
      resolve(code === 0 ? { ok: true, output } : { ok: false, output, failure: 'execution' });
    });
  });
}
```

Note: `toolSummary` already exists above the old parser block — when replacing, keep exactly one copy of `toolSummary` (the block above replaces from the existing `toolSummary` through the end of `streamAgent`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: PASS. The build must succeed with no TS errors (this is also where `server.ts` would break if it still imports `AgentEvent` — Task 4 fixes that; if you run the full `tsc` now it will error on `server.ts`. Run the single test file's build target is the whole project, so temporarily `server.ts` may not compile. To keep Task 2 self-contained, also apply the one-line server import fix in Step 3 of this task: in `src/server.ts` change `type AgentEvent` in the `from './agent.js'` import to `type ProgressEvent` and change the two `(e: AgentEvent)` callbacks to `(e: ProgressEvent)`. That keeps the project compiling; Task 4 rewrites the bodies.)

Apply that compile-keeping server edit now: in `src/server.ts`, the import becomes:

```ts
import { availableAgents, streamAgent, addressPrompt, storyPrompt, agentPreflight, normalizeStoryMode } from './agent.js';
import type { ProgressEvent } from './progress.js';
```

and the two `streamAgent(... (e: AgentEvent) => send(e) ...)` calls become `(e: ProgressEvent) => send(e)`.

Re-run: `npm run build && node --test test/agent.test.mjs` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/agent.ts src/server.ts dist/agent.js dist/server.js test/agent.test.mjs
git commit -m "feat(agent): normalize Claude/Codex stream into progress events"
```

---

## Task 3: Enrich preflight into a structured blocked state (`src/agent.ts`)

**Files:**
- Modify: `src/agent.ts` (`Preflight` type + `agentPreflight`)
- Test: `test/agent-preflight.test.mjs`

**Interfaces:**
- Consumes from Task 1: `ErrorStage`.
- Produces: `type Preflight = { ok: true; agent: Agent } | { ok: false; status: number; stage: 'preflight'; label: string; detail: string }`; `agentPreflight(a: { repo: string|null; busy: boolean; agents: Agent[] }): Preflight`.

- [ ] **Step 1: Write the failing test**

Replace the body of `test/agent-preflight.test.mjs` with:

```js
// Unit tests for the shared agent-run guard. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentPreflight } from '../dist/agent.js';

test('agentPreflight blocks (409) when an agent is already running', () => {
  const r = agentPreflight({ repo: '/r', busy: true, agents: ['claude'] });
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
  assert.equal(r.stage, 'preflight');
  assert.match(r.label, /already/i);
  assert.ok(r.detail.length > 0);
});

test('agentPreflight blocks (409) when no repo is open', () => {
  const r = agentPreflight({ repo: null, busy: false, agents: ['claude'] });
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
  assert.equal(r.stage, 'preflight');
  assert.match(r.label, /repository/i);
  assert.match(r.detail, /Pick a repository/i);
});

test('agentPreflight blocks (400) when no agent CLI is installed', () => {
  const r = agentPreflight({ repo: '/r', busy: false, agents: [] });
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(r.stage, 'preflight');
  assert.match(r.label, /agent/i);
  assert.match(r.detail, /claude|codex/i);
});

test('agentPreflight passes and returns the chosen agent', () => {
  const r = agentPreflight({ repo: '/r', busy: false, agents: ['codex', 'claude'] });
  assert.deepEqual(r, { ok: true, agent: 'codex' });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build && node --test test/agent-preflight.test.mjs`
Expected: FAIL — current `agentPreflight` returns `{ ok:false, status, error }` with no `stage`/`label`/`detail`.

- [ ] **Step 3: Write the implementation**

In `src/agent.ts`, replace the `Preflight` type and `agentPreflight` function:

```ts
/** Result of the shared pre-run guard for any agent run (address or generate). */
export type Preflight =
  | { ok: true; agent: Agent }
  | { ok: false; status: number; stage: 'preflight'; label: string; detail: string };

/** Guard a would-be agent run: one-at-a-time, a repo open, an agent installed. */
export function agentPreflight(a: { repo: string | null; busy: boolean; agents: Agent[] }): Preflight {
  if (a.busy) {
    return {
      ok: false, status: 409, stage: 'preflight',
      label: 'An agent run is already in progress',
      detail: 'Wait for the current run to finish, or stop it, before starting another.',
    };
  }
  if (!a.repo) {
    return {
      ok: false, status: 409, stage: 'preflight',
      label: 'No repository is open',
      detail: 'Pick a repository before starting an agent run.',
    };
  }
  if (a.agents.length === 0) {
    return {
      ok: false, status: 400, stage: 'preflight',
      label: 'No agent CLI found',
      detail: 'Install "claude" or "codex" on your PATH to run the agent.',
    };
  }
  return { ok: true, agent: a.agents[0] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run build && node --test test/agent-preflight.test.mjs`
Expected: PASS. (The build will still error in `server.ts` because `runGenerate`/`runAddress` reference `pre.error`. Apply the matching one-line fix now so the project compiles: in `src/server.ts`, both `if (!pre.ok) return sendJson(res, pre.status, { error: pre.error });` lines become `if (!pre.ok) return sendJson(res, pre.status, errorEvent(pre.stage, pre.label, pre.detail));` and add `errorEvent` to the progress import. Task 4 fully rewrites these functions; this keeps the build green.)

Add to the top of `src/server.ts`:

```ts
import { errorEvent } from './progress.js';
```

(merge with the `import type { ProgressEvent } from './progress.js';` added in Task 2 — make it a single `import { errorEvent, type ProgressEvent } from './progress.js';`).

Re-run: `npm run build && node --test test/agent-preflight.test.mjs` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/agent.ts src/server.ts dist/agent.js dist/server.js test/agent-preflight.test.mjs
git commit -m "feat(agent): structured preflight blocked state"
```

---

## Task 4: App-owned workflow streaming in the server (`src/server.ts`)

**Files:**
- Modify: `src/server.ts` (`runWorkflow` core, `runGenerate`, `runAddress`)
- Test: `test/app-server.test.mjs`

**Interfaces:**
- Consumes from Tasks 1–3: `runStarted`, `contextEvent`, `phaseEvent`, `heartbeatEvent`, `warningEvent`, `errorEvent`, `doneEvent`, `observedPhase`, `phaseRank`, `PHASE_LABELS`, `type ProgressEvent`, `type Phase`, `type Workflow`, `type RunContext`, `type RunStatus`; `streamAgent` + `type StreamResult`; enriched `agentPreflight`.
- Produces: internal `runWorkflow(res, repo, spec)` plus rewritten `runGenerate`/`runAddress`. Streamed NDJSON now carries `seq` + the normalized events. Generate `run_done.result = { storyWritten }`; address `run_done.result = { codeChanged }`.

- [ ] **Step 1: Write the failing test**

In `test/app-server.test.mjs`, the existing test ends with a no-repo generate check (`assert.equal(gen.status, 409)`). Replace that block with one that also asserts the structured blocked body:

```js
    // generate without a repo open → 409 with a structured preflight error event
    const gen = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(gen.status, 409);
    const genBody = await gen.json();
    assert.equal(genBody.type, 'error');
    assert.equal(genBody.stage, 'preflight');
    assert.match(genBody.label, /repository/i);
    assert.ok(genBody.detail.length > 0);

    // address without a repo open → 409 with the same structured blocked shape
    const addr = await fetch(`${base}/api/address`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    assert.equal(addr.status, 409);
    const addrBody = await addr.json();
    assert.equal(addrBody.type, 'error');
    assert.equal(addrBody.stage, 'preflight');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build && node --test test/app-server.test.mjs`
Expected: FAIL — after Task 3 the generate body already has `type:'error'`/`stage`, but the address-no-repo path currently returns `{ error: 'No repo is open.' }` via `noRepo`/preflight without `type`. Confirm both assertions, then make them pass via the rewrite below. (If both already pass from Task 3's interim edits, still apply the full rewrite for the streaming spine.)

- [ ] **Step 3: Write the implementation**

In `src/server.ts`, expand the progress import to everything `runWorkflow` needs:

```ts
import {
  runStarted, contextEvent, phaseEvent, heartbeatEvent, warningEvent, errorEvent, doneEvent,
  observedPhase, phaseRank,
  type ProgressEvent, type Phase, type Workflow, type RunContext, type RunStatus,
} from './progress.js';
```

Add `import type { StreamResult } from './agent.js';` (merge into the existing agent import).

Replace the whole `runAddress` and `runGenerate` pair (and add `runWorkflow` + its `WorkflowSpec`) with:

```ts
/** Everything runWorkflow needs to drive one agent run end to end. */
interface WorkflowSpec {
  workflow: Workflow;
  title: string;
  context: RunContext;
  agent: Agent;
  prompt: string;
  model?: string;
  /** True when this event is a write to the run's own output (drives writing_output). */
  isTargetWrite: (ev: ProgressEvent) => boolean;
  /** After the agent exits, compute terminal status + result + any error/warning events. */
  finish: (r: StreamResult) => { status: RunStatus; result: Record<string, unknown>; events: ProgressEvent[] };
}

/**
 * The shared spine for every agent workflow: emit run_started → context → app
 * phases, stream normalized agent events (advancing phases monotonically on real
 * observation), heartbeat liveness while the child runs, then validate → run_done.
 */
function runWorkflow(res: ServerResponse, repo: string, spec: WorkflowSpec): void {
  agentBusy = true;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  const ac = new AbortController();
  res.on('close', () => ac.abort());

  let seq = 0;
  const send = (e: ProgressEvent) => {
    try {
      res.write(JSON.stringify({ seq: seq++, ...e }) + '\n');
    } catch {
      /* client disconnected */
    }
  };

  // Phases only ever advance (monotonic by rank).
  let curRank = -1;
  const advance = (phase: Phase, label?: string, detail?: string) => {
    if (phaseRank(phase) <= curRank) return;
    curRank = phaseRank(phase);
    send(phaseEvent(phase, label, detail));
  };

  send(runStarted(spec.workflow, spec.title));
  send(contextEvent(spec.context));
  advance('resolving_context');
  advance('preparing_prompt');
  advance('starting_agent');
  advance('agent_running');

  let lastActivity = nowMs();
  const heart = setInterval(() => {
    if (!ac.signal.aborted) send(heartbeatEvent(nowMs() - lastActivity));
  }, 5000);

  streamAgent(
    spec.agent,
    repo,
    spec.prompt,
    (ev) => {
      lastActivity = nowMs();
      send(ev);
      const ph = observedPhase(ev, spec.isTargetWrite(ev));
      if (ph) advance(ph);
    },
    spec.model,
    ac.signal,
  )
    .then((r) => {
      clearInterval(heart);
      if (ac.signal.aborted) {
        send(doneEvent('stopped'));
        return;
      }
      advance('validating_output');
      const { status, result, events } = spec.finish(r);
      for (const e of events) send(e);
      send(doneEvent(status, result));
    })
    .catch((err) => {
      clearInterval(heart);
      if (ac.signal.aborted) {
        send(doneEvent('stopped'));
        return;
      }
      send(errorEvent('execution', 'The agent run crashed', String(err)));
      send(doneEvent('failed'));
    })
    .finally(() => {
      clearInterval(heart);
      res.end();
      agentBusy = false;
    });
}

/** Drive the user's agent to address review comments, streaming progress NDJSON. */
function runAddress(res: ServerResponse, session: Session, body: string): void {
  let input: { commentIds?: string[]; all?: boolean };
  try {
    input = JSON.parse(body || '{}');
  } catch {
    return sendJson(res, 400, errorEvent('preflight', 'Invalid request', 'The request body was not valid JSON.'));
  }
  const target: string[] | 'all' = input.all
    ? 'all'
    : Array.isArray(input.commentIds)
      ? input.commentIds
      : [];
  if (target !== 'all' && target.length === 0) {
    return sendJson(res, 400, errorEvent('preflight', 'No comments specified', 'Pick at least one comment to address.'));
  }

  const pre = agentPreflight({ repo: session.repo, busy: agentBusy, agents: availableAgents() });
  if (!pre.ok) return sendJson(res, pre.status, errorEvent(pre.stage, pre.label, pre.detail));
  const agent = pre.agent;
  const repo = session.repo as string;

  const openCount = loadComments(repo).filter((c) => c.status === 'open').length;
  const targetCount = target === 'all' ? openCount : target.length;
  const title =
    target === 'all'
      ? `Addressing ${targetCount} open ${targetCount === 1 ? 'comment' : 'comments'}`
      : `Addressing ${targetCount} ${targetCount === 1 ? 'comment' : 'comments'}`;

  const before = currentDiff(session);
  runWorkflow(res, repo, {
    workflow: 'address',
    title,
    agent,
    prompt: addressPrompt(target),
    context: {
      repoName: basename(repo), repoPath: repo, workflow: 'address',
      agent, targetCount,
    },
    // For address, the output is code: any non-read write to a non-JSON file.
    isTargetWrite: (ev) => ev.type === 'file' && ev.action !== 'read' && !ev.target.endsWith('.json'),
    finish: (r) => {
      const codeChanged = currentDiff(session) !== before;
      const events: ProgressEvent[] = [];
      let status: RunStatus = 'complete';
      if (r.failure === 'startup') {
        events.push(errorEvent('startup', 'The agent failed to start', tailLines(r.output, 30)));
        status = 'failed';
      } else if (!r.ok) {
        events.push(errorEvent('execution', 'The agent run failed', tailLines(r.output, 30)));
        status = 'failed';
      } else if (!codeChanged) {
        events.push(warningEvent('No files changed', 'The agent answered without editing code.'));
      }
      return { status, result: { codeChanged }, events };
    },
  });
}

/** Drive the agent to write a story for the current repo, streaming progress NDJSON. */
function runGenerate(res: ServerResponse, session: Session, body: string): void {
  let input: { base?: string; head?: string; agent?: string; model?: string; mode?: string } = {};
  try {
    input = JSON.parse(body || '{}');
  } catch {
    return sendJson(res, 400, errorEvent('preflight', 'Invalid request', 'The request body was not valid JSON.'));
  }

  const agents = availableAgents();
  const pre = agentPreflight({ repo: session.repo, busy: agentBusy, agents });
  if (!pre.ok) return sendJson(res, pre.status, errorEvent(pre.stage, pre.label, pre.detail));
  const agent =
    (input.agent === 'claude' || input.agent === 'codex') && agents.includes(input.agent)
      ? input.agent
      : pre.agent;
  const model = input.model && input.model.trim() ? input.model.trim() : undefined;
  const mode = normalizeStoryMode(input.mode);
  const workflow: Workflow = mode === 'detailed' ? 'detailed_audit' : 'guided_review';
  const repo = session.repo as string;

  session.base = input.base;
  session.head = input.head;
  const base = resolveBase(repo, input.base);
  const storyPath = resolveStoryPath(repo);

  runWorkflow(res, repo, {
    workflow,
    title: workflow === 'detailed_audit' ? 'Generating detailed audit' : 'Generating guided review',
    agent,
    model,
    prompt: storyPrompt(input.base ?? base, input.head, mode),
    context: {
      repoName: basename(repo), repoPath: repo, workflow, agent, model,
      base: describeBase(repo, base),
      head: input.head ?? 'working tree',
    },
    // For generate, the output is the story file.
    isTargetWrite: (ev) => ev.type === 'file' && ev.action !== 'read' && ev.target.endsWith('story.json'),
    finish: (r) => {
      const storyWritten = existsSync(storyPath);
      const events: ProgressEvent[] = [];
      let status: RunStatus = 'complete';
      if (storyWritten) {
        session.selectedStory = storyPath;
        session.chooseStory = false;
      } else if (r.failure === 'startup') {
        events.push(errorEvent('startup', 'The agent failed to start', tailLines(r.output, 30)));
        status = 'failed';
      } else if (!r.ok) {
        events.push(errorEvent('execution', 'The agent run failed', tailLines(r.output, 30)));
        status = 'failed';
      } else {
        events.push(errorEvent('output_missing', 'No story was written',
          'The agent finished but .diffstory/story.json is missing. Check the raw output below.'));
        status = 'failed';
      }
      return { status, result: { storyWritten }, events };
    },
  });
}
```

Confirm `Agent` is imported in `server.ts` (add to the agent import: `import { availableAgents, streamAgent, addressPrompt, storyPrompt, agentPreflight, normalizeStoryMode, type Agent, type StreamResult } from './agent.js';`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run build && node --test test/app-server.test.mjs`
Expected: PASS. Then run the full suite to confirm nothing regressed:
Run: `npm test`
Expected: all test files PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts dist/server.js test/app-server.test.mjs
git commit -m "feat(server): app-owned workflow streaming with phases, heartbeat, staged errors"
```

---

## Task 5: Shared progress panel module (`src/progress-ui.ts`)

**Files:**
- Create: `src/progress-ui.ts`
- Test: `test/progress-ui.test.mjs`

**Interfaces:**
- Consumes: nothing (pure string builders; the runtime JS references `document`/`Date` in the browser only).
- Produces: `progressPanelStyles(): string` (CSS); `progressPanelMarkup(variant: 'inline' | 'floating'): string` (HTML fragment with `.ds-pp-*` hooks); `progressPanelScript(): string` (JS defining global `ProgressPanel(root, opts)` with `.start()`, `.handle(ev)`, `.finish(status, result)`, `.blocked(err)`).

- [ ] **Step 1: Write the failing test**

Create `test/progress-ui.test.mjs`:

```js
// Unit tests for the shared progress panel string builders. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressPanelStyles, progressPanelMarkup, progressPanelScript } from '../dist/progress-ui.js';

test('markup exposes the panel regions for both variants', () => {
  for (const variant of ['inline', 'floating']) {
    const m = progressPanelMarkup(variant);
    assert.match(m, /ds-pp-title/);
    assert.match(m, /ds-pp-agent/);
    assert.match(m, /ds-pp-repo/);
    assert.match(m, /ds-pp-phase-label/);
    assert.match(m, /ds-pp-meta/);
    assert.match(m, /ds-pp-timeline/);
    assert.match(m, /ds-pp-raw/);
    assert.match(m, /data-pp-stop/);
    assert.match(m, /data-pp-close/);
    assert.match(m, new RegExp(`data-variant="${variant}"`));
  }
});

test('script defines ProgressPanel and handles every event type', () => {
  const s = progressPanelScript();
  assert.match(s, /function ProgressPanel/);
  assert.match(s, /function runProgress/);
  for (const t of [
    'run_started', 'context', 'phase', 'file', 'command',
    'activity', 'tool', 'text', 'heartbeat', 'warning', 'error', 'run_done',
  ]) {
    assert.ok(s.includes(`'${t}'`), `script should handle ${t}`);
  }
  assert.match(s, /blocked/);
  assert.match(s, /quiet/);
});

test('styles target the panel and adapt to dark mode', () => {
  const css = progressPanelStyles();
  assert.match(css, /\.ds-pp\b/);
  assert.match(css, /prefers-color-scheme:\s*dark/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build && node --test test/progress-ui.test.mjs`
Expected: FAIL — `Cannot find module '../dist/progress-ui.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/progress-ui.ts`:

```ts
// One shared live-progress panel for every agent run, embedded by both the change
// screen (inline variant) and the review screen (floating variant). Exports three
// string builders: self-contained CSS, an HTML fragment, and a browser script that
// defines a global `ProgressPanel`. The panel renders the app-owned progress events
// from src/progress.ts: workflow title, agent/model, repo+scope, current phase,
// elapsed/liveness, a timeline of meaningful events, and raw agent text (secondary).

/** Self-contained styles (own CSS custom properties so it looks identical on both screens). */
export function progressPanelStyles(): string {
  return `
.ds-pp{--pp-bg:#1c1c1e;--pp-elev:#2c2c2e;--pp-text:#f2f2f7;--pp-muted:#9a9aa3;--pp-faint:#6e6e73;
  --pp-line:rgba(255,255,255,.12);--pp-blue:#0a84ff;--pp-warn:#ff9f0a;--pp-err:#ff6961;--pp-ok:#30d158;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;color:var(--pp-text);
  background:var(--pp-bg);border:.5px solid var(--pp-line);border-radius:14px;overflow:hidden;letter-spacing:-.01em}
@media (prefers-color-scheme:light){.ds-pp{--pp-bg:#1e1e21;--pp-elev:#2a2a2e;--pp-text:#f2f2f7;--pp-muted:#a6a6ad;--pp-faint:#8a8a90;--pp-line:rgba(255,255,255,.12)}}
.ds-pp[data-variant="floating"]{position:fixed;right:18px;bottom:18px;width:min(460px,calc(100vw - 36px));max-height:min(70vh,560px);display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.5);z-index:50}
.ds-pp[data-variant="inline"]{margin-top:20px;display:flex;flex-direction:column;max-height:min(64vh,560px)}
.ds-pp-head{display:flex;align-items:center;gap:9px;padding:11px 13px;border-bottom:.5px solid var(--pp-line)}
.ds-pp-spin{width:13px;height:13px;border-radius:50%;border:2px solid var(--pp-line);border-top-color:var(--pp-blue);animation:ds-pp-spin .7s linear infinite;flex:none}
.ds-pp-spin[hidden]{display:none}
@keyframes ds-pp-spin{to{transform:rotate(360deg)}}
.ds-pp-title{font-size:13px;font-weight:650}
.ds-pp-agent{font-size:11.5px;color:var(--pp-muted);background:var(--pp-elev);border:.5px solid var(--pp-line);border-radius:6px;padding:2px 7px}
.ds-pp-agent:empty{display:none}
.ds-pp-flex{flex:1}
.ds-pp-stop,.ds-pp-close{font:inherit;font-size:12px;font-weight:550;color:var(--pp-text);background:transparent;border:.5px solid var(--pp-line);border-radius:7px;padding:5px 11px;cursor:pointer}
.ds-pp-stop[hidden],.ds-pp-close[hidden]{display:none}
.ds-pp-sub{padding:7px 13px 0}
.ds-pp-repo{font-size:11.5px;color:var(--pp-muted);font-family:"SF Mono",ui-monospace,Menlo,monospace}
.ds-pp-repo:empty{display:none}
.ds-pp-phase{display:flex;align-items:center;gap:8px;padding:9px 13px}
.ds-pp-phase-dot{width:7px;height:7px;border-radius:50%;background:var(--pp-blue);flex:none}
.ds-pp-phase-label{font-size:12.5px;font-weight:600}
.ds-pp-meta{margin-left:auto;font-size:11px;color:var(--pp-faint);font-variant-numeric:tabular-nums}
.ds-pp-timeline{list-style:none;margin:0;padding:2px 13px 8px;overflow:auto;flex:1;min-height:48px}
.ds-pp-ev{display:flex;gap:8px;align-items:baseline;padding:3px 0;font-size:11.5px;color:var(--pp-muted);line-height:1.45}
.ds-pp-ic{flex:none;width:13px;text-align:center;color:var(--pp-faint);font-family:"SF Mono",ui-monospace,Menlo,monospace}
.ds-pp-tx{word-break:break-word}
.ds-pp-phase>.ds-pp-ic,.ds-pp-ev.ds-pp-phase .ds-pp-ic{color:var(--pp-blue)}
.ds-pp-ev.ds-pp-phase .ds-pp-tx{color:var(--pp-text);font-weight:560}
.ds-pp-ev.ds-pp-warning .ds-pp-ic,.ds-pp-ev.ds-pp-warning .ds-pp-tx{color:var(--pp-warn)}
.ds-pp-ev.ds-pp-error .ds-pp-ic,.ds-pp-ev.ds-pp-error .ds-pp-tx{color:var(--pp-err)}
.ds-pp-ev.ds-pp-file .ds-pp-tx,.ds-pp-ev.ds-pp-command .ds-pp-tx{font-family:"SF Mono",ui-monospace,Menlo,monospace}
.ds-pp-rawwrap{border-top:.5px solid var(--pp-line)}
.ds-pp-rawhd{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--pp-faint);padding:7px 13px 3px}
.ds-pp-raw{margin:0;padding:0 13px 10px;max-height:120px;overflow:auto;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--pp-faint);white-space:pre-wrap;word-break:break-word}
.ds-pp-raw:empty,.ds-pp-raw:empty+*{display:none}
.ds-pp-foot{padding:10px 13px;border-top:.5px solid var(--pp-line);font-size:12px;color:var(--pp-text);display:flex;align-items:center;gap:9px}
.ds-pp-foot[hidden]{display:none}
.ds-pp-foot .ds-pp-reload{font:inherit;font-size:12px;font-weight:650;color:#fff;background:var(--pp-blue);border:none;border-radius:8px;padding:6px 11px;cursor:pointer}
`;
}

/** The panel markup fragment; `variant` only sets the outer positioning class. */
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
  <div class="ds-pp-phase">
    <span class="ds-pp-phase-dot" aria-hidden="true"></span>
    <span class="ds-pp-phase-label">Starting…</span>
    <span class="ds-pp-meta"></span>
  </div>
  <ol class="ds-pp-timeline"></ol>
  <div class="ds-pp-rawwrap"><div class="ds-pp-rawhd">Raw agent output</div><pre class="ds-pp-raw"></pre></div>
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
    title:q('.ds-pp-title'), agent:q('.ds-pp-agent'), repo:q('.ds-pp-repo'),
    spin:q('.ds-pp-spin'), phaseLabel:q('.ds-pp-phase-label'), meta:q('.ds-pp-meta'),
    timeline:q('.ds-pp-timeline'), raw:q('.ds-pp-raw'), foot:q('.ds-pp-foot'),
    stop:q('[data-pp-stop]'), close:q('[data-pp-close]')
  };
  var ICON={phase:'◆',file:'→',command:'$',activity:'•',tool:'•',warning:'!',error:'✕'};
  var WF={guided_review:'Generating guided review',detailed_audit:'Generating detailed audit',address:'Addressing comments'};
  var t0=0, timer=null;
  function elapsed(){ var s=Math.round((Date.now()-t0)/1000); return s<60?(s+'s'):(Math.floor(s/60)+'m '+(s%60)+'s'); }
  function setMeta(quietMs){
    if(!els.meta)return;
    var q2=(typeof quietMs==='number')?Math.round(quietMs/1000):0;
    els.meta.textContent='Elapsed '+elapsed()+(q2>=8?(' · quiet '+q2+'s'):'');
  }
  function tick(){ setMeta(0); }
  function add(kind,text){
    if(!els.timeline||!text)return;
    var li=document.createElement('li'); li.className='ds-pp-ev ds-pp-'+kind;
    var ic=document.createElement('span'); ic.className='ds-pp-ic'; ic.textContent=ICON[kind]||'•';
    var tx=document.createElement('span'); tx.className='ds-pp-tx'; tx.textContent=text;
    li.appendChild(ic); li.appendChild(tx); els.timeline.appendChild(li);
    els.timeline.scrollTop=els.timeline.scrollHeight;
  }
  function appendRaw(s){ if(!els.raw||!s)return; els.raw.textContent+=s; els.raw.scrollTop=els.raw.scrollHeight; }
  function agentChip(agent,model){ var a=agent?(agent.charAt(0).toUpperCase()+agent.slice(1)):'Agent'; return model?(a+' · '+model):a; }
  function repoLine(ev){
    var p=ev.repoName||'';
    if(ev.base){ p+=' · '+ev.base+' → '+(ev.head||'working tree'); }
    if(ev.scopeLabel){ p+=' · '+ev.scopeLabel; }
    if(typeof ev.targetCount==='number'){ p+=' · '+ev.targetCount+' '+(ev.targetCount===1?'comment':'comments'); }
    return p;
  }
  function start(){
    root.hidden=false; t0=Date.now();
    if(els.spin)els.spin.hidden=false;
    if(els.stop)els.stop.hidden=false;
    if(els.close)els.close.hidden=true;
    if(els.foot){els.foot.hidden=true; els.foot.textContent='';}
    if(els.timeline)els.timeline.textContent='';
    if(els.raw)els.raw.textContent='';
    if(timer)clearInterval(timer); timer=setInterval(tick,1000); tick();
  }
  function stopTimer(){ if(timer){clearInterval(timer);timer=null;} }
  function handle(ev){
    if(!ev||!ev.type)return;
    switch(ev.type){
      case 'run_started': if(els.title)els.title.textContent=ev.label||WF[ev.workflow]||'Working…'; break;
      case 'context':
        if(els.agent)els.agent.textContent=agentChip(ev.agent,ev.model);
        if(els.repo)els.repo.textContent=repoLine(ev);
        break;
      case 'phase':
        if(els.phaseLabel)els.phaseLabel.textContent=ev.label||ev.phase;
        if(ev.phase!=='agent_running') add('phase', ev.detail?(ev.label+' — '+ev.detail):ev.label);
        break;
      case 'file': add('file', ev.label); break;
      case 'command': add('command', ev.label); break;
      case 'activity': if(ev.kind==='narration'){ appendRaw((ev.label||'')+NL); } else { add('activity', ev.label); } break;
      case 'tool': add('tool', ev.label); break;
      case 'text': appendRaw(ev.data||''); break;
      case 'heartbeat': setMeta(ev.quietMs); break;
      case 'warning': add('warning', ev.label+(ev.detail?(' — '+ev.detail):'')); break;
      case 'error': add('error', ev.label+(ev.detail?(' — '+ev.detail):'')); break;
      case 'run_done': finish(ev.status, ev.result||{}); break;
    }
  }
  function finish(status, result){
    stopTimer();
    if(els.spin)els.spin.hidden=true;
    if(els.stop)els.stop.hidden=true;
    if(els.close)els.close.hidden=false;
    if(els.phaseLabel)els.phaseLabel.textContent=(status==='complete')?'Done':(status==='stopped')?'Stopped':'Failed';
    if(opts.onDone)opts.onDone(status, result||{});
  }
  function blocked(err){
    root.hidden=false; stopTimer();
    if(els.spin)els.spin.hidden=true;
    if(els.stop)els.stop.hidden=true;
    if(els.close)els.close.hidden=false;
    if(els.title)els.title.textContent='Cannot start';
    if(els.phaseLabel)els.phaseLabel.textContent=(err&&err.label)||'Blocked';
    if(els.foot){els.foot.hidden=false; els.foot.textContent=(err&&err.detail)||(err&&err.label)||'Blocked.';}
  }
  if(els.stop)els.stop.addEventListener('click',function(){ if(opts.onStop)opts.onStop(); });
  if(els.close)els.close.addEventListener('click',function(){
    if(opts.onClose)opts.onClose(); else root.hidden=true;
  });
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run build && node --test test/progress-ui.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progress-ui.ts dist/progress-ui.js test/progress-ui.test.mjs
git commit -m "feat(progress-ui): shared live progress panel (styles, markup, ProgressPanel)"
```

---

## Task 6: Wire the change screen to the shared panel (`src/change-page.ts`)

**Files:**
- Modify: `src/change-page.ts`
- Test: `test/change-page.test.mjs`

**Interfaces:**
- Consumes from Task 5: `progressPanelStyles`, `progressPanelMarkup`, `progressPanelScript`, global `ProgressPanel`.
- Produces: the change page renders the shared panel and drives it from the `/api/generate` NDJSON stream. On `run_done` with `status==='complete'` and `result.storyWritten`, it navigates to `/review?story=story.json`.

- [ ] **Step 1: Write the failing test**

In `test/change-page.test.mjs`, add a test asserting the shared panel is embedded (adapt the import/render call to match the file's existing helper — it already calls `renderChangePage`):

```js
test('change page embeds the shared progress panel and drives ProgressPanel', () => {
  const html = renderChangePage(
    { hasChanges: true, baseLabel: 'main', files: [{ path: 'a.ts', added: 1, removed: 0 }] },
    { repoName: 'r', base: '', head: '', scopeLabel: 'Uncommitted', active: 'uncommitted' },
  );
  assert.match(html, /ds-pp-timeline/);
  assert.match(html, /function ProgressPanel/);
  assert.match(html, /new ProgressPanel|ProgressPanel\(/);
  assert.match(html, /run_done/);
});
```

(If `renderChangePage` is already imported at the top of the file, reuse that import; otherwise add `import { renderChangePage } from '../dist/change-page.js';`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build && node --test test/change-page.test.mjs`
Expected: FAIL — current page has no `ds-pp-timeline`/`ProgressPanel`.

- [ ] **Step 3: Write the implementation**

In `src/change-page.ts`:

1. Add imports at the top (below the existing `import { APP_BRAND } ...`):

```ts
import { progressPanelStyles, progressPanelMarkup, progressPanelScript } from './progress-ui.js';
```

2. Inject the panel styles into the page `<style>`: change the closing of the style block. Find the last CSS line before `</style>` (`.genbody{...}`) and append the panel styles by changing `</style>` to:

```ts
${progressPanelStyles()}
</style>
```

(i.e. interpolate `progressPanelStyles()` immediately before the literal `</style>`.)

3. Replace the old console markup block:

```html
  <div class="gencon" id="gencon" hidden>
    <div class="genhd"><span class="genspin"></span><span id="genTitle">Writing your guided review…</span><button class="genstop" id="genstop" type="button">Stop</button></div>
    <pre class="genbody" id="genbody"></pre>
  </div>
```

with:

```html
  <div id="genpanel">${progressPanelMarkup('inline')}</div>
```

4. Inject the shared script before the page's own `<script>`: change the line `<script>` (the page IIFE opener near the bottom) to:

```ts
<script>${progressPanelScript()}</script>
<script>
```

5. Replace the generate click handler (the `gen.addEventListener('click', ...)` block, from `gen.addEventListener('click',function(){` through its closing `});` before `})();`) with one that drives `ProgressPanel`:

```js
  var gen=document.getElementById('genBtn');
  if(!gen)return;
  gen.addEventListener('click',function(){
    gen.disabled=true;
    var root=document.querySelector('#genpanel .ds-pp');
    var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
    var panel=new ProgressPanel(root,{
      onStop:function(){ if(ctrl)ctrl.abort(); },
      onClose:function(){ root.hidden=true; gen.disabled=false; },
      onDone:function(status,result){
        gen.disabled=false;
        if(status==='complete'&&result&&result.storyWritten){ location.href='/review?story=story.json'; }
      }
    });
    panel.start();
    var agent=agentSel?agentSel.value:'';
    var msel=modelSel?modelSel.value:'';
    var model=(msel==='__other__')?(modelInp?modelInp.value.trim():''):msel;
    var payload={base:gen.getAttribute('data-base')||undefined,head:gen.getAttribute('data-head')||undefined,agent:agent||undefined,model:model||undefined,mode:modeSel?modeSel.value:undefined};
    runProgress(panel,'/api/generate',payload,ctrl).then(function(){ gen.disabled=false; });
  });
```

Remove the now-unused `.gencon/.genhd/.genspin/.genstop/.genbody/.gennote`-adjacent console CSS only if it is no longer referenced (leave `.gennote` — it is still used by the note paragraph). The `.gencon`, `.genhd`, `.genspin`, `.genstop`, `.genbody` rules can be deleted since their markup is gone.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run build && node --test test/change-page.test.mjs`
Expected: PASS. Then `npm test` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/change-page.ts dist/change-page.js test/change-page.test.mjs
git commit -m "feat(change-page): drive generate console via shared progress panel"
```

---

## Task 7: Wire the review screen to the shared panel (`src/render.ts` + `src/page-assets.ts`)

**Files:**
- Modify: `src/render.ts` (replace `#ds-agentconsole` markup; inject panel styles + script)
- Modify: `src/page-assets.ts` (rewrite address console wiring to drive `ProgressPanel`)
- Test: `test/render-page.test.mjs`

**Interfaces:**
- Consumes from Task 5: `progressPanelStyles`, `progressPanelMarkup`, `progressPanelScript`, global `ProgressPanel`.
- Produces: review page renders the shared panel; `sendToAgent(ids)` drives it from the `/api/address` NDJSON stream; on completion it refreshes comments and offers reload when `result.codeChanged`.

- [ ] **Step 1: Write the failing test**

In `test/render-page.test.mjs`, add (adapt to the file's existing `renderPage` helper/fixtures):

```js
test('review page embeds the shared progress panel and ProgressPanel script', () => {
  const html = renderReviewFixture(); // existing helper that calls renderPage(...)
  assert.match(html, /ds-pp-timeline/);
  assert.match(html, /function ProgressPanel/);
  assert.match(html, /run_done/);
  assert.match(html, /data-pp-stop/);
});
```

If the test file builds the page inline rather than via a helper, mirror that file's existing pattern to produce `html` from `renderPage`, then assert the four matches above.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build && node --test test/render-page.test.mjs`
Expected: FAIL — page has the old `#ds-agentconsole` only.

- [ ] **Step 3: Write the implementation**

**In `src/render.ts`:**

1. Add import near the existing `import { PAGE_CSS, PAGE_JS } from './page-assets.js';`:

```ts
import { progressPanelStyles, progressPanelMarkup, progressPanelScript } from './progress-ui.js';
```

2. Inject panel styles: change `<style>${PAGE_CSS}</style>` to:

```ts
<style>${PAGE_CSS}${progressPanelStyles()}</style>
```

3. Replace the `#ds-agentconsole` block:

```html
<div class="ds-agentconsole" id="ds-agentconsole" hidden aria-live="polite">
  <div class="ds-ac-head">
    <span class="ds-ac-spin" aria-hidden="true" hidden></span>
    <span class="ds-ac-title">Agent activity</span>
    <span class="ds-flex"></span>
    <button class="ds-ghost ds-ac-stop" data-ac-stop hidden>Stop</button>
    <button class="ds-ghost ds-ac-close" data-ac-close hidden>Close</button>
  </div>
  <pre class="ds-ac-body" id="ds-ac-body"></pre>
  <div class="ds-ac-foot" id="ds-ac-foot" hidden></div>
</div>
```

with:

```ts
<div id="ds-agentpanel">${progressPanelMarkup('floating')}</div>
```

4. Inject the shared script before `<script>${PAGE_JS}</script>`:

```ts
<script>${progressPanelScript()}</script>
<script>${PAGE_JS}</script>
```

**In `src/page-assets.ts`:**

5. Replace the address-console helper functions `acEl`, `acClearTimer`, `acOpen`, `acAppend`, `acFinish`, `acStopped`, `handleEvent`, `pump`, `runTitle`, and `sendToAgent` (the block roughly from `var NL=String.fromCharCode(10); function acEl(){...}` through the end of `sendToAgent`) with a single `ProgressPanel`-driven implementation:

```js
  var acAbort=null, acPanel=null;
  function acRoot(){ var w=document.getElementById('ds-agentpanel'); return w?w.querySelector('.ds-pp'):null; }
  function ensurePanel(onDoneExtra){
    var root=acRoot(); if(!root)return null;
    acPanel=new ProgressPanel(root,{
      onStop:function(){ if(acAbort)acAbort.abort(); },
      onClose:function(){ root.hidden=true; },
      onDone:function(status,result){ if(onDoneExtra)onDoneExtra(status,result); }
    });
    return acPanel;
  }
  function sendToAgent(ids){
    if(agentBusy)return;
    var payload=ids==='all'?{all:true}:{commentIds:ids};
    var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
    acAbort=ctrl;
    var panel=ensurePanel(function(status,result){
      if(status==='complete'){
        refreshComments();
        if(result&&result.codeChanged&&panel&&panel.showFoot){
          var btn=el('button','ds-pp-reload','Reload to see the new diff');
          btn.onclick=function(){location.reload();};
          panel.showFoot(btn);
        }
      }
      setBusy(false); acAbort=null;
    });
    if(!panel){ setBusy(false); return; }
    setBusy(true); panel.start();
    runProgress(panel,ADDRESS_API,payload,ctrl).then(function(){ setBusy(false); acAbort=null; });
  }
```

6. Remove the now-dead click handlers for the old console buttons. Find the delegated click block that references `[data-ac-stop]` (around `b=closest(t,'[data-ac-stop]');if(b){if(acAbort)acAbort.abort();return;}`) and delete that `data-ac-stop` branch and any `[data-ac-close]` branch — the panel wires its own Stop/Close in `ProgressPanel`. Leave the `[data-send]` and `[data-address-all]` branches that call `sendToAgent`.

7. Delete the old console CSS rules that target `.ds-agentconsole .ds-ac-*` only if no markup references them anymore. Keep `.ds-agentconsole` positioning is now provided by `.ds-pp[data-variant="floating"]`, so the old `.ds-agentconsole{position:fixed;...}` rule and `.ds-ac-*` rules can be deleted. (The `#ds-agentpanel` wrapper needs no styles — the inner `.ds-pp` is self-positioned.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run build && node --test test/render-page.test.mjs`
Expected: PASS. Then `npm test` → all PASS. (Watch for stray references to removed functions like `acOpen`/`patchComment` ordering — `patchComment`/`refreshComments`/`ensureReply`/`setBusy`/`collectOpenIds`/`el` must remain defined and in scope for the new `sendToAgent`.)

- [ ] **Step 5: Commit**

```bash
git add src/render.ts src/page-assets.ts dist/render.js dist/page-assets.js test/render-page.test.mjs
git commit -m "feat(review): drive address console via shared progress panel"
```

---

## Task 8: Full-suite green, dist parity, and manual QA

**Files:**
- No new source; verification + any dist sync.

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: every test file PASS (progress, progress-ui, agent, agent-preflight, app-server, change-page, render-page, and all pre-existing suites).

- [ ] **Step 2: Confirm dist is rebuilt and staged**

Run: `git status --porcelain dist | cat`
Expected: any `dist/*.js` touched by this change is committed (no stray modified `dist/` files). If `npm test` rebuilt dist files that differ from what's committed, stage and amend/commit them:

```bash
git add dist
git commit -m "build: sync dist for live agent progress" || echo "dist already in sync"
```

- [ ] **Step 3: Manual QA — generate with Claude (detailed audit)**

Run the app against a repo with changes, click **Generate** with agent **Claude**, story **Detailed audit**. Verify the panel shows: title "Generating detailed audit", agent chip "Claude · …", repo + `base → head`, a phase line advancing (Resolving the change → Starting the agent → Agent is working → Reading the change → Writing output → Validating output → Done), a timeline of file/command events, raw output muted below, a working **Stop**, and navigation to the review on success.

- [ ] **Step 4: Manual QA — generate with Codex (guided review)**

Repeat with agent **Codex**, story **Guided review**. Even with sparse Codex output, verify the app-owned phases and heartbeat ("quiet Ns") still make the panel useful; raw lines appear in the secondary area.

- [ ] **Step 5: Manual QA — Ask agent / Address all open**

On the review screen, leave a comment, click **Ask agent**, then **Address all open**. Verify the same floating panel behavior, that comments refresh on completion, and that a **Reload to see the new diff** button appears when code changed.

- [ ] **Step 6: Manual QA — blocked, stopped, failure staging**

Verify: (a) closing the repo then triggering a run shows a **blocked** "Cannot start / No repository is open" panel, not a fake running state; (b) hitting **Stop** mid-run shows "Stopped" and stops the spinner; (c) a forced failure (e.g. uninstalled model) surfaces the stage — startup vs execution vs output_missing — in the timeline/footer.

- [ ] **Step 7: Final commit (if any dist/test cleanup remains)**

```bash
git add -A
git commit -m "chore: finalize live agent progress protocol" || echo "nothing to finalize"
```

---

## Self-Review

**Spec coverage:**
- Normalized protocol (run_started/context/phase/activity/tool/file/command/heartbeat/warning/error/run_done) → Task 1. ✓
- Run state machine / phases → Task 1 (`Phase`, `phaseRank`, `observedPhase`), applied in Task 4. ✓
- Preflight blocked states (repo open, git repo via existing `isGitRepo` on open, agent CLI exists, one-at-a-time) → Task 3 + Task 4 (structured non-200). Note: "selected scope valid" and "skills installed" are surfaced by existing flows (`resolveScope`, `/api/agents` skill warning) and remain unchanged; preflight here covers repo/busy/agent. ✓
- Claude structured parsing + tool→event mapping → Task 2 (`classifyTool`, `parseClaudeStreamLine`). ✓
- Codex raw fallback → Task 2 (`parseCodexStreamLine`). ✓
- Shared NDJSON contract across `/api/generate` + `/api/address` → Task 4 (`runWorkflow`). ✓
- UI progress panel (workflow/agent/model/repo/scope/phase/last-activity/timeline/secondary raw/stop/final status) → Task 5 + Tasks 6–7. ✓
- Consistent across generate + address screens → shared `ProgressPanel` (Tasks 5–7). ✓
- Tests for helpers, Claude parse, Codex fallback, preflight, /api/generate no-repo, UI handlers → Tasks 1–7. Address "busy" is covered at `agentPreflight` (Task 3) since simulating a live concurrent agent in HTTP tests is non-deterministic. ✓
- dist rebuilt + committed → every task's commit step + Task 8. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command shows expected output. ✓

**Type consistency:** `ProgressEvent`, `Phase`, `Workflow`, `RunContext`, `RunStatus`, `StreamResult`, `Preflight` names are used identically across Tasks 1–4; `classifyTool`/`observedPhase`/`phaseRank` signatures match between definition (Task 1/2) and use (Task 4); `ProgressPanel(root, opts)` API (`start`/`handle`/`finish`/`blocked`/`showFoot`) matches between definition (Task 5) and callers (Tasks 6–7). ✓

## Out of scope (carried from spec)

- Persisting/resuming progress across reloads; multi-run history; progress for non-agent ops (TTS, diff render); heuristic phase inference from prose; `applying_results` consumers.
