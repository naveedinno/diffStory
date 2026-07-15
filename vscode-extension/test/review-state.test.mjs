import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const { captureReview, markReviewFileSeen, recordReviewVerdict, reviewChangesSinceFeedback, reviewCursor, reviewHistory, reviewSeenFiles, reviewSummary, saveReviewCursor, UnresolvedBlockingFeedbackError } = await import('../dist/review-state.js');

test('a same-file edit after feedback starts a new review round', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'diffstory-review-state-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = { fsPath: root };
  await writeFile(path.join(root, 'change.ts'), 'export const value = 1;\n');
  await captureReview(repo, { base: 'HEAD', diff: 'first diff', files: ['change.ts'], reason: 'feedback-sent', commentIds: ['comment-1'] });
  await writeFile(path.join(root, 'change.ts'), 'export const value = 2;\n');
  const summary = await captureReview(repo, { base: 'HEAD', diff: 'second diff', files: ['change.ts'], reason: 'agent-complete' });
  assert.equal(summary.round, 2);
  assert.deepEqual(summary.changedFiles, ['change.ts']);
  assert.deepEqual(await reviewChangesSinceFeedback(repo, { base: 'HEAD', files: ['change.ts'] }), [{
    file: 'change.ts', before: 'export const value = 1;\n', after: 'export const value = 2;\n',
  }]);
});

test('the story cursor is persisted per review scope and story', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'diffstory-review-cursor-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = { fsPath: root };
  await saveReviewCursor(repo, { base: 'main', storyId: 'stories/flow.json', stepId: 'agent-bridge' });
  const cursor = await reviewCursor(repo, 'main', undefined, 'stories/flow.json');
  assert.equal(cursor?.storyId, 'stories/flow.json');
  assert.equal(cursor?.stepId, 'agent-bridge');
  assert.ok(Date.parse(cursor?.at ?? ''));
});

test('seen-file progress is deduplicated and isolated to its review scope', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'diffstory-review-seen-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = { fsPath: root };
  await markReviewFileSeen(repo, { base: 'main', file: 'src/one.ts' });
  await markReviewFileSeen(repo, { base: 'main', file: 'src/one.ts' });
  await markReviewFileSeen(repo, { base: 'main', file: 'src/two.ts' });
  assert.deepEqual(await reviewSeenFiles(repo, 'main', undefined), ['src/one.ts', 'src/two.ts']);
  assert.deepEqual(await reviewSeenFiles(repo, 'HEAD', undefined), []);
});

test('review history summarizes every persisted comparison without creating another scope', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'diffstory-review-history-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = { fsPath: root };
  await writeFile(path.join(root, 'change.ts'), 'export const value = 1;\n');
  await captureReview(repo, { base: 'main', head: 'feature', diff: 'feature diff', files: ['change.ts'], reason: 'opened' });
  await markReviewFileSeen(repo, { base: 'main', head: 'feature', file: 'change.ts' });
  await captureReview(repo, { base: 'HEAD', diff: 'working diff', files: ['change.ts'], reason: 'feedback-sent', commentIds: ['comment-1'] });

  const history = await reviewHistory(repo);
  assert.equal(history.length, 2);
  assert.equal(history[0].base, 'HEAD');
  assert.equal(history[0].snapshotCount, 1);
  assert.equal(history[0].events[0].kind, 'feedback-sent');
  const feature = history.find((entry) => entry.head === 'feature');
  assert.equal(feature.seenFiles, 1);
  assert.equal(feature.latestSnapshotFiles, 1);
});

test('approval is bound to exact code and blocking feedback', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'diffstory-review-verdict-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = { fsPath: root };
  await writeFile(path.join(root, 'change.ts'), 'export const value = 1;\n');
  await captureReview(repo, { base: 'HEAD', diff: 'bounded diff', changeFingerprint: 'full-a', files: ['change.ts'], reason: 'opened' });
  let summary = await reviewSummary(repo, { base: 'HEAD', diff: 'bounded diff', changeFingerprint: 'full-a', files: ['change.ts'] });
  await recordReviewVerdict(repo, {
    base: 'HEAD', diff: 'bounded diff', changeFingerprint: 'full-a', decision: 'approved',
    expectedFeedbackVersion: summary.feedbackVersion,
    expectedBlockingFeedbackDigest: summary.blockingFeedbackDigest,
  });
  summary = await reviewSummary(repo, { base: 'HEAD', diff: 'bounded diff', changeFingerprint: 'full-a', files: ['change.ts'] });
  assert.equal(summary.verdict.state, 'current');
  assert.equal(summary.verdict.current.decision, 'approved');

  summary = await reviewSummary(repo, { base: 'HEAD', diff: 'bounded diff', changeFingerprint: 'full-b', files: ['change.ts'] });
  assert.equal(summary.verdict.state, 'stale');
  assert.equal(summary.verdict.invalidationReason, 'diff-changed');

  await mkdir(path.join(root, '.diffstory'), { recursive: true });
  await writeFile(path.join(root, '.diffstory', 'comments.json'), JSON.stringify([{
    id: 'blocker', file: 'change.ts', line: 1, type: 'question', severity: 'blocking', body: 'Prove this.',
    status: 'open', createdAt: '2026-07-15T10:00:00.000Z',
  }]), 'utf8');
  const blocked = await reviewSummary(repo, { base: 'HEAD', diff: 'bounded diff', changeFingerprint: 'full-b', files: ['change.ts'] });
  await assert.rejects(() => recordReviewVerdict(repo, {
    base: 'HEAD', diff: 'bounded diff', changeFingerprint: 'full-b', decision: 'approved',
    expectedFeedbackVersion: blocked.feedbackVersion,
    expectedBlockingFeedbackDigest: blocked.blockingFeedbackDigest,
  }), UnresolvedBlockingFeedbackError);
});
