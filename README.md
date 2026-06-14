# cairn

**Guided, in-order review of AI-authored diffs — with a comment loop back to the agent.**

Reviewing a big change an AI wrote is miserable: 30 files sorted alphabetically, no idea where
to start, no thread connecting them. Cairn fixes the *order*. The AI that wrote the code also
lays down a **trail** — the reading path it would walk you through in person: start at the
entry point, follow the call into the other file, come back. You read the change the way it was
meant to be understood, leave comments right on the lines, and hand them straight back to the
agent to fix.

> A *cairn* is a stack of stones hikers use to mark the safe route through wilderness. Same idea.

## The loop

```
agent   /review-tour   ─▶  .cairn/review-tour.json   (reading plan: order + why, no code)
        cairn serve     ─▶  localhost review page  ◀── you read it in order
        you comment     ─▶  .cairn/comments.json     (saved to disk as you go)
agent   /address-review ─▶  fix code · answer questions · status:addressed
                   └──────────  refresh cairn serve  ◀──────────┘   until clean
```

You always review the **real `git diff`** — Cairn only *reorders and annotates* it. The AI
emits order and narrative; the code shown is pulled from git, never reproduced by the AI.

## Install

```bash
npm install      # dev dep: typescript only — zero runtime dependencies
npm run build
npm link         # puts `cairn` on your PATH (or run: node dist/cli.js)
```

Install the two skills so your Claude Code agent can drive the loop:

```bash
cp -r skills/review-tour skills/address-review ~/.claude/skills/
```

## Use

In the repo you're reviewing, after your agent has made changes:

```bash
# 1. agent writes the tour
#    (in Claude Code)  /review-tour

# 2. you review
cairn serve                 # builds the page from the real diff + the tour, opens your browser

# 3. agent addresses your comments
#    (in Claude Code)  /address-review

# 4. refresh the browser to see replies + fixes, repeat until clean
```

## Commands

| Command | What it does |
|---|---|
| `cairn serve` | Build the review page from the diff + tour and serve it (default command). |
| `cairn check` | Print coverage to the terminal; **exits 1 if any change isn't in the tour**. Good for CI / pre-handoff. |
| `cairn init` | Scaffold `.cairn/` with a starter tour. |
| `cairn help` | Full usage. |

Options: `--dir <path>` (repo to review), `--base <ref>` (diff base; default auto = merge-base
with the default branch), `--port <n>`, `--no-open`.

## The trust check

Cairn cross-checks the tour against the real diff. **Any changed hunk no step points at is
flagged** — on the page under a loud "Not in the tour" section, and in `cairn check` (which
exits non-zero). The agent can't quietly leave a change out of the narrative.

## The tour format

`.cairn/review-tour.json` — written by the agent, order + narrative only. See
[`skills/review-tour/SKILL.md`](skills/review-tour/SKILL.md) for the full schema. The short of it:

```jsonc
{
  "version": 1,
  "title": "Cap settle output",
  "summary": "Read settle() first, then the cap() helper it now calls.",
  "steps": [
    { "id": "s1", "order": 1, "title": "settle() now caps", "file": "fileA.ts",
      "range": [1, 4], "kind": "changed", "why": "Entry point; delegates to cap().", "calls": ["s2"] },
    { "id": "s2", "order": 2, "title": "the cap() helper", "file": "lib.ts",
      "range": [1, 3], "kind": "new-file", "why": "Clamps to 100.", "returnsTo": "s1" }
  ]
}
```

`kind` is `changed` (render the real hunk), `new-file`, or `context` (show *unchanged* code the
reader needs — like the callee you didn't touch). `calls`/`returnsTo` render the cross-file jumps.

## v1 scope & limitations

- **Manual round-trip.** Comments are saved to disk; you trigger `/address-review` yourself and
  refresh. No live-watch/SSE yet (planned).
- **Comment drift.** Comments anchor to a line number at comment-time. If the agent edits and
  you *don't* re-run `/review-tour`, an unresolved comment can point at a shifted line — it falls
  back to a note on its step. Resolve a batch, then re-review fresh.
- **Syntax highlighting** is diff-coloring only in v1 (kept fully self-contained, no CDN). Token
  highlighting via build-time Shiki is the planned enhancement.
- Needs a git repo; reviews the working tree against the base.

## Why TypeScript + zero deps

The whole tool is Node built-ins (`http`, `child_process`, `fs`). Nothing to install at
runtime, nothing phoning home — which matters when the entire point is *trusting* the change in
front of you.

## License

MIT
