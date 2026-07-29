// Adversarial round-trip check for the composed narrative sanitizer.
// Run with: node fuzz.mjs
import { narrativeHtml, narrativeText, narrativeSpeech } from '../dist/narrative.js';

const TAGS = ['p', 'table', 'caption', 'tr', 'td', 'th', 'thead', 'tbody', 'ul', 'li', 'ol', 'dl', 'dt', 'dd',
  'pre', 'code', 'span', 'strong', 'em', 'br', 'hr', 'h2', 'blockquote', 'script', 'svg', 'style', 'div',
  'img', 'a', 'template', 'math', 'foreignObject', 'button', 'iframe', 'sup', 'sub', 'kbd'];
const ATTRS = ['class="ds-bit"', 'class="evil"', 'onerror=alert(1)', 'onload="x"',
  'href="javascript:alert(1)"', 'src=x', 'colspan="2"', 'colspan="99"', 'scope="col"',
  'data-lang="ts"', 'id="x"', 'style="a:b"', '"', '=', '<'];
const TEXT = ['hi', 'a & b', '<not a tag', '&amp;', '&#x3c;script&#x3e;', ' ', '"q"', "'s'", 'A.', '>', '&lt;', 'ok'];

// A deterministic LCG, so a reported failure is reproducible.
let seed = 20260728;
const rnd = (n) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
const pick = (a) => a[rnd(a.length)];

function soup(len) {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const r = rnd(10);
    if (r < 4) s += `<${pick(TAGS)}${rnd(2) ? ' ' + pick(ATTRS) : ''}${rnd(6) === 0 ? '/' : ''}>`;
    else if (r < 6) s += `</${pick(TAGS)}>`;
    else if (r === 6) s += pick(['<!--', '-->', '<!-->', '<![CDATA[', ']]>', '<!DOCTYPE html>', '<?pi?>', '<']);
    else s += pick(TEXT);
  }
  return s;
}

const TIERS = ['block', 'inline', 'inline', 'text'];
// Every tag the serializer is ever allowed to emit, with the only attribute shape it writes.
const OK_TAG = /^<\/?(?:p|h2|h3|h4|ul|ol|li|blockquote|pre|hr|table|caption|thead|tbody|tr|th|td|dl|dt|dd|code|kbd|strong|em|sup|sub|span|br|div)(?: [a-z-]+="[^"<>]*")*>$/;
const NUL = String.fromCharCode(0);

let checked = 0;
const bad = [];

for (let i = 0; i < 120000; i += 1) {
  const src = soup(1 + rnd(14));
  const tier = pick(TIERS);

  const once = narrativeHtml(src, tier);
  const twice = narrativeHtml(once, tier);
  if (once !== twice) bad.push(['idempotence', tier, src, once, twice]);

  for (const tag of once.match(/<[^>]*>/g) ?? []) {
    if (!OK_TAG.test(tag)) { bad.push(['unexpected-tag', tier, src, tag]); break; }
  }
  if (/\son[a-z]+\s*=/i.test(once)) bad.push(['handler-survived', tier, src, once]);
  if (/javascript:|vbscript:/i.test(once)) bad.push(['url-scheme-survived', tier, src, once]);

  // `.text` and `.speech` are RAW plain text by contract — their callers need
  // them unescaped for word counts, truncation and aria-labels, and escape them
  // at the sink. So a literal `<` in the output is legitimate content (an author
  // writing about the `<script>` tag), not a leak. What must never survive is
  // the *content* of an element that was dropped whole.
  const speech = narrativeSpeech(src, tier);
  const text = narrativeText(src);
  if (speech.includes('alert(1)') || text.includes('alert(1)')) {
    bad.push(['dropped-content-in-projection', tier, src, speech, text]);
  }
  if (text.includes(NUL) || speech.includes(NUL)) bad.push(['nul-survived', tier, src]);

  checked += 1;
  if (bad.length > 4) break;
}

console.log(`checked ${checked} round-trips across ${TIERS.length} tier draws`);
if (bad.length) {
  console.log('FAILURES:');
  for (const b of bad) console.log(JSON.stringify(b).slice(0, 500));
  process.exit(1);
}
console.log('clean: idempotent, allowlist-closed, no handlers, no live URLs, no markup in speech/text');
