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

test('reviewed-file tracking is hash-bound, accessible, and wired through storage and the v key', () => {
  assert.match(DIFF_JS, /function toggleViewed\(/);
  assert.match(DIFF_JS, /function syncViewed\(/);
  assert.match(DIFF_JS, /function reviewHashForFile\(/);
  assert.match(DIFF_JS, /getAttribute\('data-review-hash'\)/);
  assert.match(DIFF_JS, /'ds-viewed:'/);
  assert.match(PAGE_JS, /data-viewed-toggle/);
  assert.match(DIFF_JS, /viewedFiles\[file\]===hash/);
  assert.match(DIFF_JS, /JSON\.stringify\(viewedFiles\)/);
  assert.match(DIFF_JS, /Array\.isArray\(stored\)/, 'legacy filename arrays migrate to current hashes');
  assert.match(DIFF_JS, /if\(typeof syncViewed==='function'\)syncViewed\(\)/, 'lazy panels refresh their reviewed control');
  assert.match(DIFF_JS, /setAttribute\('aria-pressed',on\?'true':'false'\)/);
  assert.match(DIFF_JS, /on\?' unreviewed':' reviewed'/);
  assert.match(DIFF_JS, /on\?'Reviewed':'Mark reviewed'/);
  assert.match(DIFF_JS, /n\+' of '\+total\+' reviewed'/);
  assert.match(PAGE_JS, /activeFileFilter==='reviewed'/);
  assert.match(PAGE_JS, /activeFileFilter==='unreviewed'/);
  assert.match(PAGE_JS, /e\.key==='v'\|\|e\.key==='V'/);
});

test('reviewed checks use a defined local contrast token in both color schemes', () => {
  assert.match(DIFF_CSS, /--ds-reviewed-check-fg:var\(--on-green,#00250c\)/);
  assert.match(DIFF_CSS, /color:var\(--ds-reviewed-check-fg\)/);
  assert.doesNotMatch(DIFF_CSS, /var\(--on-add\)/);
});

test('split mode is lazy-loaded and persisted', () => {
  assert.match(DIFF_JS, /function loadSplit\(/);
  assert.match(DIFF_JS, /'ds-files-mode'/);
  assert.match(DIFF_JS, /\/api\/diff\/split\?file=/);
  assert.match(PAGE_JS, /function applyFilesMode\(/);
});

test('all lazy diff requests reject non-ok responses and expose inline retry actions', () => {
  assert.match(DIFF_JS, /function diffResponseText\(r\)/);
  assert.match(DIFF_JS, /if\(!r\.ok\).*err\.status=r\.status/);
  assert.equal((DIFF_JS.match(/\.then\(diffResponseText\)/g) || []).length, 3);
  assert.match(DIFF_JS, /function showDiffLoadError\(/);
  assert.match(DIFF_JS, /note\.setAttribute\('role','alert'\)/);
  assert.match(DIFF_JS, /retry\.setAttribute\('data-mode',mode\)/);
  assert.match(DIFF_JS, /function showGapError\(/);
  assert.match(DIFF_JS, /retry\.setAttribute\('data-expand',mode\)/);
  assert.match(DIFF_JS, /Could not load hidden context/);
  assert.match(DIFF_JS, /if\(!wrap\|\|!wrap\.hasAttribute\('data-ctx-rows'\)\)throw new Error\('Unexpected context response'\)/);
});

test('every lazy evidence request carries the issued page lease and offers a safe reload on conflict', () => {
  assert.match(PAGE_JS, /function reviewPageUrl\(path\)/);
  assert.match(PAGE_JS, /data-review-page-token/);
  assert.match(PAGE_JS, /url\.searchParams\.set\('page',token\)/);
  assert.match(PAGE_JS, /err\.reloadRequired=r\.status===409/);
  assert.match(PAGE_JS, /data-review-reload/);
  assert.match(PAGE_JS, /location\.reload\(\)/);
  assert.match(PAGE_JS, /pageToken:document\.body\.getAttribute\('data-review-page-token'\)/);
  for (const endpoint of [
    '/api/review/step-panel?index=',
    '/api/diff/file-panel?file=',
    '/api/review/excluded-file?file=',
    '/api/fullfile?file=',
    '/api/diff/split?file=',
    '/api/diff/context?file=',
  ]) {
    assert.match(PAGE_JS, new RegExp(`reviewPageUrl\\('${endpoint.replace(/[?]/g, '\\?')}`));
  }
});

test('diff display modes expose their selected state to assistive technology', () => {
  assert.match(DIFF_JS, /b\.setAttribute\('aria-pressed',active\?'true':'false'\)/);
});

test('expand-context client is wired', () => {
  assert.match(DIFF_JS, /function expandGap\(/);
  assert.match(DIFF_JS, /\/api\/diff\/context\?file=/);
  assert.match(PAGE_JS, /data-expand/);
});

test('hunk expansion remains discoverable without hover on touch devices', () => {
  assert.match(DIFF_CSS, /@media \(hover:none\),\(pointer:coarse\)\{\.ds-hunkgap\.is-expandable \.ds-gapbtn\{opacity:1/);
});

test('split divider and change rows have keyboard review foundations', () => {
  assert.match(DIFF_JS, /function prepareSplitDivider\(/);
  assert.match(DIFF_JS, /divider\.setAttribute\('role','separator'\)/);
  assert.match(DIFF_JS, /divider\.setAttribute\('aria-valuemin','22'\)/);
  assert.match(DIFF_JS, /divider\.addEventListener\('keydown',handleSplitDividerKey\)/);
  assert.ok(DIFF_JS.includes("key!=='ArrowLeft'&&key!=='ArrowRight'&&key!=='Home'&&key!=='End'"));
  assert.match(DIFF_JS, /opts&&opts\.focus&&row\.focus/);
  assert.match(DIFF_JS, /nav\.setAttribute\('role','group'\);nav\.setAttribute\('aria-label','Change navigation'\)/);
  assert.match(DIFF_CSS, /\.ds-row\[data-review-row\]:focus-visible,\.ds-urow\[data-review-row\]:focus-visible/);
  assert.match(DIFF_CSS, /\.ds-celldiv\[role="separator"\]:focus-visible/);
});

test('review page consumes shared tokens and respects reduced motion', () => {
  assert.match(PAGE_CSS, /--app-bg:/);
  assert.match(DIFF_CSS, /prefers-reduced-motion/);
});

test('story diff is width-contained and never creates a horizontal scroller', () => {
  assert.match(DIFF_CSS, /\.ds-diffscroll\{[^}]*min-width:0[^}]*overflow-x:hidden[^}]*overflow-y:auto/);
  assert.match(DIFF_CSS, /\.ds-diff\{[^}]*width:100%[^}]*min-width:0[^}]*max-width:100%/);
  assert.match(DIFF_JS, /function scrollReviewRowVertically\(row,opts\)/);
  assert.match(DIFF_JS, /scrollReviewRowVertically\(row,opts\)/);
  assert.doesNotMatch(DIFF_JS, /scrollIntoView/);
});

test('compact file toolbars wrap identity and review controls onto separate rows', () => {
  assert.match(DIFF_CSS, /@media \(max-width:720px\)[\s\S]*\.ds-filepanel-head\{flex-wrap:wrap/);
  assert.match(DIFF_CSS, /\.ds-filepanel-head::after\{content:'';order:6;flex-basis:100%/);
  assert.match(DIFF_CSS, /\.ds-filepanel-head>\.ds-modetoggle\{order:9;margin-left:auto\}/);
});
