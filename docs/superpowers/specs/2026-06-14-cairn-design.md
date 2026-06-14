# Cairn — design

**Date:** 2026-06-14
**Status:** v1 implemented

## Problem

Reviewing a large AI-authored changeset is painful: diff tools sort files alphabetically by
path, which is close to the worst order for understanding. The reviewer bounces between many
files reconstructing execution flow in their head, with no narrative and no idea where to start.
And there's no clean way to push feedback back to the agent that wrote it.

## What we're building

A tool that turns a diff into a **guided, in-order review** with a **comment loop back to the
agent**. The AI that wrote the code — which uniquely knows intent and call flow — emits a
*reading path*; the reviewer walks it, comments on the code, and hands the comments back for
fixing. Reviewing AI code becomes: read it the way it was meant to be read, push back inline,
hand it back.

Name: **cairn** (the trail-marker stones that show the safe route through wilderness).

## Key decisions (and why)

1. **Ordering comes from the AI, not static analysis.** The code-writing agent emits the order;
   no call-graph parser to build, and it's language-agnostic for free (Solidity, TS, anything).
2. **Surface = a generated review page**, served locally. Chosen over a VS Code extension
   (editor lock-in, more to build) and a terminal TUI (cramped for big multi-file tours).
3. **Reorder the *real* git diff**, don't let the AI reproduce code. The reviewer always sees
   ground truth from git; the AI supplies only order + narrative. Critical when the thing being
   audited is that same AI's output.
4. **Server, not a static file** — promoted to core because comments must persist to disk for
   the agent to read them (browser `localStorage` can't round-trip to the agent).
5. **Manual round-trip for v1.** Comments saved to disk; the user triggers `/address-review`
   and refreshes. Live-watch/SSE is a deferred fast-follow.
6. **TypeScript, zero runtime dependencies.** Node built-ins only; nothing to install, nothing
   phoning home — aligned with the trust ethos. Highlighting is diff-coloring in v1 (build-time
   Shiki later) rather than a CDN script.

## Architecture

```
agent   /review-tour   ─▶  .cairn/review-tour.json   (reading plan: order + why, no code)
        cairn serve     ─▶  localhost review page  ◀── reviewer reads in order
        reviewer comment ─▶  .cairn/comments.json    (POST → disk)
agent   /address-review ─▶  fix code · answer Qs · status:addressed · refresh tour
                   └──────────  refresh cairn serve  ◀──────────┘   until clean
```

### Components

- **`review-tour.json`** — AI-authored. Steps carry `file`+`range` (post-change lines), `kind`
  (`changed`/`context`/`new-file`), `why` (review-oriented narrative), `calls`/`returnsTo`
  (the A→B→A jumps). Order + narrative only; never code.
- **CLI** (`src/cli.ts`) — `serve` (default), `check` (terminal coverage, exits 1 if uncovered),
  `init`, `help`. Flags: `--dir`, `--base`, `--port`, `--no-open`.
- **git layer** (`src/git.ts`) — base resolution (override → merge-base with default branch →
  HEAD → empty tree), `git diff` capture, file-range reads for `context` steps.
- **diff parser** (`src/diff.ts`) — unified diff → files/hunks/lines; changed-range extraction.
- **tour** (`src/tour.ts`) — load + hand-rolled validation (shape, kinds, ranges, ref integrity).
- **coverage** (`src/coverage.ts`) — the trust check: every changed hunk must be claimed by a
  step; unclaimed hunks surfaced. Also flags stale steps pointing at unchanged code.
- **renderer** (`src/render.ts` + `src/page-assets.ts`) — self-contained HTML: ordered steps,
  why-notes, real highlighted diff, jump links, `vscode://` editor links, per-line comment UI,
  the "Not in the tour" section. All code escaped server-side; client JS uses only `textContent`.
- **server** (`src/server.ts`) — re-renders on each GET (refresh = live); `GET/POST/DELETE
  /api/comments` persist to `.cairn/comments.json`.
- **comments** (`src/comments.ts`) — validate + persist; the handoff file.
- **skills** — `review-tour` (producer) and `address-review` (consumer) for Claude Code.

## Data: comment

```jsonc
{ "id": "c_...", "step": "s1", "file": "fileA.ts", "line": 2,
  "type": "change|question|nit", "body": "...", "status": "open|addressed|resolved",
  "createdAt": "ISO", "reply": "filled in by the agent" }
```

## Out of scope (v1)

Live-watch/SSE auto-refresh; comment re-anchoring after code shifts; side-by-side view;
multi-tour; cross-machine state; build-time syntax highlighting.

## Known limitations

- Comments anchor to a line number at comment-time; an unresolved comment can drift after edits
  (falls back to a note on its step). Mitigated by the batch loop: resolve, then re-review fresh.
- Tour line ranges assume the file is unchanged since the agent wrote them — true in the
  immediate review workflow.

## Verification

End-to-end smoke test (temp repo, real branch diff, deliberately-uncovered hunk) confirmed:
base detection, diff parse, coverage catching the uncovered change, page render, and the full
comment round-trip to `.cairn/comments.json`. `tsc` clean.
