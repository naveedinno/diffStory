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
    // The stage fills the frame it sits in; body's padding is the only gutter,
    // so an inset here would just misalign it against the chrome above.
    /#ds-view-tour>:not\(\.ds-dock\):not\(\.ds-filmthread\):not\(\[hidden\]\)\{[^}]*width:100%;max-width:none;margin:0/,
  );
  assert.doesNotMatch(source, /ds-step-ghost|ds-ghost-prev|ds-ghost-next/);
});

test('a code step draws exactly one frame around the diff', () => {
  const diffSource = readFileSync(new URL('../src/diff-assets.ts', import.meta.url), 'utf8');
  // The island keeps its border; the card inside it gives one up, so the two
  // concentric rounded frames collapse into one.
  assert.match(
    source,
    /#ds-view-tour>:not\(\.ds-dock\):not\(\.ds-filmthread\):not\(\[hidden\]\)\{[^}]*border:1px solid var\(--line-soft\)/,
  );
  assert.match(diffSource, /\.ds-step\.is-code-step \.ds-diff\{border:0;border-radius:0;box-shadow:none\}/);
  // Nothing may reintroduce a ring on the card either — the one frame is the island's.
  assert.doesNotMatch(diffSource, /\.ds-step\.is-(story|voice)-active[^{]*\.ds-diff\{/);
  // The one frame stays neutral in every state. Reading-here and speaking-now tint
  // the focus rows and the dock; a coloured edge on a window-wide island is noise.
  assert.doesNotMatch(source, /#ds-view-tour>\.ds-step\.is-(story|voice)-active[^{]*\{[^}]*(border-color|box-shadow):/);
  // Full-bleed: no side gutter between the island edge and the code.
  assert.match(source, /\.ds-step\.is-code-step>\.ds-diffscroll\{[^}]*padding:8px 0 0/);
  assert.doesNotMatch(source, /\.ds-step\.is-code-step>\.ds-diffscroll\{[^}]*padding:\d+px [1-9]/);
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
  // The thread is a row inside the dock island now, so the island is what has to
  // stay inside the viewport; the thread only has to refuse to push it wider.
  assert.match(source, /\.ds-dock\{[^}]*width:100%;min-width:0;max-width:100%/);
  assert.match(source, /\.ds-filmthread\{[^}]*min-width:0/);
  // Phone drops body's gutter, so the islands go edge to edge. They have to give
  // up their radius with it — a 16px corner riding the screen edge reads as a
  // rendering fault — and none of them may re-add a width inset of its own.
  assert.match(source, /body\{padding:0;gap:0\}/);
  assert.match(
    source,
    /body :is\(#ds-view-tour>:not\(\.ds-dock\):not\(\.ds-filmthread\):not\(\[hidden\]\),\.ds-dock,\.ds-filmthread\.is-storyless\)\{border-radius:0\}/,
  );
  assert.doesNotMatch(source, /calc\(100% - 16px\)/);
  assert.match(source, /\.ds-filmthread-allfiles\{height:44px;padding:0 9px\}/);
  assert.match(source, /\.ds-filmthread\.is-overview\{display:none\}/);
  assert.doesNotMatch(source, /\.ds-stage-num|\.ds-step-pos/);
});

test('notes filters wrap into a stable grid and keep pressed state synchronized', () => {
  assert.match(source, /\.ds-feedback-filters\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(source, /@media\(max-width:560px\)\{\.ds-feedback-filters\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
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
  assert.doesNotMatch(source, /ds-playstep/);
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
