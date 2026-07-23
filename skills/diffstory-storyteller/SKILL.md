---
name: diffstory-storyteller
description: Use right after you (the agent) have made code changes the user needs to review, especially a large multi-file change. Produces .diffstory/story.json for diffStory — a context-first, guided reading path through your own diff that opens with recovered intent and drives exact viewport and highlight beats. Run before handing work back for review.
---

# Writing a diffStory

You just changed code. The reviewer now has to understand it, distrust it in the
right places, and get through it without reading a raw alphabetical diff. Your
job is to write `.diffstory/story.json`: order and narrative only, never copied
code. diffStory renders the real git diff.

The story should feel like a sharp teammate guiding review over your shoulder:
why the change exists, entry point, flow, helpers, boundaries, tests. It should expose your judgment,
not hide behind a changelog.

Assume the reviewer remembers the requested outcome but not the app internals:
module ownership, the existing call path, state flow, or why nearby unchanged
code matters. The job is to rebuild the smallest useful mental model, then move
their eyes through the evidence with `viewport`, `highlights`, and `beats`.
Coverage is the trust floor; restored context is the product.

diffStory is UI-only. Never install, invoke, validate with, or recommend a
`diffstory` CLI command. Write and validate the story artifact directly, then
tell the user to open or refresh the installed diffStory app.

## Non-Negotiable Contract

- Newly generated stories use `"version": 2`. Version 1 stories remain readable;
  do not rewrite an existing v1 story merely to modernize its number.
- Open the story with an `intent` block whose `goal` cites real `sources`; use
  `["code-derived"]` when no evidence exists.
- Diff exactly the requested scope. If the prompt gives a base/head, use that exact scope.
- If the prompt gives selected story files, write steps only for those files and
  persist the same top-level `storyScope` object the prompt provided.
- Set `base` to the ref you diffed against. Set `head` only for fixed `base..head` stories.
- Every changed hunk must be claimed by a `changed` or `new-file` step.
- Never use "deleted" as a step kind. For deleted files, use kind "changed"
  and anchor the range at the post-change deletion location.
- For a whole deleted file, use `range`, `viewport`, and `highlights` of `[0, 0]`.
  Do not invent line 1 for a file that no longer exists.
- `range` uses post-change, 1-based inclusive line numbers as the tight local
  camera anchor, except `[0, 0]` is the sentinel for a whole-file deletion.
  When top-level `ranges` is absent, `range` is also the step's complete
  coverage claim.
- Optional top-level `ranges` is the complete list of post-change, 1-based
  inclusive spans a `changed` or `new-file` step claims. Use it only for one
  repeated mechanical pattern in changed or new-file code. When present,
  `range` must be contained in one entry; the other entries may sit outside
  `viewport`, and `range` is not their bounding box.
- `viewport` uses post-change, 1-based inclusive line numbers as the visible
  review window the diff viewer should show, except `[0, 0]` shows the deleted
  hunk for a whole-file deletion.
- `highlights` uses post-change, 1-based inclusive line ranges inside
  `viewport`; these are the lines the story is currently talking about.
- Optional `focus.ranges` is the legacy spelling for `highlights`. It is not
  the top-level coverage field `ranges`.
- `context` is only for unchanged code that helps the reviewer understand a
  changed path. It must not contain top-level `ranges` because context never
  claims coverage.
- `concept` is a short, fileless primer that teaches a mental model immediately
  before dependent code. It never claims coverage and must not contain `ranges`.
- Do not reproduce code in the story. diffStory pulls code from git.
- Every substantive code step includes a short `question` the reviewer can
  answer from the highlighted evidence. A step tagged `skim`, `sweep`, or
  `mechanical` may omit `question`; concept primers do not use it.
- Stories longer than 10 steps give every step a concise `chapter`; reuse each
  chapter across 3-7 consecutive steps so the rail stays scannable.
- Top-level `hotspots` (at most 3) anchor your honest doubt to code steps: each
  is `{"step": "<code-step-id>", "reason": "<why you are least sure here>"}`.
- `intent.nonGoals` lists deliberate omissions the reviewer should not flag.
  Only claim non-goals your intent evidence supports; never invent them.

## Detail levels

The prompt may ask for `"mode": "brief"`, `"mode": "guided"`, or
`"mode": "detailed"`. Write that top-level field in `.diffstory/story.json`.

Concept-primer budgets are hard maxima, not targets:

- Brief: at most 1 concept primer.
- Guided: at most 2 concept primers.
- Detailed: at most 3 concept primers.

Use zero when the code story has no real concept gap.

### Brief mode

Use this when the prompt asks for a brief, skim, shortest useful, or one-line
story. Keep the story as short as possible while still covering every changed
hunk: one compact stop per meaningful change cluster, and exactly one short
first-person sentence in each `why`.

Rebuild context inside the changed step's viewport when possible. Spend a
separate context step only when the entry point or dependency contract lives
elsewhere.

### Balanced mode

This is the default for `"mode": "guided"`. Keep the story compact but useful:
one stop per review question, grouped by runtime/control/data flow. The reviewer
should know where to read, what changed, and where to slow down.

Use only the few context bridges needed to restore the task-local app flow. Do
not tour unrelated architecture.

### Line-by-line mode

Use this for `"mode": "detailed"` or when the prompt asks for detailed,
line-by-line, correctness-review, or audit-style explanation. The reviewer is
checking whether the code is exactly what it should be, not just getting
oriented.

- Prefer more, smaller stops when a method, component, contract function, test,
  or script has separate decisions.
- Explain important ranges almost line-by-line: name the method, then describe
  what the first guard checks, what each assignment/call prepares, what each
  branch accepts or rejects, and what state, return value, render, event, or
  side effect follows.
- Cover all meaningful code paths: happy path, validation guards, error paths,
  fallbacks, persistence, cleanup, external calls, UI states, and tests.
- Trace the relevant inbound trigger and outbound consumer or side effect,
  including unchanged boundary code when it controls correctness.
- Use exact function, variable, parameter, event, field, and assertion names.
  Do not paste code blocks or duplicate the diff.
- Line-by-line does not mean noisy. Skip trivial syntax, imports, and mechanical
  plumbing unless they change correctness.
- Detailed mode does not turn scattered substantive decisions into one step.
  Top-level `ranges` remains limited to one repeated mechanical sweep; each
  substantive decision keeps its own local review stop.
- "Line-by-line" describes *granularity*, never *phrasing*. It means more, smaller
  stops with narrower highlights — it does not license narrating line numbers.
  Detailed beats obey the same prose rules as every other mode: no "Line 742 …"
  openers, one decision per beat, and every beat ends on the consequence. Name
  the method, guard, or assertion in words; let the highlight supply the address.

