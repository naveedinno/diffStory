# HTML narrative text for diffStory stories

Replace Markdown with sanitized HTML as the authoring format for story narrative
text, so a concept primer can carry a bit-layout table or an encoding map instead
of describing one in prose.

## Why this is not a renderer swap

Only one narrative field is Markdown today: concept `steps[].body`, rendered by
`renderMarkdown()` at `src/render.ts:1249`. The other eight fields named in the
request are plain `esc()` text, sometimes with `nl()` for `<br>`:

| Field | Today | Render site |
| --- | --- | --- |
| `steps[].body` (concept) | `renderMarkdown` | `render.ts:1249` |
| `steps[].why` | `nl(esc())` | `render.ts:1299`, `:1101` |
| `steps[].beats[].text` | `nl(esc())` + 7 more sinks | `render.ts:1316-1320`, `:525-527`, `:1103-1105` |
| `tour.summary` | `nl(esc())` | `render.ts:654`, `:666`, `:721` |
| `intent.goal` | `nl(esc())` | `render.ts:655`, `:721` |
| `intent.design` | `nl(esc())` | `render.ts:664` |
| `intent.nonGoals[]` | `esc()` | `render.ts:671` |
| `hotspots[].reason` | `esc()` | `render.ts:684`, `:1163` |
| `tour.title` / `steps[].title` | `esc()` (9 sites) | `render.ts:187, 257, 286, 491, 510, 529, 590, 720, 1248`; `story-picker.ts:50-70` |
| `storyScope.reviewerNote` | never rendered | prompt-only, `agent.ts:67` |

So the work is: convert one field, and grant formatting to fields that have never
had any. The second half is where the risk lives.

`steps[].question` does not exist. It was removed; `render.ts:1791` carries the
tombstone and `test/agent.test.mjs:653` actively forbids the word in SKILL.md.
It is out of scope. The dead `question:` keys in `test/tour.test.mjs:24,111`
should be deleted so they stop implying otherwise.

## Decisions

### D1 — Three tiers, chosen by what the surrounding markup can hold

This is a structural constraint, not an editorial preference. Three of the listed
fields render inside elements that cannot legally contain block content:

- `beats[].text` renders inside `<button>` (`render.ts:1316`). Block content there
  is invalid; browsers reflow it, which destroys the `-webkit-line-clamp:2` beat
  (`page-assets.ts:729`) and corrupts the `aria-label` built from the same string.
- `summary`, `intent.goal`, and `intent.design` render inside
  `<p ... data-speech-overview>` (`render.ts:664, 666, 721`). Block content
  force-closes the `<p>`, and that node *is* the narrator's query target
  (`page-assets.ts:1928`). The audio would break silently.
- `intent.nonGoals[]` renders inside `<li>`; titles feed `<title>`, `aria-label`,
  and `title=` attribute sinks where markup can only ever appear as literal text.

| Tier | Fields | Allowed |
| --- | --- | --- |
| **A — block** | concept `steps[].body` | inline set + block set |
| **B — inline** | `steps[].why`, `steps[].beats[].text`, `tour.summary`, `intent.goal`, `intent.design`, `intent.nonGoals[]`, `hotspots[].reason` | inline set only |
| **C — text** | `tour.title`, `steps[].title`, `storyScope.reviewerNote` | no markup at all |

`storyScope.reviewerNote` is in tier C for a second reason: it is authored by the
reviewer through a browser textarea (`page-assets.ts:3639` → `server.ts:2189`),
has no render surface at all, and flows only into an LLM prompt. Allowing HTML
there would turn the browser into an HTML authoring surface — a different threat
model — for zero display benefit.

### D2 — No SVG, no foreign content

The original request listed small inline SVG. It is declined.

SVG switches the HTML parser into foreign-content mode, where parsing rules
differ: `<style>` inside SVG is raw text, `<foreignObject>` re-enters HTML, and
CDATA sections are recognised. That namespace confusion is the origin of most
historical mXSS bypasses, including several against DOMPurify. A sanitizer that
models HTML correctly can still be wrong inside `<svg>`.

