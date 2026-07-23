import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNavigationQuery } from '../dist/navigation.js';

test('parses an encoded absolute source location', () => {
  const query = new URLSearchParams({
    path: '/Users/example/Code/review app/src/order flow.ts',
    line: '42',
    column: '17',
  }).toString();
  assert.deepEqual(parseNavigationQuery(query), {
    path: '/Users/example/Code/review app/src/order flow.ts',
    line: 42,
    column: 17,
  });
});

test('rejects relative paths and invalid positions', () => {
  assert.equal(parseNavigationQuery('path=src%2Fa.ts&line=1&column=1'), null);
  assert.equal(parseNavigationQuery('path=%2Ftmp%2Fa.ts&line=0&column=1'), null);
  assert.equal(parseNavigationQuery('path=%2Ftmp%2Fa.ts&line=1&column=1.5'), null);
  assert.equal(parseNavigationQuery('path=%2Ftmp%2Fa.ts&line=1&column=0'), null);
});