## Workflow

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
- Prefer evidence that *motivated* the change over evidence that merely
  *describes* it. A design doc, ticket, mockup, or conversation explains why the
  work was wanted; the commit message of the very change you are explaining is
  often just the diff restated in prose. Citing only that is circular — it reads
  as a recovered why but adds nothing the reviewer could not read off the diff.
- When the change's own commit message really is the only evidence, keep the
  goal narrow and factual rather than inflating it into product intent you
  cannot support.
- If no evidence exists, state the goal as what the code demonstrably enables,
  cite `"sources": ["code-derived"]`, and keep the wording narrow. Never invent product intent.
- If the evidence contradicts what the code does, say so in the summary instead
  of silently picking one.

Also recover the deliberate omissions. Reviewers burn time flagging what the
author skipped on purpose, so when the task evidence shows something was
intentionally left alone — an adjacent path not migrated, an ordering not
changed, a cleanup deferred — record it in `intent.nonGoals` as short
"deliberately does not …" entries. Non-goals need the same evidence standard as
the goal: only claim an omission was deliberate when the conversation, commits,
or docs say so. If you merely did not get to something, that is a hotspot or an
honest gap, not a non-goal.

Write the result into the story:

```jsonc
"intent": {
  "goal": "We wanted keepers to settle funding without one market's spike draining balances.",
  "design": "settleFunding() clamps through one shared _capRate() helper that reads each market's cap.",
  "sources": ["conversation"],
  "nonGoals": ["Deliberately does not change settlement ordering; only the rate input is clamped."]
}
```

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

### 2. Reconstruct the app path

The diff tells you what moved; the surrounding source tells the reviewer where
it lives. Before planning steps:

- Read the complete post-change function, component, contract, schema, config
  stanza, or test around every changed hunk.
- Trace the smallest useful path one hop in both directions. Find the inbound
  trigger, caller, route, event, or UI action, then find the outbound consumer,
  state write, render, return, external boundary, or assertion.
- Search real symbols and call sites. Do not infer a path from filenames.
- Read the base-side code when the old behavior or a deletion matters to the
  judgment.
- Read only relevant module docs, types, config, and tests. This is task-local
  orientation, not a repo tour.

Privately write the app path as:

```text
entry -> existing owner -> changed decision -> downstream effect -> proof/risk
```

For every link, record the exact source span and choose whether it belongs in a
changed step's wider viewport or needs a dedicated `context` step. Make
`intent.design` name the existing app path, where this diff attaches, and the
new outcome.

### 3. Make a reviewer map before JSON

Before writing `.diffstory/story.json`, privately build a reviewer map. Do not
include this map in the file.

Identify:

- the behavior this change is really about;
- the first requirement-backed place a reviewer should inspect;
- the control/data flow from that entry point through helpers, state, UI, side effects, or external boundaries;
- the invariants, edge cases, unknowns, or risks the reviewer should keep in mind;
- which tests, docs, snapshots, or generated files support each behavior.

Also identify the minimum unchanged code the reviewer must see to understand
who calls the change, what data or state enters it, and what consumes the result.

Assume the reviewer is auditing AI-authored code and needs a falsifiable mental model fast.
The story should help them distrust the right places.

### 3.5. Narrative arc

Write the story as intent -> flow -> implementation, not a list of touched files.
Before any JSON, write the arc as a short visible note in your working output:
goal -> design decisions -> implementation chain.

- Start from the goal the diff actually supports: "We wanted to enable
  <actor> to <capability>." Reuse the `intent` block you recovered in step 0.
- Then explain the product or runtime shape: "To make that work, we designed the flow so X reaches Y, Y asks Z, and Z returns/stores/renders P."
- Then walk the implementation sequence: "To implement that flow, I first changed Y in Z, then wired U into P, then pinned it with tests/docs."
- Each step should continue that arc. Explain why this stop exists in the
  designed flow and what it unlocks next.
- Thread rule: each code step's first beat must pick up what the previous stop
  established ("Now that the cap is stored, here is who reads it"). After a
  primer, apply its mental model directly to the code so the steps read as one
  continuous story.
- Chapter-seam rule: the thread breaks hardest where chapters meet. The FIRST
  step of every new `chapter` must open by naming the seam — what the previous
  chapter settled, and why this one starts — before it says anything about its
  own code. "That closes the numeral redesign; this is a second, independent fix
  to the storyless path." Without that sentence the reader lands in unfamiliar
  code with no idea why they moved, and the story reads as two documents stapled
  together. This is the single most common place a story loses its thread.
- Long-tail caution: in a long chapter, beats drift into captions that describe
  their own lines and connect to nothing. Rewrite substantive beats to connect
  — "same handler family as above, but this one also writes state" — and never
  merge unrelated decisions just to shorten the rail. For one verified repeated
  mechanical pattern in one file, a tagged sweep may instead list every full
  changed span in top-level `ranges` while one local `range`, viewport, and beat
  show a representative instance. This is a coverage-preserving tool for the
  repetitive tail, not a general instruction to make stories shorter.
- Branch rule: some diffs carry two or three genuinely independent concerns —
  a fix and an unrelated layout change, two separate gaps closed in one commit.
  Do not fake a thread between them. Instead, name the concerns in the `summary`
  ("two independent changes: X, then Y"), finish one completely before starting
  the next, and open the first step of each new concern by announcing the switch
  ("That closes the kicker; the second, unrelated gap is the stage layout").
  An unsignalled jump between concerns is the most common way a story loses the
  reviewer — they keep hunting for a connection that was never there.
- Order test: if sorting your planned steps by filename would not change how
  the story reads, it is not a story yet — reorder, or state in one line why
  file order genuinely is the clearest path.
- Do not invent user intent. If the diff only proves a technical refactor, make
  the goal technical and keep it grounded.

### 3.6. What good looks like: the same diff, told twice

One small diff — `settleFunding()` in `Funding.sol` gains a clamp, a new
`_capRate()` helper lands in `RateMath.sol`, and `RateMath.t.sol` gets a test.
Two stories.

**The changelog (do not write this).** File order, diff-restating beats,
rhetorical questions:

```text
1. "Update Funding.sol"       — why: "Adds a cap check to settleFunding()."
                                 question: "Is the cap checked?"
2. "Add RateMath.sol helper"  — why: "Adds a _capRate() helper for clamping."
                                 question: "Does the helper clamp?"
3. "Add tests"                — why: "Adds tests for the new helper."
                                 question: "Do the tests cover the helper?"
```

Every hunk is covered, every gate passes — and the reviewer learned nothing the
diff didn't already say. Each `why` restates its own hunk, no step hands off to
the next, and every question answers itself with "yes" while the real question
(can an unclamped rate still reach balances?) is never asked.

