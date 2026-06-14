---
name: review-tour
description: Use right after you (the agent) have made code changes the user needs to review, especially a large multi-file change. Produces .cairn/review-tour.json — a guided, in-order reading path through your own diff — so the reviewer reads the change the way it was meant to be understood instead of alphabetically by filename. Run before handing work back for review.
---

# Writing a review tour

You just changed code. The reviewer now has to understand it. A raw diff sorts files
alphabetically — the worst order for understanding. Your job: write the **reading order**
you'd give a colleague looking over your shoulder, and save it as a tour Cairn can render.

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
   - Group changes that only make sense together into adjacent steps.

3. **Write one step per stop.** Each step:
   - `file` + `range`: the lines to show, in the **post-change** file (1-based, inclusive).
   - `kind`: `changed` (the diff touched it), `new-file` (brand new), or `context`
     (unchanged code shown only so the change makes sense — e.g. the signature of a callee
     you didn't modify but the reader needs to see).
   - `why`: the most important field. **Review-oriented**, not narration. Say what to verify,
     what's subtle, why an approach is safe, what you were unsure about. Not "adds a cap" —
     instead "clamps the rate here; the unchecked block is safe because cap ≤ uint128 max."
   - `calls`: ids of steps this one leads into (renders the A→B jump). `returnsTo`: the step
     to come back to.

4. **Cover every change.** Every changed hunk MUST be pointed at by at least one `changed` or
   `new-file` step. This is enforced — run `cairn check` and fix anything it lists under
   "not in the tour" until it passes. Don't quietly leave a change out of the narrative.

5. **Write** the result to `.cairn/review-tour.json`, then run `cairn check` one last time.
   Tell the user: *"Tour ready — run `cairn serve` to review."*

## Schema

```jsonc
{
  "version": 1,
  "title": "<short title for the whole change>",
  "summary": "<one paragraph: what changed + the reading strategy>",
  "base": "main",                      // optional: ref to diff against; omit to auto-detect
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

- Don't reproduce code in the tour — Cairn pulls the real diff from git. You only supply order + narrative.
- Don't write a step per file mechanically — write the *path a human should walk*.
- Don't skip the `cairn check` gate.
