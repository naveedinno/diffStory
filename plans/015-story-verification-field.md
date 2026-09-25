# 015 — Add a `verification` field: what the author actually ran

> **For agentic workers:** Use superpowers:executing-plans (or
> superpowers:subagent-driven-development) to run this plan task by task.
> Steps use checkbox (`- [ ]`) syntax. Read `plans/README.md` → "Story quality
> campaign → Rules for every executor" before starting.

**Goal:** Give stories a structured place for "what I ran and what happened"
so hotspots can go back to being doubts about the code. About half of all
real hotspots are environment gaps ("physical VoiceOver … not replayed"), and
test results get stuffed into `summary` or `storyScope.reviewerNote`.

**Architecture:** One optional top-level array, validated in `validateTour`,
projected through the existing chain `view-model.ts → render.ts → payloads.ts →
StoryView.tsx`, and rendered inside the existing "Review notes" disclosure
next to hotspots and non-goals. Follow exactly how `intent.nonGoals` flows
through the same files.

**Tech stack:** TypeScript, React 19 (client), `node --test`.

**Spec:** `docs/research/story-corpus-audit-2026-09.md` (F8, decision D5).

## Global constraints

- Field shape (exact):
  ```ts
  verification?: Array<{
    check: string;                              // plain text, 1–120 chars
    result: 'passed' | 'failed' | 'not-run';
    detail?: string;                            // inline-tier HTML, ≤ 240 chars of text
  }>;                                           // 1–8 entries when present
  ```
- Old stories without the field keep validating and rendering unchanged.
- `dist/` is committed: rebuild with `npm run build`; stage `dist/*.js` files
  by explicit path, never `git add dist/`.
