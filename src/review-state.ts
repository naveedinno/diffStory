import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { commentsPath, reviewStatePath } from './config.js';
import { readWholeFile } from './git.js';
import {
  InvalidCommentStoreError,
  loadCommentsWithHealth,
  type CommentLoadResult,
  type CommentStoreHealth,
} from './comments.js';
import type { DiffFile } from './types.js';

export type ReviewSnapshotReason = 'opened' | 'feedback-sent' | 'agent-complete' | 'story-repaired';
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
  /** This event changes the blocking-feedback state an approval was based on. */
  affectsApproval?: boolean;
}

/** A reviewer decision bound to one scope and the exact diff bytes they reviewed. */
export interface ReviewVerdict {
  id: string;
  decision: ReviewVerdictDecision;
  createdAt: string;
  scopeKey: string;
  base: string;
  head?: string;
  diffFingerprint: string;
  /** Monotonic scope-local version of blocking feedback at decision time. */
  feedbackVersion?: number;
  /** Content identity of every unresolved blocking thread at decision time. */
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

export interface ReviewScopeState {
  key: string;
  base: string;
  head?: string;
  round: number;
  snapshots: ReviewSnapshot[];
  events: ReviewEvent[];
  verdicts?: ReviewVerdict[];
  feedbackVersion?: number;
  /** Last feedback source observed for direct-edit change detection. */
  observedFeedbackSourceDigest?: string;
  /** Filesystem generation of the observed source, including same-byte rewrites. */
  observedFeedbackSourceStamp?: string;
  /** Blocking semantics at the observed source generation. */
  observedBlockingFeedbackDigest?: string;
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
  snapshots: Array<
    Pick<ReviewSnapshot, 'id' | 'round' | 'createdAt' | 'reason' | 'diffHash'> & {
      /** Stable identity of every field that defines this stored checkpoint. */
      contentDigest: string;
    }
  >;
  /** Always present on summaries returned by reviewStateSummary; optional for legacy render inputs. */
  verdict?: ReviewVerdictEvaluation;
  feedbackVersion?: number;
  /** Live content identity, including direct edits to comments.json. */
  blockingFeedbackDigest: string;
  /** Invalid feedback must remain visible and block approval instead of reading as no comments. */
  feedbackHealth: CommentStoreHealth;
}

export interface CaptureReviewInput {
  base: string;
  head?: string;
  diff: string;
  files: DiffFile[];
  reason: ReviewSnapshotReason;
  commentIds?: string[];
  /** Complete-change identity; defaults to the rendered diff for compatibility. */
  changeFingerprint?: string;
}

export interface RecordReviewVerdictInput {
  base: string;
  head?: string;
  diff: string;
  decision: ReviewVerdictDecision;
  note?: string;
  /** Complete-change identity; defaults to the rendered diff for compatibility. */
  changeFingerprint?: string;
  /** Optional optimistic-concurrency evidence supplied by the rendered page. */
  expectedFeedbackVersion?: number;
  expectedBlockingFeedbackDigest?: string;
  acknowledgedExclusions?: Array<{ path: string; reason: string }>;
}

export class UnresolvedBlockingFeedbackError extends Error {
  readonly blockingCommentIds: string[];

  constructor(blockingCommentIds: string[]) {
    super(`Resolve ${blockingCommentIds.length} blocking ${blockingCommentIds.length === 1 ? 'comment' : 'comments'} before approval.`);
    this.name = 'UnresolvedBlockingFeedbackError';
    this.blockingCommentIds = blockingCommentIds;
  }
}

export class ReviewFeedbackChangedError extends Error {
  readonly currentFeedbackVersion: number;
  readonly currentBlockingFeedbackDigest: string;

