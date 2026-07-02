# Narrative-First Story Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated review stories open with a grounded "why this change" (a first-class `intent` block rendered in the app) and read as a causal narrative instead of file-by-file code explanation.

**Architecture:** A new optional `StoryIntent` block flows through the existing story pipeline: authored by the agent (rules added to `storyPrompt` and SKILL.md), validated in `tour.ts`, rendered in the Overview panel in `render.ts`. Both prompt documents are restructured around a 3-phase spine (recover the why → design the reading path → write the steps) with two new hard rules (thread rule, order test) and a falsifiable self-review.

**Tech Stack:** TypeScript (ESM, `tsc` build to `dist/`), Node.js built-in test runner (`node --test`), no runtime deps.

**Spec:** `docs/superpowers/specs/2026-07-02-narrative-intent-story-pipeline-design.md`

## Global Constraints

- Node >= 20; `npm test` runs `npm run build && node --test test/*.test.mjs` — tests always exercise `dist/`, so build before any test run.
- `dist/` is committed to git: every commit that touches `src/` MUST include the rebuilt `dist/` files (GitHub installs have no build step).
- Validation stays hand-rolled (no schema dependency), matching the existing style in `src/tour.ts`.
- `intent` is OPTIONAL in the schema — old stories without it must stay valid and render exactly as today.
- The headless story agent cannot ask questions (`claude -p`, stdin closed): `storyPrompt` must keep ending with `Do not ask questions. Generate it directly.` Only SKILL.md (in-session path) may permit questions.
- UI follows the existing Apple-HIG-style system: reuse CSS variables (`--text`, `--muted`, `--accent-blue`) and the `ds-intro-*` class family in `src/page-assets.ts`.
- All existing mechanics contracts (coverage ledger, range/viewport/highlights, beats, deletion sentinels, truth rules) keep their exact force — they are recompressed in presentation, never weakened.

---

### Task 0: Baseline — commit the pre-existing beats WIP

The working tree contains an uncommitted, test-covered feature (beat-by-beat narration + viewport/highlights work across 18 files). Our commits must not sweep it in. Commit it as its own commit first, after verifying it is green.

**Files:**
- Modify: none (commit existing working-tree state as-is)

**Interfaces:**
- Produces: a clean working tree; all later tasks' diffs contain only their own changes.

- [ ] **Step 1: Verify the current tree is green**

Run: `npm test`
Expected: all tests pass. If anything fails, STOP and report — do not commit a broken baseline.

- [ ] **Step 2: Commit the WIP**

```bash
git add -u
git commit -m "feat: beat-by-beat read-aloud narration with synced highlights"
```

- [ ] **Step 3: Verify the tree is clean**

Run: `git status --short`
Expected: no output (nothing modified, nothing staged).

---

### Task 1: `StoryIntent` type + validation

**Files:**
- Modify: `src/types.ts` (add `StoryIntent` interface; add `intent?` to `Tour`)
- Modify: `src/tour.ts` (add `validateIntent`, call it from `validateTour`)
- Test: `test/tour.test.mjs`

**Interfaces:**
- Produces: `interface StoryIntent { goal: string; design?: string; sources?: string[] }` exported from `src/types.ts`; `Tour.intent?: StoryIntent`. `validateTour` errors: `'intent must be an object'`, `'intent.goal is required'`, `'intent.design must be a string'`, `'intent.sources must be a non-empty array'`, `` `intent.sources[${i}] must be a non-empty string` ``.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing tests**

Append to `test/tour.test.mjs`:

```js
test('accepts a story intent block with goal, design, and sources', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    intent: {
      goal: 'We wanted keepers to settle funding without one market draining balances.',
      design: 'settleFunding() clamps through one shared helper.',
      sources: ['commit 41af8b7', 'PR #12 body'],
    },
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  });
  assert.deepEqual(errs, []);
});

test('a story without an intent block stays valid', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  });
  assert.deepEqual(errs, []);
});

test('intent.goal is required when intent is present', () => {
  const base = {
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  };
  assert.ok(validateTour({ ...base, intent: {} }).includes('intent.goal is required'));
  assert.ok(validateTour({ ...base, intent: { goal: '   ' } }).includes('intent.goal is required'));
  assert.ok(validateTour({ ...base, intent: 'why' }).includes('intent must be an object'));
});

test('intent.design and intent.sources are type-checked when present', () => {
  const base = {
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  };
  assert.ok(validateTour({ ...base, intent: { goal: 'g', design: 7 } }).includes('intent.design must be a string'));
  assert.ok(validateTour({ ...base, intent: { goal: 'g', sources: [] } }).includes('intent.sources must be a non-empty array'));
  assert.ok(validateTour({ ...base, intent: { goal: 'g', sources: 'commit' } }).includes('intent.sources must be a non-empty array'));
  assert.ok(validateTour({ ...base, intent: { goal: 'g', sources: ['ok', ''] } }).includes('intent.sources[1] must be a non-empty string'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run build && node --test test/tour.test.mjs`