- The client bundle is `dist/client/review.js`; it is rebuilt by `npm run build`.
  If `git status` showed `dist/client/review.js` modified *before* you started,
  STOP and report (someone else's work is in it).

- Tasks 1–2 were compiled and their tests passed in a scratch copy on
  2026-09-25; Task 3 (React + CSS) has a manual check.

## Review focus

- `detail` rendered with `dangerouslySetInnerHTML` without going through `prose()`
  (sanitizer bypass).
- An empty `verification: []` array is valid (like `nonGoals: []`) and renders nothing.
- A `not-run` entry must be visually distinct from `passed` (not colour alone:
  include the word).
- Narration: the block must not be read aloud as part of the Overview lede.

---

### Task 1: Type and validator

**Files:**
- Modify: `src/types.ts` (add interface + `Tour.verification`)
- Modify: `src/tour.ts` (new `validateVerification`, called after `validateHotspots(t, errors);` at ~line 1084)
- Test: `test/tour.test.mjs`

**Interfaces:**
- Produces: `export interface StoryVerification { check: string; result: 'passed' | 'failed' | 'not-run'; detail?: string }`
  and `Tour.verification?: StoryVerification[]`.

- [ ] **Step 1: Write failing tests** (append to `test/tour.test.mjs`)

```js
test('verification is optional and validates check, result, and detail', () => {
  const tour = (verification) => ({
    version: 3,
    title: 'T',
    summary: '',
    verification,
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  });
  assert.deepEqual(validateTour(tour(undefined)), []);
  assert.deepEqual(validateTour(tour([])), []);
  assert.deepEqual(validateTour(tour([
    { check: 'forge test --match-contract Funding', result: 'passed' },
    { check: 'VoiceOver on a physical iPhone', result: 'not-run', detail: 'Only the <code>aria-live</code> region was checked in Chrome.' },
  ])), []);
  assert.ok(validateTour(tour('nope')).includes('verification must be an array'));
  assert.ok(validateTour(tour([{ result: 'passed' }])).includes('verification[0].check is required'));
  assert.ok(validateTour(tour([{ check: 'x', result: 'green' }])).includes('verification[0].result must be one of passed, failed, not-run'));
  assert.ok(validateTour(tour([{ check: 'x'.repeat(121), result: 'passed' }])).includes('verification[0].check must be at most 120 characters'));
  assert.ok(validateTour(tour(Array.from({ length: 9 }, () => ({ check: 'x', result: 'passed' })))).includes('verification must have at most 8 entries'));
  assert.ok(validateTour(tour([{ check: '<b>x</b>', result: 'passed' }])).some((e) => e.startsWith('verification[0].check')));
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm run build && node --test test/tour.test.mjs`
Expected: FAIL on `verification must be an array` (field is currently ignored).

- [ ] **Step 3: Add the type** — in `src/types.ts`, directly after the `StoryHotspot` interface:

```ts
/** Something the author ran (or could not run) to check the change. */
export interface StoryVerification {
  /** What was run, as the reviewer would type or recognise it. Plain text, ≤ 120 chars. */
  check: string;
  result: 'passed' | 'failed' | 'not-run';
  /** Optional one-line qualifier. Inline-tier HTML, ≤ 240 chars of text. */
  detail?: string;
}
```

and inside `export interface Tour`, directly after the `hotspots?:` line:

```ts
  /** What the author ran to check the change, and what could not be run. */
  verification?: StoryVerification[];
```

- [ ] **Step 4: Add the validator** — in `src/tour.ts`, directly after the
  closing `}` of `function validateHotspots(…)`, add:

```ts
const VERIFICATION_RESULTS = ["passed", "failed", "not-run"] as const;

/** Optional record of what the author ran; separate from hotspots, which are doubts. */
function validateVerification(t: Record<string, unknown>, errors: string[]): void {
  if (t.verification === undefined) return;
  if (!Array.isArray(t.verification)) {
    errors.push("verification must be an array");
    return;
  }
  if (t.verification.length > 8)
    errors.push("verification must have at most 8 entries");
  t.verification.forEach((raw, i) => {
    const where = `verification[${i}]`;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      errors.push(`${where} must be an object`);
      return;
    }
    const entry = raw as Record<string, unknown>;
    if (typeof entry.check !== "string" || !entry.check.trim()) {
      errors.push(`${where}.check is required`);
    } else {
      if (entry.check.length > 120)
        errors.push(`${where}.check must be at most 120 characters`);
      validateNarrative(entry.check, `${where}.check`, "text", errors);
    }
    if (!VERIFICATION_RESULTS.includes(entry.result as (typeof VERIFICATION_RESULTS)[number]))
      errors.push(`${where}.result must be one of passed, failed, not-run`);
    if (entry.detail !== undefined) {
      if (typeof entry.detail !== "string" || !entry.detail.trim()) {
        errors.push(`${where}.detail must be a non-empty string when present`);
      } else {
        if (narrativeText(entry.detail).length > 240)
          errors.push(`${where}.detail must be at most 240 characters of text`);
        validateNarrative(entry.detail, `${where}.detail`, "inline", errors);
      }
    }
  });
}
```

Then call it in `validateTour`, right after `validateHotspots(t, errors);`:

```ts
  validateVerification(t, errors);
```

`narrativeText` is already imported in `tour.ts` (it is used for beats); if
`tsc` says otherwise, add it to the existing `./narrative.js` import.

- [ ] **Step 5: Build and test**

Run: `npm run build && node --test test/tour.test.mjs`
Expected: PASS. If the `<b>x</b>` assertion fails, print
`validateTour(tour([{ check: '<b>x</b>', result: 'passed' }]))` and adjust
only the assertion's expected prefix to the message the text tier actually
produces (the tier is correct; the wording is the sanitizer's).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/tour.ts test/tour.test.mjs dist/types.js dist/tour.js
git commit -m "feat: validate an optional story verification list"
```

### Task 2: Project it through the view model and payload

**Files:**
- Modify: `src/view-model.ts` (`StoryView` interface ~line 311; `storyView()` ~line 497)
- Modify: `src/payloads.ts` (`ReviewStoryView` ~line 283)
- Modify: `src/render.ts` (the `story: { … }` payload block ~line 1536)
- Test: `test/review-page.test.mjs`

**Interfaces:**
- Consumes: `Tour.verification` from Task 1.
- Produces: `StoryView.verification?: Array<{ check: string; result: StoryVerification['result']; detail?: Narrative }>`
  and `ReviewStoryView.verification?: Array<{ check: string; result: 'passed' | 'failed' | 'not-run'; detail?: ReviewProse }>`.

- [ ] **Step 1: Write the failing test** (append to `test/review-page.test.mjs`;
  it already imports `buildReviewModel` — reuse its imports)

```js
test('story verification reaches the review model with sanitized detail', () => {
  const tour = {
    version: 3,
    title: 'T',
    summary: 's',
    verification: [
      { check: 'npm test', result: 'passed' },
      { check: 'Safari 17', result: 'not-run', detail: 'Only <code>Chrome</code> was available.' },
    ],
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 1], kind: 'changed', why: 'w' }],
  };
  const model = buildReviewModel(process.cwd(), tour, [], undefined, {});
  assert.deepEqual(model.story.verification.map((v) => [v.check, v.result]), [['npm test', 'passed'], ['Safari 17', 'not-run']]);
  assert.match(model.story.verification[1].detail.html, /<code>Chrome<\/code>/);
  const bare = buildReviewModel(process.cwd(), { ...tour, verification: undefined }, [], undefined, {});
  assert.equal(bare.story.verification, undefined);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm run build && node --test test/review-page.test.mjs`
Expected: FAIL — `model.story.verification` is undefined.

- [ ] **Step 3: View model.** In `src/view-model.ts`:

Add to the `StoryView` interface, after `intent?: StoryIntentView;`:

```ts
  /** What the author ran; absent when the story has no verification list. */
  verification?: Array<{ check: string; result: 'passed' | 'failed' | 'not-run'; detail?: Narrative }>;
```

In `storyView()`, inside the returned object literal, directly after the
`intent: …` property, add:

```ts
    ...(tour.verification?.length
      ? {
          verification: tour.verification.map((entry) => ({
            check: narrativeText(entry.check),
            result: entry.result,
            ...(entry.detail ? { detail: narrative(entry.detail, 'inline') } : {}),
          })),
        }
      : {}),
```

- [ ] **Step 4: Payload type.** In `src/payloads.ts`, inside
  `export interface ReviewStoryView`, directly after the `intent?: { … };` block:

```ts
  /** What the author ran to check the change. */
  verification?: Array<{
    check: string;
    result: 'passed' | 'failed' | 'not-run';
    detail?: ReviewProse;
  }>;
```

- [ ] **Step 5: Render payload.** In `src/render.ts`, inside `story: { … }`,
  directly after the `...(model.story.intent ? { intent: … } : {}),` entry:

```ts
      ...(model.story.verification
        ? {
            verification: model.story.verification.map((entry) => ({
              check: entry.check,
              result: entry.result,
              ...(entry.detail ? { detail: prose(entry.detail) } : {}),
            })),
          }
        : {}),
```

- [ ] **Step 6: Build and test**

Run: `npm run build && node --test test/review-page.test.mjs test/tour.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/view-model.ts src/payloads.ts src/render.ts test/review-page.test.mjs dist/view-model.js dist/payloads.js dist/render.js
git commit -m "feat: project story verification into the review payload"
```

### Task 3: Render it in the Overview's review notes

**Files:**
- Modify: `client/surfaces/review/StoryView.tsx` (`IntroPanel`, ~lines 160–300)
- Modify: `client/surfaces/review/review.css` (next to `.ds-intro-nongoals`, ~line 301)
- Test: `test/review-page.test.mjs` (server-rendered shell check) — or, if the
  intro is client-only, the typecheck + a manual check below.

- [ ] **Step 1: Render.** In `IntroPanel`:

After `const nonGoals = story.intent?.nonGoals ?? [];` add:

```tsx
  const verification = story.verification ?? [];
```

Change `const hasContext = …` to include it:

```tsx
  const hasContext = !!design || !!map || nonGoals.length > 0 || verification.length > 0;
```

Inside `<div className="ds-intro-context">`, directly after the `nonGoals`
block (`{nonGoals.length ? ( … ) : null}`), add:

```tsx
                    {verification.length ? (
                      <div className="ds-intro-verification">
                        <span className="ds-intro-block-kicker">What I ran</span>
                        <ul>
                          {verification.map((entry, index) => (
                            <li key={index} data-result={entry.result}>
                              <span className="ds-verify-result">
                                {entry.result === "passed" ? "Passed" : entry.result === "failed" ? "Failed" : "Not run"}
                              </span>
                              <span className="ds-verify-check">{entry.check}</span>
                              {entry.detail ? (
                                <span className="ds-verify-detail" dangerouslySetInnerHTML={html(entry.detail.html)} />
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
```

`html()` is the helper the file already uses for sanitized `ReviewProse.html`.
Do not add `data-speech-overview` to this block — it is not part of the spoken
Overview.

- [ ] **Step 2: Style.** In `client/surfaces/review/review.css`, directly after
  the `.ds-intro-nongoals li{…}` rule, add:

```css
.ds-intro-verification{margin-top:14px}
.ds-intro-verification>.ds-intro-block-kicker{color:var(--dim)}
.ds-intro-verification ul{margin:7px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
.ds-intro-verification li{display:grid;grid-template-columns:auto 1fr;column-gap:10px;row-gap:2px;font-size:13px;line-height:1.5;color:var(--muted)}
.ds-verify-result{font-size:11.5px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--dim)}
.ds-intro-verification li[data-result="passed"] .ds-verify-result{color:var(--green)}
.ds-intro-verification li[data-result="failed"] .ds-verify-result{color:var(--danger-text)}
.ds-intro-verification li[data-result="not-run"] .ds-verify-result{color:var(--amber)}
.ds-verify-check{font-family:var(--mono);font-size:12.5px;color:var(--text);overflow-wrap:anywhere}
.ds-verify-detail{grid-column:2;text-wrap:pretty}
```

All seven tokens (`--green`, `--danger-text`, `--amber`, `--mono`, `--dim`,
`--muted`, `--text`) existed in the theme on 2026-09-25; there is no `--red`.

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck:client && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 4: Manual check** (one minute, no automation needed)

Write this to `/tmp/verify-story/.diffstory/story.json` inside any scratch git
repo with one changed file `x.ts` (do NOT use a real project), open that repo in
the diffStory app (`npm run dev`, then pick the repo), open "Review notes", and
confirm three rows show "Passed", "Failed", "Not run" with their checks:

```json
{"version":3,"title":"Verification demo","summary":"demo",
 "verification":[{"check":"npm test","result":"passed"},{"check":"npm run lint","result":"failed","detail":"Two <code>no-unused-vars</code> errors remain."},{"check":"Safari 17","result":"not-run"}],
 "steps":[{"id":"s1","order":1,"title":"demo","file":"x.ts","range":[1,1],"viewport":[1,1],"highlights":[[1,1]],"kind":"changed","why":"w","beats":[{"text":"demo","highlights":[[1,1]]}]}]}
```

If you cannot run the app, say so in your report; do not claim it was checked.

- [ ] **Step 5: Full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add client/surfaces/review/StoryView.tsx client/surfaces/review/review.css dist/client/review.js
git status --short   # dist/client may also emit a CSS file; stage it by exact path if it changed
git commit -m "feat: show what the author ran in the story's review notes"
```

### Task 4: Document the field

**Files:**
- Modify: `docs/story-schema.md` (add `verification[].check` to the plain-text
  tier list and `verification[].detail` to the inline tier list, following the
  existing format of those sections)

- [ ] **Step 1:** Add the two fields to the tier lists in `docs/story-schema.md`
  (Tier B inline: `verification[].detail`; Tier C plain text: `verification[].check`).
- [ ] **Step 2:** Commit: `git add docs/story-schema.md && git commit -m "docs: add verification to the story schema tiers"`

(The storyteller skill learns the field in plan 023; do not edit `skills/` here.)
