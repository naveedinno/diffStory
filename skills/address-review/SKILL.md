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

2. **Ground yourself in *both* sides of the change first.** This review is a diff between a
   target side and a current side — a comment can be about something the change *added*,
   *removed*, or *moved*. The address prompt names the refs: always a target ref, and either a
   current ref (two-ref comparison) or the working tree. Before you act on a comment, look at both
   sides of its file: read the current side (`git show <current>:<file>`, or the working-tree
   version when there's no current ref) and the target side (`git show <target>:<file>`). Run the
   `git diff` the prompt gives you to see exactly what changed at that line. **Never decide a
   symbol, field, or branch "doesn't exist" or "isn't here yet" from one side alone** — check the
   other side and the diff. Don't invent branch names or commit hashes to explain a gap; if the
   two sides don't settle it, say what they show.

3. **Act by type:**
   - **`change`** — make the requested edit. If you genuinely disagree, *don't silently skip
     it*: make your case in `reply` and leave `status` as `open` so the reviewer decides.
   - **`question`** — answer it directly and concretely in `reply`. Read *both sides* of the code
     at `file`:`line` (working tree + target ref) before answering — the answer often lives in
     what the diff did, not in either side by itself.
   - **`nit`** — apply it if it's quick and reasonable; otherwise explain the trade-off in `reply`.

4. **Write back** to each comment you handled:
   - set `status` to `"addressed"`,
   - add a `reply` string: what you changed (name the function/file) or your answer. Be specific
     — this is what the reviewer sees on their next pass.
   Preserve every other field. **Never delete a comment** — resolving is the reviewer's call.
   Write the full array back to `.diffstory/comments.json` (valid JSON).

5. **Refresh the tour.** If your edits moved code or added/removed logic, re-run the
   **review-tour** skill so `.diffstory/story.json` reflects the new state (line ranges will
   have shifted). At minimum, run `diffstory check` and make sure every change is still covered.

6. **Hand back.** Tell the user: *"Addressed N comments — refresh `diffstory serve` to see the
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
- Don't answer from one side of the diff. Reading only the working tree is how you end up telling
  the reviewer a field "doesn't exist" while their screen shows it added two lines down.
- Don't invent branches or commit hashes to explain a gap — verify against `git diff <target>`.
- Don't delete or rewrite the reviewer's `body`.
- Don't forget to refresh the tour / run `diffstory check` after edits — stale line numbers make re-review confusing.
