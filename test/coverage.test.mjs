// Unit tests for the trust check (coverage + stale pointers). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiff } from '../dist/diff.js';
import { computeCoverage, stalePointers } from '../dist/coverage.js';

const DIFF = [
  'diff --git a/a.ts b/a.ts',
  '--- a/a.ts',
  '+++ b/a.ts',
  '@@ -1,2 +1,3 @@',
  ' line1',
  '+added2',
  ' line3',
].join('\n');

const files = parseUnifiedDiff(DIFF);
const tour = (steps) => ({ version: 1, title: 't', summary: '', steps });

test('flags an uncovered change when no step claims it', () => {
  const cov = computeCoverage(tour([]), files);
  assert.ok(cov.uncovered.length >= 1);
  assert.equal(cov.coveredChangedFiles, 0);
});

test('reports covered when a step claims the changed range', () => {
  const cov = computeCoverage(
    tour([{ id: 's1', order: 1, title: 'x', file: 'a.ts', range: [1, 3], kind: 'changed', why: '' }]),
    files,
  );
  assert.equal(cov.uncovered.length, 0);
  assert.equal(cov.coveredChangedFiles, 1);
});

test('context steps do not count as claiming a change', () => {
  const cov = computeCoverage(
    tour([{ id: 's1', order: 1, title: 'x', file: 'a.ts', range: [1, 3], kind: 'context', why: '' }]),
    files,
  );
  assert.ok(cov.uncovered.length >= 1);
});

test('stalePointers flags a step pointing at unchanged code', () => {
  const stale = stalePointers(
    tour([{ id: 's1', order: 1, title: 'x', file: 'a.ts', range: [50, 60], kind: 'changed', why: '' }]),
    files,
  );
  assert.equal(stale.length, 1);
});
