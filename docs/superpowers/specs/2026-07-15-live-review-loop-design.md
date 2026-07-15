# Live Review Loop

Date: 2026-07-15
Status: approved

## Problem

diffStory's core loop is agent ↔ reviewer, but nothing in the browser is live.
Agent progress streams only inside the one-shot NDJSON POST; after that, an
open review has no way to learn that the agent replied to comments, updated the
story, or changed the working tree. `Reload diff` is a full `location.reload()`
and review-state freshness is only re-checked when the user mutates a comment.
The reviewer discovers agent work by habit-refreshing.

## Goal

An open review page notices, without a manual reload:

- new or updated agent replies in `.diffstory/comments.json`
- review-round/timeline changes in `.diffstory/review-state.json`
- story changes in `.diffstory/story.json` or `.diffstory/stories/`
- working-tree diff drift relative to the fingerprint the page rendered with

## Behavior contract (hybrid)

- **Non-destructive state refreshes in place automatically.** Comment replies,
  feedback cards, unresolved counts, and review-timeline identity update
  without user action, reusing the existing idempotent client paths.
- **Content changes never re-render under the reader.** A changed diff or
  story shows one quiet, dismissible banner with a Reload action. The page
  never reloads itself, never moves the viewport, and never steals focus.

## Architecture

### Server: event hub (`src/live.ts`, new)

A per-repo watch group exists only while at least one live client is connected
for that repo, and is disposed when the last client disconnects.

Each group runs two sources:

1. **`fs.watch` on `<repo>/.diffstory/`** (directory-level, non-recursive plus
   a nested watcher for `stories/`), so editor atomic rename-writes are
   caught. Events are debounced ~200 ms and classified by filename:
   - `comments.json` → `comments-changed`
   - `review-state.json` → `review-state-changed`
   - `story.json`, `stories/*` → `story-changed`

   If `.diffstory/` does not exist yet, the poll loop attaches the watcher
   once the directory appears. If the watcher errors (directory removed,
   EMFILE), the group falls back to mtime comparison inside the poll loop and
   keeps emitting the same events.

2. **Fingerprint poll**, default every 4 s, one per distinct `(base, head)`
   scope among the group's connected clients — never per tab. Each tick
   recomputes `reviewChangeFingerprint(repo, base, head)` (`src/git.ts:180`)
   and compares it against each client's lease fingerprint:
   - mismatch → `diff-changed` to the stale clients (once per transition)
   - later match again (agent reverted) → `diff-synced` so the banner clears

Debounce and poll intervals live in `src/config.ts` and are injectable so
tests never sleep.

### Transport: SSE

- Endpoint: `GET /api/events?page=<lease token>`.
- Lease validation is identical to the existing lazy-panel endpoints
  (`validateReviewPageLease`). Invalid or expired lease → `410`.
- Response: `Content-Type: text/event-stream`, `Cache-Control: no-store`,
  heartbeat comment line (`: ping`) every 15 s.
- Event format: `event: <type>` plus one JSON `data:` line.
- No WebSocket and no new dependency; plain Node `http` response streaming.

### Events

| event | data | client action |
| --- | --- | --- |
| `comments-changed` | `{}` | run existing `refreshComments()`; the client derives a toast from the refresh delta (e.g. "Agent replied to 2 comments"); no visible delta → no toast |
| `review-state-changed` | `{}` | run existing `syncReviewFeedbackIdentity()` |
| `story-changed` | `{}` | show banner: story updated |
| `diff-changed` | `{ fingerprint }` | show banner: diff changed since load |
| `diff-synced` | `{ fingerprint }` | clear the diff banner if visible |

Overlap with in-page agent runs is acceptable: `refreshComments()` is
idempotent, so an SSE event landing during or after an NDJSON workflow is a
no-op refresh, not a conflict.

### Client (inline runtime in `src/page-assets.ts`)

- One `EventSource` per leased page. Both the review page and the change
  ("All files") page participate, since both are issued leases.
- `EventSource` auto-reconnect handles transient drops. A terminally closed
  stream (server restart → lease gone → `410`) shows the banner in its
  "live updates disconnected — reload" form rather than silently going stale.
- No new client framework; a small `startLiveEvents()` block wired where the
  page boots, gated on the presence of a lease token.

### Banner

- One quiet, dismissible strip adjacent to the semantic review ledger.
- Informational blue per DESIGN_MEMORY (amber stays reserved for blockers).
- One sentence + one **Reload** action + dismiss. Reload preserves current
  scope params (same URL), matching today's reload semantics.
- ARIA live region (`polite`), stable accessible name, ≥44 px targets, no
  entrance animation under reduced motion, WCAG AA in both themes.
- Priority when multiple triggers stack: diff-changed wins over story-changed
  wins over disconnected; one banner at a time, latest-priority text.

## Lifecycle and edge cases

- Multiple tabs on the same repo share one watch group; each tab has its own
  lease and staleness comparison.
- Multiple repos open → independent groups.
- Last client disconnects → dispose watchers and clear the poll timer; no
  background work with zero clients.
- Events fire only after a write completes; the debounce absorbs partial and
  atomic-rename writes. The server does not suppress events for its own writes
  (e.g. a comment POST from the same tab) — the client refresh paths are
  idempotent, so the extra event is a no-op.
- The hub never reads or transmits file contents over SSE — event names and
  fingerprints only; the client re-fetches through existing authenticated
  endpoints.

## Testing

- New `test/live-events.test.mjs` via the existing app-server harness:
  - open SSE with a real lease; write `comments.json` → `comments-changed`
  - write `review-state.json` → `review-state-changed`
  - write `story.json` → `story-changed`
  - mutate the working tree, tick the injectable poll → `diff-changed`;
    revert → `diff-synced`
  - disconnect the last client → watchers disposed, poll cleared
  - invalid lease → `410`
- `test/render-page.test.mjs`: banner markup, data hooks, ARIA contract,
  reduced-motion rule.
- Existing motion-regression suite must stay green.

## Out of scope

- Auto-re-rendering changed file panels or story steps (rejected
  "fully automatic" mode).
- Watching the whole working tree with `fs.watch` (the fingerprint poll
  covers diff drift more reliably and more cheaply).
- VS Code extension parity for live events.
- Pausing the poll for hidden tabs (local, cheap; revisit only if it shows up
  in practice).
