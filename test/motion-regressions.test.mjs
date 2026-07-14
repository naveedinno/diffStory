import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFF_CSS, DIFF_JS } from '../dist/diff-assets.js';
import { PAGE_CSS, PAGE_JS } from '../dist/page-assets.js';
import { progressPanelStyles } from '../dist/progress-ui.js';
import { sharedTokens } from '../dist/theme.js';

function ruleBody(css, selector) {
  const start = css.indexOf(selector + '{');
  assert.notEqual(start, -1, `missing ${selector} rule`);
  const bodyStart = start + selector.length + 1;
  return css.slice(bodyStart, css.indexOf('}', bodyStart));
}

test('shared motion primitives expose the exact dashboard timing scale', () => {
  const css = sharedTokens();
  assert.match(css, /--motion-ease-out:cubic-bezier\(0\.23,1,0\.32,1\)/);
  assert.match(css, /--motion-ease-in-out:cubic-bezier\(0\.77,0,0\.175,1\)/);
  assert.match(css, /--motion-ease-drawer:cubic-bezier\(0\.32,0\.72,0,1\)/);
  assert.match(css, /--motion-duration-press:120ms/);
  assert.match(css, /--motion-duration-fast:150ms/);
  assert.match(css, /--motion-duration-ui:200ms/);
  assert.match(css, /--motion-duration-progress:250ms/);
  assert.match(PAGE_CSS, /var\(--motion-duration-fast\)/);
});

