import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/page-assets.ts', import.meta.url), 'utf8');

function driftHarness(compact) {
  const driftClient = source.match(/  function invalidateDriftRequest\(\)\{[\s\S]*?\n  \}\n  function fileMatchesFilter/)?.[0]
    .replace(/\n  function fileMatchesFilter$/, '') ?? '';
  assert.ok(driftClient, 'drift request client should be extractable');

  const classList = (initial = []) => {
    const values = new Set(initial);
    return {
      add: (...names) => names.forEach((name) => values.add(name)),
      remove: (...names) => names.forEach((name) => values.delete(name)),
      toggle(name, force) { if (force) values.add(name); else values.delete(name); },
      contains: (name) => values.has(name),
    };
  };
  const document = { activeElement: null };
  const button = (file, active = false) => {
    const attributes = new Map([
      ['data-drift-file', file],
      ['data-drift-label', file],
      ['aria-pressed', active ? 'true' : 'false'],
    ]);
    return {
      classList: classList(active ? ['is-active'] : []),
      getAttribute: (name) => attributes.get(name) ?? null,
      setAttribute: (name, value) => attributes.set(name, String(value)),
      removeAttribute: (name) => attributes.delete(name),
      focus() { document.activeElement = this; },
    };
  };
  let compactMode = compact;
  const buttons = [button('A.sol', true), button('B.sol')];
  const preview = { innerHTML: '' };
  const label = { textContent: '' };
  const back = { focus() { document.activeElement = this; } };
  const drawer = {
    hidden: false,
    classList: classList(),
    getAttribute: (name) => name === 'data-drift-observation' ? 'observation-1' : null,
  };
  const requests = [];
  const context = {
    AbortController,
    driftDrawer: drawer,
    driftRequestAbort: null,
    driftRequestToken: 0,
    driftLayoutMode: compact ? 'unified' : 'split',
    compactScreen: () => compactMode,
    document,
    encodeURIComponent,
    reviewPageUrl: (url) => url,
    reviewLazyText: (response) => response.html,
    reviewLazyMessage: () => 'failed',
    reviewLazyAction: () => '',
    hideDrawerRoot: (root) => { root.hidden = true; },
    setDriftExpanded: () => {},
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })),
    $: (selector) => {
      if (selector === '[data-drift-preview]') return preview;
      if (selector === '[data-drift-selected-path]') return label;
      if (selector === '[data-drift-back]') return back;
      if (selector === '.ds-drift-file.is-active') return buttons.find((item) => item.classList.contains('is-active')) ?? null;
      return null;
    },
    $all: (selector) => selector === '[data-drift-file]' ? buttons : [],
  };
  vm.runInNewContext(`${driftClient}\nthis.loadDriftFile=loadDriftFile;this.closeDriftDrawer=closeDriftDrawer;this.showDriftList=showDriftList;this.syncDriftLayout=syncDriftLayout;`, context);
  return { ...context, buttons, preview, label, back, drawer, requests, setCompact(value) { compactMode = value; } };
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

test('desktop story stages reclaim redundant side-navigation gutters', () => {
  assert.match(
    source,
    /#ds-view-tour>:not\(\.ds-filmthread\):not\(\[hidden\]\)\{[^}]*width:calc\(100% - 24px\)/,
  );
  assert.doesNotMatch(source, /ds-step-ghost|ds-ghost-prev|ds-ghost-next/);
});

