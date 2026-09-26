import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const engine = readFileSync(new URL('../client/surfaces/review/engine/review-engine.js', import.meta.url), 'utf8');

test('the engine points concept frames at the leased page endpoint with the theme', () => {
  assert.match(engine, /function mountConceptPages\(panel\)/);
  assert.match(engine, /reviewPageUrl\('\/api\/review\/concept-page\?index='/);
  assert.match(engine, /mountConceptPages\(fresh\)/, 'lazy panels mount their frame');
});

test('forwarded keys are accepted only from a concept frame window', () => {
  assert.match(engine, /function onConceptFrameMessage\(e\)/);
  assert.match(engine, /contentWindow===e\.source/);
  assert.match(engine, /d\.type!=='diffstory:key'/);
  assert.match(engine, /window\.addEventListener\('message',onConceptFrameMessage\)/);
});

test('theme changes reach every mounted concept frame', () => {
  assert.match(engine, /function syncConceptPageTheme\(\)/);
  assert.match(engine, /type:'diffstory:theme'/);
  assert.match(engine, /attributeFilter:\['data-theme'\]/);
});

// ---- behavior, not just shape ----------------------------------------------
// The frame bridge is a security boundary: any mounted concept page can post
// anything to the app window. Run the real engine functions against a small
// DOM stub and prove only a focused frame on the active step, pressing a story
// navigation key, ever reaches the key handler.

const fn = (name) => engine.match(new RegExp('  function ' + name + '\\([^]*?\\n  }'))?.[0];
const keysDecl = engine.match(/  var CONCEPT_FRAME_KEYS=[^\n]*/)?.[0];

function bridge() {
  const win = (name) => ({ name });
  const frame = (w) => ({ contentWindow: w, tagName: 'IFRAME' });
  const activeWin = win('active'), hiddenWin = win('hidden');
  const activeFrame = frame(activeWin), hiddenFrame = frame(hiddenWin);
  const panels = [
    { frames: [], contains: (f) => false },
    { frames: [hiddenFrame], contains: (f) => f === hiddenFrame },
    { frames: [activeFrame], contains: (f) => f === activeFrame },
  ];
  const calls = [];
  const context = vm.createContext({
    stepPanels: panels,
    active: 2,
    document: { activeElement: activeFrame },
    $all: (selector, root) => (root ? root.frames : panels.flatMap((p) => p.frames)),
    onKey: (event) => calls.push(event),
  });
  assert.ok(keysDecl, 'the engine declares its concept key allowlist');
  vm.runInContext(keysDecl, context);
  for (const name of ['conceptFrameForMessage', 'onConceptFrameMessage']) {
    const source = fn(name);
    assert.ok(source, `${name} exists`);
    vm.runInContext(source, context);
  }
  const send = (source, key, extra = {}) => context.onConceptFrameMessage({ source, data: { type: 'diffstory:key', key, ...extra } });
  return { context, calls, send, activeWin, hiddenWin, activeFrame, hiddenFrame };
}

test('a focused frame on the active step can press story navigation keys', () => {
  const b = bridge();
  for (const key of ['ArrowLeft', 'ArrowRight', 'j', 'k', ' ']) b.send(b.activeWin, key);
  assert.deepEqual(b.calls.map((e) => e.key), ['ArrowLeft', 'ArrowRight', 'j', 'k', ' ']);
  assert.equal(b.calls[0].target, b.activeFrame);
});

test('a frame that is not on the active step is ignored, even when focused', () => {
  const b = bridge();
  b.context.document.activeElement = b.hiddenFrame;
  b.send(b.hiddenWin, 'j');
  assert.equal(b.calls.length, 0);
});

test('an unfocused frame on the active step is ignored', () => {
  const b = bridge();
  b.context.document.activeElement = { tagName: 'BODY' };
  b.send(b.activeWin, 'j');
  assert.equal(b.calls.length, 0);
});

test('keys that change views, open tools, or write state are never replayed', () => {
  const b = bridge();
  for (const key of ['?', '/', 'c', 'C', 'b', 'v', 'V', 'n', 'p', '[', ']', 'Escape', 'Tab', 'Enter', 'ArrowUp', 'Home', 'constructor', 'toString', '__proto__']) b.send(b.activeWin, key);
  assert.equal(b.calls.length, 0);
});

test('an unknown window or malformed message is ignored', () => {
  const b = bridge();
  b.send({ name: 'stranger' }, 'j');
  b.context.onConceptFrameMessage({ source: b.activeWin, data: { type: 'other', key: 'j' } });
  b.context.onConceptFrameMessage({ source: b.activeWin, data: { type: 'diffstory:key', key: 7 } });
  b.context.onConceptFrameMessage({ source: b.activeWin, data: null });
  assert.equal(b.calls.length, 0);
});

test('a forged key code cannot turn an allowed key into another shortcut', () => {
  const b = bridge();
  b.send(b.activeWin, 'j', { code: 'Space' });
  b.send(b.activeWin, ' ', { code: 'KeyC' });
  assert.deepEqual(b.calls.map((e) => [e.key, e.code]), [['j', ''], [' ', 'Space']]);
});

test('the engine accepts exactly the keys the page shim forwards', async () => {
  const { CONCEPT_PAGE_KEYS } = await import('../dist/concept-page.js');
  const context = vm.createContext({});
  vm.runInContext(keysDecl, context);
  assert.deepEqual([...context.CONCEPT_FRAME_KEYS], [...CONCEPT_PAGE_KEYS]);
});
