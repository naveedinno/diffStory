import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const engine = readFileSync(new URL('../client/surfaces/review/engine/review-engine.js', import.meta.url), 'utf8');
const fn = (name) => engine.match(new RegExp('  function ' + name + '\\([^]*?\\n  }'))?.[0];

test('scrolling an insertion never translates either code column', () => {
  let top = 0;
  const flow = {
    scroller: { clientHeight: 400, getBoundingClientRect: () => ({ top: 0 }) },
    l: { style: {} }, r: { style: {} }, height: 1600,
    colH: { l: 800, r: 1600 },
    entries: [
      { t: 0, h: 200, l: { y: 0, h: 200 }, r: { y: 0, h: 200 } },
      { t: 200, h: 800, r: { y: 200, h: 800 } },
      { t: 1000, h: 600, l: { y: 200, h: 600 }, r: { y: 1000, h: 600 } },
    ],
  };
  const body = { _dsFlow: flow, offsetParent: {}, getBoundingClientRect: () => ({ top: -top }) };
  const context = vm.createContext({ paintFlowBands() {}, shiftAnnotations() {} });
  vm.runInContext(fn('applySplitFlow'), context);
  for (top of [0, 80, 200, 700, 1200, 700, 0]) {
    context.applySplitFlow(body);
    assert.ok(!flow.l.style.transform, `left column moved at scrollTop ${top}: ${flow.l.style.transform}`);
    assert.ok(!flow.r.style.transform, `right column moved at scrollTop ${top}: ${flow.r.style.transform}`);
  }
});

test('a newly mounted split initializes shared rows when Wrap is already enabled', () => {
  let layouts = 0;
  const bars = {};
  const context = vm.createContext({
    $: (selector) => selector.includes('separator') ? null : {},
    document: { body: { classList: { contains: () => true } } },
    ensureSplitPaneScrollbars: () => bars,
    resetSplitPaneScroll() {},
    syncSplitFlow: () => layouts++,
  });
  vm.runInContext(fn('syncSplitPaneLayout'), context);
  context.syncSplitPaneLayout({ classList: { toggle() {} } });
  assert.equal(layouts, 1, 'wrapped rows must be initialized before returning');
  assert.equal(bars.hidden, true);
});

test('a split loaded behind a view transition gets tracks before it becomes visible', () => {
  let layouts = 0;
  const context = vm.createContext({
    visibleDiffRoot: () => ({}), $all: () => [{ offsetParent: null }],
    measureSplitFlow: () => { layouts++; return {}; },
    watchFlow() {}, applySplitFlow() {},
  });
  vm.runInContext(fn('syncSplitFlow'), context);
  context.syncSplitFlow({});
  assert.equal(layouts, 1);
});

test('comment insertion lays out its shared track before revealing the draft', () => {
  const events = [];
  const row = {
    getAttribute: () => '42', classList: { add() {} },
    parentNode: { insertBefore: () => events.push('insert') },
  };
  const context = vm.createContext({
    removeComposer() {}, buildComposer: () => ({}),
    document: { activeElement: {} }, closest: () => ({}), $: () => null,
    syncSplitFlow: () => events.push('layout'), revealComposer: () => events.push('reveal'),
  });
  vm.runInContext(fn('openComposer'), context);
  context.openComposer(row, 'question', {});
  assert.deepEqual(events, ['insert', 'layout', 'reveal']);
});

test('sticky headers preserve fractional heights without exposing a code strip', () => {
  let height;
  const context = vm.createContext({ $: () => ({ getBoundingClientRect: () => ({ height: 38.25 }) }) });
  vm.runInContext(fn('measureChrome'), context);
  context.measureChrome({ style: { setProperty: (_name, value) => { height = value; } } }, '.ds-difftoolbar', '--ds-stickytop');
  assert.equal(height, '38.25px');
});