Expected: the three new error-checking tests FAIL (validateTour currently returns `[]` for these inputs — the assertions on error strings fail). The two "accepts" tests pass trivially.

- [ ] **Step 3: Add the type**

In `src/types.ts`, insert after the `StoryBeat` interface (currently ends line 35) and before `TourStep`:

```ts
/** The recovered "why" behind the change — shown before any step. */
export interface StoryIntent {
  /** What we wanted to enable: actor + capability, 1-2 sentences. */
  goal: string;
  /** The flow designed to achieve it, 1-2 sentences. */
  design?: string;
  /** Evidence the goal rests on: "commit 41af8b7", "PR #12 body", "conversation", "docs/plan.md", or "code-derived". */
  sources?: string[];
}
```

In the `Tour` interface, insert after the `summary: string;` line:

```ts
  /** Optional recovered intent: the goal, designed flow, and evidence sources. */
  intent?: StoryIntent;
```

- [ ] **Step 4: Add the validator**

In `src/tour.ts`, insert after the `validateBeats` function (before `loadTour`):

```ts
function validateIntent(t: Record<string, unknown>, errors: string[]): void {
  if (t.intent === undefined) return;
  if (typeof t.intent !== 'object' || t.intent === null || Array.isArray(t.intent)) {
    errors.push('intent must be an object');
    return;
  }
  const intent = t.intent as Record<string, unknown>;
  if (typeof intent.goal !== 'string' || !intent.goal.trim()) errors.push('intent.goal is required');
  if (intent.design !== undefined && typeof intent.design !== 'string') errors.push('intent.design must be a string');
  if (intent.sources !== undefined) {
    if (!Array.isArray(intent.sources) || intent.sources.length === 0) {
      errors.push('intent.sources must be a non-empty array');
    } else {
      intent.sources.forEach((s, i) => {
        if (typeof s !== 'string' || !s.trim()) errors.push(`intent.sources[${i}] must be a non-empty string`);
      });
    }
  }
}
```

In `validateTour`, insert one call after the `summary` check (`if (typeof t.summary !== 'string') ...`):

```ts
  validateIntent(t, errors);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run build && node --test test/tour.test.mjs`
Expected: PASS (all tour tests, old and new).

- [ ] **Step 6: Commit (including rebuilt dist)**

```bash
git add src/types.ts src/tour.ts test/tour.test.mjs dist/
git commit -m "feat: StoryIntent block — recovered why with goal, design, and evidence sources"
```

---

### Task 2: Render the intent in the Overview panel

**Files:**
- Modify: `src/render.ts` (`introPanel`, currently lines 403–443)
- Modify: `src/page-assets.ts` (CSS, after the `.ds-intro-lede` rule at line 306)
- Test: `test/render-page.test.mjs`

**Interfaces:**
- Consumes: `Tour.intent?: StoryIntent` from Task 1.
- Produces: Overview panel markup — `intent.goal` as the `.ds-intro-lede`, `intent.design` and the summary as `.ds-intro-design` paragraphs, sources as `.ds-intro-sources`. Without `intent`, output is byte-identical to today.

- [ ] **Step 1: Write the failing tests**

Append to `test/render-page.test.mjs` (the shared `tour`/`files` fixtures at the top of the file are reused via spread):

```js
test('intro panel leads with the recovered intent and cites its sources', () => {
  const intentTour = {
    ...tour,
    intent: {
      goal: 'We wanted ops to cap runaway fees before settlement.',
      design: 'The keeper clamps through one shared helper.',
      sources: ['commit abc1234', 'PR #7 body'],
    },
  };
  const html = renderPage({ repo: process.cwd(), tour: intentTour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /class="ds-intro-lede">We wanted ops to cap runaway fees before settlement\./);
  assert.match(html, /class="ds-intro-design">The keeper clamps through one shared helper\./);
  assert.match(html, /class="ds-intro-sources">Why from commit abc1234 · PR #7 body</);
});

test('intro panel keeps the summary as the reading map when intent exists', () => {
  const intentTour = { ...tour, intent: { goal: 'Cap runaway fees.' } };
  const html = renderPage({ repo: process.cwd(), tour: intentTour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /class="ds-intro-lede">Cap runaway fees\./);
  assert.match(html, /class="ds-intro-design">One changed line\./);
});

test('intro panel falls back to the summary lede without an intent block', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /class="ds-intro-lede">One changed line\./);
  assert.doesNotMatch(html, /ds-intro-sources/);
});

test('intent text is HTML-escaped in the intro panel', () => {
  const intentTour = { ...tour, intent: { goal: 'Guard <script> tags', sources: ['a & b'] } };
  const html = renderPage({ repo: process.cwd(), tour: intentTour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /Guard &lt;script&gt; tags/);
  assert.match(html, /a &amp; b/);
  assert.doesNotMatch(html, /Guard <script> tags/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run build && node --test test/render-page.test.mjs`
