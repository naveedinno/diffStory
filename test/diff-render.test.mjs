// Unit tests for the shared diff-row renderer. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFF_CSS } from '../dist/diff-assets.js';
import { renderUnifiedRow, renderSplitRow, renderHunkGap, rowAttrs, targetAttrs } from '../dist/diff-render.js';

function cssRuleBody(css, selector) {
  const start = css.indexOf(`${selector}{`);
  assert.notEqual(start, -1, `missing ${selector} rule`);
  const bodyStart = start + selector.length + 1;
  return css.slice(bodyStart, css.indexOf('}', bodyStart));
}

test('unified add row carries anchors, sign, and tint class', () => {
  const html = renderUnifiedRow(
    { type: 'add', no: 3, content: 'const x = 1;' },
    { side: 'right', file: 'a.ts', line: 3 },
  );
  assert.match(html, /^<div class="ds-urow ds-row-add" data-file="a\.ts" data-line="3" data-side="right"/);
  assert.match(html, /data-review-row role="group" tabindex="-1"/);
  assert.match(html, /aria-label="Added after line 3 in a\.ts: const x = 1;"/);
  assert.match(html, /<span class="ds-no">3<\/span>/);
  assert.match(html, /<span class="ds-sign ds-sign-add">\+<\/span>/);
  assert.match(html, /data-comment-file="a\.ts" data-comment-line="3"/);
  assert.match(html, /data-vscode-symbol data-vscode-column="7"[^>]*>x<\/span>/);
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
  assert.match(html, /^<div class="ds-urow ds-row-del" data-file="a\.ts" data-line="7" data-side="left"/);
  assert.match(html, /aria-label="Deleted before line 7 in a\.ts: gone\(\);"/);
  assert.match(html, /<span class="ds-sign ds-sign-del">−<\/span>/);
  assert.match(html, /data-comment-side="left" data-comment-file="a\.ts" data-comment-line="7"/);
  assert.doesNotMatch(html, /data-vscode-symbol/);
});

test('split ctx row renders both cells with line numbers', () => {
  const html = renderSplitRow(
    { type: 'ctx', oldNo: 4, newNo: 5, content: 'same' },
    {
      leftTarget: { side: 'left', file: 'a.ts', line: 4 },
      rightTarget: { side: 'right', file: 'a.ts', line: 5 },
    },
  );
  assert.match(html, /^<div class="ds-row ds-row-ctx" data-file="a\.ts" data-line="5" data-side="right"/);
  assert.match(html, /aria-label="Context after line 5 in a\.ts: same"/);
  assert.match(html, /ds-cell-l/);
  assert.match(html, /<span class="ds-celldiv" aria-hidden="true"><\/span>/);
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

test('semantic diff text uses dedicated accessible ink tokens in every diff mode', () => {
  assert.match(cssRuleBody(DIFF_CSS, '.ds-diffhead-label.ds-green'), /color:var\(--diff-add-text\)/);
  assert.match(cssRuleBody(DIFF_CSS, '.ds-sign-add'), /color:var\(--diff-add-text\)/);
  assert.match(cssRuleBody(DIFF_CSS, '.ds-sign-del'), /color:var\(--diff-del-text\)/);
  assert.match(cssRuleBody(DIFF_CSS, '.ds-code-add'), /color:var\(--diff-add-text\)/);
  assert.match(cssRuleBody(DIFF_CSS, '.ds-code-del'), /color:var\(--diff-del-text\)/);
});

test('story focus keeps every code row readable without boxing each focused row', () => {
  assert.doesNotMatch(DIFF_CSS, /\.ds-step\.is-code-step\.is-story-active[^{]*\{[^}]*opacity:/);

  const splitFocus = cssRuleBody(DIFF_CSS, '.ds-row.is-story-focus');
  assert.match(splitFocus, /inset 3px 0 0 var\(--accent-blue\)/);
  assert.doesNotMatch(splitFocus, /inset 0 -?1px 0 var\(--accent-line\)/);
  assert.match(cssRuleBody(DIFF_CSS, '.ds-row.is-story-focus .ds-cell:not(.ds-cell-empty)'), /background-image:linear-gradient/);

  const unifiedFocus = cssRuleBody(DIFF_CSS, '.ds-urow.is-story-focus');
  assert.match(unifiedFocus, /inset 3px 0 0 var\(--accent-blue\)/);
  assert.doesNotMatch(unifiedFocus, /inset 0 -?1px 0 var\(--accent-line\)/);
  assert.match(unifiedFocus, /background-image:linear-gradient/);
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

test('review-row accessible names escape code and file content', () => {
  const html = renderUnifiedRow(
    { type: 'add', no: 1, content: 'if (a < b) return "yes";' },
    { side: 'right', file: 'src/a&b.ts', line: 1 },
  );
  assert.match(html, /aria-label="Added after line 1 in src\/a&amp;b\.ts: if \(a &lt; b\) return &quot;yes&quot;;"/);
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
  assert.match(html, /aria-label="Show the first 20 hidden lines"/);
  assert.match(html, /aria-label="Show all hidden lines"/);
  assert.match(html, /aria-label="Show the last 20 hidden lines"/);
});

test('eof gap omits the up button', () => {
  const html = renderHunkGap({ file: 'a.ts', from: 50, to: 'eof' });
  assert.match(html, /data-gap-to="eof"/);
  assert.doesNotMatch(html, /data-expand="up"/);
});
