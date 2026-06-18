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

test('read aloud uses a voice dock with distinct preset cards', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /data-voice-preset="story"/);
  assert.match(html, /data-voice-preset="flirty"/);
  assert.match(html, /data-voice-preset="bass"/);
  assert.match(html, /data-voice-preset="system"/);
  assert.match(html, /Female, playful, warmer delivery\./);
  assert.match(html, /Male preference with deeper pitch\./);
  assert.match(html, /\.ds-voice-grid/);
  assert.match(html, /\.ds-voice-card\[data-voice-preset="flirty"\]/);
  assert.match(html, /\.ds-voice-card\[data-voice-preset="bass"\]/);
});

test('read aloud presets have explicit voice preferences and samples', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /flirty:\{[^}]*rate:0\.88,pitch:1\.42,volume:1/s);
  assert.match(html, /bass:\{[^}]*rate:0\.66,pitch:0\.48,volume:1/s);
  assert.match(html, /prefer:\[\/ava\/,\/samantha\/,\/serena\/,\/victoria\/,\/karen\/,\/moira\/,\/tessa\/,\/zira\/,\/jenny\/,\/aria\/,\/female\/\]/);
  assert.match(html, /prefer:\[\/alex\/,\/daniel\/,\/tom\/,\/david\/,\/mark\/,\/guy\/,\/brian\/,\/bruce\/,\/reed\/,\/fred\/,\/ralph\/,\/male\/\]/);
  assert.match(html, /sample:'Flirty mode\./);
  assert.match(html, /sample:'Bass mode\./);
  assert.match(html, /function pickVoice\(presetName\)/);
  assert.match(html, /voiceScore\(b,presetName\)-voiceScore\(a,presetName\)/);
});

test('read aloud start stop and preview are controlled by one speech state', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /function firstSpeakableStep\(\)/);
  assert.match(html, /function cancelSpeech\(\)/);
  assert.match(html, /activeUtterance=null/);
  assert.match(html, /function updateReadAloudButton\(\)/);
  assert.match(html, /label\.textContent=readAloud\?'Stop':'Read aloud'/);
  assert.match(html, /function restartReadAloud\(\)/);
  assert.match(html, /function speakVoicePreview\(\)/);
  assert.match(html, /readAloud=false;\n    try\{localStorage\.setItem\('ds-readaloud',''\);\}catch\(e\)\{\}/);
  assert.match(html, /b=closest\(t,'\[data-preview-voice\]'\);if\(b\)\{speakVoicePreview\(\);return;\}/);
});

test('read aloud preset switch migrates old modes and restarts active reading', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /function normalizePreset\(p\)/);
  assert.match(html, /if\(p==='warm'\|\|p==='flirty'\)return 'flirty'/);
  assert.match(html, /if\(p==='precise'\|\|p==='reviewer'\|\|p==='bass'\)return 'bass'/);
  assert.match(html, /localStorage\.getItem\('ds-voice-preset'\)\|\|localStorage\.getItem\('ds-operator'\)/);
  assert.match(html, /else if\(readAloud\)restartReadAloud\(\)/);
  assert.match(html, /if\(readAloud\)restartReadAloud\(\)/);
});
