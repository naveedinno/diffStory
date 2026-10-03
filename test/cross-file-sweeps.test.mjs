import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGeneratedTour, validateTour } from '../dist/tour.js';
import { computeCoverage } from '../dist/coverage.js';
import { parseUnifiedDiff } from '../dist/diff.js';
import { verifySweeps } from '../dist/story-check.js';
import { buildReviewModel } from '../dist/view-model.js';

function sweepStep(overrides = {}) {
  return {
    id: 'sweep',
    order: 1,
    title: 'Rename the title key everywhere',
    kind: 'changed',
    file: 'src/i18n/en.json',
    range: [2, 2],
    viewport: [1, 5],
    highlights: [[2, 2]],
    beats: [
      {
        text: 'This is the <code>title</code> key in <code>en.json</code>, which the header reads on every render; here it becomes <code>heading</code>.',
        highlights: [[2, 2]],
      },
    ],
    why: 'Every locale file renames the same key the header reads.',
    tags: ['sweep'],
    files: ['src/i18n/*.json'],
    ...overrides,
  };
}

function sweepTour(step) {
  return { version: 4, title: 'Sweep story', summary: 'summary', steps: [step] };
}

function diffFile(path, oldLine, newLine) {
  return [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    '@@ -1,3 +1,3 @@',
    ' {',
    `-${oldLine}`,
    `+${newLine}`,
    ' }',
  ].join('\n');
}

const IDENTICAL = [
  diffFile('src/i18n/en.json', '  "title": "Hello",', '  "heading": "Hello",'),
  diffFile('src/i18n/de.json', '  "title": "Hallo",', '  "heading": "Hallo",'),
].join('\n');

const DIVERGENT = [
  diffFile('src/i18n/en.json', '  "title": "Hello",', '  "heading": "Hello",'),
  diffFile('src/i18n/de.json', '  "title": "Hallo",', '  "headline": "Hallo",'),
  diffFile('src/app.ts', 'const a = 1;', 'const a = 2;'),
].join('\n');

test('a tagged sweep with one matching glob validates', () => {
  assert.deepEqual(validateTour(sweepTour(sweepStep())), []);
  assert.deepEqual(
    validateGeneratedTour(sweepTour(sweepStep())).filter((e) => e.includes('.files')),
    [],
  );
});

test('sweep shape errors name the broken field', () => {
  for (const [files, problem] of [
    [['a/*.json', 'b/*.json'], 'exactly one glob'],
    ['a/*.json', 'one glob'],
    [[], 'exactly one glob'],
    [['../*.json'], 'safe repository-relative glob'],
    [['src/other/*.json'], 'must match its sweep glob'],
  ]) {
    const errors = validateTour(sweepTour(sweepStep({ files }))).join('\n');
    assert.ok(errors.includes(problem), `${JSON.stringify(files)} → ${errors}`);
  }
  const context = sweepStep({ kind: 'context', files: ['src/i18n/*.json'] });
  delete context.range;
  assert.ok(
    validateTour(sweepTour(context))
      .join('\n')
      .includes('.files is not allowed for a context step'),
  );
  const untagged = sweepStep({ tags: ['core'] });
  assert.ok(
    validateGeneratedTour(sweepTour(untagged))
      .join('\n')
      .includes('.files requires a "skim", "sweep", or "mechanical" tag'),
  );
});

test('coverage claims every matched file from one representative step', () => {
  const tour = sweepTour(sweepStep());
  const coverage = computeCoverage(tour, parseUnifiedDiff(DIVERGENT));
  const unclaimedFiles = coverage.unclaimed.map((u) => u.file);
  assert.ok(!unclaimedFiles.includes('src/i18n/en.json'));
  assert.ok(!unclaimedFiles.includes('src/i18n/de.json'));
  assert.ok(unclaimedFiles.includes('src/app.ts'), 'outside the glob stays unexplained');
  assert.equal(coverage.fullyClaimedChangedFiles, 2);
});

test('the checker verifies matched files changed identically', () => {
  const tour = sweepTour(sweepStep());
  assert.deepEqual(verifySweeps(tour, parseUnifiedDiff(IDENTICAL)), []);
  const divergent = verifySweeps(tour, parseUnifiedDiff(DIVERGENT));
  assert.equal(divergent.length, 1);
  assert.ok(divergent[0].includes('src/i18n/de.json'), divergent[0]);
  assert.ok(divergent[0].includes('sweep step sweep'), divergent[0]);
});

test('an empty-match sweep errors even when the glob is well-formed', () => {
  const tour = sweepTour(sweepStep({ files: ['src/i18n/*.json'] }));
  const errors = verifySweeps(tour, parseUnifiedDiff(diffFile('src/app.ts', 'a', 'b')));
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('matches no changed file'), errors[0]);
});

test('the step view carries the sweep badge facts', () => {
  const model = buildReviewModel('/repo', sweepTour(sweepStep()), parseUnifiedDiff(DIVERGENT));
  const view = model.steps[0];
  assert.deepEqual(view.sweep, { glob: 'src/i18n/*.json', files: 2 });
  const plain = buildReviewModel(
    '/repo',
    sweepTour(sweepStep({ files: undefined })),
    parseUnifiedDiff(DIVERGENT),
  );
  assert.equal(plain.steps[0].sweep, undefined);
});
