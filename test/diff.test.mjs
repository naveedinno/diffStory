// Unit tests for the unified-diff parser. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiff, changedRanges, rangesOverlap } from '../dist/diff.js';

const SAMPLE = [
  'diff --git a/src/api.ts b/src/api.ts',
  'index 1111111..2222222 100644',
  '--- a/src/api.ts',
  '+++ b/src/api.ts',
  '@@ -1,3 +1,4 @@',
  ' import { placeOrder } from "./orders";',
  "+import { checkSpendingLimit } from './limits';",
  ' export function createOrder() {',
  ' }',
  'diff --git a/src/limits.ts b/src/limits.ts',
  'new file mode 100644',
  '--- /dev/null',
  '+++ b/src/limits.ts',
  '@@ -0,0 +1,2 @@',
  '+export function checkSpendingLimit() {}',
  '+// done',
].join('\n');

test('parses each file with its status', () => {
  const files = parseUnifiedDiff(SAMPLE);
  assert.equal(files.length, 2);
  assert.equal(files[0].newPath, 'src/api.ts');
  assert.equal(files[0].status, 'modified');
  assert.equal(files[1].newPath, 'src/limits.ts');
  assert.equal(files[1].status, 'added');
});

test('classifies line types and assigns post-change line numbers', () => {
  const [api] = parseUnifiedDiff(SAMPLE);
  const added = api.hunks[0].lines.filter((l) => l.type === 'add');
  assert.equal(added.length, 1);
  assert.equal(added[0].newNo, 2);
  assert.equal(added[0].content, "import { checkSpendingLimit } from './limits';");
  // context lines carry both old and new numbers
  const ctx = api.hunks[0].lines.find((l) => l.type === 'ctx');
  assert.equal(ctx.oldNo, 1);
  assert.equal(ctx.newNo, 1);
});

test('changedRanges captures the added region', () => {
  const [api] = parseUnifiedDiff(SAMPLE);
  assert.ok(changedRanges(api).some((r) => r[0] <= 2 && r[1] >= 2));
});

test('rangesOverlap is inclusive', () => {
  assert.equal(rangesOverlap([1, 5], [3, 8]), true);
  assert.equal(rangesOverlap([1, 2], [2, 4]), true);
  assert.equal(rangesOverlap([1, 2], [3, 4]), false);
});
