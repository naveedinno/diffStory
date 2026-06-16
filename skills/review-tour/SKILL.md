---
name: review-tour
description: Use right after you (the agent) have made code changes the user needs to review, especially a large multi-file change. Produces .diffstory/story.json — a guided, in-order reading path through your own diff — so the reviewer reads the change the way it was meant to be understood instead of alphabetically by filename. Run before handing work back for review.
---

# Writing a review tour

You just changed code. The reviewer now has to understand it. A raw diff sorts files
alphabetically — the worst order for understanding. Your job: write the **reading order**
you'd give a colleague looking over your shoulder, and save it as a tour diffStory can render.

You have something no diff tool has: you know *why* the code is shaped this way and what
calls what. Capture that.

## Steps

1. **Get the change set.** Run `git diff $(git merge-base HEAD <default-branch>)` (usually
   `main` or `master`) to see everything this branch changed, committed or not. If you're not
   on a branch, use `git diff HEAD`.

2. **Decide the reading order — follow the logic, not the filenames:**
   - Start at the **entry point** — the function/endpoint/handler a reader hits first.
   - Follow each **call into the code it depends on**, even across files, then come back.
   - Put **definitions before uses**, **core logic before glue**, **tests last**.
   - Group changes that only make sense together into adjacent steps. Do not produce one
     step per file or one step per hunk unless the change truly reads that way.

3. **Write one step per stop.** Each step:
   - `file` + `range`: the lines to show, in the **post-change** file (1-based, inclusive).
   - `kind`: `changed` (the diff touched it), `new-file` (brand new), or `context`
     (unchanged code shown only so the change makes sense — e.g. the signature of a callee
     you didn't modify but the reader needs to see).
   - `why`: the most important field. **Review-oriented**, not narration. Say what to verify,
     what's subtle, why an approach is safe, what you were unsure about. Not "adds a cap" —
     instead "clamps the rate here; the unchecked block is safe because cap ≤ uint128 max."
   - `title`: name the behavior or risk being reviewed, not just the file. Good titles sound
     like "Entry point: reject over-cap orders before placement" or "Reserve accounting now
     follows each pending settlement." Weak titles sound like "Update OrderService" or
     "Tests for changes."
   - `calls`: ids of steps this one leads into (renders the A→B jump). `returnsTo`: the step
     to come back to.

4. **Cover every change.** Every changed hunk MUST be pointed at by at least one `changed` or
   `new-file` step. This is enforced — run `diffstory check` and fix anything it lists under
   "not in the tour" until it passes. Don't quietly leave a change out of the narrative.

5. **Write** the result to `.diffstory/story.json`, then run `diffstory check` one last time.
   Tell the user: *"Tour ready — run `diffstory serve` to review."*

## Schema

```jsonc
{
  "version": 1,
  "title": "<short title for the whole change>",
  "summary": "<one paragraph: what changed + the reading strategy>",
  "base": "main",                      // the ref you diffed against — SET THIS so a PR reviewer replays the same base
  "steps": [
    {
      "id": "s1",                      // unique; referenced by calls/returnsTo and comments
      "order": 1,                      // 1-based reading position
      "title": "Entry point: settleFunding() now clamps the rate",
      "file": "contracts/Funding.sol",
      "range": [120, 145],             // [startLine, endLine] in the POST-change file
      "kind": "changed",               // changed | context | new-file
      "why": "Start here — the keeper calls this. The new clamp on 132 is the core behavior.",
      "calls": ["s2"],                 // optional
      "tags": ["entrypoint", "core"]   // optional
    },
    {
      "id": "s2",
      "order": 2,
      "title": "The helper it delegates to: _capRate()",
      "file": "contracts/lib/RateMath.sol",
      "range": [40, 58],
      "kind": "new-file",
      "why": "settleFunding() hands off here. The unchecked block is safe because cap ≤ uint128 max — see the require on 44.",
      "returnsTo": "s1"
    }
  ]
}
```

## Don't

- Don't reproduce code in the tour — diffStory pulls the real diff from git. You only supply order + narrative.
- Don't write a step per file mechanically — write the *path a human should walk*.
- Don't restate the diff with bland verbs like "adds", "updates", "modifies", or "changes"
  unless the sentence also says what the reviewer should verify.
- Don't bury the core behavior behind docs, tests, generated files, or cleanup. Show those after
  the implementation they support.
- Don't skip the `diffstory check` gate.
