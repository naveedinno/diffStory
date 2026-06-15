---
name: address-review
description: Use when the user has finished reviewing your change in diffStory and left comments — they'll say something like "address the review", "I left comments", or "go through my diffStory comments". Reads .diffstory/comments.json, fixes change-requests, answers questions, marks each one handled, and refreshes the tour so the next review pass shows what you did.
---

# Addressing review comments

The reviewer left comments on your change in diffStory. They live in `.diffstory/comments.json`,
each anchored to a file + line + tour step. Close the loop: act on every open comment, write
back what you did, and leave the file in a state the reviewer can re-review.

## Steps

1. **Read** `.diffstory/comments.json`. Each comment has `id`, `step`, `file`, `line`, `type`
   (`change` | `question` | `nit`), `body`, and `status`. Work through every comment whose
   `status` is `open`.

2. **Act by type:**
   - **`change`** — make the requested edit. If you genuinely disagree, *don't silently skip
     it*: make your case in `reply` and leave `status` as `open` so the reviewer decides.
   - **`question`** — answer it directly and concretely in `reply`. Read the code at
     `file`:`line` (the comment's tour step gives you context) before answering.
   - **`nit`** — apply it if it's quick and reasonable; otherwise explain the trade-off in `reply`.

3. **Write back** to each comment you handled:
   - set `status` to `"addressed"`,
   - add a `reply` string: what you changed (name the function/file) or your answer. Be specific
     — this is what the reviewer sees on their next pass.
   Preserve every other field. **Never delete a comment** — resolving is the reviewer's call.
   Write the full array back to `.diffstory/comments.json` (valid JSON).

4. **Refresh the tour.** If your edits moved code or added/removed logic, re-run the
   **review-tour** skill so `.diffstory/story.json` reflects the new state (line ranges will
   have shifted). At minimum, run `diffstory check` and make sure every change is still covered.

5. **Hand back.** Tell the user: *"Addressed N comments — refresh `diffstory serve` to see the
   replies and re-review."* Summarize briefly what changed and flag anything you pushed back on.

## Example

Before:
```json
{ "id": "c_abc", "step": "s2", "file": "contracts/lib/RateMath.sol", "line": 44,
  "type": "change", "body": "This require should be <= not < — the boundary is valid.",
  "status": "open", "createdAt": "2026-06-14T13:10:57.533Z" }
```

After you fix the code:
```json
{ "id": "c_abc", "step": "s2", "file": "contracts/lib/RateMath.sol", "line": 44,
  "type": "change", "body": "This require should be <= not < — the boundary is valid.",
  "status": "addressed", "createdAt": "2026-06-14T13:10:57.533Z",
  "reply": "Fixed — changed `cap < MAX` to `cap <= MAX` in _capRate(). Added a boundary test in RateMath.t.sol." }
```

## Don't

- Don't mark a comment `addressed` without actually doing the work or answering the question.
- Don't delete or rewrite the reviewer's `body`.
- Don't forget to refresh the tour / run `diffstory check` after edits — stale line numbers make re-review confusing.
