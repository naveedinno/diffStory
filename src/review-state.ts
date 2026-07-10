import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { reviewStatePath } from './config.js';
import { readWholeFile } from './git.js';
import type { DiffFile } from './types.js';

export type ReviewSnapshotReason = 'opened' | 'feedback-sent' | 'agent-complete' | 'story-repaired';
export type ReviewEventKind =
  | 'review-started'
  | 'comment-added'
  | 'feedback-sent'
  | 'agent-complete'
  | 'comment-resolved'
  | 'comment-reopened'
  | 'story-repaired';

export interface ReviewFileSnapshot {
  hash: string;
  content: string | null;
}

export interface ReviewSnapshot {
  id: string;
  round: number;
  createdAt: string;
  reason: ReviewSnapshotReason;
  base: string;
  head?: string;
  diffHash: string;
  files: Record<string, ReviewFileSnapshot>;
  commentIds?: string[];
}

export interface ReviewEvent {
  id: string;
  at: string;
  round: number;
  kind: ReviewEventKind;
  label: string;
  detail?: string;
}

export interface ReviewScopeState {
  key: string;
  base: string;
  head?: string;
  round: number;
  snapshots: ReviewSnapshot[];
  events: ReviewEvent[];
  lastFeedbackSnapshotId?: string;
}

interface ReviewStateFile {
  version: 1;
  scopes: Record<string, ReviewScopeState>;
}

export interface ReviewStateSummary {
  scopeKey: string;
  round: number;
  currentDiffHash: string;
  currentSnapshotId?: string;
  compareFrom?: { id: string; round: number; createdAt: string };
  changedFiles: string[];
  hasChangesSinceReview: boolean;
  events: ReviewEvent[];
  snapshots: Array<Pick<ReviewSnapshot, 'id' | 'round' | 'createdAt' | 'reason' | 'diffHash'>>;
}

export interface CaptureReviewInput {
  base: string;
  head?: string;
  diff: string;
  files: DiffFile[];
  reason: ReviewSnapshotReason;
  commentIds?: string[];
}

export function reviewScopeKey(base: string, head?: string): string {
  return createHash('sha256').update(`${base}\0${head ?? 'working-tree'}`).digest('hex').slice(0, 20);
}

function digest(value: string | null): string {
  return createHash('sha256').update(value == null ? '\0missing' : value).digest('hex');
}

function snapshotId(diffHash: string): string {
  return `r_${Date.now().toString(36)}_${diffHash.slice(0, 8)}`;
}

function eventId(): string {
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function emptyState(): ReviewStateFile {
  return { version: 1, scopes: {} };
}

function loadState(repo: string): ReviewStateFile {
  const path = reviewStatePath(repo);
  if (!existsSync(path)) return emptyState();
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as ReviewStateFile;
    if (value?.version !== 1 || !value.scopes || typeof value.scopes !== 'object') return emptyState();
    return value;
  } catch {
    return emptyState();
  }
}

function saveState(repo: string, state: ReviewStateFile): void {
  const path = reviewStatePath(repo);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function currentFileSnapshots(
  repo: string,
  head: string | undefined,
  files: DiffFile[],
  extraPaths: string[] = [],
): Record<string, ReviewFileSnapshot> {
  const paths = [
    ...new Set([...files.map((file) => file.newPath || file.oldPath).filter(Boolean), ...extraPaths]),
  ].sort();
  const out: Record<string, ReviewFileSnapshot> = {};
  for (const path of paths) {
    const lines = readWholeFile(repo, path, head);
    const content = lines == null ? null : lines.join('\n');
    out[path] = { hash: digest(content), content };
  }
  return out;
}

function scopeFor(state: ReviewStateFile, base: string, head?: string): ReviewScopeState {
  const key = reviewScopeKey(base, head);
  let scope = state.scopes[key];
  if (!scope) {
    scope = { key, base, ...(head ? { head } : {}), round: 1, snapshots: [], events: [] };
    state.scopes[key] = scope;
  }
  return scope;
}

function pushEvent(scope: ReviewScopeState, event: Omit<ReviewEvent, 'id' | 'at' | 'round'>): ReviewEvent {
  const stored: ReviewEvent = {
    id: eventId(),
    at: new Date().toISOString(),
    round: scope.round,
    ...event,
  };
  scope.events.push(stored);
  scope.events = scope.events.slice(-100);
  return stored;
}

export function captureReviewSnapshot(repo: string, input: CaptureReviewInput): ReviewSnapshot {
  const state = loadState(repo);
  const scope = scopeFor(state, input.base, input.head);
  const diffHash = digest(input.diff);
  const previous = scope.snapshots[scope.snapshots.length - 1];

  if (input.reason === 'opened' && previous?.diffHash === diffHash) return previous;
  if (input.reason === 'agent-complete' && scope.lastFeedbackSnapshotId && previous?.diffHash !== diffHash) {
    scope.round += 1;
  }

  const snapshot: ReviewSnapshot = {
    id: snapshotId(diffHash),
    round: scope.round,
    createdAt: new Date().toISOString(),
    reason: input.reason,
    base: input.base,
    ...(input.head ? { head: input.head } : {}),
    diffHash,
    files: currentFileSnapshots(repo, input.head, input.files),
    ...(input.commentIds?.length ? { commentIds: [...new Set(input.commentIds)] } : {}),
  };
  scope.snapshots.push(snapshot);
  scope.snapshots = scope.snapshots.slice(-20);

  if (input.reason === 'opened' && scope.events.length === 0) {
    pushEvent(scope, { kind: 'review-started', label: 'Review started' });
  } else if (input.reason === 'feedback-sent') {
    scope.lastFeedbackSnapshotId = snapshot.id;
    const count = snapshot.commentIds?.length ?? 0;
    pushEvent(scope, {
      kind: 'feedback-sent',
      label: `Sent ${count} ${count === 1 ? 'comment' : 'comments'} to the agent`,
    });
  } else if (input.reason === 'agent-complete') {
    const from = scope.snapshots.find((candidate) => candidate.id === scope.lastFeedbackSnapshotId);
    const changed = from ? changedPaths(from.files, snapshot.files) : [];
    pushEvent(scope, {
      kind: 'agent-complete',
      label: changed.length ? `Agent updated ${changed.length} ${changed.length === 1 ? 'file' : 'files'}` : 'Agent replied',
      ...(changed.length ? { detail: changed.join(', ') } : {}),
    });
  } else if (input.reason === 'story-repaired') {
    pushEvent(scope, { kind: 'story-repaired', label: 'Story repaired' });
  }

  saveState(repo, state);
  return snapshot;
}

export function recordReviewEvent(
  repo: string,
  base: string,
  head: string | undefined,
  event: Omit<ReviewEvent, 'id' | 'at' | 'round'>,
): ReviewEvent {
  const state = loadState(repo);
  const scope = scopeFor(state, base, head);
  const stored = pushEvent(scope, event);
  saveState(repo, state);
  return stored;
}

function changedPaths(
  before: Record<string, ReviewFileSnapshot>,
  after: Record<string, ReviewFileSnapshot>,
): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((path) => before[path]?.hash !== after[path]?.hash)
    .sort();
}

