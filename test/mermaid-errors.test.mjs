// A Mermaid parse failure must name its error and its line inside the step,
// not collapse to a blank box — and it must reach the story-health row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  diagramErrorLine,
  diagramErrorSummary,
} from '../client/surfaces/review/engine/diagram-errors.js';

const ENGINE = readFileSync(
  new URL('../client/surfaces/review/engine/review-engine.js', import.meta.url),
  'utf8',
);

test('diagramErrorSummary keeps the first useful line and caps length', () => {
  assert.equal(
    diagramErrorSummary(new Error('Parse error on line 3:\n  foo bar\nExpecting EOF')),
    'Parse error on line 3:',
  );
  assert.equal(diagramErrorSummary(new Error('\n  \nReal cause here')), 'Real cause here');
  assert.equal(diagramErrorSummary(null), 'The diagram source could not be parsed.');
  assert.equal(diagramErrorSummary({}), 'The diagram source could not be parsed.');
  const long = 'x'.repeat(500);
  const capped = diagramErrorSummary(new Error(long));
  assert.equal(capped.length, 278);
  assert.ok(capped.endsWith('…'));
});

test('diagramErrorLine resolves the offending source line', () => {
  const source = 'graph TD\n  A[O(1)] --> B\n  B --> C';
  assert.deepEqual(diagramErrorLine('Parse error on line 2:', source), {
    line: 2,
    text: '  A[O(1)] --> B',
  });
  assert.equal(diagramErrorLine('something else entirely', source), null);
  assert.equal(diagramErrorLine('Parse error on line 9:', source), null);
  assert.equal(diagramErrorLine('Parse error on line 0:', source), null);
});

test('the engine renders parse failures as an error box, not a blank box', () => {
  assert.ok(ENGINE.includes("from './diagram-errors'"), 'engine imports the helpers');
  assert.ok(ENGINE.includes('ds-mermaid-error'), 'engine builds an error box');
  assert.ok(ENGINE.includes('data-diagram-error'), 'figure carries the error for queries');
  assert.ok(
    ENGINE.includes('ds-diagram-error'),
    'engine dispatches a health-row event on failure',
  );
  assert.ok(
    !ENGINE.includes('Its caption and source are preserved below.'),
    'the generic silent message is gone',
  );
});
