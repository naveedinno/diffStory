import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGeneratedTour } from '../dist/tour.js';
import { lintStory } from '../dist/story-lint.js';
import { storyHealth } from '../dist/story-health.js';
import { buildReviewModel } from '../dist/view-model.js';
import { renderReviewShell } from '../dist/render.js';
import { parseUnifiedDiff } from '../dist/diff.js';
import {
  MAX_HEALTH_ROWS,
  capHealthRows,
} from '../client/surfaces/review/engine/health-cap.js';

function bigStep(i) {
  const line = 10 + (i % 40) * 20;
  return {
    id: `s${i}`,
    order: i,
    title: `Change number ${i} in the module`,
    kind: 'changed',
    file: `src/part${i % 12}.ts`,
    range: [line, line + 4],
    viewport: [line - 10, line + 14],
    highlights: [[line, line + 2], [line + 3, line + 4]],
    why: `This adjusts behavior ${i} so the caller sees consistent state.`,
    beats: [
      { text: `First the guard at the top shifts for case ${i}.`, highlights: [[line, line + 2]] },
      { text: `Then the body below follows for case ${i}.`, highlights: [[line + 3, line + 4]] },
    ],
  };
}

function bigTour(steps = 300) {
  return {
    version: 4,
    title: 'Big story',
    summary: 'summary',
    steps: Array.from({ length: steps }, (_, i) => bigStep(i + 1)),
  };
}

test('a 300-step story renders its review page inside a generous budget', () => {
  const tour = bigTour();
  const body = Array.from(
    { length: 3000 },
    (_, i) => `${i % 3 === 0 ? '+' : ' '}const value${i} = compute(${i}, options);`,
  ).join('\n');
  const files = parseUnifiedDiff(
    `diff --git a/big.ts b/big.ts\n--- a/big.ts\n+++ b/big.ts\n@@ -1,2000 +1,3000 @@\n${body}\n`,
  );
  // Observed ~65ms on a laptop; the budget only has to catch a future
  // quadratic regression, not to bless this exact number.
  const BUDGET_MS = 5000;
  const t0 = performance.now();
  validateGeneratedTour(tour);
  lintStory(tour);
  storyHealth(tour);
  const model = buildReviewModel('/repo', tour, []);
  assert.equal(model.steps.length, 300);
  const shell = renderReviewShell({ repo: '/tmp', tour, files, baseLabel: 'main', comments: [] });
  assert.ok(shell.length > 100_000, 'the page carries the story');
  const ms = performance.now() - t0;
  assert.ok(ms < BUDGET_MS, `300-step review page took ${ms.toFixed(0)}ms, budget ${BUDGET_MS}ms`);
});

test('health sections cap at ten rows and name the remainder', () => {
  assert.equal(MAX_HEALTH_ROWS, 10);
  const rows = Array.from({ length: 25 }, (_, i) => ({ where: `w${i}` }));
  const capped = capHealthRows(rows);
  assert.equal(capped.shown.length, 10);
  assert.equal(capped.rest, 15);
  assert.equal(rows.length, 25, 'the input is never mutated');
  const short = capHealthRows(rows.slice(0, 4));
  assert.deepEqual(
    short,
    { shown: rows.slice(0, 4), rest: 0 },
    'a short section renders whole with no remainder',
  );
  assert.deepEqual(capHealthRows(undefined), { shown: [], rest: 0 });
  assert.deepEqual(capHealthRows(rows, 0), { shown: [], rest: 25 });
});
