// Review-comment rendering contract. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPage, renderFullFile } from '../dist/render.js';

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

function render(comments = []) {
  return renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments });
}

test('full-file and diff rows expose exact side-aware selectable text', () => {
  const full = renderFullFile([
    { type: 'ctx', oldNo: 1, newNo: 1, content: 'line one' },
    { type: 'add', newNo: 2, content: 'line two' },
  ], { file: 'a.ts', newFile: false });
  assert.match(full, /data-comment-side="left" data-comment-file="a\.ts" data-comment-line="1"/);
  assert.match(full, /data-comment-side="right" data-comment-file="a\.ts" data-comment-line="2"/);

  const page = render();
  assert.match(page, /ds-urow ds-row-del[^>]*data-file="a\.ts" data-line="1"/);
  assert.match(page, /data-comment-side="left" data-comment-file="a\.ts" data-comment-line="1"/);
  assert.match(page, /data-comment-side="right" data-comment-file="a\.ts" data-comment-line="1"/);
  assert.doesNotMatch(page, /ds-addcomment/);
});

test('Review → Comments renders only queued comments with their exact anchor text', () => {
  const comments = [
    { id: 'queued', file: 'a.ts', line: 1, type: 'question', selectedText: 'new1', body: 'Why this branch?', status: 'open', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'legacy-addressed', file: 'a.ts', line: 2, type: 'change', body: 'old reply', status: 'addressed', createdAt: '2026-01-01T00:00:00Z', reply: 'legacy' },
    { id: 'legacy-resolved', file: 'a.ts', line: 2, type: 'nit', body: 'done', status: 'resolved', createdAt: '2026-01-01T00:00:00Z' },
  ];
  const html = render(comments);
  assert.match(html, /Review comments/);
  assert.match(html, />1 queued</);
  assert.match(html, /Why this branch\?/);
  assert.match(html, /new1/);
  assert.doesNotMatch(html, /old reply|legacy-addressed|legacy-resolved/);
});

test('queued cards support jump, edit, and remove without chat or AI actions', () => {
  const html = render([{ id: 'c1', file: 'a.ts', line: 1, type: 'change', body: 'Fix this', status: 'open', createdAt: '2026-01-01T00:00:00Z' }]);
  assert.match(html, /data-goto-comment="c1"/);
  assert.match(html, /data-edit-comment="c1"/);
  assert.match(html, /data-remove-comment="c1"/);
  assert.match(html, /data-comment-editor/);
  assert.match(html, /data-edit-flavor="change" aria-pressed="true"/);
  assert.match(html, /data-edit-body/);
  assert.doesNotMatch(html, /Send to AI|Ask agent|Review conversation|data-thread-ta|data-send-comment|data-agent-target/);
});

test('the queue has one primary Copy all action and no delivery controls', () => {
  const html = render([{ id: 'c1', file: 'a.ts', line: 1, type: 'nit', body: 'Note', status: 'open', createdAt: '2026-01-01T00:00:00Z' }]);
  assert.match(html, /class="ds-btn ds-btn-solid" data-copy-comments="queued"[^>]*>Copy all</);
  assert.doesNotMatch(html, /data-address-all|Send queued|Copy queued|Copy full review/);
});

test('selection context menu has one comment action; type is chosen in the composer', () => {
  const html = render();
  assert.match(html, /data-selection-comment>Comment selected code</);
  assert.doesNotMatch(html, /data-selection-action=/);
});

test('queued comments are grouped by file and the empty state teaches the C shortcut', () => {
  const grouped = render([
    { id: 'c1', file: 'a.ts', line: 2, type: 'nit', body: 'Second', status: 'open', createdAt: '2026-01-01T00:00:01Z' },
    { id: 'c2', file: 'a.ts', line: 1, type: 'question', body: 'First', status: 'open', createdAt: '2026-01-01T00:00:00Z' },
  ]);
  assert.equal((grouped.match(/data-feedback-group="a\.ts"/g) ?? []).length, 1);
  assert.ok(grouped.indexOf('First') < grouped.indexOf('Second'));
  assert.match(render(), /No queued comments\. Select code in the diff and press C\./);
});
