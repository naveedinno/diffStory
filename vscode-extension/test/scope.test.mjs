import assert from 'node:assert/strict';
import test from 'node:test';

const { isReviewScope, scopeLabel } = await import('../dist/scope.js');

test('scope labels distinguish a working tree from a pinned comparison', () => {
  assert.equal(scopeLabel('HEAD'), 'HEAD → working tree');
  assert.equal(scopeLabel('a'.repeat(40), 'b'.repeat(40)), 'aaaaaaaa → bbbbbbbb');
});

test('scope persistence accepts only the serializable review shape', () => {
  assert.equal(isReviewScope({ base: 'main', label: 'main → working tree' }), true);
  assert.equal(isReviewScope({ base: 1, label: 'bad' }), false);
});