export function reviewStateSummary(
  repo: string,
  base: string,
  head: string | undefined,
  diff: string,
  files: DiffFile[],
): ReviewStateSummary {
  const state = loadState(repo);
  const key = reviewScopeKey(base, head);
  const scope = state.scopes[key];
  if (!scope) {
    return {
      scopeKey: key,
      round: 1,
      currentDiffHash: digest(diff),
      changedFiles: [],
      hasChangesSinceReview: false,
      events: [],
      snapshots: [],
    };
  }
  const comparison = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
  const current = currentFileSnapshots(repo, head, files, comparison ? Object.keys(comparison.files) : []);
  const changedFiles = comparison ? changedPaths(comparison.files, current) : [];
  const latest = scope.snapshots[scope.snapshots.length - 1];
  return {
    scopeKey: key,
    round: scope.round,
    currentDiffHash: digest(diff),
    ...(latest ? { currentSnapshotId: latest.id } : {}),
    ...(comparison ? { compareFrom: { id: comparison.id, round: comparison.round, createdAt: comparison.createdAt } } : {}),
    changedFiles,
    hasChangesSinceReview: changedFiles.length > 0,
    events: [...scope.events].reverse(),
    snapshots: scope.snapshots.map(({ id, round, createdAt, reason, diffHash }) => ({ id, round, createdAt, reason, diffHash })),
  };
}

function rewritePatchHeaders(patch: string, path: string, beforeMissing: boolean, afterMissing: boolean): string {
  const lines = patch.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('diff --git ')) lines[i] = `diff --git a/${path} b/${path}`;
    else if (lines[i].startsWith('--- ')) lines[i] = beforeMissing ? '--- /dev/null' : `--- a/${path}`;
    else if (lines[i].startsWith('+++ ')) lines[i] = afterMissing ? '+++ /dev/null' : `+++ b/${path}`;
  }
  return lines.join('\n');
}

function diffFileContents(path: string, before: string | null, after: string | null): string {
  if (before === after) return '';
  const dir = mkdtempSync(join(tmpdir(), 'diffstory-round-'));
  try {
    const oldPath = join(dir, 'old');
    const newPath = join(dir, 'new');
    writeFileSync(oldPath, before ?? '', 'utf8');
    writeFileSync(newPath, after ?? '', 'utf8');
    const left = before == null ? '/dev/null' : oldPath;
    const right = after == null ? '/dev/null' : newPath;
    const result = spawnSync('git', ['diff', '--no-index', '--no-color', '--no-ext-diff', '-U3', '--', left, right], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0 && result.status !== 1) return '';
    return rewritePatchHeaders(result.stdout ?? '', path, before == null, after == null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function diffSinceReview(
  repo: string,
  base: string,
  head: string | undefined,
  currentFiles: DiffFile[],
  snapshotId?: string,
): string {
  const state = loadState(repo);
  const scope = state.scopes[reviewScopeKey(base, head)];
  if (!scope) return '';
  const snapshot = scope.snapshots.find((candidate) => candidate.id === (snapshotId ?? scope.lastFeedbackSnapshotId));
  if (!snapshot) return '';
  const current = currentFileSnapshots(repo, head, currentFiles, Object.keys(snapshot.files));
  return changedPaths(snapshot.files, current)
    .map((path) => diffFileContents(path, snapshot.files[path]?.content ?? null, current[path]?.content ?? null))
    .filter(Boolean)
    .join('\n');
}