test('change navigation uses one stable marker without keyframes or cleanup timers', () => {
  assert.match(DIFF_CSS, /\.ds-row\.is-change-jump,\.ds-urow\.is-change-jump\{box-shadow:inset 3px 0 0 var\(--accent-blue\)\}/);
  assert.doesNotMatch(DIFF_CSS, /dsChangeJump/);
  assert.match(DIFF_JS, /\$all\('\.ds-row-add,\.ds-row-del',holder\)\.forEach\(function\(r\)\{r\.classList\.remove\('is-change-jump'\);\}\)/);
  assert.doesNotMatch(DIFF_JS, /setTimeout\([^\n]*is-change-jump|1300/);
});

test('focus scrolling cancels stale work and honors reduced motion', () => {
  assert.match(PAGE_JS, /focusScrollTimer=0,focusScrollFrame=0/);
  assert.match(PAGE_JS, /function cancelFocusScroll\(\)/);
  assert.match(PAGE_JS, /cancelAnimationFrame\(focusScrollFrame\)/);
  assert.match(PAGE_JS, /document\.documentElement\.contains\(target\)/);
  assert.match(PAGE_JS, /behavior:instant\|\|prefersReducedMotion\(\)\?'auto':'smooth'/);
  assert.match(DIFF_JS, /behavior:\(opts&&opts\.instant\)\|\|prefersReducedMotion\(\)\?'auto':'smooth'/);
});

test('resize gestures batch frame writes and scope layout variables', () => {
  assert.match(PAGE_JS, /sidebarResizeFrame=requestAnimationFrame/);
  assert.match(PAGE_JS, /splitResizeFrame=requestAnimationFrame/);
  assert.match(PAGE_JS, /cancelAnimationFrame\(sidebarResizeFrame\)/);
  assert.match(PAGE_JS, /cancelAnimationFrame\(splitResizeFrame\)/);
  assert.match(PAGE_JS, /layout\.style\.setProperty\('--ds-rail-width'/);
  assert.match(PAGE_JS, /splitHolder\.style\.setProperty\('--ds-split'/);
  assert.doesNotMatch(PAGE_JS, /document\.documentElement\.style\.setProperty\('--ds-(?:rail-width|split)'/);
  assert.match(PAGE_JS, /localStorage\.setItem\('ds-sidebar-width'/);
  assert.match(PAGE_JS, /localStorage\.setItem\('ds-split'/);
  assert.doesNotMatch(PAGE_CSS, /\.ds-rail\{[^}]*transition:[^}]*width/);
});

test('read aloud focus is static while loading state remains explicit', () => {
  assert.doesNotMatch(DIFF_CSS, /dsVoiceFocus/);
  assert.doesNotMatch(ruleBody(DIFF_CSS, '.ds-row.is-voice-focus'), /animation|filter/);
  assert.doesNotMatch(ruleBody(DIFF_CSS, '.ds-urow.is-voice-focus'), /animation|filter/);
  assert.match(PAGE_CSS, /\.ds-readaloud\.is-speaking \.ds-readaloud-ico\{animation:none;box-shadow:0 0 0 3px var\(--accent-soft\)\}/);
  assert.match(PAGE_CSS, /\.ds-readaloud\.is-loading/);
});

test('reduced motion keeps status feedback but removes movement and pulses', () => {
  assert.match(PAGE_JS, /function prefersReducedMotion\(\)/);
  assert.match(PAGE_CSS, /\.ds-toast\{animation:none!important;transform:translateX\(-50%\);transition:opacity 200ms ease\}/);
  assert.match(PAGE_CSS, /\.ds-readhead-fill\{transition:none!important\}/);
  assert.match(PAGE_CSS, /\.ds-agent-target\.is-busy \.ds-agent-target-icon[^}]*animation:none!important/);
  assert.match(PAGE_CSS, /prefers-reduced-motion:no-preference\)\{\.ds-voice-card:hover\{transform:translateY\(-1px\)\}/);
  assert.match(DIFF_CSS, /\.ds-row\.is-voice-focus[^}]*animation:none!important;filter:none!important/);
  const progress = progressPanelStyles();
  assert.match(progress, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(progress, /\.ds-pp-spin,\.ds-pp-step\.is-active \.ds-pp-mark::before,\.ds-pp-live-dot,\.ds-pp-mile\.is-active \.ds-pp-mile-dot\{animation:none!important\}/);
});

test('drawers share an interruptible spatial lifecycle', () => {
  assert.match(PAGE_CSS, /\.ds-drawer-scrim\{[^}]*opacity:0;transition:opacity var\(--motion-duration-ui\) var\(--motion-ease-out\)/);
  assert.match(PAGE_CSS, /\.ds-drawer\{[^}]*transform:translateX\(100%\);transition:transform var\(--motion-duration-progress\) var\(--motion-ease-drawer\)/);
  assert.match(PAGE_CSS, /\.ds-drawer-root\.is-open \.ds-drawer\{transform:translateX\(0\)\}/);
  assert.match(PAGE_JS, /function showDrawerRoot\(root\)/);
  assert.match(PAGE_JS, /function hideDrawerRoot\(root\)/);
  assert.match(PAGE_JS, /clearTimeout\(root\._dsHideTimer\)/);
  assert.match(PAGE_JS, /root\.classList\.add\('is-open'\)/);
  assert.match(PAGE_JS, /root\.classList\.remove\('is-open'\)/);
  assert.match(PAGE_JS, /prefersReducedMotion\(\)\?200:250/);
});

test('reading progress uses a composited scale and comment traversal is instant', () => {
  const fill = ruleBody(PAGE_CSS, '.ds-readhead-fill');
  assert.match(fill, /width:100%/);
  assert.match(fill, /transform:scaleX\(0\)/);
  assert.match(fill, /transform-origin:left center/);
  assert.match(fill, /transition:transform var\(--motion-duration-progress\) var\(--motion-ease-in-out\)/);
  assert.match(PAGE_JS, /pf\.style\.transform='scaleX\('\+ratio\+'\)'/);
  assert.doesNotMatch(PAGE_JS, /ds-progress-fill[^\n]*style\.width|pf\.style\.width/);
  assert.doesNotMatch(ruleBody(PAGE_CSS, '.ds-thread.is-open'), /animation|transition/);
  assert.doesNotMatch(ruleBody(PAGE_CSS, '.ds-comment'), /animation|transition/);
});
