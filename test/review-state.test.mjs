import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseUnifiedDiff } from '../dist/diff.js';
import { getDiff } from '../dist/git.js';
import {
  captureReviewSnapshot,
  diffSinceReview,
  evaluateReviewVerdict,
  recordReviewVerdict,
  recordReviewEvent,
  reviewDiffFingerprint,
  reviewSnapshotContentDigest,
  reviewStateSummary,
} from '../dist/review-state.js';

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'ds-rounds-'));
  const git = (args) => execFileSync('git', args, { cwd: dir });
  git(['init', '-q']);
  git(['config', 'user.email', 't@e.st']);
  git(['config', 'user.name', 'T']);
  writeFileSync(join(dir, 'a.ts'), 'export const value = 1;\n');
  git(['add', '.']);
  git(['commit', '-qm', 'init']);
  return { dir, git };
}

function current(dir) {
  const diff = getDiff(dir, 'HEAD');
  return { diff, files: parseUnifiedDiff(diff) };
}

test('feedback checkpoints create a versioned comparison and agent round', () => {
  const { dir } = repo();
  try {
    writeFileSync(join(dir, 'a.ts'), 'export const value = 2;\n');
    const first = current(dir);
    captureReviewSnapshot(dir, { base: 'HEAD', ...first, reason: 'opened' });
    const feedback = captureReviewSnapshot(dir, {
      base: 'HEAD',
      ...first,
      reason: 'feedback-sent',
      commentIds: ['c1'],
    });

    writeFileSync(join(dir, 'a.ts'), 'export const value = 3;\n');
    writeFileSync(join(dir, 'b.ts'), 'export const added = true;\n');
    const second = current(dir);
    const completed = captureReviewSnapshot(dir, { base: 'HEAD', ...second, reason: 'agent-complete' });
    const summary = reviewStateSummary(dir, 'HEAD', undefined, second.diff, second.files);

    assert.equal(feedback.round, 1);
    assert.equal(completed.round, 2);
    assert.equal(summary.round, 2);
    assert.deepEqual(summary.changedFiles, ['a.ts', 'b.ts']);
    assert.equal(summary.compareFrom.id, feedback.id);
    assert.match(diffSinceReview(dir, 'HEAD', undefined, second.files, feedback.id), /export const value = 3/);
    assert.match(diffSinceReview(dir, 'HEAD', undefined, second.files, feedback.id), /b\/b\.ts/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('opening an unchanged review does not create duplicate snapshots', () => {
  const { dir } = repo();
  try {
    writeFileSync(join(dir, 'a.ts'), 'export const value = 2;\n');
    const state = current(dir);
    const one = captureReviewSnapshot(dir, { base: 'HEAD', ...state, reason: 'opened' });
    const two = captureReviewSnapshot(dir, { base: 'HEAD', ...state, reason: 'opened' });
    assert.equal(one.id, two.id);
    const stored = JSON.parse(readFileSync(join(dir, '.diffstory', 'review-state.json'), 'utf8'));
    assert.equal(Object.values(stored.scopes)[0].snapshots.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('snapshot content digests are stable and change when stored evidence changes under the same id', () => {
  const { dir } = repo();
  try {
    writeFileSync(join(dir, 'a.ts'), 'export const value = 2;\n');
    const state = current(dir);
    const snapshot = captureReviewSnapshot(dir, { base: 'HEAD', ...state, reason: 'feedback-sent' });
    const summary = reviewStateSummary(dir, 'HEAD', undefined, state.diff, state.files);
    const reported = summary.snapshots.find((candidate) => candidate.id === snapshot.id);

    assert.equal(reported?.contentDigest, reviewSnapshotContentDigest(snapshot));

    const tampered = structuredClone(snapshot);
    tampered.files['a.ts'].content = 'export const value = 999;';
    assert.notEqual(reviewSnapshotContentDigest(tampered), reported?.contentDigest);

    const hashTampered = structuredClone(snapshot);
    hashTampered.files['a.ts'].hash = 'tampered-but-same-snapshot-id';
    assert.notEqual(reviewSnapshotContentDigest(hashTampered), reported?.contentDigest);

    const reordered = {
      ...structuredClone(snapshot),
      files: Object.fromEntries(Object.entries(snapshot.files).reverse()),
    };
    assert.equal(reviewSnapshotContentDigest(reordered), reported?.contentDigest, 'JSON key order is not evidence');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an approval is persisted for the exact current diff', () => {
  const { dir } = repo();
  try {
    writeFileSync(join(dir, 'a.ts'), 'export const value = 2;\n');
    const state = current(dir);

    const verdict = recordReviewVerdict(dir, {
      base: 'HEAD',
      diff: state.diff,
      decision: 'approved',
      note: 'Reviewed locally',
    });
    const summary = reviewStateSummary(dir, 'HEAD', undefined, state.diff, state.files);

    assert.equal(verdict.decision, 'approved');
    assert.equal(verdict.note, 'Reviewed locally');
    assert.equal(summary.verdict.state, 'current');
    assert.equal(summary.verdict.latest?.id, verdict.id);

    const stored = JSON.parse(readFileSync(join(dir, '.diffstory', 'review-state.json'), 'utf8'));
    assert.equal(Object.values(stored.scopes)[0].verdicts.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a persisted verdict becomes stale as soon as the diff changes', () => {
  const { dir } = repo();
  try {
    writeFileSync(join(dir, 'a.ts'), 'export const value = 2;\n');
    const reviewed = current(dir);
    const verdict = recordReviewVerdict(dir, {
      base: 'HEAD',
      diff: reviewed.diff,
      decision: 'approved',
    });

    writeFileSync(join(dir, 'a.ts'), 'export const value = 3;\n');
    const changed = current(dir);
    const summary = reviewStateSummary(dir, 'HEAD', undefined, changed.diff, changed.files);

    assert.equal(summary.verdict.state, 'stale');
    assert.equal(summary.verdict.invalidationReason, 'diff-changed');
    assert.equal(summary.verdict.latest?.id, verdict.id, 'the old decision remains available as history');
    assert.equal(summary.verdict.current, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('pure verdict evaluation rejects a different review scope even for identical diff bytes', () => {
  const diff = 'diff --git a/a.ts b/a.ts\n';
  const verdict = {
    id: 'v1',
    decision: 'approved',
    createdAt: '2026-07-14T00:00:00.000Z',
    scopeKey: 'not-the-current-scope',
    base: 'main',
    diffFingerprint: reviewDiffFingerprint(diff),
  };

  const evaluation = evaluateReviewVerdict(verdict, 'HEAD', undefined, diff);
  assert.equal(evaluation.state, 'stale');
  assert.equal(evaluation.invalidationReason, 'scope-changed');
});

test('a blocking-feedback event permanently stales an earlier approval version', () => {
  const { dir } = repo();
  try {
    writeFileSync(join(dir, 'a.ts'), 'export const value = 2;\n');
    const state = current(dir);
    const verdict = recordReviewVerdict(dir, {
      base: 'HEAD', diff: state.diff, decision: 'approved',
    });
    assert.equal(verdict.feedbackVersion, 0);

    recordReviewEvent(dir, 'HEAD', undefined, {
      kind: 'comment-reopened',
      label: 'Blocking comment reopened',
      affectsApproval: true,
    });
    const stale = reviewStateSummary(dir, 'HEAD', undefined, state.diff, state.files);
    assert.equal(stale.feedbackVersion, 1);
    assert.equal(stale.verdict.state, 'stale');
    assert.equal(stale.verdict.invalidationReason, 'feedback-changed');

    recordReviewEvent(dir, 'HEAD', undefined, {
      kind: 'comment-resolved',
      label: 'Blocking comment resolved',
      affectsApproval: true,
    });
    const stillStale = reviewStateSummary(dir, 'HEAD', undefined, state.diff, state.files);
    assert.equal(stillStale.feedbackVersion, 2);
    assert.equal(stillStale.verdict.state, 'stale', 'resolving does not resurrect an earlier approval');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('direct blocking feedback transitions stale an approval monotonically without an API event', () => {
  const { dir } = repo();
  try {
    writeFileSync(join(dir, 'a.ts'), 'export const value = 2;\n');
    const state = current(dir);
    const verdict = recordReviewVerdict(dir, {
      base: 'HEAD', diff: state.diff, decision: 'approved',
    });
    const before = reviewStateSummary(dir, 'HEAD', undefined, state.diff, state.files);
    assert.equal(before.verdict.state, 'current');

    writeFileSync(join(dir, '.diffstory', 'comments.json'), JSON.stringify([{
      id: 'agent-added-blocker',
      file: 'a.ts',
      line: 1,
      type: 'change',
      severity: 'blocking',
      body: 'This direct handoff edit still needs work.',
      status: 'open',
      createdAt: '2026-07-14T00:00:00.000Z',
    }], null, 2));

    const after = reviewStateSummary(dir, 'HEAD', undefined, state.diff, state.files);
    assert.equal(after.feedbackVersion, before.feedbackVersion + 1, 'the direct blocking transition is observed');
    assert.notEqual(after.blockingFeedbackDigest, verdict.blockingFeedbackDigest);
    assert.equal(after.verdict.state, 'stale');
    assert.equal(after.verdict.invalidationReason, 'feedback-changed');

    writeFileSync(join(dir, '.diffstory', 'comments.json'), '[]\n');
    const restored = reviewStateSummary(dir, 'HEAD', undefined, state.diff, state.files);
    assert.equal(restored.feedbackVersion, before.feedbackVersion + 2);
    assert.equal(restored.blockingFeedbackDigest, verdict.blockingFeedbackDigest);
    assert.equal(restored.verdict.state, 'stale', 'restoring the old bytes cannot resurrect approval');
    assert.equal(restored.verdict.invalidationReason, 'feedback-changed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('direct non-blocking feedback preserves approval semantics', () => {
  const { dir } = repo();
  try {
    writeFileSync(join(dir, 'a.ts'), 'export const value = 2;\n');
    const state = current(dir);
    const verdict = recordReviewVerdict(dir, { base: 'HEAD', diff: state.diff, decision: 'approved' });
    const before = reviewStateSummary(dir, 'HEAD', undefined, state.diff, state.files);

    writeFileSync(join(dir, '.diffstory', 'comments.json'), JSON.stringify([{
      id: 'agent-concern', file: 'a.ts', line: 1, type: 'question', severity: 'concern',
      body: 'Worth a follow-up, but not approval-blocking.', status: 'open',
      createdAt: '2026-07-14T00:00:00.000Z',
    }], null, 2));

    const after = reviewStateSummary(dir, 'HEAD', undefined, state.diff, state.files);
    assert.equal(after.feedbackVersion, before.feedbackVersion);
    assert.equal(after.blockingFeedbackDigest, verdict.blockingFeedbackDigest);
    assert.equal(after.verdict.state, 'current');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('recordReviewVerdict independently rejects unresolved blockers on its final read', () => {
  const { dir } = repo();
  try {
    writeFileSync(join(dir, 'a.ts'), 'export const value = 2;\n');
    const state = current(dir);
    mkdirSync(join(dir, '.diffstory'), { recursive: true });
    writeFileSync(join(dir, '.diffstory', 'comments.json'), JSON.stringify([{
      id: 'late-blocker', file: 'a.ts', line: 1, type: 'change', severity: 'blocking',
      body: 'Inserted after an earlier preflight.', status: 'open',
      createdAt: '2026-07-14T00:00:00.000Z',
    }], null, 2));

    assert.throws(
      () => recordReviewVerdict(dir, { base: 'HEAD', diff: state.diff, decision: 'approved' }),
      (error) => error?.name === 'UnresolvedBlockingFeedbackError' &&
        error.blockingCommentIds?.[0] === 'late-blocker',
    );
    const summary = reviewStateSummary(dir, 'HEAD', undefined, state.diff, state.files);
    assert.equal(summary.verdict.state, 'none');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('malformed feedback has a content-bound blocking identity and fails approval closed', () => {
  const { dir } = repo();
  try {
    writeFileSync(join(dir, 'a.ts'), 'export const value = 2;\n');
    const state = current(dir);
    recordReviewVerdict(dir, { base: 'HEAD', diff: state.diff, decision: 'approved' });

    const path = join(dir, '.diffstory', 'comments.json');
    writeFileSync(path, '[null]');
    const first = reviewStateSummary(dir, 'HEAD', undefined, state.diff, state.files);
    assert.equal(first.feedbackHealth.status, 'invalid');
    assert.equal(first.verdict.state, 'stale');
    assert.equal(first.verdict.invalidationReason, 'feedback-changed');
    assert.throws(
      () => recordReviewVerdict(dir, { base: 'HEAD', diff: state.diff, decision: 'approved' }),
      /will not overwrite the invalid file/i,
    );

    writeFileSync(path, '[{"different":"malformed"}]');
    const second = reviewStateSummary(dir, 'HEAD', undefined, state.diff, state.files);
    assert.notEqual(second.blockingFeedbackDigest, first.blockingFeedbackDigest);
    assert.equal(second.feedbackHealth.status, 'invalid');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('verdict identity can use a complete-change fingerprint beyond rendered diff bytes', () => {
  const { dir } = repo();
  try {
    writeFileSync(join(dir, 'a.ts'), 'export const value = 2;\n');
    const state = current(dir);
    recordReviewVerdict(dir, {
      base: 'HEAD', diff: state.diff, changeFingerprint: 'full-change-a', decision: 'approved',
    });
    const currentSummary = reviewStateSummary(
      dir, 'HEAD', undefined, state.diff, state.files, 'full-change-a',
    );
    assert.equal(currentSummary.verdict.state, 'current');
    const staleSummary = reviewStateSummary(
      dir, 'HEAD', undefined, state.diff, state.files, 'full-change-b',
    );
    assert.equal(staleSummary.verdict.state, 'stale');
    assert.equal(staleSummary.verdict.invalidationReason, 'diff-changed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
