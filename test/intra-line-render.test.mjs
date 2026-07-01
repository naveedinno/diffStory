// Integration: the renderers actually emit intra-line `changed` marks. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFullFile } from '../dist/render.js';
import { renderDiffFullBody } from '../dist/diff-view.js';

const rows = [
  { type: 'del', oldNo: 1, content: 'const total = computeFee(x);' },
  { type: 'add', newNo: 1, content: 'const total = computeCost(x);' },
];

test('side-by-side (render.ts cell) marks only the changed token', () => {
  const html = renderFullFile(rows, { file: 'a.ts', newFile: false });
  assert.match(html, /changed">computeCost/); // added side
  assert.match(html, /changed">computeFee/); // removed side
  assert.doesNotMatch(html, /changed">total/); // shared prefix untouched
  assert.doesNotMatch(html, /changed">x/); // shared arg untouched
});

test('unified viewer (diff-view.ts rowHtml) marks only the changed token', () => {
  const html = renderDiffFullBody(rows);
  assert.match(html, /changed">computeCost/);
  assert.match(html, /changed">computeFee/);
  assert.doesNotMatch(html, /changed">total/);
});

test('a fully rewritten line falls back to whole-line highlight (no changed marks)', () => {
  const rewritten = [
    { type: 'del', oldNo: 1, content: 'let x = 1;' },
    { type: 'add', newNo: 1, content: 'return doSomethingElse(payload, config);' },
  ];
  const html = renderFullFile(rewritten, { file: 'a.ts', newFile: false });
  assert.doesNotMatch(html, /class="[^"]*changed/);
});