test('grabbing either edge of a wide divider preserves the split until the pointer moves', () => {
  for (const width of [40, 72]) {
    for (const grab of [0, width / 2, width]) {
      let percentage;
      const available = 1440 - width;
      const body = { getBoundingClientRect: () => ({ left: 10, width: 1440 }) };
      const divider = { getBoundingClientRect: () => ({ left: 10 + available * .25, width }) };
      const holder = { style: { setProperty: (_name, value) => { percentage = Number(value); } } };
      const context = vm.createContext({
        closest: (_node, selector) => selector === '.ds-celldiv' ? divider : selector === '.ds-diffbody' ? body : holder,
        $: () => divider,
        document: { body: { classList: { add() {} } } },
        setSplitDividerValue() {}, scheduleFlow() {}, scheduleAnnotations() {},
      });
      vm.runInContext(fn('startSplit') + '\n' + fn('applySplitResize'), context);
      const clientX = divider.getBoundingClientRect().left + grab;
      context.startSplit({ target: divider, clientX, preventDefault() {} });
      context.applySplitResize(clientX);
      assert.equal(percentage, 25);
      context.applySplitResize(clientX + available * .1);
      assert.ok(Math.abs(percentage - 35) < 1e-8);
    }
  }
});

const item = (ri, change) => ({ ri, change });

test('a replacement lays its deleted and added rows side by side from the same track', () => {
  const context = vm.createContext({});
  vm.runInContext(fn('flowEntries'), context);
  // ctx(0) | del 1,2 | add 3,4,5 | ctx(6)
  const L = [item(0, false), item(1, true), item(2, true), item(6, false)];
  const R = [item(0, false), item(3, true), item(4, true), item(5, true), item(6, false)];
  const shape = JSON.parse(JSON.stringify(context.flowEntries(L, R).map((e) => [e.l && e.l.ri, e.r && e.r.ri])));
  assert.deepEqual(shape, [[0, 0], [1, 3], [2, 4], [null, 5], [6, 6]]);
});

test('pure deletions and a composer between rows keep their own tracks', () => {
  const context = vm.createContext({});
  vm.runInContext(fn('flowEntries'), context);
  const L = [item(0, false), item(1, true), item(null, false), item(2, true), item(3, false)];
  const R = [item(0, false), item(3, false)];
  const shape = JSON.parse(JSON.stringify(context.flowEntries(L, R).map((e) => [e.l && e.l.ri, e.r && e.r.ri])));
  assert.deepEqual(shape, [[0, 0], [1, null], [null, null], [2, null], [3, 3]]);
});

test('the gutter bridge is flat for a one-sided change and curves only where sides differ', () => {
  const context = vm.createContext({});
  vm.runInContext(fn('flowBridgePath'), context);
  // Same extent both sides: a plain rectangle, no curve.
  assert.equal(context.flowBridgePath({ l0: 0, l1: 48, r0: 0, r1: 48 }, 32), 'M0 0.0 C16.0 0.0 16.0 0.0 32 0.0 V48.0 C16.0 48.0 16.0 48.0 0 48.0 Z');
  // Pure deletion: the empty side mirrors the deleted block's extent.
  assert.equal(context.flowBridgePath({ l0: 10, l1: 58, r0: null, r1: null }, 32), context.flowBridgePath({ l0: 10, l1: 58, r0: 10, r1: 58 }, 32));
  // One line became four: flat top, bottom curves from 24 down to 96.
  assert.match(context.flowBridgePath({ l0: 0, l1: 24, r0: 0, r1: 96 }, 32), /^M0 0\.0 C16\.0 0\.0 16\.0 0\.0 32 0\.0 V96\.0 C16\.0 96\.0 16\.0 24\.0 0 24\.0 Z$/);
});

test('empty tracks get an inert hatched filler, reused across re-measures', () => {
  const made = [];
  const col = { children: [], appendChild: (f) => { col.children.push(f); made.push(f); } };
  const filler = () => ({ style: {}, setAttribute() {}, remove() { col.children.splice(col.children.indexOf(this), 1); } });
  const context = vm.createContext({
    $all: () => col.children.slice(),
    el: () => filler(),
  });
  vm.runInContext(fn('syncFlowFillers'), context);
  const row = (cls) => ({ el: { classList: { contains: (c) => c === cls } } });
  const entries = [{ l: row(), r: row() }, { l: null, r: row() }, { l: null, r: row() }, { l: null, r: row('ds-scoperow') }, { l: row(), r: null }];
  context.syncFlowFillers(col, entries, 'l');
  assert.equal(made.length, 2, 'one filler per empty left track, none beside a scope label');
  assert.deepEqual(made.map((f) => f.style.gridRow), ['2', '3']);
  context.syncFlowFillers(col, entries.slice(0, 2), 'l');
  assert.equal(made.length, 2, 'fillers are reused, not recreated');
  assert.equal(col.children.length, 1, 'surplus fillers are removed');
});
