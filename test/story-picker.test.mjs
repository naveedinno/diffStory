import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderStoryPicker } from '../dist/story-picker.js';

test('compact session cards preserve trust and review facts on mobile', () => {
  const html = renderStoryPicker({
    repoName: 'demo',
    routeBase: '/repo/demo',
    now: Date.now(),
    stories: [{
      id: 'story.json',
      title: 'Review the change',
      summary: 'Follow the change from intent to implementation.',
      valid: true,
      files: 4,
      liveFiles: 5,
      additions: 20,
      deletions: 3,
      steps: 8,
      primers: 1,
      mode: 'guided',
      scope: { label: 'Working tree vs HEAD', command: 'git diff HEAD --', description: '' },
      freshness: 'current',
      current: true,
      openComments: 2,
      addressedComments: 0,
      reviewRound: 3,
      changedSinceReview: 5,
      updatedAt: Date.now(),
    }],
  });

  assert.match(html, /<b>7<\/b> code stops \+ 1 primer/);
  assert.match(html, /<b>Round 3<\/b>/);
  assert.match(html, /<b>2<\/b> open feedback/);
  assert.match(html, />5 files changed since feedback</);
  assert.doesNotMatch(html, /session-facts>span:nth-child/);
  assert.match(html, /\.row-del::after\{content:"";position:absolute;inset:-5px\}/);
  assert.equal((html.match(/>Start review</g) || []).length, 1, 'offers one clear new-review action');
  assert.match(html, /Review history/);
  assert.match(html, /<b>1<\/b> review needs feedback/, 'makes clear this is a review count, not a thread count');
  assert.doesNotMatch(html, /class="review-path"|Every session keeps the scope/, 'does not repeat the review tutorial');
});

test('empty history keeps review creation available without making history the entry tutorial', () => {
  const html = renderStoryPicker({ repoName: 'demo', routeBase: '/repo/demo', now: Date.now(), stories: [] });

  assert.match(html, /No saved reviews/);
  assert.equal((html.match(/>Start review</g) || []).length, 1);
  assert.match(html, /href="\/repo\/demo\/change"/);
  assert.doesNotMatch(html, /Scope.*Read.*Resolve.*Decide/s);
});
