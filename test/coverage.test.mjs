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

test('stale-pointer detection honours every claimed span', async () => {
  const { stalePointers } = await import('../dist/coverage.js');
  const { parseUnifiedDiff } = await import('../dist/diff.js');
  const files = parseUnifiedDiff([
    'diff --git a/x.ts b/x.ts', '--- a/x.ts', '+++ b/x.ts',
    '@@ -40,0 +40,2 @@', '+gamma', '+delta',
  ].join('\n'));
  const step = (extra) => ({
    version: 2, title: 'T', summary: '',
    steps: [{ id: 's1', order: 1, title: 'T', kind: 'changed', file: 'x.ts', why: 'w', ...extra }],
  });
  // Anchor points at unchanged code — stale on its own...
  assert.equal(stalePointers(step({ range: [10, 11] }), files).length, 1);
  // ...and one valid sibling must not hide it.
  assert.equal(stalePointers(step({ range: [10, 11], ranges: [[10, 11], [40, 41]] }), files).length, 1);
  // The inverse is stale too: a valid anchor cannot hide an obsolete remote claim.
  assert.equal(stalePointers(step({ range: [40, 41], ranges: [[40, 41], [90, 90]] }), files).length, 1);
  // Every effective claim touching changed code is fresh.
  assert.equal(stalePointers(step({ range: [40, 40], ranges: [[40, 40], [41, 41]] }), files).length, 0);
});

test('a broad valid coverage claim cannot hide a stale local camera', () => {
  const oneLineFiles = parseUnifiedDiff([
    'diff --git a/x.ts b/x.ts', '--- a/x.ts', '+++ b/x.ts',
    '@@ -10,0 +10,1 @@', '+alpha',
  ].join('\n'));
  const story = {
    ...tour([{
      id: 's1', order: 1, title: 'sweep', kind: 'changed', file: 'x.ts',
      range: [15, 16], ranges: [[10, 20]], why: 'same repeated edit',
    }]),
    mode: 'guided',
  };

  assert.equal(computeStoryClaimCoverage(story, oneLineFiles).unclaimed.length, 0);
  assert.equal(stalePointers(story, oneLineFiles).length, 1);
});

test('a giant bounding-box claim cannot cover distant changed clusters', () => {
  const distantFiles = parseUnifiedDiff([
    'diff --git a/x.ts b/x.ts', '--- a/x.ts', '+++ b/x.ts',
    '@@ -10,0 +10,1 @@', '+alpha',
    '@@ -400,0 +400,1 @@', '+omega',
  ].join('\n'));
  const story = {
    ...tour([{
      id: 's1', order: 1, title: 'giant sweep', kind: 'changed', file: 'x.ts',
      range: [10, 400], why: 'same repeated edit',
    }]),
    mode: 'guided',
  };

  assert.deepEqual(computeStoryClaimCoverage(story, distantFiles).unclaimed, [
    { file: 'x.ts', range: [10, 10], status: 'modified' },
    { file: 'x.ts', range: [400, 400], status: 'modified' },
  ]);
  assert.equal(stalePointers(story, distantFiles).length, 1);

  const remoteBoundingBox = {
    ...story,
    steps: [{ ...story.steps[0], range: [10, 10], ranges: [[10, 400]] }],
  };
  assert.equal(computeStoryClaimCoverage(remoteBoundingBox, distantFiles).unclaimed.length, 2);
  assert.equal(stalePointers(remoteBoundingBox, distantFiles).length, 1);
});

test('an over-cap claim remains valid for one contiguous changed span', () => {
  const contiguousFiles = parseUnifiedDiff([
    'diff --git a/x.ts b/x.ts', '--- a/x.ts', '+++ b/x.ts',
    '@@ -10,0 +10,46 @@',
    ...Array.from({ length: 46 }, (_, index) => `+line ${index + 1}`),
  ].join('\n'));
  const story = {
    ...tour([{
      id: 's1', order: 1, title: 'large hunk', kind: 'changed', file: 'x.ts',
      range: [10, 55], why: 'one contiguous replacement',
    }]),
    mode: 'guided',
  };

  assert.deepEqual(computeStoryClaimCoverage(story, contiguousFiles).unclaimed, []);
  assert.deepEqual(stalePointers(story, contiguousFiles), []);
});

test('legacy focus.ranges points at code but never claims coverage', () => {
  const scatteredDiff = [
    'diff --git a/x.ts b/x.ts', '--- a/x.ts', '+++ b/x.ts',
    '@@ -10,0 +10,2 @@', '+alpha', '+beta',
    '@@ -40,0 +40,2 @@', '+gamma', '+delta',
  ].join('\n');
  const scatteredFiles = parseUnifiedDiff(scatteredDiff);
  const base = {
    id: 's1', order: 1, title: 'sweep', kind: 'changed', file: 'x.ts',
    range: [10, 11], why: 'same repeated edit', focus: { ranges: [[40, 41]] },
  };

  assert.deepEqual(computeStoryClaimCoverage(tour([base]), scatteredFiles).unclaimed, [
    { file: 'x.ts', range: [40, 41], status: 'modified' },
  ]);
  assert.deepEqual(computeStoryClaimCoverage(tour([{
    ...base, ranges: [[10, 11], [40, 41]],
  }]), scatteredFiles).unclaimed, []);
});

test('a partial ranges claim reports the exact missing segment', () => {
  const scatteredDiff = [
    'diff --git a/x.ts b/x.ts', '--- a/x.ts', '+++ b/x.ts',
    '@@ -10,0 +10,2 @@', '+alpha', '+beta',
    '@@ -40,0 +40,2 @@', '+gamma', '+delta',
  ].join('\n');
  const cov = computeStoryClaimCoverage(
    tour([{
      id: 's1', order: 1, title: 'sweep', kind: 'changed', file: 'x.ts',
      range: [10, 11], ranges: [[10, 11], [40, 40]], why: 'same repeated edit',
    }]),
    parseUnifiedDiff(scatteredDiff),
  );

  assert.deepEqual(cov.unclaimed, [{ file: 'x.ts', range: [41, 41], status: 'modified' }]);
});