Expected: the three intent tests FAIL (no `ds-intro-design`/`ds-intro-sources` markup exists); the fallback test passes.

- [ ] **Step 3: Rewrite `introPanel`**

In `src/render.ts`, replace the `summary` const and the `<p class="ds-intro-lede">…` line inside `introPanel`. The complete new function body from the top through the lede markup (the facts/start/section markup below stays unchanged):

```ts
function introPanel(model: ReviewModel, tour: Tour): string {
  const n = model.totalSteps;
  const trust = model.trust.uncovered.length;
  const first = model.steps[0];
  const intent = tour.intent;
  const summaryText = tour.summary && tour.summary.trim() ? nl(esc(tour.summary.trim())) : '';
  const goalText = intent?.goal?.trim() ? nl(esc(intent.goal.trim())) : '';
  // With a recovered intent the goal leads and the summary becomes the reading
  // map; without one the summary (or a generic line) is the lede, as before.
  const lede =
    goalText ||
    summaryText ||
    'Each step builds on the one before it — read them in order, or jump to any file from the list.';
  const design =
    goalText && intent?.design?.trim() ? `<p class="ds-intro-design">${nl(esc(intent.design.trim()))}</p>` : '';
  const map = goalText && summaryText ? `<p class="ds-intro-design">${summaryText}</p>` : '';
  const sources =
    goalText && intent?.sources?.length
      ? `<p class="ds-intro-sources">Why from ${intent.sources.map((s) => esc(s)).join(' · ')}</p>`
      : '';
```

and in the returned template, replace:

```ts
      <p class="ds-intro-lede">${summary}</p>
```

with:

```ts
      <p class="ds-intro-lede">${lede}</p>
      ${design}${map}${sources}
```

(The old `const summary = …` block is deleted; everything else in the function is untouched.)

- [ ] **Step 4: Add the CSS**

In `src/page-assets.ts`, directly after the `.ds-intro-lede{…}` rule (line 306), add:

```
.ds-intro-design{font-size:14px;line-height:1.6;color:var(--muted);margin:12px 0 0;text-wrap:pretty}
.ds-intro-sources{font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);opacity:0.7;margin:16px 0 0}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run build && node --test test/render-page.test.mjs`
Expected: PASS (all render-page tests, old and new — the fallback test proves intent-less stories render as before).

- [ ] **Step 6: Commit (including rebuilt dist)**

```bash
git add src/render.ts src/page-assets.ts test/render-page.test.mjs dist/
git commit -m "feat: render the recovered why — intent goal, design, and sources on the overview panel"
```

---

### Task 3: Rewrite `storyPrompt` narrative-first

**Files:**
- Modify: `src/agent.ts` (`storyPrompt` return expression, currently lines 86–181; everything before `return` — `whyLength`, `modeContract`, `scopeContract`, `diff`, `headField` — is unchanged)
- Test: `test/agent.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: prompt text containing exactly the phase headings `Phase 1 — Recover the why`, `Phase 2 — Design the reading path`, `Phase 3 — Write the steps`, plus `Order test:`, `Thread rule:`, `"intent"`, `code-derived` (Task 4's SKILL.md mirrors this wording; Task 6 smoke-tests it).

- [ ] **Step 1: Update the prompt tests (failing first)**

In `test/agent.test.mjs`:

Replace the test `'storyPrompt names the base and the output file'` (lines 15–31) with:

```js
test('storyPrompt names the base and the output file', () => {
  const p = storyPrompt('main (abc123)');
  assert.ok(p.includes('main (abc123)'));
  assert.ok(p.includes('.diffstory/story.json'));
  assert.ok(p.includes('do not emit one step per file'));
  assert.ok(p.includes('synchronized story note'));
  assert.ok(p.includes('I added this parameter to method X'));
  assert.ok(p.includes('Voice contract'));
  assert.ok(p.includes('lively, specific, and a little fun'));
  assert.ok(p.includes('top-level "summary" is the reading map'));
  assert.ok(p.includes('1-3 short informal sentences'));
  assert.ok(p.includes('first person'));
  assert.ok(p.includes('No long paragraphs'));
  assert.ok(p.includes('No corporate changelog voice'));
  assert.ok(p.includes('the coverage gate is clean'));
});
```

Replace the test `'storyPrompt requires an intent to flow to implementation story arc'` (lines 33–42) with:

```js
test('storyPrompt recovers the why before reading the diff', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('Phase 1 — Recover the why'));
  assert.ok(p.includes('gh pr view --json title,body'));
  assert.ok(p.includes('git log'));
  assert.ok(p.includes('Not evidence: branch names, filenames, vibes'));
  assert.ok(p.includes('We wanted to enable'));
  assert.ok(p.includes('designed the flow'));
  assert.ok(p.includes('"intent"'));
  assert.ok(p.includes('"sources"'));
  assert.ok(p.includes('code-derived'));
  assert.ok(p.includes('Never invent product intent'));
});

