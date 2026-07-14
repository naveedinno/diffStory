import assert from 'node:assert/strict';
import test from 'node:test';

const { isReviewComment, parseTour } = await import('../dist/model.js');

test('loads a compatible diffStory story and sorts its steps', () => {
  const story = parseTour({
    version: 1,
    diffFingerprint: 'a'.repeat(64),
    mode: 'guided',
    title: 'Review the safer close flow',
    summary: 'The close path now uses the protocol fee receiver.',
    base: 'main',
    storyScope: { includedFiles: ['src/close.ts', 'test/close.test.ts'], excludedFiles: ['docs/notes.md'], reviewerNote: 'Check the receiver.' },
    steps: [
      {
        id: 'two',
        order: 2,
        title: 'Proof',
        file: 'test/close.test.ts',
        range: [21, 34],
        kind: 'changed',
        why: 'The test proves the receiver is configured.',
      },
      {
        id: 'one',
        order: 1,
        title: 'Implementation',
        file: 'src/close.ts',
        range: [4, 18],
        highlights: [[8, 12]],
        kind: 'changed',
        why: 'This forwards the right receiver.',
      },
    ],
  });

  assert.ok(story);
  assert.deepEqual(story.steps.map((step) => step.id), ['one', 'two']);
  assert.deepEqual(story.steps[0].highlights, [[8, 12]]);
  assert.equal(story.diffFingerprint, 'a'.repeat(64));
  assert.deepEqual(story.storyScope.includedFiles, ['src/close.ts', 'test/close.test.ts']);
});

test('rejects malformed stories before the review panel renders them', () => {
  assert.equal(parseTour({ version: 1, title: 'Broken', summary: 'No steps', steps: [] }), undefined);
  assert.equal(parseTour({
    version: 1,
    title: 'Broken range',
    summary: 'A range cannot be reversed.',
    steps: [{ id: 'one', order: 1, title: 'Bad', file: 'src/a.ts', range: [12, 3], kind: 'changed', why: 'Nope' }],
  }), undefined);
  assert.equal(parseTour({
    version: 1,
    title: 'Escaping path',
    summary: 'A story cannot leave its workspace.',
    steps: [{ id: 'one', order: 1, title: 'Bad', file: '../secret.ts', range: [1, 1], kind: 'changed', why: 'Nope' }],
  }), undefined);
  assert.equal(parseTour({
    version: 1,
    diffFingerprint: 'not-a-sha',
    title: 'Broken fingerprint',
    summary: '',
    steps: [{ id: 'one', order: 1, title: 'Bad', file: 'src/a.ts', range: [1, 1], kind: 'changed', why: 'Nope' }],
  }), undefined);
});

test('rejects malformed optional comment data before the sidebar renders it', () => {
  const comment = {
    id: 'comment-1',
    file: 'src/review.ts',
    line: 12,
    type: 'question',
    body: 'Does this cover the empty state?',
    status: 'addressed',
    createdAt: '2026-07-13T10:00:00.000Z',
    selectedText: 'return result;',
    reply: 'Yes, the empty branch is explicit.',
    selection: { startLine: 12, endLine: 12, startColumn: 1, endColumn: 15 },
    turns: [{ role: 'ai', text: 'Handled.', at: '2026-07-13T10:01:00.000Z' }],
  };

  assert.equal(isReviewComment(comment), true);
  assert.equal(isReviewComment({ ...comment, reply: { text: 'wrong shape' } }), false);
  assert.equal(isReviewComment({ ...comment, turns: [{ role: 'robot', text: 'wrong role', at: 'now' }] }), false);
  assert.equal(isReviewComment({ ...comment, selection: { startLine: 14, endLine: 12 } }), false);
});
