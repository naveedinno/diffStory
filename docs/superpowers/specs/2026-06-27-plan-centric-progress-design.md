# Plan-centric agent progress — redesign

**Date:** 2026-06-27
**Status:** Design, awaiting review
**Supersedes the UI of:** [2026-06-23 live-agent-progress](2026-06-23-live-agent-progress-design.md) (keeps its server spine and honesty rules)

## Problem

The current progress panel ([src/progress-ui.ts](../../../src/progress-ui.ts)) shows the
app's invented machinery instead of the agent's actual work. Three concrete failures, in
the user's words — *"I don't know what it is doing"* and *"ugly weird labels"*:

1. **Invented phase vocabulary.** Labels like "Resolving the change", "Preparing the
   prompt", "Agent is working" ([src/progress.ts:45](../../../src/progress.ts)) are
   internal jargon. They name our pipeline, not anything the reviewer recognizes.
2. **A raw firehose.** A scrolling timeline of every tool call plus a "Raw agent output"
   drawer. It reads like a log, not a status.
3. **We delete the best signal.** The agent calls `TodoWrite` with a real, human-readable
   checklist (item text + status). [src/agent.ts:222](../../../src/agent.ts) collapses the
   entire plan to the string `"Updating the plan"` and throws the items away. The agent's
   own plan *is* the progress, and we discard it.

## Core idea

Stop narrating our pipeline. Surface **the agent's own plan, in its own words**, ticking
from pending → active → done, with one calm live line of what's happening *right now*
attached to the active step. Honest liveness in the footer. Nothing else by default.

This uses the two richest *honest* signals already in the stream — the `TodoWrite`
checklist and the running tool/narration events — and drops exactly the parts the user
called ugly (phase jargon, raw dump).

The honesty rules from the 2026-06-23 design are unchanged: nothing is fabricated. The
plan reflects real `TodoWrite` calls; the live line reflects real tool events; liveness
reflects the real child process + heartbeat; preflight failures still return a non-200
blocked state.

## What the panel shows

```
┌─────────────────────────────────────────────┐
│ ◐ Writing your review   [Claude · sonnet]  Stop│  header: lifecycle + agent + stop
│ symmio/contracts · main → working tree         │  repo/scope (mono, muted)
│                                                │
│ ✓ Read the diff and map what changed           │  done — receded
│ ✓ Trace the address-console flow               │  done — receded
│ ◉ Drafting the review story                    │  active — lit
│      Reading src/server.ts                      │    live detail line (mono, muted)
│ ○ Check coverage is clean                       │  pending
│ ○ Write story.json                              │  pending
│                                                │
│ • Working · 1m 12s elapsed         2 of 5 done │  footer: honest liveness
└─────────────────────────────────────────────┘
```

- **Header** — a plain-language *lifecycle* label (see below), the agent/model chip, and a
  Stop button while running (becomes Close when finished).
- **Repo line** — `repoName · base → head` (and `· N comments` for the address workflow).
  Unchanged from today.
- **The plan** — the agent's checklist. Done items recede (muted, filled check). The single
  active item is lit (blue ring, present-tense text) and carries the live detail line. Pending
  items are quiet hollow circles.
- **Live detail line** — the most recent meaningful action (current file, command, or search)
  rendered under the active item in mono/muted. This is what gives motion without a firehose.
  If a plan exists but currently has no active (`in_progress`) item — e.g. between two steps —
  the line renders standalone just below the list rather than nested under an item.
- **Footer** — `<pulse> Working · <elapsed>` on the left, `<done>/<total> done` on the right.
  On a quiet stretch it adds `· quiet Ns`. On finish it reads Done / Stopped / Couldn't finish.

### Lifecycle label (replaces the phase jargon)

The whole invented `Phase` vocabulary collapses, *for display*, into a five-state plain
lifecycle shown in the header:

| State        | Header text            | When |
|--------------|------------------------|------|
| preparing    | "Preparing…"           | before the agent emits anything |
| working      | "Writing your review" / "Addressing comments" | agent is running |
| checking     | "Checking the result…" | agent exited, app is validating output/coverage |
| done         | "Review ready" / "Comments addressed" | success |
| failed/stopped/blocked | "Couldn't finish" / "Stopped" / "Cannot start" | terminal non-success |

