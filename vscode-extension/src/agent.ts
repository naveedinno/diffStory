import { spawn, spawnSync, type ChildProcess } from 'node:child_process';

export type AgentName = 'codex' | 'claude';
export type AgentWorkflow = 'generate' | 'address' | 'repair';

export interface AgentRun {
  stop(): void;
  done: Promise<{ ok: boolean; output: string }>;
}

export function availableAgents(): AgentName[] {
  const names: AgentName[] = [];
  if (onPath('codex')) names.push('codex');
  if (onPath('claude')) names.push('claude');
  return names;
}

export function storyPrompt(input: { base: string; head?: string; mode: 'brief' | 'guided' | 'detailed'; note?: string; files?: string[] }): string {
  const range = input.head ? `${input.base}..${input.head}` : `${input.base} against the working tree`;
  return [
    `Use the diffstory-storyteller skill to create .diffstory/story.json for ${range}.`,
    `Set base to ${JSON.stringify(input.base)}${input.head ? ` and head to ${JSON.stringify(input.head)}` : ''}, mode to ${JSON.stringify(input.mode)}, and preserve the full guided-review schema: intent, compact summary, locally focused steps, viewport, highlights, and beats.`,
    'Read the actual code and diff before writing. Never write a changelog-style story.',
    input.files?.length ? `Generate steps only for these changed files and persist the same exact list as storyScope.includedFiles: ${input.files.join(', ')}.` : '',
    input.note?.trim() ? `Reviewer guidance: ${input.note.trim()}` : '',
    'Print short progress notes prefixed with >> while you work. Validate the JSON and changed-hunk coverage before finishing.',
  ].filter(Boolean).join('\n\n');
}

export function addressPrompt(input: { base: string; head?: string; commentIds: string[] }): string {
  const range = input.head ? `${input.base}..${input.head}` : `${input.base} against the working tree`;
  const ids = input.commentIds.length ? input.commentIds.join(', ') : 'all open comments';
  return [
    `Use the address-review skill to handle ${ids} in .diffstory/comments.json for ${range}.`,
    'Read the selected code, make the requested implementation changes when appropriate, append a grounded agent reply to each handled comment, and preserve unresolved comments.',
    'Print concise >> progress notes while you work. Do not claim a test passed unless you actually ran it.',
  ].join('\n\n');
}

export function repairPrompt(input: { base: string; head?: string; action: 'explain' | 'shorten' | 'split'; stepId: string; storyId?: string }): string {
  const range = input.head ? `${input.base}..${input.head}` : `${input.base} against the working tree`;
  const storyPath = `.diffstory/${input.storyId ?? 'story.json'}`;
  return [
    `Use the diffstory-storyteller skill to ${input.action} only story step ${JSON.stringify(input.stepId)} in ${storyPath} for ${range}.`,
    'Keep every unrelated step and the existing intent unchanged. Re-read the referenced code, repair ranges, highlights, beats, and ordering if needed, then validate the story before finishing.',
  ].join('\n\n');
}

export function startAgent(agent: AgentName, workflow: AgentWorkflow, repo: string, prompt: string, onProgress: (line: string) => void): AgentRun {
  const [command, args] = commandFor(agent, prompt);
  const child = spawn(command, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
  return { stop: () => child.kill('SIGTERM'), done: collect(child, agent, workflow, onProgress) };
}

function commandFor(agent: AgentName, prompt: string): [string, string[]] {
  if (agent === 'claude') return ['claude', ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits']];
  return ['codex', ['exec', '--full-auto', '--json', prompt]];
}

function collect(child: ChildProcess, agent: AgentName, workflow: AgentWorkflow, onProgress: (line: string) => void): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    let output = '';
    let pending = '';
    const feed = (buffer: Buffer) => {
      const chunk = buffer.toString();
      output = `${output}${chunk}`.slice(-250_000);
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const message = progressLine(agent, line);
        if (message) onProgress(message);
      }
    };
    child.stdout?.on('data', feed);
    child.stderr?.on('data', feed);
    child.on('error', (error) => resolve({ ok: false, output: `${output}\\n${error.message}` }));
    child.on('close', (code) => {
      if (pending) {
        const message = progressLine(agent, pending);
        if (message) onProgress(message);
      }
      onProgress(code === 0 ? `Completed ${workflow} run.` : `Agent stopped with exit code ${code ?? 'unknown'}.`);
      resolve({ ok: code === 0, output });
    });
  });
}

function progressLine(agent: AgentName, raw: string): string | undefined {
  const line = raw.trim();
  if (!line) return undefined;
  if (line.startsWith('>>')) return line.slice(2).trim();
  try {
    const event = JSON.parse(line) as Record<string, unknown>;
    if (agent === 'codex') {
      const item = event.item as Record<string, unknown> | undefined;
      if (event.type === 'item.completed' && item?.type === 'agent_message' && typeof item.text === 'string') return item.text;
      if (event.type === 'item.completed' && item?.type === 'command_execution' && typeof item.command === 'string') return `$ ${item.command}`;
      if (event.type === 'item.completed' && item?.type === 'file_change') return 'Updating workspace files';
    }
    const content = (event.message as Record<string, unknown> | undefined)?.content;
    if (agent === 'claude' && Array.isArray(content)) {
      const text = content.find((part) => part?.type === 'text')?.text;
      if (typeof text === 'string') return text;
    }
  } catch {
    return line.length > 180 ? `${line.slice(0, 179)}…` : line;
  }
  return undefined;
}

function onPath(command: string): boolean {
  return spawnSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' }).status === 0;
}
