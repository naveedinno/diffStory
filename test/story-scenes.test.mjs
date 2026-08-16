import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectStoryStepScene } from '../dist/story-scenes.js';

test('story facts project into the app-owned scene vocabulary', () => {
  const cases = [
    [{ kind: 'concept', hasDiagram: false }, 'concept-document'],
    [{ kind: 'concept', hasDiagram: true }, 'concept-diagram'],
    [{ kind: 'code', hasMoves: false, paired: false }, 'code-focus'],
    [{ kind: 'code', hasMoves: true, paired: false }, 'logic-move'],
    [{ kind: 'code', hasMoves: true, paired: true }, 'paired-code'],
  ];

  for (const [facts, expected] of cases) {
    assert.equal(projectStoryStepScene(facts), expected);
  }
});

test('a resolved paired view wins over the general logic-move layout', () => {
  assert.equal(
    projectStoryStepScene({ kind: 'code', hasMoves: true, paired: true }),
    'paired-code',
  );
});
