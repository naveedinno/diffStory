---
name: review-tour
description: Use right after you (the agent) have made code changes the user needs to review, especially a large multi-file change. Produces .diffstory/story.json — a guided, in-order reading path through your own diff — so the reviewer reads the change the way it was meant to be understood instead of alphabetically by filename. Run before handing work back for review.
---

# Writing a review story

You just changed code. The reviewer now has to understand it, distrust it in the
right places, and get through it without reading a raw alphabetical diff. Your
job is to write `.diffstory/story.json`: order and narrative only, never copied
code. diffStory renders the real git diff.

The story should feel like a sharp teammate guiding review over your shoulder:
entry point, flow, helpers, boundaries, tests. It should expose your judgment,
not hide behind a changelog.

## Non-Negotiable Contract

- Diff exactly the requested scope. If the prompt gives a base/head, use that exact scope.
- Set `base` to the ref you diffed against. Set `head` only for fixed `base..head` stories.
- Every changed hunk must be claimed by a `changed` or `new-file` step.
- Never use "deleted" as a step kind. For deleted files, use kind "changed"
  and anchor the range at the post-change deletion location.
- `range` uses post-change, 1-based inclusive line numbers.
- Optional `focus.ranges` uses post-change, 1-based inclusive line numbers inside that step's `range`.
- `context` is only for unchanged code that helps the reviewer understand a changed path.
- Do not reproduce code in the story. diffStory pulls code from git.

## Story modes

The prompt may ask for `"mode": "guided"` or `"mode": "detailed"`. Write that
top-level field in `.diffstory/story.json`.

### Guided review mode

Use this unless the prompt explicitly asks for detailed mode. Keep the story
compact: one stop per review question, grouped by runtime/control/data flow. The
reviewer should know where to read, what changed, and where to slow down.

### Detailed correctness mode

Use this when the prompt asks for detailed, line-by-line, correctness-review, or
audit-style explanation. The reviewer is checking whether the code is exactly
what it should be, not just getting oriented.

- Prefer more, smaller stops when a method, component, contract function, test,
  or script has separate decisions.
- Explain important ranges almost line-by-line: name the method, then describe
  what the first guard checks, what each assignment/call prepares, what each
  branch accepts or rejects, and what state, return value, render, event, or
  side effect follows.
- Cover all meaningful code paths: happy path, validation guards, error paths,
  fallbacks, persistence, cleanup, external calls, UI states, and tests.
- Use exact function, variable, parameter, event, field, and assertion names.
  Do not paste code blocks or duplicate the diff.
- Detailed does not mean noisy. Skip trivial syntax, imports, and mechanical
  plumbing unless they change correctness.

## Workflow

### 1. Get the change set

Run the exact diff you are reviewing. If the prompt specifies a diff command, use
that command. Otherwise run `git diff $(git merge-base HEAD <default-branch>)`
(usually `main` or `master`). If you are not on a branch, use `git diff HEAD`.

Useful commands while planning:

```bash
git status --short
git diff --name-status <base> --
git diff --stat <base> --
git diff <base> --
```

For fixed range stories, use:

```bash
git diff <base>..<head> --
```

### 2. Make a reviewer map before JSON

Before writing `.diffstory/story.json`, privately build a reviewer map. Do not
include this map in the file.

Identify:

- the behavior this change is really about;
- the first entry point a reviewer should inspect;
- the control/data flow from that entry point through helpers, state, UI, side effects, or external boundaries;
- the invariants, edge cases, unknowns, or risks the reviewer should keep in mind;
- which tests, docs, snapshots, or generated files support each behavior.

Assume the reviewer is auditing AI-authored code and needs a falsifiable mental model fast.
The story should help them distrust the right places.

### 3. Plan the reading path

Make a scratch plan with one row per intended stop:

```text
step | role | file:range | kind | leads to | reason this stop exists
```

Plan by code logic, not filenames:

- Start where the behavior enters the system: endpoint, handler, command, public method, migration entry, UI interaction, or protocol call.
- Follow runtime/control/data flow across files. When you dive into a helper, return to the caller if that helps the reader.
- Put definitions before repeated uses when the definition makes later steps readable.
- Put core behavior before glue, adapters, docs, generated files, snapshots, and tests.
- Group related hunks into one stop when they answer one review question.
- Split one file into multiple stops when separate hunks represent different decisions.
- Use context stops only for real dependency contracts: unchanged callers, callees, storage/schema/config, feature flags, external API boundaries, or helper preconditions.

A good path reads like: "Start here, jump into the helper this calls, come back
for the boundary handling, then inspect the tests that pin it."

### 4. Choose tight ranges

Each step should show the smallest useful review unit:

- Prefer a function, method, branch, schema block, test case, or config stanza.
- Include enough surrounding lines that the hunk makes sense.
- Avoid whole-file ranges unless the whole file is genuinely new and small, or the whole file is truly the review unit.
- For deletion-heavy hunks, anchor to the post-change line where the deletion happened and include the smallest surrounding code that explains the removed behavior.
- If a hunk spans unrelated behavior, create separate steps.

Ranges are review windows, not coverage hacks.

### 4.5. Add precise read-aloud focus when useful

diffStory can glow the exact code while the story is read aloud. The step
`range` is still the review window, but optional `focus.ranges` tells the reader
what line or tiny block to point at during narration.

Focus pointer contract:

- Use `"focus": {"ranges": [[startLine, endLine]], "label": "short cue"}` only
  when the spoken point is narrower than the step range.
- `focus.ranges` must use post-change line numbers and stay inside that step's
  `range`.
- The focus can be one or two lines when that is what the sentence is talking
  about; point to the exact guard, call, assertion, state write, or branch, not the whole displayed section.
- In guided mode, add focus only for the exact line or tiny block the reviewer
  should look at while listening.
- In detailed mode, prefer narrow focus ranges for guards, branches, state
  writes, external calls, assertions, and other line-by-line correctness pivots.
- If the whole step range is the right thing to point at, omit `focus`;
  diffStory highlights the step range automatically.

### 5. Write one step per stop

Each step has:

- `file` + `range`: the post-change location to show.
- `kind`: `changed`, `new-file`, or `context`.
- `title`: a sidebar-readable review claim, behavior, invariant, or risk.
- `why`: the story note for the stop.
- `calls` / `returnsTo`: optional links for real conceptual jumps.

Step titles should work without the body text. Good titles:

```text
Entry point rejects over-cap orders before placement
Funding nonce guard blocks stale PartyB updates
Settlement helper keeps the reserve math local
Regression test pins the skipped-update path
```

Weak titles:

```text
Update OrderService
Add helper
Tests
Changes in api.ts
```

Each `why` should answer a reviewer question. In guided mode, use 1-3 short
first-person sentences. In detailed correctness mode, 3-7 short sentences are
fine when needed to walk the range line by line:

1. Where this stop sits in the runtime/control/data flow.
2. What the old path failed to handle, preserve, reject, or prove.
3. The exact invariant, edge case, or review question the human should verify.

Good shape:

```text
Start here: the API receives the order before anything is persisted. I reject over-cap requests before placement because the old flow only noticed the limit after state had already moved. That keeps the helper in the next step focused on the cap math instead of cleanup.
```

For tests:

```text
Final proof: this test pins the failure mode from the entry point. It should fail if an over-cap order can reach placement again, so it is the guardrail for the behavior above.
```

Use attention cues when they help scanning: `Start here`, `Pause here`,
`Skim this`, `Check this invariant`, `Final proof`. They should feel natural,
not like labels pasted onto every step.

### 6. Link calls sparingly

Use `calls` / `returnsTo` only when the reviewer should conceptually jump.

- Caller step uses `calls: ["calleeStep"]`.
- Callee step uses `returnsTo: "callerStep"` when the reader should come back.
- Do not link every adjacent step.
- If you set a link, name the actual handoff in `why`: what is passed, called, returned, read, written, or validated.

## Hard quality gates

Coverage is necessary, but not sufficient.

### Coverage ledger

