# Interactive agent loop — design

**Date:** 2026-06-16
**Status:** Approved (design); implementation pending

## Problem

diffStory's review→fix round-trip is manual. Today the reviewer:

1. Runs `diffstory story` / `serve` and reads the guided diff.
2. Comments on lines → saved to `.diffstory/comments.json`.
3. **Leaves the app** and runs `/diffstory:address-review` (Claude Code) or `$address-review`
   (Codex) so the agent answers questions, fixes `change`/`nit` items, writes a `reply` +
   `status: addressed` back into `comments.json`, and refreshes the story.
4. Refreshes the page to see replies and the updated diff.

The README lists this as a v1 limitation ("Manual round-trip … Live-watch is planned").

## Goal

Collapse step 3 into the page. From the review page the reviewer submits a comment/question and
**watches the agent answer (and fix) live**, with the reply landing inline — no terminal, no
manual refresh.

## Key decision: reuse the `address-review` skill verbatim

The agent already does all the real work via the `address-review` skill. We do **not** reimplement
that logic server-side. Instead:

- **Agent owns the data.** The server drives the agent headlessly with a prompt that says *"use the
  diffStory address-review skill on these comment ids."* The agent answers, edits code, and writes
  `reply` + `status` back into `comments.json` exactly as it does today.
- **Server owns the transport.** The server only triggers the run and streams its output to the
  browser. On completion it re-reads `comments.json` (replies are already there) and the client
  refreshes the diff if code changed.

Rejected alternative: have the server parse the agent's stdout and write replies itself. This
reinvents what the skill already does reliably, and asking the agent to emit a strict machine format
*while also* editing code is brittle. Reusing the skill keeps agent behavior identical whether
triggered from the terminal or the page.

## Decisions locked with the user

- **Trigger:** both — a per-comment **Send** action *and* an **Address all open (N)** button.
- **Agent scope:** answer **and** edit code (full `address-review` power), triggered from the page.
- **Output:** **stream live** — the agent's text/tool activity appears as it works.

## Components

### 1. `src/agent.ts` — add two functions (cohesive with `runAgent`/`storyPrompt`)

- **`addressPrompt(target: string[] | 'all'): string`** — pure, unit-tested. Mirrors `storyPrompt`:
  instructs the agent to use the `address-review` skill on the given comment ids (or all open
  comments) in `.diffstory/comments.json`; act by type; write a concrete `reply`; set
  `status: "addressed"`; edit code where needed; refresh the story / run `diffstory check` if line
  numbers moved; do not ask questions.

- **`streamAgent(agent, repo, prompt, model, onEvent): Promise<{ ok: boolean }>`** — like
  `runAgent`, but emits events as output arrives instead of buffering. A per-agent **stream adapter**
  isolates the CLI-specific format:
  - **Claude:** `claude -p <prompt> --output-format stream-json --verbose --permission-mode
    acceptEdits --model <m>`. Parse JSONL events → emit assistant text as `text`, tool_use
    (Edit/Write/Bash) as `tool` notices (e.g. `✏️ editing src/foo.ts`).
  - **Codex:** `codex exec --full-auto [--model m] <prompt>`. Forward streamed stdout as `text`
    (optionally parse `--json` events).
  - Exact flags verified against each CLI's `--help` before coding (as the repo already does for
    `agentCommand`).
  - Event shape: `{ type: 'text' | 'tool' | 'done' | 'error', data?: string }`.

### 2. `src/server.ts` — one new endpoint

- **`POST /api/address`** with body `{ commentIds: string[] }` or `{ all: true }`. Responds with a
  **streamed body**: newline-delimited JSON events (`text`/`tool`/`done`/`error`), read on the
  client via `fetch().body.getReader()`. Chosen over `EventSource` because EventSource is GET-only
  and cannot carry the comment ids cleanly.
- **Single-flight lock.** Only one agent run at a time per server — concurrent runs editing the same
  working tree would collide. If a run is in progress, respond `409` immediately (no stream); the
  client treats that as "busy". The UI also disables Send while a run is active.
- Resolves the agent via existing `availableAgents()`; reuses `addressPrompt` + `streamAgent`.

### 3. `src/render.ts` + `src/page-assets.ts` — the UI

- A **Send** action on each open comment, and an **Address all open (N)** control in the comments
  area. Both server-rendered in the initial HTML (`render.ts`); behavior in `page-assets.ts`.
- A live **"agent is working…"** panel that fills with streamed `text`/`tool` events.
- On `done`: re-fetch `/api/comments`, patch each comment's `reply` + status badge into its thread
  (no reload for pure answers). If the agent **edited code**, show a quiet **"Code updated — reload
  to see the new diff"** banner (the diff + story are server-rendered, so a page reload is the
  correct, cheap way to refresh them).
- While a run is active, Send / Address-all are disabled (matches the server lock).

## Data flow

```
Send / Address all
  → POST /api/address { commentIds | all }
  → server takes single-flight lock
  → streamAgent(agent, repo, addressPrompt(target), model, onEvent)
  → events stream to the page (text / tool)
  → agent writes comments.json (reply + status) and edits code
  → 'done'
  → client re-fetches /api/comments, patches replies + status
  → if working tree changed, show "reload for new diff" banner
  → server releases lock
```

## Edge cases & safety

- **No agent installed** → `error` event + friendly message (reuse `availableAgents()`), as in
  `cmdStory`.
- **Agent writes nothing / non-zero exit** → emit `error` with output tail; leave comments `open`
  (mirrors `cmdStory`'s failure handling).
- **Busy** → `409` / `busy`; UI keeps the existing run's panel and blocks new sends.
- **Safety posture unchanged.** This runs the user's agent in their working tree exactly as
  `/address-review` does today — localhost-only server, same `acceptEdits` / `--full-auto`. The only
  difference is a browser button instead of a CLI command. No new risk class is introduced.

## Testing

- **Unit:** `addressPrompt` (pure — asserts ids/`all` wording, skill reference, contract lines).
- **Unit:** the **stream adapters** against captured sample output (the fiddly part — fixtures of
  Claude `stream-json` lines and Codex stdout → expected normalized events).
- **Server:** mock `streamAgent`; assert event framing on `POST /api/address` and the single-flight
  `409` when a run is in progress.
- The raw spawn stays integration-only (like `runAgent`).

## Scope

**In v1:** per-comment Send, Address-all, live streaming, code edits, inline reply patch,
reload-on-code-change banner, single-flight lock.

**Out (v1, YAGNI):**
- A free-form "ask anything" box not anchored to a line — a `question`-type comment already covers
  "submit a question, see the answer."
- Multi-turn conversation memory — each run is one-shot, like today.
- Cancel-mid-run.
