// Hostile-payload suite for the narrative sanitizer. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  narrative,
  narrativeHtml,
  narrativeIssues,
  narrativeSpeech,
  narrativeText,
  parseNarrative,
} from '../dist/narrative.js';

const TIERS = ['block', 'inline', 'text'];

// The complete set of tags the serializer is ever allowed to emit: the two
// allowlists plus the one wrapper element it invents for tables.
const INLINE_ELEMENTS = ['code', 'kbd', 'strong', 'em', 'sup', 'sub', 'span', 'br'];
const BLOCK_ELEMENTS = [
  'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'pre', 'hr',
  'table', 'caption', 'thead', 'tbody', 'tr', 'th', 'td', 'dl', 'dt', 'dd',
];
const OUTPUT_TAGS = new Set([...INLINE_ELEMENTS, ...BLOCK_ELEMENTS, 'div']);
const VOID_TAGS = new Set(['br', 'hr']);

const CLASS_VALUES = new Set(['ds-bit', 'ds-slot', 'ds-flag', 'ds-val', 'ds-warn']);

// The complete attribute contract, expressed as data so the corpus loops can
// check every emitted attribute against it rather than hunting for known-bad
// names. Anything not described here is a sanitizer bug, not a missed denylist
// entry — that is the whole point of allowlisting.
const ATTR_RULES = {
  class: { tags: ['span', 'code', 'td', 'th'], ok: (v) => CLASS_VALUES.has(v) },
  scope: { tags: ['th'], ok: (v) => v === 'row' || v === 'col' },
  colspan: { tags: ['td', 'th'], ok: (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 20 },
  rowspan: { tags: ['td', 'th'], ok: (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 20 },
  'data-lang': { tags: ['pre'], ok: (v) => /^[a-z0-9-]{1,20}$/.test(v) },
};

// Every attribute name that can carry a URL in HTML. None of them is on the
// allowlist, which is why `javascript:` payloads have nowhere to land.
const URL_ATTRIBUTES = [
  'href', 'src', 'srcset', 'action', 'formaction', 'poster', 'data',
  'codebase', 'background', 'ping', 'xlink:href', 'xmlns',
];

/* ------------------------------------------------------------------ *
 * Output inspection helpers
 *
 * These re-tokenize the sanitizer's own output. They are deliberately
 * dumber than the sanitizer: they split on raw `<` and `>` so that any
 * unescaped delimiter that leaked into a text node shows up as a broken
 * token instead of being quietly re-parsed into something valid.
 * ------------------------------------------------------------------ */

function tokenize(html, label) {
  const tokens = [];
  let cursor = 0;
  while (cursor < html.length) {
    const open = html.indexOf('<', cursor);
    if (open === -1) {
      tokens.push({ type: 'text', value: html.slice(cursor) });
      break;
    }
    if (open > cursor) tokens.push({ type: 'text', value: html.slice(cursor, open) });
    const close = html.indexOf('>', open);
    assert.notEqual(close, -1, `${label}: unterminated tag in output: ${html.slice(open, open + 60)}`);
    const raw = html.slice(open + 1, close);
    tokens.push({ type: 'tag', closing: raw.startsWith('/'), raw: raw.replace(/^\//, '') });
    cursor = close + 1;
  }
  return tokens;
}

function readTag(raw, label) {
  const name = raw.match(/^[a-zA-Z0-9-]+/);
  assert.ok(name, `${label}: emitted a tag with no name: <${raw}>`);
  const rest = raw.slice(name[0].length);
  // Attributes are always ` name="value"`, double quoted, with no delimiter
  // inside the value. Anything else means the serializer pasted input bytes
  // into a tag, which is exactly the injection this module exists to prevent.
  assert.match(rest, /^(?: [a-z-]+="[^"<>]*")*$/, `${label}: malformed attribute list in <${raw}>`);
  const attrs = [...rest.matchAll(/ ([a-z-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]);
  return { name: name[0], attrs };
}

/** Re-tokenize the output, check that the tag stack empties, report max depth. */
function assertWellFormed(html, label) {
  const stack = [];
  let maxDepth = 0;
  for (const token of tokenize(html, label)) {
    if (token.type === 'text') {
      assert.ok(!token.value.includes('>'), `${label}: raw ">" leaked into a text node: ${token.value.slice(0, 60)}`);
      continue;
    }
    const { name } = readTag(token.raw, label);
    assert.ok(OUTPUT_TAGS.has(name), `${label}: emitted non-allowlisted tag <${name}>`);
    if (token.closing) {
      assert.equal(stack.pop(), name, `${label}: </${name}> does not close the open element`);
      continue;
    }
    if (VOID_TAGS.has(name)) continue;
    stack.push(name);
    maxDepth = Math.max(maxDepth, stack.length);
  }
  assert.deepEqual(stack, [], `${label}: unclosed elements left on the stack`);
  return maxDepth;
}

/** Every emitted attribute must match the allowlist exactly, tag included. */
function assertAttributesAllowlisted(html, label) {
  for (const token of tokenize(html, label)) {
    if (token.type === 'text' || token.closing) continue;
    const { name, attrs } = readTag(token.raw, label);
    for (const [attr, value] of attrs) {
      if (name === 'div') {
        // The only element the serializer invents, with the only class it invents.
        assert.deepEqual([attr, value], ['class', 'ds-md-tablewrap'], `${label}: unexpected attribute on the table wrapper`);
        continue;
      }
      const rule = ATTR_RULES[attr];
      assert.ok(rule, `${label}: emitted non-allowlisted attribute ${attr}="${value}" on <${name}>`);
      assert.ok(rule.tags.includes(name), `${label}: ${attr} is not allowed on <${name}>`);
      assert.ok(rule.ok(value), `${label}: ${attr}="${value}" is not an allowed value`);
    }
  }
}

function attributeNames(html, label) {
  const names = [];
  for (const token of tokenize(html, label)) {
    if (token.type === 'text' || token.closing) continue;
    for (const [attr] of readTag(token.raw, label).attrs) names.push(attr);
  }
  return names;
}

function countTag(html, tag) {
  return (html.match(new RegExp(`<${tag}(?=[ >])`, 'g')) || []).length;
}

/* ------------------------------------------------------------------ *
 * The corpus
 *
 * Every payload here is a real attack string, not a description of one.
 * The idempotence, well-formedness and attribute loops at the bottom of
 * this file run over the whole array, so anything added here is covered
 * by the structural properties for free.
 * ------------------------------------------------------------------ */

const DEPTH_BOMB = `${'<span class="ds-bit">'.repeat(100)}deep${'</span>'.repeat(100)}`;

const PAYLOADS = [
  // --- <script> in every obfuscation -------------------------------
  { name: 'plain script', input: '<script>alert(1)</script>' },
  { name: 'nested script', input: '<scr<script>ipt>alert(1)</scr</script>ipt>' },
  { name: 'uppercase script with src', input: '<SCRIPT SRC="//evil.example/x.js"></SCRIPT>' },
  { name: 'mixed-case script', input: '<ScRiPt>alert(1)</sCrIpT>' },
  { name: 'end tag with trailing space', input: '<script>alert(1)</script >' },
  { name: 'end tag with newline', input: '<script>alert(1)</script\n>' },
  { name: 'self-closing script', input: '<script/src="//evil.example/x.js"></script>' },
  { name: 'script split across an attribute boundary', input: '<p title="</p><script>alert(1)</script>">visible</p>' },
  { name: 'script inside an alt-like attribute', input: '<span class="ds-bit" alt="<script>alert(1)</script>">visible</span>' },
  { name: 'script after an unterminated attribute', input: '<span class="ds-bit><script>alert(1)</script>">visible</span>' },

  // --- on* handlers in every casing and quoting ---------------------
  { name: 'onerror lowercase', input: '<span onerror="alert(1)">a</span>' },
  { name: 'OnErRoR mixed case', input: '<span OnErRoR=alert(1)>a</span>' },
  { name: 'ONERROR uppercase single quoted', input: "<span ONERROR='alert(1)'>a</span>" },
  { name: 'onload unquoted on a block', input: '<p onload=alert(1)>a</p>' },
  { name: 'onclick with a backtick value', input: '<em onclick=`alert(1)`>a</em>' },
  { name: 'handler name split by a newline', input: '<span on\nerror="alert(1)">a</span>' },
  { name: 'handler name split by a tab', input: '<span on\terror=alert(1)>a</span>' },
  { name: 'handler name split by a form feed', input: '<span on\ferror="alert(1)">a</span>' },
  { name: 'entity-encoded handler name', input: '<span &#111;nerror="alert(1)">a</span>' },
  { name: 'handler with a NUL in the name', input: '<span on\0error=alert(1)>a</span>' },
  { name: 'handler on an allowlisted table cell', input: '<table><caption>C</caption><tr><td onmouseover="alert(1)" colspan="2">a</td></tr></table>' },

  // --- URL schemes with nowhere to land -----------------------------
  { name: 'javascript: href', input: '<a href="javascript:alert(1)">click</a>' },
  { name: 'javascript: href with entities', input: '<a href="java&#115;cript:alert(1)">click</a>' },
  { name: 'javascript: action and formaction', input: '<form action="javascript:alert(1)"><button formaction="javascript:alert(1)">go</button></form>' },
  { name: 'data: image src', input: '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">' },
  { name: 'data: iframe src', input: '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>' },
  { name: 'vbscript: href', input: '<a href="vbscript:msgbox(1)">y</a>' },
  { name: 'xlink:href on svg use', input: '<svg><use xlink:href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="></use></svg>' },
  { name: 'javascript: in an allowlisted attribute slot', input: '<pre data-lang="javascript:alert(1)"><code>x</code></pre>' },
  { name: 'protocol-relative script src', input: '<script src=//evil.example/a.js></script>' },
  { name: 'srcset and poster', input: '<video poster="javascript:alert(1)"><source srcset="javascript:alert(1)"></video>' },

  // --- attribute injection ------------------------------------------
  { name: 'stray > inside an attribute value', input: '<span class="ds-bit>evil">x</span>' },
  { name: 'unbalanced quote', input: '<span class=ds-bit"onerror=alert(1)>x</span>' },
  { name: 'missing space before the next attribute', input: '<span class="ds-val"onmouseover=alert(1)>x</span>' },
  { name: 'attribute value containing a full tag', input: '<span class="<img src=x onerror=alert(1)>">x</span>' },
  { name: 'backslash-quote breakout attempt', input: '<td colspan="2"><span class="ds-bit" x="\\"><img src=x onerror=alert(1)>">x</span></td>' },
  { name: 'truncated tag at end of input', input: '<span class="ds-bit"' },
  { name: 'unterminated attribute at end of input', input: '<span class="unclosed>text' },

  // --- unicode, entity and byte escapes ------------------------------
  { name: 'hex-entity script', input: '&#x3c;script&#x3e;alert(1)&#x3c;/script&#x3e;' },
  { name: 'decimal-entity script', input: '&#60;script&#62;alert(1)&#60;/script&#62;' },
  { name: 'overlong decimal entity', input: '&#0000060;script&#0000062;alert(1)&#0000060;/script&#0000062;' },
  { name: 'entity without a semicolon', input: '&#x3cscript&#x3ealert(1)' },
  { name: 'double-encoded less-than', input: '&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;' },
  { name: 'triple-encoded less-than', input: '&amp;amp;lt;script&amp;amp;gt;' },
  { name: 'NUL inside a tag name', input: '<scr\0ipt>alert(1)</scr\0ipt>' },
  { name: 'NUL inside text', input: '<p>before\0after</p>' },
  { name: 'no-break space before a tag name', input: '<\u00a0script>alert(1)</script>' },
  { name: 'no-break space inside a tag name', input: '<script\u00a0src=x>alert(1)</script>' },
  { name: 'zero-width joiner inside a tag name', input: '<scr\u200dipt>alert(1)</scr\u200dipt>' },
  { name: 'ascii space before the tag name', input: '< script>alert(1)</ script>' },
  { name: 'vertical tab inside a tag', input: '<script\u000b>alert(1)</script>' },
  { name: 'right-to-left override in text', input: '<p>\u202ealert(1)\u202c</p>' },

  // --- namespaces, comments and other parser quirks -------------------
  { name: 'svg with an inline script', input: '<svg><script>alert(1)</script></svg>' },
  { name: 'svg foreignObject', input: '<svg><foreignObject><p>escaped context</p></foreignObject></svg>' },
  { name: 'svg style mXSS', input: '<p><svg><style><a id="</style><img src=x onerror=alert(1)>">' },
  { name: 'math mglyph mXSS', input: '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>' },
  { name: 'CDATA section', input: '<![CDATA[<script>alert(1)</script>]]>' },
  { name: 'html comment', input: '<!-- <script>alert(1)</script> --><p>after</p>' },
  { name: 'short-comment quirk', input: '<!--><script>alert(1)</script>' },
  { name: 'conditional comment', input: '<!--[if IE]><script>alert(1)</script><![endif]--><p>after</p>' },
  { name: 'template element', input: '<template><script>alert(1)</script></template>' },
  { name: 'noscript title quirk', input: '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>' },
  { name: 'doctype', input: '<!DOCTYPE html><p>after</p>' },
  { name: 'xml processing instruction', input: '<?xml version="1.0"?><p>after</p>' },
  { name: 'php processing instruction', input: '<?php echo "<script>alert(1)</script>"; ?><p>after</p>' },
  { name: 'base and meta', input: '<base href="//evil.example/"><meta http-equiv="refresh" content="0;url=javascript:alert(1)"><p>after</p>' },
  { name: 'style block', input: '<style>body{background:url(javascript:alert(1))}</style><p>after</p>' },
  { name: 'form controls', input: '<form><input value="x"><textarea>y</textarea><select><option>z</option></select><button>go</button></form>' },

  // --- structural and value edge cases --------------------------------
  { name: 'depth bomb', input: DEPTH_BOMB },
  { name: 'table without a caption', input: '<table><tr><td>secret</td></tr></table>' },
  { name: 'table with a caption', input: '<table><caption>Fee tiers</caption><tr><th scope="col">Tier</th><td colspan="2">5 bps</td></tr></table>' },
  { name: 'table with a trailing caption', input: '<table><tr><td>cell</td></tr><caption>Late</caption></table>' },
  { name: 'table with two captions', input: '<table><caption>One</caption><caption>Two</caption><tr><td>cell</td></tr></table>' },
  { name: 'cells outside a row', input: '<p><td>loose cell</td><th>loose header</th></p>' },
  { name: 'oversized spans', input: '<table><caption>C</caption><tr><td colspan="999">a</td><td colspan="-1">b</td><td colspan="1e3">c</td><td colspan=" 2 ">d</td><td rowspan="0">e</td></tr></table>' },
  { name: 'class variants', input: '<span class="ds-bit evil">a</span><span class="anything">b</span><span class="">c</span><span class="ds-bit">d</span><span class="DS-BIT">e</span>' },
  { name: 'unknown elements unwrap', input: '<article><div><section>kept text</section></div></article>' },
  { name: 'void elements', input: '<p>line<br>break</p><hr><p>after<br/>and<br />more</p>' },
  { name: 'stray closing tags', input: '</p></div></span>stray closers' },
  { name: 'unclosed elements', input: '<p><strong>unclosed emphasis' },
  { name: 'benign block prose', input: '<h2>Fee guard</h2><p>The <strong>clamp</strong> runs <code class="ds-bit">before</code> the write.</p>' },
  { name: 'benign list', input: '<ul><li>Normalize once</li><li>Apply the policy</li></ul>' },
  { name: 'definition list', input: '<dl><dt>Envelope</dt><dd>The normalized request</dd></dl>' },
  { name: 'code fence', input: '<pre data-lang="ts"><code>const x = a &lt; b;</code></pre>' },
  { name: 'plain text', input: 'A plain sentence with an & ampersand and a < bracket.' },
  { name: 'empty string', input: '' },
];

/* ------------------------------------------------------------------ *
 * <script> in every obfuscation
 * ------------------------------------------------------------------ */

test('script tags die in every obfuscation, and take their contents with them', () => {
  const dropped = [
    '<script>alert(1)</script>',
    '<SCRIPT SRC="//evil.example/x.js"></SCRIPT>',
    '<ScRiPt>alert(1)</sCrIpT>',
    '<script>alert(1)</script >',
    '<script>alert(1)</script\n>',
    '<script src=//evil.example/a.js></script>',
    '<script/src="//evil.example/x.js"></script>',
  ];
  for (const input of dropped) {
    for (const tier of TIERS) {
      const label = `${input} @ ${tier}`;
      const html = narrativeHtml(input, tier);
      // script is drop-with-contents: the tag AND everything it wrapped go,
      // which is why a trailing space in `</script >` has to still close it.
      assert.doesNotMatch(html, /<script/i, label);
      assert.doesNotMatch(html, /alert/, `${label} leaked the script body`);
      assert.doesNotMatch(html, /evil\.example/, `${label} leaked a script source`);
      assert.equal(narrativeSpeech(input, tier).trim(), '', `${label} is speakable`);
      assert.equal(narrativeText(input).trim(), '', `${label} leaked into the text projection`);
    }
  }
});

test('a script nested inside its own tag name never reassembles', () => {
  const html = narrativeHtml('<scr<script>ipt>alert(1)</scr</script>ipt>', 'block');
  // `<scr<script>` tokenizes as a `scr` element carrying junk, so the residue is
  // inert prose. What matters is that no live script tag survives and that the
  // residue is escaped rather than handed back for another parse.
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<scr/i);
  assert.ok(!html.includes('ipt>'), 'a raw ">" survived inside text');
  assertWellFormed(html, 'nested script');
  assertAttributesAllowlisted(html, 'nested script');
});

test('a script hidden in an attribute value stays in the attribute and dies with it', () => {
  const html = narrativeHtml('<p title="</p><script>alert(1)</script>">visible</p>', 'block');
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /title=/);
  assert.doesNotMatch(html, /alert/);
  assert.match(html, /visible/);
});

/* ------------------------------------------------------------------ *
 * Event handlers
 * ------------------------------------------------------------------ */

test('event handlers are unreachable in every casing, quoting and spelling', () => {
  const handlers = [
    '<span onerror="alert(1)">a</span>',
    '<span OnErRoR=alert(1)>a</span>',
    "<span ONERROR='alert(1)'>a</span>",
    '<span onmouseover=alert(1)>a</span>',
    '<span on\nerror="alert(1)">a</span>',
    '<span on\terror=alert(1)>a</span>',
    '<span on\ferror="alert(1)">a</span>',
    '<span on\0error=alert(1)>a</span>',
    '<span &#111;nerror="alert(1)">a</span>',
    '<span &#x6f;nerror="alert(1)">a</span>',
    '<code onanimationstart="alert(1)" class="ds-bit">a</code>',
  ];
  for (const input of handlers) {
    for (const tier of ['block', 'inline']) {
      const label = `${input} @ ${tier}`;
      const html = narrativeHtml(input, tier);
      // The allowlist has no handler-shaped entry, so the check is total: any
      // attribute that survived has to come from the five-name contract.
      assertAttributesAllowlisted(html, label);
      assert.ok(
        attributeNames(html, label).every((n) => !n.startsWith('on')),
        `${label} emitted a handler-shaped attribute`,
      );
      assert.doesNotMatch(html, /alert/, `${label} leaked handler source`);
      assert.match(html, />a</, `${label} dropped the element text`);
    }
  }
});

test('an event handler on an allowlisted table cell is dropped without taking the cell', () => {
  const html = narrativeHtml(
    '<table><caption>Tiers</caption><tr><td onmouseover="alert(1)" colspan="2">k</td></tr></table>',
    'block',
  );
  assert.match(html, /<td colspan="2">k<\/td>/);
  assert.doesNotMatch(html, /onmouseover/);
  assert.doesNotMatch(html, /alert/);
});

/* ------------------------------------------------------------------ *
 * URL schemes
 * ------------------------------------------------------------------ */

test('javascript:, data: and vbscript: URLs have no attribute to live in', () => {
  // This is a structural claim, not a filter. No URL-bearing attribute name is
  // on the allowlist, so a scheme check inside the sanitizer would be dead code.
  for (const attr of URL_ATTRIBUTES) {
    assert.ok(!(attr in ATTR_RULES), `${attr} must never join the attribute allowlist`);
  }

  const urlPayloads = [
    '<a href="javascript:alert(1)">click</a>',
    '<a href="java&#115;cript:alert(1)">click</a>',
    '<a href="vbscript:msgbox(1)">click</a>',
    '<a href="JaVaScRiPt:alert(1)">click</a>',
    '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">click',
    '<form action="javascript:alert(1)">click</form>',
    '<span class="ds-bit" data-href="javascript:alert(1)">click</span>',
    '<pre data-lang="javascript:alert(1)"><code>click</code></pre>',
    '<svg><use xlink:href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="></use></svg>click',
  ];
  for (const input of urlPayloads) {
    for (const tier of TIERS) {
      const label = `${input} @ ${tier}`;
      const html = narrativeHtml(input, tier);
      assertAttributesAllowlisted(html, label);
      const emitted = attributeNames(html, label);
      for (const attr of URL_ATTRIBUTES) {
        assert.ok(!emitted.includes(attr), `${label} emitted ${attr}`);
      }
      assert.doesNotMatch(html, /javascript:|vbscript:|data:text\/html/i, `${label} kept a URL scheme`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * Attribute injection
 * ------------------------------------------------------------------ */

test('attribute injection cannot reopen a tag or forge a new attribute', () => {
  const injections = [
    '<span class="ds-bit>evil">x</span>',
    '<span class=ds-bit"onerror=alert(1)>x</span>',
    '<span class="ds-val"onmouseover=alert(1)>x</span>',
    '<span class="<img src=x onerror=alert(1)>">x</span>',
    '<span class="ds-bit" x="\\"><img src=x onerror=alert(1)>">x</span>',
    '<span class="unclosed>x',
    '<span class="ds-bit"',
  ];
  for (const input of injections) {
    const label = `injection: ${input}`;
    const html = narrativeHtml(input, 'inline');
    assertWellFormed(html, label);
    assertAttributesAllowlisted(html, label);
    assert.doesNotMatch(html, /<img/i, `${label} produced an img`);
    assert.doesNotMatch(html, /onerror|onmouseover/i, `${label} produced a handler`);
  }
});

test('text nodes escape the three delimiters and leave quotes alone', () => {
  // Quote escaping belongs to attribute values, not to text: a reader should see
  // the quotation marks the author typed, and no parser cares about them here.
  const input = `<p>He said "it's &lt;fine&gt; & done"</p>`;
  assert.equal(narrativeHtml(input, 'block'), `<p>He said "it's &lt;fine&gt; &amp; done"</p>`);
  assert.equal(narrativeText(input), `He said "it's <fine> & done"`);
  assert.equal(narrativeHtml('a > b && c < d', 'text'), 'a &gt; b &amp;&amp; c &lt; d');
});

test('no allowlisted attribute value can carry a delimiter, so attribute escaping is unreachable', () => {
  // Each of the five attributes has a value pattern made of lowercase letters,
  // digits and hyphens. There is no allowlisted slot an author could use to
  // reach the quote branch of the escaper, which is why quoted-attribute
  // breakout is structurally impossible here rather than merely filtered.
  for (const value of ['ds-bit', 'ds-slot', 'ds-flag', 'ds-val', 'ds-warn', 'row', 'col', '1', '20', 'objective-c']) {
    assert.match(value, /^[a-z0-9-]+$/, `${value} must stay delimiter-free`);
  }
  for (const { name, input } of PAYLOADS) {
    for (const tier of TIERS) {
      const label = `${name} @ ${tier}`;
      for (const token of tokenize(narrativeHtml(input, tier), label)) {
        if (token.type === 'text' || token.closing) continue;
        for (const [, value] of readTag(token.raw, label).attrs) {
          assert.match(value, /^[a-z0-9-]+$/, `${label}: emitted attribute value "${value}"`);
        }
      }
    }
  }
});

/* ------------------------------------------------------------------ *
 * Unicode, entities and bytes
 * ------------------------------------------------------------------ */

test('entity-encoded, double-encoded and overlong markup stays text', () => {
  const encoded = [
    '&#x3c;script&#x3e;alert(1)&#x3c;/script&#x3e;',
    '&#60;script&#62;alert(1)&#60;/script&#62;',
    '&#0000060;script&#0000062;alert(1)&#0000060;/script&#0000062;',
    '&lt;script&gt;alert(1)&lt;/script&gt;',
  ];
  for (const input of encoded) {
    const html = narrativeHtml(input, 'block');
    // Decoded once into a text node, escaped once on the way out. The result is
    // visibly `<script>` to a reader and inert to a parser.
    assert.equal(html, '&lt;script&gt;alert(1)&lt;/script&gt;', input);
    assert.doesNotMatch(html, /</, `${input} left a raw "<" in text`);
    assert.equal(narrativeText(input), '<script>alert(1)</script>', input);
  }

  // Double encoding decodes exactly one level, so the reader sees the literal
  // `&lt;` the author wrote rather than a tag or a stripped entity.
  assert.equal(narrativeHtml('&amp;lt;script&amp;gt;', 'block'), '&amp;lt;script&amp;gt;');
  assert.equal(narrativeText('&amp;lt;script&amp;gt;'), '&lt;script&gt;');
  assert.equal(narrativeHtml('&amp;amp;lt;', 'block'), '&amp;amp;lt;');
});

test('NUL bytes and unicode whitespace never repair a tag name', () => {
  const smuggled = [
    '<scr\0ipt>alert(1)</scr\0ipt>',
    '<\u00a0script>alert(1)</script>',
    '<script\u00a0src=x>alert(1)</script>',
    '<scr\u200dipt>alert(1)</scr\u200dipt>',
    '< script>alert(1)</ script>',
    '<script\u000b>alert(1)</script>',
  ];
  for (const input of smuggled) {
    const label = `smuggled: ${JSON.stringify(input)}`;
    const html = narrativeHtml(input, 'block');
    assert.doesNotMatch(html, /<script/i, label);
    assertWellFormed(html, label);
    assertAttributesAllowlisted(html, label);
  }

  // A NUL inside ordinary prose is dropped rather than emitted into the page.
  assert.equal(narrativeHtml('<p>before\0after</p>', 'block'), '<p>beforeafter</p>');
});

/* ------------------------------------------------------------------ *
 * Namespaces, comments and parser quirks
 * ------------------------------------------------------------------ */

test('foreign namespaces, comments and parser quirks are dropped with their contents', () => {
  const cases = [
    { input: '<svg><script>alert(1)</script></svg>', gone: /svg|alert/i },
    { input: '<svg><foreignObject><p>escaped context</p></foreignObject></svg>', gone: /svg|foreignobject/i },
    { input: '<p><svg><style><a id="</style><img src=x onerror=alert(1)>">', gone: /svg|style|img|onerror/i },
    { input: '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>', gone: /math|mglyph|img|onerror/i },
    { input: '<![CDATA[<script>alert(1)</script>]]>', gone: /script|alert|CDATA/i },
    { input: '<!-- <script>alert(1)</script> -->', gone: /script|alert/i },
    { input: '<!--><script>alert(1)</script>', gone: /script|alert/i },
    { input: '<!--[if IE]><script>alert(1)</script><![endif]-->', gone: /script|alert|endif/i },
    { input: '<template><script>alert(1)</script></template>', gone: /template|script|alert/i },
    { input: '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>', gone: /noscript|img|onerror/i },
    { input: '<style>body{background:url(javascript:alert(1))}</style>', gone: /style|javascript/i },
    { input: '<form><input value="x"><textarea>y</textarea><button>go</button></form>', gone: /form|input|textarea|button/i },
    { input: '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>', gone: /iframe|script/i },
    { input: '<object data="evil.swf"><embed src="evil.swf"></object>', gone: /object|embed|evil/i },
    { input: '<base href="//evil.example/"><meta http-equiv="refresh" content="0;url=javascript:alert(1)">', gone: /base|meta|evil|javascript/i },
    { input: '<!DOCTYPE html>', gone: /doctype/i },
    { input: '<?xml version="1.0"?>', gone: /xml|version/i },
    { input: '<?php echo "<script>alert(1)</script>"; ?>', gone: /php|script|echo/i },
  ];
  for (const { input, gone } of cases) {
    for (const tier of TIERS) {
      const label = `${input} @ ${tier}`;
      const html = narrativeHtml(input, tier);
      assert.doesNotMatch(html, gone, label);
      assertWellFormed(html, label);
    }
  }
});

test('prose after a dropped construct still survives', () => {
  for (const input of [
    '<!-- <script>alert(1)</script> --><p>after</p>',
    '<!--[if IE]><script>alert(1)</script><![endif]--><p>after</p>',
    '<!DOCTYPE html><p>after</p>',
    '<?xml version="1.0"?><p>after</p>',
    '<template><script>alert(1)</script></template><p>after</p>',
    '<style>p{color:red}</style><p>after</p>',
  ]) {
    assert.match(narrativeHtml(input, 'block'), /<p>after<\/p>/, input);
  }
});

/* ------------------------------------------------------------------ *
 * Structure: depth, tables, values, classes
 * ------------------------------------------------------------------ */

test('a depth bomb flattens at 20 levels without losing its text', () => {
  const html = narrativeHtml(DEPTH_BOMB, 'block');
  const depth = assertWellFormed(html, 'depth bomb');
  assert.equal(depth, 20, 'nesting is capped at exactly 20 levels');
  assert.equal(countTag(html, 'span'), 20, 'the 21st span onward flattens to its children');
  assert.match(html, /deep/, 'the innermost text is kept, not discarded with the wrapper');
  assertAttributesAllowlisted(html, 'depth bomb');
});

test('a table without a caption is dropped whole; with one it survives wrapped', () => {
  // "Dropped entirely" means the cells go too — an unlabelled table is a
  // reading hazard, not a formatting nit, so there is nothing to salvage.
  assert.equal(narrativeHtml('<table><tr><td>secret</td></tr></table>', 'block'), '');
  // A caption written late is not an error — where it sits is the serializer's
  // job, not the author's. It is hoisted to first position. The requirement is
  // that a caption EXISTS, because it is what the voice speaks in place of the
  // table; only its absence is a reading hazard.
  assert.equal(
    narrativeHtml('<table><tr><td>cell</td></tr><caption>Late</caption></table>', 'block'),
    '<div class="ds-md-tablewrap"><table><caption>Late</caption><tbody><tr><td>cell</td></tr></tbody></table></div>',
  );
  // A second caption has nothing to say that the first did not; it is dropped.
  assert.equal(
    narrativeHtml('<table><caption>One</caption><caption>Two</caption><tr><td>c</td></tr></table>', 'block'),
    '<div class="ds-md-tablewrap"><table><caption>One</caption><tbody><tr><td>c</td></tr></tbody></table></div>',
  );

  // A bare <tr> is adopted into a <tbody>, and the whole table is wrapped in the
  // one element the serializer is allowed to invent.
  assert.equal(
    narrativeHtml('<table><caption>Fee tiers</caption><tr><th scope="col">Tier</th><td colspan="2">5 bps</td></tr></table>', 'block'),
    '<div class="ds-md-tablewrap"><table><caption>Fee tiers</caption><tbody><tr>'
      + '<th scope="col">Tier</th><td colspan="2">5 bps</td></tr></tbody></table></div>',
  );

  // An explicit thead/tbody is left alone rather than re-wrapped.
  assert.equal(
    narrativeHtml('<table><caption>C</caption><thead><tr><th scope="col">H</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>', 'block'),
    '<div class="ds-md-tablewrap"><table><caption>C</caption><thead><tr><th scope="col">H</th></tr></thead>'
      + '<tbody><tr><td>B</td></tr></tbody></table></div>',
  );

  // Cells outside a row lose the cell, not the words. Unwrapping is a pure tree
  // operation: the HTML projection never invents whitespace between siblings.
  assert.equal(narrativeHtml('<p><td>loose cell</td><th>loose header</th></p>', 'block'), '<p>loose cellloose header</p>');
});

// Found by round-trip fuzzing: a self-closed <table/> pushed a node but opened no
// frame, so the caption check never ran. The empty table survived the first pass
// and was dropped by the second — the sanitizer was not a fixpoint.
test('a self-closed structural tag still runs its structural finish', () => {
  assert.equal(narrativeHtml('<table/>', 'block'), '');
  assert.equal(narrativeHtml('<table/><p>after</p>', 'block'), '<p>after</p>');
  for (const src of ['<table/>', '<table/><p>x</p>', '<thead/><table/>', '<table/><table><caption>C</caption><tr><td>c</td></tr></table>']) {
    const once = narrativeHtml(src, 'block');
    assert.equal(narrativeHtml(once, 'block'), once, `${src} is not a fixpoint`);
  }
});

test('colspan and rowspan take an exact integer in range, with no coercion', () => {
  const cell = (attrs) => `<table><caption>C</caption><tr><td ${attrs}>x</td></tr></table>`;
  const kept = (attrs) => narrativeHtml(cell(attrs), 'block').includes(`<td ${attrs}>`);

  assert.ok(kept('colspan="1"'));
  assert.ok(kept('colspan="3"'));
  assert.ok(kept('colspan="20"'));
  assert.ok(kept('rowspan="7"'));

  // Everything else is dropped on sight. The value is validated exactly as
  // written: no trimming, no Number() coercion, no clamping into range.
  for (const attrs of ['colspan="0"', 'colspan="21"', 'colspan="999"', 'colspan="-1"', 'colspan="1e3"',
    'colspan=" 2 "', 'colspan="2px"', 'colspan="+2"', 'colspan="2.0"', 'colspan=""', 'rowspan="0"', 'rowspan="99"']) {
    const html = narrativeHtml(cell(attrs), 'block');
    assert.match(html, /<td>x<\/td>/, `${attrs} should leave a bare cell`);
    assert.doesNotMatch(html, /colspan|rowspan/, `${attrs} should be dropped`);
  }

  // Span attributes are cell-only, and scope is header-only.
  assert.doesNotMatch(narrativeHtml('<span colspan="2">x</span>', 'inline'), /colspan/);
  assert.match(narrativeHtml('<table><caption>C</caption><tr><th scope="row">x</th></tr></table>', 'block'), /<th scope="row">/);
  assert.doesNotMatch(narrativeHtml('<table><caption>C</caption><tr><th scope="rowgroup">x</th></tr></table>', 'block'), /scope/);
  assert.doesNotMatch(narrativeHtml('<table><caption>C</caption><tr><td scope="row">x</td></tr></table>', 'block'), /scope/);
});

test('class survives only as one of the five exact signal values', () => {
  for (const value of ['ds-bit', 'ds-slot', 'ds-flag', 'ds-val', 'ds-warn']) {
    assert.equal(narrativeHtml(`<span class="${value}">d</span>`, 'inline'), `<span class="${value}">d</span>`);
  }
  for (const value of ['ds-bit evil', 'evil ds-bit', 'anything', '', ' ds-bit ', 'DS-BIT', 'ds-bit;', 'ds-']) {
    assert.equal(
      narrativeHtml(`<span class="${value}">d</span>`, 'inline'),
      '<span>d</span>',
      `class="${value}" should be dropped`,
    );
  }
  // class is offered on four tags only.
  assert.equal(narrativeHtml('<code class="ds-val">d</code>', 'inline'), '<code class="ds-val">d</code>');
  assert.equal(narrativeHtml('<p class="ds-bit">d</p>', 'block'), '<p>d</p>');
  assert.equal(narrativeHtml('<strong class="ds-bit">d</strong>', 'inline'), '<strong>d</strong>');
});

test('data-lang is a lowercase slug on pre only', () => {
  assert.equal(narrativeHtml('<pre data-lang="ts"><code>x</code></pre>', 'block'), '<pre data-lang="ts"><code>x</code></pre>');
  assert.equal(narrativeHtml('<pre data-lang="objective-c"><code>x</code></pre>', 'block'), '<pre data-lang="objective-c"><code>x</code></pre>');
  for (const value of ['TypeScript', 'ts js', 'ts;', '', 'a'.repeat(21), '../etc/passwd']) {
    assert.equal(
      narrativeHtml(`<pre data-lang="${value}"><code>x</code></pre>`, 'block'),
      '<pre><code>x</code></pre>',
      `data-lang="${value}" should be dropped`,
    );
  }
  assert.equal(narrativeHtml('<code data-lang="ts">x</code>', 'inline'), '<code>x</code>');
});

test('unknown elements unwrap and void elements never open a scope', () => {
  assert.equal(narrativeHtml('<article><div><section>kept text</section></div></article>', 'block'), 'kept text');
  assert.equal(narrativeHtml('<p>line<br>break</p><hr>', 'block'), '<p>line<br>break</p><hr>');
  assert.equal(narrativeHtml('<p>a<br/>b<br />c</p>', 'block'), '<p>a<br>b<br>c</p>');
  assert.equal(narrativeHtml('</p></div></span>stray closers', 'block'), 'stray closers');
  assert.equal(narrativeHtml('<p><strong>unclosed emphasis', 'block'), '<p><strong>unclosed emphasis</strong></p>');
});

/* ------------------------------------------------------------------ *
 * Tier enforcement
 * ------------------------------------------------------------------ */

test('tier inline keeps inline markup and unwraps block markup to its words', () => {
  assert.equal(
    narrativeHtml('The <strong>clamp</strong> runs <code class="ds-bit">before</code> the write.', 'inline'),
    'The <strong>clamp</strong> runs <code class="ds-bit">before</code> the write.',
  );

  // A block element is not "unknown" here, it is simply not offered at this
  // tier, so it follows the same rule: the element goes, the words stay, and no
  // whitespace is invented to paper over the missing structure.
  const table = '<table><caption>Fee tiers</caption><tr><td>5 bps</td></tr></table>';
  const html = narrativeHtml(table, 'inline');
  assert.doesNotMatch(html, /<table|<caption|<tbody|<tr|<td|ds-md-tablewrap/);
  assert.equal(html, 'Fee tiers5 bps');
  assert.ok(narrativeIssues(table, 'inline').length, 'the author should hear that a table has no home here');

  for (const input of ['<p>a</p>', '<h2>a</h2>', '<ul><li>a</li></ul>', '<pre><code>a</code></pre>', '<blockquote>a</blockquote>', '<hr>']) {
    const inline = narrativeHtml(input, 'inline');
    for (const tag of BLOCK_ELEMENTS) {
      assert.ok(!inline.includes(`<${tag}>`), `${input} @ inline emitted <${tag}>`);
    }
  }
});

test('tier text strips every tag and keeps drop-with-contents dropped', () => {
  // At this tier there is no tree to serialize, so block boundaries come back as
  // the single spaces that keep the sentences apart.
  assert.equal(narrativeHtml('<h2>Fee guard</h2><p>The <strong>clamp</strong> runs first.</p>', 'text'), 'Fee guard The clamp runs first.');
  assert.equal(narrativeHtml('<script>alert(1)</script>', 'text'), '');
  assert.equal(narrativeHtml('<span class="ds-bit">kept</span>', 'text'), 'kept');

  for (const { name, input } of PAYLOADS) {
    const html = narrativeHtml(input, 'text');
    assert.doesNotMatch(html, /</, `${name}: tier text emitted a raw "<"`);
    assert.doesNotMatch(html, />/, `${name}: tier text emitted a raw ">"`);
  }
});

/* ------------------------------------------------------------------ *
 * Speech projection
 * ------------------------------------------------------------------ */

test('a table speaks its caption and nothing else', () => {
  const speech = narrativeSpeech(
    '<table><caption>Fee tiers by market</caption><thead><tr><th scope="col">Tier</th></tr></thead>'
      + '<tbody><tr><td>5 bps</td><td>12 bps</td></tr></tbody></table>',
    'block',
  );
  assert.equal(speech, 'Fee tiers by market.');
  assert.doesNotMatch(speech, /Tier|bps/, 'cell contents are unreadable aloud and are skipped');
});

test('code blocks are skipped and the prose around them still joins cleanly', () => {
  const speech = narrativeSpeech('<p>Before.</p><pre data-lang="sh"><code>rm -rf /</code></pre><p>After.</p>', 'block');
  assert.equal(speech, 'Before. After.');
  assert.doesNotMatch(speech, /rm -rf/);

  // Inline code is part of the sentence and stays spoken.
  assert.equal(narrativeSpeech('<p>Call <code>settleFunding()</code> once.</p>', 'block'), 'Call settleFunding() once.');
});

test('paragraphs join as sentences without doubling punctuation', () => {
  assert.equal(narrativeSpeech('<p>A.</p><p>B.</p>', 'block'), 'A. B.');
  assert.equal(narrativeSpeech('<p>A</p><p>B</p>', 'block'), 'A. B.');
  assert.equal(narrativeSpeech('<p>Is it clamped?</p><p>Yes.</p>', 'block'), 'Is it clamped? Yes.');
  assert.equal(narrativeSpeech('<h2>Fee guard</h2><p>The clamp runs first.</p>', 'block'), 'Fee guard. The clamp runs first.');
  for (const input of ['<p>A.</p><p>B.</p>', '<p>Ends with a colon:</p><p>B.</p>', '<ul><li>One.</li><li>Two.</li></ul>']) {
    assert.doesNotMatch(narrativeSpeech(input, 'block'), /\.\./, `${input} doubled sentence punctuation`);
  }
});

test('list items terminate as sentences instead of running together', () => {
  assert.equal(narrativeSpeech('<ul><li>Normalize once</li><li>Apply the policy</li></ul>', 'block'), 'Normalize once. Apply the policy.');
  assert.equal(narrativeSpeech('<ol><li>Normalize once.</li><li>Apply the policy.</li></ol>', 'block'), 'Normalize once. Apply the policy.');
  assert.doesNotMatch(narrativeSpeech('<ul><li>Normalize once</li><li>Apply the policy</li></ul>', 'block'), /onceApply/);
});

test('a definition list speaks as "term: definition."', () => {
  assert.equal(
    narrativeSpeech('<dl><dt>Envelope</dt><dd>The normalized request</dd></dl>', 'block'),
    'Envelope: The normalized request.',
  );
  assert.equal(
    narrativeSpeech('<dl><dt>Envelope</dt><dd>The normalized request.</dd><dt>Clamp</dt><dd>The shared guard.</dd></dl>', 'block'),
    'Envelope: The normalized request. Clamp: The shared guard.',
  );
});

test('speech reads the sanitized tree, never the raw input', () => {
  for (const { name, input } of PAYLOADS) {
    for (const tier of TIERS) {
      const label = `${name} @ ${tier}`;
      const speech = narrativeSpeech(input, tier);
      // Speaking the sanitized HTML must produce the same stream as speaking the
      // original: both projections come off one parse, so anything that only
      // survives in one of them is a leak.
      assert.equal(narrativeSpeech(narrativeHtml(input, tier), tier), speech, `${label} speech drifts after sanitizing`);
      assert.doesNotMatch(speech, /evil\.example/, `${label} would read out an attacker host`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * Whole-corpus structural properties
 * ------------------------------------------------------------------ */

test('sanitizing sanitized output changes nothing, for every payload and tier', () => {
  // The mXSS property. A sanitizer that is not idempotent has a
  // sanitized-output-reparsed gap, and that gap is where mXSS lives.
  for (const { name, input } of PAYLOADS) {
    for (const tier of TIERS) {
      const once = narrativeHtml(input, tier);
      const twice = narrativeHtml(once, tier);
      assert.equal(twice, once, `${name} @ ${tier} is not idempotent`);
      assert.equal(narrativeHtml(twice, tier), once, `${name} @ ${tier} drifts on a third pass`);
    }
  }
});

test('every payload produces balanced, allowlisted, attribute-clean output', () => {
  for (const { name, input } of PAYLOADS) {
    for (const tier of TIERS) {
      const label = `${name} @ ${tier}`;
      const html = narrativeHtml(input, tier);
      const depth = assertWellFormed(html, label);
      assert.ok(depth <= 20, `${label} nested deeper than the 20-level cap`);
      assertAttributesAllowlisted(html, label);
    }
  }
});

test('the three projections agree with the combined result for every payload', () => {
  for (const { name, input } of PAYLOADS) {
    for (const tier of TIERS) {
      const result = narrative(input, tier);
      assert.equal(result.html, narrativeHtml(input, tier), `${name} @ ${tier} html`);
      assert.equal(result.text, narrativeText(input), `${name} @ ${tier} text`);
      assert.equal(result.speech, narrativeSpeech(input, tier), `${name} @ ${tier} speech`);
    }
  }
});

test('parseNarrative is the single parse behind all three projections', () => {
  const nodes = parseNarrative('<p>The <strong>clamp</strong> runs first.</p>', 'block');
  assert.deepEqual(nodes, [{
    type: 'element',
    tag: 'p',
    attrs: [],
    children: [
      { type: 'text', value: 'The ' },
      { type: 'element', tag: 'strong', attrs: [], children: [{ type: 'text', value: 'clamp' }] },
      { type: 'text', value: ' runs first.' },
    ],
  }]);

  // Surviving attributes reach the tree as validated pairs, in source order.
  const cell = JSON.stringify(parseNarrative(
    '<table><caption>C</caption><tr><td colspan="2" class="ds-val" onclick="alert(1)">5</td></tr></table>',
    'block',
  ));
  assert.match(cell, /\["colspan","2"\]/);
  assert.match(cell, /\["class","ds-val"\]/);
  assert.doesNotMatch(cell, /onclick|alert/);

  // A drop-with-contents element never becomes a node at all.
  assert.deepEqual(parseNarrative('<script>alert(1)</script>', 'block'), []);
  assert.deepEqual(parseNarrative('', 'block'), []);
});

/* ------------------------------------------------------------------ *
 * Authoring-time issues
 * ------------------------------------------------------------------ */

test('narrativeIssues stays empty for clean narrative and names real authoring mistakes', () => {
  assert.deepEqual(narrativeIssues('<h2>Fee guard</h2><p>The <strong>clamp</strong> runs first.</p>', 'block'), []);
  assert.deepEqual(narrativeIssues('The <code class="ds-bit">clamp</code> runs first.', 'inline'), []);
  assert.deepEqual(narrativeIssues('Plain prose with an & ampersand.', 'text'), []);
  assert.deepEqual(narrativeIssues('<table><caption>Fee tiers</caption><tr><td colspan="2">5 bps</td></tr></table>', 'block'), []);

  const reported = [
    { input: '<script>alert(1)</script>', tier: 'block' },
    { input: '<span onerror="alert(1)">a</span>', tier: 'inline' },
    { input: '<a href="https://example.com">a</a>', tier: 'block' },
    { input: '<span class="evil">a</span>', tier: 'inline' },
    { input: '<table><tr><td>no caption</td></tr></table>', tier: 'block' },
    { input: '<table><caption>C</caption><tr><td colspan="999">a</td></tr></table>', tier: 'block' },
    { input: '<pre data-lang="TypeScript"><code>a</code></pre>', tier: 'block' },
    { input: '<p>a</p>', tier: 'inline' },
    { input: DEPTH_BOMB, tier: 'block' },
  ];
  for (const { input, tier } of reported) {
    const issues = narrativeIssues(input, tier);
    assert.ok(issues.length, `${input} @ ${tier} should report an authoring issue`);
    assert.ok(
      issues.every((issue) => typeof issue === 'string' && issue.trim()),
      `${input} @ ${tier} reported an empty issue`,
    );
  }
});

test('narrativeIssues never throws on any payload, at any tier', () => {
  for (const { name, input } of PAYLOADS) {
    for (const tier of TIERS) {
      let issues;
      assert.doesNotThrow(() => { issues = narrativeIssues(input, tier); }, `${name} @ ${tier}`);
      assert.ok(Array.isArray(issues), `${name} @ ${tier} must return an array`);
    }
  }
});