test('compact review surfaces are width-contained while code and film navigation stay usable', () => {
  assert.match(source, /html,body\{[^}]*width:100%;max-width:100%/);
  assert.match(source, /\.ds-layout\{[^}]*min-width:0/);
  assert.match(source, /\.ds-reviewchrome\{height:56px;width:100%;min-width:0/);
  assert.match(source, /\.ds-reviewchrome-main\{[^}]*width:100%;min-width:0;max-width:100%/);
  assert.match(
    source,
    /\.ds-reviewchrome>\.ds-reviewchrome-rail\{display:none;position:fixed/,
    'the compact rail must outrank the shared positioned-child rule instead of pushing header utilities off canvas',
  );
  assert.match(source, /\.ds-filmthread\{[^}]*width:calc\(100% - 24px\);min-width:0;max-width:calc\(100% - 24px\)/);
  assert.match(
    source,
    /#ds-view-tour>:not\(\.ds-filmthread\):not\(\[hidden\]\)\{width:calc\(100% - 16px\)\}/,
  );
  assert.match(
    source,
    /\.ds-filmthread\{width:calc\(100% - 16px\);max-width:calc\(100% - 16px\);gap:6px;margin:0 8px 8px/,
  );
  assert.match(source, /\.ds-filmthread-allfiles\{height:44px;padding:0 9px\}/);
  assert.match(source, /\.ds-filmthread\.is-overview\{display:none\}/);
  assert.doesNotMatch(source, /\.ds-stage-num|\.ds-step-pos/);
});

test('notes filters wrap into a stable grid and keep pressed state synchronized', () => {
  assert.match(source, /\.ds-feedback-filters\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(source, /@media\(max-width:560px\)\{\.ds-feedback-drawer\{width:100%;max-width:100vw[^}]*\}\.ds-feedback-filters\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(source, /\.ds-feedback-filters\{[^}]*overflow-x:auto/);
  assert.match(
    source,
    /btn\.setAttribute\('aria-pressed',active\?'true':'false'\)/,
  );
  assert.match(source, /filterFeedback\(activeFeedbackFilter\)/);
});

test('mobile story drift switches from the file list to one lazy detail and back', () => {
  assert.match(source, /\.ds-drawer-root\.is-detail \.ds-drift-list\{display:none\}/);
  assert.match(source, /\.ds-drawer-root\.is-detail \.ds-drift-detail\{display:flex\}/);
  assert.match(source, /driftDrawer\.classList\.add\('is-detail'\)/);
  assert.match(source, /driftDrawer\.classList\.remove\('is-detail'\)/);
  assert.doesNotMatch(source, /\.ds-drift-drawer\.is-detail \.ds-drift-(?:list|detail)/);
  const open = source.match(/function openDriftDrawer\(\)\{[^\n]+/)?.[0] ?? '';
  assert.match(open, /classList\.remove\('is-detail'\)/);
  assert.doesNotMatch(open, /loadDriftFile/, 'opening the list must not eagerly request the first patch');
});

test('rapid since-story selections cannot paint an older file under the active label', async () => {
  const harness = driftHarness(true);

  harness.loadDriftFile(harness.buttons[0]);
  assert.equal(harness.requests.length, 1, 'a normal selection makes one lazy request');
  assert.match(harness.requests[0].url, /[?&]layout=unified(?:&|$)/);

  harness.loadDriftFile(harness.buttons[1]);
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.requests[0].options.signal.aborted, true, 'selecting B aborts A');

  harness.requests[1].resolve({ html: '<p>patch B</p>' });
  await flushPromises();
  assert.equal(harness.label.textContent, 'B.sol');
  assert.equal(harness.preview.innerHTML, '<p>patch B</p>');

  harness.requests[0].resolve({ html: '<p>patch A arrived late</p>' });
  await flushPromises();
  assert.equal(harness.label.textContent, 'B.sol');
  assert.equal(harness.preview.innerHTML, '<p>patch B</p>', 'A cannot overwrite B after resolving late');

  harness.loadDriftFile(harness.buttons[1]);
  assert.equal(harness.requests.length, 2, 'the active layout reuses its cached response');
});

test('since-story close and back invalidate work while desktop requests split layout', async () => {
  const harness = driftHarness(false);
  harness.loadDriftFile(harness.buttons[0]);
  assert.match(harness.requests[0].url, /[?&]layout=split(?:&|$)/);

  harness.closeDriftDrawer();
  assert.equal(harness.requests[0].options.signal.aborted, true);
  harness.requests[0].resolve({ html: '<p>closed patch</p>' });
  await flushPromises();
  assert.notEqual(harness.preview.innerHTML, '<p>closed patch</p>');

  assert.match(source, /\[data-drift-back\]'\);if\(b&&driftDrawer\)\{showDriftList\(\)/);
  assert.match(source, /requestToken!==driftRequestToken\|\|\$\('\.ds-drift-file\.is-active',driftDrawer\)!==button/);
  assert.match(source, /button\._dsDriftLayout===layout/);
});

test('since-story resize swaps renderers and focus follows the visible mobile surface', async () => {
  const harness = driftHarness(true);
  harness.loadDriftFile(harness.buttons[0]);
  assert.equal(harness.document.activeElement, harness.back, 'mobile detail moves focus out of the hidden list');
  assert.match(harness.requests[0].url, /[?&]layout=unified(?:&|$)/);

  harness.setCompact(false);
  harness.syncDriftLayout();
  assert.equal(harness.requests[0].options.signal.aborted, true, 'crossing the breakpoint invalidates the old renderer');
  assert.equal(harness.requests.length, 2);
  assert.match(harness.requests[1].url, /[?&]layout=split(?:&|$)/);
  assert.equal(harness.document.activeElement, harness.buttons[0], 'desktop focus returns to the now-visible file row');

  harness.requests[1].resolve({ html: '<p>desktop split</p>' });
  await flushPromises();
  assert.equal(harness.preview.innerHTML, '<p>desktop split</p>');

  harness.setCompact(true);
  harness.syncDriftLayout();
  assert.equal(harness.requests.length, 3);
  assert.match(harness.requests[2].url, /[?&]layout=unified(?:&|$)/);
  assert.equal(harness.document.activeElement, harness.back);
  harness.showDriftList();
  assert.equal(harness.document.activeElement, harness.buttons[0], 'Back returns focus to the selected visible row');
  assert.equal(harness.drawer.classList.contains('is-detail'), false);
});

test('review dialogs expose complete client-side focus and radio semantics', () => {
  assert.match(source, /var firstCommand=\$\('\[data-command\]',commandRoot\)/);
  assert.match(source, /if\(firstCommand\)firstCommand\.focus\(\)/);
  assert.match(source, /function syncComposerRadioGroup\(group,selected\)/);
  assert.match(source, /choice\.tabIndex=active\?0:-1/);
  assert.match(source, /tabs\.addEventListener\('keydown',function\(e\)\{moveComposerRadio\(tabs,'\.ds-composer-tab',e\);\}\)/);
  assert.match(source, /severity\.addEventListener\('keydown',function\(e\)\{moveComposerRadio\(severity,'\.ds-severity-choice',e\);\}\)/);
  assert.match(source, /ta\.setAttribute\('aria-label','Review note'\)/);
  assert.match(source, /ta\.setAttribute\('aria-label','Reply to '\+BRAND\)/);
  assert.match(source, /\.ds-concept-heading \.ds-playstep\{[^}]*width:44px;height:44px/);
});

test('cover support stays visually quiet beside the compact walkthrough action', () => {
  const freshnessRule = source.match(/\.ds-intro-freshness\{([^}]*)\}/)?.[1] ?? '';
  const notesSummaryRule = source.match(/\.ds-intro-notes>summary\{([^}]*)\}/)?.[1] ?? '';
  assert.match(freshnessRule, /display:flex/);
  assert.doesNotMatch(freshnessRule, /border:|background:/);
  assert.match(notesSummaryRule, /display:inline-flex/);
  assert.match(notesSummaryRule, /color:var\(--muted\)/);
  assert.doesNotMatch(notesSummaryRule, /border:|background:/);
  assert.doesNotMatch(source, /\.ds-freshness-callout|\.ds-intro-disclosure|\.ds-intro-meta/);
  assert.match(source, /\.ds-intro-start\{[^}]*background:var\(--accent\)/);
  assert.match(source, /\.ds-intro-actions \.ds-intro-start\{[^}]*display:inline-flex/);
  const startRules = [...source.matchAll(/\.ds-intro-actions \.ds-intro-start\{([^}]*)\}/g)].map((match) => match[1]);
  assert.equal(startRules.some((rule) => /(?:^|;)width:100%(?:;|$)/.test(rule)), false);
});