test('storyPrompt designs the reading path as a narrative, not a file list', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('Phase 2 — Design the reading path'));
  assert.ok(p.includes('intent -> flow -> implementation'));
  assert.ok(p.includes('not a list of touched files'));
  assert.ok(p.includes('To implement that flow, I first'));
  assert.ok(p.includes('never by filename'));
  assert.ok(p.includes('Order test:'));
  assert.ok(p.includes('Thread rule:'));
  assert.ok(p.includes('one continuous story'));
});

test('storyPrompt ends with a falsifiable self-review', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('Falsifiable self-review'));
  assert.ok(p.includes('Why test:'));
  assert.ok(p.includes('Thread test:'));
  assert.ok(p.includes('read only the beats'));
  assert.ok(p.includes('Do not ask questions. Generate it directly.'));
});
```

The tests `'storyPrompt asks for a reviewer map and hard quality gates'`, `'storyPrompt makes deleted-file steps use the changed kind'`, `'storyPrompt teaches the pure deleted-file sentinel anchor'`, `'storyPrompt teaches explicit read-aloud focus targets'`, `'storyPrompt teaches viewport and highlighted line selection'`, `'storyPrompt requires beat-by-beat narration for read-aloud sync'`, and `'storyPrompt supports story detail levels'` are UNCHANGED — the new prompt must keep every string they assert.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: the three new/updated prompt tests FAIL (`Phase 1 — Recover the why` etc. not in the prompt yet).

- [ ] **Step 3: Replace the `storyPrompt` return expression**

In `src/agent.ts`, replace the entire `return ( … );` of `storyPrompt` (keep everything above it) with:

```ts
  return (
    `Use the diffStory review-tour skill to create a review story for exactly this change: ${diff}.\n\n` +
    `Write ${DATA_DIR}/story.json and set its "base" field to "${baseRef}"${headField} and set its "mode" field to "${storyMode}". The story is for a human ` +
    `reviewer, not a changelog.\n\n` +
    modeContract +
    scopeContract +
    `Work in three phases, in order. Phases 1 and 2 produce short visible notes in your output before any JSON; only phase 3 writes the file.\n\n` +
    `Phase 1 — Recover the why (do this before reading the diff):\n` +
    `- Gather intent evidence: read the commit messages behind this diff (for example git log --oneline -15 over the diffed range or ref), the PR title and body when one exists (gh pr view --json title,body — skip quietly if there is no PR or no gh), and any plan, design, or changelog notes the change touches or references.\n` +
    `- Legitimate intent evidence: commit messages, PR bodies, docs, code comments, tests. Not evidence: branch names, filenames, vibes.\n` +
    `- State the goal as actor + capability: "We wanted to enable <actor> to <capability>". If the change is not user-facing, name the real actor from the code, like reviewer, operator, keeper, service, or system. Then state the designed flow that achieves it: "To make that work, we designed the flow so X reaches Y, Y asks Z, and Z returns/stores/renders P".\n` +
    `- Write both into the story as "intent": {"goal": "...", "design": "...", "sources": ["commit abc1234", "PR #12 body", "docs/plan.md"]}. Every entry in "sources" names evidence you actually read.\n` +
    `- If no evidence exists, set "goal" to what the code demonstrably enables, use "sources": ["code-derived"], and keep the wording narrow. Never invent product intent.\n` +
    `- If the evidence contradicts what the code does, say so in the summary instead of silently picking one.\n\n` +
    `Phase 2 — Design the reading path (do this before writing any JSON):\n` +
    `- Write the narrative arc as a visible note: intent -> flow -> implementation, not a list of touched files. Shape: "To enable <goal> we designed <flow>. To implement that flow, I first changed Y in Z, then wired U into P, then pinned it with tests/docs".\n` +
    `- Build a private reviewer map: the behavior this change is really about, the first requirement-backed entry point, the control/data flow across files, the invariants and risks to verify, and which tests/docs prove each behavior. Assume the reviewer is auditing AI-authored code and needs a falsifiable mental model fast.\n` +
    `- Order the stops by that arc — runtime, control, and data flow — never by filename. Start where someone who just read the goal would start: the new field, fee, struct, setting, endpoint, UI affordance, or public method that makes it real.\n` +
    `- Order test: if sorting your planned steps by filename would not change how the story reads, it is not a story yet — reorder, or state in one line why file order genuinely is the clearest path.\n` +
    `- Thread rule: every step's first beat except the first must pick up what the previous step established ("Now that the cap is stored, here is who reads it"), so the steps read as one continuous story.\n` +
    `- Group related edits into one stop; do not emit one step per file or one step per hunk. Put tests, snapshots, and docs after the behavior they verify or explain. Only narrate generated files when they are not excluded and the behavior depends on reviewing them.\n` +
    `- Each step must answer a reviewer question: where does the behavior start; what invariant changed; what is passed, rejected, stored, or rendered; what risk should the reviewer inspect; what proves this path works. Titles should read like falsifiable review claims or risks, not file captions.\n\n` +
    `Phase 3 — Write the steps. Mechanics checklist:\n\n` +
    `Viewport contract:\n` +
    `- Every step must include "viewport": [startLine, endLine]. This is what the reviewer sees, chosen from the requirement and the code shape, not from the tiny diff hunk.\n` +
    `- Every step must include "highlights": [[startLine, endLine], ...]. These are the lines the story is currently talking about and the rows diffStory should glow while reading.\n` +
    `- Pick the viewport first: usually the whole method, storage struct, schema block, config stanza, test case, or small file section someone needs after reading the requirement.\n` +
    `- Pick highlights second: the exact fee field, parameter, branch, guard, call, state write, assertion, or return path being discussed inside that viewport.\n` +
    `- Keep "highlights" inside "viewport". It is fine for the viewport to be much wider than the changed lines when that helps the reviewer understand the flow.\n` +
    `- Do not make one step jump between far-apart highlight islands. If the story needs distant lines, split it into separate steps so each viewport/highlights pair stays local and scroll-stable.\n` +
    `- Keep "range" as the changed-line coverage anchor the coverage gate checks. "range" proves the changed hunk is covered; "viewport" controls what the diff viewer shows.\n\n` +
    `Beat contract:\n` +
    `- Every new step must include "beats": [{"text": "short narration", "highlights": [[startLine, endLine]]}, ...].\n` +
    `- Each beat is a separate speech unit for read-aloud, so the code highlight can move exactly when the voice moves.\n` +
    `- Use one beat per highlighted code part. If a step has three review points, write three beats instead of one long "why".\n` +
    `- A beat may point at one small range or a few nearby related ranges, but it must stay inside the step "viewport".\n` +
    `- Do not put one big speech over several highlight groups; split it into beat-by-beat narration.\n` +
    `- Keep "why" as a compact fallback recap for older readers, but put the read-aloud story in "beats".\n\n` +
    `Writing contract:\n` +
    `- The top-level "summary" is the reading map: 1-3 short informal sentences on how the steps walk the implementation and where the reviewer should slow down. The goal and designed flow live in "intent"; do not repeat them in the summary.\n` +
    `- Step titles should name the exact behavior or risk being reviewed.\n` +
    `- Each "why" is the compact fallback recap for that stop; keep it to ${whyLength} in first person.\n` +
    `- Each beat is the synchronized story note: explain the local code part, why it matters, and what the next caller/helper/path can now do while its highlights glow.\n` +
    `- Prefer causal chains like "I added this parameter to method X so method Y can pass Z, which lets H handle...".\n` +
    `- Include what to verify only inside that story, not as a detached checklist.\n` +
    `- Avoid filler like "adds", "updates", "this file", or restating the diff.\n` +
    `- Prefer specific protocol/product language from the code over generic narrative.\n\n` +
    `Voice contract:\n` +
    `- Make the story lively, specific, and a little fun, like a sharp teammate guiding review.\n` +
    `- Keep it informal and to the point. No long paragraphs, no essay mode, no drama.\n` +
    `- Use active verbs, concrete nouns, and quick stakes: what could break, what now holds, what got simpler.\n` +
    `- No corporate changelog voice, no sleepy "This updates..." phrasing, and no bland summary captions.\n` +
    `- Keep the fun in the wording, not in fake confidence: correctness beats jokes every time.\n\n` +
    `Coverage contract:\n` +
    `- Coverage is necessary, but not sufficient.\n` +
    `- Before writing ${DATA_DIR}/story.json, build a private coverage ledger: file, changed hunk range, semantic ` +
    `purpose, and planned step id.\n` +
    `- Cover every changed hunk with a changed/new-file step.\n` +
    `- Never use "deleted" as a step kind. For deleted files, use kind "changed" and anchor the range at the post-change deletion location the coverage gate reports.\n` +
    `- For a whole deleted file, use range, viewport, and highlights of [0, 0]. Do not invent line 1 for a file that no longer exists.\n` +
    `- Use context steps only for unchanged code that makes the review easier.\n` +
    `- Cover every changed hunk so the coverage gate is clean — the review flags any change no step explains.\n\n` +
    `Range contract:\n` +
    `- Read the post-change file with line numbers before choosing ranges.\n` +
    `- Ranges are review windows, not coverage hacks: use the smallest complete function/block/test/config region ` +
    `that makes the change understandable.\n` +
    `- Do not use whole-file or giant ranges unless the whole file is new and small, or the entire file is truly ` +
    `the review unit.\n` +
    `- For pure deletions with surviving surrounding code, anchor the step at the post-change location where the deletion happened and include the ` +
    `smallest surrounding code that explains the removed behavior.\n` +
    `- For whole-file deletions with no post-change lines, use the [0, 0] deletion sentinel for "range", "viewport", and "highlights".\n\n` +
    `Focus pointer contract:\n` +
    `- Prefer "highlights" for new stories. "focus": {"ranges": [[startLine, endLine]], "label": "short cue"} is the legacy spelling and should only be used for compatibility.\n` +
    `- Highlight ranges must use post-change line numbers and stay inside that step's "viewport".\n` +
    `- In brief mode, highlight only the one exact line or tiny block the reviewer should glance at.\n` +
    `- In balanced mode, highlight only the exact line or tiny block the reviewer should look at while listening.\n` +
    `- In line-by-line mode, use multiple highlight ranges for guards, branches, state writes, external calls, assertions, and other line-by-line correctness pivots.\n\n` +
    `Truth contract:\n` +
    `- Only describe behavior you verified in the diff or current source lines you read.\n` +
    `- The "intent" block must only claim a why its "sources" actually support.\n` +
    `- Do not infer intent from branch names, filenames, or vibes.\n` +
    `- Do not claim tests pass unless you ran them.\n` +
    `- Do not claim a test covers behavior unless the assertion is visible in the story range or in code you read.\n` +
    `- If you are uncertain, narrow the claim to what the code shows.\n\n` +
    `Falsifiable self-review before finishing:\n` +
    `- Re-run the order test on the final steps: if filename order reads the same, reorder.\n` +
    `- Why test: strike any beat that only restates what the code does; every step must say why it exists in the designed flow and what it unlocks next.\n` +
    `- Thread test: read only the beats in order with no code — they must still form one continuous story with no jumps.\n` +
    `- Check every title names behavior/risk, every "why" stays compact, and calls/returnsTo reflect real control/data flow. Remove vague filler and unsupported safety claims.\n` +
    `- Coverage: every changed hunk is claimed by a changed/new-file step, no step points at unchanged code, and ids, order, calls, and returnsTo resolve.\n\n` +
    `Do not ask questions. Generate it directly.`
  );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: PASS — including all unchanged tests (deleted-kind, sentinel, focus, viewport, beats, detail levels). The SKILL.md tests still pass because SKILL.md is untouched in this task.

