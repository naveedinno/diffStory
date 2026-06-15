# diffStory — story workflow: `init`, reviewable-in-git, and agent-driven `story`

**Date:** 2026-06-15
**Status:** design — not yet implemented

## Problem

Today the loop has friction at both ends:

1. **Starting** a review means manually switching to your agent's chat and typing the right
   command, then running `diffstory serve` — two tools, easy to forget the order.
2. **Sharing** a review isn't possible: the reading plan lives only on the author's disk, so a
   PR reviewer can't replay the guided walkthrough. diffStory is stuck as a personal tool.

This design closes both: one command generates the story end-to-end, and the story can travel
with a PR so anyone can replay it.

## The verb: "story"

The reading plan is renamed from "tour" to **"story"** (diffStory *tells the story* of a change):

- File: `.diffstory/review-tour.json` → **`.diffstory/story.json`**.
- New command: **`diffstory story`** (generate via the agent).
- User-facing strings (CLI, page, docs) say "story".
- The producer skill keeps its trigger name (`review-tour` / `$review-tour` / `/diffstory:review-tour`)
  but writes `story.json`. Internal TypeScript identifiers (`TourStep`, `loadTour`, …) may stay as
  "tour" — implementation detail, not user-facing; renaming them is optional cleanup, not required.
- **Backward compatibility:** the loader prefers `story.json` and falls back to `review-tour.json`
  if only the old name exists, so existing repos and the demo keep working.

## Three features

### A. `diffstory init` — set a repo up (one time)

Enhances the existing `init`:

- Ensures `.diffstory/` exists (keeps scaffolding a starter `story.json` template).
- **Asks how to track it** (interactive prompt; `--commit` / `--local` for non-interactive/CI):
  - **Shared** — make sure `.diffstory/` is *not* ignored, but git-ignore `comments.json`. Result:
    `story.json` is committed (travels with the PR); your in-progress comments stay local.
  - **Local** — add `.diffstory/` to the repo's `.gitignore`.
  - Writes/updates the repo `.gitignore` accordingly (idempotent; never duplicates lines).
- **Checks the agent skills are installed** globally (`~/.agents/skills/review-tour` or the Claude
  Code plugin). If missing, prints the one-line installer pointer. (Skills stay global — `init`
  does **not** copy skills into the repo. A reviewer only needs the CLI to *view*.)

### B. Reviewable in git (the payoff)

- The generated story records the **base** it was built against (the existing optional `base`
  field in the story JSON — now always written by the generator). So a reviewer's `diffstory serve`
  diffs against the right ref automatically, with no flags.
- **Reviewer replay flow:** `git fetch && git checkout <pr-branch>` → `diffstory serve` → the
  author's exact guided walkthrough of the PR. The reviewer needs only the CLI installed — no
  skills, no agent (they're viewing, not generating). They can still comment locally.
- Mostly enabled by A (commit choice) + the generator always writing `base`. Small code; the bulk
  is the `init` git handling and docs.

### C. `diffstory story` — the CLI generates it for you

New command that drives the user's agent headlessly:

1. **Resolve base** (auto, or `--base` / `--head` like `serve`).
2. **Pick the agent:** `--agent claude|codex`; else a remembered default in `~/.diffstory/config.json`;
   else auto-detect (`claude`/`codex` on `PATH`). If both are present and no preference is set,
   prompt once and remember the choice.
3. **Run it headless** in the repo with a prompt that triggers the producer skill and writes
   `story.json` for the resolved base. Per agent (exact flags verified during implementation):
   - Claude Code: `claude -p "<prompt>" --permission-mode acceptEdits`
   - Codex: `codex exec --full-auto "<prompt>"`
   Child stdout/stderr stream through so the user sees progress.
4. **Auto-serve:** on success (story.json now exists), run `serve` so the browser opens. `--no-serve`
   stops after generating.
5. **Fallbacks:**
   - No agent CLI found → print the manual command for the user's chat (today's "no story yet" guide).
   - Agent ran but no `story.json` was produced → show the agent's output and the manual fallback.

**Security note:** generation runs the agent with auto-approve for file writes (`acceptEdits` /
`--full-auto`), scoped to a single user-initiated command in the current repo. This is called out
in `--help` and in the command's own output so it's never a surprise.

## CLI surface (after this work)

```
diffstory story [--agent claude|codex] [--base <ref>] [--head <ref>] [--no-serve] [--dir <path>]
diffstory serve   [--base <ref>] [--head <ref>] [--port <n>] [--no-open] [--dir <path>]   (interactive diff picker stays)
diffstory init    [--commit | --local] [--dir <path>]
diffstory check   [--base <ref>] [--head <ref>] [--dir <path>]
diffstory help
```

## Files

```
.diffstory/
  story.json       # the reading plan — committed in "shared" mode (records its base)
  comments.json    # your local review notes — git-ignored by default
~/.diffstory/
  config.json      # optional: remembered default agent for `diffstory story`
```

## Build order

1. **Rename** tour → story (file `story.json` + backward-compat loader + user-facing strings +
   skill output). Smallest, unblocks the rest.
2. **`init`** git-handling + skills check (Feature A) → enables Feature B (record `base` in the
   generator/skill + reviewer-replay docs).
3. **`diffstory story`** (Feature C) — agent detection, headless invocation, auto-serve, fallbacks.

Each is independently shippable and testable.

## Out of scope (for now)

- Comparing two separate repo directories (`git diff --no-index` style). Tracked separately if needed.
- Committing reviewer comments back through git (comments stay local).
- Agents other than Claude Code and Codex (the fallback prints a manual command for those).

## Risks

- **Agent CLI drift** — `claude`/`codex` flags can change. Mitigation: detect+verify at call time,
  and always fall back to the printed manual command on any failure.
- **Permissions** — headless agents need a write-allow flag; we use the least-broad option that
  works and surface it in help/output.
- **Rename breakage** — mitigated by the `story.json` → `review-tour.json` fallback loader.

## Testing

- Unit: gitignore editing in `init` (idempotent; shared vs local), filename resolution
  (story.json preferred, review-tour.json fallback), base recorded in generated story.
- Integration (demo repo): `init --local` ignores the dir; `init --commit` leaves story tracked;
  reviewer replay (checkout + serve) renders against the recorded base.
- `story` command: agent-detection logic and the no-agent/empty-output fallbacks (mock the agent
  call so tests don't shell out to a real CLI).
