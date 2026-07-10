// Comments rendering across views. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commentHtml, renderPage, renderFullFile } from '../dist/render.js';

const tour = {
  version: 1, title: 't', summary: 's',
  steps: [{ id: 's1', order: 1, title: 'c', file: 'a.ts', range: [1, 2], kind: 'changed',
            why: 'I changed this so the next helper receives the value it needs.' }],
};
const files = [{
  oldPath: 'a.ts', newPath: 'a.ts', status: 'modified',
  hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: [
    { type: 'del', content: 'old', oldNo: 1 },
    { type: 'add', content: 'new1', newNo: 1 },
    { type: 'add', content: 'new2', newNo: 2 },
  ] }],
}];

test('renderFullFile marks every current-file line selectable for comments', () => {
  const rows = [
    { type: 'ctx', oldNo: 1, newNo: 1, content: 'line one' },
    { type: 'add', newNo: 2, content: 'line two' },
  ];
  const html = renderFullFile(rows, { file: 'a.ts', newFile: false });
  assert.match(html, /data-file="a\.ts" data-line="1"/);
  assert.match(html, /data-file="a\.ts" data-line="2"/);
  assert.match(html, /data-comment-code="1"/);
  assert.match(html, /data-comment-side="left" data-comment-file="a\.ts" data-comment-line="1"/);
  assert.match(html, /data-comment-side="right" data-comment-file="a\.ts" data-comment-line="1"/);
  assert.doesNotMatch(html, /ds-addcomment/);
});

test('all-files diff rows expose side-aware selectable comment text', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /ds-urow ds-row-add[^>]*data-file="a\.ts" data-line="1"/);
  assert.match(html, /data-line="2"/);
  assert.match(html, /data-comment-code="1"/);
  assert.doesNotMatch(html, /ds-addcomment/);
  assert.match(html, /ds-urow ds-row-del[^>]*data-file="a\.ts" data-line="1"/);
  assert.match(html, /data-comment-side="left" data-comment-file="a\.ts" data-comment-line="1"/);
  assert.match(html, /data-comment-side="right" data-comment-file="a\.ts" data-comment-line="1"/);
});

test('a selected-text comment renders by (file,line) with no step and shows its snippet', () => {
  const comments = [{ id: 'c1', file: 'a.ts', line: 1, type: 'change',
                      selectedText: 'new1',
                      selection: { startLine: 1, endLine: 1, startColumn: 1, endColumn: 4 },
                      body: 'NEEDS_FIX_HERE', status: 'open', createdAt: '2026-01-01T00:00:00Z' }];
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments });
  assert.match(html, /NEEDS_FIX_HERE/);
  assert.match(html, /ds-comment-selection/);
  assert.match(html, /new1/);
});

test('a left-side selected-text comment renders beside the old panel line', () => {
  const comments = [{ id: 'c1', file: 'a.ts', line: 1, side: 'left', type: 'question',
                      selectedText: 'old',
                      selection: { startLine: 1, endLine: 1 },
                      body: 'OLD_SIDE_QUESTION', status: 'open', createdAt: '2026-01-01T00:00:00Z' }];
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments });
  assert.match(html, /OLD_SIDE_QUESTION/);
  assert.match(html, /Selected/);
  assert.match(html, /old/);
});

test('a multi-turn comment renders body then turns in order', () => {
  const html = commentHtml({
    id: 'c3', file: 'a.ts', line: 1, type: 'question',
    body: 'why this branch?', status: 'addressed', createdAt: '2026-01-01T00:00:00Z',
    turns: [
      { role: 'ai', text: 'It guards the retry path.', at: '2026-01-01T00:01:00Z' },
      { role: 'user', text: 'what about the first attempt?', at: '2026-01-01T00:02:00Z' },
      { role: 'ai', text: 'First attempt skips it.', at: '2026-01-01T00:03:00Z' },
    ],
  });
  const iBody = html.indexOf('why this branch?');
  const iAi1 = html.indexOf('It guards the retry path.');
  const iUser = html.indexOf('what about the first attempt?');
  const iAi2 = html.indexOf('First attempt skips it.');
  assert.ok(iBody >= 0 && iAi1 > iBody && iUser > iAi1 && iAi2 > iUser, 'turns render in order after body');
  assert.match(html, /ds-turn-user/);
  assert.match(html, /data-hasreply="1"/);
  assert.doesNotMatch(html, /data-send/);
  // The in-thread chat composer must be present server-side so existing threads
  // (loaded at page-load time) have a reply box after reload.
  assert.match(html, /ds-thread-composer/);
  assert.match(html, /data-thread-send/);
  assert.match(html, /data-thread-ta/);
});

test('agent replies render Markdown as safe chat content', () => {
  const html = commentHtml({
    id: 'c2',
    file: 'a.ts',
    line: 1,
    type: 'question',
    body: 'Can this use `fills[i]`?',
    status: 'addressed',
    createdAt: '2026-01-01T00:00:00Z',
    reply: 'Use `fills[i]` for **mixed batches**.\n\n- Wallet-only batches can skip fills.\n- Non-wallet ops still need data.\n\n<script>alert(1)</script>',
  });

  assert.match(html, /class="ds-reply-body ds-md"/);
  assert.match(html, /<code>fills\[i\]<\/code>/);
  assert.match(html, /<strong>mixed batches<\/strong>/);
  assert.match(html, /<ul><li>Wallet-only batches can skip fills\.<\/li><li>Non-wallet ops still need data\.<\/li><\/ul>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('server-rendered thread composer has Add and Ask now buttons', () => {
  const html = commentHtml({
    id: 'c9', file: 'a.ts', line: 1, type: 'question',
    body: 'q?', status: 'open', createdAt: '2026-01-01T00:00:00Z',
  });
  assert.match(html, /data-thread-add/);
  assert.match(html, /data-thread-send/);
  assert.match(html, />Ask now</);
});

test('review header folds open comments into the compact Review menu', () => {
  const comments = [{ id: 'c1', file: 'a.ts', line: 1, type: 'change',
    body: 'x', status: 'open', createdAt: '2026-01-01T00:00:00Z' }];
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments });
  assert.match(html, /ds-review-menu-count/);
  assert.match(html, /<b>1<\/b>/);
  assert.match(html, />Send open comments</);
  assert.doesNotMatch(html, /data-send-all/);
});
