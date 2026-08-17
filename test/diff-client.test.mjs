// The diff-surface client assets stay composed into the one page IIFE. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedTokens } from '../dist/theme.js';

// `DIFF_CSS`/`DIFF_JS` and `PAGE_CSS`/`PAGE_JS` were template strings inlined
// into every review document. They are files now — `review.css` and the ported
// `review-engine.js` — and the assertions below are unchanged, because the text
// is. The four names are kept as aliases so the diff of this file shows only
// what actually moved.
const DIFF_JS = readFileSync(new URL('../client/surfaces/review/engine/review-engine.js', import.meta.url), 'utf8');
const PAGE_JS = DIFF_JS;
const DIFF_CSS = readFileSync(new URL('../client/surfaces/review/review.css', import.meta.url), 'utf8');
const PAGE_CSS = DIFF_CSS;
const REVIEW_APP = readFileSync(new URL('../client/surfaces/review/ReviewApp.tsx', import.meta.url), 'utf8');

test('diff-assets exports the diff client functions', () => {
  assert.match(DIFF_JS, /function setMode\(/);
  assert.match(DIFF_JS, /function loadFull\(/);
  assert.match(DIFF_JS, /function updateChangeNav\(/);
  assert.match(DIFF_JS, /function handleChangeShortcut\(/);
});

test('the diff assets ship as one review stylesheet and one review engine', () => {
  // They used to be `DIFF_CSS`/`DIFF_JS` template strings spliced into
  // `PAGE_CSS`/`PAGE_JS`. Same composition, two files: the stylesheet is
  // imported by `client/styles.css`, and the diff functions are declarations
  // inside the engine's single exported entry point, which is what keeps them
  // in one closure with the page half.
  assert.match(DIFF_JS, /^\/\/ The review page's interaction engine\./);
  assert.match(DIFF_JS, /export function startReviewEngine\(options\)\{/);
  assert.ok(DIFF_JS.indexOf('function setMode(') > DIFF_JS.indexOf('export function startReviewEngine'));
  assert.match(DIFF_CSS, /^\/\* The review surface's stylesheet\./);
});

test('diff CSS moved out of page-assets core', () => {
  assert.match(DIFF_CSS, /\.ds-row\b/);
  assert.match(DIFF_CSS, /\.ds-hunkgap\b/);
  assert.match(DIFF_CSS, /\.ds-hunkgap-split\b/);
  assert.match(DIFF_CSS, /\.ds-modetoggle\b/);
});

test('diff headers and context gaps follow the resolved color theme', () => {
  assert.match(DIFF_CSS, /\.ds-diffhead\{[^}]*background:var\(--gutter-hi\)/);
  assert.match(DIFF_CSS, /\.ds-hunkgap\{[^}]*background:var\(--gutter\)/);
  assert.doesNotMatch(DIFF_CSS, /\.ds-diffhead\{[^}]*background:#[0-9a-f]+/i);
  assert.doesNotMatch(DIFF_CSS, /\.ds-hunkgap\{[^}]*background:#[0-9a-f]+/i);
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
  assert.match(DIFF_CSS, /\.ds-hunkgap-split \.ds-gapbtn-context\{opacity:1\}/);
  assert.match(DIFF_JS, /data-gap-chunk/);
  assert.match(DIFF_JS, /from\+chunk-1/);
});

test('split divider and change rows have keyboard review foundations', () => {
  assert.match(DIFF_JS, /function prepareSplitDivider\(/);
  assert.match(DIFF_JS, /divider\.setAttribute\('role','separator'\)/);
  assert.match(DIFF_JS, /divider\.setAttribute\('aria-valuemin','0'\)/);
  assert.match(DIFF_JS, /divider\.setAttribute\('aria-valuemax','100'\)/);
  assert.match(DIFF_JS, /divider\.addEventListener\('keydown',handleSplitDividerKey\)/);
  assert.ok(DIFF_JS.includes("key!=='ArrowLeft'&&key!=='ArrowRight'&&key!=='Home'&&key!=='End'"));
  assert.match(DIFF_JS, /opts&&opts\.focus&&row\.focus/);
  assert.match(DIFF_JS, /nav\.setAttribute\('role','group'\);nav\.setAttribute\('aria-label','Change navigation'\)/);
  assert.match(DIFF_CSS, /\.ds-row\[data-review-row\]:focus-visible,\.ds-urow\[data-review-row\]:focus-visible/);
  assert.match(DIFF_CSS, /\.ds-celldiv\[role="separator"\]:focus-visible/);
});

test('review page consumes shared tokens and respects reduced motion', () => {
  // The tokens are no longer inlined ahead of the review CSS — every surface
  // gets them from the generated theme bridge — so the check is that the review
  // stylesheet USES them and defines none of its own palette.
  assert.match(sharedTokens(), /--app-bg:/);
  assert.match(PAGE_CSS, /var\(--app-bg\)|var\(--panel/);
  assert.match(DIFF_CSS, /prefers-reduced-motion/);
});

test('line wrapping is an accessible persisted option and defaults to off', () => {
  assert.match(REVIEW_APP, /data-line-wrap-toggle/);
  assert.match(REVIEW_APP, /aria-pressed="false"/);
  assert.match(DIFF_JS, /function setLineWrap\(on,persist\)/);
  assert.match(DIFF_JS, /localStorage\.getItem\('ds-line-wrap'\)==='1'/);
  assert.match(DIFF_JS, /localStorage\.setItem\('ds-line-wrap',on\?'1':'0'\)/);
  assert.match(DIFF_JS, /classList\.toggle\('ds-line-wrap',on\)/);
  assert.match(DIFF_CSS, /\.ds-code\{[^}]*white-space:pre;[^}]*overflow-wrap:normal/);
  assert.match(DIFF_CSS, /body\.ds-line-wrap \.ds-code\{white-space:pre-wrap;overflow-wrap:anywhere\}/);
});

test('unwrapped diffs scroll horizontally without disturbing vertical row navigation', () => {
  assert.match(DIFF_CSS, /\.ds-diffscroll\{[^}]*min-width:0[^}]*overflow:auto/);
  assert.match(DIFF_CSS, /\.ds-diff\{[^}]*width:max-content[^}]*min-width:100%[^}]*max-width:none/);
  assert.match(DIFF_CSS, /\.ds-difftoolbar\{[^}]*left:0[^}]*width:calc\(100cqw - 11px\)[^}]*max-width:calc\(100cqw - 11px\)/);
  assert.match(DIFF_CSS, /\.ds-filepanel-body\{[^}]*width:max-content[^}]*min-width:100%/);
  assert.match(DIFF_CSS, /body\.ds-line-wrap \.ds-diffscroll\{overflow-x:hidden\}/);
  assert.match(DIFF_CSS, /body\.ds-line-wrap \.ds-diff\{width:100%;min-width:0;max-width:100%\}/);
  assert.match(DIFF_CSS, /body\.ds-line-wrap \.ds-filepanel-body\{width:100%;min-width:0\}/);
  assert.match(DIFF_JS, /function scrollReviewRowVertically\(row,opts\)/);
  assert.match(DIFF_JS, /scrollReviewRowVertically\(row,opts\)/);
  assert.doesNotMatch(DIFF_JS, /scrollIntoView/);
});

test('split panes resize independently of line length and scroll their code locally', () => {
  assert.match(DIFF_JS, /function syncSplitPaneLayout\(holder\)/);
  assert.match(DIFF_JS, /function ensureSplitPaneScrollbars\(holder\)/);
  assert.match(DIFF_JS, /Math\.max\(0,Math\.min\(100,pct\)\)/);
  assert.match(DIFF_JS, /Math\.max\(0,Math\.min\(100,\(clientX-r\.left\)\/r\.width\*100\)\)/);
  assert.match(DIFF_JS, /if\(key==='Home'\)pct=0;else if\(key==='End'\)pct=100/);
  assert.match(DIFF_JS, /--ds-left-scroll/);
  assert.match(DIFF_JS, /--ds-right-scroll/);
  assert.match(DIFF_JS, /scroller\.setAttribute\('aria-keyshortcuts','ArrowLeft ArrowRight Home End'\)/);
  assert.match(DIFF_JS, /if\(e\.key==='Home'\)next=0;else if\(e\.key==='End'\)next=max/);
  assert.ok(
    (DIFF_JS.match(/syncSplitPaneLayout\(/g) || []).length >= 6,
    'initial, lazy, mode, context, keyboard, and resize paths must all resync pane layout',
  );
  assert.doesNotMatch(DIFF_JS, /Math\.max\(maxLeft\/ratio,maxRight\/\(1-ratio\)\)/);
  assert.match(
    DIFF_CSS,
    /\[data-split-inner\]:not\(\[hidden\]\) \.ds-cell\{overflow:hidden\}/,
  );
  assert.match(DIFF_CSS, /\.ds-split-mode \[data-split-inner\]:not\(\[hidden\]\) \.ds-diffbody\{overflow-x:clip\}/);
  assert.match(DIFF_CSS, /\.ds-hunkgap-split\{[^}]*overflow:hidden/);
  assert.match(DIFF_CSS, /\.ds-diff\.ds-split-mode\{width:100%;min-width:0;max-width:100%\}/);
  assert.match(DIFF_CSS, /\.ds-filepanel\.ds-split-mode \.ds-filepanel-body\{width:100%;min-width:0\}/);
  assert.match(DIFF_CSS, /\.ds-split-scrollbars\{[^}]*display:flex/);
  assert.match(DIFF_CSS, /\.ds-pane-scroll-left\{flex-grow:var\(--ds-split,50\)/);
  assert.match(DIFF_CSS, /\.ds-pane-scroll-right\{flex-grow:calc\(100 - var\(--ds-split,50\)\)/);
  assert.match(DIFF_CSS, /\.ds-celldiv::after\{[^}]*left:-12px;right:-12px/);
});

test('compact file toolbars wrap identity and review controls onto separate rows', () => {
  assert.match(DIFF_CSS, /@media \(max-width:720px\)[\s\S]*\.ds-filepanel-head\{flex-wrap:wrap/);
  assert.match(DIFF_CSS, /\.ds-filepanel-head::after\{content:'';order:6;flex-basis:100%/);
  assert.match(DIFF_CSS, /\.ds-filepanel-head>\.ds-modetoggle\{order:9;margin-left:auto\}/);
  assert.match(DIFF_CSS, /@media \(max-width:470px\)[\s\S]*\.ds-reviewchrome-main>\.ds-titlewrap\{display:none\}/);
});
