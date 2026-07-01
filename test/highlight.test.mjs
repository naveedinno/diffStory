// Unit tests for the syntax tokenizer. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, renderToken, highlight } from '../dist/highlight.js';

// Golden output — locks highlight() byte-for-byte through the tokenize() refactor.
const GOLDEN = [
  ['const x = 1;', '<span class="tk-k">const</span> x = <span class="tk-n">1</span>;'],
  ['foo(bar);', '<span class="tk-f">foo</span>(bar);'],
  ['a < b && c;', 'a &lt; b &amp;&amp; c;'],
  ['const s = "hi <b>";', '<span class="tk-k">const</span> s = <span class="tk-s">&quot;hi &lt;b&gt;&quot;</span>;'],
  ['new Foo();', '<span class="tk-k">new</span> <span class="tk-t">Foo</span>();'],
  ['// a comment', '<span class="tk-c">// a comment</span>'],
  ['', ''],
];

test('highlight produces the expected token spans', () => {
  for (const [input, expected] of GOLDEN) {
    assert.equal(highlight(input), expected, `highlight(${JSON.stringify(input)})`);
  }
});

test('highlight === tokenize().map(renderToken).join("") (round-trip)', () => {
  const corpus = [
    'export function checkSpendingLimit(user: User): boolean {',
    'results = instantLayer.executeTemplate(templateId, signedOps);',
    'uint256 totalFee = _collectOperationalFees(signedOps);',
    '  return a && b || c === 42;',
    'const re = /ab+c/g; // regexish',
    '\t\tindented();',
  ];
  for (const line of corpus) {
    const built = tokenize(line).map((t) => renderToken(t)).join('');
    assert.equal(built, highlight(line), `round-trip ${JSON.stringify(line)}`);
  }
});

test('tokenize covers the whole line with no dropped or added characters', () => {
  const line = 'const x = foo(1, "s") + bar; // note';
  const tokens = tokenize(line);
  assert.equal(tokens.map((t) => t.text).join(''), line);
});

test('renderToken adds the changed class alongside the syntax class', () => {
  const [fn] = tokenize('foo(');
  assert.equal(renderToken(fn, true), '<span class="tk-f changed">foo</span>');
  const plain = { text: 'bar', cls: null };
  assert.equal(renderToken(plain, true), '<span class="changed">bar</span>');
  assert.equal(renderToken(plain, false), 'bar');
});
