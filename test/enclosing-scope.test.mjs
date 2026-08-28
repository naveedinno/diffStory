// The indentation-based enclosing-scope heuristic. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enclosingScopeLabel } from '../dist/enclosing-scope.js';

const SOL = [
  '// SPDX-License-Identifier: MIT',            // 1
  'contract PartyBFacet {',                     // 2
  '    uint256 nonce;',                         // 3
  '',                                           // 4
  '    function fillCloseRequest(',             // 5
  '        uint256 quoteId',                    // 6
  '    ) private returns (uint256 filled) {',   // 7
  '        uint256 a;',                         // 8
  '        if (a > 0) {',                       // 9
  '            a = 1;',                         // 10
  '        }',                                  // 11
  '        return a;',                          // 12
  '    }',                                      // 13
  '}',                                          // 14
];

test('finds the innermost lower-indent opener above the hunk', () => {
  assert.equal(enclosingScopeLabel(SOL, 10), 'if (a > 0)');
  assert.equal(enclosingScopeLabel(SOL, 12), 'function fillCloseRequest(');
  assert.equal(enclosingScopeLabel(SOL, 3), 'contract PartyBFacet');
});

test('skips closers, blanks, and comment lines while scanning', () => {
  const lines = ['function f() {', '    x;', '    }', '    // note', '    y;'];
  assert.equal(enclosingScopeLabel(lines, 5), 'function f()');
});

test('top-level code has no enclosing scope', () => {
  assert.equal(enclosingScopeLabel(['const a = 1;', 'const b = 2;'], 2), undefined);
});

test('long labels are truncated with an ellipsis', () => {
  const lines = ['function ' + 'x'.repeat(120) + '() {', '    y;'];
  const label = enclosingScopeLabel(lines, 2);
  assert.ok(label.length <= 90);
  assert.ok(label.endsWith('…'));
});

test('a hunk start past the end of the file resolves without throwing', () => {
  assert.equal(enclosingScopeLabel(SOL, 999), undefined);
});
