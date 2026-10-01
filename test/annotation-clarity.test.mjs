// Logic-move annotations must explain a change, not compete with it: one label
// per move, arrows that only cross the divider, callouts beside their box, and
// word marks that name the real clause even when a statement was reflowed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { diffLineTokens, runSides, intraLineMap } from '../dist/intra-line.js';

const engine = readFileSync(new URL('../client/surfaces/review/engine/review-engine.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../client/surfaces/review/review.css', import.meta.url), 'utf8');
const fn = (name) => engine.match(new RegExp('  function ' + name + '\\([^]*?\\n  }'))?.[0];

/** The marked spans of a highlighted line, as `[text]`, with markup removed. */
const marked = (html) =>
  html
    .replace(/<span class="[^"]*changed[^"]*"[^>]*>([^<]*)<\/span>/g, '[$1]')
    .replace(/<[^>]+>/g, '')
    .replace(/\]\[/g, '')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .trim();

const OLD_CANCEL = 'bool cancellable = paused || block.timestamp >= state.expiry || block.timestamp >= uint256(state.auctionOpenedAt) + state.auctionTimeout;';
const NEW_CANCEL = 'bool cancellable = paused || block.timestamp >= uint256(state.auctionOpenedAt) + state.auctionTimeout;';

test('a removed clause is marked as one whole expression, not a span straddling two comparisons', () => {
  const diff = diffLineTokens(OLD_CANCEL, NEW_CANCEL);
  assert.ok(diff);
  assert.equal(
    marked(diff.left),
    'bool cancellable = paused || [block.timestamp >= state.expiry ||] block.timestamp >= uint256(state.auctionOpenedAt) + state.auctionTimeout;',
  );
  assert.doesNotMatch(diff.right, /changed/);
});

test('a slide never cuts a member access or a two-character operator', () => {
  const diff = diffLineTokens('f(a.b, a.b, c);', 'f(a.b, c);');
  assert.ok(diff);
  const left = marked(diff.left);
  assert.match(left, /\[a\.b,\]|\[, a\.b\]/, left);
});

