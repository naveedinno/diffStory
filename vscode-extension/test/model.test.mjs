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

test('loads v2 concept primers and code-flow links from web-generated stories', () => {
  const story = parseTour({
    version: 2,
    title: 'Review the state machine',
    summary: 'Learn the states before following the transition.',
    steps: [
      {
        id: 'primer', order: 1, title: 'The three states', kind: 'concept',
        body: 'A request moves from **open** to **addressed** to **resolved**.',
        preparesFor: ['transition'],
        diagram: { type: 'mermaid', source: 'flowchart LR\nA-->B', caption: 'The review lifecycle.' },
      },
      {
        id: 'transition', order: 2, title: 'The transition is persisted', kind: 'changed',
        file: 'src/state.ts', range: [10, 20], why: 'This is the state write.',
        calls: ['render'], focus: { ranges: [[14, 16]], label: 'State update' },
      },
      {
        id: 'render', order: 3, title: 'The UI reflects the state', kind: 'context',
        file: 'src/view.ts', range: [4, 8], why: 'This consumes the transition.', returnsTo: 'transition',
      },
    ],
  });

  assert.equal(story.version, 2);
  assert.equal(story.steps[0].kind, 'concept');
  assert.equal(story.steps[0].diagram.caption, 'The review lifecycle.');
  assert.deepEqual(story.steps[1].calls, ['render']);
  assert.equal(story.steps[2].returnsTo, 'transition');
  assert.equal(parseTour({ version: 1, title: 'No concepts', summary: '', steps: [story.steps[0]] }), undefined);
});

test('rejects unsafe diagrams and broken v2 step relationships', () => {
  const code = { id: 'code', order: 2, title: 'Code', kind: 'changed', file: 'src/a.ts', range: [1, 2], why: 'Change' };
  assert.equal(parseTour({
    version: 2, title: 'Unsafe', summary: '',
    steps: [
      { id: 'primer', order: 1, title: 'Primer', kind: 'concept', body: 'Context', preparesFor: ['code'], diagram: { type: 'mermaid', source: 'flowchart LR\nclick A "https://example.com"', caption: 'Unsafe click.' } },
      code,
    ],
  }), undefined);
  assert.equal(parseTour({
    version: 2, title: 'Broken flow', summary: '',
    steps: [{ ...code, order: 1, calls: ['missing'] }],
  }), undefined);
  assert.equal(parseTour({
    version: 2, title: 'Trailing primer', summary: '',
    steps: [
      { ...code, order: 1 },
      { id: 'primer', order: 2, title: 'Primer', kind: 'concept', body: 'Context', preparesFor: ['code'] },
    ],
  }), undefined);
});

test('accepts severity and review identity on shared comments', () => {
  assert.equal(isReviewComment({
    id: 'c1', file: 'src/a.ts', line: 1, type: 'question', severity: 'blocking',
    body: 'This question blocks approval.', status: 'open', reviewRound: 3,
    reviewSnapshotId: 'r_123', createdAt: '2026-07-15T10:00:00.000Z',
  }), true);
});
