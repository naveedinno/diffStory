# Narrative-first story pipeline with a first-class intent block

**Date:** 2026-07-02
**Status:** Approved

## Problem

Generated review stories explain code file-by-file instead of telling the story of
the change: why it was made, what flow was designed, and how the implementation
follows that flow. Root causes:

1. **The story agent is blind to intent.** The app-button path spawns a fresh
   headless agent (`src/server.ts` → `storyPrompt` in `src/agent.ts`) that sees
   only the diff. The Truth contract forbids inventing intent, so the only safe
   output is code description.
2. **The only enforced rule is mechanical.** The coverage gate is a hard check;
   the narrative arc is soft guidance buried among ~15 equal-weight contracts.
   The model satisfies the checkable rule, producing hunk-enumeration steps.
3. **Nothing checks ordering.** No rule fails when the reading path degrades to
   file order.

## Goals

- The story opens with a grounded "why this change" a reviewer can trust.
- Steps follow the causal/runtime chain of the change, not filenames.
- Each step continues the thread from the previous one.
- The why is visible in the app, so its absence is visible too.
- No invented intent: every goal claim cites its evidence.

## Non-goals

- No second critique agent per generation (may be added later if quality drifts).
- No per-step schema additions; the thread rule is enforced at prompt level.
- No changes to coverage, viewport, highlight, or beat mechanics — they are
  compressed in presentation, not weakened.

## Design

### 1. `StoryIntent` block (schema)

New optional field on `Tour` in `src/types.ts`:

```ts
/** The recovered "why" behind the change — shown before any step. */
export interface StoryIntent {
  /** What we wanted to enable: actor + capability, 1-2 sentences. */
  goal: string;
  /** The flow designed to achieve it, 1-2 sentences. */
  design?: string;
  /** Evidence the goal rests on: "commit 41af8b7", "PR #12 body",
   *  "conversation", "docs/plan.md", or "code-derived". */
  sources?: string[];
}
```

`Tour` gains `intent?: StoryIntent`. Old stories without it remain valid.

**Recovery rules** (identical in SKILL.md and `storyPrompt`):

- **In-session path** (coding agent runs the review-tour skill after making the
  change): the goal comes from the task it was actually given
  (`sources: ["conversation"]`). This path — and only this path — may ask the
  user up to 2 clarifying questions when intent is genuinely ambiguous.
- **App-button path** (headless spawn, stdin closed, cannot ask): a mandatory
  evidence sweep before reading the diff — `git log` over the diff range,
  `gh pr view` when a PR exists, plan/design docs, CHANGELOG entries, issue
  references in commit messages. Every goal claim cites its source in `sources`.
- **No evidence found**: state the goal as what the code demonstrably enables,
  set `sources: ["code-derived"]`, and word it narrowly. Honest uncertainty
  beats invented product narrative.
- **Truth contract refinement**: commit messages, PR bodies, and docs are
  legitimate intent evidence. Branch names and filenames alone remain forbidden.

**Rendering**: the Overview panel (`introPanel` in `src/render.ts`) shows
`goal` as the lede, `design` beneath it, and a small provenance caption listing
`sources`. Apple HIG styling consistent with the rest of the page. Stories
without `intent` fall back to the current summary-as-lede behavior.

**Validation** (`src/tour.ts`): `intent` optional; when present, `goal` must be
a non-empty string, `design` a string if present, `sources` an array of strings
if present. Invalid shapes produce the same style of validation errors as other
fields.

### 2. Narrative-first restructure of SKILL.md and `storyPrompt`

Both documents are rewritten around the same 3-phase spine. Each carries a note
that the other must move with it (they are intentionally self-sufficient
duplicates: the headless agent may not have the skill installed).

**Phase 1 — Recover the why.** The rules above. Output feeds `intent`.

**Phase 2 — Design the reading path.** Before writing any JSON, the agent must
write out its narrative arc as visible output: goal → design decisions →
implementation chain. Step order comes from that chain. Two hard rules:

- **Thread rule**: every step's first beat (except step 1) must pick up what
  the previous step established ("Now that the cap is stored, here's who reads
  it"). This is what makes steps read as a story instead of disconnected
  explanations.
- **Order test**: if sorting the steps by filename would not change how the
  story reads, the path is not a story yet — reorder or justify.

**Phase 3 — Write the steps.** All existing mechanics survive unchanged in
force (coverage ledger, range/viewport/highlights contracts, beats,
calls/returnsTo, deletion sentinels) but are compressed into a tight checklist
so they stop drowning the narrative. Narrative is the spine; mechanics are the
checklist.

**Self-review becomes falsifiable** (replaces the current vague dry
self-review):

1. Run the order test.
2. Strike any beat that only restates what the code does without why it exists.
3. Read the beats alone, no code — do they still form a story with no jumps?
4. Existing coverage / range / truth checks remain.

### 3. Validation, tests, shipping

- `src/tour.ts`: validate the intent block.
- `test/agent.test.mjs`: assert the new prompt phases, intent contract, thread
  rule, order test.
- `test/tour.test.mjs`: intent validation cases (valid, missing goal, wrong
  types, absent block).
- `test/render-page.test.mjs`: intent panel rendering and the no-intent
  fallback.
- `examples/review-tour.json`: add an `intent` block so the example teaches the
  new shape.
- Rebuild `dist/` and commit it (GitHub installs have no build step).
- Verification: run the full test suite; generate a real story against this
  repo's own diff and eyeball narrative quality (order ≠ file order, thread
  rule holds, intent panel renders).

## Error handling

- Missing/invalid `intent` never breaks rendering — the panel falls back to the
  summary lede.
- The headless agent must not stall waiting for answers: only the in-session
  path may ask questions; the prompt keeps "Do not ask questions" for the
  headless spawn.
- If intent evidence is contradictory (commits say X, code does Y), the story
  must say so in the summary rather than pick silently.
