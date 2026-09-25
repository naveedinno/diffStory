// Deterministic story lints. Each rule gets a positive and a negative case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintStory, plainText } from '../dist/story-lint.js';

let seq = 0;
/** Letters only: the lint folds digits, so numbered names would read as copies. */
const nameOf = (n) => String.fromCharCode(97 + (n % 26)) + String.fromCharCode(97 + (Math.floor(n / 26) % 26));
/** A valid-shaped changed step; override anything. */
function step(over = {}) {
  seq += 1;
  const id = over.id ?? `s${seq}`;
  const name = nameOf(seq);
  return {
    id,
    order: seq,
    title: `Guard ${name} rejects stale input`,
    kind: 'changed',
    file: 'src/app.ts',
    range: [10, 12],
    viewport: [5, 20],
    highlights: [[10, 12]],
    why: `Rules out the ${name} regression where stale input reached settlement.`,
    beats: [{ text: `This is <code>${name}()</code>, called by the router on every request; it now rejects stale input.`, highlights: [[10, 12]] }],
    ...over,
  };
}
function story(steps, over = {}) {
  steps.forEach((s, i) => { s.order = i + 1; });
  return { version: 3, mode: 'guided', title: 'T', summary: 'S', steps, ...over };
}
const rules = (findings) => findings.map((f) => f.rule);
const has = (findings, rule) => findings.some((f) => f.rule === rule);

test('plainText strips tags and decodes entities', () => {
  assert.equal(plainText('Keep <code>a &lt; b</code>&nbsp;<strong>now</strong>'), 'Keep a < b now');
});

test('a clean small story has no findings', () => {
  assert.deepEqual(lintStory(story([step(), step(), step()])), []);
});

test('copied-beat: the same narration in 3+ steps is an error', () => {
  const same = 'Now that the previous boundary is visible, inspect this node boundary decision carefully.';
  const s = story([1, 2, 3].map(() => step({ beats: [{ text: same, highlights: [[10, 12]] }] })));
  const f = lintStory(s).find((x) => x.rule === 'copied-beat');
  assert.equal(f?.severity, 'error');
  assert.ok(!has(lintStory(story([step({ beats: [{ text: same, highlights: [[10, 12]] }] }), step(), step()])), 'copied-beat'));
});

test('copied-beat folds digits so "decision 19" and "decision 20" are copies', () => {
  const s = story([19, 20, 21].map((n) => step({ beats: [{ text: `Inspect the node boundary decision ${n} and its downstream consequence here.`, highlights: [[10, 12]] }] })));
  assert.ok(has(lintStory(s), 'copied-beat'));
});
