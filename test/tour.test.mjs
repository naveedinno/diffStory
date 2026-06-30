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
    mode: 'detailed',
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
