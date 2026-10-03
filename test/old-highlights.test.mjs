import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGeneratedTour, validateTour } from '../dist/tour.js';
import { buildReviewModel } from '../dist/view-model.js';
import { parseUnifiedDiff } from '../dist/diff.js';
import { verifyOldHighlights } from '../dist/story-check.js';
import { beatDestination, rowInOldFocusRange } from '../dist/render.js';

function beat(overrides = {}) {
  return {
    text: 'The old guard is gone.',
    highlights: [[8, 9]],
    ...overrides,
  };
}

function tour(beats) {
  return {
    version: 4,
    title: 'Deletion story',
    summary: 'summary',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'Drop the guard',
        kind: 'changed',
        file: 'a.ts',
        range: [8, 9],
        viewport: [1, 20],
        highlights: [[8, 9]],
        why: 'The guard blocked valid callers.',
        beats,
      },
    ],
  };
}

test('a beat needs one side, and old-side ranges are real old line numbers', () => {
  assert.deepEqual(validateTour(tour([beat({ highlights: undefined, oldHighlights: [[4, 6]] })])), []);
  assert.deepEqual(validateTour(tour([beat({ oldHighlights: [[4, 6]] })])), []);
  const neither = validateTour(tour([beat({ highlights: undefined })])).join('\n');
  assert.ok(neither.includes('needs highlights, oldHighlights, or both'), neither);
  for (const [oldHighlights, problem] of [
    [[0, 0]],
    ['x'],
    [[]],
  ]) {
    const errors = validateTour(
      tour([beat({ highlights: undefined, oldHighlights })]),
    ).join('\n');
    assert.ok(errors.length > 0, `${JSON.stringify(oldHighlights)} is rejected: ${errors}`);
  }
});

test('pure-deletion steps pass the overlap contract; mixed steps still need new-side cover', () => {
  const pure = tour([beat({ highlights: undefined, oldHighlights: [[4, 6]] })]);
  assert.ok(
    !validateGeneratedTour(pure).join('\n').includes('overlaps the changed range'),
    'all-old-side beats point off-range by design',
  );
  const mixed = tour([
    beat({ highlights: [[50, 51]], oldHighlights: [[4, 6]] }),
  ]);
  assert.ok(
    validateGeneratedTour(mixed).join('\n').includes('overlaps the changed range'),
    'a new-side beat must still overlap the change',
  );
});

test('old-side focus groups parallel the beats', () => {
  const model = buildReviewModel(
    '/repo',
    tour([beat({ oldHighlights: [[4, 6]] }), beat({ highlights: undefined, oldHighlights: [[7, 7]] })]),
    [],
  );
  const step = model.steps[0];
  assert.deepEqual(step.focusOldGroups, [
    [[4, 6]],
    [[7, 7]],
  ]);
  assert.deepEqual(step.focusGroups[1], [], 'no new-side ranges on an old-side beat');
});

test('deleted rows match by old line number; nothing else does', () => {
  assert.equal(rowInOldFocusRange({ type: 'del', oldNo: 5 }, [4, 6]), true);
  assert.equal(rowInOldFocusRange({ type: 'del', oldNo: 3 }, [4, 6]), false);
  assert.equal(rowInOldFocusRange({ type: 'del', oldNo: 7 }, [4, 6]), false);
  assert.equal(rowInOldFocusRange({ type: 'add', oldNo: 5 }, [4, 6]), false);
  assert.equal(rowInOldFocusRange({ type: 'del' }, [4, 6]), false);
  assert.equal(rowInOldFocusRange({ type: 'context', oldNo: 5 }, [4, 6]), false);
});

const DIFF = [
  'diff --git a/a.ts b/a.ts',
  '--- a/a.ts',
  '+++ b/a.ts',
  '@@ -3,5 +3,4 @@',
  ' keep',
  '-old guard one',
  '-old guard two',
  ' keep',
  '+new line',
  ' keep',
].join('\n');

test('the checker overlaps old-side ranges with real deletions', () => {
  const files = parseUnifiedDiff(DIFF);
  assert.deepEqual(
    verifyOldHighlights(tour([beat({ oldHighlights: [[4, 5]] })]), files),
    [],
  );
  const miss = verifyOldHighlights(tour([beat({ oldHighlights: [[9, 9]] })]), files);
  assert.equal(miss.length, 1);
  assert.ok(miss[0].includes('steps[s1].beats[0].oldHighlights 9-9'), miss[0]);
  assert.ok(miss[0].includes('no deleted line in a.ts'), miss[0]);
});

test('spoken destinations name deleted lines', () => {
  assert.equal(beatDestination('a.ts', [[8, 9]]), 'a.ts, lines 8 to 9');
  assert.equal(beatDestination('a.ts', [], [[4, 6]]), 'a.ts, deleted lines 4 to 6');
  assert.equal(beatDestination('a.ts', [], [[4, 4]]), 'a.ts, deleted line 4');
  assert.equal(
    beatDestination('a.ts', [[8, 8]], [[4, 6]]),
    'a.ts, line 8 and deleted lines 4 to 6',
  );
  assert.equal(beatDestination('a.ts', [[0, 0]]), 'a.ts, deleted lines');
});
