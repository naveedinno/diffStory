import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

type SnapshotReason = 'opened' | 'feedback-sent' | 'agent-complete' | 'story-generated' | 'story-repaired';

export type ReviewEventKind =
  | 'review-started'
  | 'comment-added'
  | 'feedback-sent'
  | 'agent-complete'
  | 'comment-resolved'
  | 'comment-reopened'
  | 'story-generated'
  | 'story-repaired';

export interface ReviewEvent {
  id: string;
  at: string;
  round: number;
  kind: ReviewEventKind;
  label: string;
  detail?: string;
}

interface FileSnapshot {
  hash: string;
  content: string | null;
}

interface Snapshot {
  id: string;
  at: string;
  round: number;
  reason: SnapshotReason;
  diffHash: string;
  files: Record<string, FileSnapshot>;
}

export interface ReviewCursor {
  storyId: string;
  stepId: string;
  at: string;
}

interface ScopeState {
  key: string;
  base: string;
  head?: string;
  round: number;
  snapshots: Snapshot[];
  events: ReviewEvent[];
  cursors?: Record<string, ReviewCursor>;
  seenFiles?: string[];
  /** Snapshot id for the last feedback handoff. `lastFeedbackHash` was used by 0.2.1 and is ignored on upgrade. */
  lastFeedbackSnapshotId?: string;
}

interface ReviewStateFile {
  version: 1;
  scopes: Record<string, ScopeState>;
}

export interface ReviewSummary {
  round: number;
  changedSinceReview: number;
  changedFiles: string[];
  seenFiles: string[];
  events: ReviewEvent[];
}

export interface ReviewFileChange {
  file: string;
  before: string | null;
  after: string | null;
}

function statePath(repo: vscode.Uri): string {
  return path.join(repo.fsPath, '.diffstory', 'review-state.json');
}

function keyFor(base: string, head?: string): string {
  return createHash('sha256').update(`${base}\0${head ?? 'working-tree'}`).digest('hex').slice(0, 20);
}

function hash(value: string | null): string {
  return createHash('sha256').update(value == null ? '\0missing' : value).digest('hex');
}

async function load(repo: vscode.Uri): Promise<ReviewStateFile> {
  try {
    const state: unknown = JSON.parse(await readFile(statePath(repo), 'utf8'));
    if (!state || typeof state !== 'object' || Array.isArray(state)) return emptyState();
    const candidate = state as Partial<ReviewStateFile>;
    if (candidate.version !== 1 || !candidate.scopes || typeof candidate.scopes !== 'object') return emptyState();
    for (const scope of Object.values(candidate.scopes)) normalizeScope(scope);
    return candidate as ReviewStateFile;
  } catch {
    return emptyState();
  }
}

function emptyState(): ReviewStateFile {
  return { version: 1, scopes: {} };
}

function normalizeScope(scope: ScopeState): void {
  scope.snapshots ??= [];
  scope.events ??= [];
  scope.seenFiles ??= [];
  for (const snapshot of scope.snapshots) {
    if (Array.isArray(snapshot.files)) {
      snapshot.files = Object.fromEntries(snapshot.files.map((file) => [file, { hash: hash(`legacy:${file}`), content: null }]));
    }
  }
}

