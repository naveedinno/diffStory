// Unit tests for the rendered review page shell. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../dist/render.js';

const tour = {
  version: 1,
  title: 'Tiny tour',
  summary: 'One changed line.',
  steps: [
    {
      id: 's1',
      order: 1,
      title: 'Changed line',
      file: 'a.ts',
      range: [1, 1],
      kind: 'changed',
      why: 'Verify the only changed line.',
    },
  ],
};

const files = [
  {
    oldPath: 'a.ts',
    newPath: 'a.ts',
    status: 'modified',
    hunks: [
      {
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: [{ type: 'add', content: 'next', newNo: 1 }],
      },
    ],
  },
];

test('agent activity console starts hidden and idle', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /<div class="ds-agentconsole" id="ds-agentconsole" hidden aria-live="polite">/);
  assert.match(html, /\.ds-agentconsole\[hidden\]\{display:none\}/);
  assert.match(html, /<span class="ds-ac-spin" aria-hidden="true" hidden><\/span>/);
  assert.match(html, /<span class="ds-ac-title">Agent activity<\/span>/);
});
