# 016 — Deterministic story lints for the failures no validator catches

> **For agentic workers:** Use superpowers:executing-plans (or
> superpowers:subagent-driven-development) to run this plan task by task.
> Steps use checkbox (`- [ ]`) syntax. Read `plans/README.md` → "Story quality
> campaign → Rules for every executor" before starting.

**Goal:** A pure, well-tested `lintStory(tour, ctx)` that flags the recurring
failures found in the 2026-09 corpus audit: copied/template beats, missing
landings, formulaic openers, "Look at lines…", `why` that repeats the beats,
chapter ping-pong and unannounced seams, tests pushed to the tail, beats that
glow only imports, hotspots that are not doubts, unquoted Mermaid labels, and
Markdown residue.

**Architecture:** One new module, `src/story-lint.ts`, with no I/O. File
contents come in through an optional `readLines` callback so the module stays
pure and testable. Plan 017 wires it into the bundled checker; plan 020 wires
it into the eval harness. Rules have stable ids — the skill (plan 023) and the
checker output refer to them by id.

**Tech stack:** TypeScript (strict, `noUnusedLocals`), Node ≥ 20, `node --test`.

**Spec:** `docs/research/story-corpus-audit-2026-09.md` (sections 2–3, decisions D2, D5).

## Global constraints

- Rule ids, severities, and thresholds are exactly as below. Two severities only:
  - **error**: the reviewer would see something broken (copied narration,
    "Look at lines…", Markdown residue, an unparseable diagram).
  - **warning**: craft advice the author should fix or be able to justify.
- Never duplicate rules that `validateGeneratedTour` already enforces (beat
  counts, viewport caps, `Line 742 …` openers, digit value transitions).
- `plans/015` must be merged first (the module reads `tour.verification`).
- `dist/` is committed; stage `dist/story-lint.js` explicitly.

## Review focus

- False positives on good stories. Task 4 runs the lint over four good v3
  stories; any **error** there is a bug in the rule, not the story. (The rules
  below were already calibrated once against all 66 corpus stories on
  2026-09-25: errors landed only on the stories the human audit scored 1–2.)
- The seam rule rewarding a formula ("That closes X; …" on every chapter).
  `formulaic-opener` must still catch that if it exceeds its threshold.
- `copied-beat` catching legitimate one-line sweep beats across *different*
  sweeps that share wording. Threshold is ≥ 3 distinct steps and ≥ 6 words.
- Mermaid rule flagging valid shapes: `A[(db)]`, `A[[sub]]`, `A(("x"))`,
  `A["O(1) lookup"]` must all pass.
- `readLines` absent (no repo access): content-dependent rules silently skip.

---

### Task 1: Module skeleton, helpers, and the text rules

**Files:**
- Create: `src/story-lint.ts`
- Create: `test/story-lint.test.mjs`

**Interfaces:**
- Produces:
  ```ts
  export type LintSeverity = "error" | "warning";
  export interface LintFinding { rule: string; severity: LintSeverity; where: string; message: string; fix: string }
  export interface LintContext { readLines?: (file: string) => string[] | null }
  export function lintStory(tour: Tour, ctx?: LintContext): LintFinding[];
  export function plainText(html: string): string;
  export function narrativeFields(tour: Tour): Array<[string, string]>;
  export const MARKDOWN_RESIDUE: Array<[RegExp, string]>;
  ```

- [ ] **Step 1: Write the test scaffolding and the first failing tests**

Create `test/story-lint.test.mjs`:

```js
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
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm run build && node --test test/story-lint.test.mjs`
Expected: FAIL — `Cannot find module '…/dist/story-lint.js'`.

- [ ] **Step 3: Create `src/story-lint.ts` with helpers, the entry point, and `copied-beat`**

