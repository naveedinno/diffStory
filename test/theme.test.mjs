import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navBar, navStyles } from '../dist/nav.js';
import { renderChangePage } from '../dist/change-page.js';
import { renderPicker } from '../dist/picker.js';
import { renderStoryPicker } from '../dist/story-picker.js';
import { sharedTokens, themeBootstrapScript, themeControl } from '../dist/theme.js';

test('theme control offers persistent System, Light, and Dark choices', () => {
  const control = themeControl();
  const script = themeBootstrapScript();

  assert.match(control, /data-theme-toggle[^>]+aria-haspopup="menu"[^>]+aria-expanded="false"/);
  assert.equal((control.match(/role="menuitemradio"/g) || []).length, 3);
  assert.match(control, /data-theme-choice="system"[^>]+aria-checked="true"/);
  assert.match(control, /data-theme-choice="light"[^>]+aria-checked="false"/);
  assert.match(control, /data-theme-choice="dark"[^>]+aria-checked="false"/);
  assert.match(script, /localStorage\.setItem\(key,mode\)/);
  assert.match(script, /localStorage\.removeItem\(key\)/);
  assert.match(script, /root\.setAttribute\('data-theme',value\)/);
  assert.match(script, /media\.addEventListener\('change',onScheme\)/);
  assert.match(script, /event\.key==='ArrowDown'/);
  assert.match(script, /event\.key==='Escape'/);
});

test('theme palettes use a resolved data attribute instead of an OS-only media query', () => {
  const tokens = sharedTokens();
  const navCss = navStyles();

  assert.match(tokens, /:root\{color-scheme:dark;/);
  assert.match(tokens, /--bg:#0a0c0f/);
  assert.match(tokens, /:root\[data-theme="light"\]\{color-scheme:light;/);
  assert.match(tokens, /--bg:#edf0f4/);
  // Nav vars alias the canonical tokens one-directionally, so they flip with the
  // canonical light block and need no per-theme literals of their own.
  assert.match(navCss, /--nv-bg:var\(--surface\)/);
  assert.doesNotMatch(tokens, /prefers-color-scheme/);
  assert.doesNotMatch(navCss, /prefers-color-scheme/);
});

test('front-door pages apply the saved theme before CSS and expose one selector', () => {
  const change = renderChangePage(
    { base: 'abc', baseLabel: 'main', files: [], totalChanged: 0, hasChanges: false },
    { repoName: 'demo' },
  );
  const pages = [
    renderPicker([], '/Users/test', Date.now()),
    change,
    renderStoryPicker({ repoName: 'demo', routeBase: '/repo/demo', stories: [], now: Date.now() }),
  ];

  for (const html of pages) {
    assert.ok(html.indexOf("var key='ds-theme'") < html.indexOf('<style>'), 'resolves the theme before the page stylesheet');
    assert.equal((html.match(/class="ds-theme-toggle"/g) || []).length, 1);
    assert.match(html, /meta name="theme-color"[^>]+data-ds-theme-color/);
  }
  assert.equal((navBar().match(/class="ds-theme-toggle"/g) || []).length, 1);
});