  constructor(currentFeedbackVersion: number, currentBlockingFeedbackDigest: string) {
    super('Blocking feedback changed while the decision was being saved. Reload before approval.');
    this.name = 'ReviewFeedbackChangedError';
    this.currentFeedbackVersion = currentFeedbackVersion;
    this.currentBlockingFeedbackDigest = currentBlockingFeedbackDigest;
  }
}

export function reviewScopeKey(base: string, head?: string): string {
  return createHash('sha256').update(`${base}\0${head ?? 'working-tree'}`).digest('hex').slice(0, 20);
}

function digest(value: string | null): string {
  return createHash('sha256').update(value == null ? '\0missing' : value).digest('hex');
}

/**
 * Bind decisions to the actual unresolved blocking feedback, not only API
 * events. Agents intentionally edit comments.json directly, so an event-only
 * counter cannot prove that the page and stored verdict saw the same threads.
 */
export function blockingFeedbackDigest(repo: string): string {
  return blockingFeedbackIdentity(loadCommentsWithHealth(repo));
}

function blockingFeedbackIdentity(loaded: CommentLoadResult): string {
  if (loaded.health.status === 'invalid') {
    return digest(stableJson({ invalidFeedbackSource: loaded.sourceDigest, reason: loaded.health.reason }));
  }
  const blocking = loaded.comments
    .filter((comment) =>
      comment.status !== 'resolved' &&
      (comment.severity === 'blocking' || (!comment.severity && comment.type === 'change')),
    )
    .map((comment) => stableJson(comment))
    .sort();
  return digest(JSON.stringify(blocking));
}

function unresolvedBlockingCommentIds(loaded: CommentLoadResult): string[] {
  if (loaded.health.status === 'invalid') return [];
  return loaded.comments
    .filter((comment) =>
      comment.status !== 'resolved' &&
      (comment.severity === 'blocking' || (!comment.severity && comment.type === 'change')),
    )
    .map((comment) => comment.id);
}

interface FeedbackObservation {
  sourceDigest: string;
  sourceStamp: string;
  blockingDigest: string;
}

/**
 * The content digest identifies semantic source bytes. The filesystem stamp
 * also detects an out-of-band add/remove cycle that restores those exact bytes
 * before the next read. API-owned non-blocking mutations are acknowledged by
 * recordReviewEvent, so they retain their existing non-blocking semantics.
 */
function feedbackObservation(repo: string, loaded: CommentLoadResult): FeedbackObservation {
  let sourceStamp: string;
  try {
    const stat = statSync(commentsPath(repo), { bigint: true });
    sourceStamp = digest(stableJson({
      sourceDigest: loaded.sourceDigest,
      dev: stat.dev.toString(),
      ino: stat.ino.toString(),
      size: stat.size.toString(),
      mtimeNs: stat.mtimeNs.toString(),
      ctimeNs: stat.ctimeNs.toString(),
    }));
  } catch {
    sourceStamp = digest(stableJson({
      sourceDigest: loaded.sourceDigest,
      health: loaded.health.status === 'invalid' ? loaded.health.reason : loaded.health.source,
    }));
  }
  return {
    sourceDigest: loaded.sourceDigest,
    sourceStamp,
    blockingDigest: blockingFeedbackIdentity(loaded),
  };
}

function setFeedbackObservation(scope: ReviewScopeState, observation: FeedbackObservation): boolean {
  const changed =
    scope.observedFeedbackSourceDigest !== observation.sourceDigest ||
    scope.observedFeedbackSourceStamp !== observation.sourceStamp ||
    scope.observedBlockingFeedbackDigest !== observation.blockingDigest;
  scope.observedFeedbackSourceDigest = observation.sourceDigest;
  scope.observedFeedbackSourceStamp = observation.sourceStamp;
  scope.observedBlockingFeedbackDigest = observation.blockingDigest;
  return changed;
}

/** Persist direct blocking transitions monotonically so an ABA restore cannot
 * make an earlier approval current again. Different source bytes with identical
 * blocking semantics remain non-blocking; an identical-byte rewrite advances
 * conservatively because it can hide an unobserved add/remove cycle. */
function synchronizeFeedbackObservation(scope: ReviewScopeState, observation: FeedbackObservation): boolean {
  const initialized =
    scope.observedFeedbackSourceDigest !== undefined &&
    scope.observedFeedbackSourceStamp !== undefined &&
    scope.observedBlockingFeedbackDigest !== undefined;
  const sourceChanged = initialized && scope.observedFeedbackSourceDigest !== observation.sourceDigest;
  const stampChanged = initialized && scope.observedFeedbackSourceStamp !== observation.sourceStamp;
  const blockingChanged = initialized && scope.observedBlockingFeedbackDigest !== observation.blockingDigest;
  const shouldAdvance = blockingChanged || (!sourceChanged && stampChanged);
  if (shouldAdvance) scope.feedbackVersion = (scope.feedbackVersion ?? 0) + 1;
  return setFeedbackObservation(scope, observation) || shouldAdvance;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

/**
 * Stable identity for the exact stored checkpoint behind a since-feedback
 * comparison. The snapshot id alone is not sufficient: review-state.json can
 * be edited by another process while a page remains open.
 */
export function reviewSnapshotContentDigest(snapshot: ReviewSnapshot): string {
  return digest(stableJson({
    id: snapshot.id,
    round: snapshot.round,
    createdAt: snapshot.createdAt,
    reason: snapshot.reason,
    base: snapshot.base,
    head: snapshot.head ?? null,
    diffHash: snapshot.diffHash,
    files: snapshot.files,
    commentIds: snapshot.commentIds ?? [],
  }));
}

/** Stable identity for the exact rendered diff bytes. */
export function reviewDiffFingerprint(diff: string): string {
  return digest(diff);
}

function snapshotId(diffHash: string): string {
  return `r_${Date.now().toString(36)}_${diffHash.slice(0, 8)}`;
}

function eventId(): string {
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function verdictId(diffFingerprint: string): string {
  return `v_${Date.now().toString(36)}_${diffFingerprint.slice(0, 8)}_${Math.random().toString(36).slice(2, 6)}`;
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
    scope = { key, base, ...(head ? { head } : {}), round: 1, snapshots: [], events: [], verdicts: [] };
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
  if (event.affectsApproval) scope.feedbackVersion = (scope.feedbackVersion ?? 0) + 1;
  return stored;
}

export function captureReviewSnapshot(repo: string, input: CaptureReviewInput): ReviewSnapshot {
  const state = loadState(repo);
  const scope = scopeFor(state, input.base, input.head);
  const diffHash = input.changeFingerprint ?? reviewDiffFingerprint(input.diff);
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

/**
 * Purely evaluate whether a stored verdict still applies. A changed scope or
 * even one changed diff byte makes the old decision stale; history is retained.
 */
export function evaluateReviewVerdict(
  verdict: ReviewVerdict | undefined,
  base: string,
  head: string | undefined,
  diff: string,
  currentFeedbackVersion?: number,
  currentChangeFingerprint?: string,
  currentBlockingFeedbackDigest?: string,
): ReviewVerdictEvaluation {
  const scopeKey = reviewScopeKey(base, head);
  const currentDiffFingerprint = currentChangeFingerprint ?? reviewDiffFingerprint(diff);
  if (!verdict) return { state: 'none', scopeKey, currentDiffFingerprint };
  if (verdict.scopeKey !== scopeKey) {
    return {
      state: 'stale',
      scopeKey,
      currentDiffFingerprint,
      latest: verdict,
      invalidationReason: 'scope-changed',
    };
  }
  if (verdict.diffFingerprint !== currentDiffFingerprint) {
    return {
      state: 'stale',
      scopeKey,
      currentDiffFingerprint,
      latest: verdict,
      invalidationReason: 'diff-changed',
    };
  }
  if (currentFeedbackVersion != null && (verdict.feedbackVersion ?? 0) !== currentFeedbackVersion) {
    return {
      state: 'stale',
      scopeKey,
      currentDiffFingerprint,
      latest: verdict,
      invalidationReason: 'feedback-changed',
    };
  }
  if (
    currentBlockingFeedbackDigest != null &&
    verdict.blockingFeedbackDigest !== currentBlockingFeedbackDigest
  ) {
    return {
      state: 'stale',
      scopeKey,
      currentDiffFingerprint,
      latest: verdict,
      invalidationReason: 'feedback-changed',
    };
  }
  return {
    state: 'current',
    scopeKey,
    currentDiffFingerprint,
    latest: verdict,
    current: verdict,
  };
}

/** Persist a reviewer decision without discarding earlier decisions for this scope. */
export function recordReviewVerdict(repo: string, input: RecordReviewVerdictInput): ReviewVerdict {
  if (input.decision !== 'approved' && input.decision !== 'changes-requested') {
    throw new Error(`Unsupported review verdict: ${String(input.decision)}`);
  }
  const state = loadState(repo);
  const scope = scopeFor(state, input.base, input.head);
  const diffFingerprint = input.changeFingerprint ?? reviewDiffFingerprint(input.diff);
  const note = input.note?.trim();
  const feedback = loadCommentsWithHealth(repo);
  const observation = feedbackObservation(repo, feedback);
  if (synchronizeFeedbackObservation(scope, observation)) {
    // Persist the monotonic observation even when the approval below fails.
    // Otherwise a direct add/remove cycle could be forgotten by the next call.
    saveState(repo, state);
  }
  if (input.decision === 'approved' && feedback.health.status === 'invalid') {
    throw new InvalidCommentStoreError(feedback.health);
  }
  if (input.decision === 'approved') {
    const blockingCommentIds = unresolvedBlockingCommentIds(feedback);
    if (blockingCommentIds.length) throw new UnresolvedBlockingFeedbackError(blockingCommentIds);
    if (
      input.expectedFeedbackVersion !== undefined &&
      input.expectedFeedbackVersion !== (scope.feedbackVersion ?? 0)
    ) {
      throw new ReviewFeedbackChangedError(scope.feedbackVersion ?? 0, observation.blockingDigest);
    }
    if (
      input.expectedBlockingFeedbackDigest !== undefined &&
      input.expectedBlockingFeedbackDigest !== observation.blockingDigest
    ) {
      throw new ReviewFeedbackChangedError(scope.feedbackVersion ?? 0, observation.blockingDigest);
    }
  }
  const verdict: ReviewVerdict = {
    id: verdictId(diffFingerprint),
    decision: input.decision,
    createdAt: new Date().toISOString(),
    scopeKey: scope.key,
    base: input.base,
    ...(input.head ? { head: input.head } : {}),
    diffFingerprint,
    feedbackVersion: scope.feedbackVersion ?? 0,
    blockingFeedbackDigest: observation.blockingDigest,
    ...(input.acknowledgedExclusions?.length
      ? { acknowledgedExclusions: input.acknowledgedExclusions.map(({ path, reason }) => ({ path, reason })) }
      : {}),
    ...(note ? { note } : {}),
  };
  scope.verdicts = [...(scope.verdicts ?? []), verdict].slice(-50);
  pushEvent(scope, {
    kind: 'verdict-recorded',
    label: input.decision === 'approved' ? 'Review approved' : 'Changes requested',
    ...(note ? { detail: note } : {}),
  });
  saveState(repo, state);
  return verdict;
}

export function recordReviewEvent(
  repo: string,
  base: string,
  head: string | undefined,
  event: Omit<ReviewEvent, 'id' | 'at' | 'round'>,
): ReviewEvent {
  const state = loadState(repo);
  const scope = scopeFor(state, base, head);
  // Comment events are emitted after their file mutation. Mark that exact
  // source generation as API-observed so known non-blocking writes do not stale
  // approval; affectsApproval still advances the monotonic version below.
  setFeedbackObservation(scope, feedbackObservation(repo, loadCommentsWithHealth(repo)));
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
  changeFingerprint?: string,
): ReviewStateSummary {
  const state = loadState(repo);
  const key = reviewScopeKey(base, head);
  const feedback = loadCommentsWithHealth(repo);
  const observation = feedbackObservation(repo, feedback);
  const currentBlockingFeedbackDigest = observation.blockingDigest;
  const scope = state.scopes[key];
  if (!scope) {
    return {
      scopeKey: key,
      round: 1,
      currentDiffHash: changeFingerprint ?? reviewDiffFingerprint(diff),
      changedFiles: [],
      hasChangesSinceReview: false,
      events: [],
      snapshots: [],
      feedbackVersion: 0,
      blockingFeedbackDigest: currentBlockingFeedbackDigest,
      feedbackHealth: feedback.health,
      verdict: evaluateReviewVerdict(
        undefined,
        base,
        head,
        diff,
        0,
        changeFingerprint,
        currentBlockingFeedbackDigest,
      ),
    };
  }
  if (synchronizeFeedbackObservation(scope, observation)) saveState(repo, state);
  const comparison = scope.snapshots.find((snapshot) => snapshot.id === scope.lastFeedbackSnapshotId);
  const current = currentFileSnapshots(repo, head, files, comparison ? Object.keys(comparison.files) : []);
  const changedFiles = comparison ? changedPaths(comparison.files, current) : [];
  const latest = scope.snapshots[scope.snapshots.length - 1];
  return {
    scopeKey: key,
    round: scope.round,
    currentDiffHash: changeFingerprint ?? reviewDiffFingerprint(diff),
    ...(latest ? { currentSnapshotId: latest.id } : {}),
    ...(comparison ? { compareFrom: { id: comparison.id, round: comparison.round, createdAt: comparison.createdAt } } : {}),
    changedFiles,
    hasChangesSinceReview: changedFiles.length > 0,
    events: [...scope.events].reverse(),
    snapshots: scope.snapshots.map((snapshot) => ({
      id: snapshot.id,
      round: snapshot.round,
      createdAt: snapshot.createdAt,
      reason: snapshot.reason,
      diffHash: snapshot.diffHash,
      contentDigest: reviewSnapshotContentDigest(snapshot),
    })),
    feedbackVersion: scope.feedbackVersion ?? 0,
    blockingFeedbackDigest: currentBlockingFeedbackDigest,
    feedbackHealth: feedback.health,
    verdict: evaluateReviewVerdict(
      scope.verdicts?.[scope.verdicts.length - 1],
      base,
      head,
      diff,
      scope.feedbackVersion ?? 0,
      changeFingerprint,
      currentBlockingFeedbackDigest,
    ),
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