**The story (write this).** Same three stops, ordered by the runtime path,
each beat picking up what the previous stop established:

```text
1. "Entry: settleFunding() clamps before balances move"
   beat: "Start here: the keeper hits this path each epoch, and the old code
          handed the raw rate straight to settlement."
   beat: "Now the rate passes through _capRate() first — the review hinge is
          that this happens before any balance mutation."
   question: "Can any path still reach the balance write with an unclamped rate?"
2. "Helper: _capRate() owns the inclusive boundary"
   beat: "This is where the entry point just sent us; the cap is inclusive, so
          rate == cap must pass."
   question: "Does the <= match the doc'd inclusive cap, or did an off-by-one slip in?"
3. "Proof: the boundary test pins rate == cap"
   beat: "Final proof: this test fails if the boundary flips to exclusive —
          it guards exactly the hinge from step 2."
   question: "Would this test actually fail if <= became < ?"
```

The difference is not length or polish — it is that each stop exists because of
the previous one, and each question names a failure the evidence must rule out.
If your draft reads like the first version, reorder around the runtime path and
rewrite each beat to say what it unlocks, not what it edits.

### 3.75. Test for concept gaps

Run this Concept-gap test before finalizing the reading path: before each code
stop, ask whether a reviewer can explain the terminology, roles, relationships, or state model needed to understand the next lines. Add a concept primer only
when the answer is no and one visible code span cannot teach the model cleanly.

Keep these roles separate:

- Overview is the whole-change reading map: goal, designed flow, and where the
  review goes.
- A primer is a just-in-time mental model for unfamiliar concepts needed at one
  specific code stop. Do not repeat the Overview or summarize the diff.
- A context step shows exact unchanged code when that code is the clearest
  contract. A concept primer synthesizes a relationship or model that no single
  code viewport explains well.

Place each primer immediately before the first code step that depends on it.
Its `preparesFor` must include that immediately following code step and may list
other later dependent code-step ids. Never place two concept primers next to each other. Never end the story with a concept primer.

Write the primer `body` as a short document of 60-180 words, with a hard maximum
of 220 words. Use compact paragraphs, small lists, emphasis, and inline code.
Do not paste implementation code, add Markdown links/images, or inflate a
primer to hit the word target. If the model does not earn 60 useful words, teach
it in the code beat instead.

Use an optional Mermaid diagram only when it materially clarifies three or more
actors/components, a real branch, or a state transition. Supported declarations
are `flowchart`, `sequenceDiagram`, or `stateDiagram-v2`; a caption is required.
Keep Mermaid local and declarative. No links, URLs, `click`/`href` directives, init/config directives, HTML, images, or custom styling directives. Skip the
diagram for a simple one-way chain the body already explains.

### 4. Plan the reading path

Make a scratch plan with one row per intended stop:

```text
step | role | file:range | kind | leads to | reason this stop exists
```

Plan by code logic, not filenames:

- Make the first code stop the behavioral entry point a developer recognizes,
  even when it is unchanged and needs a `context` step. A just-in-time concept
  primer may precede it only when the entry code already depends on that model.
  Do not start with imports, icons, styling, generated output, or tests unless
  one of those is itself the feature.
- Follow runtime/control/data flow across files. When you dive into a helper, return to the caller if that helps the reader.
- Put definitions before repeated uses when the definition makes later steps readable.
- Put core behavior before glue, adapters, docs, generated files, snapshots, and tests.
- Group related substantive hunks into one stop only when they answer one
  review question and sit close enough to share one viewport. When substantive
  hunks are far apart, write a step for each. The only scattered grouping is
  one repeated mechanical pattern in one file: use a tagged sweep whose
  top-level `ranges` lists every full changed span while `range` anchors one
  representative local shot (see the coverage ledger).
- Split one file into multiple stops when separate hunks represent different decisions.
- Split far-apart focus into separate stops. A single step should feel like a
  steady camera shot over one method, struct, test case, or doc section, not a
  teleport between distant highlight islands.
- Use context stops only for real dependency contracts: unchanged callers, callees, storage/schema/config, feature flags, external API boundaries, or helper preconditions.
- Insert a concept primer only at its just-in-time dependency boundary; do not
  collect primers into an up-front glossary or append them after the code.
- A small change may need one context-rich changed step. Do not force a fixed
  number of stops.

A good path reads like: "Start here, jump into the helper this calls, come back
for the boundary handling, then inspect the tests that pin it."

### 5. Storyboard code viewports and highlighted lines

Each code step must choose what the reviewer sees before choosing the exact
lines the story is talking about. Concept primers have no file camera.

Treat this as a guided camera:

- One code step is one local shot that fits without manual scrolling.
- One beat is one exact pointing gesture whose highlighted lines visibly prove
  its sentence.
- A changed step should usually move through orientation -> change ->
  consequence: first the existing signature/caller/route/contract, then the
  exact changed decision, then the nearby call/state write/return/assertion.
- Context beats may and should highlight unchanged lines. Say that they are
  existing context so the reviewer knows what was preserved.

Viewport contract:

- `viewport` is what the reviewer sees. Choose it from the requirement and the
  code shape, not from the tiny diff hunk.
- Use the whole method, storage struct, schema block, config stanza, test case,
  or small file section when that is what makes the requirement understandable.
- The viewport must answer "where am I?" before the highlights ask for judgment.
- Target 20-30 visible lines for a normal viewport. Guided and brief steps stay
  within 40 lines; detailed steps stay within 60. When the local `range` itself
  exceeds that cap, the viewport may fit the full range plus at most 12 context
  lines — an allowance for one large changed region, not unrelated padding.
  Split a larger function into overlapping local shots. `[0, 0]` is the
  whole-file-deletion exception.
- It is fine for `viewport` to be much wider than the changed lines.
- Keep the visible window local to the thing being explained. If the story needs
  to explain two distant changed blocks, write two steps instead of scattering
  highlights. A mechanical sweep may claim distant repeated spans with
  `ranges`, but its camera still explains one representative instance.
- Avoid whole-file viewports unless the whole file is genuinely new and small,
  or the whole file is truly the review unit.

Highlighted-line contract:

- `highlights` are the lines the story is currently talking about and the rows
  diffStory should glow while reading.
- Keep every highlight range inside `viewport`.
- Use one highlight range for a single field/write/guard/call/assertion, and
  multiple nearby highlight ranges when the sentence moves across small related
  sections. These are pointers, not top-level coverage `ranges`.
- Each beat highlight should point at one fact, normally 1-8 lines and never
  more than 12. A broad glowing region is not a pointer; split it.