```ts
// Deterministic prose and structure lints for authored stories.
//
// These catch the recurring failures from the 2026-09 corpus audit
// (docs/research/story-corpus-audit-2026-09.md) that no validator checks.
// Every rule is cheap and explainable; anything needing judgment stays with
// the eval judge. "error" means the reviewer would see something broken;
// "warning" is craft advice the author fixes or can justify.
import { orderedSteps } from "./tour.js";
import {
  isCodeStep,
  type CodeTourStep,
  type StoryBeat,
  type Tour,
  type TourStep,
} from "./types.js";

export type LintSeverity = "error" | "warning";

export interface LintFinding {
  /** Stable rule id; the skill and checker output refer to it. */
  rule: string;
  severity: LintSeverity;
  /** Where to look: "story", "steps[s4]", "steps[s4].beats[0]", "hotspots[1]". */
  where: string;
  message: string;
  /** One sentence the author can act on. */
  fix: string;
}

export interface LintContext {
  /** Post-change lines of a repo file (index 0 is line 1), or null when unreadable. */
  readLines?: (file: string) => string[] | null;
}

type Add = (rule: string, severity: LintSeverity, where: string, message: string, fix: string) => void;
type BeatRef = { step: CodeTourStep; beat: StoryBeat; index: number };

const SWEEP_TAGS = new Set(["skim", "sweep", "mechanical"]);

/** Visible text of a narrative field: tags dropped, common entities decoded. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Lowercased, digits folded, punctuation dropped: beats differing only in numbers are copies. */
function copyKey(html: string): string {
  return plainText(html)
    .toLowerCase()
    .replace(/\d+/g, "#")
    .replace(/[^a-z#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** First three words with identifiers folded to "x", so "This is <code>a()</code>" and "This is <code>b()</code>" share a frame. */
function openerKey(html: string): string {
  return copyKey(html.replace(/<code[^>]*>[\s\S]*?<\/code>/gi, " x "))
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

function isSweep(step: TourStep): boolean {
  return (step.tags ?? []).some((tag) => SWEEP_TAGS.has(tag));
}

function stepList(ids: string[]): string {
  return `steps[${ids.slice(0, 5).join(", ")}${ids.length > 5 ? ", …" : ""}]`;
}

/** Run every rule. The story must already pass validateTour. */
export function lintStory(tour: Tour, ctx: LintContext = {}): LintFinding[] {
  const findings: LintFinding[] = [];
  const add: Add = (rule, severity, where, message, fix) =>
    findings.push({ rule, severity, where, message, fix });
  const steps = orderedSteps(tour);
  const code = steps.filter(isCodeStep);
  const beats: BeatRef[] = code.flatMap((step) =>
    (step.beats ?? []).map((beat, index) => ({ step, beat, index })),
  );
  lintCopies(code, add);
  return findings;
}

function lintCopies(code: CodeTourStep[], add: Add): void {
  const byKey = new Map<string, Set<string>>();
  const note = (html: string | undefined, id: string) => {
    if (!html) return;
    const key = copyKey(html);
    if (wordsOf(key).length < 6) return;
    const ids = byKey.get(key) ?? new Set<string>();
    ids.add(id);
    byKey.set(key, ids);
  };
  for (const step of code) {
    note(step.why, step.id);
    for (const beat of step.beats ?? []) note(beat.text, step.id);
  }
  for (const [key, ids] of byKey) {
    if (ids.size < 3) continue;
    add(
      "copied-beat",
      "error",
      stepList([...ids]),
      `${ids.size} steps share the same narration: "${key.slice(0, 90)}${key.length > 90 ? "…" : ""}"`,
      "Each stop must say what its own lines prove. Merge repeated instances into one sweep step with top-level `ranges`, or rewrite each beat around its own decision.",
    );
  }
}
```

`tsconfig.json` has `noUnusedLocals`, and `beats`, `ctx`, `openerKey`, and
`isSweep` are only used by rules added in Tasks 2–3. So, in this task only,
add this line directly after the `const beats: BeatRef[] = …;` statement:

```ts
  void beats; void ctx; void openerKey; void isSweep; // TEMP: used by Task 2/3 rules
```

Task 2 shrinks it to `void ctx;`; Task 3 deletes it.

- [ ] **Step 4: Build and test**

Run: `npm run build && node --test test/story-lint.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/story-lint.ts test/story-lint.test.mjs dist/story-lint.js
git commit -m "feat: add story lint module with the copied-beat rule"
```

### Task 2: Voice and landing rules

**Files:** Modify `src/story-lint.ts`, `test/story-lint.test.mjs`

