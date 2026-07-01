# Two send modes: "Add comment" vs "Ask now" (+ batch "Send all")

**Date:** 2026-07-01
**Status:** Design approved, pending implementation

## Problem

Every way of writing in diffStory currently auto-fires the agent. Leaving a comment
(`buildComposer`) and sending a chat follow-up (`buildThreadComposer`) both POST and then
immediately call `sendToAgent`, spinning up the full "Addressing comments" workflow —
even for a one-line question. There is no way to just *jot something down* without
triggering a heavyweight agent run, and no way to stack several comments and send them
together.

## Goal

Give the reviewer explicit control over *when* the agent runs, via two modes offered
wherever they write:

- **Batch:** "Add" a comment/message (saved, agent untouched), stack up as many as you
  want, then fire them all at once with a visible **"Send all (N)"** button.
- **Instant:** "Ask now" sends this one immediately and streams the answer — the current
  one-at-a-time chat behavior.

## Decisions (settled during brainstorming)

1. **Two buttons on BOTH composers** — the new-comment composer and the thread chat box.
2. **"Add comment"** saves only (no agent run). **"Ask now"** saves and runs immediately.
3. **Enter = Ask now** in the chat box (it's a chat box; Shift+Enter = newline). "Add" is
   an explicit button click.
4. **Batch trigger** = a visible **"Send all (N)"** button in the review header (next to
   the open-comments count), reusing the existing `sendToAgent('all')` path. Shown/enabled
   only when N > 0.
5. **No new comment status.** "Queued/un-sent" reuses the existing `open` status; N is the
   open-comment count that the header already tracks.

## Non-goals

- No server/API changes — the endpoints already *save without running*; "Add" just skips
  the client's follow-up `/api/address` call.
- No new persisted state or migration.
- Not changing the agent workflow itself. (Optional future polish: a lighter progress-panel
  title like "Answering…" for a single Ask-now vs. "Addressing N comments" for a batch —
  out of scope here.)

## Design

### Client (`src/page-assets.ts`) — the bulk of the work

**New-comment composer (`buildComposer`):** replace the single "Send" button with:
- **"Add comment"** (ghost) → POST `/api/comments`, push to `allComments`, `syncThreads`,
  `refreshCount`, close composer. Does **not** call `sendToAgent`.
- **"Ask now"** (solid) → the same POST, then `sendToAgent([c.id])` (current behavior).

Factor the shared POST into one helper taking a `run: boolean`, so the two buttons differ
only by whether they call `sendToAgent` on success.

**Thread chat composer (`buildThreadComposer`):** two buttons:
- **"Add"** (ghost, `data-thread-add`) → POST `/api/comments/:id/message`, update the
  cached comment, `patchComment`, `refreshCount`. No agent run.
- **"Ask now"** (solid, `data-thread-send`, existing) → same, then `sendToAgent([id])`.

Refactor `sendThreadMessage(wrap)` to `sendThreadMessage(wrap, run)`; the click handlers
pass `run=false` for Add and `run=true` for Ask now. Enter-to-send calls it with `run=true`.

**"Send all (N)" button:** surface the existing batch action as a visible button in the
review header, beside the open-comments count. Label carries the live count (e.g.
`Send all (3)`). Click → `sendToAgent('all')`. Visibility/enabled state driven by the same
open-count logic as `refreshCount`/`setBusy` (hidden or disabled when N === 0 or the agent
is busy). This reuses the existing `data-address-all` handler; the review-menu entry may
remain or be dropped in favor of this button.

**Busy state:** `setBusy` already disables `[data-thread-send]`; extend it to also disable
the new `[data-*-add]` buttons and the "Send all" button during a run.

### Server (`src/server.ts`)

**No changes.** `POST /api/comments` and `POST /api/comments/:id/message` already persist
without running the agent; `POST /api/address` (`{all:true}` or `{commentIds}`) already
runs it. "Add" = save and stop; "Ask now"/"Send all" = save then call `/api/address`.

### Render (`src/render.ts`)

- The server-rendered thread composer in `commentHtml` gains the same two buttons
  (`Add` + `Ask now`), matching the client so a page-load thread behaves identically.
- The "Send all (N)" button is rendered in the review header consistently with the client
  (same markup/handler), near the existing open-count badge, shown when N > 0.

### Tests

- `test/comments-client.test.mjs` — both composers expose an Add button and an Ask-now
  button; the Add path does not reference `sendToAgent`, the Ask-now path does; Enter maps
  to the run path; the "Send all" button reuses `sendToAgent('all')` and reflects the count;
  `setBusy` disables the Add and Send-all controls.
- `test/comments-render.test.mjs` — `commentHtml` emits both composer buttons; the header
  renders a "Send all" control when open comments exist.

### Build artifact

Rebuild and commit `dist/` alongside `src/` (github installs have no build step).

## Data flow

```
Add:      write → POST (create / append+reopen) → save in cache → render. STOP. (status open)
Ask now:  write → POST → save → sendToAgent([id]) → live run → answer turn.
Send all: click → sendToAgent('all') → /api/address {all:true} → agent addresses every open comment.
```

## Error handling

- Empty text → no request (both Add and Ask now guard first).
- Agent busy → Add still works (it never runs the agent); Ask now / Send all show the
  existing "agent is already working" toast.
- POST failure → existing toast; nothing sent, comment not added to cache.
