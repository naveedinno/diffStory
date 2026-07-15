import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type * as vscode from 'vscode';
import { commentSeverity, InvalidCommentStoreError, loadCommentsWithHealth, type CommentStoreHealth } from './comments';

const execFileAsync = promisify(execFile);

export type SnapshotReason = 'opened' | 'feedback-sent' | 'agent-complete' | 'story-repaired';
export type ReviewVerdictDecision = 'approved' | 'changes-requested';
export type ReviewEventKind =
  | 'review-started'
  | 'comment-added'
  | 'feedback-sent'
  | 'agent-complete'
  | 'comment-resolved'
  | 'comment-reopened'
  | 'comment-deleted'
  | 'story-repaired'
  | 'verdict-recorded';

export interface ReviewEvent {
  id: string;
  at: string;
  round: number;
  kind: ReviewEventKind;
  label: string;
  detail?: string;
  affectsApproval?: boolean;
}

interface FileSnapshot {
  hash: string;
  content: string | null;
}

interface Snapshot {
  id: string;
  createdAt: string;
  round: number;
  reason: SnapshotReason;
  base: string;
  head?: string;
  diffHash: string;
  files: Record<string, FileSnapshot>;
  commentIds?: string[];
}

export interface ReviewVerdict {
  id: string;
  decision: ReviewVerdictDecision;
  createdAt: string;
  scopeKey: string;
  base: string;
  head?: string;
  diffFingerprint: string;
  feedbackVersion?: number;
  blockingFeedbackDigest?: string;
  acknowledgedExclusions?: Array<{ path: string; reason: string }>;
  note?: string;
}

export interface ReviewVerdictEvaluation {
  state: 'none' | 'current' | 'stale';
  scopeKey: string;
  currentDiffFingerprint: string;
  latest?: ReviewVerdict;
  current?: ReviewVerdict;
  invalidationReason?: 'scope-changed' | 'diff-changed' | 'feedback-changed';
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
  verdicts?: ReviewVerdict[];
  feedbackVersion?: number;
  observedFeedbackSourceDigest?: string;
  observedFeedbackSourceStamp?: string;
  observedBlockingFeedbackDigest?: string;
  lastFeedbackSnapshotId?: string;
  cursors?: Record<string, ReviewCursor>;
  seenFiles?: string[];
}

interface ReviewStateFile {
  version: 1;
  scopes: Record<string, ScopeState>;
}

export interface ReviewSummary {
  scopeKey: string;
  round: number;
  currentDiffHash: string;
  currentSnapshotId?: string;
  changedSinceReview: number;
  changedFiles: string[];
  seenFiles: string[];
  events: ReviewEvent[];
  verdict: ReviewVerdictEvaluation;
  feedbackVersion: number;
  blockingFeedbackDigest: string;
  feedbackHealth: CommentStoreHealth;
}

export interface ReviewHistoryEntry {
  scopeKey: string;
  base: string;
  head?: string;
  round: number;
  snapshotCount: number;
  latestSnapshotFiles: number;
  seenFiles: number;
  startedAt: string;
  lastActivityAt: string;
  latestVerdict?: ReviewVerdict;
  events: ReviewEvent[];
}

export interface ReviewFileChange {
  file: string;
  before: string | null;
  after: string | null;
}

export class UnresolvedBlockingFeedbackError extends Error {
  constructor(readonly blockingCommentIds: string[]) {
    super(`Resolve ${blockingCommentIds.length} blocking ${blockingCommentIds.length === 1 ? 'comment' : 'comments'} before approval.`);
    this.name = 'UnresolvedBlockingFeedbackError';
  }
}

export class ReviewFeedbackChangedError extends Error {
  constructor(readonly currentFeedbackVersion: number, readonly currentBlockingFeedbackDigest: string) {
    super('Blocking feedback changed while the decision was being saved. Refresh before approval.');
    this.name = 'ReviewFeedbackChangedError';
  }
}

function statePath(repo: vscode.Uri): string {
  return path.join(repo.fsPath, '.diffstory', 'review-state.json');
}

function keyFor(base: string, head?: string): string {
  return createHash('sha256').update(`${base}\0${head ?? 'working-tree'}`).digest('hex').slice(0, 20);
}

function digest(value: string | null): string {
  return createHash('sha256').update(value == null ? '\0missing' : value).digest('hex');
}

