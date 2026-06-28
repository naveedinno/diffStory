// Detect and drive the user's coding agent (Claude Code / Codex) headlessly to
// generate the story. The spawn itself is integration-only; the pure helpers
// (onPath, storyPrompt, agentCommand) are unit-tested.
import { spawn, spawnSync } from 'node:child_process';
import { DATA_DIR } from './config.js';
import type { StoryMode } from './types.js';
import {
  type ProgressEvent, type PlanItem, type PlanStatus,
  fileEvent, commandEvent, activityEvent, toolEvent, textEvent, planEvent,
} from './progress.js';

export type Agent = 'claude' | 'codex';

export function normalizeStoryMode(mode: unknown): StoryMode {
  return mode === 'detailed' ? 'detailed' : 'guided';
}

/** Whether `cmd` resolves on PATH (POSIX `command -v`). */
export function onPath(cmd: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
}

/** Which agent CLIs are installed, in preference order. */
export function availableAgents(): Agent[] {
  return (['claude', 'codex'] as Agent[]).filter(onPath);
}

/** The instruction handed to the agent — triggers the producer skill, pins the exact diff. */
export function storyPrompt(baseRef: string, headRef?: string, mode: unknown = 'guided'): string {
  const storyMode = normalizeStoryMode(mode);
  const diff = headRef ? `git diff ${baseRef}..${headRef} --` : `git diff ${baseRef} --`;
  const headField = headRef ? ` and its "head" field to "${headRef}"` : '';
  const whyLength = storyMode === 'detailed' ? '3-7 short sentences' : '1-3 short sentences';
  const modeContract =
    storyMode === 'detailed'
      ? `Story mode contract:\n` +
        `- Detailed correctness mode: write a longer audit story for a reviewer who wants to verify the code is exactly right.\n` +
        `- Prefer more, smaller stops when a function contains separate decisions; split separate branches, guards, state writes, external calls, and error paths instead of hiding them in one broad paragraph.\n` +
        `- Explain important ranges almost line-by-line: name the method, then describe what the first guard checks, what the next assignment or call prepares, what each branch accepts or rejects, and what state, return value, event, render, or side effect follows.\n` +
        `- Cover all meaningful code paths: happy path, validation guards, failure cases, fallback behavior, persistence, cleanup, tests, and generated artifacts when they matter.\n` +
        `- Use exact function, variable, parameter, event, and field names, but do not paste code blocks or duplicate the diff.\n` +
        `- Detailed does not mean noisy: skip trivial syntax, imports, and mechanical plumbing unless they change correctness.\n\n`
      : `Story mode contract:\n` +
        `- Guided review mode: write the current concise review story, optimized for a human who will read the code after you orient them.\n` +
        `- Keep steps grouped by review question and code flow; avoid line-by-line narration unless the line is a correctness hinge.\n\n`;
  return (
    `Use the diffStory review-tour skill to create a review story for exactly this change: ${diff}.\n\n` +
    `Write ${DATA_DIR}/story.json and set its "base" field to "${baseRef}"${headField} and set its "mode" field to "${storyMode}". The story is for a human ` +
    `reviewer, not a changelog.\n\n` +
    modeContract +
    `Reviewer map contract:\n` +
    `- Before writing JSON, build a private reviewer map. Do not include this map in the file.\n` +
    `- Assume the reviewer is auditing AI-authored code and needs a falsifiable mental model fast.\n` +
    `- Identify the behavior this change is really about, the first entry point to read, the control/data flow, ` +
    `the invariants or risks to verify, and which tests/docs/generated files support each behavior.\n\n` +
    `Reading order contract:\n` +
    `- Start at the entry point a reviewer should inspect first.\n` +
    `- Follow runtime/control/data flow across files, then return to callers when useful.\n` +
    `- Group related edits into one stop; do not emit one step per file or one step per hunk.\n` +
    `- Put tests, snapshots, docs, and generated files after the behavior they verify or explain.\n\n` +
    `Reviewer question contract:\n` +
    `- Each step must answer a reviewer question.\n` +
    `- Good questions: where does the behavior start; what invariant changed; what is passed, rejected, stored, ` +
    `or rendered; what risk should the reviewer inspect; what proves this path works.\n` +
    `- Titles should read like falsifiable review claims or risks, not file captions.\n\n` +
    `Writing contract:\n` +
    `- The top-level "summary" is the overview: 1-3 short informal sentences that say what I did in general, ` +
    `then how the steps walk it.\n` +
    `- Step titles should name the exact behavior or risk being reviewed.\n` +
    `- Each "why" is the story paragraph for that stop: explain what changed here, why the old flow was not enough, ` +
    `and how this code lets the next caller/helper/path do its job. Keep it to ${whyLength} in first person.\n` +
    `- Prefer causal chains like "I added this parameter to method X so method Y can pass Z, which lets H handle...".\n` +
    `- Include what to verify only inside that story, not as a detached checklist.\n` +
    `- Avoid filler like "adds", "updates", "this file", or restating the diff.\n` +
    `- Prefer specific protocol/product language from the code over generic narrative.\n\n` +
    `Voice contract:\n` +
    `- Make the story lively, specific, and a little fun, like a sharp teammate guiding review.\n` +
    `- Keep it informal and to the point. No long paragraphs, no essay mode, no drama.\n` +
    `- Use active verbs, concrete nouns, and quick stakes: what could break, what now holds, what got simpler.\n` +
    `- No corporate changelog voice, no sleepy "This updates..." phrasing, and no bland summary captions.\n` +
    `- Keep the fun in the wording, not in fake confidence: correctness beats jokes every time.\n\n` +
    `Coverage contract:\n` +
    `- Coverage is necessary, but not sufficient.\n` +
    `- Before writing ${DATA_DIR}/story.json, build a private coverage ledger: file, changed hunk range, semantic ` +
    `purpose, and planned step id.\n` +
    `- Cover every changed hunk with a changed/new-file step.\n` +
    `- Use context steps only for unchanged code that makes the review easier.\n` +
    `- Run diffstory check and adjust the story until the coverage gate is clean.\n\n` +
    `Range contract:\n` +
    `- Read the post-change file with line numbers before choosing ranges.\n` +
    `- Ranges are review windows, not coverage hacks: use the smallest complete function/block/test/config region ` +
    `that makes the change understandable.\n` +
    `- Do not use whole-file or giant ranges unless the whole file is new and small, or the entire file is truly ` +
    `the review unit.\n` +
    `- For pure deletions, anchor the step at the post-change location where the deletion happened and include the ` +
    `smallest surrounding code that explains the removed behavior.\n\n` +
    `Focus pointer contract:\n` +
    `- The rendered page highlights code while the story is read aloud. Use optional "focus": {"ranges": [[startLine, endLine]], "label": "short cue"} when the spoken point is narrower than the review window.\n` +
    `- "focus.ranges" must use post-change line numbers and stay inside that step's "range".\n` +
    `- The focus can be one or two lines when that is what the sentence is talking about; point to the exact guard, call, assertion, state write, or branch, not the whole displayed section.\n` +
    `- In guided mode, add focus only for the exact line or tiny block the reviewer should look at while listening.\n` +
    `- In detailed mode, prefer narrow focus ranges for guards, branches, state writes, external calls, assertions, and other line-by-line correctness pivots.\n` +
    `- If the whole step range is the right thing to point at, omit "focus"; diffStory will highlight the step range automatically.\n\n` +
    `Truth contract:\n` +
    `- Only describe behavior you verified in the diff or current source lines you read.\n` +
    `- Do not infer intent from branch names, filenames, or vibes.\n` +
    `- Do not claim tests pass unless you ran them.\n` +
    `- Do not claim a test covers behavior unless the assertion is visible in the story range or in code you read.\n` +
    `- If you are uncertain, narrow the claim to what the code shows.\n\n` +
    `Dry self-review before finishing:\n` +
    `- Re-read the story as a skeptical reviewer.\n` +
    `- Check that every title names behavior/risk, every why explains old flow -> local change -> next implication, ` +
    `and calls/returnsTo reflect real control/data flow.\n` +
    `- Remove vague filler and unsupported safety claims before saving.\n\n` +
    `Do not ask questions. Generate it directly.`
  );
}