- Do not make one step jump between far-apart highlight islands. If the
  highlighted ranges would force the viewer to scroll or lose the current
  method/test/doc section, split the step.
- If the whole viewport is the point, `highlights` may match `viewport`, but do
  that intentionally.
- For new stories, top-level `highlights` must equal the union of the ordered
  beat highlights. There should be one camera plan, not two conflicting ones.

Coverage anchor contract:

**`range` anchors; optional top-level `ranges` claim; `highlights` point. These
are three separate jobs.**

`range` is the tight local anchor the viewport frames. It uses post-change line
numbers, overlaps the representative changed span for a `changed` or `new-file`
step, and stays inside `viewport`. When top-level `ranges` is absent, this anchor
is also the step's complete coverage claim, so it must span the full changed
region the step claims rather than only the lines the beats find interesting.

Optional top-level `ranges` is purely a coverage list. Use it only when one
mechanical edit repeats across scattered changed spans in the same file. List
every full span the step claims; partial or omitted instances leave uncovered
changes. `range` must be contained in one entry, but the other entries may sit
anywhere in the file and outside `viewport`. Keep `range` tight around the
representative camera shot — never turn it into the bounding box of `ranges`.
This top-level field is not legacy `focus.ranges`, which points like
`highlights` rather than claiming coverage.

`highlights` are visible. They stay one small pointer — normally 1-8 lines and
never more than 12 — inside the local viewport. A sweep can therefore claim
many distant repeated spans in `ranges` while its single beat points at one
representative instance.

- Prefer a function, method, branch, schema block, test case, or config stanza.
- Include enough surrounding lines that the hunk makes sense.
- Keep `range` inside `viewport`. Every changed or new-file step needs at least
  one beat highlight that overlaps its local `range` anchor.
- For deletion-heavy hunks with surviving surrounding code, anchor to the post-change line where the deletion happened and include the smallest surrounding code that explains the removed behavior.
- For whole-file deletions with no post-change lines, use the `[0, 0]` deletion
  sentinel for `range`, `viewport`, and `highlights`.
- If spans carry unrelated behavior or separate substantive decisions, create
  separate steps; `ranges` never licenses joining them.

`viewport` is the review window. `highlights` are what the narrator is pointing
at. `range` is the local anchor and legacy fallback claim. Optional top-level
`ranges` is the complete coverage claim when present.

### 5.5. Add precise code read-aloud focus when useful

diffStory can glow the exact code while the story is read aloud. New stories
should use `highlights`; `focus.ranges` remains accepted for old stories.
Legacy `"focus": {"ranges": [[startLine, endLine]]}` is still accepted, but do
not prefer it for new stories. Never confuse this nested pointer field with
top-level `ranges`, the complete coverage-claim list for a mechanical sweep.

Focus pointer contract:

- Prefer `"highlights": [[startLine, endLine]]` for the lines the story is
  currently talking about.
- `focus.ranges` must use post-change line numbers and stay inside that step's
  `viewport` when present, or `range` for legacy stories.
- The focus can be one or two lines when that is what the sentence is talking
  about; point to the exact guard, call, assertion, state write, or branch, not the whole displayed section.
- In brief mode, add focus only for the one exact line or tiny block the
  reviewer should glance at.
- In balanced/guided mode, add focus only for the exact line or tiny block the reviewer
  should look at while listening.
- In line-by-line/detailed mode, prefer narrow focus ranges for guards, branches, state
  writes, external calls, assertions, and other line-by-line correctness pivots.
- If the whole local `range` anchor is the right thing to point at, omit
  `focus`; diffStory highlights that anchor automatically.

### 5.6. Split code narration into read-aloud beats

Beat contract:

- Every new code step must include `beats`: ordered short narration units, each
  with its own `text` and `highlights`. Concept primers use `body` instead.
- Each beat is a separate speech unit, so the read-aloud voice and glowing code
  can move together without guessing timing.
- Use one beat per highlighted code part. Guided and brief steps use at most
  three beats; detailed steps may use up to five. Split additional review points
  into another stop instead of one long `why`.
- The first beat locates the reviewer in the existing flow unless the previous
  context step already did; after a concept primer, it applies that mental model
  to the code. Later beats point at the changed decision and its consequence.
- A beat may point at one small range or a few nearby related ranges, but it
  must stay inside that step's `viewport`.
- Do not put one big speech over several highlight groups; split it into
  beat-by-beat narration.
- Keep `why` as the compact fallback recap for older readers, but put the
  read-aloud story in `beats`.

#### Beat prose: the layer that most often goes flat

A beat is spoken while its lines glow. The reviewer can already see the line
numbers and read the code — so a beat that spends its words on *what the lines
say* is dead air. Its job is what the reader cannot see: why this line, why now,
and what it makes possible next.

Three rules that catch almost every flat beat:

1. **No line-number narration.** Never open with "Line 742 …" or "Lines 30-34
   add …". The glow is already pointing there; the words are the only channel
   that can carry meaning, so don't spend them on the address.
2. **One beat, one decision.** If your beat text contains a semicolon or "and
   also" joining separate line numbers, it is two or three beats — or two or
   three steps. Splitting is never the wrong call.
3. **End on the consequence.** A beat that stops at what the code *is* has
   half a sentence missing: what it now guarantees, prevents, unlocks, or hands
   to the next stop.
4. **Never narrate a value transition.** No `650 → 600`, no "changes X from A to
   B", no "only the weight value moves". The diff already renders both sides in
   colour; repeating them in words is the single most common way a beat says
   nothing. If the old value matters, say what depended on it — "nothing reads
   the old weight, so no consumer breaks" — not what it was.

This applies to *every* beat, including the skim ones. A sweep beat is allowed
to be short; it is not allowed to be empty. "Same rename as above; nothing reads
the old field" is a fine sweep beat. "`.ds-back` font-weight 650 → 600" is not —
it costs the reviewer a line and tells them only what the diff already showed.

The same CSS change, narrated badly and well:

```text
BAD  (one beat, three decisions, pure inventory)
  "Line 742 makes .ds-main transparent; line 747 anchors ghost cards to
   calc(50% - 440px - 66px) instead of a fixed 6px; line 751 gives the active
   step a background, border, and radius."
```

Every clause is true and every clause is visible in the diff. The reviewer
learns nothing about why three unrelated properties moved together, and the
glow has to jump across three regions while one sentence is read.

```text
GOOD  (three beats, each one decision ending in its consequence)
  beat 1: "The page surface goes transparent first — without this the step
           below would be a card sitting on another card, and the island
           edge would never read as an edge."
  beat 2: "Now the step gets its own surface and radius, so it floats as the
           bounded 880px island the mockup asks for."
  beat 3: "The ghosts have to follow that new edge, so they anchor off the
           island's half-width rather than the viewport — this is the number
           to check, since it assumes a 66px gutter clears them."
```

