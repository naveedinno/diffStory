# Conversational review threads (in-thread chat box)

**Date:** 2026-07-01
**Status:** Design approved, pending spec review

## Problem

A diffStory review thread is single-turn. A reviewer selects code, leaves a comment
(`body`), it auto-sends to the agent, and the agent writes back exactly one answer
(`reply`). "Send again" re-runs the agent and *overwrites* that one reply. There is no
way to have a back-and-forth: no place to store a conversation and no input inside the
thread to continue it.

The thread already *renders* chat-style — right-aligned "You" bubbles and a left
`◈ diffStory AI` block — so the visual foundation exists. What's missing is a real
multi-turn model behind it and a persistent input to drive it.

## Goal

Turn each review thread into a live conversation. The reviewer types a follow-up in an
always-present chat box; each message re-invokes the agent with the full thread as
context; the agent's answer streams back in-line and is appended as a new turn. The
whole exchange (you → AI → you → AI …) is preserved in order.

## Decisions (settled during brainstorming)

1. **Send behavior:** *auto-run the AI each turn.* Sending a message immediately
   re-invokes the agent with the full thread as context; its reply streams back in-line.
   Mirrors how leaving a comment already auto-sends today.
2. **AI powers:** *full agent.* A chat follow-up may edit code (same as a `change`
   comment today), not just talk. Change-intent follow-ups edit files and refresh the
   tour, and the existing "Reload diff" affordance applies per turn.
3. **Resolved threads:** *always show the input.* The chat box stays even on a resolved
   thread; sending a new message auto-reopens the thread (status → `open`) and continues.
   Every send flips status to `open`, so there is one uniform send path.

## Non-goals

- No separate/global chat surface. The conversation lives inside the existing thread.
- No change to how a comment is *created* (selection → composer → first `body`).
- No new agent-run plumbing: follow-ups reuse the existing `/api/address` streaming loop.
- No fully-unified message model that replaces `body`/`reply` (see Approach B, rejected).

## Approach

**Chosen — `turns[]` array (Approach A).** Add an ordered turn list to a comment. The
conversation is `body` (the anchored first user message) followed by `turns`. Existing
comments that only have `reply` are migrated on load. Small blast radius, backward
compatible with existing `comments.json` files, clean render loop.

**Rejected — Approach B (unified `messages[]` replacing `body`/`reply`).** Purest model,
but `body` is load-bearing — it carries the selection, the comment `type`, and the
copy-to-agent export — so replacing it ripples through much more code and needs a riskier
migration. YAGNI here.

**Rejected — Approach C (keep single `reply`, append markdown to it).** Cheapest, but the
AI can't distinguish turns and the history turns to mush. Fails the "go back and forth"
goal.

## Design

### 1. Types + storage (`src/types.ts`, `src/comments.ts`)

- New type:
  ```ts
  export interface Turn {
    role: 'user' | 'ai';
    text: string;
    at: string; // ISO timestamp
  }
  ```
- Add `turns?: Turn[]` to `Comment`. `reply?` stays as a legacy field for backward
  compatibility (old files, external consumers) but is no longer the render source.
- **Normalization on load:** `loadComments` returns comments where, if a comment has a
  non-empty `reply` and no `turns`, `turns` is synthesized as
  `[{ role: 'ai', text: reply, at: createdAt }]`. After normalization, the conversation
  is always `body` + `turns`. Rendering and the agent both treat `turns` as source of
  truth.
- New helper `appendTurn(repo, id, turn)`:
  - Validates `role ∈ {user, ai}` and non-empty trimmed `text`.
  - Loads, finds the comment by id (returns `null` if missing), pushes the turn with a
    server-set `at`, saves the full array, returns the updated comment.
- New helper (or inline in the route) to append a *user* turn and set `status` to `open`
  in one save.

### 2. Server (`src/server.ts`)

