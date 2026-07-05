// The diff-surface client assets stay composed into the one page IIFE. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFF_CSS, DIFF_JS } from '../dist/diff-assets.js';
import { PAGE_CSS, PAGE_JS } from '../dist/page-assets.js';

test('diff-assets exports the diff client functions', () => {
  assert.match(DIFF_JS, /function setMode\(/);
  assert.match(DIFF_JS, /function loadFull\(/);
  assert.match(DIFF_JS, /function updateChangeNav\(/);
  assert.match(DIFF_JS, /function handleChangeShortcut\(/);
});

test('diff assets are composed back into the page assets', () => {
  assert.ok(PAGE_JS.includes(DIFF_JS), 'DIFF_JS is spliced into PAGE_JS');
  assert.ok(PAGE_CSS.includes(DIFF_CSS), 'DIFF_CSS is appended to PAGE_CSS');
  assert.match(PAGE_JS, /^\s*\(function\(\)\{/, 'still one IIFE');
});

test('diff CSS moved out of page-assets core', () => {
  assert.match(DIFF_CSS, /\.ds-row\b/);
  assert.match(DIFF_CSS, /\.ds-hunkgap\b/);
  assert.match(DIFF_CSS, /\.ds-hunkgap-split\b/);
  assert.match(DIFF_CSS, /\.ds-modetoggle\b/);
});

test('viewed-file tracking is wired: storage, toggle, v key', () => {
  assert.match(DIFF_JS, /function toggleViewed\(/);
  assert.match(DIFF_JS, /function syncViewed\(/);
  assert.match(DIFF_JS, /'ds-viewed:'/);
  assert.match(PAGE_JS, /data-viewed-toggle/);
  assert.match(PAGE_JS, /e\.key==='v'\|\|e\.key==='V'/);
});

test('split mode is lazy-loaded and persisted', () => {
  assert.match(DIFF_JS, /function loadSplit\(/);
  assert.match(DIFF_JS, /'ds-files-mode'/);
  assert.match(DIFF_JS, /\/api\/diff\/split\?file=/);
  assert.match(PAGE_JS, /function applyFilesMode\(/);
});

test('expand-context client is wired', () => {
  assert.match(DIFF_JS, /function expandGap\(/);
  assert.match(DIFF_JS, /\/api\/diff\/context\?file=/);
  assert.match(PAGE_JS, /data-expand/);
});

test('review page consumes shared tokens and respects reduced motion', () => {
  assert.match(PAGE_CSS, /--app-bg:/);
  assert.match(DIFF_CSS, /prefers-reduced-motion/);
});
