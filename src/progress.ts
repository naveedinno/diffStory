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
  // Fail loud if the Phase union grows without PHASE_ORDER being updated.
  if (i < 0) throw new RangeError(`phaseRank: unknown phase "${phase}"`);
  return i;
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
