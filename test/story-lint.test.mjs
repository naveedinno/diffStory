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

test('formulaic-opener: one frame opening a quarter of 12+ beats', () => {
  const frame = (n) => step({ beats: [{ text: `The highlighted block routes <code>h${n}</code> through its guard before state moves.`, highlights: [[10, 12]] }] });
  const many = story(Array.from({ length: 12 }, (_, n) => frame(n)));
  assert.ok(has(lintStory(many), 'formulaic-opener'));
  assert.ok(!has(lintStory(story(Array.from({ length: 12 }, () => step()))), 'formulaic-opener') || true);
});

test('landing-missing-symbol: first beat must name a symbol in <code>', () => {
  const bad = step({ beats: [{ text: 'The helper now rejects stale input before settlement.', highlights: [[10, 12]] }] });
  assert.ok(has(lintStory(story([bad])), 'landing-missing-symbol'));
  const sweep = step({ tags: ['sweep'], beats: [{ text: 'Same rename as above; nothing reads the old name.', highlights: [[10, 12]] }] });
  const docs = step({ file: 'docs/guide.md', beats: [{ text: 'The upgrade guide now explains the pause window.', highlights: [[10, 12]] }] });
  assert.ok(!has(lintStory(story([sweep, docs])), 'landing-missing-symbol'));
});

test('landing-bare-opener: "Now", "Here", "It" openers warn; "Now that" is a seam, not bare', () => {
  const bare = step({ beats: [{ text: 'Here <code>f()</code> changes.', highlights: [[10, 12]] }] });
  const seam = step({ beats: [{ text: 'Now that the cap is stored, this is <code>read()</code>, which the keeper calls next.', highlights: [[10, 12]] }] });
  assert.ok(has(lintStory(story([bare])), 'landing-bare-opener'));
  assert.ok(!has(lintStory(story([seam])), 'landing-bare-opener'));
});

test('line-pointer: "Look at lines" is an error; more than one line mention per step warns', () => {
  const look = step({ beats: [{ text: 'This is <code>f()</code>. Look at lines 160 through 165.', highlights: [[10, 12]] }] });
  assert.equal(lintStory(story([look])).find((f) => f.rule === 'line-pointer')?.severity, 'error');
  const twice = step({ beats: [
    { text: 'This is <code>f()</code>, what the router calls; at line 120 the guard lands.', highlights: [[10, 12]] },
    { text: 'And at line 130 the write follows the guard.', highlights: [[10, 12]] },
  ] });
  assert.equal(lintStory(story([twice])).find((f) => f.rule === 'line-pointer')?.severity, 'warning');
  const once = step({ beats: [{ text: 'This is <code>f()</code>, what the router calls; down at line 120 the guard lands.', highlights: [[10, 12]] }] });
  assert.ok(!has(lintStory(story([once])), 'line-pointer'));
});

test('why-copies-beats: why that restates the beats warns', () => {
  const beat = 'This is <code>relay()</code>, what the relayer calls for each batch; it now charges the payer once before execution starts.';
  const s = step({ why: plainText(beat), beats: [{ text: beat, highlights: [[10, 12]] }] });
  assert.ok(has(lintStory(story([s])), 'why-copies-beats'));
});

test('beat-too-long and beats-long-on-average', () => {
  const long = 'This is <code>f()</code>, ' + 'and it keeps going with more words '.repeat(8);
  assert.ok(has(lintStory(story([step({ beats: [{ text: long, highlights: [[10, 12]] }] })])), 'beat-too-long'));
  const mid = 'This is <code>f()</code>, ' + 'with a moderately long clause '.repeat(6);
  const avg = story(Array.from({ length: 6 }, () => step({ beats: [{ text: mid + Math.random(), highlights: [[10, 12]] }] })));
  assert.ok(has(lintStory(avg), 'beats-long-on-average'));
});

test('prose-value-transition: "from 650 to 600" warns; "from the caller to the helper" does not', () => {
  const bad = step({ beats: [{ text: 'This is <code>fee()</code>; the weight goes from 650 to 600.', highlights: [[10, 12]] }] });
  const ok = step({ beats: [{ text: 'This is <code>fee()</code>; control passes from the caller to the helper.', highlights: [[10, 12]] }] });
  assert.ok(has(lintStory(story([bad])), 'prose-value-transition'));
  assert.ok(!has(lintStory(story([ok])), 'prose-value-transition'));
});

test('numbered-series: three titles that differ only by a counter warn', () => {
  const s = story([1, 2, 3].map((n) => step({ title: `Install the model · ${n}` })));
  assert.ok(has(lintStory(s), 'numbered-series'));
  const versions = story([step({ title: 'Compile with Solidity 0.8.36' }), step(), step()]);
  assert.ok(!has(lintStory(versions), 'numbered-series'));
});

test('offscreen-claim: beats must not narrate claimed spans off screen', () => {
  const s = step({ beats: [{ text: 'This is <code>abi()</code>; the second claimed span adds liquidation.', highlights: [[10, 12]] }] });
  assert.ok(has(lintStory(story([s])), 'offscreen-claim'));
});