async function load(repo: vscode.Uri): Promise<ReviewStateFile> {
  try {
    const value: unknown = JSON.parse(await readFile(statePath(repo), 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyState();
    const candidate = value as Partial<ReviewStateFile>;
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
  scope.verdicts ??= [];
  for (const snapshot of scope.snapshots) {
    const legacy = snapshot as unknown as { at?: string; reason: SnapshotReason | 'story-generated' };
    snapshot.createdAt ??= legacy.at ?? new Date(0).toISOString();
    snapshot.base ??= scope.base;
    if (legacy.reason === 'story-generated') snapshot.reason = 'opened';
    if (Array.isArray(snapshot.files)) {
      snapshot.files = Object.fromEntries((snapshot.files as unknown as string[]).map((file) => [file, { hash: digest(`legacy:${file}`), content: null }]));
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
    scope = { key, base, ...(head ? { head } : {}), round: 1, snapshots: [], events: [], verdicts: [], seenFiles: [] };
    state.scopes[key] = scope;
  }
  normalizeScope(scope);
  return scope;
}

function append(scope: ScopeState, event: Omit<ReviewEvent, 'id' | 'at' | 'round'>): ReviewEvent {
  const stored = { id: `e_${randomUUID().slice(0, 12)}`, at: new Date().toISOString(), round: scope.round, ...event };
  scope.events.push(stored);
  scope.events = scope.events.slice(-100);
  if (event.affectsApproval) scope.feedbackVersion = (scope.feedbackVersion ?? 0) + 1;
  return stored;
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
    return [file, { hash: digest(content), content }] as const;
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
  input: { base: string; head?: string; diff: string; files: string[]; reason: SnapshotReason | 'story-generated'; commentIds?: string[]; changeFingerprint?: string },
): Promise<ReviewSummary> {
  const state = await load(repo);
  const scope = scopeFor(state, input.base, input.head);
  const reason = input.reason === 'story-generated' ? 'opened' : input.reason;
  const diffHash = input.changeFingerprint ?? digest(input.diff);
  const last = scope.snapshots.at(-1);
  const feedback = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
  const files = await currentFiles(repo, input.head, input.files, feedback ? Object.keys(feedback.files) : []);
  if (reason === 'agent-complete' && feedback && feedback.diffHash !== diffHash) scope.round += 1;
  if (!last || last.diffHash !== diffHash || reason !== 'opened') {
    scope.snapshots.push({
      id: `r_${Date.now().toString(36)}_${diffHash.slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      round: scope.round,
      reason,
      base: input.base,
      ...(input.head ? { head: input.head } : {}),
      diffHash,
      files,
      ...(input.commentIds?.length ? { commentIds: [...new Set(input.commentIds)] } : {}),
    });
    scope.snapshots = scope.snapshots.slice(-20);
  }
  if (!scope.events.length) append(scope, { kind: 'review-started', label: 'Review started' });
  if (reason === 'feedback-sent') {
    scope.lastFeedbackSnapshotId = scope.snapshots.at(-1)?.id;
    append(scope, { kind: 'feedback-sent', label: `Sent ${input.commentIds?.length ?? 0} review comments to the agent` });
  }
  if (reason === 'agent-complete') {
    const changed = feedback ? changedPaths(feedback.files, files) : [];
    append(scope, { kind: 'agent-complete', label: changed.length ? `Agent updated ${changed.length} ${changed.length === 1 ? 'file' : 'files'}` : 'Agent replied', ...(changed.length ? { detail: changed.join(', ') } : {}) });
  }
  if (input.reason === 'story-generated') append(scope, { kind: 'story-repaired', label: 'Generated a guided story' });
  if (reason === 'story-repaired') append(scope, { kind: 'story-repaired', label: 'Story repaired' });
  await save(repo, state);
  return summarize(repo, scope, input.diff, files, input.changeFingerprint);
}

export async function recordReviewEvent(
  repo: vscode.Uri,
  input: { base: string; head?: string; kind: ReviewEventKind; label: string; detail?: string; files?: string[]; affectsApproval?: boolean },
): Promise<ReviewSummary> {
  const state = await load(repo);
  const scope = scopeFor(state, input.base, input.head);
  const observation = await feedbackObservation(repo);
  setFeedbackObservation(scope, observation);
  append(scope, { kind: input.kind, label: input.label, ...(input.detail ? { detail: input.detail } : {}), ...(input.affectsApproval ? { affectsApproval: true } : {}) });
  await save(repo, state);
  return summarize(repo, scope, '', await currentFiles(repo, input.head, input.files ?? []));
}

export async function reviewSummary(repo: vscode.Uri, input: { base: string; head?: string; diff: string; files: string[]; changeFingerprint?: string }): Promise<ReviewSummary> {
  const state = await load(repo);
  const scope = scopeFor(state, input.base, input.head);
  const observation = await feedbackObservation(repo);
  if (synchronizeFeedbackObservation(scope, observation)) await save(repo, state);
  const feedback = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
  const files = await currentFiles(repo, input.head, input.files, feedback ? Object.keys(feedback.files) : []);
  return summarize(repo, scope, input.diff, files, input.changeFingerprint, observation);
}

/** Read every persisted comparison without creating or mutating review state. */
export async function reviewHistory(repo: vscode.Uri): Promise<ReviewHistoryEntry[]> {
  const state = await load(repo);
  return Object.values(state.scopes)
    .map((scope) => {
      normalizeScope(scope);
      const snapshots = [...scope.snapshots];
      const events = [...scope.events];
      const verdicts = [...(scope.verdicts ?? [])];
      const cursors = Object.values(scope.cursors ?? {});
      const timestamps = [
        ...snapshots.map((snapshot) => snapshot.createdAt),
        ...events.map((event) => event.at),
        ...verdicts.map((verdict) => verdict.createdAt),
        ...cursors.map((cursor) => cursor.at),
      ].filter(Boolean).sort();
      const startedAt = timestamps[0] ?? new Date(0).toISOString();
      const lastActivityAt = timestamps.at(-1) ?? startedAt;
      return {
        scopeKey: scope.key,
        base: scope.base,
        ...(scope.head ? { head: scope.head } : {}),
        round: scope.round,
        snapshotCount: snapshots.length,
        latestSnapshotFiles: Object.keys(snapshots.at(-1)?.files ?? {}).length,
        seenFiles: scope.seenFiles?.length ?? 0,
        startedAt,
        lastActivityAt,
        ...(verdicts.at(-1) ? { latestVerdict: verdicts.at(-1) } : {}),
        events: events.slice(-12).reverse(),
      };
    })
    .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));
}

export async function recordReviewVerdict(
  repo: vscode.Uri,
  input: {
    base: string;
    head?: string;
    diff: string;
    changeFingerprint?: string;
    decision: ReviewVerdictDecision;
    note?: string;
    expectedFeedbackVersion?: number;
    expectedBlockingFeedbackDigest?: string;
    acknowledgedExclusions?: Array<{ path: string; reason: string }>;
  },
): Promise<ReviewVerdict> {
  const state = await load(repo);
  const scope = scopeFor(state, input.base, input.head);
  const loaded = await loadCommentsWithHealth(repo);
  const observation = await feedbackObservation(repo, loaded);
  if (synchronizeFeedbackObservation(scope, observation)) await save(repo, state);
  if (input.decision === 'approved' && loaded.health.status === 'invalid') throw new InvalidCommentStoreError(loaded.health);
  if (input.decision === 'approved') {
    const blockers = loaded.comments.filter((comment) => comment.status !== 'resolved' && commentSeverity(comment) === 'blocking').map((comment) => comment.id);
    if (blockers.length) throw new UnresolvedBlockingFeedbackError(blockers);
    if (input.expectedFeedbackVersion !== undefined && input.expectedFeedbackVersion !== (scope.feedbackVersion ?? 0)) {
      throw new ReviewFeedbackChangedError(scope.feedbackVersion ?? 0, observation.blockingDigest);
    }
    if (input.expectedBlockingFeedbackDigest !== undefined && input.expectedBlockingFeedbackDigest !== observation.blockingDigest) {
      throw new ReviewFeedbackChangedError(scope.feedbackVersion ?? 0, observation.blockingDigest);
    }
  }
  const fingerprint = input.changeFingerprint ?? digest(input.diff);
  const verdict: ReviewVerdict = {
    id: `v_${Date.now().toString(36)}_${fingerprint.slice(0, 8)}_${randomUUID().slice(0, 4)}`,
    decision: input.decision,
    createdAt: new Date().toISOString(),
    scopeKey: scope.key,
    base: input.base,
    ...(input.head ? { head: input.head } : {}),
    diffFingerprint: fingerprint,
    feedbackVersion: scope.feedbackVersion ?? 0,
    blockingFeedbackDigest: observation.blockingDigest,
    ...(input.acknowledgedExclusions?.length ? { acknowledgedExclusions: input.acknowledgedExclusions } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
  scope.verdicts = [...(scope.verdicts ?? []), verdict].slice(-50);
  append(scope, { kind: 'verdict-recorded', label: input.decision === 'approved' ? 'Review approved' : 'Changes requested', ...(verdict.note ? { detail: verdict.note } : {}) });
  await save(repo, state);
  return verdict;
}

export async function reviewChangesSinceFeedback(repo: vscode.Uri, input: { base: string; head?: string; files: string[] }): Promise<ReviewFileChange[]> {
  const state = await load(repo);
  const scope = scopeFor(state, input.base, input.head);
  const feedback = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
  if (!feedback) return [];
  const current = await currentFiles(repo, input.head, input.files, Object.keys(feedback.files));
  return changedPaths(feedback.files, current).map((file) => ({ file, before: feedback.files[file]?.content ?? null, after: current[file]?.content ?? null }));
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

function evaluateVerdict(scope: ScopeState, base: string, head: string | undefined, fingerprint: string, blockingDigest: string): ReviewVerdictEvaluation {
  const latest = scope.verdicts?.at(-1);
  if (!latest) return { state: 'none', scopeKey: scope.key, currentDiffFingerprint: fingerprint };
  const stale = (reason: ReviewVerdictEvaluation['invalidationReason']): ReviewVerdictEvaluation => ({ state: 'stale', scopeKey: scope.key, currentDiffFingerprint: fingerprint, latest, invalidationReason: reason });
  if (latest.scopeKey !== keyFor(base, head)) return stale('scope-changed');
  if (latest.diffFingerprint !== fingerprint) return stale('diff-changed');
  if ((latest.feedbackVersion ?? 0) !== (scope.feedbackVersion ?? 0) || latest.blockingFeedbackDigest !== blockingDigest) return stale('feedback-changed');
  return { state: 'current', scopeKey: scope.key, currentDiffFingerprint: fingerprint, latest, current: latest };
}

interface FeedbackObservation { sourceDigest: string; sourceStamp: string; blockingDigest: string }

async function feedbackObservation(repo: vscode.Uri, supplied?: Awaited<ReturnType<typeof loadCommentsWithHealth>>): Promise<FeedbackObservation> {
  const loaded = supplied ?? await loadCommentsWithHealth(repo);
  let sourceStamp: string;
  try {
    const info = await stat(path.join(repo.fsPath, '.diffstory', 'comments.json'), { bigint: true });
    sourceStamp = digest(JSON.stringify({ source: loaded.sourceDigest, ino: info.ino.toString(), size: info.size.toString(), mtime: info.mtimeNs.toString(), ctime: info.ctimeNs.toString() }));
  } catch {
    sourceStamp = digest(JSON.stringify({ source: loaded.sourceDigest, health: loaded.health.status }));
  }
  const blocking = loaded.health.status === 'invalid'
    ? [{ invalid: loaded.sourceDigest, reason: loaded.health.reason }]
    : loaded.comments.filter((comment) => comment.status !== 'resolved' && commentSeverity(comment) === 'blocking').sort((a, b) => a.id.localeCompare(b.id));
  return { sourceDigest: loaded.sourceDigest, sourceStamp, blockingDigest: digest(stableJson(blocking)) };
}

function setFeedbackObservation(scope: ScopeState, observation: FeedbackObservation): boolean {
  const changed = scope.observedFeedbackSourceDigest !== observation.sourceDigest || scope.observedFeedbackSourceStamp !== observation.sourceStamp || scope.observedBlockingFeedbackDigest !== observation.blockingDigest;
  scope.observedFeedbackSourceDigest = observation.sourceDigest;
  scope.observedFeedbackSourceStamp = observation.sourceStamp;
  scope.observedBlockingFeedbackDigest = observation.blockingDigest;
  return changed;
}

function synchronizeFeedbackObservation(scope: ScopeState, observation: FeedbackObservation): boolean {
  const initialized = scope.observedFeedbackSourceDigest !== undefined && scope.observedFeedbackSourceStamp !== undefined && scope.observedBlockingFeedbackDigest !== undefined;
  const sourceChanged = initialized && scope.observedFeedbackSourceDigest !== observation.sourceDigest;
  const stampChanged = initialized && scope.observedFeedbackSourceStamp !== observation.sourceStamp;
  const blockingChanged = initialized && scope.observedBlockingFeedbackDigest !== observation.blockingDigest;
  const advances = blockingChanged || (!sourceChanged && stampChanged);
  if (advances) scope.feedbackVersion = (scope.feedbackVersion ?? 0) + 1;
  return setFeedbackObservation(scope, observation) || advances;
}

async function summarize(
  repo: vscode.Uri,
  scope: ScopeState,
  diff: string,
  files: Record<string, FileSnapshot>,
  changeFingerprint?: string,
  suppliedObservation?: FeedbackObservation,
): Promise<ReviewSummary> {
  const observation = suppliedObservation ?? await feedbackObservation(repo);
  const feedback = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
  const changedFiles = feedback ? changedPaths(feedback.files, files) : [];
  const fingerprint = changeFingerprint ?? digest(diff);
  const loaded = await loadCommentsWithHealth(repo);
  return {
    scopeKey: scope.key,
    round: scope.round,
    currentDiffHash: fingerprint,
    ...(scope.snapshots.at(-1) ? { currentSnapshotId: scope.snapshots.at(-1)?.id } : {}),
    changedSinceReview: changedFiles.length,
    changedFiles,
    seenFiles: [...(scope.seenFiles ?? [])],
    events: [...scope.events].reverse(),
    verdict: evaluateVerdict(scope, scope.base, scope.head, fingerprint, observation.blockingDigest),
    feedbackVersion: scope.feedbackVersion ?? 0,
    blockingFeedbackDigest: observation.blockingDigest,
    feedbackHealth: loaded.health,
  };
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}
