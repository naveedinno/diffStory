import assert from 'node:assert/strict';
import test from 'node:test';

const { computeStoryClaimCoverage } = await import('../dist/coverage.js');

function story(steps) {
  return { version: 2, title: 'Coverage', summary: 'Coverage fixture', steps };
}

const modifiedDiff = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,5 @@
 keep
+first
+second
 middle
-old
+third
`;

test('adjacent story claims can account for one changed range', () => {
  const coverage = computeStoryClaimCoverage(story([
    { id: 'a', order: 1, title: 'First', kind: 'changed', file: 'src/a.ts', range: [2, 2], why: 'First line' },
    { id: 'b', order: 2, title: 'Rest', kind: 'changed', file: 'src/a.ts', range: [3, 3], why: 'Second line' },
    { id: 'c', order: 3, title: 'Replacement', kind: 'new-file', file: 'src/a.ts', range: [5, 5], why: 'Replacement line' },
  ]), modifiedDiff);

  assert.deepEqual(coverage.unclaimed, []);
  assert.equal(coverage.fullyClaimedChangedFiles, 1);
  assert.equal(coverage.totalChangedRanges, 2);
});

test('partial, context, and concept steps do not overstate guide completeness', () => {
  const coverage = computeStoryClaimCoverage(story([
    { id: 'a', order: 1, title: 'First', kind: 'changed', file: 'src/a.ts', range: [2, 2], why: 'Only one line' },
    { id: 'context', order: 2, title: 'Nearby code', kind: 'context', file: 'src/a.ts', range: [3, 5], why: 'Orientation only' },
    { id: 'concept', order: 3, title: 'Primer', kind: 'concept', body: 'Background', preparesFor: ['a'] },
  ]), modifiedDiff);

  assert.deepEqual(coverage.unclaimed, [
    { file: 'src/a.ts', range: [3, 3], status: 'modified' },
    { file: 'src/a.ts', range: [5, 5], status: 'modified' },
  ]);
  assert.equal(coverage.fullyClaimedChangedFiles, 0);
});

test('a deleted file is represented by its zero-line deletion anchor', () => {
  const diff = `diff --git a/old.ts b/old.ts
deleted file mode 100644
--- a/old.ts
+++ /dev/null
@@ -1,1 +0,0 @@
-gone
`;
  const coverage = computeStoryClaimCoverage(story([
    { id: 'delete', order: 1, title: 'Remove old code', kind: 'changed', file: 'old.ts', range: [0, 0], why: 'No longer needed' },
  ]), diff);

  assert.deepEqual(coverage.unclaimed, []);
  assert.equal(coverage.totalChangedRanges, 1);
});