- [ ] **Step 5: Commit (including rebuilt dist)**

```bash
git add src/agent.ts test/agent.test.mjs dist/
git commit -m "feat: narrative-first storyPrompt — recover the why, order by flow, falsifiable self-review"
```

---

### Task 4: Rewrite SKILL.md narrative-first

**Files:**
- Modify: `skills/review-tour/SKILL.md`
- Test: `test/agent.test.mjs` (the `bundled review-tour skill …` tests)

**Interfaces:**
- Consumes: the phase wording established in Task 3 (keep the two documents saying the same thing).
- Produces: SKILL.md sections `### 0. Recover the why`, expanded `### 2.5. Narrative arc`, `### Narrative audit`, intent in the Schema example. All strings asserted by the existing SKILL.md tests are preserved.

- [ ] **Step 1: Write the failing tests**

Append to `test/agent.test.mjs`:

```js
test('bundled review-tour skill recovers intent before writing', () => {
  const skill = readFileSync(new URL('../skills/review-tour/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Recover the why'));
  assert.ok(skill.includes('"sources"'));
  assert.ok(skill.includes('code-derived'));
  assert.ok(skill.includes('conversation'));
  assert.ok(skill.includes('up to 2 short questions'));
  assert.ok(skill.includes('Not evidence: branch names, filenames, vibes'));
  assert.ok(skill.includes('Never invent product intent'));
});

test('bundled review-tour skill enforces the narrative audit', () => {
  const skill = readFileSync(new URL('../skills/review-tour/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Narrative audit'));
  assert.ok(skill.includes('Order test'));
  assert.ok(skill.includes('Thread rule'));
  assert.ok(skill.includes('Thread test'));
  assert.ok(skill.includes('one continuous story'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: the two new skill tests FAIL; everything else passes.

- [ ] **Step 3: Edit SKILL.md**

All edits below; every existing string asserted by the old tests must survive (they do — check with Step 4).

**(a) Frontmatter description** — replace the `description:` line with:

```yaml
description: Use right after you (the agent) have made code changes the user needs to review, especially a large multi-file change. Produces .diffstory/story.json — a guided, in-order reading path through your own diff that opens with the recovered intent (why the change exists) — so the reviewer reads the change the way it was meant to be understood instead of alphabetically by filename. Run before handing work back for review.
```

**(b) Intro paragraph** — replace the sentence `The story should feel like a sharp teammate guiding review over your shoulder: entry point, flow, helpers, boundaries, tests.` with:

```
The story should feel like a sharp teammate guiding review over your shoulder:
why the change exists, entry point, flow, helpers, boundaries, tests.
```

**(c) Non-Negotiable Contract** — add as the first bullet:

```
- Open the story with an `intent` block whose `goal` cites real `sources`; use
  `["code-derived"]` when no evidence exists.
