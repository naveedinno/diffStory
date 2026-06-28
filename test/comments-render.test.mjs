// Comments rendering across views. Run with: npm test
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

test('renderFullFile makes every current-file line commentable', () => {
  const rows = [
    { type: 'ctx', oldNo: 1, newNo: 1, content: 'line one' },
    { type: 'add', newNo: 2, content: 'line two' },
  ];
  const html = renderFullFile(rows, { file: 'a.ts', newFile: false });
  assert.match(html, /data-file="a\.ts" data-line="1"/);
  assert.match(html, /data-file="a\.ts" data-line="2"/);
  assert.match(html, /ds-addcomment/);
});

test('all-files diff rows are commentable on the new side, not on deletions', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /ds-urow ds-row-add[^>]*data-file="a\.ts" data-line="1"/);
  assert.match(html, /data-line="2"/);
  // A pure deletion row must not be commentable (no anchor attribute) in any view.
  assert.doesNotMatch(html, /ds-row-del[^>]*data-file=/);
});

test('a comment renders by (file,line) with no step (cross-surfaced into Story)', () => {
  const comments = [{ id: 'c1', file: 'a.ts', line: 1, type: 'change',
                      body: 'NEEDS_FIX_HERE', status: 'open', createdAt: '2026-01-01T00:00:00Z' }];
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments });
  assert.match(html, /NEEDS_FIX_HERE/);
});