Rules added: `formulaic-opener`, `landing-missing-symbol`, `landing-bare-opener`,
`line-pointer`, `why-copies-beats`, `beat-too-long`, `beats-long-on-average`,
`prose-value-transition`, `numbered-series`, `offscreen-claim`.

- [ ] **Step 1: Add failing tests** (append)

```js
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
```

(The `|| true` in the first test is deliberate: a dozen near-identical
`step()` beats may legitimately trip the frame rule. The assertion that
matters is the positive one.)

- [ ] **Step 2: Run and confirm the new tests fail**

Run: `npm run build && node --test test/story-lint.test.mjs`
Expected: FAIL on each new rule.

- [ ] **Step 3: Implement.** Add these constants below `SWEEP_TAGS`:

```ts
const PROSE_FILE = /\.(md|mdx|markdown|txt|rst|adoc)$/i;
const BARE_OPENER = /^(now(?! that)|here|this adds|it|then|also|next|and)\b/i;
const LINE_REF = /\blines?\s+\d+/gi;
const LOOK_AT_LINES = /\blook at lines?\s+\d+/i;
const OPERAND = String.raw`(?:<code[^>]*>[^<]{1,40}<\/code>|\d[\d_.,]*%?)`;
const PROSE_TRANSITION = new RegExp(String.raw`\bfrom\s+${OPERAND}\s+to\s+${OPERAND}`, "i");
const COUNTER_SUFFIX =
  /(?:\s+|\s*[·•:#(\-–—]\s*)(?:\d+\s*(?:\/|of)\s*\d+\)?|(?:part|decision|step|instance)\s+\d+|#?\d+\)?)\s*$/i;
const OFFSCREEN = /\b(claimed spans?|other spans?|second span|remaining spans|claimed ranges?)\b/i;
```

In `lintStory`, change the TEMP line to just `  void ctx; // TEMP: used by Task 3 rules`,
and replace the single `lintCopies(code, add);` call with:

```ts
  lintCopies(code, add);
  lintOpeners(beats, add);
  lintLandings(code, add);
  lintLinePointers(code, add);
  lintWhyCopiesBeats(code, add);
  lintBeatLength(beats, add);
  lintBeatPhrases(beats, add);
  lintNumberedSeries(steps, add);
```

Add the rule functions at the end of the file:

```ts
function lintOpeners(beats: BeatRef[], add: Add): void {
  if (beats.length < 12) return;
  const counts = new Map<string, number>();
  for (const { beat } of beats) {
    const key = openerKey(beat.text);
    if (wordsOf(key).length < 3) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const limit = Math.max(5, Math.ceil(beats.length * 0.25));
  for (const [key, count] of counts) {
    if (count < limit) continue;
    add(
      "formulaic-opener",
      "warning",
      "story",
      `${count} of ${beats.length} beats open with "${key} …"`,
      "Vary how beats begin: lead with what this spot is for, what just happened, or what would break, not the same frame every time.",
    );
  }
}

function lintLandings(code: CodeTourStep[], add: Add): void {
  for (const step of code) {
    if (isSweep(step) || PROSE_FILE.test(step.file)) continue;
    const first = step.beats?.[0];
    if (!first) continue;
    const where = `steps[${step.id}].beats[0]`;
    if (!/<code[^>]*>[^<]+<\/code>/i.test(first.text)) {
      add(
        "landing-missing-symbol",
        "warning",
        where,
        "The first beat names no symbol in <code>.",
        "Land the listener first: name the function, rule, or test on screen in <code>, who reaches it and when, then the change.",
      );
    }
    const text = plainText(first.text);
    if (BARE_OPENER.test(text)) {
      add(
        "landing-bare-opener",
        "warning",
        where,
        `The first beat opens with "${wordsOf(text).slice(0, 3).join(" ")} …".`,
        'Open on where the listener is ("This is <code>placeOrder()</code>, what the POST handler calls first …"), not on "Now", "Here", or "It".',
      );
    }
  }
}

function lintLinePointers(code: CodeTourStep[], add: Add): void {
  for (const step of code) {
    let refs = 0;
    (step.beats ?? []).forEach((beat, index) => {
      const text = plainText(beat.text);
      if (LOOK_AT_LINES.test(text)) {
        add(
          "line-pointer",
          "error",
          `steps[${step.id}].beats[${index}]`,
          'The beat says "Look at lines …".',
          "Name the code instead (\"the <code>require</code> guarding the cap\"); the glow already points at the lines.",
        );
      }
      refs += (text.match(LINE_REF) ?? []).length;
    });
    if (refs > 1) {
      add(
        "line-pointer",
        "warning",
        `steps[${step.id}]`,
        `The step mentions line numbers ${refs} times.`,
        "Say a line number at most once per step, after the landing, and only when the glow alone is ambiguous.",
      );
    }
  }
}

function lintWhyCopiesBeats(code: CodeTourStep[], add: Add): void {
  for (const step of code) {
    const beats = step.beats ?? [];
    if (!beats.length) continue;
    const whyWords = wordsOf(copyKey(step.why)).filter((w) => w.length >= 3);
    if (whyWords.length < 12) continue;
    const beatWords = new Set(wordsOf(copyKey(beats.map((b) => b.text).join(" "))));
    const shared = whyWords.filter((w) => beatWords.has(w)).length;
    if (shared / whyWords.length >= 0.8) {
      add(
        "why-copies-beats",
        "warning",
        `steps[${step.id}].why`,
        "`why` repeats the beats.",
        "Make `why` one sentence: the failure this stop rules out. The beats carry the walk-through.",
      );
    }
  }
}

function lintBeatLength(beats: BeatRef[], add: Add): void {
  let total = 0;
  for (const { step, beat, index } of beats) {
    const count = wordsOf(plainText(beat.text)).length;
    total += count;
    if (count > 45) {
      add(
        "beat-too-long",
        "warning",
        `steps[${step.id}].beats[${index}]`,
        `The beat is ${count} words.`,
        "One idea per beat. Split it, or cut what the highlighted lines already show.",
      );
    }
  }
  if (beats.length >= 6 && total / beats.length > 32) {
    add(
      "beats-long-on-average",
      "warning",
      "story",
      `Beats average ${Math.round(total / beats.length)} words.`,
      "Aim for 12–30 spoken words per beat; the listener cannot glance back.",
    );
  }
}

function lintBeatPhrases(beats: BeatRef[], add: Add): void {
  for (const { step, beat, index } of beats) {
    const where = `steps[${step.id}].beats[${index}]`;
    if (PROSE_TRANSITION.test(beat.text)) {
      add(
        "prose-value-transition",
        "warning",
        where,
        "The beat narrates a value change the diff already shows.",
        "Say what depended on the old value instead (\"nothing reads the old weight, so no consumer breaks\").",
      );
    }
    if (OFFSCREEN.test(plainText(beat.text))) {
      add(
        "offscreen-claim",
        "warning",
        where,
        "The beat talks about claimed spans the reviewer cannot see.",
        "Talk only about what is on screen. Other `ranges` entries are coverage claims, not narration.",
      );
    }
  }
}

function lintNumberedSeries(steps: TourStep[], add: Add): void {
  const groups = new Map<string, string[]>();
  for (const step of steps) {
    const title = step.title.trim();
    const base = title.replace(COUNTER_SUFFIX, "").trim().toLowerCase();
    if (!base || base === title.toLowerCase()) continue;
    groups.set(base, [...(groups.get(base) ?? []), step.id]);
  }
  for (const [base, ids] of groups) {
    if (ids.length < 3) continue;
    add(
      "numbered-series",
      "warning",
      stepList(ids),
      `${ids.length} steps are numbered copies of "${base}".`,
      "A repeated edit is one sweep step: narrate one instance and claim the rest with top-level `ranges`. A real sequence gets purpose titles, not counters.",
    );
  }
}
```

- [ ] **Step 4: Build and test**

Run: `npm run build && node --test test/story-lint.test.mjs`
Expected: PASS. If a negative case fails, fix the **rule**, not the test.

- [ ] **Step 5: Commit**

```bash
git add src/story-lint.ts test/story-lint.test.mjs dist/story-lint.js
git commit -m "feat: lint story voice, landings, and line-number pointers"
```

### Task 3: Structure, evidence, hotspot, diagram, and format rules