- `POST /api/comments/:id/message` with `{ text }`:
  - Rejects empty/whitespace `text` (400) and unknown id (404).
  - Appends `{ role: 'user', text, at }` to `turns` **and sets status to `open`** (so the
    agent re-engages regardless of prior status — including `resolved`).
  - Returns the updated comment as JSON.
- The client then calls the existing `POST /api/address` with `{ commentIds: [id] }` to
  run the agent. No new streaming/agent code.

### 3. Agent / skill (`src/agent.ts` prompt, `skills/address-review/SKILL.md`)

- Teach the agent that a comment's conversation is `body` followed by `turns`, an ordered
  list of `{role, text, at}`.
- When handling an `open` comment: read the whole thread, answer the **latest user
  message** in context, and **append** a `{ role: "ai", text, at }` turn — never
  overwrite `body` or prior turns. Set `status` to `addressed`.
- First-pass answers also append an `ai` turn (uniform contract). Legacy `reply` writes
  from an older skill version still work because `loadComments` migrates them.
- Keep existing behavior for change/nit intent: edit code, describe it in the appended
  `ai` turn, refresh the review-tour so line ranges stay correct.
- Update the SKILL.md example to show a `turns` array instead of a bare `reply`.

### 4. UI (`src/page-assets.ts`)

- **Render the conversation:** replace the single `ensureReply(c.reply)` with a loop over
  the normalized `body` + `turns`. `user` turns render as the existing right-aligned
  bubbles; `ai` turns render as the existing `◈ diffStory AI` blocks. Order preserved.
- **Persistent chat composer** pinned at the bottom of *every* thread (shown regardless of
  status, per decision 3): a compact textarea + Send button, full width, placeholder
  "Reply to diffStory…". Enter sends; Shift+Enter inserts a newline. Disabled while an
  agent run is in progress (reuse `setBusy`).
- **On send:**
  1. Optimistically append the user's message as a right bubble and clear the input.
  2. `POST /api/comments/:id/message`.
  3. `sendToAgent([id])` — reuses the existing live `◈` streaming draft (the pending AI
     turn) and, on completion, `refreshComments` pulls the appended `ai` turn and clears
     the draft. `codeChanged` still surfaces the "Reload diff" affordance.
- **Buttons:** "Send again" is superseded by the chat box and is removed. **Resolve** and
  **Delete** stay. Resolve→Reopen still works; a resolved thread also reopens implicitly
  when a new message is sent.

### 5. Tests

- `test/comments.test.mjs` — `appendTurn` validation; `reply` → `turns` migration on
  load; user-turn append flips status to `open`.
- `test/app-server.test.mjs` — `POST /api/comments/:id/message` appends a user turn,
  reopens the thread, 400 on empty, 404 on unknown id.
- `test/comments-render.test.mjs` — a thread with `body` + multiple `turns` renders the
  messages in order with correct user/ai styling; a legacy `reply`-only comment renders
  as one AI turn.
- `test/comments-client.test.mjs` — composer submit posts to `/message` then triggers the
  address run; input disabled while busy.
- `test/agent.test.mjs` — `addressPrompt` instructs appending an `ai` turn / reading the
  full thread (not overwriting).

### 6. Build artifact

- Rebuild `dist/` and commit it alongside `src/` (github installs have no build step).

## Data flow (one follow-up)

```
reviewer types → POST /api/comments/:id/message
  → appendTurn(user) + status=open → returns comment
client → POST /api/address {commentIds:[id]}
  → streamAgent → live ◈ draft updates in the thread
agent reads comments.json (body + turns) → appends {role:'ai',...} → status=addressed
client refreshComments → renders the new ai turn, clears draft, shows Reload-diff if code changed
```

## Error handling

- Empty message → no request (client guard) and 400 (server guard).
- Agent already busy → existing toast ("the agent is already working…"); the message is
  still saved, so the reviewer can re-trigger after the current run.
- Agent run fails/stops → existing error draft state; the user turn remains in the thread
  so the reviewer can retry.
- Unknown comment id → 404; client leaves the optimistic bubble and surfaces a toast.