/**
 * Instruct the agent to address review comments via the address-review skill.
 *
 * `base` is the diff's target ref (the "other side" of the change). `head` is the
 * current side: when set, the review compares two committed refs (`base..head`) and
 * the agent must read both via git; when omitted, the current side is the live
 * working tree (`base..working tree`). Either way the prompt forces the agent to
 * ground every answer in BOTH sides instead of the single tree it has checked out —
 * without this it reads only the current code and can wrongly claim a changed symbol
 * "doesn't exist".
 */
export function addressPrompt(target: string[] | 'all', base?: string, head?: string): string {
  const scope =
    target === 'all'
      ? 'every comment whose status is "open"'
      : `the comments with these ids: ${target.join(', ')}`;
  // The "current" side is a committed ref (head) or the live working tree.
  const curName = head ? `"${head}" (the current side)` : 'the current working tree (this side)';
  const curRead = head
    ? `read the current side with "git show ${head}:<file>"`
    : 'read the working-tree version directly';
  const diffCmd = head ? `git diff ${base}..${head} -- <file>` : `git diff ${base} -- <file>`;
  const grounding = base
    ? `Two-sided grounding contract — this review IS a diff; never answer from one side:\n` +
      `- The change under review is "${base}" (the target side) compared against ${curName}. A comment can be about something added, removed, or moved between the two.\n` +
      `- Before you reply to any comment, inspect BOTH sides of its file: ${curRead}, and read the target side with "git show ${base}:<file>". Run "${diffCmd}" to see exactly what the change did at that line.\n` +
      `- Never say a symbol, field, or branch "doesn't exist", "isn't here yet", or "lives elsewhere" based on one side alone — that is the failure this contract exists to prevent. Check the other side and the diff first.\n` +
      `- Do not invent branch names, commit hashes, or history. If the two sides don't settle it, say what they show and stop — no guessing.\n\n`
    : '';
  return (
    `Use the diffStory address-review skill to address ${scope} in ${DATA_DIR}/comments.json.\n\n` +
    grounding +
    `Act by type for each one:\n` +
    `- change → make the requested edit; if you genuinely disagree, leave "status" as "open" and make your case in "reply".\n` +
    `- question → read both sides of the code at its file:line, then answer concretely in "reply".\n` +
    `- nit → apply it if quick and reasonable; otherwise explain the trade-off in "reply".\n\n` +
    `For every comment you handle: set "status" to "addressed" and write a specific "reply" — name the ` +
    `function or file you changed, or give your answer. Preserve every other field and never delete a comment.\n\n` +
    `If your edits moved code, re-run the diffStory review-tour skill so ${DATA_DIR}/story.json line ranges ` +
    `stay correct, then run "diffstory check" until coverage is clean.\n\n` +
    `Do not ask questions. Make the changes directly.`
  );
}