test('a statement reflowed from four lines into one marks only the clause that changed', () => {
  const before = [
    '        if (',
    '            state.phase == Phase.Auction &&',
    '            (paused || block.timestamp >= state.expiry || block.timestamp >= uint256(state.auctionOpenedAt) + state.auctionTimeout)',
    '        ) return;',
  ];
  const after = ['        if (state.phase == Phase.Auction && (paused || block.timestamp >= uint256(state.auctionOpenedAt) + state.auctionTimeout)) return;'];
  const { left, right } = runSides(before, after);
  assert.equal(left.length, 4);
  assert.equal(marked(left[0]), 'if (');
  assert.equal(marked(left[1]), 'state.phase == Phase.Auction &&');
  assert.match(marked(left[2]), /^\(paused \|\| \[block\.timestamp >= state\.expiry \|\|\] block\.timestamp/);
  assert.equal(marked(left[3]), ') return;');
  assert.doesNotMatch(right[0], /changed/, 'nothing was added');
  assert.match(right[0], /data-vscode-column="13"[^>]*>state</, 'after-side columns count from the start of the line');
});

test('equal-length runs still pair line by line', () => {
  const { left, right } = runSides(['a = foo(1);', 'b = 2;'], ['a = bar(1);', 'b = 3;']);
  assert.equal(marked(left[0]), 'a = [foo](1);');
  assert.equal(marked(right[1]), 'b = [3];');
});

test('intraLineMap marks every row of a reflowed run', () => {
  const rows = [
    { type: 'del', content: 'foo(' },
    { type: 'del', content: '  a, b' },
    { type: 'del', content: ');' },
    { type: 'add', content: 'foo(a, c);' },
  ];
  const map = intraLineMap(rows, (r) => r.type, (r) => r.content);
  assert.equal(marked(map.get(rows[1]).left), 'a, [b]');
  assert.equal(marked(map.get(rows[3]).right), 'foo(a, [c]);');
});

test('each move draws one label, on the before box when it is on screen', () => {
  const context = vm.createContext({});
  vm.runInContext(
    ['annotationRound', 'annotationTagWidth', 'annotationBox', 'annotationArrow', 'annotationTagEndpoint', 'computeAnnotations'].map(fn).join('\n'),
    context,
  );
  const run = (top) => ({ top, bottom: top + 40, left: 0, right: 600 });
  const geom = { gutterLeft: 600, gutterRight: 632, width: 1232, height: 400 };
  const spec = {
    moves: [
      { id: 'a', kind: 'condition-changed', tag: 'expiry exit removed', before: { local: true }, after: { local: true }, arrow: true },
      { id: 'b', kind: 'moved', tag: 'new home', before: { local: false }, after: { local: true }, arrow: false },
    ],
  };
  const regions = { 'a:before': [run(0)], 'a:after': [{ ...run(0), left: 632, right: 1232 }], 'b:after': [{ ...run(100), left: 632, right: 1232 }] };
  const shapes = context.computeAnnotations(spec, regions, geom);
  assert.deepEqual(
    JSON.parse(JSON.stringify(shapes.tags.map((t) => [t.id, t.side]))),
    [['a', 'left'], ['b', 'right']],
  );
  const arrow = shapes.arrows.find((a) => a.id === 'a');
  assert.ok(arrow.d.startsWith('M600,'), 'the arrow leaves from the before cell edge');
  assert.equal(arrow.head.x, 632, 'and ends at the after cell edge, past no line number');
});

test('annotation boxes wrap whole cells and the twin row keeps its label space outside the box', () => {
  assert.match(fn('annotationRuns'), /selector=side==='left'\?'\.ds-cell-l':'\.ds-cell-r'/);
  assert.match(css, /\.ds-row\[data-annot-tag-lanes\]:not\(\[data-annot-tag-here\]\)>\.ds-cell\{margin-top:var\(--ds-annot-tag-space,0px\)\}/);
  assert.match(fn('prepareAnnotationTagLanes'), /flowTrackTwin\(body,entry\.row\)/);
});

test('a move callout sits right under the box it explains', () => {
  const context = vm.createContext({});
  vm.runInContext(fn('flowEntries'), context);
  const row = (ri, change) => ({ ri, change });
  // ctx | del 17–20 | add 22 + its callout | ctx
  const L = [row(0, false), row(1, true), row(2, true), row(3, true), row(4, true), row(6, false)];
  const R = [row(0, false), row(5, true), { ri: null, change: false, callout: true }, row(6, false)];
  const shape = JSON.parse(JSON.stringify(context.flowEntries(L, R).map((e) => [e.l && e.l.ri, e.r && (e.r.callout ? 'callout' : e.r.ri)])));
  assert.deepEqual(shape, [[0, 0], [1, 5], [2, 'callout'], [3, null], [4, null], [6, 6]]);
});

test('a block boxed on both sides gets no tinted band under its arrow; one-sided bands fade', () => {
  assert.match(engine, /if\(b\.annotL&&b\.annotR\)return;/);
  assert.match(fn('bandFade'), /linearGradient/);
  assert.match(css, /\.ds-band-stop-add\{stop-color:var\(--add-rail\)\}/);
});

test('annotated lines scroll with their pane instead of wrapping', () => {
  assert.doesNotMatch(css, /\.ds-row\[data-move\] \.ds-code\{[^}]*(pre-wrap|transform:none)/);
});

test('a consequence callout reads as an explanation, not a new hazard', () => {
  const rule = css.match(/\.ds-annot-callout-consequence\{[^}]*\}/)?.[0] ?? '';
  assert.match(rule, /--accent-blue/);
  assert.doesNotMatch(rule, /--diff-del-text/);
});
