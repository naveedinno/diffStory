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

test('attrs helpers escape file paths', () => {
  assert.match(rowAttrs({ side: 'right', file: 'a"b.ts', line: 1 }), /data-file="a&quot;b\.ts"/);
  assert.match(targetAttrs({ side: 'left', file: '<x>.ts', line: 2 }), /data-comment-file="&lt;x&gt;\.ts"/);
});
