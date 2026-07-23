import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navBar, navStyles } from '../dist/nav.js';
import { renderChangePage } from '../dist/change-page.js';
import { renderPicker } from '../dist/picker.js';
import { renderStoryPicker } from '../dist/story-picker.js';
import { DIFF_CSS } from '../dist/diff-assets.js';
import { sharedTokens, themeBootstrapScript, themeControl, threadAtmosphereStyles } from '../dist/theme.js';

function cssBlock(css, selector) {
  const start = css.indexOf(`${selector}{`);
  assert.notEqual(start, -1, `missing ${selector} rule`);
  const bodyStart = start + selector.length + 1;
  return css.slice(bodyStart, css.indexOf('}', bodyStart));
}

function hexVariable(block, name) {
  const match = block.match(new RegExp(`${name}:(#[0-9a-f]{6})`, 'i'));
  assert.ok(match, `missing literal ${name}`);
  return match[1].slice(1).match(/.{2}/g).map((part) => Number.parseInt(part, 16));
}

function rgbaBackground(css, selector) {
  const match = cssBlock(css, selector).match(/background:rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
  assert.ok(match, `missing rgba background for ${selector}`);
  return {
    rgb: match.slice(1, 4).map((part) => Number.parseInt(part, 10)),
    alpha: Number.parseFloat(match[4]),
  };
}

function composite({ rgb, alpha }, base) {
  return rgb.map((channel, index) => channel * alpha + base[index] * (1 - alpha));
}

function luminance(rgb) {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

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

test('light semantic diff ink stays WCAG AA on header, split, and unified surfaces', () => {
  const tokens = sharedTokens();
  const light = cssBlock(tokens, ':root[data-theme="light"]');
  const surface = hexVariable(light, '--surface');
  const header = hexVariable(light, '--surface-2');
  const addText = hexVariable(light, '--diff-add-text');
  const delText = hexVariable(light, '--diff-del-text');
  const cases = [
    ['add header', addText, header],
    ['delete header', delText, header],
    ['add split', addText, composite(rgbaBackground(DIFF_CSS, '.ds-cell-add'), surface)],
    ['delete split', delText, composite(rgbaBackground(DIFF_CSS, '.ds-cell-del'), surface)],
    ['add unified', addText, composite(rgbaBackground(DIFF_CSS, '.ds-urow.ds-row-add'), surface)],
    ['delete unified', delText, composite(rgbaBackground(DIFF_CSS, '.ds-urow.ds-row-del'), surface)],
  ];

  for (const [label, foreground, background] of cases) {
    const ratio = contrastRatio(foreground, background);
    assert.ok(ratio >= 4.5, `${label} contrast ${ratio.toFixed(2)}:1 is below WCAG AA`);
  }
});

test('light syntax tokens stay WCAG AA across plain and tinted diff surfaces', () => {
  const tokens = sharedTokens();
  const light = cssBlock(tokens, ':root[data-theme="light"]');
  const surface = hexVariable(light, '--surface');
  const foregrounds = ['--tk-k', '--tk-t', '--tk-f', '--tk-s', '--tk-n', '--tk-c']
    .map((name) => [name, hexVariable(light, name)]);
  const backgrounds = [
    ['plain', surface],
    ['split add', composite(rgbaBackground(DIFF_CSS, '.ds-cell-add'), surface)],
    ['split delete', composite(rgbaBackground(DIFF_CSS, '.ds-cell-del'), surface)],
    ['unified add', composite(rgbaBackground(DIFF_CSS, '.ds-urow.ds-row-add'), surface)],
    ['unified delete', composite(rgbaBackground(DIFF_CSS, '.ds-urow.ds-row-del'), surface)],
  ];

  for (const [token, foreground] of foregrounds) {
    for (const [surfaceName, background] of backgrounds) {
      const ratio = contrastRatio(foreground, background);
      assert.ok(ratio >= 4.5, `${token} on ${surfaceName} is ${ratio.toFixed(2)}:1, below WCAG AA`);
    }
  }
});

test('page atmosphere shares one map, thread pulse, compact, and reduced-motion contract', () => {
  const css = threadAtmosphereStyles();
  assert.match(css, /body\.ds-map-bg::before/);
  assert.match(css, /animation:ds-thread-pulse 11s linear 2s infinite backwards/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.ds-atmosphere-thread \.thread-pulse\{display:none\}/);
  assert.match(css, /max-width:480px\)\{\.ds-thread-layer\[data-thread-compact="hide"\]\{display:none\}/);
});

test('front-door pages apply the saved theme before CSS and expose one selector', () => {
  const change = renderChangePage(
    { base: 'abc', baseLabel: 'main', files: [], totalChanged: 0, hasChanges: false },
    { repoName: 'demo' },
  );
  const picker = renderPicker([], '/Users/test', Date.now());
  const history = renderStoryPicker({ repoName: 'demo', routeBase: '/repo/demo', stories: [], now: Date.now() });
  const pages = [picker, change, history];

  for (const html of pages) {
    assert.ok(html.indexOf("var key='ds-theme'") < html.indexOf('<style>'), 'resolves the theme before the page stylesheet');
    assert.equal((html.match(/class="ds-theme-toggle"/g) || []).length, 1);
    assert.match(html, /meta name="theme-color"[^>]+data-ds-theme-color/);
  }
  for (const html of [picker, change]) {
    assert.match(html, /<body class="ds-map-bg"/);
    assert.match(html, /class="(?:ds-thread-layer|hero-thread ds-atmosphere-thread)"/, 'renders the shared Thread Path atmosphere');
  }
  assert.doesNotMatch(history, /ds-thread-layer/, 'keeps review history free of ornamental thread furniture');
  assert.equal((navBar().match(/class="ds-theme-toggle"/g) || []).length, 1);
});
