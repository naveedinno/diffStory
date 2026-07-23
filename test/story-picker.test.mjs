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
      updatedAt: Date.now(),
    }],
  });

  assert.match(html, /<b>7<\/b> code stops \+ 1 primer/);
  assert.doesNotMatch(html, /Round /);
  assert.match(html, /<b>2<\/b> open notes/);
  assert.doesNotMatch(html, /session-facts>span:nth-child/);
  assert.match(html, /\.row-del::after\{content:"";position:absolute;inset:-5px\}/);
  assert.equal((html.match(/>Start review</g) || []).length, 1, 'offers one clear new-review action');
  assert.match(html, /Review history/);
  assert.match(html, /<b>1<\/b> review has open notes/, 'makes clear this is a review count, not a note count');
  assert.match(html, /class="row-num" aria-hidden="true">01<\/span>/, 'uses the shared ledger numbering on saved reviews');
  assert.match(html, /class="page-title-row"><h1>Review history<\/h1><a class="start-review"/, 'groups the primary action with the page title');
  assert.doesNotMatch(html, /ds-thread-layer|ds-atmosphere-thread/, 'keeps decorative thread animation out of the history header');
  assert.doesNotMatch(html, /class="review-path"|Every session keeps the scope/, 'does not repeat the review tutorial');
});

test('empty history keeps review creation available without making history the entry tutorial', () => {
  const html = renderStoryPicker({ repoName: 'demo', routeBase: '/repo/demo', now: Date.now(), stories: [] });

  assert.match(html, /No saved reviews/);
  assert.equal((html.match(/>Start review</g) || []).length, 1);
  assert.match(html, /href="\/repo\/demo\/change"/);
  assert.doesNotMatch(html, /Scope.*Read.*Resolve.*Decide/s);
});

test('review history uses the shared spatial tier and keeps reduced motion static', () => {
  const html = renderStoryPicker({ repoName: 'demo', routeBase: '/repo/demo', now: Date.now(), stories: [] });
  assert.match(html, /--motion-duration-spatial:340ms/);
  assert.match(html, /\.wrap\{animation:history-page-in var\(--motion-duration-spatial\)/);
  assert.match(html, /prefers-reduced-motion:reduce\)\{\.row-main,\.row-del,\.start-review,\.resume svg\{transition:none\}/);
});