```

**(d) New workflow section** — insert immediately after the `## Workflow` heading, before `### 1. Get the change set`:

````markdown
### 0. Recover the why

The story opens with an `intent` block: the goal the change serves, the flow
designed to achieve it, and where that knowledge came from. Recover it before
reading the diff.

- You are usually the agent that just made this change in the same session. The
  goal is the task you were actually given — state it from the conversation and
  cite `"sources": ["conversation"]`.
- If the intent is genuinely ambiguous (you inherited the diff, or the task and
  the code disagree), ask the user up to 2 short questions before writing the
  story. Only ask when the answer changes the story; never ask from a headless
  run.
- If you cannot ask, mine evidence: commit messages in the diff range, the PR
  title and body (`gh pr view --json title,body`), plan/design docs, CHANGELOG
  entries, and issue references. Cite each source you used, like
  `"sources": ["commit 41af8b7", "PR #12 body", "docs/plan.md"]`.
- Legitimate intent evidence: commit messages, PR bodies, docs, code comments,
  tests. Not evidence: branch names, filenames, vibes.
- If no evidence exists, state the goal as what the code demonstrably enables,
  cite `"sources": ["code-derived"]`, and keep the wording narrow. Never invent
  product intent.
- If the evidence contradicts what the code does, say so in the summary instead
  of silently picking one.

