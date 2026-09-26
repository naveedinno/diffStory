import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