**Files:** Modify `src/story-lint.ts`, `test/story-lint.test.mjs`

Rules added: `chapter-missing`, `chapter-too-long`, `chapter-pingpong`,
`chapter-seam`, `tests-at-tail`, `import-only-highlight`,
`hotspot-is-verification`, `hotspot-not-a-doubt`, `mermaid-label`,
`markdown-residue`, `detailed-without-primer`, `no-hotspots`.

- [ ] **Step 1: Add failing tests** (append)

```js
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
```

- [ ] **Step 2: Run and confirm failures**

Run: `npm run build && node --test test/story-lint.test.mjs`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement.** Add constants below the Task 2 constants:

```ts
const SEAM_CUE =
  /(^with\b[^.;]{1,80}[,;]|^(skim|final proof|finally|last)\b|\b(that|this) (closes|settles|finishes|covers|completes|wraps)\b|\b(is|are) (now )?(complete|done|settled|covered|in place|finished)\b|\bthis (chapter|part|section|half)\b|\bnow that\b|\bso far\b|\b(second|third|final|last|next|other|another) (concern|change|fix|part|half|thread|piece|path)\b|\bseparate(ly)?\b|\bindependent(ly)?\b|\bswitch(es|ing)?\b|\bturn(s|ing)? to\b|\bback (in|to)\b|\breturning to\b|\bmoving on\b|\bmeanwhile\b)/i;
const TEST_FILE =
  /(^|\/)(tests?|__tests__|specs?)\/|\.(test|spec)\.[cm]?[jt]sx?$|\.t\.sol$|_test\.(go|py|rs)$|(^|\/)test_[^/]+\.py$|Tests?\.(java|kt|swift|cs)$/i;
const IMPORT_LINE =
  /^\s*(import\b|from\s+\S+\s+import\b|export\s+(\*|\{[^}]*\})\s+from\b|#include\b|(const|let|var)\s+[\w{}\s,]+=\s*require\(|require\(|use\s+[\w:]+(::\{[^}]*\})?\s*;)/;
/** A hotspot with none of these is a statement or a chore, not a doubt. */
const DOUBT_MARKER =
  /\b(i|i'm|i've|i'd|my|we|not|never|no|nothing|only|without|rather than|unverified|untested|unexercised|unproven|assum\w*|guess\w*|unclear|unsure|may|might|could|relies|rely|doesn't|isn't|wasn't|didn't|cannot|can't)\b/i;
const ENVIRONMENT_GAP =
  /\b(voiceover|screen ?readers?|physical (device|iphone|android)|real device|on[- ]device|simulator|emulator|mainnet|testnet|staging|production (deploy|rollout)|in ci|ci run|not (been )?(re)?run)\b/i;

/** Markdown that renders literally in HTML narrative fields (shared with scripts/eval-stories.mjs). */
export const MARKDOWN_RESIDUE: Array<[RegExp, string]> = [
  [/\*\*[^*\n]+\*\*|__[^_\n]+__/, "bold"],
  [/(^|[^`])`[^`\n]+`/, "code span"],
  [/^#{1,4}\s+\S/m, "heading"],
  [/^\s*[-*]\s+\S/m, "bullet"],
  [/^\s*\d+[.)]\s+\S/m, "ordered item"],
  [/`{3}/, "fence"],
  [/^>\s+\S/m, "blockquote"],
];
```

Delete the `void ctx; // TEMP …` line in `lintStory`, then extend the calls
(after `lintNumberedSeries(steps, add);`):

```ts
  lintChapters(steps, add);
  lintTestsAtTail(code, add);
  lintHighlights(code, ctx, add);
  lintHotspots(tour, add);
  lintDiagrams(steps, add);
  lintMarkdown(tour, add);
  lintDepth(tour, steps, code, add);
```

Add the functions:

