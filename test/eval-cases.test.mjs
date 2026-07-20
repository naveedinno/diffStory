// Shape checks for the story-eval harness fixtures. Run with: npm test
// (No git or claude CLI involved: refs are only resolved when the harness runs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { storyPrompt } from '../dist/agent.js';

const { cases } = JSON.parse(readFileSync(new URL('../eval/cases.json', import.meta.url), 'utf8'));

test('eval cases are unique, complete, and use real story modes', () => {
  assert.ok(cases.length >= 3, 'keep at least three diverse frozen cases');
  const ids = cases.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'case ids must be unique');
  for (const c of cases) {
    assert.ok(c.base && c.head, `${c.id} needs a frozen base..head range`);
    assert.ok(c.base.endsWith('^'), `${c.id} base should be the parent ref (X^) so the range stays immutable`);
    assert.ok(['brief', 'guided', 'detailed'].includes(c.mode), `${c.id} has unknown mode ${c.mode}`);
    assert.ok(Array.isArray(c.excludePaths) && c.excludePaths.includes('dist/*'),
      `${c.id} must exclude generated dist/ like the app would`);
    assert.ok(c.note?.trim(), `${c.id} needs a note describing the change shape`);
  }
});

test('every eval case builds the production story prompt', () => {
  for (const c of cases) {
    const p = storyPrompt(c.base, c.head, c.mode, c.excludePaths);
    assert.ok(p.includes(`git diff ${c.base}..${c.head} --`), `${c.id} prompt pins the frozen range`);
    assert.ok(p.includes(`set its "mode" field to "${c.mode}"`));
    assert.ok(p.includes(':(exclude)dist/*'));
  }
});
