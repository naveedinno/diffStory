# 027 — Storyteller v2.1: full landings (file and caller, by name)

> **For agentic workers:** Use superpowers:executing-plans (or
> superpowers:subagent-driven-development) to run this plan task by task.
> Steps use checkbox (`- [ ]`) syntax. Read `plans/README.md` → "Story quality
> campaign → Rules for every executor" before starting.

**Goal:** Change ONE thing, as `eval/GOAL.md` requires after a no-clear-win
result: make the first beat of every step a complete landing. It names the
symbol, the file it lives in, who calls it *by name*, and when. That is the
user's own template: "this is function x that is getting called by y in z
process".

**Why this lever** (from `eval/AFTER-V2-2026-09.md` and the v2 generation logs):

- Judged `landing` stayed flat (3.17 → 3.17), while `landing-missing-symbol`
  warnings fell 14 → 0. Agents wrapped a symbol in `<code>` to satisfy the
  checker without landing better.
- Every v2 run read all nine reference files, `examples.md` included, so
  "more examples" alone is not enough. What changed was compression. In
  refactor-one-shot-notes, beats went from 32 to 16 words, and landings went
  from "this is `reviewStateSummary()`, the helper `renderReview()` and
  `diffScreen()` call on every page load" to "this is review-state.ts, the
  module every review page reaches for". The pressure came from v2's own
  rules ("a landing is a clause", "aim for 12-30 words") and from the
  checker's average-length warning.
- The blind judges who preferred the baseline cited "lands every step with
  file and caller" and "verified callers". The v2 losses cited "bolted-on
  landings".

**What changes:**

1. The Landing rule names the file and the caller by name, and rules out
   vague populations. Its example gains the file.
2. Beat rule 2 gives landing beats 20-40 words.
3. `examples.md` models complete landings and adds a BAD/GOOD pair taken from
   the eval itself.
4. The checker's `beats-long-on-average` warning stops counting landing beats.

**Deliberately no new lint.** Two candidate rules ("two `<code>` symbols in
the landing", "file or caller named") were tested against the baseline and v2
eval stories on 2026-09-25. Neither separated the landings the judges
preferred: both fired on nearly every Solidity entry point in both versions,
because their callers are off-chain roles. A shallow lint would repeat the
`landing-missing-symbol` Goodhart effect.

**Spec:** `docs/research/story-corpus-audit-2026-09.md`, `eval/AFTER-V2-2026-09.md`.

## Global constraints

- Precondition: the skill text digests to `aa7a6902421eee48` (plan 023's output,
  untouched since). Use the digest command from plan 023 Task 0.
- After this plan, it must digest to `bb48cab2c58d7e4a`, with
  `SKILL.md` hashing to `1146b8e267cf` and `references/examples.md` to
  `dfb9f52c7e9f` (first 12 hex chars of SHA-256).
- Verified in a scratch copy of this repo on 2026-09-25: all 109 tests in
  `test/story-lint.test.mjs`, `test/agent.test.mjs`, and
  `test/story-check.test.mjs` pass, including the bundle-freshness check;
  `SKILL.md` is 505 lines (guard: 520).
- Every replacement below must match exactly once. If an "old" block is not
  found verbatim, stop and report; do not improvise.

## Review focus

- The pinned phrases "who reaches it and when", "A landing is a clause, not a
  paragraph", and the `placeOrder()` landing example must still be in the
  skill corpus (the agent tests check them).
- The checker bundle is rebuilt and committed with the lint change (the
  freshness test fails otherwise).

---

### Task 1: Stop the average-length warning from squeezing landings

**Files:** Modify `src/story-lint.ts`, `test/story-lint.test.mjs`; regenerate
`dist/story-lint.js` and `skills/diffstory-storyteller/scripts/check-story.mjs`.

- [ ] **Step 1: Tests first.** In `test/story-lint.test.mjs`, replace this block:

````text
  const mid = 'This is <code>f()</code>, ' + 'with a moderately long clause '.repeat(6);
  const avg = story(Array.from({ length: 6 }, () => step({ beats: [{ text: mid + Math.random(), highlights: [[10, 12]] }] })));
  assert.ok(has(lintStory(avg), 'beats-long-on-average'));
});
````

with:

````text
  const mid = 'The guard then ' + 'keeps a moderately long clause going '.repeat(6);
  const landing = (n) => `This is <code>f${nameOf(n)}()</code> in <code>app.ts</code>, which the router calls on every request.`;
  const avg = story(Array.from({ length: 6 }, (_, n) => step({ beats: [
    { text: landing(n), highlights: [[10, 12]] },
    { text: mid + nameOf(n), highlights: [[10, 12]] },
  ] })));
  assert.ok(has(lintStory(avg), 'beats-long-on-average'));
});

test('beats-long-on-average ignores landing beats, which run longer by design', () => {
  const longLanding = (n) => `This is <code>f${nameOf(n)}()</code> in <code>app.ts</code>, the handler <code>router${nameOf(n)}()</code> calls on every checkout POST before anything is persisted or charged to the card.`;
  const s = story(Array.from({ length: 6 }, (_, n) => step({ beats: [
    { text: longLanding(n), highlights: [[10, 12]] },
    { text: `It now rejects stale input ${nameOf(n)}.`, highlights: [[10, 12]] },
  ] })));
  assert.ok(!has(lintStory(s), 'beats-long-on-average'));
});
````

- [ ] **Step 2: Run** `npm run build && node --test test/story-lint.test.mjs`.
  Expected: the new "ignores landing beats" test FAILS (landings still count
  toward the average).

- [ ] **Step 3: Implement.** In `src/story-lint.ts`, replace:

````text
function lintBeatLength(beats: BeatRef[], add: Add): void {
  let total = 0;
  for (const { step, beat, index } of beats) {
    const count = wordsOf(plainText(beat.text)).length;
    total += count;
````

with:

````text
function lintBeatLength(beats: BeatRef[], add: Add): void {
  // Landing beats (index 0) carry the symbol, file, caller, and moment, so they
  // run longer by design; only the other beats feed the average.
  let total = 0;
  let counted = 0;
  for (const { step, beat, index } of beats) {
    const count = wordsOf(plainText(beat.text)).length;
    if (index > 0) {
      total += count;
      counted += 1;
    }
````

and replace:

````text
  if (beats.length >= 6 && total / beats.length > 32) {
    add(
      "beats-long-on-average",
      "warning",
      "story",
      `Beats average ${Math.round(total / beats.length)} words.`,
      "Aim for 12–30 spoken words per beat; the listener cannot glance back.",
    );
  }
````

with:

````text
  if (counted >= 6 && total / counted > 32) {
    add(
      "beats-long-on-average",
      "warning",
      "story",
      `Beats after the landing average ${Math.round(total / counted)} words.`,
      "Aim for 12–30 spoken words per beat after the landing; the listener cannot glance back.",
    );
  }
````

- [ ] **Step 4: Run** `npm run build && node --test test/story-lint.test.mjs test/story-check.test.mjs`
  — expected: PASS (the build regenerates the checker bundle, so the freshness test passes).

- [ ] **Step 5: Commit**

```bash
git add src/story-lint.ts test/story-lint.test.mjs dist/story-lint.js skills/diffstory-storyteller/scripts/check-story.mjs
git commit -m "fix: landing beats no longer count toward the average-length warning"
```

### Task 2: Complete landings in the skill text and examples

**Files:** Modify `skills/diffstory-storyteller/SKILL.md`,
`skills/diffstory-storyteller/references/examples.md`, `test/agent.test.mjs`.

- [ ] **Step 1: Pin the new rule first.** In `test/agent.test.mjs`, inside the
  test `'storyteller v2 teaches the 2026-09 corpus-audit rules'`, replace:

````text
    'Open the goal on the problem, not on the diff',
  ]) {
````

with:

````text
    'Open the goal on the problem, not on the diff',
    'this is function x, in file z, that y calls when w',
    'never a vague population',
    'a landing beat usually needs 20-40',
  ]) {
````

Run `node --test test/agent.test.mjs`. Expected: that test FAILS (the phrases are missing).

- [ ] **Step 2: The Landing rule.** In `skills/diffstory-storyteller/SKILL.md`, replace:

````text
- Landing rule: the first beat of EVERY code step lands the listener before it
  says anything about the change. In one clause, name the symbol the camera is
  on in `<code>` (function, method, handler, rule, test), who reaches it and
  when (the caller, route, event, or process), and what this spot is
  responsible for; that beat's highlight is the signature or call site. Only
  then the change. "This is `_capRate()`, the helper `settleFunding()` calls once
  per market right after it picks the market config; here we add the inclusive
  ceiling check." If the camera stayed inside the same function, one clause is
  enough ("Still in `_capRate()`, one branch down: …"), but it is never skipped.
  A landing is a clause, not a paragraph: never bolt a landing sentence onto an
  existing beat, and never pad it with "Look at lines …".
````

with:

````text
- Landing rule: the first beat of EVERY code step lands the listener before it
  says anything about the change, the way a colleague would orient you: "this
  is function x, in file z, that y calls when w." Name the symbol the camera is
  on in `<code>`; the file or module it lives in whenever the camera changed
  files; who reaches it, by name (the calling function, route handler, test, or
  component; for an external entry point, the role that calls it and the check
  that gates it), never a vague population ("every review page", "the app");
  and when. That beat's highlight is the signature or call site. Only then the
  change. "This is `_capRate()` in `RateMath.sol`, the helper `settleFunding()`
  calls once per market right after it picks the market config; here we add
  the inclusive ceiling check." If the camera stayed inside the same function,
  one clause is enough ("Still in `_capRate()`, one branch down: …"), but it is
  never skipped. A landing is a clause, not a paragraph, but a complete one:
  never bolt a landing sentence onto an existing beat, and never pad it with
  "Look at lines …".
````

- [ ] **Step 3: Beat rule 0.** In the same file, replace:

````text
0. **Land the listener first.** Name where they are — the function or rule,
   who calls it and when — before the change.
````

with:

````text
0. **Land the listener first.** Name where they are — the function or rule,
   the file it lives in, who calls it by name, and when — before the change.
````

- [ ] **Step 4: Beat rule 2.** In the same file, replace:

````text
   decisions means two beats, or two steps. Aim for 12-30 spoken words; over 45
   is two beats.
````

with:

````text
   decisions means two beats, or two steps. Aim for 12-30 spoken words (a
   landing beat usually needs 20-40); over 45 is two beats.
````

- [ ] **Step 5: Examples.** In `skills/diffstory-storyteller/references/examples.md`, replace:

````text
```text
GOOD  (one clause of landing, then the change and what it unlocks)
  "This is `relayBatch()`, what the relayer calls once per signed batch; it now
   takes `walletIds`, so one signature can move funds for several wallets."
```
````

with:

````text
```text
GOOD  (one complete landing clause, then the change and what it unlocks)
  "This is `relayBatch()` in `BatchRelay.sol`, what the relayer calls under
   `RELAYER_ROLE` once per signed batch; it now takes `walletIds`, so one
   signature can move funds for several wallets."
```

```text
BAD  (a label, not a landing: no caller, a vague population)
  "This is review-state.ts, the module every review page reaches for before
   rendering."
```

```text
GOOD  (symbol, file, caller by name, when)
  "This is `reviewStateSummary()` in `review-state.ts`, the helper
   `renderReview()` and `diffScreen()` call on every page load to bind the
   page, story, and notes to one exact diff."
```

The listener should be able to say, after the first beat and without looking:
which function I am in, which file, who calls it, and when.
````

- [ ] **Step 6: Verify the bytes.**

```bash
cd skills/diffstory-storyteller && for f in SKILL.md references/examples.md; do printf "%s  %s\n" "$(shasum -a 256 $f | cut -c1-12)" "$f"; done; cd -
```

Expected: `1146b8e267cf  SKILL.md` and `dfb9f52c7e9f  references/examples.md`.
Then run plan 023's Task 0 digest command. It must print `bb48cab2c58d7e4a`.
If not, diff your edit against the "with" blocks above; do not change the
expected values.

- [ ] **Step 7: Run** `npm test` — expected: all pass.

- [ ] **Step 8: Commit and install**

```bash
git add skills/diffstory-storyteller/SKILL.md skills/diffstory-storyteller/references/examples.md test/agent.test.mjs
git commit -m "feat: storyteller v2.1 — landings name the file and the caller by name"
sh scripts/install-skills.sh --claude --codex
```

Then run plan 018 Task 4 Step 2. Expected: three `current` lines (Muse reads
`~/.agents`).