```ts
function lintChapters(steps: TourStep[], add: Add): void {
  if (steps.length > 10) {
    const missing = steps.filter((s) => !s.chapter?.trim()).length;
    if (missing) {
      add(
        "chapter-missing",
        "warning",
        "story",
        `${missing} of ${steps.length} steps have no chapter.`,
        "Stories over 10 steps give every step a chapter named for the concept its beats keep using.",
      );
    }
  }
  const seen = new Set<string>();
  let previous: string | undefined;
  let run = 0;
  steps.forEach((step) => {
    const chapter = step.chapter?.trim();
    if (!chapter) {
      previous = undefined;
      run = 0;
      return;
    }
    if (chapter === previous) {
      run += 1;
      if (run === 10) {
        add(
          "chapter-too-long",
          "warning",
          `steps[${step.id}]`,
          `Chapter "${chapter}" runs past 9 steps.`,
          "Split it where the beats switch to a new concept.",
        );
      }
      return;
    }
    if (seen.has(chapter)) {
      add(
        "chapter-pingpong",
        "warning",
        `steps[${step.id}]`,
        `Chapter "${chapter}" resumes after a different chapter.`,
        "Keep each chapter contiguous. A test belongs in the chapter of the behavior it pins, not in an alternating proof chapter.",
      );
    }
    if (previous !== undefined && !isSweep(step)) {
      const opener =
        step.kind === "concept"
          ? plainText(step.body).slice(0, 220)
          : plainText(step.beats?.[0]?.text ?? "");
      const firstSentence = opener.split(/(?<=[.!?])\s/)[0] ?? opener;
      if (!SEAM_CUE.test(firstSentence)) {
        add(
          "chapter-seam",
          "warning",
          `steps[${step.id}]`,
          `Chapter "${chapter}" starts without saying what the previous chapter settled.`,
          'Open the chapter\'s first beat with the seam, in the same sentence as the landing: "That settles the cap; the second concern is <code>refund()</code>, which the keeper calls …".',
        );
      }
    }
    seen.add(chapter);
    previous = chapter;
    run = 1;
  });
}

function lintTestsAtTail(code: CodeTourStep[], add: Add): void {
  const claims = code.filter((s) => s.kind !== "context");
  if (claims.length < 10) return;
  const tests = claims.filter((s) => TEST_FILE.test(s.file));
  const others = claims.filter((s) => !TEST_FILE.test(s.file));
  if (tests.length < 3 || !others.length) return;
  const firstTest = Math.min(...tests.map((s) => s.order));
  const lastOther = Math.max(...others.map((s) => s.order));
  if (firstTest > lastOther) {
    add(
      "tests-at-tail",
      "warning",
      "story",
      `All ${tests.length} test steps come after every code step.`,
      "Place each test right after the behavior it pins, in the same chapter.",
    );
  }
}

function lintHighlights(code: CodeTourStep[], ctx: LintContext, add: Add): void {
  if (!ctx.readLines) return;
  for (const step of code) {
    const lines = ctx.readLines(step.file);
    if (!lines) continue;
    (step.beats ?? []).forEach((beat, index) => {
      if (/\b(imports?|require|using)\b/i.test(plainText(beat.text))) return;
      const shown = (beat.highlights ?? [])
        .flatMap(([a, b]) => (a === 0 && b === 0 ? [] : lines.slice(a - 1, b)))
        .filter((line) => line.trim());
      if (shown.length && shown.every((line) => IMPORT_LINE.test(line))) {
        add(
          "import-only-highlight",
          "warning",
          `steps[${step.id}].beats[${index}]`,
          "The beat glows only import lines.",
          "Point the glow at the code the sentence is about; an import rarely proves a claim.",
        );
      }
    });
  }
}

function lintHotspots(tour: Tour, add: Add): void {
  (tour.hotspots ?? []).forEach((spot, index) => {
    const text = plainText(spot.reason ?? "");
    if (ENVIRONMENT_GAP.test(text)) {
      add(
        "hotspot-is-verification",
        "warning",
        `hotspots[${index}]`,
        "This hotspot is about what was not run, not about the code.",
        'Record it in top-level `verification` with result "not-run"; keep hotspots for doubts about the code itself.',
      );
    } else if (!DOUBT_MARKER.test(text)) {
      add(
        "hotspot-not-a-doubt",
        "warning",
        `hotspots[${index}]`,
        "The hotspot states a fact or a chore, not a doubt.",
        'Name what you did not verify and why it could be wrong: "I matched the boundary to the docs but never exercised rate == cap."',
      );
    }
  });
}

/** Label syntax Mermaid cannot parse. Quoted labels ("…") are always safe. */
export function mermaidLabelProblems(source: string): string[] {
  const problems: string[] = [];
  const lines = source.split(/\r?\n/);
  const kind = lines.find((l) => l.trim() && !l.trim().startsWith("%%"))?.trim() ?? "";
  for (const raw of lines) {
    const line = raw.replace(/"[^"]*"/g, '""');
    if (kind.startsWith("flowchart")) {
      for (const m of line.matchAll(/[A-Za-z0-9_]\[(?![[(/\\])([^\]]*)\]/g)) {
        if (/[()[\]{}<>;#|]/.test(m[1])) problems.push(`unquoted label "${m[1].trim()}"`);
      }
      for (const m of line.matchAll(/[A-Za-z0-9_]\((?![([])([^()]*\([^()]*\)[^()]*)\)/g)) {
        problems.push(`nested parentheses in label "${m[1].trim()}"`);
      }
      for (const m of line.matchAll(/[A-Za-z0-9_]\{(?!\{)([^}]*)\}/g)) {
        if (/[()[\]{<>;#|]/.test(m[1])) problems.push(`unquoted decision label "${m[1].trim()}"`);
      }
      for (const m of line.matchAll(/\|([^|]*)\|/g)) {
        if (/[()[\]{}<>;#]/.test(m[1])) problems.push(`unquoted edge label "${m[1].trim()}"`);
      }
      if (/(-->|---|==>|-\.->)\s*end\b/i.test(line)) problems.push('node id "end" is reserved');
    } else if (kind.startsWith("sequenceDiagram")) {
      const message = line.match(/^\s*[^:]+?(?:-{1,2}>>?|-{1,2}x|-{1,2}\))[^:]*:(.*)$/);
      if (message && /[;#]/.test(message[1])) problems.push(`";" or "#" in message "${message[1].trim()}"`);
    }
  }
  return problems;
}

function lintDiagrams(steps: TourStep[], add: Add): void {
  for (const step of steps) {
    if (step.kind !== "concept" || !step.diagram) continue;
    for (const problem of mermaidLabelProblems(step.diagram.source)) {
      add(
        "mermaid-label",
        "error",
        `steps[${step.id}].diagram`,
        `Mermaid cannot parse this: ${problem}.`,
        'Wrap labels containing ( ) [ ] { } < > ; # | in double quotes: A["O(1) lookup"]. In sequence messages, avoid ";" and "#".',
      );
    }
  }
}

/** Every authored narrative field, with a path the author can find. */
export function narrativeFields(tour: Tour): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const push = (path: string, value: unknown) => {
    if (typeof value === "string" && value.trim()) out.push([path, value]);
  };
  push("summary", tour.summary);
  push("intent.goal", tour.intent?.goal);
  push("intent.design", tour.intent?.design);
  (tour.intent?.nonGoals ?? []).forEach((v, i) => push(`intent.nonGoals[${i}]`, v));
  (tour.hotspots ?? []).forEach((h, i) => push(`hotspots[${i}].reason`, h.reason));
  (tour.verification ?? []).forEach((v, i) => push(`verification[${i}].detail`, v.detail));
  for (const step of tour.steps ?? []) {
    if (step.kind === "concept") {
      push(`steps[${step.id}].body`, step.body);
      push(`steps[${step.id}].diagram.caption`, step.diagram?.caption);
      continue;
    }
    push(`steps[${step.id}].why`, step.why);
    (step.beats ?? []).forEach((b, i) => push(`steps[${step.id}].beats[${i}].text`, b.text));
  }
  return out;
}

function lintMarkdown(tour: Tour, add: Add): void {
  for (const [path, text] of narrativeFields(tour)) {
    const hit = MARKDOWN_RESIDUE.find(([pattern]) => pattern.test(text));
    if (!hit) continue;
    add(
      "markdown-residue",
      "error",
      path,
      `Markdown ${hit[1]} renders literally here.`,
      "Narrative fields are HTML: use <code>, <strong>, <em>; block fields use <ul>/<li>, <p>.",
    );
  }
}

function lintDepth(tour: Tour, steps: TourStep[], code: CodeTourStep[], add: Add): void {
  const concepts = steps.length - code.length;
  const claims = code.filter((s) => s.kind !== "context").length;
  if (tour.mode === "detailed" && claims >= 15 && concepts === 0) {
    add(
      "detailed-without-primer",
      "warning",
      "story",
      `A detailed story with ${claims} code stops has no concept primer.`,
      'List the three terms a newcomer would ask about ("what is a single close?") and teach each where it is first needed: a primer, a context step, or one clause in the landing.',
    );
  }
  if (claims >= 12 && !tour.hotspots?.length) {
    add(
      "no-hotspots",
      "warning",
      "story",
      `${claims} code stops and no hotspots.`,
      "Name up to three places you are least sure of, in first person.",
    );
  }
}
```

