// Unit tests for the mutable review session. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, openSession, closeSession } from '../dist/session.js';

test('createSession carries the initial repo/base/head', () => {
  const s = createSession({ repo: '/r', base: 'main', head: 'feat' });
  assert.equal(s.repo, '/r');
  assert.equal(s.base, 'main');
  assert.equal(s.head, 'feat');
  assert.equal(s.chooseStory, true);
});

test('openSession sets the repo and resets base/head', () => {
  const s = createSession({ repo: null, base: 'x', head: 'y' });
  openSession(s, '/new');
  assert.equal(s.repo, '/new');
  assert.equal(s.base, undefined);
  assert.equal(s.head, undefined);
  assert.equal(s.chooseStory, true);
});

test('closeSession clears everything', () => {
  const s = createSession({ repo: '/r', base: 'main' });
  closeSession(s);
  assert.equal(s.repo, null);
  assert.equal(s.base, undefined);
  assert.equal(s.chooseStory, true);
});
