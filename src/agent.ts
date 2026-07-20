// Detect and drive the user's coding agent (Claude Code / Codex) headlessly to
// generate the story. The spawn itself is integration-only; the pure helpers
// (onPath, storyPrompt, agentCommand) are unit-tested.
import { spawn, spawnSync } from 'node:child_process';
import { DATA_DIR } from './config.js';
import { codexTaskBinary } from './codex-tasks.js';
import type { StoryMode, StoryScope } from './types.js';
import {
  type ProgressEvent, type PlanItem, type PlanStatus,
  fileEvent, commandEvent, activityEvent, toolEvent, textEvent, planEvent,
} from './progress.js';

export type Agent = 'claude' | 'codex';
export type CodexSandbox = 'full-auto' | 'workspace-write' | 'read-only' | 'danger-full-access';
export type CodexProvider = 'default' | 'lmstudio' | 'ollama';

export interface CodexRunOptions {
  sandbox?: CodexSandbox;
  provider?: CodexProvider;
  profile?: string;
  config?: string[];
  /** Resume this persisted Codex task instead of starting a fresh one. */
  threadId?: string;
  /** Machine-readable output lets diffStory capture the id of a new task. */
  json?: boolean;
  /** Use the same runtime that listed the task (Desktop may be newer than PATH). */
  binary?: string;
}

export interface AgentRunOptions {
  codex?: CodexRunOptions;
}

export function normalizeStoryMode(mode: unknown): StoryMode {
  return mode === 'brief' || mode === 'detailed' ? mode : 'guided';
}

/** Whether `cmd` resolves on PATH (POSIX `command -v`). */
export function onPath(cmd: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
}

