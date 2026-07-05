// Unit tests for the shared diff-row renderer. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderUnifiedRow, renderSplitRow, renderHunkGap, rowAttrs, targetAttrs } from '../dist/diff-render.js';

test('unified add row carries anchors, sign, and tint class', () => {
  const html = renderUnifiedRow(
    { type: 'add', no: 3, content: 'const x = 1;' },
    { side: 'right', file: 'a.ts', line: 3 },
  );
  assert.match(html, /^<div class="ds-urow ds-row-add" data-file="a\.ts" data-line="3" data-side="right">/);
  assert.match(html, /<span class="ds-no">3<\/span>/);
  assert.match(html, /<span class="ds-sign ds-sign-add">\+<\/span>/);
  assert.match(html, /data-comment-file="a\.ts" data-comment-line="3"/);
});

test('unified untoured row is flagged UNEXPLAINED', () => {
  const html = renderUnifiedRow({ type: 'add', no: 1, content: 'x', untoured: true });
  assert.match(html, /is-untoured/);
  assert.match(html, /UNEXPLAINED/);
});

test('unified del row carries the minus sign and an old-side anchor', () => {
  const html = renderUnifiedRow(
    { type: 'del', no: 7, content: 'gone();' },
    { side: 'left', file: 'a.ts', line: 7 },
  );
  assert.match(html, /^<div class="ds-urow ds-row-del" data-file="a\.ts" data-line="7" data-side="left">/);
  assert.match(html, /<span class="ds-sign ds-sign-del">−<\/span>/);
  assert.match(html, /data-comment-side="left" data-comment-file="a\.ts" data-comment-line="7"/);
});

test('split ctx row renders both cells with line numbers', () => {
  const html = renderSplitRow(
    { type: 'ctx', oldNo: 4, newNo: 5, content: 'same' },
    {
      leftTarget: { side: 'left', file: 'a.ts', line: 4 },
      rightTarget: { side: 'right', file: 'a.ts', line: 5 },
    },
  );
  assert.match(html, /^<div class="ds-row ds-row-ctx" data-file="a\.ts" data-line="5" data-side="right">/);
  assert.match(html, /ds-cell-l/);
  assert.match(html, /ds-celldiv/);
  assert.match(html, /ds-cell-r/);
});

test('split add row leaves the left cell empty and tints the right', () => {
  const html = renderSplitRow(
    { type: 'add', newNo: 9, content: 'added' },
    { rightTarget: { side: 'right', file: 'b.ts', line: 9 } },
  );
  assert.match(html, /ds-cell-empty ds-cell-l/);
  assert.match(html, /ds-cell-add/);
});

test('single-cell mode (context/new-file steps) renders one cell', () => {
  const html = renderSplitRow(
    { type: 'add', newNo: 1, content: 'new' },
    { rightTarget: { side: 'right', file: 'c.ts', line: 1 }, single: true },
  );
  assert.match(html, /ds-cell-single/);
  assert.doesNotMatch(html, /ds-celldiv/);
});

test('focus index is emitted only when set', () => {
  const withFocus = renderSplitRow({ type: 'ctx', oldNo: 1, newNo: 1, content: 'x' }, { focusIndex: 2 });
  const without = renderSplitRow({ type: 'ctx', oldNo: 1, newNo: 1, content: 'x' }, { focusIndex: null });
  assert.match(withFocus, /data-step-focus="2"/);
  assert.doesNotMatch(without, /data-step-focus/);
});

test('bare hunk gap matches the legacy markup exactly', () => {
  assert.equal(renderHunkGap(), '<div class="ds-hunkgap"><span>⋯</span></div>');
});

test('split hunk gap keeps the middle control on the split divider', () => {
  const html = renderHunkGap({ file: 'a.ts', from: 10, to: 30 }, { split: true });
  assert.match(html, /^<div class="ds-hunkgap is-expandable ds-hunkgap-split"/);
  assert.match(html, /<span class="ds-gap-side ds-gap-side-l">/);
  assert.match(html, /<span class="ds-gap-mid"><button type="button" class="ds-gapbtn" data-expand="all"/);
  assert.match(html, /<span class="ds-gap-side ds-gap-side-r">/);
});

test('bare split hunk gap uses the split divider scaffold', () => {
  const html = renderHunkGap(undefined, { split: true });
  assert.match(html, /^<div class="ds-hunkgap ds-hunkgap-split">/);
  assert.match(html, /<span class="ds-gap-mid"><span>⋯<\/span><\/span>/);
  assert.doesNotMatch(html, /data-gap/);
});

test('attrs helpers escape file paths', () => {
  assert.match(rowAttrs({ side: 'right', file: 'a"b.ts', line: 1 }), /data-file="a&quot;b\.ts"/);
  assert.match(targetAttrs({ side: 'left', file: '<x>.ts', line: 2 }), /data-comment-file="&lt;x&gt;\.ts"/);
});

test('interactive hunk gap carries range data and expand buttons', () => {
  const html = renderHunkGap({ file: 'a.ts', from: 10, to: 30 });
  assert.match(html, /data-gap /);
  assert.match(html, /data-gap-file="a\.ts"/);
  assert.match(html, /data-gap-from="10"/);
  assert.match(html, /data-gap-to="30"/);
  assert.match(html, /data-expand="down"/);
  assert.match(html, /data-expand="all"/);
  assert.match(html, /data-expand="up"/);
});

test('eof gap omits the up button', () => {
  const html = renderHunkGap({ file: 'a.ts', from: 50, to: 'eof' });
  assert.match(html, /data-gap-to="eof"/);
  assert.doesNotMatch(html, /data-expand="up"/);
});
