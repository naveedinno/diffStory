// Unit tests for tour validation. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTour, validateTour } from '../dist/tour.js';

test('a well-formed tour has no errors', () => {
  const errs = validateTour({
    version: 1,
    mode: 'brief',
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  });
  assert.deepEqual(errs, []);
});

test('loadTour canonicalizes deleted step kind to changed', () => {
  const repo = mkdtempSync(join(tmpdir(), 'ds-tour-'));
  const path = join(repo, 'story.json');
  writeFileSync(
    path,
    JSON.stringify({
      version: 1,
      title: 'T',
      summary: '',
      steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'deleted', why: 'w' }],
    }),
  );

  const tour = loadTour(path);
  assert.equal(tour.steps[0].kind, 'changed');

  rmSync(repo, { recursive: true, force: true });
});

test('accepts an optional narrow read-aloud focus target inside the step range', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'x.ts',
        range: [10, 20],
        focus: { ranges: [[14, 16]], label: 'balance guard' },
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.deepEqual(errs, []);
});

test('accepts an optional story generation file scope', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    storyScope: {
      includedFiles: ['contracts/Fee.sol'],
      excludedFiles: ['test/Fee.test.ts', 'package.json'],
      reviewerNote: 'Pay extra attention to the fee guard.',
    },
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'contracts/Fee.sol',
        range: [10, 20],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.deepEqual(errs, []);
});

test('flags malformed story generation file scopes', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    storyScope: {
      includedFiles: [],
      excludedFiles: ['test/Fee.test.ts', 12],
      reviewerNote: 42,
    },
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'contracts/Fee.sol',
        range: [10, 20],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.ok(errs.some((e) => e.includes('storyScope.includedFiles')));
  assert.ok(errs.some((e) => e.includes('storyScope.excludedFiles[1]')));
  assert.ok(errs.some((e) => e.includes('storyScope.reviewerNote')));
});

test('flags scoped story steps that point at files outside the selected scope', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    storyScope: {
      includedFiles: ['contracts/Fee.sol'],
      excludedFiles: ['test/Fee.test.ts'],
    },
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'test/Fee.test.ts',
        range: [10, 20],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.ok(errs.some((e) => e.includes('storyScope.includedFiles')));
});

test('accepts viewport and highlighted lines as the storyteller display contract', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'x.ts',
        range: [45, 46],
        viewport: [37, 66],
        highlights: [[45, 46]],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.deepEqual(errs, []);
});

test('accepts story beats with their own highlighted lines', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'x.ts',
        range: [45, 52],
        viewport: [37, 66],
        highlights: [[45, 52]],
        beats: [
          { text: 'First I explain the guard.', highlights: [[45, 46]] },
          { text: 'Then I explain the handoff.', highlights: [[51, 52]] },
        ],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.deepEqual(errs, []);
});

test('accepts the pure deleted-file sentinel anchor', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'deleted file',
        file: 'old-plan.md',
        range: [0, 0],
        viewport: [0, 0],
        highlights: [[0, 0]],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.deepEqual(errs, []);
});

test('flags wrong version, missing title, and empty steps', () => {
  const errs = validateTour({ version: 2, steps: [] });
  assert.ok(errs.some((e) => e.includes('version')));
  assert.ok(errs.some((e) => e.includes('title')));
  assert.ok(errs.some((e) => e.includes('steps')));
});

test('flags a bad kind and a malformed range', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1], kind: 'bogus', why: 'w' }],
  });
  assert.ok(errs.some((e) => e.includes('kind')));
  assert.ok(errs.some((e) => e.includes('range')));
});

test('flags malformed or out-of-range read-aloud focus targets', () => {
  const malformed = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [10, 20], focus: { ranges: [[14]] }, kind: 'changed', why: 'w' }],
  });
  assert.ok(malformed.some((e) => e.includes('focus.ranges[0]')));

  const outside = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [10, 20], focus: { ranges: [[9, 10]] }, kind: 'changed', why: 'w' }],
  });
  assert.ok(outside.some((e) => e.includes('inside steps[0].range')));
});

