# diffStory

**The agent tells the story of its change — a guided, in-order diff review with a comment loop back to the agent.**

Reviewing a big change an AI wrote is miserable: 30 files sorted alphabetically, no idea where
to start, no thread connecting them. diffStory fixes the *order*. The AI that wrote the code also
emits the **reading order** — the path it would walk you through in person: start at the entry
point, follow the call into the next file, come back. You read the change the way it was meant to
be understood, leave comments right on the lines, and hand them straight back to the agent to fix.

> It's the agent telling you the *story* of what it changed, in the order the story actually happens.

## The loop

```
agent   /review-tour    ─▶  .diffstory/review-tour.json  (reading plan: order + why, no code)
        diffstory serve  ─▶  localhost review page  ◀── you read it in order
        you comment      ─▶  .diffstory/comments.json    (saved to disk as you go)
agent   /address-review  ─▶  fix code · answer questions · status:addressed
                   └──────────  refresh diffstory serve  ◀──────────┘   until clean
```

You always review the **real `git diff`** — diffStory only *reorders and annotates* it. The AI
emits order and narrative; the code shown is pulled from git, never reproduced by the AI.

## See it in 10 seconds

```bash
npm install && npm run demo
```

Builds a throwaway repo with a realistic multi-file change (a per-customer spending limit) and
opens the review page. Things to try:

- **Story tour** — walk the five steps in call-flow order (`←` / `→`, or `j` / `k`); each leads
  with the AI's *"why this step"* note, then a side-by-side before/after diff. Toggle **Diff ⇄
  Full file** to see the whole file with the change highlighted.
- **All files** — the scannable overview: every file as a collapsible card with a `+/−` diffstat
  and a *Step N* jump chip; **Expand / Collapse all**.
- **Trust check** — one change is **deliberately left out of the tour**; watch the amber
  *unexplained change* flag fire and open the drawer that surfaces it.
- **Comments** — hover any line for a `+`, leave a change-request / question / nit, resolve it.

Source: [`examples/demo.mjs`](examples/demo.mjs).

## Install (from source)

To hack on diffStory itself:

```bash
npm install      # dev dep: typescript only — zero runtime dependencies
npm run build
npm link         # puts `diffstory` on your PATH (or run: node dist/cli.js)
npm test         # type-check + unit + smoke tests
```

Install the two skills so your local Claude Code agent can drive the loop:

```bash
cp -r skills/review-tour skills/address-review ~/.claude/skills/
```

→ To roll diffStory out to teammates **without** cloning the repo, see
[Roll it out to your team](#roll-it-out-to-your-team).

## Use

In the repo you're reviewing, after your agent has made changes:

```bash
# 1. agent writes the tour
#    (in Claude Code)  /review-tour

# 2. you review
diffstory serve             # builds the page from the real diff + the tour, opens your browser

# 3. agent addresses your comments
#    (in Claude Code)  /address-review

# 4. refresh the browser to see replies + fixes, repeat until clean
```

## Roll it out to your team

diffStory ships in **two halves** — both need to reach each teammate:

- **The CLI** (`diffstory`) — serves the review page and runs the trust check.
- **The agent skills** (`review-tour`, `address-review`) — let Claude Code author the tour and
  act on your comments. Shipped as a **Claude Code plugin**.

### 1. Install the CLI

Works against a private GitHub repo too — it uses each teammate's existing git credentials:

```bash
npm i -g github:naveedinno/diffstory        # puts `diffstory` on PATH
# or zero-install per run:  npx github:naveedinno/diffstory serve
```

> Once published to npm: `npm i -g @naveedinno/diffstory` (or `npx @naveedinno/diffstory`).

### 2. Install the skills (Claude Code plugin)

This repo is also a Claude Code **plugin marketplace**. In Claude Code, each teammate runs:

```
/plugin marketplace add naveedinno/diffstory      # this repo
/plugin install diffstory@diffstory
```

The skills then work in every repo as `/diffstory:review-tour` and `/diffstory:address-review`
(Claude also auto-invokes them by description). Pick up new versions later with
`/plugin marketplace update diffstory`.

### Codex & other agents (not just Claude Code)

diffStory isn't Claude-only. The **CLI is agent-agnostic**, and the two skills use the standard
`SKILL.md` format that **Codex** (and other agents) also read — they're already neutral (the
instructions reference the `diffstory` CLI, never a Claude-specific command).

- **CLI** — install exactly as above: `npm i -g github:naveedinno/diffStory`.
- **Skills** — Codex reads skills from `.agents/skills/`. From a clone of this repo, run the
  installer:
  ```bash
  git clone git@github.com:naveedinno/diffStory.git && cd diffStory
  ./scripts/install-skills.sh            # → ~/.agents/skills (Codex, Cursor, …)
  #   --claude  also installs into ~/.claude/skills · --dir PATH  picks a custom location
  ```
  Codex then invokes them as `$review-tour` / `$address-review`, or automatically when a request
  matches their description. (Per-repo instead of global: `--dir <that-repo>/.agents/skills`.)

Same loop either way: the agent writes `.diffstory/review-tour.json`, you run `diffstory serve`
and comment, and the agent acts on `.diffstory/comments.json`.

### 3. Use it anywhere

The loop above now works in **any** repo on that machine. `.diffstory/` holds local review
state — add it to each repo's `.gitignore`. Gate CI with `diffstory check`, which exits non-zero
if any change isn't covered by a tour step.

## Commands

| Command | What it does |
|---|---|
| `diffstory serve` | Build the review page from the diff + tour and serve it (default command). |
| `diffstory check` | Print coverage to the terminal; **exits 1 if any change isn't in the tour**. Good for CI / pre-handoff. |
| `diffstory init` | Scaffold `.diffstory/` with a starter tour. |
| `diffstory help` | Full usage. |

Options: `--dir <path>` (repo to review), `--base <ref>` (diff base; default auto = merge-base
with the default branch), `--port <n>`, `--no-open`.

## The review screen

A deep-dark, IDE-native screen built for staring at for an hour:

- **Reading-order rail** (left) — the AI-authored tour as a connected trail of numbered steps;
  the active one lights azure, visited ones check off, and each shows its file, change kind
  (Changed / New file / Context), and call-flow (*"Calls step 2 · returns to 1"*).
- **Story tour** (main) — leads with the *why* note, then a side-by-side before/after diff. New
  files show a hatched "did not exist" column; context steps render single-column "unchanged".
  Toggle to the complete file at any time.
- **All files** — a dense overview that scales to 100+ changes: collapsible per-file cards with
  compact unified diffs, untoured flags, and jump-into-the-tour chips.
- **Comments** — threaded, with a flavor (change / question / nit) and a status (open →
  addressed → resolved). The agent's replies show inline; you resolve when satisfied.

## The trust check

diffStory cross-checks the tour against the real diff. **Any changed hunk no step points at is
flagged** — on the page (the amber *unexplained change* pill opens a drawer that tallies covered
vs. unexplained lines and surfaces each one), and in `diffstory check` (which exits non-zero).
The agent can't quietly leave a change out of the narrative.

## The tour format

`.diffstory/review-tour.json` — written by the agent, order + narrative only. See
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
front of you. The review page is a single self-contained HTML document: all code is escaped
server-side and the client only ever sets text or injects that server-escaped markup.

## License

MIT