Same lines, same coverage. The difference is that each beat gives the reviewer
a reason and hands off to the next, and the last one aims their attention at
the thing most likely to be wrong.

### 6. Write one code step per code stop

Each code step has:

- `file` + `range`: the tight local camera anchor and, when `ranges` is absent,
  the step's complete coverage claim.
- Optional top-level `ranges`: the complete changed-span claim for one repeated
  mechanical sweep in that file. One entry contains `range`; the remaining
  entries may sit outside the viewport.
- `viewport`: the post-change window the diff viewer should show.
- `highlights`: the post-change lines inside `viewport` that the narration is
  currently discussing.
- `beats`: ordered short notes; each note is read as a separate speech and
  points at its own highlighted code.
- `kind`: `changed`, `new-file`, or `context`.
- `title`: a sidebar-readable review claim, behavior, invariant, or risk.
- `question`: one falsifiable question answered by this stop's evidence;
  required for substantive steps and optional only when `tags` includes
  `skim`, `sweep`, or `mechanical`.
- `chapter`: required when the story has more than 10 steps; reuse it for 3-7
  consecutive stops.
- `why`: the compact fallback recap for the stop.
- `calls` / `returnsTo`: optional links for real conceptual jumps.

Code-step titles should work without the body text. Good titles:

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

Run the flip test on every `question` before keeping it. Substantive steps must
have one. A tagged skim/sweep/mechanical step may omit it instead of inventing a
rhetorical question. When a question is present, do not just answer it — **name
the specific bug that would make the answer come out the other way.** If you
cannot describe that bug in one concrete sentence, the question is rhetorical
and must be replaced or, only for a tagged mechanical sweep, omitted.

```text
Q: "Is the cap checked?"                          (highlight IS the cap check)
   flip: — nothing; the check is right there.     → REJECT, rhetorical
Q: "Would this regex catch a renamed class?"
   flip: — none; a rename changes the string the  → REJECT, only one answer
          regex matches, so it always catches it.
Q: "Can an over-cap rate reach balance mutation before the clamp?"
   flip: — yes, if any caller reaches settle()    → KEEP, names a real bug
          through the legacy path that skips _capRate().
Q: "Does the 66px gutter clear the ghost cards at every width above 1120px?"
   flip: — yes, if the ghost's own 52px body plus → KEEP, falsifiable by math
          its border exceeds the gutter at 1121px.
```

Questions that survive the flip test share a shape: they name a *path*, an
*input*, or a *number* that could be wrong, not a property the diff obviously
has. Beware the two rhetorical templates that look rigorous but aren't — "Does
X do what it says?" and "Is Y covered by the test?" — both answer themselves
from the highlight. If a step supports only rhetorical questions, the step is
probably restating the diff; sharpen the step, not just the question.

Each code-step `why` should be a compact fallback recap for the whole stop. The
read-aloud explanation belongs in `beats`, and each beat should answer one
local reviewer question. In brief mode, use exactly one short first-person
sentence per beat. In balanced/guided mode, use short first-person beats. In
line-by-line/detailed mode, use more beats instead of turning one beat into a
long paragraph:

1. Where this stop sits in the designed runtime/control/data flow.
2. What the old path failed to handle, preserve, reject, or prove.
3. What this local change unlocks for the next caller, helper, path, or proof.
4. The exact invariant, edge case, or review question the human should verify.

Good shape:

```text
Beat 1: Start here: the API receives the order before anything is persisted.
Beat 2: I reject over-cap requests before placement because the old flow only noticed the limit after state had already moved.
Beat 3: That keeps the helper in the next step focused on the cap math instead of cleanup.
```

For tests:

```text
Beat 1: Final proof: this test pins the failure mode from the entry point.
Beat 2: It should fail if an over-cap order can reach placement again, so it is the guardrail for the behavior above.
```

Use attention cues when they help scanning: `Start here`, `Pause here`,
`Skim this`, `Check this invariant`, `Final proof`. They should feel natural,
not like labels pasted onto every step.

### 6.25. Write concept primers with the exact fileless shape

A concept step has exactly the shared identity fields plus its document fields:

```jsonc
{
  "id": "concept-cap-model",
  "order": 2,
  "title": "How the cap travels",
  "kind": "concept",
  "body": "<60-180 word mental model>",
  "preparesFor": ["s2"],
  "diagram": {
    "type": "mermaid",
    "source": "flowchart LR\n  A --> B",
    "caption": "The request crosses the owner before the boundary check."
  },
  "tags": ["mental-model"]
}
```

`diagram` and `tags` are optional. Every other field shown above is required.
A concept step must not contain `file`, `range`, `ranges`, `viewport`,
`highlights`, `beats`, `why`, `question`, `calls`, or `returnsTo`. It also must
not contain legacy `focus`. Link it only through `preparesFor`,
which must point to later code-step ids and include the immediately following
code step. Concept primers never claim diff coverage.

### 6.5. Put necessary context in the visible story

Context must not stay trapped in your private reviewer map.

- First try to frame the existing boundary and changed code together in one
  viewport. Highlight the unchanged signature, caller, branch header, input, or
  return when it tells the reviewer where they are.
- Use kind `context` when important unchanged code lives in another file or a
  distant section: a caller, public route, component owner, storage/schema
  contract, feature flag, helper precondition, or downstream consumer.
- Place inbound context before the changed decision and outbound context after
  it, following the real flow.
- Context steps do not claim diff coverage. Keep them few and make every title
  name the contract the reviewer needs.
- Avoid top-level `ranges` on context steps; a context camera should point at
  one local unchanged contract, not make a multi-span coverage claim.
- Do not use context for imports, trivia, or architecture that does not change
  how the reviewer evaluates this task.

### 7. Link calls sparingly

Use `calls` / `returnsTo` only between code steps when the reviewer should
conceptually jump. Concept primers use `preparesFor` instead.

- Caller step uses `calls: ["calleeStep"]`.
- Callee step uses `returnsTo: "callerStep"` when the reader should come back.
- Do not link every adjacent step.
- If you set a link, name the actual handoff in `why`: what is passed, called, returned, read, written, or validated.

### 8. Declare your doubts (hotspots)

The story answers "where do I read?"; `hotspots` answer the reviewer's real
question: "where should I distrust this?". You just wrote the change — you know
exactly where you were least sure. Say so.

After the steps are written, add top-level `hotspots`: 1-3 entries, each
anchoring a doubt to the code step that shows its evidence:

```jsonc
"hotspots": [
  { "step": "s2", "reason": "I matched the inclusive boundary to the docs but never exercised the exact-cap case." }
]
```