The internal `Phase` type stays as-is in the protocol (the server still uses it for honest
milestone tracking and staged errors) — we just stop rendering its raw labels. A tiny
`lifecycleLabel(phase, workflow, status)` mapper in the UI does the translation.

### The plan and the lifecycle are two honest layers

- The **checklist** is purely the agent's `TodoWrite` items — the work the agent decided to do.
- The **header/footer lifecycle** is the app's own bracket around that work (preparing before,
  checking after). We never mix app steps into the agent's checklist, so neither layer lies
  about whose work it is.

## Fallback: no plan yet

`TodoWrite` is not guaranteed. A short Claude run, or Codex (which streams prose, not
structured todos), may never produce a plan. The panel must stay honest and useful anyway:

- **Before the first plan** (or if none ever arrives): hide the checklist entirely and show a
  single calm current-activity line in its place — the latest narration or action ("Reading
  the diff…", "Running the tests…"). This is the minimal "status pill" behavior.
- **The moment the first `TodoWrite` lands:** the checklist appears and becomes the centerpiece;
  the standalone line moves under the active item.

So the panel spans the full range — a calm one-liner when that's all we have, a full plan when
the agent gives us one — without ever inventing structure we don't have.

## Failure & raw output

- The "Raw agent output" drawer is gone from the default view. On **failure**, a "Details"
  disclosure appears in the footer area exposing the captured agent output (already staged by
  the server). On success it never shows.
- Blocked (preflight) and stopped states reuse the existing server contract; only their
  presentation changes to the plain lifecycle text.

## Changes by file

**`src/progress.ts`** — add one event and a small label helper:
- New event `{ type: 'plan'; items: { text: string; status: 'pending' | 'active' | 'done' }[] }`
  plus a `planEvent(items)` helper. The protocol carries the agent's checklist verbatim; the
  UI stays dumb.
- Keep `Phase`, `PHASE_ORDER`, `phaseRank`, `observedPhase` as-is (honest milestone tracking is
  unchanged). `PHASE_LABELS` may stay for internal/debug use but is no longer the display source.

**`src/agent.ts`** — stop discarding the plan:
- In `classifyTool`, map `TodoWrite` to a `plan` event built from `input.todos`. For each todo:
  `text = todo.status === 'in_progress' ? todo.activeForm : todo.content`, and
  `status = in_progress→active, completed→done, else pending`. This keeps the present-tense
  "Drafting the review story" form for the active item and the imperative form otherwise — all
  decided here so the UI renders raw strings.

**`src/progress-ui.ts`** — the redesign itself:
- New markup: header (lifecycle + agent chip + stop/close), repo line, a `<ol>` plan list, a
  fallback `<div>` current-activity line, footer liveness, and a hidden failure-details block.
- `ProgressPanel.handle` learns the `plan` event: render/replace the checklist, mark active/done.
  `file`/`command`/`activity` events update the live detail line attached to the active item
  (or the standalone fallback line when there's no plan). `text`/narration no longer dumps to a
  visible drawer — it feeds the fallback line only when no plan exists, and is otherwise dropped
  from the default view (still captured server-side for failure details).
- `lifecycleLabel()` maps phase/workflow/status → the plain header text.
- Styling follows the Apple system look already in the file (SF fonts, system colors, hairlines);
  this is a rewrite of the same self-contained CSS, not a new design language.

**`src/server.ts`** — pass-through only. The `plan` event flows through `runWorkflow` like any
other `ProgressEvent`; no spine changes. Verify nothing in the server filters unknown event types.

**`dist/`** — rebuild and commit alongside `src/` (github installs have no build step).

## Testing

- **Pure helpers (unit):** `planEvent` shape; `classifyTool('TodoWrite', …)` produces the right
  items/statuses incl. the activeForm/content choice; `lifecycleLabel` for each state×workflow.
- **Parser (unit):** `parseClaudeStreamLine` on a real `TodoWrite` `tool_use` block yields a
  `plan` event with mapped statuses.
- **Render (existing harness):** the panel renders the checklist, recedes done items, lights the
  active one, attaches the live line; falls back to the single line when no `plan` event arrives;
  shows the failure-details disclosure only on failure. Extend `test/render-page.test.mjs` /
  `test/change-route.test.mjs` rather than adding a new harness.

## Out of scope

- No change to the agent prompts or the story/comments formats.
- No change to the server spine, heartbeat, or error-staging contract.
- No new dependencies; the panel stays a self-contained string-builder module.
