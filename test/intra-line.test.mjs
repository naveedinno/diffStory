// Unit tests for word-level (intra-line) diffing. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffLineTokens, pairChanges, intraLineMap } from '../dist/intra-line.js';

test('marks only the changed span, from the reported screenshot', () => {
  const oldLine = '        results = instantLayer.executeTemplate(templateId, signedOps, signatures, fills, flexFillerSignatures);';
  const newLine = '        results = _executeInstantTemplate(templateId, signedOps, signatures, fills, flexFillerSignatures);';
  const diff = diffLineTokens(oldLine, newLine);
  assert.ok(diff, 'lines are similar enough to word-diff');

  // The new call name is marked on the right.
  assert.match(diff.right, /class="tk-f changed"[^>]*>_executeInstantTemplate</);
  // The old receiver + method are marked on the left.
  assert.match(diff.left, /class="changed">instantLayer</);
  assert.match(diff.left, /class="tk-f changed">executeTemplate</);

  // The shared prefix and argument list are NOT marked on either side.
  assert.ok(!diff.right.includes('changed">results'));
  assert.ok(!diff.left.includes('changed">results'));
  assert.ok(!diff.right.includes('changed">templateId'));
  assert.ok(!diff.right.includes('changed">flexFillerSignatures'));
});

test('marks a changed token with common prefix and suffix', () => {
  const diff = diffLineTokens('a = foo(1);', 'a = bar(1);');
  assert.ok(diff);
  assert.match(diff.left, /changed">foo</);
  assert.match(diff.right, /changed"[^>]*>bar</);
  assert.ok(!diff.left.includes('changed">a'));
  assert.ok(!diff.right.includes('changed">1'));
});

test('annotates only the current side with semantic-navigation columns', () => {
  const diff = diffLineTokens('a = oldCall(value);', 'a = newCall(value);');
  assert.ok(diff);
  assert.doesNotMatch(diff.left, /data-vscode-symbol/);
  assert.match(diff.right, /data-vscode-symbol data-vscode-column="1"[^>]*>a<\/span>/);
  assert.match(diff.right, /data-vscode-symbol data-vscode-column="5"[^>]*>newCall<\/span>/);
  assert.match(diff.right, /data-vscode-symbol data-vscode-column="13"[^>]*>value<\/span>/);
});

test('identical lines produce no changed marks', () => {
  const diff = diffLineTokens('return x + 1;', 'return x + 1;');
  assert.ok(diff);
  assert.ok(!diff.left.includes('changed'));
  assert.ok(!diff.right.includes('changed'));
});

test('whitespace-only difference is not marked as changed', () => {
  const diff = diffLineTokens('a = 1;', 'a  =  1;');
  assert.ok(diff);
  assert.ok(!diff.left.includes('changed'));
  assert.ok(!diff.right.includes('changed'));
});

test('too-dissimilar lines return null (caller falls back to whole-line)', () => {
  assert.equal(diffLineTokens('let x = 1;', 'return doSomethingElse(payload, config);'), null);
  assert.equal(diffLineTokens('', 'anything(here);'), null);
});

test('pairChanges pairs removed with added by position', () => {
  const t = (types) => pairChanges(types, (x) => x);
  assert.deepEqual(t(['del', 'add']), [[0, 1]]);
  assert.deepEqual(t(['ctx', 'del', 'add', 'ctx']), [[1, 2]]);
  assert.deepEqual(t(['del', 'del', 'add', 'add']), [[0, 2], [1, 3]]);
  assert.deepEqual(t(['del', 'del', 'del', 'add']), [[0, 3]]); // unequal → min count
  assert.deepEqual(t(['add', 'del']), []); // add before del → no pair
  assert.deepEqual(t(['del']), []);
  assert.deepEqual(t(['add']), []);
});

test('intraLineMap keys left onto removed rows and right onto added rows', () => {
  const rows = [
    { type: 'del', content: 'a = foo(1);' },
    { type: 'add', content: 'a = bar(1);' },
    { type: 'ctx', content: 'return a;' },
  ];
  const map = intraLineMap(rows, (r) => r.type, (r) => r.content);
  assert.ok(map.get(rows[0]).left.includes('changed">foo'));
  assert.equal(map.get(rows[0]).right, undefined);
  assert.match(map.get(rows[1]).right, /changed"[^>]*>bar/);
  assert.equal(map.get(rows[1]).left, undefined);
  assert.equal(map.get(rows[2]), undefined); // context line, no pair
});

test('intraLineMap omits rows whose pair was too dissimilar', () => {
  const rows = [
    { type: 'del', content: 'let x = 1;' },
    { type: 'add', content: 'return doSomethingElse(payload, config);' },
  ];
  const map = intraLineMap(rows, (r) => r.type, (r) => r.content);
  assert.equal(map.size, 0);
});