The need is already met: concept steps carry an optional `ConceptDiagram`
(`types.ts:129-136`) rendered by local Mermaid, already denylist-validated
(`tour.ts:345-357`) and already themed for light and dark.

`<math>` is excluded for the same reason.

### D3 — No backward compatibility, no version gate

Explicitly chosen. Story narrative is HTML from this change forward. There is no
per-field detection and no version bump; `Tour.version` keeps its existing meaning
(v1 = code-only steps, v2 = concept primers permitted).

Consequence, accepted: a story authored before this change whose concept `body`
contains Markdown will render that Markdown literally — `**bold**` appears as
`**bold**`. The fix is to regenerate the story. The repo's own fixtures
(`.diffstory/story.json`, `.diffstory/stories/*.json`, `examples/demo.mjs:130`)
are updated as part of this work.

`renderMarkdown()` and `renderInlineMarkdown()` are **not** deleted. They stay in
service for reviewer comment bodies and agent replies (`render.ts:1475, 1481,
1529, 1685, 1686` and the client mirror at `page-assets.ts:1037-1094`), which are
a separate, human-authored surface. This change does not touch comment rendering.

### D4 — Validation rejects; the sanitizer strips anyway

Two mechanisms with different jobs, both kept:

- **`validateTour` rejects** markup that exceeds a field's tier, with errors in
  the style of the existing `diagram.source` denylist (`tour.ts:345-357`). This
  gives the authoring agent a feedback loop via `storyRepairPrompt`.
- **The render-time sanitizer strips** unconditionally, because `story.json` is
  untrusted input that may never have passed through our validator — a story
  arrives with someone else's repository.

The Content-Security-Policy provides no defence in depth here: `server.ts:318-327`
sets `script-src 'self' 'unsafe-inline'`, so inline scripts execute and `on*`
handlers on injected elements fire. The lazy step-panel route inserts a
server-rendered fragment with raw `template.innerHTML` and no client-side check
(`page-assets.ts:1502-1507`). **Sanitization must be complete before the response
leaves the server.** The client is not a second line of defence.

### D5 — A table is spoken as its caption

`<caption>` is required on every `<table>`; a table without one is a validation
error and is dropped by the sanitizer.