test('flags highlighted lines outside the viewport', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'x.ts',
        range: [45, 46],
        viewport: [37, 66],
        highlights: [[30, 34]],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.ok(errs.some((e) => e.includes('highlights[0] must be inside steps[0].viewport')));
});

test('flags malformed or out-of-range story beats', () => {
  const malformed = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'x.ts',
        range: [45, 46],
        viewport: [37, 66],
        beats: [{ text: '', highlights: [[45, 46]] }],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.ok(malformed.some((e) => e.includes('beats[0].text')));

  const outside = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'x.ts',
        range: [45, 46],
        viewport: [37, 66],
        beats: [{ text: 'Too far.', highlights: [[70, 71]] }],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.ok(outside.some((e) => e.includes('beats[0].highlights[0] must be inside steps[0].viewport')));
});

test('flags an invalid story mode', () => {
  const errs = validateTour({
    version: 1,
    mode: 'verbose',
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  });
  assert.ok(errs.some((e) => e.includes('mode')));
});

test('flags references to unknown step ids', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w', calls: ['nope'] }],
  });
  assert.ok(errs.some((e) => e.includes('unknown step id')));
});

test('flags invalid story step ordering', () => {
  const duplicate = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      { id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' },
      { id: 's2', order: 1, title: 'b', file: 'x.ts', range: [3, 4], kind: 'changed', why: 'w' },
    ],
  });
  assert.ok(duplicate.some((e) => e.includes('order 1 is duplicated')));

  for (const badOrder of [0, -1, 1.5]) {
    const errs = validateTour({
      version: 1,
      title: 'T',
      summary: '',
      steps: [{ id: 's1', order: badOrder, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
    });
    assert.ok(errs.some((e) => e.includes('order must be a positive integer')), `order ${badOrder} should be rejected`);
  }
});

test('flags malformed optional step metadata without throwing', () => {
  const base = {
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  };

  assert.ok(validateTour({ ...base, steps: [{ ...base.steps[0], tags: [123] }] }).includes('steps[0].tags[0] must be a non-empty string'));
  assert.ok(validateTour({ ...base, steps: [{ ...base.steps[0], calls: 123 }] }).includes('steps[0].calls must be an array'));
  assert.ok(validateTour({ ...base, steps: [{ ...base.steps[0], returnsTo: 123 }] }).includes('steps[0].returnsTo must be a string'));
});

test('accepts a story intent block with goal, design, and sources', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    intent: {
      goal: 'We wanted keepers to settle funding without one market draining balances.',
      design: 'settleFunding() clamps through one shared helper.',
      sources: ['commit 41af8b7', 'PR #12 body'],
    },
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  });
  assert.deepEqual(errs, []);
});

test('a story without an intent block stays valid', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  });
  assert.deepEqual(errs, []);
});

test('intent.goal is required when intent is present', () => {
  const base = {
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  };
  assert.ok(validateTour({ ...base, intent: {} }).includes('intent.goal is required'));
  assert.ok(validateTour({ ...base, intent: { goal: '   ' } }).includes('intent.goal is required'));
  assert.ok(validateTour({ ...base, intent: 'why' }).includes('intent must be an object'));
});

test('intent.design and intent.sources are type-checked when present', () => {
  const base = {
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  };
  assert.ok(validateTour({ ...base, intent: { goal: 'g', design: 7 } }).includes('intent.design must be a string'));
  assert.ok(validateTour({ ...base, intent: { goal: 'g', sources: [] } }).includes('intent.sources must be a non-empty array'));
  assert.ok(validateTour({ ...base, intent: { goal: 'g', sources: 'commit' } }).includes('intent.sources must be a non-empty array'));
  assert.ok(validateTour({ ...base, intent: { goal: 'g', sources: ['ok', ''] } }).includes('intent.sources[1] must be a non-empty string'));
});
