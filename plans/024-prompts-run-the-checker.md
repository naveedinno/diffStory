# 024 — The app's own prompts run the checker, and repairs land the listener

> **For agentic workers:** Use superpowers:executing-plans (or
> superpowers:subagent-driven-development) to run this plan task by task.
> Steps use checkbox (`- [ ]`) syntax. Read `plans/README.md` → "Story quality
> campaign → Rules for every executor" before starting.

**Goal:** When the app itself launches a generation or a repair, tell the
agent to run the checker bundled with this build's copy of the skill until it
prints `RESULT: READY`. The app's finish gate rejects contract failures after
the agent is done, when nothing can be fixed any more, and it never checks
coverage or prose. The repair prompt also gains the landing rule and drops
"short, informal", the phrase that kept inviting caption beats.

**Architecture:** `src/agent.ts` resolves the checker path relative to its own
`dist/` location (`../skills/diffstory-storyteller/scripts/check-story.mjs`,
the same layout `repo-setup.ts` relies on for `bundledSkillsRoot()`). The
instruction is included only when that file exists, so an unusual packaging
never produces a prompt pointing at a missing file.

**Tech stack:** TypeScript, `node --test`.

**Spec:** `docs/research/story-corpus-audit-2026-09.md` (findings 1–2; user feedback on the repair path).

## Global constraints

- Depends on plan 017 (the bundle exists at build time).
- The prompt-size cap is a drift guard. It rises from 5,700 to 6,000 characters
  only for this instruction, and the test comment says so. Measured on
  2026-09-25 after the change: 5,920 (brief), 5,924 (guided), 5,932 (detailed).
- Verified in a scratch copy on 2026-09-25: 72/72 agent tests pass (71
  existing after plan 023, with the two cap assertions raised, plus 1 new).

## Review focus

- The checker path appears quoted (`node "<path>"`), because install paths can
  contain spaces (`/Applications/diffStory.app/...`).
- No craft rule leaks into the prompt: the duplication guard test
  (`'storyPrompt pins run facts and delegates every craft rule to the skill'`)
  must still pass unchanged apart from the cap.

---

### Task 1: Checker instruction in both prompts; landing in repairs

**Files:**
- Modify: `src/agent.ts`
- Test: `test/agent.test.mjs`

- [ ] **Step 1: Failing test** (append to `test/agent.test.mjs`):

```js
test('both authoring prompts tell the agent to run the bundled checker until READY', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('scripts/check-story.mjs'));
  assert.ok(p.includes('RESULT: READY'));
  const repair = storyRepairPrompt({ action: 'rewrite', base: 'main', stepId: 's1' });
  assert.ok(repair.includes('scripts/check-story.mjs'));
  assert.ok(repair.includes("A step's FIRST beat lands the listener"));
  assert.ok(!repair.includes('short, informal'));
});
```

- [ ] **Step 2: Run** `npm run build && node --test test/agent.test.mjs` — expected: the new test FAILS.

- [ ] **Step 3: Implement in `src/agent.ts`.**

(a) Below `import { spawn, spawnSync } from 'node:child_process';` add:

```ts
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
```

(b) Directly above the doc comment
`/** The instruction handed to the agent — triggers the producer skill, pins the exact diff. */`, add:

```ts
/** The story checker bundled with this build's copy of the storyteller skill. */
export const STORY_CHECKER = fileURLToPath(
  new URL('../skills/diffstory-storyteller/scripts/check-story.mjs', import.meta.url),
);

/**
 * Tells the agent to verify its own story before finishing. The app's finish
 * gate rejects contract failures but never checks coverage or prose; the
 * checker does both, and the agent can still fix what it finds.
 */
function checkerInstruction(): string {
  return existsSync(STORY_CHECKER)
    ? `Before you finish, run the checker that ships with the skill, from the repository root: node "${STORY_CHECKER}". ` +
        `Fix every ERROR, fix or justify every WARNING, and rerun until it prints "RESULT: READY".\n\n`
    : '';
}
```

(c) In `storyPrompt`, directly before the line
`` `Live progress notes (streamed to the reviewer while you work):\n` + `` insert:

```ts
    checkerInstruction() +
```

(d) In `storyRepairPrompt`, replace

```ts
    `- Keep the story short, informal, causal, and review-oriented.\n` +
```

with

```ts
    `- Keep the story causal and review-oriented, in the voice of the steps around the repair.\n` +
    `- A step's FIRST beat lands the listener: name the function/rule, who reaches it and when, then the change. Never open on the change.\n` +
```

and replace its last line

```ts
    `- Write the repaired JSON back to ${DATA_DIR}/story.json. Do not ask questions.\n`
  );
```

with

```ts
    `- Write the repaired JSON back to ${DATA_DIR}/story.json. Do not ask questions.\n\n` +
    checkerInstruction()
  );
```

- [ ] **Step 4: Raise the two size caps, with their reason.** In
  `test/agent.test.mjs`:

In `'storyPrompt pins run facts and delegates every craft rule to the skill'`, replace
`assert.ok(p.length < 5700, …);` with:

```js
  // Raised to 6000 for the checker instruction: it is how the agent verifies the
  // validator-enforced contracts (and coverage) before the finish gate runs.
  assert.ok(p.length < 6000, `prompt grew to ${p.length} chars — move craft rules into SKILL.md instead`);
```

In `'storyPrompt supports story detail levels'`, replace
`assert.ok(prompt.length < 5700, …);` with:

```js
    // Raised to 6000 with the checker instruction (see the test above).
    assert.ok(prompt.length < 6000, `${mode} prompt grew to ${prompt.length} chars`);
```

- [ ] **Step 5: Run** `npm run build && node --test test/agent.test.mjs test/eval-cases.test.mjs`
  — expected: PASS. Print the three prompt lengths for the report:

```bash
node --input-type=module -e "import { storyPrompt } from './dist/agent.js'; for (const m of ['brief','guided','detailed']) console.log(m, storyPrompt('main', undefined, m).length);"
```

- [ ] **Step 6: Full suite and commit**

Run `npm test` — expected: all pass.

```bash
git add src/agent.ts dist/agent.js test/agent.test.mjs
git commit -m "feat: generation and repair prompts run the bundled story checker"
```