- Honest reasons only: a boundary you guessed at, a path you never ran, an
  invariant you reasoned about but did not test, an unfamiliar API you followed
  by example, math you derived but did not execute.
- Rank by real doubt, not by importance. The entry point is not automatically a
  hotspot; the line you'd re-read at 2am is.
- Use zero hotspots only when you would genuinely stake the review on every
  step — and expect that to be rare.
- Never use hotspots as a summary, a severity label, or decoration. A hotspot
  whose reason could be said about any change ("this is complex") is noise;
  name the specific thing you did not verify.
- Each `step` must be the id of a `changed` or `new-file` step. diffStory shows
  hotspots on the overview as a jump list and flags the step itself, so the
  reason must make sense right next to the highlighted code.

## Hard quality gates

Coverage is necessary, but not sufficient.

### Coverage ledger

Before writing `.diffstory/story.json`, build a private coverage ledger from the
exact diff: file, changed hunk range, semantic purpose, and planned step id.
Every changed hunk must appear in the ledger and must be claimed by a
`changed` or `new-file` step. Context steps never count as coverage.

**Count the hunks before you plan the steps.** Run
`git diff <base> -- <paths> | grep -c '^@@'` and write the number down. For each
`changed` or `new-file` step, record its effective claim: top-level `ranges`
when present, otherwise `range`. The hunk count is a ledger check, not a target
step count. Substantive changes still need enough local steps to explain every
decision; only a repeated mechanical pattern may claim scattered spans together.

Grouping does not stretch the local anchor. Substantive hunks can share a step
only when they are close enough for one viewport and answer one review question.
Scattered substantive decisions need separate steps. Top-level `ranges` is the
single exception for repeated mechanical spans in one file, and every claimed
span must still appear in the ledger.

**Mechanical sweeps** — the same edit repeated across many places (a removed
field, a renamed symbol, an import dropped from twenty callers) — are where this
goes wrong most often. Use one or a few tagged sweep steps, each limited to one
repeated pattern in one file. Point one local representative camera and beat at
the first useful instance, then put every full repeated changed span claimed by
that step in top-level `ranges`. If one instance carries a substantive decision,
give that decision its own normal step and keep it out of the mechanical sweep.

Sweep steps must not become diff narration. This is the failure they invite: a
long tail of near-identical stops each describing what its lines say. Keep them
honest by writing the *pattern* once and pointing at instances:

- Keep `range` tight around one representative instance and inside `viewport`.
  List every full changed span for that repeated pattern in `ranges`; one entry
  contains `range`, while other entries may be far outside the viewport.
  `range` is not the bounding box of those entries.
- Point the single beat at ONE local instance — normally the first useful
  occurrence, 1-8 lines. Do not highlight every claimed span or enlarge the
  viewport to show them all; the reviewer only needs to see the pattern once.
- Their single beat says what the edit is and why it is safe to skim — "same
  attribute rename as above; nothing here reads the old value" — never a
  restatement of the changed lines.
- Give every sweep step the same `chapter` so the rail shows one skimmable
  block rather than a wall of stops.
- Split a sweep only when the pattern, safety argument, or file changes. Never
  use `ranges` to stitch unrelated cleanup or substantive decisions together.

A sweep step is shorter, never structurally lighter. "Compact" describes the
prose only. Every sweep step carries `id`, `order`, `title`, `kind`, `file`, a
local `range`, the complete top-level `ranges`, `viewport`, `highlights`, `why`,
`tags`, and one `beats` entry with both `text` and `highlights`. A tag of `skim`,
`sweep`, or `mechanical` permits the step to omit `question`; substantive steps
still require one. Never rename a field to save room — beats use `text`, never
`body` (`body` belongs to concept primers alone).

Compact valid sweep step — one local camera, every repeated claim, no
rhetorical `question`:

```json
{
  "id": "s12",
  "order": 12,
  "title": "Removed controls leave no stale selectors",
  "kind": "changed",
  "file": "src/page-assets.ts",
  "range": [731, 742],
  "ranges": [[731, 742], [78, 78], [900, 902]],
  "viewport": [728, 760],
  "highlights": [[734, 736]],
  "why": "These spans repeat the same dead-control selector cleanup, so one local instance is enough to verify the pattern.",
  "beats": [
    {
      "text": "Skim this representative selector removal; every other claimed span repeats the same dead-control cleanup.",
      "highlights": [[734, 736]]
    }
  ],
  "tags": ["skim", "sweep"]
}
```

When narrative elegance and coverage genuinely conflict, coverage wins. A story
that reads beautifully while leaving changes unexplained has failed at the one
thing the reviewer cannot check for themselves.
Concept primers never claim diff coverage and never replace a changed or
new-file step in the ledger.
Never use "deleted" as a step kind. For deleted files, use kind "changed" and
anchor the range at the post-change deletion location.
For a whole deleted file, use `range`, `viewport`, and `highlights` of `[0, 0]`.
Do not invent line 1 for a file that no longer exists.
Do not add steps for generated or oversized artifacts that the prompt excludes
from the diff. Those files are intentionally outside the coverage gate; adding
them back creates stale pointers and noisy review stops.
If the prompt provides `storyScope.includedFiles`, the coverage ledger covers
only those selected files. Files in `storyScope.excludedFiles` are intentionally
outside this story; do not create steps for them just to satisfy full-diff
coverage.

### Range and viewport audit

- For code steps, read the post-change file with line numbers before choosing
  `range`, optional top-level `ranges`, `viewport`, and `highlights`.
- Every `changed` and `new-file` `range` anchor must overlap real changed code.
  When `ranges` is present, every entry must be a full claimed changed span,
  and `range` must be contained in one entry. When absent, only `range` counts
  as the claim.
- `context` ranges must be unchanged and must not be used to satisfy coverage;
  context steps must not contain top-level `ranges`.
- Every local `range` anchor must stay inside its step's `viewport`; every
  changed or new-file step must have at least one beat highlight overlapping
  that anchor.
- Other top-level `ranges` entries may sit outside `viewport`. Do not widen
  `range` or `viewport` into their bounding box, and do not move highlights
  between them. One representative local camera is the point.
- Do not use whole-file or giant `range` anchors just to pass the coverage gate.
- `viewport` should include enough surrounding code that a reviewer who just
  read the requirement understands where the highlighted lines live.
- `highlights` must stay inside `viewport`.
- `viewport` and `highlights` should stay focused on one nearby section. Split
  unrelated or substantive islands into separate steps. Only one repeated
  mechanical pattern may claim distant spans through top-level `ranges`.
- Non-deletion viewports stay within the mode cap, except a larger local `range`
  may use its own length plus at most 12 context lines. Individual beat highlight
  ranges must be at most 12 lines. Top-level `highlights` must match the union
  of beat highlights.
