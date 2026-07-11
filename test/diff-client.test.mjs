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

test('seen-file tracking is visible, accessible, and wired through existing storage and the v key', () => {
  assert.match(DIFF_JS, /function toggleViewed\(/);
  assert.match(DIFF_JS, /function syncViewed\(/);
  assert.match(DIFF_JS, /'ds-viewed:'/);
  assert.match(PAGE_JS, /data-viewed-toggle/);
  assert.match(DIFF_JS, /setAttribute\('aria-pressed',on\?'true':'false'\)/);
  assert.match(DIFF_JS, /on\?' unseen':' seen'/);
  assert.match(DIFF_JS, /on\?'Seen':'Mark seen'/);
  assert.match(DIFF_JS, /n\+' of '\+total\+' seen'/);
  assert.match(PAGE_JS, /activeFileFilter==='seen'/);
  assert.match(PAGE_JS, /activeFileFilter==='unseen'/);
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

test('compact file toolbars wrap identity and review controls onto separate rows', () => {
  assert.match(DIFF_CSS, /@media \(max-width:720px\)[\s\S]*\.ds-filepanel-head\{flex-wrap:wrap/);
  assert.match(DIFF_CSS, /\.ds-filepanel-head::after\{content:'';order:6;flex-basis:100%/);
  assert.match(DIFF_CSS, /\.ds-filepanel-head>\.ds-modetoggle\{order:9;margin-left:auto\}/);
});
