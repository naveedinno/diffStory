import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupSkimRuns } from '../client/surfaces/review/skim.js';
import { validateTour } from '../dist/tour.js';
import { buildReviewModel } from '../dist/view-model.js';

const ENGINE = readFileSync(
  new URL('../client/surfaces/review/engine/review-engine.js', import.meta.url),
  'utf8',
);
const RENDER = readFileSync(new URL('../src/render.ts', import.meta.url), 'utf8');
const SIDEBAR = readFileSync(
  new URL('../client/surfaces/review/Sidebar.tsx', import.meta.url),
  'utf8',
);

function weightTour(weights) {
  return {
    version: 4,
    title: 'Weight story',
    summary: 'summary',
    steps: weights.map((weight, i) => ({
      id: `s${i + 1}`,
      order: i + 1,
      title: `Step ${i + 1}`,
      kind: 'changed',
      file: 'a.ts',
      range: [1, 2],
      why: 'because',
      ...(weight === undefined ? {} : { weight }),
    })),
  };
}

test('weight is an optional must-or-skim enum on every step', () => {
  assert.deepEqual(validateTour(weightTour([undefined, 'must', 'skim'])), []);
  const errors = validateTour(weightTour(['must', 'sometimes'])).join('\n');
  assert.ok(errors.includes('steps[1].weight must be "must" or "skim"'));
});

test('the view model resolves an absent weight to must', () => {
  const model = buildReviewModel('/repo', weightTour([undefined, 'skim', 'must']), []);
  assert.deepEqual(
    model.steps.map((s) => s.weight),
    ['must', 'skim', 'must'],
  );
});

test('groupSkimRuns collapses runs of 2+ and keeps lone steps as cards', () => {
  const step = (weight) => ({ id: weight, weight });
  const items = ['must', 'skim', 'skim', 'skim', 'must', 'skim', 'must'].map((weight, index) => ({
    step: step(weight),
    index,
  }));
  const groups = groupSkimRuns(items);
  assert.equal(groups.length, 5);
  assert.equal(groups[0].kind, 'step');
  assert.equal(groups[1].kind, 'run');
  assert.deepEqual(
    groups[1].steps.map((s) => s.index),
    [1, 2, 3],
  );
  assert.equal(groups[2].kind, 'step');
  assert.equal(groups[3].kind, 'step', 'a lone skim step stays a card');
  assert.equal(groups[3].index, 5);
  assert.equal(groups[4].kind, 'step');
  assert.deepEqual(groupSkimRuns([]), []);
});

test('panels and rail nodes carry the weight for the engine and CSS', () => {
  assert.equal(
    (RENDER.match(/data-step-weight="\$\{s\.weight\}"/g) || []).length,
    3,
    'code + legacy concept + page concept panels',
  );
  assert.ok(SIDEBAR.includes('data-weight={step.weight}'), 'rail cards carry weight');
  assert.ok(SIDEBAR.includes('ds-railskim'), 'skim runs collapse into disclosures');
  assert.ok(SIDEBAR.includes('data-must-only-toggle'), 'must-read-only toggle exists');
});

test('sequential walking and narration skip skim stops in must-only mode', () => {
  assert.ok(ENGINE.includes('function mustOnlyStep('), 'j/k walks through the skip helper');
  assert.ok(ENGINE.includes('setActive(mustOnlyStep(active,'), 'keyboard advance skips');
  assert.ok(ENGINE.includes('focusStoryStepBoundary(mustOnlyStep('), 'beat-boundary focus skips');
  assert.ok(ENGINE.includes('function speakablePanel('), 'narration funnels through one check');
  assert.ok(ENGINE.includes('if(!manual&&mustOnly()&&isSkimPanel('), 'play-story skips skim');
  assert.ok(
    ENGINE.includes("data-step-weight')==='skim'"),
    'skim is read off the panel attribute',
  );
});
