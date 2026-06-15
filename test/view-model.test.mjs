// Unit tests for the full-file side-by-side reconstruction. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiff } from '../dist/diff.js';
import { buildFullFileRows } from '../dist/view-model.js';

const DIFF = [
  'diff --git a/a.ts b/a.ts',
  '--- a/a.ts',
  '+++ b/a.ts',
  '@@ -1,2 +1,3 @@',
  ' line1',
  '+added2',
  ' line3',
].join('\n');

test('reconstructs the whole file: context both sides, add on the right', () => {
  const [file] = parseUnifiedDiff(DIFF);
  const rows = buildFullFileRows(file, ['line1', 'added2', 'line3'], []);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].type, 'ctx');
  assert.equal(rows[0].oldNo, 1);
  assert.equal(rows[0].newNo, 1);
  assert.equal(rows[1].type, 'add');
  assert.equal(rows[1].newNo, 2);
  assert.equal(rows[1].oldNo, undefined);
  assert.equal(rows[2].type, 'ctx');
  assert.equal(rows[2].newNo, 3);
});

test('flags untoured added lines by range', () => {
  const [file] = parseUnifiedDiff(DIFF);
  const rows = buildFullFileRows(file, ['line1', 'added2', 'line3'], [[2, 2]]);
  const add = rows.find((r) => r.type === 'add');
  assert.equal(add.untoured, true);
});

test('a context-only file (no diff) renders entirely as unchanged', () => {
  const rows = buildFullFileRows(undefined, ['a', 'b', 'c'], []);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.type === 'ctx'));
  assert.equal(rows[2].oldNo, 3);
  assert.equal(rows[2].newNo, 3);
});
