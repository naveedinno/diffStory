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
      why: 'I changed this line so the next helper receives the value it needs.',
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

test('rail step numbers stay stable after visiting steps', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /c\.classList\.toggle\('is-visited',isV\)/);
  assert.match(html, /num\.textContent=String\(idx\)/);
  assert.doesNotMatch(html, /isD\?'✓'/);
});

test('step narrative is labeled as story, not why-this-step', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, />Story<\/span>/);
  assert.doesNotMatch(html, /Why this step/);
});

test('read aloud operators have distinct visual and speech profiles', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /story:\{rate:1\.24,pitch:1\.16,volume:1\}/);
  assert.match(html, /warm:\{rate:0\.72,pitch:1\.30,volume:1\}/);
  assert.match(html, /reviewer:\{rate:0\.66,pitch:0\.72,volume:1\}/);
  assert.match(html, /system:\{rate:1\.42,pitch:0\.94,volume:1\}/);
  assert.match(html, /function voiceSlot\(pool,idx\)/);
  assert.match(html, /if\(op==='warm'\).*voiceSlot\(pool,1\)/s);
  assert.match(html, /if\(op==='reviewer'\).*voiceSlot\(pool,2\)/s);
  assert.match(html, /button\[data-operator="warm"\]\.is-active/);
  assert.match(html, /button\[data-operator="reviewer"\]\.is-active/);
});

test('read aloud starts on a speakable story step and falls back safely', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /function firstSpeakableStep\(\)/);
  assert.match(html, /if\(!speakStep\(active\)\)\{var si=firstSpeakableStep\(\);if\(si>=0\)setActive\(si\);\}/);
  assert.match(html, /u\.onerror=function\(\)\{if\(btn\)btn\.classList\.remove\('is-speaking'\);if\(!fallback\)speak\(text,true\);\}/);
  assert.match(html, /catch\(e\)\{if\(!fallback\)return speak\(text,true\);return false;\}/);
});
