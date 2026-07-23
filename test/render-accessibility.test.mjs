import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commentHtml, renderPage } from '../dist/render.js';

const tour = {
  version: 1,
  title: 'Accessible review',
  summary: 'One changed line.',
  steps: [{
    id: 's1',
    order: 1,
    title: 'Changed line',
    file: 'a.ts',
    range: [1, 1],
    kind: 'changed',
    why: 'I changed this line so the next helper receives the value it needs.',
  }],
};

const files = [{
  oldPath: 'a.ts',
  newPath: 'a.ts',
  status: 'modified',
  hunks: [{
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: [{ type: 'add', content: 'next', newNo: 1 }],
  }],
}];

test('notes filters expose their initial pressed state', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });

  assert.match(html, /class="ds-feedback-filters"[^>]*role="group" aria-label="Filter notes"/);
  assert.match(html, /data-feedback-filter="all" aria-pressed="true">All<\/button>/);
  for (const filter of ['blocking', 'addressed', 'open', 'changed', 'resolved']) {
    assert.match(html, new RegExp(`data-feedback-filter="${filter}" aria-pressed="false"`));
  }
});

test('server-rendered textareas keep accessible names beyond their placeholders', () => {
  const storyless = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [], storyless: true });
  assert.match(storyless, /id="storyReviewerNote"[^>]*aria-labelledby="storyReviewerNoteLabel"[^>]*aria-describedby="storyReviewerNoteHelp"/);
  assert.match(storyless, /id="storyReviewerNoteLabel">What should this change accomplish\?<\/span>/);

  const thread = commentHtml({
    id: 'c1',
    file: 'src/a.ts',
    line: 7,
    type: 'question',
    body: 'Why?',
    status: 'open',
    createdAt: '2026-01-01T00:00:00Z',
  });
  assert.match(thread, /data-thread-ta aria-label="Reply to diffStory about src\/a\.ts, line 7"/);
});

test('command dialog has a persistent name, description, and close name', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });

  assert.match(html, /class="ds-command" role="dialog" aria-modal="true" aria-labelledby="ds-command-title" aria-describedby="ds-command-description" tabindex="-1"/);
  assert.match(html, /id="ds-command-title">Commands<\/strong>/);
  assert.match(html, /id="ds-command-description">Keyboard-first review without hidden magic\.<\/span>/);
  assert.match(html, /<div class="ds-command-scrim" data-shortcuts-close aria-hidden="true"><\/div>/);
  assert.doesNotMatch(html, /<button class="ds-command-scrim"/, 'keeps the invisible scrim out of the modal tab loop');
  assert.match(html, /data-shortcuts-close type="button" aria-label="Close commands">×<\/button>/);
  assert.match(html, /class="ds-command-list" role="group" aria-label="Review commands"/);
});
