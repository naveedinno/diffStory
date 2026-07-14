import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const { captureReview, markReviewFileSeen, reviewChangesSinceFeedback, reviewCursor, reviewSeenFiles, saveReviewCursor } = await import('../dist/review-state.js');

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