/** Which agent CLIs are installed, in preference order. */
export function availableAgents(): Agent[] {
  const agents: Agent[] = [];
  if (onPath('claude')) agents.push('claude');
  if (onPath(codexTaskBinary())) agents.push('codex');
  return agents;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Git pathspecs that include selected files and hide generated/oversized files from the agent's own diff. */
function pathspecArgs(includePaths: string[], excludePaths: string[]): string {
  return [
    ...includePaths.map((p) => shellQuote(p)),
    ...excludePaths.map((p) => shellQuote(`:(exclude)${p}`)),
  ].map((p) => ` ${p}`).join('');
}

function storyScopeJson(scope: StoryScope): string {
  return JSON.stringify({
    includedFiles: scope.includedFiles,
    ...(scope.excludedFiles?.length ? { excludedFiles: scope.excludedFiles } : {}),
    ...(scope.reviewerNote?.trim() ? { reviewerNote: scope.reviewerNote.trim() } : {}),
  });
}

/** The instruction handed to the agent — triggers the producer skill, pins the exact diff. */
export function storyPrompt(
  baseRef: string,
  headRef?: string,
  mode: unknown = 'guided',
  excludePaths: string[] = [],
  storyScope?: StoryScope,
): string {
  const storyMode = normalizeStoryMode(mode);
  const includePaths = storyScope?.includedFiles ?? [];
  const pathspecs = pathspecArgs(includePaths, excludePaths);
  const diff = headRef ? `git diff ${baseRef}..${headRef} --${pathspecs}` : `git diff ${baseRef} --${pathspecs}`;
  const headField = headRef ? ` and its "head" field to "${headRef}"` : '';
  const storyScopeContract = storyScope
    ? `Story scope contract:\n` +
      `- Only create changed or new-file story steps for these selected files: ${storyScope.includedFiles.join(', ')}.\n` +
      (storyScope.excludedFiles?.length
        ? `- These changed files are intentionally outside this story scope: ${storyScope.excludedFiles.join(', ')}.\n`
        : '') +
      `- Set top-level "storyScope" in ${DATA_DIR}/story.json to exactly this JSON object: ${storyScopeJson(storyScope)}.\n` +
      `- Do not create coverage steps for files outside "storyScope.includedFiles"; the app treats them as intentionally skipped for this story.\n` +
      (storyScope.reviewerNote?.trim()
        ? `- Reviewer guidance: ${storyScope.reviewerNote.trim()}\n` +
          `- Treat this user-supplied guidance as task evidence when it describes the original request; cite "reviewer guidance" in intent.sources, verify it against the code, and surface any mismatch. Also use it to decide where to slow down.\n`
        : '') +
      `\n`
    : '';
  const scopeContract = excludePaths.length
    ? `Scope contract:\n` +
      `- These files are generated or oversized artifacts (regenerated ABIs, lockfiles, built bundles) and are intentionally excluded from this review: ${excludePaths.join(', ')}.\n` +
      `- Do not read, narrate, or write steps for them. The coverage gate already excludes them, so it will not ask you to cover them — adding them back only bloats the story.\n\n`
    : '';
  return (
    `Use the diffstory-storyteller skill to create a diffStory for exactly this change: ${diff}.\n\n` +
    `Write ${DATA_DIR}/story.json, set its "version" field to 2, set its "base" field to "${baseRef}"${headField}, and set its "mode" field to "${storyMode}". The story is for a human ` +
    `reviewer, not a changelog.\n\n` +
    storyScopeContract +
    scopeContract +
    `The skill owns the craft. Follow its workflow in order — recover the why, reconstruct the app path, storyboard the camera, then write the steps — and honor every contract it defines: ` +
    `coverage, ranges, viewport/highlight camera limits, beats, concept-primer budgets, questions, hotspots, non-goals, truth, and the "${storyMode}" detail level. ` +
    `The app validates the finished story against those contracts and flags violations, so do not improvise a different format or looser limits.\n\n` +
    `Live progress notes (streamed to the reviewer while you work):\n` +
    `- Announce each phase as you enter it by printing its marker alone on its own line, exactly: ">> Recovering the why", then ">> Reconstructing the app path", then ">> Storyboarding the camera", then ">> Writing the steps".\n` +
    `- Print every phase note as its own line starting with ">> " — for example ">> Goal: enable keepers to cap the fee" or ">> Arc: the cap is stored, then enforced, then tested".\n` +
    `- Keep each note to one short, concrete sentence. These lines are shown live in the review UI, so no filler and no markdown.\n\n` +
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
export interface AddressPromptOptions {
  historicalCheckout?: boolean;
  originalRepo?: string;
  resumedCodexTask?: boolean;
  /** User-authored review messages to surface verbatim in the agent task UI. */
  reviewMessages?: Array<{ id: string; text: string }>;
}

export function addressPrompt(
  target: string[] | 'all',
  base?: string,
  head?: string,
  opts: AddressPromptOptions = {},
): string {
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
      `- Each comment may include side: "left" for the target/old side or side: "right" for the current/new side. Use that side to locate the selected text first, then still inspect the opposite side before answering.\n` +
      `- Before you reply to any comment, inspect BOTH sides of its selected text location: ${curRead}, and read the target side with "git show ${base}:<file>". Run "${diffCmd}" to see exactly what changed around that selected snippet.\n` +
      `- Never say a symbol, field, or branch "doesn't exist", "isn't here yet", or "lives elsewhere" based on one side alone — that is the failure this contract exists to prevent. Check the other side and the diff first.\n` +
      `- Do not invent branch names, commit hashes, or history. If the two sides don't settle it, say what they show and stop — no guessing.\n\n`
    : '';
  const historical =
    opts.historicalCheckout && head && opts.resumedCodexTask
      ? `Pinned historical review contract:\n` +
        `- This resumed Codex task stays in the live repository, but the reviewed current side is the pinned commit "${head}", not today's working tree.\n` +
        `- Do not edit source files. Read the reviewed code with "git show ${head}:<file>" and the exact change with "git diff ${base}..${head} -- <file>".\n` +
        `- You may update ${DATA_DIR}/comments.json in the live repository so the review conversation receives your answer.\n` +
        `- For change or nit requests, append a new ai turn with the exact file/function and change you recommend instead of modifying the live branch.\n\n`
      : opts.historicalCheckout && head
      ? `Historical checkout contract:\n` +
        `- You are running in a temporary checkout of "${head}" so code reads match the story's post-change side, even if the live repository has moved on.\n` +
        (opts.originalRepo ? `- The live repository is ${opts.originalRepo}; use it only as identity context, not as the code state under review.\n` : '') +
        `- Do not edit source files in this historical checkout. For change or nit requests, answer by appending a new ai turn (per the Conversation contract below) with the exact file/function and change you recommend instead of modifying the live branch.\n` +
        `- For questions, answer from this checkout plus the explicit base/head diff above.\n\n`
      : '';
  const actionRules = opts.historicalCheckout
    ? `Act by type for each one:\n` +
      `- change → do not edit source files; answer concretely by appending a new ai turn with the exact change you would make on the live branch.\n` +
      `- question → read both sides of the selected text location, then answer concretely by appending a new ai turn.\n` +
      `- nit → answer with the small adjustment by appending a new ai turn; do not edit source files in the temporary checkout.\n\n`
    : `Act by type for each one:\n` +
      `- change → make the requested edit; if you genuinely disagree, leave "status" as "open" and make your case by appending an ai turn.\n` +
      `- question → read both sides of the selected text location, then answer concretely by appending a new ai turn.\n` +
      `- nit → apply it if quick and reasonable; otherwise explain the trade-off by appending a new ai turn.\n\n`;
  const reviewMessages = (opts.reviewMessages ?? []).filter((message) => message.text.trim());
  const visibleRequest = reviewMessages.length === 1
    ? `${reviewMessages[0].text.trim()}\n\n---\n\n`
    : reviewMessages.length > 1
      ? `Review these diffStory messages:\n\n${reviewMessages.map((message, index) =>
          `${index + 1}. ${message.text.trim()} (comment ${message.id})`
        ).join('\n\n')}\n\n---\n\n`
      : '';
  return (
    visibleRequest +
    `Use the diffStory address-review skill to address ${scope} in ${DATA_DIR}/comments.json.\n\n` +
    grounding +
    historical +
    actionRules +
    `Conversation contract:\n` +
    `- Each comment is a conversation. Its "body" is the reviewer's first message, followed by "turns" — an ordered list of {"role":"user"|"ai","text","at"} messages (a legacy comment may instead have a single "reply" string; treat it as the first ai turn).\n` +
    `- Read the whole thread and answer the latest "user" message in that context.\n\n` +
    `For every comment you handle: append a new turn {"role":"ai","text":"<your specific answer — name the function or file you changed, or give your answer>","at":"<ISO 8601 timestamp>"} to its "turns" array (create the array if it is absent). Never overwrite "body" or an existing turn. Then set "status" to "addressed". Preserve every other field and never delete a comment.\n\n` +
    `If your edits moved code, re-run the diffstory-storyteller skill so ${DATA_DIR}/story.json line ranges ` +
    `stay correct and the coverage gate stays clean.\n\n` +
    `Do not ask questions. Make the changes directly.`
  );
}

export type StoryRepairAction = 'explain' | 'rewrite' | 'shorten' | 'split';

/** A narrow story edit: preserve the good walkthrough and repair only one weak stop. */
export function storyRepairPrompt(input: {
  action: StoryRepairAction;
  file?: string;
  line?: number;
  stepId?: string;
  base: string;
  head?: string;
}): string {
  const target = input.stepId
    ? `story step "${input.stepId}"${input.file ? ` in ${input.file}` : ''}`
    : input.file
      ? `${input.file}${input.line ? ` around line ${input.line}` : ''}`
      : 'the selected story area';
  const instruction =
    input.action === 'explain'
      ? `Add or repair the smallest story step needed to explain the uncovered change at ${target}.`
      : input.action === 'rewrite'
        ? `Rewrite ${target} around one falsifiable review question, sharper beat narration, and the same exact code evidence.`
      : input.action === 'shorten'
        ? `Rewrite ${target} to be shorter and sharper without dropping its review risk or causal link.`
        : `Split ${target} into two or more locally focused steps so no step jumps between distant code islands.`;
  const diff = input.head ? `${input.base}..${input.head}` : `${input.base}..working tree`;
  return (
    `Use the diffstory-storyteller skill to make one targeted repair to ${DATA_DIR}/story.json for ${diff}.\n\n` +
    `${instruction}\n\n` +
    `Preservation contract:\n` +
    `- Read the existing story and the real diff before editing. Preserve every unaffected step, the recovered intent, story scope, tone, and useful beat/highlight detail.\n` +
    `- Preserve every unaffected concept primer exactly, including its body, preparesFor links, diagram, tags, chapter, and just-in-time position. Concept primers do not claim coverage.\n` +
    `- Keep a legacy version 1 story at version 1 when the repair only edits code steps; upgrade it to version 2 only if this repair introduces a concept primer. Preserve version 2 once present.\n` +
    `- Do not regenerate the walkthrough from scratch and do not reorder unrelated steps.\n` +
    `- Keep the story short, informal, causal, and review-oriented.\n` +
    `- Renumber order fields and repair calls/returnsTo/preparesFor only where the targeted edit requires it.\n` +
    `- Validate every question, chapter, range, viewport, highlight, beat, concept body, preparesFor target, id, just-in-time primer position, and full-diff coverage before finishing.\n` +
    `- Write the repaired JSON back to ${DATA_DIR}/story.json. Do not ask questions.\n`
  );
}

/** Broadly-available default so a plan-gated default model (e.g. Fable) can't break `story`. */
export const DEFAULT_CLAUDE_MODEL = 'sonnet';

export function normalizeCodexRunOptions(input: {
  codexSandbox?: unknown;
  codexProvider?: unknown;
  codexProfile?: unknown;
  codexConfig?: unknown;
}): CodexRunOptions {
  const sandbox = (['full-auto', 'workspace-write', 'read-only', 'danger-full-access'] as const).includes(
    input.codexSandbox as CodexSandbox,
  )
    ? (input.codexSandbox as CodexSandbox)
    : 'full-auto';
  const provider = (['default', 'lmstudio', 'ollama'] as const).includes(input.codexProvider as CodexProvider)
    ? (input.codexProvider as CodexProvider)
    : 'default';
  const profile =
    typeof input.codexProfile === 'string' && input.codexProfile.trim() ? input.codexProfile.trim() : undefined;
  const rawConfig = Array.isArray(input.codexConfig)
    ? input.codexConfig
    : typeof input.codexConfig === 'string'
      ? input.codexConfig.split('\n')
      : [];
  const config = rawConfig
    .map((line) => String(line).trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .slice(0, 20);
  return { sandbox, provider, profile, config };
}

function codexArgs(prompt: string, model?: string, opts: CodexRunOptions = {}): string[] {
  const args = opts.threadId ? ['exec', 'resume'] : ['exec'];
  const sandbox = opts.sandbox ?? 'full-auto';
  // `exec resume` inherits the task's cwd and permission settings. Its CLI does
  // not accept the normal --sandbox/--profile/provider flags, so only apply
  // those when creating a new task.
  if (!opts.threadId) {
    if (sandbox === 'full-auto') args.push('--full-auto');
    else if (sandbox === 'danger-full-access') args.push('--dangerously-bypass-approvals-and-sandbox');
    else args.push('--sandbox', sandbox);
    if (opts.provider === 'lmstudio' || opts.provider === 'ollama') args.push('--oss', '--local-provider', opts.provider);
    if (opts.profile) args.push('--profile', opts.profile);
  } else if (sandbox === 'danger-full-access') {
    args.push('--dangerously-bypass-approvals-and-sandbox');
  }
  for (const cfg of opts.config ?? []) args.push('-c', cfg);
  if (model) args.push('--model', model);
  if (opts.json) args.push('--json');
  if (opts.threadId) args.push(opts.threadId);
  args.push(prompt);
  return args;
}

/** The headless command + args for an agent. Flags verified against each CLI's --help. */
export function agentCommand(agent: Agent, prompt: string, model?: string, options: AgentRunOptions = {}): [string, string[]] {
  if (agent === 'claude') {
    return ['claude', ['-p', prompt, '--permission-mode', 'acceptEdits', '--model', model ?? DEFAULT_CLAUDE_MODEL]];
  }
  // Discovery and execution must use the same runtime. On macOS the Desktop
  // app can bundle a newer Codex than the one on PATH; detecting the former
  // and launching the latter makes valid Desktop models fail at run time.
  return [options.codex?.binary ?? codexTaskBinary(), codexArgs(prompt, model, options.codex)];
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
  options: AgentRunOptions = {},
): Promise<{ ok: boolean; output: string }> {
  const [cmd, args] = agentCommand(agent, prompt, model, options);
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
export function streamCommand(agent: Agent, prompt: string, model?: string, options: AgentRunOptions = {}): [string, string[]] {
  if (agent === 'claude') {
    return [
      'claude',
      ['-p', prompt, '--output-format', 'stream-json', '--verbose',
       '--permission-mode', 'acceptEdits', '--model', model ?? DEFAULT_CLAUDE_MODEL],
    ];
  }
  return [options.codex?.binary ?? codexTaskBinary(), codexArgs(prompt, model, options.codex)];
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

/** Extract a useful message from one Codex CLI error line, including `ERROR: {json}`. */
export function codexErrorMessage(line: string): string | undefined {
  const raw = line.trim();
  if (!raw) return undefined;
  const prefixed = /^ERROR:\s*/i.test(raw);
  const candidate = prefixed ? raw.replace(/^ERROR:\s*/i, '') : raw;
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const nested = parsed.error;
    const message =
      (nested && typeof nested === 'object' && typeof nested.message === 'string' && nested.message) ||
      (typeof nested === 'string' && nested) ||
      (typeof parsed.message === 'string' && parsed.message);
    return message ? String(message).trim() : undefined;
  } catch {
    return prefixed && candidate.trim() ? candidate.trim() : undefined;
  }
}

export interface AgentFailureSummary {
  label: string;
  detail: string;
  technicalDetail: string;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const clean = value.trim();
    if (!clean || seen.has(clean)) return false;
    seen.add(clean);
    return true;
  });
}

function compactFailureText(value: string, max = 420): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Turn noisy stdout/stderr into one actionable failure plus deduplicated diagnostics. */
export function summarizeAgentFailure(
  output: string,
  failure: 'startup' | 'execution' = 'execution',
): AgentFailureSummary {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const messages = unique(lines.map(codexErrorMessage).filter((message): message is string => !!message));
  const upgradeMessage = messages.find((message) => /\bmodel requires a newer version of Codex\b/i.test(message));
  if (upgradeMessage) {
    const model = /The ['"]([^'"]+)['"] model requires a newer version of Codex/i.exec(upgradeMessage)?.[1];
    return {
      label: model ? `Codex needs an update for ${model}` : 'Codex needs an update for this model',
      detail: 'The Codex runtime diffStory started cannot use this model. Update Codex, or choose another model and try again.',
      technicalDetail: upgradeMessage,
    };
  }

  const diagnosticLines = messages.length ? messages : unique(lines).slice(-12);
  const lastMessage = diagnosticLines.at(-1);
  return {
    label: failure === 'startup' ? 'The agent could not start' : 'The agent stopped before finishing',
    detail: lastMessage
      ? compactFailureText(lastMessage)
      : failure === 'startup'
        ? 'Check that the selected agent is installed, then try again.'
        : 'Try again. If it fails again, open the technical details below.',
    technicalDetail: diagnosticLines.join('\n'),
  };
}

/** Codex exec streams human-readable text or JSONL when a reusable task is requested. */
export function parseCodexStreamLine(line: string): ProgressEvent[] {
  const s = line.replace(/\s+$/, '');
  if (!s.trim()) return [];
  // Terminal JSON errors are summarized once after the process exits. Sending
  // them as live text too produces the duplicated raw wall the user saw.
  if (codexErrorMessage(s)) return [];
  try {
    const event = JSON.parse(s);
    const threadId = event?.thread_id ?? event?.threadId;
    if (event?.type === 'thread.started' && typeof threadId === 'string') {
      return [activityEvent('task', `Message added to selected Codex task · …${threadId.slice(-8)}`)];
    }
    const item = event?.item;
    if (event?.type !== 'item.completed' || !item) return [];
    if (item.type === 'agent_message' && item.text) return [textEvent(String(item.text))];
    if (item.type === 'command_execution' && item.command) return [commandEvent(String(item.command))];
    if (item.type === 'web_search') return [activityEvent('web', String(item.query ?? 'Searching the web'))];
    if (item.type === 'mcp_tool_call') return [toolEvent(String(item.tool ?? item.name ?? 'MCP tool'), 'MCP')];
    if (item.type === 'file_change') return [activityEvent('other', 'Updating files')];
    return [];
  } catch {
    // Human-readable Codex output follows the legacy path below.
  }
  const m = s.match(/^\s*\$\s+(.+)$/);
  if (m) return [commandEvent(m[1])];
  return [textEvent(s)];
}

/** A resumed run is only continuous when Codex reports the selected task id back. */
export function resumedCodexTaskMatches(expected: string | undefined, actual: string | undefined): boolean {
  return !expected || expected === actual;
}

export function codexThreadIdFromOutput(output: string): string | undefined {
  for (const line of output.split('\n')) {
    if (!line.trim().startsWith('{')) continue;
    try {
      const event = JSON.parse(line);
      const id = event?.thread_id ?? event?.threadId;
      if (event?.type === 'thread.started' && typeof id === 'string') return id;
    } catch {
      // Ignore non-JSON output mixed into the stream.
    }
  }
  return undefined;
}

function lineParser(agent: Agent): (line: string) => ProgressEvent[] {
  return agent === 'claude' ? parseClaudeStreamLine : parseCodexStreamLine;
}

/** Result of a streaming agent run; `failure` stages spawn vs non-zero-exit. */
export interface StreamResult {
  ok: boolean;
  output: string;
  failure?: 'startup' | 'execution';
  threadId?: string;
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
  options: AgentRunOptions = {},
): Promise<StreamResult> {
  const [cmd, args] = streamCommand(agent, prompt, model, options);
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
      const threadId = agent === 'codex' ? codexThreadIdFromOutput(output) : undefined;
      resolve(code === 0 ? { ok: true, output, threadId } : { ok: false, output, failure: 'execution', threadId });
    });
  });
}

