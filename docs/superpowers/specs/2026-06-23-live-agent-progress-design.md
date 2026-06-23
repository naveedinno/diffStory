# diffStory — Live Agent Progress Protocol

**Date:** 2026-06-23
**Status:** Approved design, pending implementation plan

## Why

The app and agent are technically connected, but the live progress shown to the user is
weak. While the agent works, the UI shows a client-set title ("Writing your detailed audit
with Claude…") over a `<pre>` that just accumulates whatever the CLI happens to print.
A user watching a run cannot tell:

- what repo/scope is being processed, or which agent/model is running;
- whether the app is preparing, waiting, reading, writing, validating, or finishing;
- what files/commands/tools the agent is touching;
- whether the agent is alive-but-quiet, stuck, failed, or done;
- where an error came from — app preflight, agent startup, agent execution, or output
  validation.

The root cause: **progress is 100% agent-derived.** There is no app-owned progress state,
no normalized event contract, no phase model, and no error staging. Two separate frontend
consumers (generate console, address console) each reimplement a thin `text`/`tool` dump.

The fix is systemic: a normalized live-progress layer the **app owns**, that all
agent-driven workflows reuse, where agent output *enriches* a timeline the app controls but
never *is* the only signal.

## Current state (what exists today)

- **`src/agent.ts`** — `AgentEvent = { type:'text'|'tool', data }`. `streamAgent(agent, repo,
  prompt, onEvent, model, signal)` spawns the CLI; `parseClaudeStreamLine` /
  `parseCodexStreamLine` turn raw output into those two shapes via `toolSummary`.
  `agentPreflight({repo, busy, agents})` guards busy / no-repo / no-agent and returns
  `{ ok, agent }` or `{ ok:false, status, error }`.
- **`src/server.ts`** — `runGenerate` / `runAddress` both: parse body → `agentPreflight`
  (non-200 JSON `{error}` on fail) → set `agentBusy` → open `application/x-ndjson` → forward
  `text`/`tool` → on completion send `{type:'error', data: tail}` (failure) then
  `{type:'done', ok, storyWritten|codeChanged}`.
- **Frontend** — two separate consumers, each dumping into a `<pre>`:
  - generate console, inline `<script>` in `src/change-page.ts` (~line 220);
  - address console `#ds-agentconsole`, markup in `src/render.ts` (~line 168), handlers in
    `src/page-assets.ts` (`handleEvent`/`acOpen`/`acAppend`/`acFinish`, ~line 1216).
- **Build/dist** — `npm test` runs `tsc` first; `dist/` is committed (GitHub installs have
  no build step), so every `src/` change ships with a rebuilt `dist/`.

## Settled decisions (from design Q&A)

1. **Phase honesty = app-owned phases + observed bumps.** The phase line shows the lifecycle
   the app truly controls. It only advances to a finer intra-agent phase when the app
   *observes* it (e.g. a real Write to the run's target file). No phase is ever inferred from
   prose or invented on a timer.
2. **Scope = whole system in one pass.** Protocol module + server emits app-owned events for
   generate AND address + Claude/Codex normalization + one rebuilt progress panel shared by
   the change screen and the review screen. All under TDD.
3. **Clean cutover on the NDJSON contract.** The app is the only consumer; no back-compat
   shims for the old `text`/`tool`/`done` shapes. Server emit and frontend consume change
   together.
4. **Preflight failures stay non-200**, with a structured blocked payload that *is* an
   `error` ProgressEvent. Keeps HTTP status honest and matches the existing `!r.ok`
   frontend branch.
5. **One shared client renderer** used by both screens (DRY + identical behavior).
6. **address-one and address-all are one parameterized workflow.**

## 1. The protocol — `src/progress.ts` (new; pure; fully unit-tested)

One NDJSON event per line. A discriminated union where the app owns the spine and agent
output enriches it.

```ts
export type Phase =
  | 'idle' | 'preflight' | 'resolving_context' | 'preparing_prompt'
  | 'starting_agent' | 'agent_running' | 'reading_changes' | 'writing_output'
  | 'validating_output' | 'applying_results' | 'complete' | 'failed' | 'stopped';

export type ErrorStage =
  | 'preflight' | 'startup' | 'execution' | 'validation' | 'output_missing';

export type Workflow = 'guided_review' | 'detailed_audit' | 'address';

export type ProgressEvent =
  // ── app-owned spine ──
  | { type:'run_started'; workflow:Workflow; label:string }
  | { type:'context'; repoName:string; repoPath:string; workflow:Workflow; agent:string;
      model?:string; base?:string; head?:string; scopeLabel?:string; targetCount?:number }
  | { type:'phase'; phase:Phase; label:string; detail?:string }
  | { type:'heartbeat'; quietMs:number }              // honest liveness: child alive, quiet N ms
  | { type:'run_done'; status:'complete'|'failed'|'stopped'; result?:Record<string,unknown> }
  // ── agent-derived enrichment ──
  | { type:'file'; label:string; rawTool:string; target:string; action:'read'|'edit'|'write' }
  | { type:'command'; label:string; command:string }
  | { type:'activity'; kind:'narration'|'search'|'plan'|'web'|'task'|'other'; label:string; detail?:string }
  | { type:'tool'; label:string; rawTool:string; target?:string }    // generic fallback
  | { type:'text'; data:string }                       // raw model prose (secondary)
  // ── problems ──
  | { type:'warning'; stage?:string; label:string; detail?:string }
  | { type:'error'; stage:ErrorStage; label:string; detail?:string };
```

**Helpers** (timestamp-free, deterministic): `runStarted(workflow, label)`,
`contextEvent(ctx)`, `phaseEvent(phase, label?, detail?)`, `fileEvent(action, rawTool,
target)`, `commandEvent(command, label?)`, `activityEvent(kind, label, detail?)`,
`toolEvent(label, rawTool, target?)`, `textEvent(data)`, `heartbeatEvent(quietMs)`,
`warningEvent(label, detail?, stage?)`, `errorEvent(stage, label, detail?)`,
`doneEvent(status, result?)`.

**`PHASE_LABELS: Record<Phase, string>`** supplies default human labels (e.g.
`reading_changes → "Reading the change"`, `writing_output → "Writing output"`,
`validating_output → "Validating output"`).

**`observedPhase(event, isTargetWrite): Phase | null`** — pure: returns the phase an event
*proves* we have reached, else `null`. A read-type `file` (`action:'read'`) or
`activity:'search'` → `reading_changes`; a `file` `action:'write'|'edit'` with
`isTargetWrite === true` → `writing_output`; otherwise `null`. **Target detection lives in
the server** (it knows the run's output path — `story.json` for generate, any tracked code
file for address) and is passed in as the `isTargetWrite` boolean, keeping `observedPhase`
pure. The server applies results monotonically through a `phaseRank(phase)` ordering so
phases never move backward.

The server stamps a monotonic `seq:number` on each event as it writes, so helpers stay pure.

## 2. Run state machine

Every workflow walks the same spine, applied monotonically:

```
idle → preflight → resolving_context → preparing_prompt → starting_agent
     → agent_running → [reading_changes] → [writing_output] → validating_output
     → complete | failed | stopped
```

- Bracketed phases are the **observed bumps**, emitted only on real observation inside
  `agent_running`.
- `applying_results` is reserved for future workflows that mutate app state after the agent
  exits; generate/address do not need it (the server applies their result during
  `validating_output` → `run_done`).
- Terminal phases map to `run_done.status`: `complete` / `failed` / `stopped`.
- Not every workflow uses every phase, but every workflow maps into this set.

## 3. Server — shared orchestration (`src/server.ts`)

Extract a single helper that both `runGenerate` and `runAddress` call, so the spine is
identical:

```
runWorkflow(res, { workflow, agent, model, repo, context, prompt, validate }):
  1. emit run_started(workflow, label)
  2. emit context(...)                       // repoName, scope, agent, model, base→head, targetCount
  3. phase(resolving_context) → phase(preparing_prompt) → phase(starting_agent)
  4. phase(agent_running); start heartbeat timer (~5s) tracking lastActivityAt
  5. streamAgent(...) onEvent:
        - forward the normalized ProgressEvent
        - bump lastActivityAt
        - apply observedPhase(ev) monotonically (emit phase() on advance)
  6. on streamAgent resolve:
        - stop heartbeat
        - phase(validating_output); run `validate()` (workflow-specific)
        - stage any failure (see below)
        - emit run_done(status, result)
  7. finally: res.end(); agentBusy = false
```

- **Heartbeat** — during `agent_running`, every ~5s emit `heartbeat(quietMs = now -
  lastActivityAt)`. This is honest liveness: it reflects the live child process. The UI uses
  it to show "still working — quiet for Ns" vs. fresh activity. Never a fake progress tick.
- **Staged errors:**
  - **preflight** — before streaming. `agentPreflight` is enriched to return
    `{ ok:false, status, stage:'preflight', label, detail }`. The server replies non-200 with
    `errorEvent('preflight', label, detail)` as the JSON body. The frontend's `!r.ok` branch
    renders a **blocked** panel from it. (Busy → 409, no repo → 409, no agent → 400.)
  - **startup** — `streamAgent` distinguishes spawn-`error` from non-zero exit (returns a
    discriminator, e.g. `{ ok, output, failure?: 'startup' | 'execution' }`). Spawn failure →
    `errorEvent('startup', …)`.
  - **execution** — non-zero exit → `errorEvent('execution', …, detail: tailLines(output, 30))`.
  - **output_missing** — generate exits ok but `story.json` is absent →
    `errorEvent('output_missing', …)`.
  - Address with no code change is **not** an error — emit `warningEvent('No files
    changed', 'The agent answered without editing code.')`; `run_done` is still `complete`.
- **Results carried in `run_done.result`:** generate → `{ storyWritten:boolean }`; address →
  `{ codeChanged:boolean }`. On generate success the server still updates
  `session.selectedStory` / `session.chooseStory` as today.

## 4. Parser normalization (`src/agent.ts`)

`parseClaudeStreamLine` / `parseCodexStreamLine` return `ProgressEvent[]` (the agent-derived
subset), replacing the thin `text`/`tool`. A pure **`classifyTool(name, input): ProgressEvent`**:

| Tool                         | Event                                   |
|------------------------------|-----------------------------------------|
| Read                         | `file` action:`read`                    |
| Edit / Write / NotebookEdit  | `file` action:`edit`/`write`            |
| Bash                         | `command` (command text, truncated)     |
| Grep / Glob                  | `activity` kind:`search`                |
| TodoWrite                    | `activity` kind:`plan`                  |
| WebFetch / WebSearch         | `activity` kind:`web`                   |
| Task                         | `activity` kind:`task`                  |
| (anything else)              | `tool` (generic, with rawTool + target) |

Assistant prose → `text`. Codex's sparse human-readable lines → `text`, with obvious
`$ command` lines promoted to `command`. `streamAgent`'s `onEvent` type becomes
`(e: ProgressEvent) => void`. `toolSummary` is retained/reused for building `label`s. All
parser + classifier functions stay pure → unit-tested; the spawn stays integration-only.

## 5. UI — one shared renderer (`src/progress-ui.ts`, new)

Exports `progressPanelMarkup(variant: 'inline' | 'floating')` and `progressPanelScript()`.
The script defines a `ProgressPanel(rootEl, opts)` factory with:

- `handle(ev)` — switch over **every** event type;
- `start()`, `stop()`, `finish(status)`, `blocked(errorEvent)`;
- an elapsed timer and a "last activity / quiet Ns" line driven by `heartbeat`;
- monotonic phase rendering, timeline append, raw-text append.

**The panel shows:**

- **Workflow title** — "Generating guided review" / "Generating detailed audit" /
  "Addressing 3 open comments".
- **Agent/model chip** — "Claude · Opus" / "Codex".
- **Repo · scope** — repo name, `base → head`, current scope label.
- **Phase line** — icon + current phase label + optional detail.
- **Meta line** — elapsed time; "quiet for Ns" when a heartbeat shows no recent activity.
- **Timeline** — an ordered list of meaningful events (phases, files, commands, activities,
  warnings, errors), each with a type icon.
- **Raw agent text** — kept, but visually secondary: muted, scrollable, de-emphasized.
- **Stop** — while cancellable.
- **Terminal status** — completed / failed / stopped / **blocked** (preflight).

Both screens embed `progressPanelScript()` and feed their fetch loop into `panel.handle(ev)`,
so behavior is identical. The **container differs** per surface — an inline card in the
change-screen flow, a floating bottom-right panel on the review screen — but the inner
structure and handlers are shared. `src/change-page.ts` navigates to the review on
`run_done(status:'complete', result.storyWritten)`. The review panel
(`src/render.ts` markup + `src/page-assets.ts` wiring) refreshes comments and offers a
reload on `result.codeChanged`. Styling follows the existing Apple-HIG look of each screen.

## 6. Testing (TDD, red → green)

- **`test/progress.test.mjs`** (new) — every helper's shape; `PHASE_LABELS` completeness;
  `observedPhase` mapping (read→`reading_changes`, target-write→`writing_output`, else
  `null`); monotonic `phaseRank`; `classifyTool` table above; `errorEvent` staging.
- **`test/agent.test.mjs`** — `parseClaudeStreamLine` → `file`/`command`/`activity`/`text`
  (replacing the old `text`/`tool` assertions); `parseCodexStreamLine` fallback → `text` and
  `$`-line → `command`; startup-vs-execution discriminator helper.
- **`test/agent-preflight.test.mjs`** — updated blocked shapes carry
  `stage`/`label`/`detail` (busy, no-repo, no-agent) and the pass case still returns the
  chosen agent.
- **`test/app-server.test.mjs`** — `/api/generate` with no repo open → non-200 with a
  `stage:'preflight'` structured error; `/api/address` busy → 409 preflight; existing
  picker→open→refs→recent→close flow stays green.
- **`test/progress-ui.test.mjs`** (new) — `progressPanelScript()` references handlers for
  `run_started`/`context`/`phase`/`file`/`command`/`heartbeat`/`warning`/`error`/`run_done`/
  `text`; `progressPanelMarkup()` contains the timeline, raw-output, and stop elements for
  both variants.
- **All existing tests stay green.** `dist/` is rebuilt by `npm test` and committed with the
  change.

## Out of scope

- Persisting progress across reloads / resuming a run after navigation.
- A multi-run history or progress for non-agent operations (TTS, diff rendering).
- Richer heuristic phase inference from prose (explicitly rejected as "fake progress").
- `applying_results` consumers beyond the reserved phase name.

## Files touched

- **New:** `src/progress.ts`, `src/progress-ui.ts`, `test/progress.test.mjs`,
  `test/progress-ui.test.mjs`.
- **Changed:** `src/agent.ts` (event union + parsers + `streamAgent` signature +
  `agentPreflight` shape), `src/server.ts` (`runWorkflow` helper, both endpoints,
  heartbeat, staged errors), `src/change-page.ts` (embed shared panel),
  `src/render.ts` (panel markup), `src/page-assets.ts` (wire shared panel),
  `src/types.ts` if shared types belong there.
- **Tests:** `test/agent.test.mjs`, `test/agent-preflight.test.mjs`,
  `test/app-server.test.mjs`.
- **Rebuilt:** corresponding `dist/*.js`.