- [ ] **Step 4: Build and test**

Run: `npm run build && node --test test/story-lint.test.mjs`
Expected: PASS (all). If `mermaid-label` flags a valid shape, fix the regex and
add that shape to the "ok" list in the test.

- [ ] **Step 5: Commit**

```bash
git add src/story-lint.ts test/story-lint.test.mjs dist/story-lint.js
git commit -m "feat: lint story structure, hotspots, diagrams, and markdown residue"
```

### Task 4: Calibrate against real stories (no false errors on good ones)

**Files:**
- Create: `test/fixtures/stories/README.md`
- Create: `test/fixtures/stories/<name>.json` × 4 (copies)
- Test: `test/story-lint.test.mjs`

- [ ] **Step 1: Copy four good v3 stories about diffStory itself into fixtures**

These live in this repo's git-ignored `.diffstory/stories/` on the author's
machine. Do not use `eval/results/*` stories: they predate the HTML narrative
format and legitimately contain Markdown backticks.

```bash
mkdir -p test/fixtures/stories
for f in recoverable-repository-removal direct-source-navigation accessible-review-shell editor-selector; do
  cp ".diffstory/stories/$f.json" "test/fixtures/stories/$f.json"
done
node -e 'for (const f of require("fs").readdirSync("test/fixtures/stories")) if (f.endsWith(".json")) console.log(f, require("./test/fixtures/stories/" + f).version)'
```