/** Broadly-available default so a plan-gated default model (e.g. Fable) can't break `story`. */
export const DEFAULT_CLAUDE_MODEL = 'sonnet';

/** The headless command + args for an agent. Flags verified against each CLI's --help. */
export function agentCommand(agent: Agent, prompt: string, model?: string): [string, string[]] {
  if (agent === 'claude') {
    return ['claude', ['-p', prompt, '--permission-mode', 'acceptEdits', '--model', model ?? DEFAULT_CLAUDE_MODEL]];
  }
  const args = ['exec', '--full-auto'];
  if (model) args.push('--model', model);
  args.push(prompt);
  return ['codex', args];
}

/**
 * Run the agent in `repo`, capturing its (often noisy) output instead of dumping
 * it to the terminal. stdin is closed so an unexpected prompt can't hang us.
 * Returns the exit-ok flag and the captured output (shown only on failure).
 */
export function runAgent(
  agent: Agent,
  repo: string,
  prompt: string,
  model?: string,
): Promise<{ ok: boolean; output: string }> {
  const [cmd, args] = agentCommand(agent, prompt, model);
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const cap = (b: Buffer) => {
      output += b.toString();
      if (output.length > 200_000) output = output.slice(-200_000); // cap memory
    };
    child.stdout?.on('data', cap);
    child.stderr?.on('data', cap);
    child.on('error', (e) => resolve({ ok: false, output: `${output}\n${String(e)}` }));
    child.on('close', (code) => resolve({ ok: code === 0, output }));
  });
}

// ---- live address loop: stream the agent's output to the review page ----

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

/** A readable one-line summary of a tool call for the activity feed. */
export function toolSummary(name: string, input: any): string {
  if (name === 'Bash') {
    const cmd = String(input?.command ?? '').replace(/\s+/g, ' ').trim();
    return cmd ? `$ ${cmd.length > 100 ? cmd.slice(0, 100) + '…' : cmd}` : '$ …';
  }
  const target = input?.file_path ?? input?.path ?? input?.pattern ?? '';
  return target ? `${name} ${target}` : name;
}

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
      return planEvent(planItems(input?.todos));
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
