// Unit tests for the trust check (coverage + stale pointers). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiff } from '../dist/diff.js';
import { computeCoverage, computeStoryClaimCoverage, stalePointers } from '../dist/coverage.js';

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

test('concept primers neither claim coverage nor become stale diff pointers', () => {
  const concept = {
    id: 'primer',
    order: 1,
    title: 'The request envelope',
    kind: 'concept',
    body: 'The request is normalized before the policy is applied.',
    preparesFor: ['implementation'],
  };
  const code = {
    id: 'implementation',
    order: 2,
    title: 'Apply the policy',
    file: 'a.ts',
    range: [1, 3],
    kind: 'changed',
    why: 'This implements the policy introduced by the primer.',
  };
  const v2 = { version: 2, title: 'Concept-first story', summary: '', steps: [concept, code] };

  assert.equal(computeCoverage(v2, files).uncovered.length, 0);
  assert.deepEqual(stalePointers(v2, files), []);

  const withoutCodeClaim = { ...v2, steps: [concept] };
  assert.ok(computeCoverage(withoutCodeClaim, files).uncovered.length >= 1);
  assert.deepEqual(stalePointers(withoutCodeClaim, files), []);
});

test('a story claim must cover every changed line rather than merely overlap the change', () => {
  const multiLineDiff = [
    'diff --git a/a.ts b/a.ts',
    '--- a/a.ts',
    '+++ b/a.ts',
    '@@ -1,2 +1,5 @@',
    ' line1',
    '+added2',
    '+added3',
    '+added4',
    ' line5',
  ].join('\n');
  const multiLineFiles = parseUnifiedDiff(multiLineDiff);
  const cov = computeStoryClaimCoverage(
    tour([{ id: 's1', order: 1, title: 'x', file: 'a.ts', range: [2, 2], kind: 'changed', why: '' }]),
    multiLineFiles,
  );

  assert.deepEqual(cov.unclaimed, [{ file: 'a.ts', range: [3, 4], status: 'modified' }]);
  assert.equal(cov.fullyClaimedChangedFiles, 0);
});

test('adjacent story claims can jointly account for one changed range', () => {
  const multiLineDiff = [
    'diff --git a/a.ts b/a.ts',
    '--- a/a.ts',
    '+++ b/a.ts',
    '@@ -1,1 +1,4 @@',
    ' line1',
    '+added2',
    '+added3',
    '+added4',
  ].join('\n');
  const cov = computeStoryClaimCoverage(
    tour([
      { id: 's1', order: 1, title: 'one', file: 'a.ts', range: [2, 2], kind: 'changed', why: '' },
      { id: 's2', order: 2, title: 'two', file: 'a.ts', range: [3, 4], kind: 'changed', why: '' },
    ]),
    parseUnifiedDiff(multiLineDiff),
  );

  assert.deepEqual(cov.unclaimed, []);
  assert.equal(cov.fullyClaimedChangedFiles, 1);
  assert.equal(cov.fullyClaimedChangedRanges, 1);
});

test('the whole-file deletion sentinel remains a fully claimed change', () => {
  const deletionDiff = [
    'diff --git a/gone.ts b/gone.ts',
    'deleted file mode 100644',
    '--- a/gone.ts',
    '+++ /dev/null',
    '@@ -1,1 +0,0 @@',
    '-export const gone = true;',
  ].join('\n');
  const cov = computeStoryClaimCoverage(
    tour([{ id: 's1', order: 1, title: 'delete', file: 'gone.ts', range: [0, 0], kind: 'changed', why: '' }]),
    parseUnifiedDiff(deletionDiff),
  );

  assert.deepEqual(cov.unclaimed, []);
  assert.equal(cov.fullyClaimedChangedFiles, 1);
});