async function save(repo: vscode.Uri, state: ReviewStateFile): Promise<void> {
  await mkdir(path.dirname(statePath(repo)), { recursive: true });
  await writeFile(statePath(repo), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function scopeFor(state: ReviewStateFile, base: string, head?: string): ScopeState {
  const key = keyFor(base, head);
  let scope = state.scopes[key];
  if (!scope) {
    scope = { key, base, ...(head ? { head } : {}), round: 1, snapshots: [], events: [] };
    state.scopes[key] = scope;
  }
  normalizeScope(scope);
  return scope;
}

function append(scope: ScopeState, kind: ReviewEventKind, label: string, detail?: string): void {
  scope.events.push({ id: `event-${randomUUID().slice(0, 12)}`, at: new Date().toISOString(), round: scope.round, kind, label, ...(detail ? { detail } : {}) });
  scope.events = scope.events.slice(-100);
}

async function fileContent(repo: vscode.Uri, file: string, head?: string): Promise<string | null> {
  try {
    if (!head) return await readFile(path.join(repo.fsPath, ...file.split('/')), 'utf8');
    const { stdout } = await execFileAsync('git', ['show', `${head}:${file}`], { cwd: repo.fsPath, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    return stdout;
  } catch {
    return null;
  }
}

async function currentFiles(repo: vscode.Uri, head: string | undefined, files: string[], extra: string[] = []): Promise<Record<string, FileSnapshot>> {
  const paths = [...new Set([...files, ...extra])].sort();
  const entries = await Promise.all(paths.map(async (file) => {
    const content = await fileContent(repo, file, head);
    return [file, { hash: hash(content), content }] as const;
  }));
  return Object.fromEntries(entries);
}

function changedPaths(before: Record<string, FileSnapshot>, after: Record<string, FileSnapshot>): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((file) => before[file]?.hash !== after[file]?.hash)
    .sort();
}

export async function captureReview(
  repo: vscode.Uri,
  input: { base: string; head?: string; diff: string; files: string[]; reason: SnapshotReason; commentIds?: string[] },
): Promise<ReviewSummary> {
  const state = await load(repo);
  const scope = scopeFor(state, input.base, input.head);
  const diffHash = hash(input.diff);
  const last = scope.snapshots.at(-1);
  const feedback = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
  const files = await currentFiles(repo, input.head, input.files, feedback ? Object.keys(feedback.files) : []);
  if (input.reason === 'agent-complete' && feedback && feedback.diffHash !== diffHash) scope.round += 1;
  if (!last || last.diffHash !== diffHash || input.reason !== 'opened') {
    scope.snapshots.push({
      id: `snapshot-${randomUUID().slice(0, 12)}`,
      at: new Date().toISOString(),
      round: scope.round,
      reason: input.reason,
      diffHash,
      files,
    });
    scope.snapshots = scope.snapshots.slice(-20);
  }
  if (!scope.events.length) append(scope, 'review-started', 'Review started');
  if (input.reason === 'feedback-sent') {
    scope.lastFeedbackSnapshotId = scope.snapshots.at(-1)?.id;
    append(scope, 'feedback-sent', `Sent ${input.commentIds?.length ?? 0} review comments to the agent`);
  }
  if (input.reason === 'agent-complete') append(scope, 'agent-complete', 'Agent run completed');
  if (input.reason === 'story-generated') append(scope, 'story-generated', 'Generated a guided story');
  if (input.reason === 'story-repaired') append(scope, 'story-repaired', 'Repaired a story step');
  await save(repo, state);
  return summary(scope, files);
}

export async function recordReviewEvent(
  repo: vscode.Uri,
  input: { base: string; head?: string; kind: ReviewEventKind; label: string; detail?: string; files?: string[] },
): Promise<ReviewSummary> {
  const state = await load(repo);
  const scope = scopeFor(state, input.base, input.head);
  append(scope, input.kind, input.label, input.detail);
  await save(repo, state);
  return summary(scope, await currentFiles(repo, input.head, input.files ?? []));
}

export async function reviewSummary(repo: vscode.Uri, base: string, head: string | undefined, files: string[]): Promise<ReviewSummary> {
  const state = await load(repo);
  return summary(scopeFor(state, base, head), await currentFiles(repo, head, files));
}

export async function reviewChangesSinceFeedback(
  repo: vscode.Uri,
  input: { base: string; head?: string; files: string[] },
): Promise<ReviewFileChange[]> {
  const state = await load(repo);
  const scope = scopeFor(state, input.base, input.head);
  const feedback = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
  if (!feedback) return [];
  const current = await currentFiles(repo, input.head, input.files, Object.keys(feedback.files));
  return changedPaths(feedback.files, current).map((file) => ({
    file,
    before: feedback.files[file]?.content ?? null,
    after: current[file]?.content ?? null,
  }));
}

export async function saveReviewCursor(repo: vscode.Uri, input: { base: string; head?: string; storyId: string; stepId: string }): Promise<ReviewCursor> {
  const state = await load(repo);
  const scope = scopeFor(state, input.base, input.head);
  const cursor = { storyId: input.storyId, stepId: input.stepId, at: new Date().toISOString() };
  scope.cursors = { ...(scope.cursors ?? {}), [input.storyId]: cursor };
  await save(repo, state);
  return cursor;
}

export async function markReviewFileSeen(repo: vscode.Uri, input: { base: string; head?: string; file: string }): Promise<string[]> {
  const state = await load(repo);
  const scope = scopeFor(state, input.base, input.head);
  scope.seenFiles = [...new Set([...(scope.seenFiles ?? []), input.file])].slice(-500);
  await save(repo, state);
  return scope.seenFiles;
}

export async function reviewSeenFiles(repo: vscode.Uri, base: string, head: string | undefined): Promise<string[]> {
  const state = await load(repo);
  return [...(scopeFor(state, base, head).seenFiles ?? [])];
}

export async function reviewCursor(repo: vscode.Uri, base: string, head: string | undefined, storyId: string): Promise<ReviewCursor | undefined> {
  const state = await load(repo);
  return scopeFor(state, base, head).cursors?.[storyId];
}

function summary(scope: ScopeState, files: Record<string, FileSnapshot>): ReviewSummary {
  const feedback = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
  const changedFiles = feedback ? changedPaths(feedback.files, files) : [];
  return { round: scope.round, changedSinceReview: changedFiles.length, changedFiles, seenFiles: [...(scope.seenFiles ?? [])], events: [...scope.events].reverse() };
}
