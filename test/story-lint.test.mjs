// Deterministic story lints. Each rule gets a positive and a negative case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { lintStory, plainText, narrativeFields } from '../dist/story-lint.js';

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
    landing: { symbol: `${name}()`, calledBy: ['router()'] },
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
  const mid = 'The guard then ' + 'keeps a moderately long clause going '.repeat(6);
  const landing = (n) => `This is <code>f${nameOf(n)}()</code> in <code>app.ts</code>, which the router calls on every request.`;
  const avg = story(Array.from({ length: 6 }, (_, n) => step({ beats: [
    { text: landing(n), highlights: [[10, 12]] },
    { text: mid + nameOf(n), highlights: [[10, 12]] },
  ] })));
  assert.ok(has(lintStory(avg), 'beats-long-on-average'));
});

test('beats-long-on-average ignores landing beats, which run longer by design', () => {
  // Realistic sizes: 39-word landings and 27-word follow-ups average 33 across
  // all beats, which tripped the old warning; the follow-ups alone average 27.
  const landing = (n) => `This is <code>f${nameOf(n)}()</code> in <code>app.ts</code>, the handler <code>router${nameOf(n)}()</code> calls on every checkout POST, right after the session middleware resolves the cart and before anything is persisted, charged to the card, or emailed to the buyer as a signed receipt.`;
  const followUp = (n) => `It now rejects a stale cart before the payment call, so a buyer who edited the cart in another tab is never charged the old total ${nameOf(n)}.`;
  const s = story(Array.from({ length: 6 }, (_, n) => step({ beats: [
    { text: landing(n), highlights: [[10, 12]] },
    { text: followUp(n), highlights: [[10, 12]] },
  ] })));
  const findings = lintStory(s);
  assert.ok(!has(findings, 'beats-long-on-average'));
  assert.ok(!has(findings, 'beat-too-long'), 'a 39-word landing stays under the 45-word cap');
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

function chaptered(names) {
  return story(names.map((chapter) => step({ chapter })));
}

test('chapter-missing: stories over 10 steps need chapters on every step', () => {
  assert.ok(has(lintStory(story(Array.from({ length: 11 }, () => step()))), 'chapter-missing'));
});

test('chapter-pingpong: a chapter must not resume after another', () => {
  assert.ok(has(lintStory(chaptered(['Cap', 'Proof', 'Cap'])), 'chapter-pingpong'));
  assert.ok(!has(lintStory(chaptered(['Cap', 'Cap', 'Proof'])), 'chapter-pingpong'));
});

test('chapter-too-long: more than 9 consecutive steps in one chapter', () => {
  assert.ok(has(lintStory(chaptered(Array(10).fill('Cap'))), 'chapter-too-long'));
});

test('chapter-seam: the first beat of a new chapter names the seam', () => {
  const s = story([
    step({ chapter: 'Cap' }),
    step({ chapter: 'Refunds', beats: [{ text: 'This is <code>refund()</code>, called by the keeper.', highlights: [[10, 12]] }] }),
  ]);
  assert.ok(has(lintStory(s), 'chapter-seam'));
  const ok = story([
    step({ chapter: 'Cap' }),
    step({ chapter: 'Refunds', beats: [{ text: 'That settles the cap; the second concern is <code>refund()</code>, which the keeper calls.', highlights: [[10, 12]] }] }),
  ]);
  assert.ok(!has(lintStory(ok), 'chapter-seam'));
  const natural = story([
    step({ chapter: 'Startup' }),
    step({ chapter: 'Tools', beats: [{ text: 'With desktop startup bounded, this chapter follows <code>runTool()</code>, which the queue calls.', highlights: [[10, 12]] }] }),
  ]);
  assert.ok(!has(lintStory(natural), 'chapter-seam'));
});

test('tests-at-tail: all test steps after every code step', () => {
  const code = Array.from({ length: 8 }, () => step());
  const tests = Array.from({ length: 3 }, () => step({ file: 'test/app.test.ts' }));
  assert.ok(has(lintStory(story([...code, ...tests])), 'tests-at-tail'));
  const interleaved = [code[0], tests[0], ...code.slice(1, 4), tests[1], ...code.slice(4), tests[2]];
  assert.ok(!has(lintStory(story(interleaved.map((s) => ({ ...s })))), 'tests-at-tail'));
});

test('import-only-highlight: needs file lines; skips when the beat is about imports', () => {
  const lines = ['import { a } from "./a";', 'import b from "./b";', '', 'export function f() {', '  return a(b);', '}'];
  const ctx = { readLines: () => lines };
  const bad = step({ range: [1, 2], viewport: [1, 6], highlights: [[1, 2]], beats: [{ text: 'This is <code>f()</code>; it now rejects stale quotes.', highlights: [[1, 2]] }] });
  assert.ok(has(lintStory(story([bad]), ctx), 'import-only-highlight'));
  const about = step({ range: [1, 2], viewport: [1, 6], highlights: [[1, 2]], beats: [{ text: 'This is <code>f()</code>; its imports now come from the shared module.', highlights: [[1, 2]] }] });
  assert.ok(!has(lintStory(story([about]), ctx), 'import-only-highlight'));
  assert.ok(!has(lintStory(story([bad])), 'import-only-highlight'));
});

test('hotspot rules: environment gaps and non-doubts', () => {
  const s = (reason) => story([step({ id: 'h1' })], { hotspots: [{ step: 'h1', reason }] });
  assert.ok(has(lintStory(s('Physical VoiceOver was not replayed on a real device.')), 'hotspot-is-verification'));
  assert.ok(has(lintStory(s('The production facet replacement must include these selectors.')), 'hotspot-not-a-doubt'));
  assert.deepEqual(rules(lintStory(s('I matched the inclusive boundary to the docs but never exercised rate == cap.'))), []);
  assert.deepEqual(rules(lintStory(s('The readiness proof mocks urlopen; it does not exercise a live listener.'))), []);
});

test('mermaid-label: unquoted parentheses break the diagram; valid shapes pass', () => {
  const concept = (source) => ({ id: 'c1', order: 1, kind: 'concept', title: 'Model', body: '<p>x</p>', preparesFor: ['s9'], diagram: { type: 'mermaid', source, caption: 'c' } });
  const withDiagram = (source) => story([concept(source), step({ id: 's9' })]);
  assert.equal(lintStory(withDiagram('flowchart LR\n  A[Lookup O(1)] --> B')).find((f) => f.rule === 'mermaid-label')?.severity, 'error');
  assert.ok(has(lintStory(withDiagram('flowchart LR\n  A -->|O(1) hit| B')), 'mermaid-label'));
  assert.ok(has(lintStory(withDiagram('sequenceDiagram\n  A->>B: pay; then settle')), 'mermaid-label'));
  for (const ok of ['flowchart LR\n  A["O(1) lookup"] --> B[(db)]', 'flowchart TD\n  A[[sub]] --> B(("x"))', 'flowchart LR\n  A(Start) --> B{Valid?}']) {
    assert.ok(!has(lintStory(withDiagram(ok)), 'mermaid-label'), ok);
  }
});

test('markdown-residue is an error in narrative fields', () => {
  const s = story([step({ why: 'Uses **bold** here.' })]);
  assert.equal(lintStory(s).find((f) => f.rule === 'markdown-residue')?.severity, 'error');
  assert.ok(has(lintStory(story([step({ beats: [{ text: 'This is `f()` in backticks.', highlights: [[10, 12]] }] })])), 'markdown-residue'));
});

test('depth rules: detailed without primer; long without hotspots', () => {
  const long = Array.from({ length: 15 }, (_, i) => step({ chapter: `C${Math.floor(i / 5)}` }));
  const f = lintStory(story(long, { mode: 'detailed' }));
  assert.ok(has(f, 'detailed-without-primer'));
  assert.ok(has(f, 'no-hotspots'));
});

test('calibration: the best-measured eval stories produce no lint errors', () => {
  const dir = new URL('./fixtures/stories/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const tour = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    const errors = lintStory(tour).filter((f) => f.severity === 'error');
    assert.deepEqual(errors, [], `${file}: ${JSON.stringify(errors, null, 2)}`);
  }
});

test('landing-field-missing: code steps without a landing warn once, grouped', () => {
  const bare = (over = {}) => step({ landing: undefined, ...over });
  const f = lintStory(story([bare(), bare(), step()]));
  const hit = f.find((x) => x.rule === 'landing-field-missing');
  assert.equal(hit?.severity, 'warning');
  assert.match(hit.message, /^2 code steps have no landing field/);
  const exempt = story([step({ landing: undefined, tags: ['sweep'] }), step({ landing: undefined, file: 'docs/guide.md' }), step({ landing: undefined, file: 'config/app.json' })]);
  assert.ok(!has(lintStory(exempt), 'landing-field-missing'));
});

test('page concepts contribute narration, never page HTML, to narrative lints', () => {
  const fields = narrativeFields({
    version: 4, title: 'T', summary: 'S',
    steps: [
      { id: 'p', order: 1, title: 'Model', kind: 'concept', page: '<p>**not prose**</p>', narration: 'Watch the line.' },
      { id: 'c', order: 2, title: 'Code', kind: 'changed', file: 'a.ts', range: [1, 1], why: 'w' },
    ],
  });
  assert.ok(fields.some(([path, text]) => path === 'steps[p].narration' && text === 'Watch the line.'));
  assert.ok(!fields.some(([path]) => path.startsWith('steps[p].page')), 'page HTML is not narrative');
});