- Use `newPath` for renamed files.

### Truth audit

- Every claim in `title`, `summary`, and `why` must be supported by the diff or by source lines you read.
- Do not infer intent from branch names, filenames, or vibes.
- Do not invent runtime behavior, product semantics, test results, or safety claims.
- Do not claim tests pass unless you ran them.
- Do not claim a test covers behavior unless the assertion is visible in the story viewport or in code you read.
- If you are uncertain, narrow the claim to what the code shows.
- The `intent` block must only claim a why its `sources` actually support.

### Narrative audit

Falsifiable checks — run each one, do not skim:

- Order test: reorder your steps by filename in your head. If the story reads
  the same, the path is not a story yet.
- Why test: strike any code beat that only restates what the code does. Strike
  any primer that repeats the Overview or could be replaced by one orienting
  code beat.
- Question flip test: every substantive code step has a `question`; a tagged
  skim/sweep/mechanical step may omit it. For every question that is present,
  name the specific bug that would flip its answer. If you cannot state that bug
  in one concrete sentence, replace it or omit it only on an exempt sweep.
- Beat prose test: strike any beat that opens with a line number, any beat whose
  text joins separate line numbers with a semicolon or "and also" (split it),
  and any beat that stops at what the code is without saying what it now
  guarantees, prevents, or unlocks.
- Hotspot test: for each hotspot, check the reason names something you
  specifically did not verify, not generic complexity. For each non-goal,
  check the intent evidence shows the omission was deliberate.
- Thread test: read concept bodies and code beats in order with no code. They
  must form one continuous story with no unexplained term or jump. Where the
  diff genuinely carries independent concerns, every switch between them must be
  announced — an unannounced jump fails this test even when both halves are good.
- Concept-gap test: before each code stop, verify the reviewer already has the
  terminology, roles, relationships, and state model needed to read it. Add a
  primer only for a real gap.
- Primer placement test: every primer sits immediately before its first
  dependent code step, `preparesFor` includes that next step, no two primers are
  adjacent, no primer is final, and the active mode's primer budget is respected.

### Context and camera audit

- Memory test: read only `intent`, `summary`, concept bodies, titles, and beats. A reviewer who
  remembers the request but not the app must be able to answer where the
  behavior enters, explain unfamiliar concepts before dependent code, identify
  who owns it, what changed, where the result goes, and what proves or threatens it.
- Camera test: follow only the files, viewports, and highlight groups. Every
  glow must visibly prove its beat without scrolling or guessing.
- First-stop test: the first code stop is the behavioral entry point, never
  incidental imports, icons, styling, generated output, or tests. If a primer
  opens the story, it must directly prepare that entry step.

### Reviewability audit

- The `intent` block carries why we wanted the change and the designed flow;
  the summary is the reading map: how to walk the implementation and the one
  or two places where the reviewer should slow down.
- The Overview stays whole-change orientation. Each primer teaches only the
  local mental model required by the code step immediately after it.
- The first code step should start at the most useful entry point; a primer may
  precede it only to prepare that exact step.
- Every code-step title should name behavior, risk, contract, or invariant, not
  a file operation. Every primer title should name the mental model it teaches.
- Every code beat should connect previous context, local change, and next
  implication; every code-step `why` should stay compact.
- Tests, docs, snapshots, and generated files go after the behavior they verify or explain.
- Generated or oversized files excluded by the prompt must not appear as story
  steps.
- Low-risk mechanical changes still need complete coverage. Put them late, mark
  them as skim-worthy, and use top-level `ranges` only when one pattern repeats
  across changed spans in the same file.

## Schema

```jsonc
{
  "version": 2,
  "mode": "guided",
  "title": "<short title for the whole change>",
  "summary": "<1-3 short sentences: how the steps walk the implementation + where to slow down; the goal and designed flow live in intent, not here>",
  "intent": {
    "goal": "We wanted keepers to settle funding without one market's spike draining balances.",
    "design": "settleFunding() clamps through one shared _capRate() helper that reads each market's cap.",
    "sources": ["commit 41af8b7", "PR #12 body"],
    "nonGoals": ["Deliberately does not change settlement ordering; only the rate input is clamped."]
  },
  "hotspots": [
    { "step": "s2", "reason": "I matched the inclusive boundary to the docs but never exercised the exact-cap case." }
  ],
  "storyScope": {
    "includedFiles": ["contracts/Funding.sol", "contracts/lib/RateMath.sol"],
    "excludedFiles": ["test/Funding.t.sol"],
    "reviewerNote": "Pay extra attention to the cap guard."
  },
  "base": "main",
  "head": "feature-branch",
  "steps": [
    {
      "id": "s1",
      "order": 1,
      "title": "Entry point: settleFunding() clamps before settlement",
      "question": "Can an over-cap rate reach balance mutation before it is clamped?",
      "file": "contracts/Funding.sol",
      "range": [128, 132],
      "viewport": [120, 145],
      "highlights": [[120, 126], [128, 136]],
      "kind": "changed",
      "why": "Start here: the keeper reaches this path each epoch. I clamp the rate before settlement hands off to the math helper because the old path let over-cap values travel too far. Check that this happens before any balance mutation.",
      "beats": [
        {
          "text": "Start here: the keeper reaches this path each epoch.",
          "highlights": [[120, 126]]
        },
        {
          "text": "I clamp the rate before settlement hands off to the math helper, so over-cap values stop before balance mutation.",
          "highlights": [[128, 132]]
        },
        {
          "text": "The existing settlement call below still receives one chosen rate; check that the balance mutation stays after the clamp.",
          "highlights": [[133, 136]]
        }
      ],
      "calls": ["s2"],
      "tags": ["entrypoint", "core"]
    },
    {
      "id": "concept-cap-model",
      "order": 2,
      "title": "How the per-market cap travels",
      "kind": "concept",
      "body": "One settlement carries a proposed funding rate into a market-specific boundary. The keeper triggers `settleFunding()`, the entry point chooses the market, and `_capRate()` applies that market's configured ceiling before balances move. The cap is therefore not a global throttle or a post-settlement correction: it is an input constraint owned by each market. Keep that ownership in mind while reading the helper next. The key review question is whether every caller supplies the matching market configuration and whether the inclusive edge behaves consistently.",
      "preparesFor": ["s2"],
      "diagram": {
        "type": "mermaid",
        "source": "sequenceDiagram\n  actor Keeper\n  participant Funding\n  participant MarketConfig\n  participant Balances\n  Keeper->>Funding: settle\n  Funding->>MarketConfig: read cap\n  Funding->>Funding: clamp rate\n  Funding->>Balances: mutate with chosen rate",
        "caption": "The keeper's proposed rate crosses the per-market cap before balance mutation."
      },
      "tags": ["mental-model"]
    },
    {
      "id": "s2",
      "order": 3,
      "title": "Helper: _capRate() owns the boundary rule",
      "question": "Does the shared helper enforce the intended inclusive cap before unchecked math?",
      "file": "contracts/lib/RateMath.sol",
      "range": [40, 58],
      "viewport": [40, 58],
      "highlights": [[40, 44], [48, 52]],
      "kind": "new-file",
      "why": "Pause here: settleFunding() lands here after choosing the market cap. I keep the helper small so both callers use the same inclusive boundary; the review focus is the require that makes the unchecked math safe.",
      "beats": [
        {
          "text": "Pause here: settleFunding() lands here after choosing the market cap.",
          "highlights": [[40, 44]]
        },
        {
          "text": "The require is the review hinge because it makes the later unchecked math safe.",
          "highlights": [[48, 52]]
        }
      ],
      "calls": ["s3"],
      "returnsTo": "s1"
    },
    {
      "id": "s3",
      "order": 4,
      "title": "Existing marketConfig contract supplies the per-market cap",
      "question": "Does the helper receive the cap from the matching market configuration?",
      "file": "contracts/storage/MarketConfig.sol",
      "range": [88, 94],
      "viewport": [88, 94],
      "highlights": [[88, 94]],
      "kind": "context",
      "why": "Unchanged context: this is the storage contract _capRate() depends on.",
      "beats": [
        {
          "text": "Unchanged, but essential: _capRate() receives the cap from this per-market config field.",
          "highlights": [[88, 94]]
        }
      ],
      "returnsTo": "s2"
    }
  ]
}
```

