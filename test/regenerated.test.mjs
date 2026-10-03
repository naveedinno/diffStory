import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchGlob } from '../dist/noise.js';
import { validateTour } from '../dist/tour.js';
import {
  filesForStoryCoverage,
  isRegeneratedFile,
  regeneratedCommandFor,
} from '../dist/coverage.js';
import { parseUnifiedDiff } from '../dist/diff.js';
import { buildReviewModel } from '../dist/view-model.js';

test('matchGlob spans segments only with **', () => {
  assert.equal(matchGlob('abis/*.json', 'abis/a.json'), true);
  assert.equal(matchGlob('abis/*.json', 'abis/nested/a.json'), false);
  assert.equal(matchGlob('abis/*.json', 'src/abis/a.json'), false);
  assert.equal(matchGlob('**/*.json', 'a.json'), true);
  assert.equal(matchGlob('**/*.json', 'x/y.json'), true);
  assert.equal(matchGlob('dist/**', 'dist/bundle.js'), true);
  assert.equal(matchGlob('dist/**', 'dist/nested/bundle.js'), true);
  assert.equal(matchGlob('dist/**', 'src/dist.js'), false);
  assert.equal(matchGlob('a/**/b', 'a/b'), true);
  assert.equal(matchGlob('a/**/b', 'a/x/y/b'), true);
  assert.equal(matchGlob('a/**/b', 'a/x/c'), false);
  assert.equal(matchGlob('package-lock.json', 'package-lock.json'), true);
  assert.equal(matchGlob('file-?.txt', 'file-1.txt'), true);
  assert.equal(matchGlob('file-?.txt', 'file-12.txt'), false);
  assert.equal(matchGlob('a+b', 'a+b'), true);
  assert.equal(matchGlob('a+b', 'aab'), false);
});

function scopeTour(regenerated) {
  return {
    version: 4,
    title: 'Regen story',
    summary: 'summary',
    storyScope: {
      includedFiles: ['src/a.ts', 'abis/a.json', 'package-lock.json'],
      regenerated,
    },
    steps: [
      {
        id: 's1', order: 1, title: 'Step', kind: 'changed',
        file: 'src/a.ts', range: [1, 2], why: 'because',
      },
    ],
  };
}

const DIFF = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,2 +1,2 @@',
  ' line1',
  '-old2',
  '+new2',
  'diff --git a/abis/a.json b/abis/a.json',
  '--- a/abis/a.json',
  '+++ b/abis/a.json',
  '@@ -1 +1 @@',
  '-{"a":1}',
  '+{"a":2}',
  'diff --git a/package-lock.json b/package-lock.json',
  '--- a/package-lock.json',
  '+++ b/package-lock.json',
  '@@ -1 +1 @@',
  '-{"l":1}',
  '+{"l":2}',
].join('\n');

test('regenerated entries validate as scope, with safe globs and plain commands', () => {
  const good = scopeTour([
    { files: ['abis/*.json'], by: 'npx hardhat export-abi' },
    { files: ['package-lock.json'], by: 'npm install' },
  ]);
  assert.deepEqual(validateTour(good), []);
  const noScope = { version: 4, title: 't', summary: 's', steps: good.steps };
  assert.deepEqual(validateTour(noScope), []);
  for (const [regenerated, problem] of [
    ['nope', 'must be an array'],
    [[{ files: ['a.ts'] }], '.by must be a non-empty string'],
    [[{ files: [], by: 'x' }], 'files'],
    [[{ files: ['../evil.ts'], by: 'x' }], 'safe repository-relative glob'],
    [[{ files: ['/abs.ts'], by: 'x' }], 'safe repository-relative glob'],
    [[{ files: ['a{b}.ts'], by: 'x' }], 'safe repository-relative glob'],
    [[{ files: ['a.ts'], by: 'x'.repeat(241) }], 'at most 240 characters'],
  ]) {
    const errors = validateTour(scopeTour(regenerated)).join('\n');
    assert.ok(errors.includes(problem), `${JSON.stringify(regenerated)} → ${errors}`);
  }
});

test('coverage treats regenerated files as explained', () => {
  const files = parseUnifiedDiff(DIFF);
  const tour = scopeTour([{ files: ['abis/*.json', 'package-lock.json'], by: 'gen' }]);
  const measured = filesForStoryCoverage(tour, files).map((f) => f.newPath);
  assert.deepEqual(measured, ['src/a.ts']);
  const plain = filesForStoryCoverage(scopeTour(undefined), files).map((f) => f.newPath);
  assert.deepEqual(plain, ['src/a.ts', 'abis/a.json', 'package-lock.json']);
});

test('the first matching generator wins, and non-matches stay null', () => {
  const tour = scopeTour([
    { files: ['**/*.json'], by: 'first' },
    { files: ['abis/*.json'], by: 'second' },
  ]);
  assert.equal(regeneratedCommandFor(tour, 'abis/a.json'), 'first');
  assert.equal(regeneratedCommandFor(tour, 'src/a.ts'), null);
  assert.equal(isRegeneratedFile(tour, 'abis/a.json'), true);
  assert.equal(isRegeneratedFile(tour, 'src/a.ts'), false);
  assert.equal(isRegeneratedFile(scopeTour(undefined), 'abis/a.json'), false);
});

test('file views carry the generator command for the sidebar rows', () => {
  const files = parseUnifiedDiff(DIFF);
  const tour = scopeTour([{ files: ['abis/*.json'], by: 'npx hardhat export-abi' }]);
  const model = buildReviewModel('/repo', tour, files);
  const byPath = new Map(model.files.map((f) => [f.file, f]));
  assert.equal(byPath.get('abis/a.json')?.regeneratedBy, 'npx hardhat export-abi');
  assert.equal(byPath.get('abis/a.json')?.untoured, 0);
  assert.equal(byPath.get('src/a.ts')?.regeneratedBy, undefined);
});
