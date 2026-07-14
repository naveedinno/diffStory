// Unit tests for the mutable review session. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession,
  openSession,
  closeSession,
  sessionEntryScreen,
  issueReviewPageLease,
  getReviewPageLease,
} from '../dist/session.js';

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

test('repo entry starts at scope selection instead of review history', () => {
  const s = createSession({ repo: '/r' });
  assert.equal(sessionEntryScreen(s), 'change');

  openSession(s, '/another');
  assert.equal(sessionEntryScreen(s), 'change');
});

test('repo entry resumes only an explicitly selected review', () => {
  const s = createSession({ repo: '/r' });
  s.chooseStory = false;
  s.selectedStory = '/r/.diffstory/stories/security.json';
  assert.equal(sessionEntryScreen(s), 'review');

  s.selectedStory = null;
  assert.equal(sessionEntryScreen(s), 'change');
});

test('review page leases are opaque, single-window, and cleared across repositories', () => {
  const s = createSession({ repo: '/r' });
  const input = {
    repo: '/r', base: 'HEAD', fingerprint: 'fingerprint', scopeKey: 'scope',
    mode: 'since', from: 'snapshot-1', fromSnapshotDigest: 'snapshot-digest', storyIdentity: 'storyless',
  };
  const first = issueReviewPageLease(s, input);
  assert.ok(first.token.length >= 20);
  assert.equal(getReviewPageLease(s, first.token), first);
  assert.equal(getReviewPageLease(s, first.token)?.fromSnapshotDigest, 'snapshot-digest');
  assert.equal(getReviewPageLease(s, 'caller-controlled-token'), undefined);

  const second = issueReviewPageLease(s, { ...input, mode: 'full', from: undefined });
  assert.notEqual(second.token, first.token);
  assert.equal(getReviewPageLease(s, first.token), undefined, 'new navigation supersedes the old page lease');
  assert.equal(getReviewPageLease(s, second.token)?.mode, 'full');

  openSession(s, '/another');
  assert.equal(getReviewPageLease(s, second.token), undefined);
});