Reading a bit-layout table row-wise produces unusable audio ("bit 0, name, S,
meaning, sign, bit 1, name, E…") and inflates the 480-character chunk budget
(`ALOUD_CHUNK_CHARS`, `page-assets.ts`). Requiring a caption makes the author
write the one sentence a listener needs, and captions are required for screen
readers regardless. `<pre>` is skipped in speech, which is what fenced code
already does today (`render.ts:1270`), so the rule is consistent rather than new.

## The sanitizer

### Architecture

`src/narrative.ts`, zero dependencies, three exports:

```ts
narrativeHtml(input: string, tier: 'block' | 'inline'): string
narrativeText(input: string): string
narrativeSpeech(input: string, tier: 'block' | 'inline'): string
```

The sanitizer is a tokenizer and a serializer, not a filter:

1. **Tokenize** the input into start tags, end tags, text, and everything-else
   (comments, doctypes, processing instructions, CDATA) with a small state
   machine. Not a regex over the whole document.
2. **Validate** each start tag against the tier's element allowlist and each
   attribute against the attribute allowlist. Disallowed elements are dropped;
   their children are kept for structural elements and dropped for
   content-bearing ones (see below). Everything-else tokens are dropped entirely.
3. **Re-serialize from the resulting tree**, maintaining an open-element stack so
   output is always well-formed and correctly nested.

The security property that matters: **no input byte reaches the output except as
escaped text or an escaped attribute value.** Every tag and attribute in the
output is emitted by our serializer from a validated node. mXSS depends on
sanitized output re-parsing differently than the sanitizer assumed; output we
generate ourselves offers no such gap.

Escaping is stricter than the existing `esc()` (`render.ts:2063`, which omits
`'`): text escapes `& < >`, attribute values escape `& < > " '`.

Reinforcing constraints, each of which removes a parser mode:

- no `svg` / `math` — the parser never leaves HTML mode (D2)
- no comments, no CDATA, no doctype, no processing instructions
- no `<template>`, no `<noscript>`
- the only raw-text element allowed is `<pre>`, whose content is emitted as
  escaped text

Depth is bounded at 20 nested elements; deeper content is flattened to text. The
existing Markdown blockquote path recurses without a depth limit
(`render.ts:2125`) — the replacement does not inherit that.

### Element allowlist

**Inline set** (tiers A and B):

```
code kbd strong em sup sub span br
```

**Block set** (tier A only):

```
p h2 h3 h4 ul ol li blockquote pre hr
table caption thead tbody tr th td
dl dt dd
```

Headings start at `h2` because the concept document already owns `h1`
(`render.ts:1248`). This matches the existing Markdown renderer, which maps
`#{2,4}` and deliberately ignores single `#`.

**Dropped with their contents** (the element and everything inside it):

```
script style iframe object embed form input textarea select button
template noscript svg math link meta base title head body
```

**Dropped, contents kept** — any other element not in the allowlist. A stray
`<div>` or `<section>` becomes its children; a `<script>` becomes nothing.

### Attribute allowlist

This is the entire list. Every attribute not named here is dropped, including all
`on*` handlers — by construction, not by a denylist.

| Attribute | Allowed on | Permitted values |
| --- | --- | --- |
| `class` | `span` `code` `td` `th` | fixed vocabulary only: `ds-bit`, `ds-slot`, `ds-flag`, `ds-val`, `ds-warn` |
| `scope` | `th` | `row`, `col` |
| `colspan` | `td` `th` | integer 1–20 |
| `rowspan` | `td` `th` | integer 1–20 |
| `data-lang` | `pre` | `[a-z0-9-]{1,20}` |

**No URL-bearing attribute is allowed anywhere.** There is no `href`, `src`,
`action`, `formaction`, `srcset`, `poster`, or `xlink:href` in the allowlist. The
requirement to strip `javascript:` and `data:` URLs is therefore met
structurally: there is no attribute a URL could occupy, so there is no URL policy
to implement and no URL policy to get wrong.

`class` is restricted to an enumerated vocabulary rather than accepting arbitrary
values. Arbitrary class names are mostly harmless but can be used for
CSS-selector-based overlay and exfiltration tricks against the page's own
stylesheet, and they defeat theming. The five names cover the stated use —
highlighting a bit or a slot name — and the list can grow with justification.

`id` is excluded: it enables DOM clobbering and collides with the page's own ids.
`style` is excluded outright. `title` is excluded — it is a plain-text tooltip
sink that duplicates content the speech projection would then read twice.

### Table structure rules

Enforced by the sanitizer, not left to the author:

- a `<table>` must contain a `<caption>`; without one the table is dropped (D5).
  Position is not the author's problem — a late caption is hoisted to the front
  and a second one is discarded. Only absence is an error, because the caption is
  what the voice speaks in place of the table.
- `<tr>` is only valid inside `<thead>` / `<tbody>`; a bare `<tr>` is wrapped
- `<th>` / `<td>` are only valid inside `<tr>`
- each table is emitted wrapped in `<div class="ds-md-tablewrap">`, which owns the
  horizontal scroll (see CSS below)

## Where sanitization runs

`src/view-model.ts` becomes the trust boundary. Its current docstring — "Pure
data only — no HTML … escaping happens at the render boundary" — inverts
deliberately to: *narrative arrives untrusted and leaves projected*.

Every narrative field becomes a projection triple:

```ts
interface Narrative {
  html: string;   // sanitized, ready to interpolate
  text: string;   // plain text for attributes, labels, counts, truncation
  speech: string; // speech stream for Aloud
}
```

`ReviewModel` is extended to carry the tour-level narrative it currently lacks
(`title`, `summary`, `intent`, `hotspots`) — without that it covers step-level
fields only and `render.ts` would keep reading raw values off the `Tour`
(`render.ts:187, 653-667, 720`).

`src/story-picker.ts` is a second, independent render surface for `tour.title`
and `tour.summary` (`:50, 58, 66, 70`, with its own private `esc()` at `:7`). It
calls `narrativeText()` directly — both fields are tier C, so plain text is the
correct and complete answer there.

Rejected placements, with reasons:

- **`src/tour.ts` at load** — `loadTour()` returns the parsed object itself
  (`:475`), and `reviewStoryIdentity` hashes `JSON.stringify(tour)`
  (`server.ts:1270`); sanitizing in place would desync the hash. `stories.ts`
  also calls `loadTour()` per story per history-page load, putting sanitize cost
  on the picker.
- **Per call site in `render.ts`** — roughly 30 interpolation sites, each one a
  place to forget.

A test asserts that no raw narrative field reaches a template: the render
functions consume `Narrative` values only.

## Speech projection

`conceptSpeechText()` (`render.ts:1268-1294`) is Markdown-regex-based and matches
nothing in HTML. It is rewritten as `narrativeSpeech()`, preserving its
block-boundary sentence logic — the `endsSentence()` helper at `:1264` and the
per-list-item termination at `:1275` were both learned from listening to real
stories and are pinned by tests.

| Construct | Spoken as |
| --- | --- |
| `p`, `li`, `blockquote`, `h2`–`h4`, `dd` | own sentence, terminated by `endsSentence` |
| `dt` + `dd` | "term: definition." |
| `table` | its `<caption>` text, and nothing else (D5) |
| `pre` | skipped |
| `hr`, `br` | whitespace |
| `code`, `kbd`, `strong`, `em`, `span` | unwrapped to their text |
| `sup`, `sub` | unwrapped to their text |
| entities | decoded exactly once |

Projecting from the parse tree rather than the DOM also fixes a latent defect the
codebase already has: `textContent` inserts no whitespace at element boundaries,
so `<p>A.</p><p>B.</p>` narrates as "A.B.".

The projection is **precomputed server-side** and carried in `Narrative.speech`.
It must not move to the client, because:

- Aloud enforces `batches.join() === text`, and the client aborts with a
  misleading "reinstall Aloud Services" error when `state.total !== sequence.length`
  (`page-assets.ts:2320-2325`)
- beat highlighting is character-offset driven (`page-assets.ts:2019-2021` matched
  against `:2222-2232`); any strip after sequence construction desyncs highlight
  from audio
- `prepareStepNarration` warms audio keyed on exact chunk text
  (`page-assets.ts:2136-2145`); non-deterministic stripping discards warmed audio
  and costs a ~30s cold start on every play

`server.ts` stays a pure pass-through. `speechClean()` on the client is unchanged
and keeps its idempotence property (`test/render-page.test.mjs:2334-2343`); it
will now receive text that never contained tags.

`data-speech-text` and `aria-label` on beats carry `Narrative.speech` and
`Narrative.text` respectively — never `html`.

## Presentation

New rules are needed for `table`, `caption`, `thead`, `tbody`, `tr`, `th`, `td`,
`dl`, `dt`, `dd`, `hr`, `kbd`, `sup`, `sub`, and the five `class` values, in both
`.ds-md` (`page-assets.ts:471-482`) and `.ds-concept-body` (`:786`).

Constraints that are easy to get wrong:

- **`overflow-wrap:anywhere` inherits.** `.ds-md` sets it at the root (`:471`) and
  only `.ds-md-code code` resets it (`:482`). Inside table cells it collapses
  every column to one character per line. Cells must reset it explicitly.
- **The concept column clips rather than scrolls.** `.ds-concept-step` is
  `overflow:hidden` (`:779`); `.ds-concept-scroll` has `overflow-y:auto` and no
  `overflow-x` (`:781`); `.ds-concept-document` is `width:min(100%,860px)` with
  42px side padding (`:782`), giving ≤776px of usable width. A wide table must
  scroll inside `.ds-md-tablewrap` — the same "wide block owns its own overflow"
  pattern `.ds-concept-diagram` already uses (`:787-789`) — so the panel itself
  never scrolls horizontally.
- **Tokens live in one place.** `sharedTokens()` (`theme.ts:129-196`). Dark is the
  `:root` default; light is a full `:root[data-theme="light"]` override at
  `:181-194`. Any new token must be added to both. There is no
  `prefers-color-scheme` media query for tokens.
- **Narrative CSS hardcodes px** and ignores the type-scale tokens; matching its
  neighbours means matching hardcoded values, not introducing scale variables.
- The mobile step-down (`:837`), `prefers-contrast:more` (`:842`), and
  `prefers-reduced-transparency` (`:902`) blocks each need entries for the new
  elements.
- `--text-3` carries an explicit do-not-lower WCAG AA comment
  (`theme.ts:145-146`); table borders and caption text must clear AA in both
  themes.

## Validation

In `validateTour` (`src/tour.ts`):

- reject any tag in a tier C field
- reject block-set tags in a tier B field
- reject any element or attribute outside the allowlist, with the offending name
  in the error, following the `diagram.source` unsafe-pattern precedent
  (`:345-357`, error text pinned at `test/tour.test.mjs:760-763`)
- reject a `<table>` without a `<caption>`

Three existing checks operate on raw strings and must move to the text projection:

- `conceptWordCount` (`tour.ts:655-658`) matches word characters, so it counts
  `<p>` as the word "p" against the 60/220 bounds
- `LINE_NUMBER_OPENER = /^lines?\s+\d/i` (`tour.ts:29`) is `^`-anchored, so a beat
  opening with a tag silently stops matching — disarming the most-taught beat rule
  exactly when the format changes
- `VALUE_TRANSITION` (`tour.ts:29-42`) breaks with markup between digits

## Authoring

`skills/diffstory-storyteller/SKILL.md`:

- `:433-437` — replace the sole Markdown sentence with the HTML contract: which
  tier each field is, the element allowlist per tier, the attribute allowlist,
  and the caption requirement
- `:601-620` (beats), `:698`, `:726-755` (`why`) — state inline-only
- `:1049-1158` — the `## Schema` block is JSON-parsed and run through both
  validators by `test/agent.test.mjs:155-167`; its concept body becomes HTML and
  should demonstrate a table with a caption
- `:439-444` — the Mermaid rules already forbid HTML; leave them, and note that
  the diagram slot is the answer for diagrams (D2)

`src/agent.ts`: `storyPrompt` measures ~3799 chars against a hard `< 4000`
assertion (`test/agent.test.mjs:71-74`), leaving roughly two sentences of
headroom. The format contract is validator-enforced, and `agent.ts:112-115`
states that validator-enforced contracts must live in the prompt because
deep-skill prose does not reliably survive. The ceiling rises to 4500 with that
reason recorded in the test. `storyRepairPrompt` (`:252-287`) is a second
authoring entry point and needs the same rules.

`skills/address-review/SKILL.md` writes `turns[].text` into the comment path,
which stays Markdown. It has no format instruction today; it gains one sentence
saying so, to keep the two formats from bleeding into each other.

Changing SKILL.md by one byte flips every installed copy to "out of date"
(`repo-setup.ts:70-113`, normalized full-text equality). Expected, and worth
mentioning in the changelog.

## Schema documentation

A new `docs/story-schema.md` is the single normative statement of:

- every narrative field and its tier
- the element allowlist per tier
- the attribute allowlist and permitted values
- the table caption requirement and its TTS consequence
- the migration rule (D3), stated as: *narrative fields are HTML; stories
  authored before this change render their Markdown literally and should be
  regenerated*

`src/types.ts:138` currently documents the format inline ("Restricted Markdown:
headings, paragraphs, lists, quotes, emphasis, and inline code"). Each narrative
field's doc comment gains its tier and a pointer to `docs/story-schema.md`.

## Testing

Harness is `node:test` + `node:assert/strict`, importing from `dist/`. No DOM
library, no framework.

**Sanitizer** (`test/narrative.test.mjs`, new) — hostile corpus:

- `<script>`, `<scr<script>ipt>`, `<SCRIPT/SRC=…>`, split across attributes
- `on*` in every casing, with and without quotes, with entity-encoded names
- `javascript:`, `data:`, `vbscript:` in every attribute position (must be
  unreachable — no URL attribute exists)
- attribute injection via unbalanced quotes and stray `>`
- unicode and numeric entity escapes, double-encoded entities
- mXSS: sanitize, re-parse, sanitize again — output must be identical
  (`sanitize(sanitize(x)) === sanitize(x)`)
- `<svg>`, `<math>`, `<foreignObject>`, CDATA, comments — all dropped
- `<template>`, `<noscript>` — dropped with contents
- depth bomb beyond 20 levels
- `colspan="999"`, `colspan="-1"`, `colspan="1e3"` — rejected
- `class="ds-bit evil"`, `class="anything"` — dropped
- tier enforcement: block tags rejected in tier B, all tags rejected in tier C

**Rendering** (`test/render-page.test.mjs`) — the existing security assertion at
`:100-102` asserts `<script>` and `<img onerror>` come back entity-encoded from a
Markdown body. That assertion inverts and is rewritten deliberately, not deleted:
the same payloads must now be *absent* rather than escaped. Plus: table wrapper
present, light and dark rules both emitted, narrow-viewport step-down present, no
horizontal page scroll.

**Speech** (`test/render-page.test.mjs`) — table reads as caption only; `<pre>`
skipped; `<p>A.</p><p>B.</p>` yields "A. B." not "A.B."; no `..` doubling; list
items terminate as sentences; `dt`/`dd` reads as "term: definition."; the existing
narration assertions at `:123-136` are ported to HTML fixtures.

**Client bundle** — `new vm.Script(PAGE_JS)` (`test/comments-client.test.mjs:8`)
is the only syntax gate on the emitted client code, and `node --check` on the
emitted `PAGE_JS` is the project's standing practice after editing it.

## Constraints carried through

- **Zero runtime dependencies.** `package.json` declares no `dependencies` field
  at all. GitHub installs have no build step. DOMPurify requires a DOM, which
  means jsdom — two heavy runtime deps — so a purpose-built sanitizer is the only
  option that preserves the property. It is parser-based, not regex-based.
- **`PAGE_JS` is a TypeScript template string.** Every backslash must be doubled;
  a lost backslash does not throw, it compiles to a different regex (this shipped
  once — `/\s+/` became `/s+/` and split every beat on the letter "s", fixed in
  `fd7cfe8`). No backticks, no `${`, no imports.
- **`dist/` is committed** and must be rebuilt in the same commit. Nothing in CI
  verifies dist matches src.
- `npm run check` = `npm run build && node --test test/*.test.mjs`. The script
  strings are pinned verbatim by `test/release-readiness.test.mjs:27-33`.
- `tsconfig.json` is strict with `noUnusedLocals` / `noUnusedParameters`, so a
  partially-wired module fails the build.

## Out of scope

- Reviewer comment bodies and agent replies stay Markdown (D3).
- `steps[].question` — the field does not exist.
- `storyScope.reviewerNote` display surface — it has none, and is tier C.
- A dist-freshness CI check. Worth having, unrelated to this change.
- Regenerating `docs/ui-atlas/` — Playwright-driven, needs a local browser, and
  `test/ui-atlas.test.mjs` only checks the manifest. The atlas will show
  Markdown-era primers until regenerated.
- The eval rubric (`scripts/eval-stories.mjs:363-370`) has no markup dimension.
  Capture a pre-change baseline label before starting so there is something to
  compare against.