Use `"mode": "brief"` for the shortest useful story, and `"mode": "detailed"`
for the longer line-by-line correctness story.

Omit `head` when the story is for working tree vs base instead of a fixed
`base..head` range.

## Save and verify

Write `.diffstory/story.json`, then verify it against the diff yourself:

- Every changed hunk is covered by a `changed` / `new-file` step. The in-app
  trust check uses top-level `ranges` when present and otherwise `range`, so
  leave no full changed span uncovered.
- Every changed/new-file `range` anchor overlaps real changed code and stays in
  its viewport. If `ranges` is present, it is the complete claim list, every
  entry covers a real changed span, and one entry contains `range`; the other
  entries may sit outside the viewport and must not expand the local camera.
  Every context step deliberately points at unchanged code that changes how the
  diff is judged and must not contain `ranges`.
- Every concept primer is just in time, stays within its mode budget, has a
  60-180 word body (never over 220), claims no coverage, and has no `ranges`.
- `hotspots` (at most 3) reference real code-step ids and name specific
  unverified doubts; `intent.nonGoals` entries are evidence-backed deliberate
  omissions, not gaps you ran out of time for.
- The JSON is valid: ids, `order`, `calls`, `returnsTo`, `preparesFor`, and
  `hotspots[].step` all resolve; no primer is adjacent to another primer or final.
- Schema spot-check, especially on long stories. Long stories are where authors
  drift into an abbreviated shape, and the app rejects the whole story over it.
  Confirm, in order:
  - top level has `title` and `summary` (both are easy to forget once the step
    list gets long, and the story is invalid without them);
  - every step has `id`, `order` (a number — never omit it), `title`, `kind`;
  - every code step has `file`, `range`, `viewport`, `highlights`, `why`, and
    `beats`; every substantive code step also has `question`, while only a step
    tagged `skim`, `sweep`, or `mechanical` may omit it;
  - when a step has top-level `ranges`, it is a changed/new-file mechanical
    sweep, lists every full claimed span, and contains its local `range` anchor;
  - every beat has `text` (never `body` — that field belongs to concept
    primers) and a non-empty `highlights` array.
  These five fields — top-level `title`, top-level `summary`, step `order`, beat
  `text`, beat `highlights` — are the ones real stories lose first. Check them
  explicitly rather than assuming.

Fix every issue before handing back. If a clean story is impossible, report the
blocker instead of pretending it is ready.

Tell the user: "Story ready — open the diff in the diffStory app to review."

## Don't

- Don't organize the story as a mechanical file-by-file walk. Late tagged sweep
  coverage is still required, but one repeated pattern may use a compact
  top-level `ranges` claim rather than a long tail of identical stops.
- Don't organize by filename, package, or hunk order unless that is genuinely the clearest review path.
- Don't restate the diff with bland verbs like "adds", "updates", "modifies", or "changes" unless the sentence also names the consequence or review risk.
- Don't write checklist-only copy. Work the review focus into the story.
- Don't add context steps as scenery.
- Don't add primers as an up-front glossary, repeat the Overview, place primers
  back-to-back, or leave a primer at the end.
- Don't assume the changed lines explain where the behavior enters or what
  consumes it; show that task-local context with the camera.
- Don't bury the core behavior behind docs, tests, generated files, or cleanup.
- Don't make one story camera bounce between distant lines. Keep `range`,
  `viewport`, highlights, and beats in one local review moment; only top-level
  `ranges` may claim distant repeated mechanical spans without moving it.
- Don't make unsupported confidence claims like "this is safe" or "tests cover it" without naming the exact condition or evidence.
- Don't skip the coverage gate — every changed hunk needs a full effective
  claim through `ranges` when present or `range` otherwise.
- Don't use top-level `ranges` to merge unrelated cleanup, separate substantive
  decisions, different patterns, or different files. It is not a broad license
  to shorten or merge stories.
- Don't turn `range` into the bounding box of `ranges`, widen the viewport to
  show every claim, or scatter highlights across claimed spans. Keep one local
  representative camera and beat.
- Don't confuse top-level coverage `ranges` with legacy pointer
  `focus.ranges`.
- Don't give concept primers file/range/ranges/camera/beat/why/call fields or
  count them toward coverage; avoid `ranges` on context steps too.
- Don't invent intent. Every `goal` claim needs a source; `["code-derived"]` is the honest fallback.
- Don't ship steps in file order without stating why that order genuinely reads best.
- Don't keep a rhetorical question whose answer is a trivial "yes"; a question
  that cannot be answered wrong is not review guidance.
- Don't open a beat with "Line 742 …" — the glow already points there; spend the
  words on why it matters.
- Don't pack several decisions into one beat with semicolons; that is two or
  three beats, or two or three steps.
- Don't pick decorative hotspots ("this is complex") or skip hotspots out of
  false confidence — name the specific thing you did not verify.
- Don't list a non-goal you cannot back with intent evidence; an accidental gap
  belongs in a hotspot reason, not in `nonGoals`.