Write the result into the story:

```jsonc
"intent": {
  "goal": "We wanted keepers to settle funding without one market's spike draining balances.",
  "design": "settleFunding() clamps through one shared _capRate() helper that reads each market's cap.",
  "sources": ["conversation"]
}
```
````

**(e) Narrative arc section** — replace the entire `### 2.5. Narrative arc` section body with:

```markdown
### 2.5. Narrative arc

Write the story as intent -> flow -> implementation, not a list of touched files.
Before any JSON, write the arc as a short visible note in your working output:
goal -> design decisions -> implementation chain.

- Start from the goal the diff actually supports: "We wanted to enable
  <actor> to <capability>." Reuse the `intent` block you recovered in step 0.
- Then explain the product or runtime shape: "To make that work, we designed the flow so X reaches Y, Y asks Z, and Z returns/stores/renders P."
- Then walk the implementation sequence: "To implement that flow, I first changed Y in Z, then wired U into P, then pinned it with tests/docs."
- Each step should continue that arc. Explain why this stop exists in the
  designed flow and what it unlocks next.
- Thread rule: every step's first beat except the first must pick up what the
  previous step established ("Now that the cap is stored, here is who reads
  it"), so the steps read as one continuous story.
- Order test: if sorting your planned steps by filename would not change how
  the story reads, it is not a story yet — reorder, or state in one line why
  file order genuinely is the clearest path.
- Do not invent user intent. If the diff only proves a technical refactor, make
  the goal technical and keep it grounded.
```

**(f) Truth audit** — add one bullet to the `### Truth audit` list:

```
- The `intent` block must only claim a why its `sources` actually support.
```

**(g) Narrative audit** — insert a new subsection after `### Truth audit` and before `### Reviewability audit`:

```markdown
### Narrative audit

Falsifiable checks — run each one, do not skim:

- Order test: reorder your steps by filename in your head. If the story reads
  the same, the path is not a story yet.
- Why test: strike any beat that only restates what the code does. Every step
  must say why it exists in the designed flow and what it unlocks next.
- Thread test: read only the beats in order with no code. They must still form
  one continuous story with no jumps.
```

**(h) Reviewability audit** — replace the first bullet (`- The summary is the review map: …`) with:

```
- The `intent` block carries why we wanted the change and the designed flow;
  the summary is the reading map: how to walk the implementation and the one
  or two places where the reviewer should slow down.
```

**(i) Schema example** — in the `## Schema` JSONC block, insert after the `"summary": …` line:

```jsonc
  "intent": {
    "goal": "We wanted keepers to settle funding without one market's spike draining balances.",
    "design": "settleFunding() clamps through one shared _capRate() helper that reads each market's cap.",
    "sources": ["commit 41af8b7", "PR #12 body"]
  },
```

**(j) Don't list** — add two bullets:

```
- Don't invent intent. Every `goal` claim needs a source; `["code-derived"]` is the honest fallback.
- Don't ship steps in file order without stating why that order genuinely reads best.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: PASS — both new skill tests and every pre-existing `bundled review-tour skill …` test (they assert strings like `Make a reviewer map before JSON`, `Narrative arc`, `We wanted to enable`, `To implement that flow, I first`, `intent -> flow -> implementation`, `not a list of touched files`, all preserved above).

- [ ] **Step 5: Commit**

```bash
git add skills/review-tour/SKILL.md test/agent.test.mjs dist/
git commit -m "feat: narrative-first review-tour skill — recover the why, thread rule, narrative audit"
```

---

### Task 5: Teach the new shape in the example and README

**Files:**
- Modify: `examples/review-tour.json`
- Modify: `README.md` (the "The story format" details section, lines 128–173)

**Interfaces:**
- Consumes: `intent` validation from Task 1 (the example must validate).

- [ ] **Step 1: Add the intent block to the example**

In `examples/review-tour.json`, insert after the `"summary": …` line (and change the summary to the new reading-map style):

```json
  "summary": "Read the keeper entry point first, then the helper it delegates clamping to, then where the cap is stored, and finally the test that pins it. Slow down on the require in _capRate().",
  "intent": {
    "goal": "Stop a runaway funding rate in one market from draining balances during settlement.",
    "design": "settleFunding() clamps each epoch's rate through one shared _capRate() helper that reads the per-market cap from marketConfig.",
    "sources": ["commit 3f2a91c", "PR #12 body"]
  },
```

- [ ] **Step 2: Verify the example validates**

Run:

```bash
node --input-type=module -e "import {validateTour} from './dist/tour.js'; import {readFileSync} from 'node:fs'; const errs = validateTour(JSON.parse(readFileSync('examples/review-tour.json','utf8'))); if (errs.length) { console.error(errs); process.exit(1); } console.log('example valid');"
```

Expected: `example valid`

- [ ] **Step 3: Update the README story-format section**

In `README.md`, after the paragraph ending `…one long speech drifting across several code blocks.` (line 138), add:

```markdown
New stories open with an `intent` block — the goal the change serves, the designed
flow, and the `sources` the why was recovered from (commits, PR body, the
conversation, or `code-derived` when no evidence exists). diffStory renders it as
the "why this change" lede on the overview panel.
```

In the JSONC example (lines 140–163), replace the `"summary": …` line with:

```jsonc
  "summary": "Read createOrder() first, then the helper it delegates to; slow down on the boundary check.",
  "intent": {
    "goal": "We wanted users to get a clear rejection before an over-cap order reaches placement.",
    "design": "createOrder() stops the request first, then hands the limit math to one shared helper.",
    "sources": ["conversation"]
  },
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS (nothing consumes these files in tests, but the build must stay green).

- [ ] **Step 5: Commit**

```bash
git add examples/review-tour.json README.md
git commit -m "docs: teach the intent block in the example story and README"
```

---

### Task 6: Full verification + real-story smoke test

**Files:**
- Create: none (verification only; `.diffstory/story.json` is a local artifact)

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Confirm dist is committed and the tree is clean**

Run: `git status --short`
Expected: no output. If `dist/` files show as modified, a task forgot to commit them — `git add dist/ && git commit -m "chore: rebuild dist"`.

- [ ] **Step 3: Real-story smoke test (requires `claude` CLI; skip with a note if unavailable)**

Confirm the story artifact is gitignored, then generate a story for the last few commits of THIS repo using the new prompt:

```bash
git check-ignore -q .diffstory/story.json && echo ignored || echo "WARNING: not ignored — do not commit it"
node --input-type=module -e "import {storyPrompt} from './dist/agent.js'; console.log(storyPrompt('HEAD~4', 'HEAD'))" > "$TMPDIR/ds-smoke-prompt.txt"
claude -p "$(cat "$TMPDIR/ds-smoke-prompt.txt")" --permission-mode acceptEdits
```

- [ ] **Step 4: Judge the generated story against the spec**

Validate and eyeball:

```bash
node --input-type=module -e "import {loadTour} from './dist/tour.js'; const t = loadTour('.diffstory/story.json'); console.log(JSON.stringify({intent: t.intent, order: t.steps.map(s => s.file)}, null, 2));"
```

Check, and report honestly:
- `intent` exists; `goal` reads as actor + capability; `sources` cite real commits from this repo (verify one hash with `git log --oneline -5`).
- The step file order is NOT alphabetical/file order — it follows the implementation flow.
- Open two consecutive steps in the JSON: the later step's first beat references what the earlier one established (thread rule).
- If any check fails, that is a prompt-quality finding to report back, not silently patch.

- [ ] **Step 5: Report**

Summarize: tests passing, story quality observations, any deviations from the plan.