/** Result of the shared pre-run guard for any agent run (address or generate). */
export type Preflight =
  | { ok: true; agent: Agent }
  | { ok: false; status: number; stage: 'preflight'; label: string; detail: string };

export type AgentSelection =
  | { ok: true; agent: Agent }
  | { ok: false; status: number; stage: 'preflight'; label: string; detail: string };

function agentLabel(agent: Agent): string {
  return agent.charAt(0).toUpperCase() + agent.slice(1);
}

/** Resolve an optional user-selected agent without silently falling back. */
export function selectAvailableAgent(requested: unknown, agents: Agent[], fallback: Agent): AgentSelection {
  if (requested === undefined || requested === null || requested === '') return { ok: true, agent: fallback };
  if (requested !== 'claude' && requested !== 'codex') {
    return {
      ok: false, status: 400, stage: 'preflight',
      label: 'Selected agent is not available',
      detail: 'Choose an installed agent: Claude, Codex.',
    };
  }
  if (!agents.includes(requested)) {
    const installed = agents.length ? agents.map(agentLabel).join(', ') : 'none';
    return {
      ok: false, status: 400, stage: 'preflight',
      label: 'Selected agent is not available',
      detail: `Pick an installed agent before addressing comments. Installed agents: ${installed}.`,
    };
  }
  return { ok: true, agent: requested };
}

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