Before writing `.diffstory/story.json`, build a private coverage ledger from the
exact diff: file, changed hunk range, semantic purpose, and planned step id.
Every changed hunk must appear in the ledger and must be claimed by a
`changed` or `new-file` step. Context steps never count as coverage.
Never use "deleted" as a step kind. For deleted files, use kind "changed" and
anchor the range at the post-change deletion location.

### Range audit

- Read the post-change file with line numbers before choosing a range.
- `changed` and `new-file` ranges must overlap real changed ranges.
- `context` ranges must be unchanged and must not be used to satisfy coverage.
- Do not use whole-file or giant ranges just to pass `diffstory check`.
- Use `newPath` for renamed files.

### Truth audit

- Every claim in `title`, `summary`, and `why` must be supported by the diff or by source lines you read.
- Do not infer intent from branch names, filenames, or vibes.
- Do not invent runtime behavior, product semantics, test results, or safety claims.
- Do not claim tests pass unless you ran them.
- Do not claim a test covers behavior unless the assertion is visible in the story range or in code you read.
- If you are uncertain, narrow the claim to what the code shows.

### Reviewability audit

- The summary is the review map: what changed, how to read it, and the one or two places where the reviewer should slow down.
- The first step should start at the most useful entry point.
- Every title should name behavior, risk, contract, or invariant, not a file operation.
- Every `why` should connect previous context, local change, and next implication.
- Tests, docs, snapshots, and generated files go after the behavior they verify or explain.
- Low-risk mechanical changes still need coverage, but put them late and mark them as skim-worthy.

## Schema

```jsonc
{
  "version": 1,
  "mode": "guided",
  "title": "<short title for the whole change>",
  "summary": "<1-3 short sentences: what changed + how to walk the story + where to slow down>",
  "base": "main",
  "head": "feature-branch",
  "steps": [
    {
      "id": "s1",
      "order": 1,
      "title": "Entry point: settleFunding() clamps before settlement",
      "file": "contracts/Funding.sol",
      "range": [120, 145],
      "focus": { "ranges": [[128, 132]], "label": "clamp before balance mutation" },
      "kind": "changed",
      "why": "Start here: the keeper reaches this path each epoch. I clamp the rate before settlement hands off to the math helper because the old path let over-cap values travel too far. Check that this happens before any balance mutation.",
      "calls": ["s2"],
      "tags": ["entrypoint", "core"]
    },
    {
      "id": "s2",
      "order": 2,
      "title": "Helper: _capRate() owns the boundary rule",
      "file": "contracts/lib/RateMath.sol",
      "range": [40, 58],
      "kind": "new-file",
      "why": "Pause here: settleFunding() lands here after choosing the market cap. I keep the helper small so both callers use the same inclusive boundary; the review focus is the require that makes the unchecked math safe.",
      "returnsTo": "s1"
    }
  ]
}
```

Use `"mode": "detailed"` for the longer correctness-review story.

Omit `head` when the story is for working tree vs base instead of a fixed
`base..head` range.

## Save and verify

Write `.diffstory/story.json`, then run:

```bash
diffstory check
```

Fix every issue:

- "not in the tour" means add or tighten a `changed` / `new-file` step.
- Stale pointers mean correct the range, file, or kind.
- Schema/reference errors mean fix the JSON, ids, order, `calls`, or `returnsTo`.

Run `diffstory check` again until clean. If a clean story is impossible, report
the blocker instead of pretending it is ready.

Tell the user: "Story ready - run `diffstory serve` to review."

## Don't

- Don't write a step per file mechanically.
- Don't organize by filename, package, or hunk order unless that is genuinely the clearest review path.
- Don't restate the diff with bland verbs like "adds", "updates", "modifies", or "changes" unless the sentence also names the consequence or review risk.
- Don't write checklist-only copy. Work the review focus into the story.
- Don't add context steps as scenery.
- Don't bury the core behavior behind docs, tests, generated files, or cleanup.
- Don't make unsupported confidence claims like "this is safe" or "tests cover it" without naming the exact condition or evidence.
- Don't skip the `diffstory check` gate.
