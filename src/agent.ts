// Detect and drive the user's coding agent (Claude Code / Codex) headlessly to
// generate the story. The spawn itself is integration-only; the pure helpers
// (onPath, storyPrompt, agentCommand) are unit-tested.
import { spawn, spawnSync } from 'node:child_process';
import { DATA_DIR } from './config.js';

export type Agent = 'claude' | 'codex';

/** Whether `cmd` resolves on PATH (POSIX `command -v`). */
export function onPath(cmd: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
}

/** Which agent CLIs are installed, in preference order. */
export function availableAgents(): Agent[] {
  return (['claude', 'codex'] as Agent[]).filter(onPath);
}

/** The instruction handed to the agent — triggers the producer skill, pins the exact diff. */
export function storyPrompt(baseRef: string, headRef?: string): string {
  const diff = headRef ? `git diff ${baseRef}..${headRef} --` : `git diff ${baseRef} --`;
  return (
    `Use the diffStory review-tour skill to create a review story for exactly this change: ${diff}. ` +
    `Write the reading plan to ${DATA_DIR}/story.json and set its "base" field to "${baseRef}". ` +
    `Keep the number of steps proportional to the change: group related edits into one step, lead ` +
    `with the entry point, follow the call flow — do NOT emit one step per file. Cover every changed ` +
    `hunk. Do not ask questions — generate it directly.`
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