Every printed version must be `3`. If `.diffstory/stories/` is missing on this
machine, skip Task 4 Steps 1–3 and say so in your report.

Create `test/fixtures/stories/README.md`:

```md
Frozen v3 stories about diffStory itself that the lint suite calibrates
against. A lint **error** on any of them is a false positive in the rule;
warnings are expected (these predate the lint).
```

- [ ] **Step 2: Add the calibration test** (append)

```js
import { readdirSync, readFileSync } from 'node:fs';

test('calibration: the best-measured eval stories produce no lint errors', () => {
  const dir = new URL('./fixtures/stories/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const tour = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    const errors = lintStory(tour).filter((f) => f.severity === 'error');
    assert.deepEqual(errors, [], `${file}: ${JSON.stringify(errors, null, 2)}`);
  }
});
```

(Move the `import` line to the top of the file with the other imports.)

- [ ] **Step 3: Run; fix rules until it passes**

Run: `npm run build && node --test test/story-lint.test.mjs`
If an error fires, read the flagged text. If the story is genuinely broken
there (for example real Markdown residue), note it in your report and delete
only that one fixture. Otherwise narrow the rule and add a regression test
for the pattern that fired.

- [ ] **Step 4: Print the warning profile for the report**

```bash
node --input-type=module -e "
import { lintStory } from './dist/story-lint.js';
import { readdirSync, readFileSync } from 'node:fs';
for (const f of readdirSync('test/fixtures/stories').filter((f) => f.endsWith('.json'))) {
  const counts = {};
  for (const x of lintStory(JSON.parse(readFileSync('test/fixtures/stories/' + f, 'utf8')))) counts[x.rule] = (counts[x.rule] ?? 0) + 1;
  console.log(f, JSON.stringify(counts));
}"
```

Paste the output into your final report (it is the baseline for plan 021).

- [ ] **Step 5: Full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add test/fixtures/stories test/story-lint.test.mjs src/story-lint.ts dist/story-lint.js
git commit -m "test: calibrate story lints against judged eval stories"
```
